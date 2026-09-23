'use strict';
// One driver+vehicle. Car-following is the Intelligent Driver Model (Treiber, Hennecke &
// Helbing 2000, Phys. Rev. E 62:1805) integrated with the ballistic update recommended in
// Treiber & Kanagaraj 2015. Lane-change decisions (MOBIL) live in world.js because they
// need neighbor queries; the vehicle holds state and its own acceleration law only.
// The Observer renders; a vehicle never draws itself (model/view separation).

var DriverProfile = class DriverProfile {
  // name — archetype key; spec — ARCHETYPES entry; rng — seeded PRNG; variability — 0..1
  constructor(name, spec, rng, variability) {
    // browser toggle: every driver at the ideal point (suites set ARCHETYPES directly)
    if (PARAMETERS.idealDrivers) spec = Object.assign({}, spec, IDEAL_CONTROL);
    const g = (pair, lo, hi) =>
      clamp(variability > 0 ? gaussFrom(rng, pair[0], pair[1] * variability) : pair[0], lo, hi);
    this.name = name;
    this.v0mult = g(spec.v0mult, 0.70, 1.40);
    this.T      = g(spec.T,      0.60, 3.00);   // time headway (s) — following distance
    this.a      = g(spec.a,      0.30, 2.50);   // max accel (m/s^2)
    this.b      = g(spec.b,      0.80, 3.00);   // comfortable decel — braking anticipation
    this.s0     = g(spec.s0,     1.00, 5.00);   // standstill gap (m)
    this.len = spec.len;
    this.width = spec.width || 1.8;             // m (trucks 2.5 — was never copied before Stage 10)
    this.politeness = spec.politeness;          // MOBIL p
    this.bSafe = spec.bSafe;                    // decel this driver will impose on others
    this.exitPrep = spec.exitPrep * (variability > 0 ? (0.8 + 0.4 * rng()) : 1);
    this.truck = spec.truck;
    // human control loop (v0.3) — ideal controller = (dt, 0, 0, large)
    this.tReact   = clamp(g(spec.tReact   || [0.05, 0], 0.05, 2.0) * (PARAMETERS.tReactX || 1), 0.05, 3.0);
    this.percErr  = g(spec.percErr  || [0, 0],    0,    0.30);
    this.motorErr = g(spec.motorErr || [0, 0],    0,    0.08);
    this.laneTol  = g(spec.laneTol  || [1.5, 0],  0.05, 1.50);
    // attention & perception (Stage 11) — ideal = (∞, 0, ·, 1). A scalar spec draws
    // nothing (the ideal point must not shift the control suites' random streams).
    const gs = (v, def, lo, hi) => v == null ? def : (typeof v === 'number' ? clamp(v, lo, hi) : g(v, lo, hi));
    this.loomGain   = gs(spec.loomGain,   1e6, 0.1, 1e6);
    this.glanceRate = gs(spec.glanceRate, 0,   0,   60) / 60 * (PARAMETERS.glanceX == null ? 1 : PARAMETERS.glanceX);   // per second
    this.glanceMean = gs(spec.glanceMean, 0.5, 0.1, 5);
    this.checkProb  = gs(spec.checkProb,  1,   0,   1);
  }

  // desired speed tracks the live speed-limit slider
  desiredSpeed() { return PARAMETERS.speedLimitMph * MPH2MS * this.v0mult; }
};

var Vehicle = class Vehicle {
  constructor(id, x, lane, v, profile, destExit, bornAt) {
    this.id = id;
    this.x = x;               // m along the loop
    this.lane = lane;         // 0 = leftmost
    this.visLane = lane;      // eased toward `lane` for smooth rendering (lane body only)
    this.v = v;               // m/s
    this.acc = 0;
    this.p = profile;
    this.len = profile.len;
    this.width = profile.width || 1.8;
    this.destExit = destExit; // exit index, or null = never exits (through traffic)
    this.bornAt = bornAt;     // sim time of entry (for travel times)
    this.cooldown = 0;        // s until next lane change allowed
    this.onRamp = null;       // the onramp object while still on the acceleration lane
    this.done = false;        // flagged when the vehicle takes its exit

    // --- intermittent-control state (v0.3): commands computed at decision points,
    //     held open-loop in between ---
    this.heldAcc = 0;
    this.heldDelta = 0;
    this.nextDecision = bornAt;   // decide immediately on entry; world staggers seeds

    // --- bicycle-body state (unused by the 'lane' body) ---
    this.y = (lane + 0.5) * PARAMETERS.laneWidth;  // lateral position, 0 = left road edge
    this.psi = 0;             // heading relative to the road axis (rad)
    this.delta = 0;           // steering angle (rad)
    this.wheelbase = Math.max(2.4, this.len * 0.6);
    this.targetLane = lane;   // where the maneuver manager is steering us
    this.changing = false;    // mid-maneuver flag
    this.changeStart = 0;     // sim time the current maneuver began
    this.startLane = lane;    // for aborts

    // --- lane-change desire state (Stage 10; bicycle body) ---
    this.Teff = profile.T;    // effective time headway: accepted at a change, relaxes to p.T
    this.desire = 0;          // 0..1 toward desireLane (the best side this decision)
    this.desireLane = null;
    this.signal = null;       // lane indicated (desire >= dSync, or committed)
    this.claimLane = null;    // lane others treat as mine (desire >= dCoop, or committed)

    // --- attention & perception state (Stage 11) ---
    this.loomA = 0;           // looming evidence accumulator; the brake fires at 1
    this.gapErr = 0;          // perception error multipliers sampled at the last decision
    this.closeErr = 0;
    this.glanceUntil = -1;    // eyes off the road until this time
    this.nextGlance = null;   // scheduled by the world on first sight
    this.checked = true;      // shoulder checked for the current maneuver
    this.crashed = false;     // post-crash: stopped, an obstacle, cleared later
    this.crashT = 0;
    this.inNearCrash = false; // TTC hysteresis for near-crash counting
  }

  // The rotated body (v0.4.1): (x, y) is the FRONT, the rear sits len·(cos ψ, sin ψ)
  // behind it. Every geometric query sees the body as a chain of short segments along
  // its heading (cars 2, trucks 6), each an axis-aligned box at its own position whose
  // lateral extent includes its own sway (w·|cos ψ| + l·|sin ψ|). One box at the nose's
  // y let a turning truck's tail (4.7 m off at 0.3 rad) pass through cars alongside;
  // one box spanning both ends turned every diagonal car into a phantom wall.
  segments() {
    const n = Math.max(1, Math.ceil(this.len / 3));
    const l = this.len / n, s = Math.sin(this.psi), c = Math.cos(this.psi);
    const ext = this.width * Math.abs(c) + l * Math.abs(s);
    const out = new Array(n);
    for (let i = 0; i < n; i++) {
      const yMid = this.y - (i + 0.5) * l * s;
      out[i] = { x: this.x - i * l * c, len: l, band: [yMid - ext / 2, yMid + ext / 2] };
    }
    return out;
  }

  // full lateral interval [lo, hi] of the body — the union of its segments (used for
  // "what lane am I in", the swept corridor, and the pavement-end extent)
  band() {
    const s = Math.sin(this.psi);
    const yR = this.y - this.len * s, ext = this.width * Math.abs(Math.cos(this.psi));
    return [Math.min(this.y, yR) - ext / 2, Math.max(this.y, yR) + ext / 2];
  }

  // Steering cascade (highway-env architecture): lateral-position P-control produces a
  // commanded lateral speed, converted to a desired heading, tracked by a heading
  // P-control that yields a steering angle for the kinematic bicycle.
  //
  // `horizon` (v0.3) is the driver's own hold time: the commanded arc is planned to
  // complete when the NEXT decision arrives. Held δ integrates ψ linearly, so heading
  // horizon = hold time is dead-beat — an instant-gain command held open-loop
  // overshoots every interval and the driver oscillates forever (T8 caught it). At the
  // ideal point (horizon = dt) this collapses to the classic constants.
  // `atFront`: reference the FRONT instead — used when the lateral-clearance gate binds
  // (a body alongside): the cab is what must hold, and holding it means counter-steering
  // while the rear still drifts along the heading; planning on the rear there let the
  // front push past the clearance (T7 and the bottleneck grew sideswipes).
  steerToward(yTarget, horizon, atFront) {
    const S = PARAMETERS.steering;
    const vSafe = Math.max(this.v, 1);
    // lateral horizon 4× the hold: one constant δ can't zero position error AND
    // heading in a single interval (one control, two states), so aggressive position
    // gains under held commands limit-cycle across the lane — approach gently instead
    const hLat = Math.max(S.tauLat, 4 * (horizon || 0));
    const hHead = Math.max(S.tauHeading, horizon || 0);
    // lateral error is measured at the REAR point — the one that rolls along the
    // heading. The front swings by len·ψ̇ with every steering change, so a plan made
    // for the front reverses it at each held-command boundary: a 16 m truck's cab
    // saw-toothed across the lane at realistic hold times ("vibrating", 2026-09-23).
    // The standard kinematic-bicycle controller references the rear axle for this.
    const yRef = atFront ? this.y : this.y - this.len * Math.sin(this.psi);
    const vLat = clamp((yTarget - yRef) / hLat, -S.maxLatSpeed, S.maxLatSpeed);
    // heading capped at ~11°: the lateral-speed cap alone let crawling drivers command
    // 30° (1.5 m/s lateral at 1 m/s forward) — real lane changes at walking pace are
    // shallow, and a 30° body sweeps most of a lane
    const psiDes = Math.asin(clamp(vLat / vSafe, -0.2, 0.2));
    const psiDot = (psiDes - this.psi) / hHead;
    this.delta = clamp(Math.atan(this.wheelbase * psiDot / vSafe), -S.maxSteer, S.maxSteer);
    return this.delta;
  }

  // IDM acceleration for gap s (m, bumper to bumper) to a leader at speed vL.
  // s == null means free road. Result is capped at the physical braking limit.
  // T overrides the headway (desire-scaled evaluations); default is the effective
  // headway, which equals p.T except while relaxing after an accepted short gap.
  idmAcc(s, vL, T) {
    const p = this.p, v = this.v, v0 = p.desiredSpeed();
    const free = 1 - Math.pow(v / v0, PARAMETERS.delta);
    if (s == null) return p.a * free;
    const Th = T != null ? T : this.Teff;
    const sStar = p.s0 + Math.max(0, v * Th + v * (v - vL) / (2 * Math.sqrt(p.a * p.b)));
    const acc = p.a * (free - (sStar / Math.max(s, 0.1)) * (sStar / Math.max(s, 0.1)));
    return Math.max(acc, -PARAMETERS.bMax);
  }
};
