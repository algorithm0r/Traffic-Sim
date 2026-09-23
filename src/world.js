'use strict';
// The freeway: a closed loop of `loopLength` m with 2-4 through lanes, interchanges on the
// right (exit gore, then onramp with an acceleration lane), IDM car-following and MOBIL
// lane changing (Kesting, Treiber & Helbing 2007, Transp. Res. Rec. 1999:86).
//
// Holds all state and advances it; draws nothing (the Observer renders) — which is what
// lets the same file run headlessly. Update order per tick:
//   sortLanes → laneChangePass → sortLanes → accelPass → integratePass → rampPass
// Accelerations are computed from frozen state, then everyone moves (two-phase), so the
// integration has no in-tick order dependence; lane changes are sequential like Treiber's
// own reference simulator.
var World = class World {
  constructor() {
    const P = PARAMETERS;
    this.L = P.loopLength;
    this.laneCount = P.laneCount;
    this.time = 0;
    this.nextId = 1;
    this.rng = mulberry32(P.seed >= 0 ? P.seed : (Math.random() * 2 ** 32) | 0);

    this.vehicles = [];   // mainline vehicles (ramp vehicles live on their ramp until merge)
    this.lanes = [];      // per-lane arrays sorted by x, rebuilt each tick

    // interchanges, evenly spaced: exit gore at `base`, paired onramp gore rampGap later
    this.exits = [];
    this.onramps = [];
    for (let i = 0; i < P.numInterchanges; i++) {
      const base = ((i + 0.35) / P.numInterchanges) * this.L;
      this.exits.push({ idx: i, x: base });
      this.onramps.push({
        idx: i, x: (base + P.rampGap) % this.L, len: P.rampLength,
        vehicles: [], queue: 0, nextArrival: this.expo(P.demand), spawned: 0,
      });
    }

    this.detectors = P.detectorFracs.map((f) => ({ x: f * this.L, count: 0, speedSum: 0 }));
    this.stats = {
      laneChanges: 0, merges: 0, exited: 0, missedExits: 0, collisions: 0,
      spawned: 0, travelTimeSum: 0, travelTimeN: 0,
      sideswipes: 0, aborts: 0, expiries: 0, changeDurSum: 0, changeDurN: 0,   // bicycle body only
      // safety (Stage 11): crashes are contacts at speed; near-crashes are TTC events
      crashes: 0, rearEnds: 0, sideswipeCrashes: 0, departures: 0, secondary: 0,
      mergeCrashes: 0, cleared: 0, nearCrashes: 0, glances: 0, periphCorrections: 0,
      petSum: 0, petN: 0, lcConflicts: 0,   // post-encroachment time at lane-change completion
    };

    this.seedMainline(P.initialDensity);
  }

  // ---------- sampling helpers ----------

  expo(ratePerHour) {           // exponential inter-arrival time for a Poisson process
    const lam = Math.max(ratePerHour, 1e-9) / 3600;
    return -Math.log(1 - this.rng()) / lam;
  }

  sampleProfile() {
    const P = PARAMETERS;
    let name;
    if (P.forceArchetype) name = P.forceArchetype;
    else if (this.rng() < P.truckFraction) name = 'truck';
    else {
      const A = ARCHETYPES;
      const tot = A.aggressive.share + A.normal.share + A.cautious.share;
      const r = this.rng() * tot;
      name = r < A.aggressive.share ? 'aggressive'
           : r < A.aggressive.share + A.normal.share ? 'normal' : 'cautious';
    }
    return new DriverProfile(name, ARCHETYPES[name], this.rng, PARAMETERS.profileVariability);
  }

  // destination = the k-th exit ahead of fromX (k uniform in 1..2N: some trips pass the
  // start line — the loop is one long freeway, not N disjoint segments)
  sampleDest(fromX) {
    const n = this.exits.length;
    if (!n) return null;
    let first = 0, best = Infinity;
    for (let i = 0; i < n; i++) {
      const d = this.distAhead((fromX + 200) % this.L, this.exits[i].x);
      if (d < best) { best = d; first = i; }
    }
    const k = 1 + Math.floor(this.rng() * 2 * n);
    return (first + (k - 1)) % n;
  }

  distAhead(from, to) { return ((to - from) % this.L + this.L) % this.L; }

  // bumper-to-bumper gap from follower f to leader l (wrap-aware). ONLY valid when l is
  // genuinely ahead of f — a negative (overlapping) gap wraps to ~L and reads as free
  // space, so feasibility tests must use overlaps() first (smoke T2 caught this).
  gap(f, l) { return ((l.x - l.len - f.x) % this.L + this.L) % this.L; }

  // do vehicles a and b physically overlap (with a small margin) anywhere on the ring?
  overlaps(a, b) {
    const d = ((b.x - a.x) % this.L + this.L) % this.L;   // how far b's front is ahead of a's
    return d < b.len + 0.5 || this.L - d < a.len + 0.5;
  }

  // Noisy perception at a decision point: gap error percErr, closing-speed error 2×
  // (humans read looming, not speed). Errors are fresh each decision — the driver acts
  // correctly on a slightly wrong world.
  perceive(veh, gap, vLead) {
    const e = veh.p.percErr;
    if (!e || gap == null) { veh.gapErr = 0; veh.closeErr = 0; return { gap, vLead }; }
    // the sampled errors persist until the next decision: the reflex reads the same
    // slightly-wrong world the decision did
    veh.gapErr = gaussFrom(this.rng, 0, e);
    veh.closeErr = gaussFrom(this.rng, 0, 2 * e);
    const gapP = Math.max(gap * (1 + veh.gapErr), 0.1);
    const closingP = (veh.v - vLead) * (1 + veh.closeErr);
    return { gap: gapP, vLead: veh.v - closingP };
  }

  // next off-road glance: Poisson at the driver's rate, suppressed by task demand
  // (inverse TTC to the leader — nobody checks the radio while closing fast)
  scheduleGlance(veh, lead) {
    const rate = veh.p.glanceRate;
    if (!rate) { veh.nextGlance = Infinity; return; }
    let demand = 0;
    if (lead) {
      const closing = veh.v - lead.v;
      if (closing > 0) demand = closing / Math.max(this.gapX(veh, lead), 0.1);
    }
    const factor = clamp(1 - PARAMETERS.attention.demandGain * demand, 0.1, 1);
    veh.nextGlance = this.time - Math.log(1 - this.rng()) / (rate * factor);
  }

  // schedule the next decision (±10% jitter so drivers don't phase-lock)
  scheduleDecision(veh) {
    veh.nextDecision = this.time + veh.p.tReact * (0.9 + 0.2 * this.rng());
  }

  // motor noise on the pedal: σ = motorErr × 20 (≈0.3 m/s² at defaults)
  pedal(veh, accCmd) {
    return veh.p.motorErr
      ? accCmd + gaussFrom(this.rng, 0, veh.p.motorErr * 20)
      : accCmd;
  }

  // IDM equilibrium speed for a profile at fixed gap (Δv = 0) — used for seeding and by
  // the tests as the analytic reference: solves 1 - (v/v0)^δ - ((s0+vT)/s)^2 = 0
  equilibriumSpeed(prof, gapM) {
    const v0 = prof.desiredSpeed();
    if (gapM <= prof.s0) return 0;
    let lo = 0, hi = v0;
    for (let i = 0; i < 60; i++) {
      const v = (lo + hi) / 2;
      const f = 1 - Math.pow(v / v0, PARAMETERS.delta)
              - Math.pow((prof.s0 + v * prof.T) / gapM, 2);
      if (f > 0) lo = v; else hi = v;
    }
    return (lo + hi) / 2;
  }

  seedMainline(kPerKmLane) {
    const n = Math.round(kPerKmLane * this.L / 1000);
    if (n <= 0) return;
    const spacing = this.L / n;
    const byLane = [];
    for (let lane = 0; lane < this.laneCount; lane++) {
      const arr = [];
      for (let i = 0; i < n; i++) {
        let prof = this.sampleProfile();
        // trucks stay out of the leftmost lane on 3+ lane freeways
        if (prof.truck && lane === 0 && this.laneCount >= 3) {
          for (let tries = 0; tries < 10 && prof.truck; tries++) prof = this.sampleProfile();
        }
        const x = (i * spacing + this.rng() * spacing * 0.2) % this.L;
        const dest = (this.rng() < PARAMETERS.throughFraction) ? null : this.sampleDest(x);
        const veh = new Vehicle(this.nextId++, x, lane, 0, prof, dest, 0);
        arr.push(veh);
        this.vehicles.push(veh);
      }
      byLane.push(arr);
    }
    // seed speeds from the gap to the ACTUAL leader — a car seeded behind a truck at
    // nominal spacing otherwise starts ~10 m/s too fast for its real 9 m gap and
    // rear-ends it within a second (the k=40 "collisions" were this artifact)
    for (const arr of byLane) {
      arr.sort((a, b) => a.x - b.x);
      for (let i = 0; i < arr.length; i++) {
        const lead = arr[(i + 1) % arr.length];
        const gap = (i === arr.length - 1)
          ? lead.x + this.L - lead.len - arr[i].x
          : lead.x - lead.len - arr[i].x;
        arr[i].v = Math.min(arr[i].p.desiredSpeed(),
                            this.equilibriumSpeed(arr[i].p, Math.max(gap, 0.5)));
        arr[i].nextDecision = this.rng() * arr[i].p.tReact;   // stagger decision phases
      }
    }
  }

  // ---------- neighbor structure ----------

  sortLanes() {
    this.lanes = Array.from({ length: this.laneCount }, () => []);
    for (const veh of this.vehicles) this.lanes[veh.lane].push(veh);
    for (const arr of this.lanes) {
      arr.sort((a, b) => a.x - b.x);
      for (let i = 0; i < arr.length; i++) arr[i].laneIdx = i;
    }
  }

  leaderOf(veh) {
    const arr = this.lanes[veh.lane];
    return arr.length > 1 ? arr[(veh.laneIdx + 1) % arr.length] : null;
  }

  followerOf(veh) {
    const arr = this.lanes[veh.lane];
    return arr.length > 1 ? arr[(veh.laneIdx - 1 + arr.length) % arr.length] : null;
  }

  // cyclic leader/follower a hypothetical vehicle at x would have in a lane array
  neighborsAt(arr, x) {
    const n = arr.length;
    if (!n) return { leader: null, follower: null };
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x > x) hi = m; else lo = m + 1; }
    return { leader: arr[lo % n], follower: arr[(lo - 1 + n) % n] };
  }

  // Incremental lane-array maintenance. Lane changes are applied sequentially within a
  // tick; keeping the arrays live is what stops two vehicles claiming the same gap in the
  // same tick (the collision source before this existed — smoke T2 caught it).
  removeFromLaneArr(veh) {
    const arr = this.lanes[veh.lane];
    arr.splice(veh.laneIdx, 1);
    for (let i = veh.laneIdx; i < arr.length; i++) arr[i].laneIdx = i;
  }

  insertIntoLaneArr(veh, lane) {
    const arr = this.lanes[lane];
    let lo = 0, hi = arr.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m].x > veh.x) hi = m; else lo = m + 1; }
    arr.splice(lo, 0, veh);
    veh.lane = lane;
    for (let i = lo; i < arr.length; i++) arr[i].laneIdx = i;
  }

  // ---------- per-tick passes ----------

  update(engine) {
    const dt = PARAMETERS.dt;
    this.time += dt;
    if (PARAMETERS.bodyModel === 'bicycle') {
      this.sortAll();
      this.decisionPass2D(dt);
      this.integratePass2D(dt);
      this.rampSpawn2D(dt);
      this.collisionPass2D();
      return;
    }
    this.sortLanes();
    this.laneChangePass(dt);
    this.sortLanes();
    this.accelPass();
    this.integratePass(dt);
    this.rampPass(dt);
  }

  laneChangePass(dt) {
    const P = PARAMETERS;
    for (const veh of this.vehicles) {
      // decision points (v0.3): flag consumed here and by accelPass, rescheduled there
      veh._decide = this.time >= veh.nextDecision;
      if (veh.cooldown > 0) { veh.cooldown -= dt; continue; }
      if (!veh._decide) continue;

      // exit urgency: 0 far from the exit → 1 at the gore
      let urgency = 0, planningLeftBlock = false;
      if (veh.destExit != null) {
        const d = this.distAhead(veh.x, this.exits[veh.destExit].x);
        urgency = clamp(1 - d / veh.p.exitPrep, 0, 1);
        // planning horizon: no leftward moves once the exit needs positioning for —
        // wider when more lanes must be crossed to get back right
        const lanesToCross = this.laneCount - 1 - veh.lane;
        planningLeftBlock = d < veh.p.exitPrep + 600 * lanesToCross + 400;
      }

      // mandatory rightward move toward the exit takes priority; at high urgency the MOBIL
      // incentive gives way to pure gap acceptance (standard for mandatory changes)
      if (urgency > 0 && veh.lane < this.laneCount - 1) {
        const relax = veh.p.bSafe + urgency * (P.bMax - veh.p.bSafe) * 0.6;
        if (this.tryChange(veh, veh.lane + 1, urgency * P.mandatoryBoost + P.keepRightBias,
                           relax, urgency > 0.6)) {
          veh.cooldown = P.laneChangeCooldown * 0.5;   // urgent driver keeps working right
          continue;
        }
      }
      if (urgency > 0.3) continue;   // exit-bound: no discretionary moves

      // courtesy: right-lane driver alongside an active onramp moves left to open the
      // merge lane (the observed US "zip" behavior; raises merge-zone discharge)
      let courtesy = 0;
      if (veh.lane === this.laneCount - 1 && this.laneCount > 1) {
        for (const ramp of this.onramps) {
          if (!ramp.vehicles.length) continue;
          const d = this.distAhead(veh.x, (ramp.x + ramp.len) % this.L);
          if (d < ramp.len + 250) { courtesy = 0.5; break; }
        }
      }

      // discretionary: try right first (keep-right), then left
      if (!courtesy && veh.lane < this.laneCount - 1 &&
          this.tryChange(veh, veh.lane + 1, P.keepRightBias, veh.p.bSafe, false)) {
        veh.cooldown = P.laneChangeCooldown; continue;
      }
      const leftBanned = (veh.p.truck && veh.lane === 1 && this.laneCount >= 3) || planningLeftBlock;
      if (veh.lane > 0 && !leftBanned &&
          this.tryChange(veh, veh.lane - 1, courtesy - P.keepRightBias * (courtesy ? 0 : 1),
                         veh.p.bSafe, false)) {
        veh.cooldown = P.laneChangeCooldown;
      }
    }
  }

  // MOBIL: change if my gain + politeness-weighted effect on both followers clears the
  // threshold, and nobody (me included) is forced to brake harder than bSafe.
  // `forced` (mandatory change at high urgency) skips the incentive test — safety only.
  tryChange(veh, target, incentiveBonus, bSafe, forced) {
    const arr = this.lanes[target];
    const { leader: nl, follower: nf } = this.neighborsAt(arr, veh.x);
    if (nl && this.overlaps(veh, nl)) return false;       // physically no room
    if (nf && nf !== nl && this.overlaps(veh, nf)) return false;

    const myNew = veh.idmAcc(nl ? this.gap(veh, nl) : null, nl ? nl.v : 0);
    if (myNew < -bSafe) return false;
    let nfNew = 0, nfOld = 0;
    if (nf) {
      nfNew = nf.idmAcc(this.gap(nf, veh), veh.v);
      if (nfNew < -bSafe) return false;
      nfOld = nf.idmAcc(nl && nl !== nf ? this.gap(nf, nl) : null, nl ? nl.v : 0);
    }
    if (!forced) {
      const ol = this.leaderOf(veh), of = this.followerOf(veh);
      const myOld = veh.idmAcc(ol ? this.gap(veh, ol) : null, ol ? ol.v : 0);
      let ofNew = 0, ofOld = 0;
      if (of) {
        ofOld = of.idmAcc(this.gap(of, veh), veh.v);
        ofNew = of.idmAcc(ol && ol !== of ? this.gap(of, ol) : null, ol ? ol.v : 0);
      }
      const gain = (myNew - myOld)
                 + veh.p.politeness * ((nfNew - nfOld) + (ofNew - ofOld))
                 + incentiveBonus;
      if (gain <= PARAMETERS.mobilThreshold) return false;
    }

    this.removeFromLaneArr(veh);
    this.insertIntoLaneArr(veh, target);
    this.stats.laneChanges++;
    return true;
  }

  accelPass() {
    const P = PARAMETERS;
    for (const arr of this.lanes) {
      for (const veh of arr) {
        const ld = this.leaderOf(veh);
        if (veh._decide) {
          const sense = this.perceive(veh, ld ? this.gap(veh, ld) : null, ld ? ld.v : 0);
          let cmd = veh.idmAcc(sense.gap, sense.vLead);
          // exit-bound driver stuck left near the gore: ease off to find a gap — but
          // NEVER park on a live lane (the realistic failure is missing the exit)
          if (veh.destExit != null && veh.lane < this.laneCount - 1) {
            const d = this.distAhead(veh.x, this.exits[veh.destExit].x);
            const urgency = clamp(1 - d / veh.p.exitPrep, 0, 1);
            if (urgency > 0.7 && veh.v > 8) cmd = Math.min(cmd, -0.6);
          }
          veh.heldAcc = this.pedal(veh, cmd);
          this.scheduleDecision(veh);
        }
        veh.acc = veh.heldAcc;
        // emergency reflex (every tick, beneath the slow loop): loom response
        if (ld) {
          const gap = this.gap(veh, ld), closing = veh.v - ld.v;
          if (gap < 0.8 || (closing > 0 && closing * closing / (2 * Math.max(gap, 0.1)) > P.emergencyDecel)) {
            veh.acc = -P.bMax;
            veh.heldAcc = veh.acc;
            veh.nextDecision = Math.min(veh.nextDecision, this.time + P.startleDelay);
          }
        }
      }
    }
  }

  integratePass(dt) {
    let removed = false;
    for (const veh of this.vehicles) {
      const vNew = Math.max(0, veh.v + veh.acc * dt);
      const adv = (veh.v + vNew) / 2 * dt;      // ballistic update
      const oldX = veh.x;
      veh.x = (veh.x + adv) % this.L;
      veh.v = vNew;
      veh.visLane += (veh.lane - veh.visLane) * Math.min(1, dt * 3);

      for (const d of this.detectors) {
        if (this.distAhead(oldX, d.x) <= adv) { d.count++; d.speedSum += vNew; }
      }

      if (veh.destExit != null && this.distAhead(oldX, this.exits[veh.destExit].x) <= adv) {
        if (veh.lane === this.laneCount - 1) {
          veh.done = true; removed = true;
          this.stats.exited++;
          this.stats.travelTimeSum += this.time - veh.bornAt;
          this.stats.travelTimeN++;
        } else {
          this.stats.missedExits++;
          veh.destExit = (veh.destExit + 1) % this.exits.length;
        }
      }
    }
    if (removed) this.vehicles = this.vehicles.filter((v) => !v.done);

    // safety net: detect and resolve true overlaps with SIGNED adjacent gaps on freshly
    // sorted lanes (counts as a collision — the smoke test asserts 0)
    this.sortLanes();
    for (const arr of this.lanes) {
      if (arr.length < 2) continue;
      for (let i = 0; i < arr.length; i++) {
        const f = arr[i], l = arr[(i + 1) % arr.length];
        const g = (i === arr.length - 1)
          ? l.x + this.L - l.len - f.x           // wrap pair
          : l.x - l.len - f.x;
        if (g < 0) {
          this.stats.collisions++;
          f.x = ((l.x - l.len - 0.3) % this.L + this.L) % this.L;
          f.v = Math.min(f.v, l.v);
        }
      }
    }
  }

  rampPass(dt) {
    const P = PARAMETERS;
    const rightLane = this.laneCount - 1;
    for (const ramp of this.onramps) {
      // Poisson arrivals feed a queue at the ramp entrance
      ramp.nextArrival -= dt;
      while (ramp.nextArrival <= 0) { ramp.queue++; ramp.nextArrival += this.expo(P.demand); }

      // release from queue when the entrance is clear; entry speed respects the gap to
      // the last vehicle on the ramp (entering at full speed toward a stopped leader was
      // the genesis of the ramp pile-ups the probe found)
      if (ramp.queue > 0) {
        const prof = this.sampleProfile();
        let rear = null, rearProg = Infinity;
        for (const rv of ramp.vehicles) {
          const p = this.distAhead(ramp.x, rv.x);
          if (p < rearProg) { rearProg = p; rear = rv; }
        }
        if (!rear || rearProg > prof.s0 + rear.len + 6) {
          ramp.queue--;
          ramp.spawned++;
          this.stats.spawned++;
          const vEntry = rear && rearProg < 40
            ? Math.min(12, rear.v + Math.sqrt(2 * prof.b * Math.max(rearProg - rear.len - prof.s0, 0)))
            : 12;
          const veh = new Vehicle(this.nextId++, ramp.x, rightLane, vEntry, prof,
                                  this.sampleDest(ramp.x), this.time);
          veh.onRamp = ramp;
          veh.visLane = rightLane + 1;   // drawn on the ramp stub until merged
          ramp.vehicles.push(veh);
        }
      }

      // ramp vehicle dynamics: IDM against the ramp leader AND a wall at the ramp end.
      // ALL geometry is signed, in ramp-local coordinates (progress from the gore) — the
      // wrap-safe gap() reads an overlap as ~loopLength of free road, which twice now has
      // let vehicles ghost through each other (validation C caught both).
      ramp.vehicles.sort((a, b) => this.distAhead(ramp.x, a.x) - this.distAhead(ramp.x, b.x));
      const progs = ramp.vehicles.map((rv) =>
        Math.min(this.distAhead(ramp.x, rv.x), ramp.len));
      for (let i = ramp.vehicles.length - 1; i >= 0; i--) {
        const rv = ramp.vehicles[i];
        const leader = (i < ramp.vehicles.length - 1) ? ramp.vehicles[i + 1] : null;
        let prog = progs[i];
        let leadGap = null;
        if (leader) {
          leadGap = progs[i + 1] - leader.len - prog;          // signed — never wraps
          if (leadGap < 0) {                                   // safety net, mirrors mainline
            this.stats.collisions++;
            prog = Math.max(progs[i + 1] - leader.len - 0.3, 0);
            leadGap = 0.3;
            rv.v = Math.min(rv.v, leader.v);
          }
        }
        const gapWall = ramp.len - 0.5 - prog;
        const accLead = rv.idmAcc(leadGap != null ? Math.max(leadGap, 0.1) : null,
                                  leader ? leader.v : 0);
        const accWall = rv.idmAcc(Math.max(gapWall, 0.1), 0);
        // over the first 70% of the ramp, drive toward the MAINLINE traffic (speed-match
        // for the merge, like a real accel lane) — the wall only binds near the end
        rv.acc = Math.min(accLead, accWall);
        if (prog < ramp.len * 0.7) {
          const { leader: ml } = this.neighborsAt(this.lanes[rightLane], rv.x);
          const accMain = (ml && !this.overlaps(rv, ml))
            ? rv.idmAcc(this.gap(rv, ml), ml.v) : rv.idmAcc(null, 0);
          rv.acc = Math.min(accLead, Math.max(accWall, accMain));
        }
        const vNew = Math.max(0, rv.v + rv.acc * dt);
        prog = prog + (rv.v + vNew) / 2 * dt;
        rv.v = vNew;
        if (prog >= ramp.len - 0.5) { prog = ramp.len - 0.5; rv.v = 0; }   // hard wall
        if (leader) prog = Math.min(prog, progs[i + 1] - leader.len - 0.3); // never pass
        prog = Math.max(prog, 0);
        progs[i] = prog;
        rv.x = (ramp.x + prog) % this.L;

        // merge: MOBIL safety with urgency growing along the ramp
        const progress = clamp(prog / ramp.len, 0, 1);
        const bSafeM = 4 + progress * 4;
        const { leader: nl, follower: nf } = this.neighborsAt(this.lanes[rightLane], rv.x);
        const okLead = !nl || (!this.overlaps(rv, nl) &&
                               rv.idmAcc(this.gap(rv, nl), nl.v) > -bSafeM);
        const okFol = !nf || nf === nl || (!this.overlaps(rv, nf) &&
                              nf.idmAcc(this.gap(nf, rv), rv.v) > -bSafeM);
        if (okLead && okFol) {
          rv.onRamp = null;
          rv.cooldown = 3;
          this.vehicles.push(rv);
          this.insertIntoLaneArr(rv, rightLane);  // live array: next merger sees this one
          ramp.vehicles.splice(i, 1);
          progs.splice(i, 1);                     // keep progs aligned with ramp.vehicles
          this.stats.merges++;
        }
      }
    }
  }

  // ==========================================================================
  // Bicycle-body passes ('bicycle' mode). SAME car-following model (IDM), the MOBIL
  // gain kept as the voluntary incentive, executed through continuous (x, y, heading)
  // with a steering cascade. Lane membership is geometry: a vehicle occupies whatever
  // its body band overlaps, so a diagonal car constrains BOTH lanes for the maneuver.
  //
  // Stage 10 — one lane-change model. Every lateral decision runs through a continuous
  // DESIRE per side (LMRS: Schakel, Knoop & van Arem 2012):
  //   desire = route desire (a lane that ends, an exit; negative toward the wrong side)
  //          + θ · voluntary desire (MOBIL gain incl. politeness and keep-right; courtesy)
  //   dFree: gap acceptance with desire-scaled headway T(d) and imposed decel bAccept(d)
  //   dSync: signal on; synchronize speed with the target-lane leader
  //   dCoop: the would-be follower cooperates — treats the claimant as its leader
  // The onramp is auxiliary lane N that ends; its end is an obstacle at v = 0 (plain IDM).
  // Merging, exiting and lane drops are the same mechanism. Accepted headways relax back
  // to the driver's own T (Laval & Leclercq 2008). Lateral interaction is clearance, not
  // a strip veto. The 'lane' passes above are untouched — they are the validated control.
  // ==========================================================================

  laneCenter(i) { return (i + 0.5) * PARAMETERS.laneWidth; }
  laneBand(i) { return [i * PARAMETERS.laneWidth, (i + 1) * PARAMETERS.laneWidth]; }
  roadWidth() { return this.laneCount * PARAMETERS.laneWidth; }
  // lane identity: on an ending lane it is that lane until the body is physically on
  // the through road (onRamp clears exactly then) — a squeezed straddler whose centre
  // has crossed the line is still merging, not merged (the bottleneck trace caught a
  // merger that "believed" it was in lane 1, read zero route desire, and sat at the
  // pavement end forever)
  laneOf(veh) {
    if (veh.onRamp) return this.laneCount;
    return clamp(Math.round(veh.y / PARAMETERS.laneWidth - 0.5), 0, this.laneCount - 1);
  }
  bandsOverlap(a, b, margin) {
    return a[0] < b[1] + (margin || 0) && b[0] < a[1] + (margin || 0);
  }

  // ---------- lane-that-ends geometry ----------

  // pavement outer edge at x: the through road, plus an onramp's auxiliary lane along the
  // ramp, closing linearly over taperLen past the lane end
  outerEdge(x) {
    const P = PARAMETERS, W = P.laneWidth, base = this.roadWidth();
    let edge = base;
    for (const r of this.onramps) {
      const prog = this.distAhead(r.x, x);
      if (prog <= r.len) return base + W;
      if (prog < r.len + P.lc.taperLen) {
        edge = Math.max(edge, base + W * (1 - (prog - r.len) / P.lc.taperLen));
      }
    }
    return edge;
  }

  // the lane end as an obstacle: distance (m) until the pavement edge closes below the
  // body's outer extent. Infinity once the body is inside the through road. Bodies that
  // have slipped past their wall (clamped in by the edge) read 0, not a lap.
  wallDist(veh) {
    if (!veh.onRamp) return Infinity;
    const P = PARAMETERS, r = veh.onRamp;
    const yOuter = veh.band()[1] + 0.05;   // the whole body, tail included
    if (yOuter <= this.roadWidth()) return Infinity;
    const frac = clamp((yOuter - this.roadWidth()) / P.laneWidth, 0, 1);
    const xWall = (r.x + r.len + P.lc.taperLen * (1 - frac)) % this.L;
    const d = this.distAhead(veh.x, xWall);
    return d > r.len + P.lc.taperLen + 20 ? 0 : d;
  }

  // car-following against the lane end, once it binds (see decisionPass2D). A driver
  // committed to the road with clear pavement beside is rolling in, not stopping: the
  // closing edge carries the body onto the road (the gore is paint, not a barrier)
  laneEndAcc(veh) {
    const gap = this.wallDist(veh);
    if (gap === Infinity) return Infinity;
    if (veh.changing && veh.targetLane < this.laneCount &&
        this.lateralClearance(veh, -1) >= PARAMETERS.lc.latClearance) return Infinity;
    if (gap < veh.p.s0 + 2) return veh.idmAcc(Math.max(gap, 0.1), 0);   // holding at the end
    const bReq = veh.v * veh.v / (2 * Math.max(gap - veh.p.s0, 0.1));
    return bReq > veh.p.b ? -bReq : Infinity;   // exactly the stop that is required
  }

  // a body's segments (see Vehicle.segments), x-wrapped onto the loop and cached per
  // geometry stamp (positions change at sortAll and after integration)
  segs(veh) {
    if (veh._segStamp === this.geomStamp) return veh._segs;
    const out = veh.segments();
    for (const s of out) s.x = ((s.x % this.L) + this.L) % this.L;
    veh._segs = out; veh._segStamp = this.geomStamp;
    return out;
  }
  // do two segments overlap longitudinally (either order), with a small margin?
  segsOverlapX(a, b) {
    const d = this.distAhead(a.x, b.x);
    return d < this.L / 2 ? d < b.len + 0.5 : this.L - d < a.len + 0.5;
  }

  sortAll() {
    this.geomStamp = (this.geomStamp || 0) + 1;
    this.all = this.vehicles.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < this.all.length; i++) this.all[i].allIdx = i;
    for (const r of this.onramps) r.count2D = 0;
    for (const veh of this.vehicles) if (veh.onRamp) veh.onRamp.count2D++;
  }

  // ---------- perception geometry ----------

  // What I claim as mine while changing: my whole swept corridor (used as MY leader
  // query — I must not ram anything along the path I'm about to sweep).
  sweptBand(veh) {
    const b = veh.band();
    if (!veh.changing) return b;
    const c = this.laneCenter(veh.targetLane);
    return [Math.min(b[0], c - veh.width / 2), Math.max(b[1], c + veh.width / 2)];
  }

  // What OTHERS see of o: its body, plus — if it claims a lane (desire ≥ dCoop, or
  // committed) — its slot in that lane (turn-signal reading). Deliberately NOT the
  // corridor in between: making the corridor visible to everyone had origin-lane
  // followers braking for vehicles that were leaving, which interlocked into full-loop
  // gridlock (validation D froze at 0 m/s). The body clears the origin lane naturally.
  footprintOverlaps(o, band, margin) {
    for (const s of this.segs(o)) if (this.bandsOverlap(s.band, band, margin)) return true;
    if (o.claimLane == null) return false;
    const c = this.laneCenter(o.claimLane);
    return this.bandsOverlap([c - o.width / 2, c + o.width / 2], band, margin);
  }

  // how hard this driver will brake to let a claimant in: comfortable braking scaled by
  // politeness (aggressive ≈ 0.4, normal ≈ 1.2, cautious ≈ 1.7 m/s²)
  bCoopMax(veh) { return veh.p.b * 2 * veh.p.politeness; }

  // nearest vehicle ahead of `veh` (by REAR gap, not front position — fronts are what
  // the array sorts on, and a short car's nearer front can mask a long truck whose tail
  // is on your bumper; T7's one rear-end was exactly that) whose footprint overlaps
  // `band`. The 0.35 m margin keeps a changer sliding out of my lane registered as my
  // leader until its corner has genuinely cleared. Sets veh._leadClaim: the elected
  // leader is a CLAIM (cooperation), not a body.
  scanAhead(veh, band, maxDist) {
    const lc = PARAMETERS.lc;
    const n = this.all.length;
    let best = null, bestGap = Infinity, bestClaim = false;
    for (let k = 1; k < n; k++) {
      const o = this.all[(veh.allIdx + k) % n];
      const d = this.distAhead(veh.x, o.x);
      if (d > maxDist || d - 20 > bestGap) break;   // no farther front hides a nearer rear
      // 0.35 m detection margin for traffic at speed; but a CREEPING driver may inch
      // past a stopped encroacher with tight-but-real clearance (the wall-straddler
      // deadlock: a frozen half-merged car pinned its neighbor via the margin forever)
      const m = (veh.v < 3 && o.v < 1) ? 0.08 : 0.35;
      // the nearest SEGMENT of o's body in my band: a turning truck's tail is where
      // its tail is, not under its nose
      let hit = false, claim = false, g = Infinity;
      for (const s of this.segs(o)) {
        if (!this.bandsOverlap(s.band, band, m)) continue;
        const ds = this.distAhead(veh.x, s.x);
        if (ds > this.L / 2) continue;               // that segment is behind my front
        hit = true; g = Math.min(g, ds - s.len);
      }
      if (!hit && o.claimLane != null && d < lc.coopRange) {
        // COOPERATION: a claim binds me only if yielding is within what I'd do for a
        // stranger (politeness-scaled comfort) — a stopped merger's signal must not
        // halt fast traffic 300 m back (rotating claims built a permanent phantom wall
        // that gridlocked the loop). A committed changer is at least as visible as
        // the old 2 m/s² signal-reading bound.
        const c = this.laneCenter(o.claimLane);
        if (this.bandsOverlap([c - o.width / 2, c + o.width / 2], band, 0.35)) {
          // a committed changer visibly leaving its lane is a body entering mine: I brake
          // as hard as it takes; a mere signal (or a stalled commit) binds only within
          // what I'd comfortably do for a stranger
          const moving = o.changing &&
            Math.abs(o.y - this.laneCenter(o.startLane)) > 0.1 * PARAMETERS.laneWidth;
          const bound = moving ? PARAMETERS.bMax : this.bCoopMax(veh);
          // >= : IDM saturates at exactly -bMax, and the follower that needs all of it
          // is precisely the one that must see the body entering its lane
          hit = veh.idmAcc(Math.max(d - o.len, 0.1), o.v, this.headwayAt(veh, o.desire)) >= -bound;
          claim = hit; g = d - o.len;
        }
      }
      if (hit && g < bestGap) { bestGap = g; best = o; bestClaim = claim; }
    }
    veh._leadClaim = bestClaim;
    return best;
  }
  scanBehind(veh, band, maxDist) {
    const n = this.all.length;
    for (let k = 1; k < n; k++) {
      const o = this.all[(veh.allIdx - k + n) % n];
      if (this.distAhead(o.x, veh.x) > maxDist) return null;
      if (this.footprintOverlaps(o, band, 0.35)) return o;
    }
    return null;
  }
  gapX(f, l) { return this.distAhead(f.x, l.x) - l.len; }

  // lateral clearance (m) from veh's near edge toward dir (+1 = toward the outer edge,
  // -1 = toward the left edge) to the nearest body whose x-extent overlaps mine. This
  // is the over-the-shoulder look: scanAhead/scanBehind order vehicles by front
  // position, so a body ALONGSIDE is invisible to both (validation D's 93 sideswipes).
  // Continuous clearance replaces the old strip veto: a driver may move up to the
  // clearance, which is what dissolves the merger-alongside-blocker mutual wait.
  lateralClearance(veh, dir) {
    let best = Infinity;
    const n = this.all.length;
    const mine = this.segs(veh);
    for (let k = 1; k <= 6 && k < n; k++) {
      for (const o of [this.all[(veh.allIdx + k) % n], this.all[(veh.allIdx - k + n) % n]]) {
        if (o === veh || o.done) continue;
        for (const b of this.segs(o)) {
          for (const a of mine) {
            if (!this.segsOverlapX(a, b)) continue;
            const aMid = (a.band[0] + a.band[1]) / 2, bMid = (b.band[0] + b.band[1]) / 2;
            if ((bMid - aMid) * dir <= 0) continue;      // on my other side
            const c = dir > 0 ? b.band[0] - a.band[1] : a.band[0] - b.band[1];
            if (c < best) best = Math.max(c, 0);
          }
        }
      }
    }
    return best;
  }

  // someone nearby is already steering into `target` — accepting too would converge
  // (the 2D analogue of two 1D vehicles claiming the same gap; the collision log
  // showed exactly this: 0>1 meeting 2>1, and mainline changers meeting ramp mergers)
  convergenceConflict(veh, target) {
    // Tight radius on purpose: the logged sideswipes all had x-gaps of ~4 m. A wide veto
    // radius froze the merge system solid once mandatory changers became committed
    // (long-lived `changing` windows vetoed every merger along whole segments).
    const n = this.all.length;
    for (let k = 1; k < Math.min(n, 8); k++) {
      const ahead = this.all[(veh.allIdx + k) % n];
      if (ahead !== veh && ahead.changing && ahead.targetLane === target &&
          this.distAhead(veh.x, ahead.x) <= veh.len + ahead.len + 10) return true;
      const behind = this.all[(veh.allIdx - k + n) % n];
      if (behind !== veh && behind.changing && behind.targetLane === target &&
          this.distAhead(behind.x, veh.x) <= veh.len + behind.len + 10) return true;
    }
    return false;
  }

  // ---------- desire ----------

  // accepted headway at desire d: from the driver's (possibly still relaxing) headway
  // down to tMinFrac·T at full desire (LMRS)
  headwayAt(veh, d) {
    const lc = PARAMETERS.lc;
    return Math.min(veh.Teff, veh.p.T * (1 - (1 - lc.tMinFrac) * clamp(d || 0, 0, 1)));
  }
  // deceleration a changer may impose (on itself and its new follower): the driver's
  // bSafe, rising to the forced-merge bound with ROUTE desire only — what a driver is
  // willing to impose grows with necessity (a lane that ends, an exit), never with want
  // (a courtesy or speed change accepted at 6 m/s² put a 6 m/s car in front of a
  // 20 m/s one — the probe's one rear-end)
  bAcceptAt(veh, dRoute) {
    const lc = PARAMETERS.lc;
    const u = clamp((dRoute - lc.dFree) / (1 - lc.dFree), 0, 1);
    return veh.p.bSafe + u * (lc.bAcceptMax - veh.p.bSafe);
  }

  // Route desire: ONE function for a lane that ends (the ramp), an exit, and — later — a
  // lane drop. d = max(1 − x/(n·x0), 1 − t/(n·t0)) toward the required side for the n
  // changes still needed; the opposite side reads the desire n+1 changes would carry,
  // negated (each move away adds a required change). x0 is the driver's exitPrep for an
  // exit (route knowledge) and the LMRS 295 m for a lane end (visible geometry).
  routeDesire(veh) {
    const lc = PARAMETERS.lc;
    const lane = veh.changing ? veh.targetLane : veh.lane;
    let dir = 0, n = 0, dist = Infinity, x0 = lc.x0;
    if (veh.onRamp) {
      dir = -1; n = lane - (this.laneCount - 1);
      // past the lane end (in the taper) the need is total — never let it wrap the loop
      dist = Math.max(veh.onRamp.len - this.distAhead(veh.onRamp.x, veh.x), 0);
    } else if (veh.destExit != null) {
      dir = 1; n = this.laneCount - 1 - lane;
      dist = this.distAhead(veh.x, this.exits[veh.destExit].x);
      x0 = veh.p.exitPrep;
    }
    if (!dir) return { dir: 0, d: 0, dOpp: 0 };
    const t = dist / Math.max(veh.v, 1);
    const f = (k) => k <= 0 ? 0
      : clamp(Math.max(1 - dist / (k * x0), 1 - t / (k * lc.t0)), 0, 1);
    return { dir, d: f(n), dOpp: -f(n + 1) };
  }

  // Courtesy: desire to vacate my lane for a neighbour who claims it (desire ≥ dCoop)
  // and whom my body is in the way of — alongside or within a following gap. Keyed on
  // the neighbour's actual desire, not on ramp presence.
  courtesyDesire(veh) {
    const lc = PARAMETERS.lc, out = { '-1': 0, '1': 0 };
    const n = this.all.length;
    for (let k = 1; k <= 8 && k < n; k++) {
      for (const o of [this.all[(veh.allIdx + k) % n], this.all[(veh.allIdx - k + n) % n]]) {
        if (o === veh || o.done || o.claimLane !== veh.lane || o.desire < lc.dCoop) continue;
        const dx = Math.min(this.distAhead(veh.x, o.x), this.distAhead(o.x, veh.x));
        if (dx > 40) continue;
        const away = o.lane > veh.lane ? -1 : 1;
        out[away] = Math.max(out[away], lc.courtesy * o.desire);
      }
    }
    return out;
  }

  // MOBIL gain (m/s²) of moving into `target`: own advantage + politeness-weighted effect
  // on both followers + keep-right bias. Returns null when a body alongside makes the
  // move geometrically infeasible right now. Neighbours are returned for reuse.
  mobilGain2D(veh, target, own) {
    const P = PARAMETERS;
    const tb = this.laneBand(target);
    const nl = this.scanAhead(veh, tb, 300), nf = this.scanBehind(veh, tb, 300);
    if (nl && this.gapX(veh, nl) < 0.5) return null;
    if (nf && nf !== nl && this.gapX(nf, veh) < 0.5) return null;
    const myNew = veh.idmAcc(nl ? Math.max(this.gapX(veh, nl), 0.1) : null, nl ? nl.v : 0);
    let nfNew = 0, nfOld = 0;
    if (nf && nf !== nl) {
      nfNew = nf.idmAcc(Math.max(this.gapX(nf, veh), 0.1), veh.v);
      nfOld = nf.idmAcc(nl ? Math.max(this.gapX(nf, nl), 0.1) : null, nl ? nl.v : 0);
    }
    const { ol, of } = own;
    const myOld = veh.idmAcc(ol ? Math.max(this.gapX(veh, ol), 0.1) : null, ol ? ol.v : 0);
    let ofNew = 0, ofOld = 0;
    if (of && of !== ol) {
      ofOld = of.idmAcc(Math.max(this.gapX(of, veh), 0.1), veh.v);
      ofNew = of.idmAcc(ol ? Math.max(this.gapX(of, ol), 0.1) : null, ol ? ol.v : 0);
    }
    const gain = (myNew - myOld)
               + veh.p.politeness * ((nfNew - nfOld) + (ofNew - ofOld))
               + (target > veh.lane ? P.keepRightBias : -P.keepRightBias);
    return { gain, nl, nf };
  }

  // the decision: best side by total desire; sets desire / desireLane / signal / claim
  updateDesire(veh) {
    const lc = PARAMETERS.lc, right = this.laneCount - 1;
    const route = this.routeDesire(veh);
    const courtesy = this.courtesyDesire(veh);
    let best = { d: 0, lane: null, g: null };
    let own = null;   // own-lane neighbours, scanned once for both sides
    for (const dir of [-1, 1]) {
      const target = veh.lane + dir;
      if (target < 0 || target > right) continue;   // auxiliary lanes are entered at the gore only
      if (veh.p.truck && target === 0 && this.laneCount >= 3) continue;
      const dR = route.dir === dir ? route.d : (route.dir === -dir ? route.dOpp : 0);
      // cooling down: nothing voluntary can act, so evaluate the gain only where a route
      // desire may need synchronizing (saves the neighbour scans)
      let g = null;
      if (!(veh.cooldown > 0 && dR <= 0)) {
        if (!own) {
          const ob = veh.band();
          own = { ol: this.scanAhead(veh, ob, 300), of: this.scanBehind(veh, ob, 300) };
        }
        g = this.mobilGain2D(veh, target, own);
      }
      const dV = (g ? clamp(g.gain * lc.desirePerGain, -1, 1) : 0) + courtesy[String(dir)];
      // θ: voluntary desire counts fully when it agrees with the route, fades out as an
      // opposing route desire grows from dFree to dSync (LMRS)
      const agree = dR === 0 || dV === 0 || Math.sign(dR) === Math.sign(dV);
      const theta = agree ? 1 : clamp((lc.dSync - Math.abs(dR)) / (lc.dSync - lc.dFree), 0, 1);
      const d = clamp(dR + theta * dV, -1, 1);
      if (d > best.d) best = { d, lane: target, g, dR };
    }
    veh.desire = best.d;
    veh.desireRoute = Math.max(best.dR || 0, 0);
    veh.desireLane = best.lane;
    veh._gain = best.g;
    veh.signal = veh.changing ? veh.targetLane : (best.d >= lc.dSync ? best.lane : null);
    veh.claimLane = veh.changing ? veh.targetLane : (best.d >= lc.dCoop ? best.lane : null);
  }

  // Gap acceptance at desire d, geometric edition. Starts the maneuver on acceptance:
  // changer and new follower take the accepted headway (down to T(d)) and relax.
  tryChange2D(veh, target, d, g) {
    if (this.convergenceConflict(veh, target)) return false;
    const nl = g ? g.nl : this.scanAhead(veh, this.laneBand(target), 300);
    const nf = g ? g.nf : this.scanBehind(veh, this.laneBand(target), 300);
    if (nl && this.gapX(veh, nl) < 0.5) return false;
    if (nf && nf !== nl && this.gapX(nf, veh) < 0.5) return false;
    const T = this.headwayAt(veh, d), b = this.bAcceptAt(veh, veh.desireRoute);
    const myGap = nl ? Math.max(this.gapX(veh, nl), 0.1) : null;
    if (veh.idmAcc(myGap, nl ? nl.v : 0, T) < -b) return false;
    let nfT = null, nfGap = null;
    if (nf && nf !== nl) {
      nfT = this.headwayAt(nf, d);
      nfGap = Math.max(this.gapX(nf, veh), 0.1);
      if (nf.idmAcc(nfGap, veh.v, nfT) < -b) return false;
      // and the braking the follower will actually need: now, and after the maneuver
      // time if it does nothing while I get going (a stopped merger accepting an 80 m
      // gap in 24 m/s traffic passed IDM's test and aborted two seconds later, 1800
      // times in the bottleneck probe)
      if (this.followerNeed(nf, veh, nl) > b) return false;
    }
    // relaxation: accept the headway you were given, down to the desire-scaled minimum
    if (myGap != null) veh.Teff = clamp(myGap / Math.max(veh.v, 1), T, veh.Teff);
    if (nfT != null) nf.Teff = clamp(nfGap / Math.max(nf.v, 1), nfT, nf.Teff);
    veh.startLane = veh.lane;
    veh.targetLane = target;
    veh.changing = true;
    veh.changeStart = this.time;
    veh.acceptedBSafe = b;       // abort threshold must respect what was accepted
    veh.desireAtStart = d;
    veh.checked = veh.p.checkProb >= 1 || this.rng() < veh.p.checkProb;   // the shoulder check
    veh.signal = target;
    veh.claimLane = target;
    return true;
  }

  // kinematic deceleration a follower needs to avoid a vehicle entering ahead of it:
  // the larger of the requirement now and the requirement after a perception-reaction
  // time in which the follower coasts (it reacts to the signal and the lateral motion
  // well before the maneuver completes), with the entrant accelerating toward its new
  // leader. Projecting over the whole maneuver instead rejected every 2-3 s lag gap
  // and turned the over-capacity merge into pure ramp metering: no breakdown at all.
  followerNeed(nf, veh, nl) {
    const tau = PARAMETERS.lc.followerReaction;
    const gap0 = Math.max(this.gapX(nf, veh), 0.1);
    const req = (gap, closing) => closing > 0 ? closing * closing / (2 * Math.max(gap, 0.1)) : 0;
    const aM = Math.max(0, Math.min(veh.p.a,
      nl ? veh.idmAcc(Math.max(this.gapX(veh, nl), 0.1), nl.v) : veh.p.a));
    const vM = veh.v + aM * tau;
    const gap1 = gap0 + veh.v * tau + 0.5 * aM * tau * tau - nf.v * tau;
    if (gap1 <= 0) return PARAMETERS.bMax + 1;
    return Math.max(req(gap0, nf.v - veh.v), req(gap1, nf.v - vM));
  }

  // Satisficing lane keeping: inside the driver's comfort band (laneTol from each lane
  // line) there is NO control action AT ALL — returns null, meaning hands off: steering
  // command is zero + motor noise, heading persists and random-walks (straightening ψ
  // would itself be a correction and would kill drift — Chris caught this). Only when
  // position leaves the band does a correction engage, targeting just inside the edge.
  // Large laneTol collapses the band to the center, recovering the ideal keeper.
  keepTarget(veh, tol) {
    const W = PARAMETERS.laneWidth;
    const t = tol != null ? tol : veh.p.laneTol;
    const lo = veh.lane * W + t + veh.width / 2;
    const hi = (veh.lane + 1) * W - t - veh.width / 2;
    if (lo >= hi) return this.laneCenter(veh.lane);
    if (veh.y >= lo && veh.y <= hi) return null;    // inside the band: hands off
    // correct INTO the band, restoring real margin — targeting just-inside-the-line
    // parks drivers at the edges (T8 measured a bimodal pile-up at ±band edge)
    const c = this.laneCenter(veh.lane);
    return veh.y < lo ? lo + 0.4 * (c - lo) : hi - 0.4 * (hi - c);
  }

  // ---------- passes ----------

  decisionPass2D(dt) {
    const P = PARAMETERS, lc = P.lc, A = P.attention;
    for (const veh of this.all) {
      if (veh.cooldown > 0) veh.cooldown -= dt;

      // --- post-crash: stopped, an obstacle to everyone, cleared after a while ---
      if (veh.crashed) {
        veh.acc = veh.v > 0 ? -4 : 0;
        veh.heldAcc = veh.acc; veh.heldDelta = 0; veh.delta = 0;
        veh.changing = false; veh.signal = null; veh.claimLane = null;
        if (this.time - veh.crashT > A.incidentClear) { veh.done = true; this.stats.cleared++; }
        continue;
      }

      // leader scan every tick — the reflex layer needs the world continuously (it
      // reads it through the driver's perception errors and attention, below)
      const lead = this.scanAhead(veh, this.sweptBand(veh), 400);
      const leadClaim = veh._leadClaim;

      // --- attention: off-road glances are a process, not noise. During a glance no
      //     decision is made (it fires the moment the eyes return), commands stay held,
      //     lane keeping does not correct, looming evidence does not accrue. ---
      if (veh.nextGlance == null) this.scheduleGlance(veh, lead);
      let attending = this.time >= veh.glanceUntil;
      if (attending && this.time >= veh.nextGlance) {
        // drivers look away when the car is stable: centred in the comfort band, heading
        // straight, WHEEL CENTRED, not mid-maneuver. A held tire angle integrates heading
        // (0.01 rad at 29 m/s is 0.1 rad/s and 2.9 m/s² of felt lateral acceleration):
        // every logged departure was a glance begun with the wheel slightly turned.
        // ... and nothing developing ahead: not closing on a leader inside ~7 s of TTC
        // (every crawl bump in the dense human probe was a follower glancing away
        // while closing on a stopped queue, where looming is too weak to fire the
        // emergency brake and only the postponed decision could have stopped it)
        let closingRate = 0;
        if (lead) {
          const closing = veh.v - lead.v;
          if (closing > 0) closingRate = closing / Math.max(this.gapX(veh, lead), 0.1);
        }
        const stable = !veh.changing && Math.abs(veh.psi) < 0.012 &&
                       Math.abs(veh.heldDelta) < 0.001 && this.keepTarget(veh) == null &&
                       closingRate < 0.15;
        if (!stable) veh.nextGlance = this.time + 0.5;
        else {
          const dur = veh.p.glanceMean *
            Math.exp(gaussFrom(this.rng, 0, A.glanceSigma) - A.glanceSigma * A.glanceSigma / 2);
          veh.glanceUntil = this.time + dur;
          this.stats.glances++;
          this.scheduleGlance(veh, lead);
          attending = false;
        }
      }
      const decide = attending && this.time >= veh.nextDecision;

      // --- peripheral lane keeping during a glance (Summala et al. 1996: peripheral
      //     vision keeps the lane, coarsely, and does not see the lead car brake).
      //     At the decision cadence, if the body's edge has come within periphTol of a
      //     lane line, a correction is steered — the glance continues, the
      //     longitudinal command stays held, no looming evidence accrues. ---
      if (!attending && !veh.changing && this.time >= veh.nextDecision) {
        const yT = this.keepTarget(veh, A.periphTol);
        if (yT != null) {
          const dir = Math.sign(yT - veh.y);
          const allowed = this.lateralClearance(veh, dir) - lc.latClearance;   // bodies alongside are peripheral too
          let target = yT, gated = false;
          if (allowed <= 0.02) { target = veh.y; gated = true; }
          else if (Math.abs(yT - veh.y) > allowed) { target = veh.y + dir * allowed; gated = true; }
          veh.heldDelta = veh.steerToward(target, veh.p.tReact, gated)
            + (veh.p.motorErr ? gaussFrom(this.rng, 0, veh.p.motorErr) : 0);
          this.stats.periphCorrections++;
        }
        veh.nextDecision = this.time + veh.p.tReact;
      }

      if (decide) {
        // --- decision layer: perceive (noisily), command (imperfectly), hold ---
        const sense = this.perceive(veh, lead ? Math.max(this.gapX(veh, lead), 0.1) : null,
                                    lead ? lead.v : 0);
        let cmd = veh.idmAcc(sense.gap, sense.vLead,
                             leadClaim ? this.headwayAt(veh, lead.desire) : null);

        // the lane end: a stopped obstacle, but one the driver expects to be gone from
        // (Daamen et al. 2010: acceleration-lane drivers hold speed, most merge in the
        // first half). It binds only once comfortable braking would no longer stop the
        // car in time — then it is car-following against a wall like any other.
        cmd = Math.min(cmd, this.laneEndAcc(veh));

        // --- lateral decision: desire → accept / synchronize; committed → monitor ---
        this.updateDesire(veh);
        if (veh.changing) {
          if (this.time - veh.changeStart > lc.signalExpire) {
            // signals expire: an unexpiring claim deadlocks the closed loop
            veh.changing = false;
            veh.targetLane = this.laneOf(veh);
            veh.lane = veh.targetLane;
            veh.cooldown = 2;
            this.stats.expiries++;
          } else {
            // abort only while still mostly in the origin lane, and only if the new
            // follower would have to brake beyond what was accepted (+ boost) to AVOID
            // me — the kinematic requirement (closing²/2·gap, the loom quantity the
            // reflex uses), not IDM's gap preference: a stopped follower half a metre
            // behind my slot in a jam wants space but faces no danger (the bottleneck
            // probe logged 1149 aborts from exactly that). At full route desire the
            // accepted bound is the physical limit: a forced merge commits.
            const abortThresh = veh.acceptedBSafe + P.steering.abortBoost;
            const tau2 = P.laneChangeCooldown * 0.6;
            const nf = this.scanBehind(veh, this.laneBand(veh.targetLane), 200);
            const progLat = Math.abs(veh.y - this.laneCenter(veh.startLane)) / P.laneWidth;
            let bReq = 0;
            if (nf) {
              const gap = Math.max(this.gapX(nf, veh), 0.1), closing = nf.v - veh.v;
              bReq = closing > 0 ? closing * closing / (2 * gap) : 0;
            }
            // no abort when there is nowhere to go back to: an ending lane makes the
            // commit final (Hidas's forced regime) — the follower is the one who yields
            const canReturn = !veh.onRamp ||
              this.wallDist(veh) > veh.v * tau2 + 12;
            if (nf && progLat < 0.4 && canReturn && bReq > abortThresh) {
              if (this.onAbort) this.onAbort(veh, nf);
              // the maneuver ends here; lane keeping brings the body back into its band
              veh.changing = false;
              veh.lane = veh.targetLane = veh.startLane;
              veh.signal = null; veh.claimLane = null;
              veh.cooldown = 1.5;
              this.stats.aborts++;
            }
          }
        } else if (veh.desireLane != null) {
          const d = veh.desire, target = veh.desireLane;
          let started = false;
          if (veh.cooldown <= 0 && d >= lc.dFree) {
            started = this.tryChange2D(veh, target, d, veh._gain);
          }
          if (!started && d >= lc.dSync) {
            // synchronization: match the target-lane leader (with the desire-scaled
            // headway), decelerating no harder than comfortable. This is what the old
            // ramp-only "speed-match over the first 70%" rule was.
            const nl = veh._gain ? veh._gain.nl : this.scanAhead(veh, this.laneBand(target), 300);
            if (nl) {
              const a = veh.idmAcc(Math.max(this.gapX(veh, nl), 0.1), nl.v, this.headwayAt(veh, d));
              cmd = Math.min(cmd, Math.max(a, -veh.p.b));
            }
          }
        }

        // --- steering intent: maneuver → target center; ending lane → hug the closing
        //     edge but never leave the lane band uninvited; keeping → comfort band (no
        //     correction inside it). Lateral clearance gates lateral motion. ---
        let yT, gated = false;   // gated: the clearance limit binds → hold the FRONT
        if (veh.changing) yT = this.laneCenter(veh.targetLane);
        else {
          yT = this.keepTarget(veh);   // null = hands off inside the comfort band
          if (veh.onRamp) {
            // hug the closing edge, but never leave the lane band uninvited — and never
            // steer back OUT toward a closing edge once squeezed below the band's floor
            const edgeT = this.outerEdge(veh.x) - veh.width / 2 - 0.3;
            const floor = this.laneCount * P.laneWidth + veh.width / 2 + 0.05;
            if ((yT == null ? veh.y : yT) > edgeT) yT = Math.max(edgeT, Math.min(floor, veh.y));
          }
          // hands off position, not blind to heading: at highway speed even ~0.5° of
          // misalignment is 0.3 m/s of visible drift — straightened when noticed,
          // even while lane position feels fine (without this, heading random-walks
          // and drivers ping-pong edge to edge; T8 caught it)
          if (yT == null && Math.abs(veh.psi) > 0.008) yT = veh.y;
        }
        if (yT != null && Math.abs(yT - veh.y) > 0.05) {
          const dir = Math.sign(yT - veh.y);
          // the over-the-shoulder look is BELIEVED clearance: a driver who skipped the
          // check for this maneuver assumes the strip is clear (blind-spot sideswipes
          // emerge from here); lane-keeping corrections always look
          const looked = !veh.changing || veh.checked;
          const allowed = (looked ? this.lateralClearance(veh, dir) : Infinity) - lc.latClearance;
          if (allowed <= 0.02) {
            // blocked alongside: hold, and drop back to break the lockstep (the
            // zipper's other half — holding lateral alone re-gridlocked the loop)
            yT = veh.y; gated = true;
            if (veh.v > 0.3) cmd = Math.min(cmd, -0.5);
          } else if (Math.abs(yT - veh.y) > allowed) {
            yT = veh.y + dir * allowed; gated = true;
          }
        }
        veh.heldDelta = (yT != null ? veh.steerToward(yT, veh.p.tReact, gated) : (veh.delta = 0))
          + (veh.p.motorErr ? gaussFrom(this.rng, 0, veh.p.motorErr) : 0);
        veh.heldAcc = this.pedal(veh, cmd);
        this.scheduleDecision(veh);
      }
      veh.acc = veh.heldAcc;

      // --- reflex layer, every tick, beneath the slow loop: evidence accumulation on
      //     perceived looming (Markkula et al. 2016). Danger D = required deceleration
      //     (closing²/2·gap — the loom quantity) as PERCEIVED, relative to the emergency
      //     threshold; evidence accrues at loomGain·(D−1) while the eyes are on the road,
      //     leaks otherwise; the brake fires at 1 and holds while the danger persists.
      //     Infinite gain is the old same-tick reflex; realistic gain gives the
      //     kinematics-dependent brake onset the naturalistic data show, and a glance
      //     makes the onset wait for the eyes. No crash rule anywhere in here. ---
      let D = 0;
      if (lead) {
        const gapT = this.gapX(veh, lead), closingT = veh.v - lead.v;
        const gap = Math.max(gapT * (1 + veh.gapErr), 0.1);
        const closing = closingT * (1 + veh.closeErr);
        if (closing > 0) D = closing * closing / (2 * gap) / P.emergencyDecel;
        if (gapT < 0.8) D = Math.max(D, 2);            // a body on the bumper
        // near-crash bookkeeping (ground truth, for the safety metrics)
        const ttc = closingT > 0 ? gapT / closingT : Infinity;
        if (!veh.inNearCrash && ttc < A.nearCrashTTC) { veh.inNearCrash = true; this.stats.nearCrashes++; }
        else if (veh.inNearCrash && ttc > A.nearCrashExit) veh.inNearCrash = false;
      } else veh.inNearCrash = false;
      {
        const wall = this.wallDist(veh);
        if (wall < Infinity) D = Math.max(D, veh.v * veh.v / (2 * Math.max(wall, 0.1)) / P.emergencyDecel);
      }
      // evidence arrives at the rate the looming does (Markkula: accumulation ∝ θ̇):
      // θ̇ = W·closing/gap² is overwhelming at a 1 m gap and faint at 40 m, so the same
      // danger level fires the brake almost at once close in and slowly far out (a
      // 14 m/s follower meeting a cut-in 1.2 m ahead waited half a second without this)
      let salience = 1;
      if (lead && D > 1) {
        const gapT = Math.max(this.gapX(veh, lead), 0.1), closingT = Math.max(veh.v - lead.v, 0);
        salience = Math.max(1, lead.width * closingT / (gapT * gapT) / A.loomRef);
      }
      const gainTerm = attending ? veh.p.loomGain * Math.max(D - 1, 0) * salience : 0;
      veh.loomA = clamp(veh.loomA + (gainTerm - A.loomLeak * veh.loomA) * dt, 0, 1.05);
      if (veh.loomA >= 1) {
        veh.acc = -P.bMax;
        veh.heldAcc = veh.acc;
        veh.nextDecision = Math.min(veh.nextDecision, this.time + P.startleDelay);
      }
      // lateral reflex (peripheral vision is fast — while the eyes are on the road):
      // drifting toward a body alongside → straighten now, drop back to break lockstep
      if (attending && Math.abs(veh.psi) > 0.02 &&
          this.lateralClearance(veh, Math.sign(veh.psi)) < lc.latClearance + 0.1) {
        veh.heldDelta = veh.steerToward(veh.y, veh.p.tReact, true);   // reflex, noiseless
        if (veh.v > 0.3) veh.acc = Math.min(veh.acc, -0.5);
      }

      // anti-stalemate creep: nothing PHYSICAL blocks a stopped car with clear pavement
      // ahead — only phantom constraints do (claims, scan margins, corridor leaders that
      // are laterally clear), and a real driver creeps into ambiguity after a few
      // seconds. This dissolves the whole mutual-wait deadlock class instead of patching
      // each pair geometry (three distinct ones froze the bottleneck loop before this).
      if (veh.v < 0.5) {
        veh.stallT = (veh.stallT || 0) + dt;
        if (veh.stallT > 3 && veh.v < 2.5) {
          let clear = true;
          const band = this.sweptBand(veh);
          const n2 = this.all.length;
          for (let k = 1; k < n2; k++) {
            const o = this.all[(veh.allIdx + k) % n2];
            const d = this.distAhead(veh.x, o.x);
            if (d > 8 + 20) break;   // 20 = max body length: fronts sort, rears don't
            for (const s of this.segs(o)) {
              const ds = this.distAhead(veh.x, s.x);
              if (ds < this.L / 2 && ds - s.len < 8 && this.bandsOverlap(s.band, band, 0.05)) {
                clear = false; break;
              }
            }
            if (!clear) break;
          }
          // at the pavement end, creeping is only sane if the road beside is clear
          if (clear && this.wallDist(veh) < 1.0 &&
              this.lateralClearance(veh, -1) < lc.latClearance) clear = false;
          if (clear) veh.acc = Math.max(veh.acc, 0.5);
        }
      } else veh.stallT = 0;
    }
  }

  integratePass2D(dt) {
    const P = PARAMETERS, lc = P.lc;
    const right = this.laneCount - 1;
    let removed = false;
    for (const veh of this.all) {
      // execute the HELD steering command (decisions and reflexes set it; between
      // decisions the car runs open-loop — that's the intermittent controller)
      veh.delta = clamp(veh.heldDelta, -P.steering.maxSteer, P.steering.maxSteer);

      const vNew = Math.max(0, veh.v + veh.acc * dt);
      const adv = (veh.v + vNew) / 2 * dt;
      const oldX = veh.x, oldY = veh.y;
      // kinematic bicycle about the REAR: the rear point rolls along the heading (no
      // slip), the heading turns with the steered front, and the nose swings. (x, y)
      // stays the FRONT for everyone else. Integrating the front as if it were the
      // rear axle made a steering truck's tail sweep sideways at >2 m/s — the rotated
      // body's first probe caught a stopped truck's tail 3 m inside the next lane.
      const c0 = Math.cos(veh.psi), s0 = Math.sin(veh.psi);
      const xR = veh.x - veh.len * c0 + adv * c0, yR = veh.y - veh.len * s0 + adv * s0;
      veh.psi = clamp(veh.psi + vNew * Math.tan(veh.delta) / veh.wheelbase * dt, -0.3, 0.3);
      veh.x = ((xR + veh.len * Math.cos(veh.psi)) % this.L + this.L) % this.L;
      veh.y = yR + veh.len * Math.sin(veh.psi);
      veh.v = vNew;

      // relaxation: an accepted short headway grows back to the driver's own
      if (veh.Teff < veh.p.T) veh.Teff = Math.min(veh.p.T, veh.Teff + (veh.p.T - veh.Teff) * dt / lc.tau);

      // road edges: the left edge, and the pavement edge (which closes along a taper).
      // A through-lane body may straddle onto the shoulder; its CENTRE leaving the
      // pavement at speed is a run-off-road crash (a lane departure that emerges from
      // wander during a long glance) — the body stops there. Ending-lane bodies are
      // held to the closing edge (the taper squeeze).
      const sh = veh.onRamp ? 0 : P.attention.shoulder;
      const lo = veh.width / 2 + 0.05 - sh;
      const hi = this.outerEdge(veh.x) - veh.width / 2 - 0.05 + sh;
      if (!veh.crashed && !veh.onRamp && veh.v > P.attention.departSpeed &&
          (veh.y < 0 || veh.y > this.outerEdge(veh.x))) {
        this.stats.departures++;
        this.crash(veh, 'departure');
      }
      if (veh.y < lo) { veh.y = lo; veh.psi = Math.max(veh.psi, 0); }
      if (veh.y > hi) {
        // the closing edge pushes the body onto the road — a real driver crossing the
        // gore paint — but only into clear pavement: with a body alongside, the pavement
        // end is a stop, not a squeeze (never squeeze into an occupied slot)
        const shift = veh.y - hi;
        if (this.lateralClearance(veh, -1) >= shift + 0.1) {
          // kill only the heading INTO the edge: a driver steering away from it keeps
          // that heading (halving it pinned committed mergers against the gore, unable
          // to turn onto the road — the bottleneck trace)
          veh.y = hi; veh.psi = Math.min(veh.psi, 0);
        } else {
          veh.x = oldX; veh.y = oldY; veh.v = 0;
        }
      }

      // an ending lane is left the moment the body is on the through road: merged
      if (veh.onRamp && veh.band()[1] <= this.roadWidth() + 0.2) {
        veh.onRamp = null;
        if (!veh.changing) veh.lane = right;
        this.stats.merges++;
      }

      // maneuver completion (tolerances sized for motor noise: held steering error
      // jitters ψ by ~0.05 at realistic settings, and drivers settle off-center)
      if (veh.changing && Math.abs(veh.y - this.laneCenter(veh.targetLane)) < 0.35 &&
          Math.abs(veh.psi) < 0.1) {
        veh.changing = false;
        veh.lane = veh.targetLane;
        veh.signal = null; veh.claimLane = null;
        veh.cooldown = P.laneChangeCooldown * (veh.desireAtStart >= lc.dSync ? 0.5 : 1);
        if (veh.targetLane !== veh.startLane) {
          this.stats.laneChanges++;
          this.stats.changeDurSum += this.time - veh.changeStart;
          this.stats.changeDurN++;
          // post-encroachment time: how long until the new follower reaches the slot I
          // just occupied — the crossing-path surrogate safety measure
          const nf = this.scanBehind(veh, this.laneBand(veh.targetLane), 150);
          if (nf && nf.v > 0.5) {
            const pet = Math.max(this.gapX(nf, veh), 0) / nf.v;
            this.stats.petSum += pet; this.stats.petN++;
            if (pet < P.attention.petConflict) this.stats.lcConflicts++;
          }
        }
      }

      for (const d of this.detectors) {
        if (this.distAhead(oldX, d.x) <= adv) { d.count++; d.speedSum += vNew; }
      }

      if (veh.destExit != null && !veh.onRamp &&
          this.distAhead(oldX, this.exits[veh.destExit].x) <= adv) {
        if (Math.abs(veh.y - this.laneCenter(right)) < 0.45 * P.laneWidth) {
          veh.done = true; removed = true;
          this.stats.exited++;
          this.stats.travelTimeSum += this.time - veh.bornAt;
          this.stats.travelTimeN++;
        } else {
          this.stats.missedExits++;
          veh.destExit = (veh.destExit + 1) % this.exits.length;
        }
      }
    }
    if (removed || this.vehicles.some((v) => v.done)) {
      this.vehicles = this.vehicles.filter((v) => !v.done);
    }
    this.geomStamp++;   // bodies moved: segment caches are stale
  }

  rampSpawn2D(dt) {
    const P = PARAMETERS;
    for (const ramp of this.onramps) {
      ramp.nextArrival -= dt;
      while (ramp.nextArrival <= 0) { ramp.queue++; ramp.nextArrival += this.expo(P.demand); }
      if (ramp.queue <= 0) continue;
      const prof = this.sampleProfile();
      let rear = null, rearProg = Infinity;
      for (const veh of this.vehicles) {
        if (veh.onRamp !== ramp) continue;
        const p = this.distAhead(ramp.x, veh.x);
        if (p < rearProg) { rearProg = p; rear = veh; }
      }
      if (rear && rearProg <= prof.s0 + rear.len + 6) continue;
      ramp.queue--;
      ramp.spawned++;
      this.stats.spawned++;
      const vEntry = rear && rearProg < 40
        ? Math.min(12, rear.v + Math.sqrt(2 * prof.b * Math.max(rearProg - rear.len - prof.s0, 0)))
        : 12;
      // the auxiliary lane is lane N: the vehicle is an ordinary vehicle in a lane that ends
      const veh = new Vehicle(this.nextId++, ramp.x, this.laneCount, vEntry, prof,
                              this.sampleDest(ramp.x), this.time);
      veh.onRamp = ramp;
      this.vehicles.push(veh);
      veh.allIdx = 0;   // harmless placeholder until next sortAll
    }
  }

  collisionPass2D() {
    const n = this.all.length;
    if (n < 2) return;
    if (this.contacts) {   // a pair that has separated may collide again as a new event
      for (const [k, t] of this.contacts) if (this.time - t > 0.5) this.contacts.delete(k);
    }
    for (let i = 0; i < n; i++) {
      const f = this.all[i];
      if (f.done) continue;
      for (let k = 1; k <= 4; k++) {
        const l = this.all[(i + k) % n];
        if (l.done || l === f) continue;
        const d = this.distAhead(f.x, l.x);
        if (d > l.len + 2) break;
        // contact = any segment pair overlapping both longitudinally and laterally
        let latOverlap = -Infinity;
        for (const a of this.segs(f)) {
          for (const b of this.segs(l)) {
            if (!this.segsOverlapX(a, b) || !this.bandsOverlap(a.band, b.band, -0.05)) continue;
            latOverlap = Math.max(latOverlap,
              Math.min(a.band[1], b.band[1]) - Math.max(a.band[0], b.band[0]));
          }
        }
        if (latOverlap > -Infinity) {
          const rearEnd = latOverlap > Math.min(f.width, l.width) * 0.6;
          // one EVENT per pair in contact (a stopped pair touching by 5 cm was logged
          // every tick — 116 "sideswipes" that were one graze)
          const key = f.id < l.id ? f.id + ':' + l.id : l.id + ':' + f.id;
          if (!this.contacts) this.contacts = new Map();
          const fresh = !this.contacts.has(key);
          this.contacts.set(key, this.time);
          if (!fresh) continue;
          if (rearEnd) this.stats.collisions++;
          else this.stats.sideswipes++;
          // contact at speed is a crash (a scrape at crawl is logged as a graze and the
          // drivers carry on); both bodies stop and become obstacles → secondary
          // crashes emerge from the same physics
          if (Math.max(f.v, l.v) > PARAMETERS.attention.crashSpeed) {
            const secondary = f.crashed || l.crashed;
            const merge = !!(f.onRamp || l.onRamp || f.changing || l.changing);
            this.crash(f, rearEnd ? 'rearEnd' : 'sideswipe');
            this.crash(l, rearEnd ? 'rearEnd' : 'sideswipe');
            if (secondary) this.stats.secondary++;
            if (merge) this.stats.mergeCrashes++;
            if (rearEnd) this.stats.rearEnds++; else this.stats.sideswipeCrashes++;
          }
          if (!this.collisionLog) this.collisionLog = [];
          if (this.collisionLog.length < 40) {
            const st = (v) => ({ id: v.id, x: Math.round(v.x), y: +v.y.toFixed(1),
              v: +v.v.toFixed(1), psi: +v.psi.toFixed(3), len: v.len,
              chg: v.changing ? v.startLane + '>' + v.targetLane : null,
              ramp: !!v.onRamp, glance: this.time < v.glanceUntil, dest: v.destExit });
            this.collisionLog.push({ t: +this.time.toFixed(1), f: st(f), l: st(l) });
          }
          // resolve: a rear-end backs the follower off; a graze only stops the closing
          // (backing a grazed car up teleported it into ITS follower — a phantom
          // rear-end the bottleneck probe logged)
          if (rearEnd) f.x = ((l.x - l.len - 0.3) % this.L + this.L) % this.L;
          f.v = Math.min(f.v, l.v);
        }
      }
    }
  }

  // a vehicle is in a crash: it stops where it is and stays an obstacle until cleared
  crash(veh, type) {
    if (veh.crashed) return;
    veh.crashed = true; veh.crashT = this.time; veh.crashType = type;
    veh.changing = false; veh.signal = null; veh.claimLane = null; veh.loomA = 0;
    this.stats.crashes++;
    if (!this.crashLog) this.crashLog = [];
    if (this.crashLog.length < 200) {
      this.crashLog.push({ t: +this.time.toFixed(1), id: veh.id, type, v: +veh.v.toFixed(1),
        x: Math.round(veh.x), lane: veh.lane, glance: this.time < veh.glanceUntil,
        glanceLeft: +Math.max(veh.glanceUntil - this.time, 0).toFixed(2),
        psi: +veh.psi.toFixed(3), y: +veh.y.toFixed(2), prof: veh.p.name,
        chg: veh.changing ? veh.startLane + '>' + veh.targetLane : null });
    }
  }

  // ---------- metrics ----------

  metrics() {
    const bicycle = PARAMETERS.bodyModel === 'bicycle';
    let vSum = 0, rampCount = 0;
    for (const veh of this.vehicles) {
      vSum += veh.v;
      if (bicycle && veh.onRamp) rampCount++;
    }
    let queueTotal = 0;
    for (const r of this.onramps) {
      queueTotal += r.queue;
      if (!bicycle) rampCount += r.vehicles.length;
    }
    const count = this.vehicles.length - (bicycle ? rampCount : 0);   // mainline only
    return {
      count, rampCount, queueTotal,
      meanV: this.vehicles.length ? vSum / this.vehicles.length : 0,
      density: count / this.laneCount / (this.L / 1000),
      stats: Object.assign({}, this.stats),
    };
  }

  // flow/speed since last call, from the loop detectors; resets the accumulators
  readDetectors(periodS) {
    let count = 0, speedSum = 0;
    for (const d of this.detectors) {
      count += d.count; speedSum += d.speedSum;
      d.count = 0; d.speedSum = 0;
    }
    const perDet = count / Math.max(this.detectors.length, 1);
    return {
      flow: (perDet / periodS) * 3600 / this.laneCount,   // veh/h/lane
      detSpeed: count ? speedSum / count : NaN,
    };
  }
};
