'use strict';
// Single source of truth for every tunable. Serialized verbatim into every saved data
// packet (see datamanager.js) so any run reconstructs from its stored parameters.
// Declared `var` so it's a global in the browser AND in the headless vm context.
//
// Units are SI (m, s, m/s) throughout, except speedLimitMph — the one human-facing knob.
var PARAMETERS = {
  // --- road geometry ---
  loopLength: 6000,        // m of mainline loop
  laneCount: 3,            // through lanes; 0 = leftmost (fast). UI range 2-4; tests may use 1
  laneWidth: 3.7,          // m (US standard 12 ft) — physical, used by the bicycle body
  numInterchanges: 3,      // each interchange = exit (offramp) then onramp, both on the right
  rampLength: 260,         // m of onramp acceleration lane
  rampGap: 220,            // m from an exit gore to its paired onramp gore

  // --- body model: how decisions become motion ---
  // 'lane'    — the validated 1D control: continuous x + discrete lane, changes teleport
  // 'bicycle' — kinematic bicycle body: continuous (x, y, heading), IDM+MOBIL decisions
  //             executed via a steering cascade (highway-env architecture). Same brain,
  //             different embodiment — the whole point is the controlled comparison.
  bodyModel: 'lane',
  steering: {
    tauLat: 0.6,           // s, lateral-position P-control time constant
    tauHeading: 0.25,      // s, heading P-control time constant
    maxLatSpeed: 1.5,      // m/s cap on commanded lateral speed
    maxSteer: 0.4,         // rad, steering-angle clamp
    abortBoost: 1.0,       // m/s^2 beyond bSafe before a mid-maneuver abort triggers
  },

  // --- traffic ---
  speedLimitMph: 65,
  initialDensity: 14,      // veh/km/lane seeded on the mainline at reset
  demand: 900,             // veh/h arriving at EACH onramp (Poisson)
  truckFraction: 0.10,     // share of spawns that are trucks
  profileVariability: 1,   // scales within-archetype spread; 0 = homogeneous (used by tests)
  throughFraction: 0,      // share of SEEDED mainline vehicles that never exit (experiments)
  forceArchetype: null,    // e.g. 'normal' — every driver identical archetype (tests)

  // --- human control loop (v0.3) ---
  // Drivers are INTERMITTENT controllers: at each decision point they perceive (noisily),
  // compute commands (imperfectly), then hold them open-loop for tReact seconds. Lane
  // keeping is satisficing: no correction inside the laneTol comfort band. The ideal
  // controller is a POINT in this space — tReact=dt, errors 0, laneTol large — not a
  // separate mode. An always-on emergency reflex (loom response) sits under the slow
  // loop; without it realistic tReact is unsurvivable, with it crashes are possible but
  // rare — a measured output, not an impossibility.
  emergencyDecel: 6.5,     // m/s^2 required-decel threshold that trips the reflex
  startleDelay: 0.15,      // s to the forced decision after an emergency

  // --- driver model shared constants (IDM + MOBIL) ---
  delta: 4,                // IDM acceleration exponent (Treiber et al. 2000)
  bMax: 9,                 // m/s^2 physical emergency-braking cap
  laneChangeCooldown: 4,   // s between lane changes (≈ duration of a real change)
  mobilThreshold: 0.1,     // m/s^2 MOBIL switching threshold (Kesting et al. 2007)
  keepRightBias: 0.2,      // m/s^2 mild US-style keep-right acceleration bias
  mandatoryBoost: 3.0,     // m/s^2 added rightward incentive at full exit urgency

  // --- integration ---
  dt: 0.05,                // s per engine tick (ballistic update; IDM is stable well past this)
  updatesPerDraw: 2,       // fast-forward: sim updates per rendered frame
  seed: -1,                // -1 = random each reset; >= 0 = reproducible run

  // --- rendering ---
  legs: 4,                 // horizontal legs the loop is folded into (stacked vertically)
  colorMode: 'speed',      // 'speed' | 'type'

  // --- data collection ---
  reportingPeriod: 100,    // ticks between samples (= 5 s at dt 0.05)
  epoch: 36000,            // ticks per run/packet (= 30 min)
  detectorFracs: [0.5],    // loop-detector positions as fractions of loopLength

  // --- database (the standard vendored client, src/db.js) ---
  db: {
    transport: 'socket',
    server: 'https://research.climbinggiants.com:8888',
    mongoUrl: 'mongodb://127.0.0.1:27017',
    db: 'trafficSim',
    run: 'run',
  },
};

// Driver archetypes. IDM values follow Treiber, Hennecke & Helbing 2000 (Phys. Rev. E 62)
// and Treiber & Kesting, *Traffic Flow Dynamics* (2013) ch. 11; the spreads reflect the
// heterogeneity found by NGSIM trajectory calibration (Kesting & Treiber 2008): T ~ 1.0-2.2 s,
// a ~ 0.6-1.5 m/s^2. Each [mean, sd] is sampled per driver (sd scaled by profileVariability).
//   v0mult — desired speed as multiple of the limit    T — time headway (s)
//   a — max acceleration (m/s^2)                       b — comfortable braking (m/s^2)
//   s0 — standstill min gap (m)                        len — vehicle length (m)
//   politeness — MOBIL p                               bSafe — max braking imposed on others
//   exitPrep — m before their exit drivers start working right
// Human control loop (v0.3), each [mean, sd] per driver:
//   tReact — s between decision points; commands held open-loop in between (steering
//            intermittency 0.3-0.8 s in the literature; brake-to-unexpected 0.7-1.5 s is
//            covered by the emergency reflex, not tReact)
//   percErr — fractional σ on perceived gap (Δv gets 2×: humans read looming, not speed)
//   motorErr — σ (rad) on executed TIRE angle (wheel jitter / ~15:1 steering ratio);
//              pedal gets motorErr×20 in m/s^2
//   laneTol — m from the lane LINE the driver tolerates; inside the comfort band there
//             is NO lateral correction (satisficing lane keeping)
var ARCHETYPES = {
  aggressive: { share: 0.20, v0mult: [1.16, 0.05], T: [1.00, 0.10], a: [1.4, 0.10],
                b: [2.1, 0.15], s0: [2.0, 0.20], len: 4.8, width: 1.8, politeness: 0.10,
                bSafe: 5.0, exitPrep: 700,  truck: false,
                tReact: [0.35, 0.08], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.25, 0.08] },
  normal:     { share: 0.50, v0mult: [1.04, 0.04], T: [1.45, 0.15], a: [1.0, 0.10],
                b: [1.7, 0.15], s0: [2.5, 0.30], len: 4.8, width: 1.8, politeness: 0.35,
                bSafe: 4.0, exitPrep: 1300, truck: false,
                tReact: [0.50, 0.12], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.40, 0.10] },
  cautious:   { share: 0.20, v0mult: [0.94, 0.04], T: [1.85, 0.20], a: [0.8, 0.08],
                b: [1.4, 0.12], s0: [3.0, 0.30], len: 4.8, width: 1.8, politeness: 0.60,
                bSafe: 3.5, exitPrep: 2000, truck: false,
                tReact: [0.70, 0.15], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.55, 0.10] },
  truck:      { share: 0.10, v0mult: [0.88, 0.03], T: [1.70, 0.15], a: [0.6, 0.06],
                b: [1.2, 0.10], s0: [3.5, 0.30], len: 16,  width: 2.5, politeness: 0.40,
                bSafe: 3.5, exitPrep: 1800, truck: true,
                tReact: [0.55, 0.10], percErr: [0.07, 0.02], motorErr: [0.0003, 0.0001],
                laneTol: [0.45, 0.10] },
};

// Overrides that recover the IDEAL controller (the v0.1/v0.2 validated behavior) —
// applied by the test suites; experiments interpolate between this point and the
// archetype values above.
var IDEAL_CONTROL = { tReact: [0.05, 0], percErr: [0, 0], motorErr: [0, 0], laneTol: [1.5, 0] };

// Schema drives the auto-generated control panel (ui.js). One entry per live-tunable.
var PARAM_SCHEMA = [
  { key: 'laneCount', label: 'Lanes', min: 2, max: 4, step: 1, resets: true },
  { key: 'initialDensity', label: 'Init density (veh/km/ln)', min: 2, max: 45, step: 1, resets: true },
  { key: 'demand', label: 'Ramp demand (veh/h)', min: 0, max: 2000, step: 50 },
  { key: 'speedLimitMph', label: 'Speed limit (mph)', min: 45, max: 80, step: 5 },
  { key: 'truckFraction', label: 'Truck share', min: 0, max: 0.3, step: 0.05 },
  { key: 'updatesPerDraw', label: 'Speed (updates/frame)', min: 1, max: 60, step: 1 },
];
