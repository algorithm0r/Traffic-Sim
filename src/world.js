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
      sideswipes: 0, aborts: 0, changeDurSum: 0, changeDurN: 0,   // bicycle body only
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
      if (veh.cooldown > 0) { veh.cooldown -= dt; continue; }

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
    for (const arr of this.lanes) {
      for (const veh of arr) {
        const ld = this.leaderOf(veh);
        veh.acc = veh.idmAcc(ld ? this.gap(veh, ld) : null, ld ? ld.v : 0);
        // exit-bound driver stuck left near the gore: ease off to find a gap — but NEVER
        // park on a live lane (a stopped car can't merge into flowing traffic and plugs
        // its lane; if the gap never comes, the realistic outcome is missing the exit)
        if (veh.destExit != null && veh.lane < this.laneCount - 1) {
          const d = this.distAhead(veh.x, this.exits[veh.destExit].x);
          const urgency = clamp(1 - d / veh.p.exitPrep, 0, 1);
          if (urgency > 0.7 && veh.v > 8) veh.acc = Math.min(veh.acc, -0.6);
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
  // Bicycle-body passes ('bicycle' mode). SAME decision models (IDM + MOBIL),
  // executed through continuous (x, y, heading) with a steering cascade. Lane
  // membership becomes geometry: a vehicle occupies whatever its body band
  // overlaps, so a diagonal car constrains BOTH lanes for the whole maneuver.
  // The 'lane' passes above are untouched — they are the validated control.
  // ==========================================================================

  laneCenter(i) { return (i + 0.5) * PARAMETERS.laneWidth; }
  laneBand(i) { return [i * PARAMETERS.laneWidth, (i + 1) * PARAMETERS.laneWidth]; }
  roadWidth() { return this.laneCount * PARAMETERS.laneWidth; }
  rampCenter() { return (this.laneCount + 0.5) * PARAMETERS.laneWidth; }
  laneOf(veh) {
    return clamp(Math.round(veh.y / PARAMETERS.laneWidth - 0.5), 0, this.laneCount - 1);
  }
  bandsOverlap(a, b, margin) {
    return a[0] < b[1] + (margin || 0) && b[0] < a[1] + (margin || 0);
  }

  sortAll() {
    this.all = this.vehicles.slice().sort((a, b) => a.x - b.x);
    for (let i = 0; i < this.all.length; i++) this.all[i].allIdx = i;
    for (const r of this.onramps) r.count2D = 0;
    for (const veh of this.vehicles) if (veh.onRamp) veh.onRamp.count2D++;
  }

  // What I claim as mine while changing: my whole swept corridor (used as MY leader
  // query — I must not ram anything along the path I'm about to sweep).
  sweptBand(veh) {
    const b = veh.band();
    if (!veh.changing) return b;
    const c = this.laneCenter(veh.targetLane);
    return [Math.min(b[0], c - veh.width / 2), Math.max(b[1], c + veh.width / 2)];
  }

  // What OTHERS see of o: its body, plus — if it's mid-change — its claimed slot in
  // the target lane (turn-signal reading; kills the merger-invisibility window).
  // Deliberately NOT the corridor in between: making the corridor visible to everyone
  // had origin-lane followers braking for vehicles that were leaving, which interlocked
  // into full-loop gridlock (validation D froze at 0 m/s). The body clears the origin
  // lane naturally as it departs; the claim covers the destination.
  footprintOverlaps(o, band, margin) {
    if (this.bandsOverlap(o.band(), band, margin)) return true;
    if (!o.changing) return false;
    const c = this.laneCenter(o.targetLane);
    return this.bandsOverlap([c - o.width / 2, c + o.width / 2], band, margin);
  }

  // nearest vehicle ahead of `veh` (by REAR gap, not front position — fronts are what
  // the array sorts on, and a short car's nearer front can mask a long truck whose tail
  // is on your bumper; T7's one rear-end was exactly that) whose footprint overlaps
  // `band`. The 0.35 m margin keeps a changer sliding out of my lane registered as my
  // leader until its corner has genuinely cleared.
  scanAhead(veh, band, maxDist) {
    const n = this.all.length;
    let best = null, bestGap = Infinity;
    for (let k = 1; k < n; k++) {
      const o = this.all[(veh.allIdx + k) % n];
      const d = this.distAhead(veh.x, o.x);
      if (d > maxDist || d - 20 > bestGap) break;   // no farther front hides a nearer rear
      if (this.footprintOverlaps(o, band, 0.35)) {
        const g = d - o.len;
        if (g < bestGap) { bestGap = g; best = o; }
      }
    }
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

  // MOBIL against a target lane, geometric edition. Returns true and starts the
  // maneuver on acceptance. `forced` skips the incentive (mandatory at high urgency).
  mobil2D(veh, target, bonus, bSafe, forced) {
    if (this.convergenceConflict(veh, target)) return false;
    const tb = this.laneBand(target);
    const nl = this.scanAhead(veh, tb, 300);
    const nf = this.scanBehind(veh, tb, 300);
    if (nl && this.gapX(veh, nl) < 0.5) return false;
    if (nf && nf !== nl && this.gapX(nf, veh) < 0.5) return false;
    const myNew = veh.idmAcc(nl ? Math.max(this.gapX(veh, nl), 0.1) : null, nl ? nl.v : 0);
    if (myNew < -bSafe) return false;
    let nfNew = 0, nfOld = 0;
    if (nf && nf !== nl) {
      nfNew = nf.idmAcc(Math.max(this.gapX(nf, veh), 0.1), veh.v);
      if (nfNew < -bSafe) return false;
      nfOld = nf.idmAcc(nl ? Math.max(this.gapX(nf, nl), 0.1) : null, nl ? nl.v : 0);
    }
    if (!forced) {
      const ob = veh.band();
      const ol = this.scanAhead(veh, ob, 300), of = this.scanBehind(veh, ob, 300);
      const myOld = veh.idmAcc(ol ? Math.max(this.gapX(veh, ol), 0.1) : null, ol ? ol.v : 0);
      let ofNew = 0, ofOld = 0;
      if (of && of !== ol) {
        ofOld = of.idmAcc(Math.max(this.gapX(of, veh), 0.1), veh.v);
        ofNew = of.idmAcc(ol ? Math.max(this.gapX(of, ol), 0.1) : null, ol ? ol.v : 0);
      }
      const gain = (myNew - myOld)
                 + veh.p.politeness * ((nfNew - nfOld) + (ofNew - ofOld)) + bonus;
      if (gain <= PARAMETERS.mobilThreshold) return false;
    }
    veh.startLane = veh.onRamp ? this.laneCount - 1 : this.laneOf(veh);
    veh.targetLane = target;
    veh.changing = true;
    veh.changeStart = this.time;
    veh.acceptedBSafe = bSafe;   // abort threshold must respect what was accepted
    return true;
  }

  // The over-the-shoulder glance: who occupies the strip I'm about to steer through,
  // alongside my own body? scanAhead/scanBehind order vehicles by front position, so a
  // body ALONGSIDE (x-extents overlapping) is invisible to both — the merge-zone crawl
  // produced 93 sideswipes from exactly this blind spot (validation D). Returns the
  // blocker (or null) so the caller can drop back behind it: holding lateral alone
  // re-gridlocked the loop, because blocked vehicles creep in LOCKSTEP with their
  // blockers and the strip never clears. Falling back is the zipper's other half.
  alongsideBlocker(veh, targetY) {
    const dir = Math.sign(targetY - veh.y);
    if (!dir) return null;
    const strip = dir > 0
      ? [veh.y - veh.width / 2, veh.y + veh.width / 2 + 1.2]
      : [veh.y - veh.width / 2 - 1.2, veh.y + veh.width / 2];
    const n = this.all.length;
    for (let k = 1; k <= 6 && k < n; k++) {
      const cands = [this.all[(veh.allIdx + k) % n], this.all[(veh.allIdx - k + n) % n]];
      for (const o of cands) {
        if (o === veh || o.done) continue;
        if (this.overlaps(veh, o) && this.bandsOverlap(o.band(), strip, 0)) return o;
      }
    }
    return null;
  }

  decisionPass2D(dt) {
    const P = PARAMETERS;
    const right = this.laneCount - 1;
    for (const veh of this.all) {
      if (veh.cooldown > 0) veh.cooldown -= dt;

      // IDM against whoever constrains my swept corridor (mine, if I'm mid-change)
      const lead = this.scanAhead(veh, this.sweptBand(veh), 400);
      veh.acc = veh.idmAcc(lead ? Math.max(this.gapX(veh, lead), 0.1) : null,
                           lead ? lead.v : 0);

      // ramp: mainline speed-matching, the merge maneuver, and the TAPER — past the
      // acceleration lane the pavement's outer edge narrows over 40 m, geometrically
      // squeezing any unmerged vehicle into the lane. Mainline followers see the
      // encroaching band through ordinary IDM and yield: real-world "nudging" emerges
      // from geometry, with no forcing bookkeeping. The wall sits where pavement ends.
      if (veh.onRamp) {
        const ramp = veh.onRamp;
        const prog = Math.min(this.distAhead(ramp.x, veh.x), ramp.len + 40);
        const accWall = veh.idmAcc(Math.max(ramp.len + 40 - 0.5 - prog, 0.1), 0);
        veh.acc = Math.min(veh.acc, accWall);
        if (prog < ramp.len * 0.7) {
          const ml = this.scanAhead(veh, this.laneBand(right), 300);
          const accMain = veh.idmAcc(ml ? Math.max(this.gapX(veh, ml), 0.1) : null,
                                     ml ? ml.v : 0);
          veh.acc = Math.min(Math.max(accWall, accMain),
                             lead ? veh.idmAcc(Math.max(this.gapX(veh, lead), 0.1), lead.v)
                                  : accMain);
        }
        if (!veh.changing) {
          if (veh.cooldown <= 0) {
            const bSafeM = 4 + clamp(prog / ramp.len, 0, 1) * 4;
            this.mobil2D(veh, right, 0, bSafeM, true);
          }
        } else {
          // mid-merge monitor: if the lane-band follower is being squeezed and we're
          // still mostly on the ramp band, bail back to the ramp (real merge behavior)
          // committed like a mandatory change: bail only near the physical braking limit
          // (a softer threshold churned accept→abort→retry and starved the ramp)
          const nf = this.scanBehind(veh, this.laneBand(right), 200);
          const stillOnRamp = veh.y + veh.width / 2 > this.roadWidth() + 0.1;
          if (nf && stillOnRamp &&
              nf.idmAcc(Math.max(this.gapX(nf, veh), 0.1), veh.v) < -(P.bMax - 0.5)) {
            veh.changing = false;   // steering target reverts to the ramp center
            veh.cooldown = 1.5;     // hysteresis: no instant re-accept (abort thrash)
            this.stats.aborts++;
          }
        }
        continue;
      }

      // exit urgency (identical brain to the lane body)
      let urgency = 0, planningLeftBlock = false;
      if (veh.destExit != null) {
        const d = this.distAhead(veh.x, this.exits[veh.destExit].x);
        urgency = clamp(1 - d / veh.p.exitPrep, 0, 1);
        const lanesToCross = right - this.laneOf(veh);
        planningLeftBlock = d < veh.p.exitPrep + 600 * lanesToCross + 400;
        // gap-seek braking only while stuck, never mid-maneuver, and NEVER below a
        // rolling floor — parking on a live lane deadlocks (a stopped car can't merge
        // into flowing traffic; the realistic failure is missing the exit)
        if (!veh.changing && this.laneOf(veh) < right && urgency > 0.7 && veh.v > 8) {
          veh.acc = Math.min(veh.acc, -0.6);
        }
      }

      if (veh.changing) {
        // abort: the target-lane follower is being squeezed and we're still mostly home.
        // A MANDATORY (exit-forced) changer is committed — it bails only if the follower
        // would need physically impossible braking; polite thresholds caused an
        // accept-abort wobble loop at every gore that acted as a rolling bottleneck.
        const abortThresh = veh.mandatory
          ? P.bMax
          : (veh.acceptedBSafe || veh.p.bSafe) + P.steering.abortBoost;
        const nf = this.scanBehind(veh, this.laneBand(veh.targetLane), 200);
        const progLat = Math.abs(veh.y - this.laneCenter(veh.startLane))
                      / PARAMETERS.laneWidth;
        if (nf && progLat < 0.4 && veh.targetLane !== veh.startLane &&
            nf.idmAcc(Math.max(this.gapX(nf, veh), 0.1), veh.v) < -abortThresh) {
          veh.targetLane = veh.startLane;
          veh.cooldown = 1.5;
          this.stats.aborts++;
        }
        continue;
      }
      if (veh.cooldown > 0) continue;

      const lane = this.laneOf(veh);
      if (urgency > 0 && lane < right) {
        const relax = veh.p.bSafe + urgency * (P.bMax - veh.p.bSafe) * 0.6;
        if (this.mobil2D(veh, lane + 1, urgency * P.mandatoryBoost + P.keepRightBias,
                         relax, urgency > 0.6)) {
          veh.mandatory = true;
          continue;
        }
      }
      if (urgency > 0.3) continue;

      let courtesy = 0;
      if (lane === right && this.laneCount > 1) {
        for (const ramp of this.onramps) {
          if (!ramp.count2D) continue;
          const d = this.distAhead(veh.x, (ramp.x + ramp.len) % this.L);
          if (d < ramp.len + 250) { courtesy = 1.2; break; }
        }
      }
      if (!courtesy && lane < right &&
          this.mobil2D(veh, lane + 1, P.keepRightBias, veh.p.bSafe, false)) {
        veh.mandatory = false; continue;
      }
      const leftBanned = (veh.p.truck && lane === 1 && this.laneCount >= 3) || planningLeftBlock;
      if (lane > 0 && !leftBanned &&
          this.mobil2D(veh, lane - 1, courtesy - P.keepRightBias * (courtesy ? 0 : 1),
                       veh.p.bSafe, false)) {
        veh.mandatory = false;
      }
    }
  }

  integratePass2D(dt) {
    const P = PARAMETERS;
    const right = this.laneCount - 1;
    let removed = false;
    for (const veh of this.all) {
      // steering target: mid-maneuver → target lane center; on-ramp → ramp center,
      // bending inward along the taper so steering doesn't fight the pavement edge
      let yTarget;
      if (veh.changing) yTarget = this.laneCenter(veh.targetLane);
      else if (veh.onRamp) {
        const prog = this.distAhead(veh.onRamp.x, veh.x);
        const outer = this.roadWidth() + P.laneWidth *
          (prog <= veh.onRamp.len ? 1 : Math.max(0, 1 - (prog - veh.onRamp.len) / 35));
        yTarget = Math.min(this.rampCenter(), outer - veh.width / 2 - 0.3);
      } else yTarget = this.laneCenter(this.laneOf(veh));
      // shoulder check: hold lateral motion while a body is alongside in the way, and
      // drop back behind it to break lockstep (the zipper)
      if (Math.abs(yTarget - veh.y) > 0.05) {
        const blocker = this.alongsideBlocker(veh, yTarget);
        if (blocker) {
          yTarget = veh.y;
          if (veh.v > 0.3) veh.acc = Math.min(veh.acc, -0.5);
        }
      }
      veh.steerToward(yTarget);

      const vNew = Math.max(0, veh.v + veh.acc * dt);
      const adv = (veh.v + vNew) / 2 * dt;
      const oldX = veh.x;
      veh.psi = clamp(veh.psi + vNew * Math.tan(veh.delta) / veh.wheelbase * dt, -0.3, 0.3);
      veh.x = ((veh.x + adv * Math.cos(veh.psi)) % this.L + this.L) % this.L;
      veh.y += adv * Math.sin(veh.psi);
      veh.v = vNew;

      // road edges (ramp band only exists along the ramp; its taper is applied below)
      const hi = (veh.onRamp ? this.roadWidth() + P.laneWidth : this.roadWidth())
               - veh.width / 2 - 0.05;
      const lo = veh.width / 2 + 0.05;
      if (veh.y < lo) { veh.y = lo; veh.psi = Math.max(veh.psi, 0) * 0.5; }
      if (veh.y > hi) { veh.y = hi; veh.psi = Math.min(veh.psi, 0) * 0.5; }

      // ramp bookkeeping: the taper squeezes the outer pavement edge to zero over the
      // 40 m past the acceleration lane; the wall is where the pavement ends; merged =
      // body fully on the road
      if (veh.onRamp) {
        const ramp = veh.onRamp;
        const prog = this.distAhead(ramp.x, veh.x);
        // squeeze completes at +35 m but the wall sits at +40: a driver who parks s0
        // short of the wall is already fully on the road (an s0-length cork of unmerged
        // pavement at the taper end froze the entire loop — the probe caught it)
        const outer = this.roadWidth() + P.laneWidth *
          (prog <= ramp.len ? 1 : Math.max(0, 1 - (prog - ramp.len) / 35));
        const yMax = outer - veh.width / 2 - 0.05;
        if (veh.y > yMax) {
          // never squeeze into an occupied lane — pavement running out means STOP
          let blocked = false;
          const nAll = this.all.length;
          for (let k = 1; k <= 6 && k < nAll; k++) {
            for (const o of [this.all[(veh.allIdx + k) % nAll],
                             this.all[(veh.allIdx - k + nAll) % nAll]]) {
              if (o === veh || o.done) continue;
              const dxF = this.distAhead(veh.x, o.x), dxB = this.distAhead(o.x, veh.x);
              if (Math.min(dxF, dxB) > veh.len + o.len + 1) continue;
              if (this.bandsOverlap(o.band(), [yMax - veh.width / 2, yMax + veh.width / 2], 0.1)) {
                blocked = true; break;
              }
            }
            if (blocked) break;
          }
          if (blocked) { veh.x = oldX; veh.v = 0; }
          else { veh.y = yMax; veh.psi = Math.min(veh.psi, 0) * 0.5; }
        }
        if (prog >= ramp.len + 40 - 0.5 && prog < ramp.len + 90) {
          veh.x = (ramp.x + ramp.len + 40 - 0.5) % this.L;
          if (veh.y + veh.width / 2 > this.roadWidth()) veh.v = 0;
        }
        if (veh.y + veh.width / 2 <= this.roadWidth() + 0.05) {
          veh.onRamp = null;
          this.stats.merges++;
        }
      }

      // maneuver completion
      if (veh.changing && Math.abs(veh.y - this.laneCenter(veh.targetLane)) < 0.15 &&
          Math.abs(veh.psi) < 0.03) {
        veh.changing = false;
        veh.lane = veh.targetLane;
        veh.cooldown = P.laneChangeCooldown * (veh.mandatory ? 0.5 : 1);
        if (veh.targetLane !== veh.startLane) {
          this.stats.laneChanges++;
          this.stats.changeDurSum += this.time - veh.changeStart;
          this.stats.changeDurN++;
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
    if (removed) this.vehicles = this.vehicles.filter((v) => !v.done);
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
      const veh = new Vehicle(this.nextId++, ramp.x, this.laneCount - 1, vEntry, prof,
                              this.sampleDest(ramp.x), this.time);
      veh.onRamp = ramp;
      veh.y = this.rampCenter();
      this.vehicles.push(veh);
      veh.allIdx = 0;   // harmless placeholder until next sortAll
    }
  }

  collisionPass2D() {
    const n = this.all.length;
    if (n < 2) return;
    for (let i = 0; i < n; i++) {
      const f = this.all[i];
      if (f.done) continue;
      for (let k = 1; k <= 4; k++) {
        const l = this.all[(i + k) % n];
        if (l.done || l === f) continue;
        const d = this.distAhead(f.x, l.x);
        if (d > l.len + 2) break;
        const rearGap = d - l.len;
        if (rearGap < 0 && this.bandsOverlap(f.band(), l.band(), -0.05)) {
          const latOverlap = Math.min(f.band()[1], l.band()[1])
                           - Math.max(f.band()[0], l.band()[0]);
          if (latOverlap > Math.min(f.width, l.width) * 0.6) this.stats.collisions++;
          else this.stats.sideswipes++;
          if (!this.collisionLog) this.collisionLog = [];
          if (this.collisionLog.length < 40) {
            const st = (v) => ({ id: v.id, x: Math.round(v.x), y: +v.y.toFixed(1),
              v: +v.v.toFixed(1), chg: v.changing ? v.startLane + '>' + v.targetLane : null,
              ramp: !!v.onRamp, dest: v.destExit });
            this.collisionLog.push({ t: +this.time.toFixed(1), f: st(f), l: st(l) });
          }
          f.x = ((l.x - l.len - 0.3) % this.L + this.L) % this.L;
          f.v = Math.min(f.v, l.v);
        }
      }
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
