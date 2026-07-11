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
    for (let lane = 0; lane < this.laneCount; lane++) {
      for (let i = 0; i < n; i++) {
        let prof = this.sampleProfile();
        // trucks stay out of the leftmost lane on 3+ lane freeways
        if (prof.truck && lane === 0 && this.laneCount >= 3) {
          for (let tries = 0; tries < 10 && prof.truck; tries++) prof = this.sampleProfile();
        }
        const x = (i * spacing + this.rng() * spacing * 0.2) % this.L;
        const v = Math.min(prof.desiredSpeed(),
                           this.equilibriumSpeed(prof, spacing - prof.len));
        const dest = (this.rng() < PARAMETERS.throughFraction) ? null : this.sampleDest(x);
        this.vehicles.push(new Vehicle(this.nextId++, x, lane, v, prof, dest, 0));
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

      // discretionary: try right first (keep-right), then left
      if (veh.lane < this.laneCount - 1 &&
          this.tryChange(veh, veh.lane + 1, P.keepRightBias, veh.p.bSafe, false)) {
        veh.cooldown = P.laneChangeCooldown; continue;
      }
      const leftBanned = (veh.p.truck && veh.lane === 1 && this.laneCount >= 3) || planningLeftBlock;
      if (veh.lane > 0 && !leftBanned &&
          this.tryChange(veh, veh.lane - 1, -P.keepRightBias, veh.p.bSafe, false)) {
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
        // exit-bound driver stuck left near the gore: drop back to find a gap
        if (veh.destExit != null && veh.lane < this.laneCount - 1) {
          const d = this.distAhead(veh.x, this.exits[veh.destExit].x);
          const urgency = clamp(1 - d / veh.p.exitPrep, 0, 1);
          if (urgency > 0.9) veh.acc = Math.min(veh.acc, -1.5);
          else if (urgency > 0.7) veh.acc = Math.min(veh.acc, -0.6);
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

      // release from queue when the entrance is clear
      if (ramp.queue > 0) {
        const prof = this.sampleProfile();
        const entranceClear = ramp.vehicles.every(
          (rv) => this.distAhead(ramp.x, rv.x) > prof.s0 + rv.len + 2);
        if (entranceClear) {
          ramp.queue--;
          ramp.spawned++;
          this.stats.spawned++;
          const veh = new Vehicle(this.nextId++, ramp.x, rightLane, 12, prof,
                                  this.sampleDest(ramp.x), this.time);
          veh.onRamp = ramp;
          veh.visLane = rightLane + 1;   // drawn on the ramp stub until merged
          ramp.vehicles.push(veh);
        }
      }

      // ramp vehicle dynamics: IDM against the ramp leader AND a wall at the ramp end
      ramp.vehicles.sort((a, b) => this.distAhead(ramp.x, a.x) - this.distAhead(ramp.x, b.x));
      const end = (ramp.x + ramp.len) % this.L;
      for (let i = ramp.vehicles.length - 1; i >= 0; i--) {
        const rv = ramp.vehicles[i];
        const leader = (i < ramp.vehicles.length - 1) ? ramp.vehicles[i + 1] : null;
        const gapWall = this.distAhead(rv.x, end);
        const accLead = rv.idmAcc(leader ? this.gap(rv, leader) : null, leader ? leader.v : 0);
        const accWall = rv.idmAcc(Math.max(gapWall, 0.1), 0);
        rv.acc = Math.min(accLead, accWall);
        const vNew = Math.max(0, rv.v + rv.acc * dt);
        rv.x = (rv.x + (rv.v + vNew) / 2 * dt) % this.L;
        rv.v = vNew;

        // merge: MOBIL safety with urgency growing along the ramp
        const progress = clamp(this.distAhead(ramp.x, rv.x) / ramp.len, 0, 1);
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
          this.stats.merges++;
        }
      }
    }
  }

  // ---------- metrics ----------

  metrics() {
    let vSum = 0;
    for (const veh of this.vehicles) vSum += veh.v;
    const count = this.vehicles.length;
    let queueTotal = 0, rampCount = 0;
    for (const r of this.onramps) { queueTotal += r.queue; rampCount += r.vehicles.length; }
    return {
      count, rampCount, queueTotal,
      meanV: count ? vSum / count : 0,
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
