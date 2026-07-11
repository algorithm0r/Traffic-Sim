'use strict';
// One driver+vehicle. Car-following is the Intelligent Driver Model (Treiber, Hennecke &
// Helbing 2000, Phys. Rev. E 62:1805) integrated with the ballistic update recommended in
// Treiber & Kanagaraj 2015. Lane-change decisions (MOBIL) live in world.js because they
// need neighbor queries; the vehicle holds state and its own acceleration law only.
// The Observer renders; a vehicle never draws itself (model/view separation).

var DriverProfile = class DriverProfile {
  // name — archetype key; spec — ARCHETYPES entry; rng — seeded PRNG; variability — 0..1
  constructor(name, spec, rng, variability) {
    const g = (pair, lo, hi) =>
      clamp(variability > 0 ? gaussFrom(rng, pair[0], pair[1] * variability) : pair[0], lo, hi);
    this.name = name;
    this.v0mult = g(spec.v0mult, 0.70, 1.40);
    this.T      = g(spec.T,      0.60, 3.00);   // time headway (s) — following distance
    this.a      = g(spec.a,      0.30, 2.50);   // max accel (m/s^2)
    this.b      = g(spec.b,      0.80, 3.00);   // comfortable decel — braking anticipation
    this.s0     = g(spec.s0,     1.00, 5.00);   // standstill gap (m)
    this.len = spec.len;
    this.politeness = spec.politeness;          // MOBIL p
    this.bSafe = spec.bSafe;                    // decel this driver will impose on others
    this.exitPrep = spec.exitPrep * (variability > 0 ? (0.8 + 0.4 * rng()) : 1);
    this.truck = spec.truck;
  }

  // desired speed tracks the live speed-limit slider
  desiredSpeed() { return PARAMETERS.speedLimitMph * MPH2MS * this.v0mult; }
};

var Vehicle = class Vehicle {
  constructor(id, x, lane, v, profile, destExit, bornAt) {
    this.id = id;
    this.x = x;               // m along the loop
    this.lane = lane;         // 0 = leftmost
    this.visLane = lane;      // eased toward `lane` for smooth rendering
    this.v = v;               // m/s
    this.acc = 0;
    this.p = profile;
    this.len = profile.len;
    this.destExit = destExit; // exit index, or null = never exits (through traffic)
    this.bornAt = bornAt;     // sim time of entry (for travel times)
    this.cooldown = 0;        // s until next lane change allowed
    this.onRamp = null;       // the onramp object while still on the acceleration lane
    this.done = false;        // flagged when the vehicle takes its exit
  }

  // IDM acceleration for gap s (m, bumper to bumper) to a leader at speed vL.
  // s == null means free road. Result is capped at the physical braking limit.
  idmAcc(s, vL) {
    const p = this.p, v = this.v, v0 = p.desiredSpeed();
    const free = 1 - Math.pow(v / v0, PARAMETERS.delta);
    if (s == null) return p.a * free;
    const sStar = p.s0 + Math.max(0, v * p.T + v * (v - vL) / (2 * Math.sqrt(p.a * p.b)));
    const acc = p.a * (free - (sStar / Math.max(s, 0.1)) * (sStar / Math.max(s, 0.1)));
    return Math.max(acc, -PARAMETERS.bMax);
  }
};
