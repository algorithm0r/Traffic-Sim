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
  decelLaneLength: 0,      // m of deceleration lane before each exit gore (bicycle body); 0 = none,
                           // exiting drivers leave from the right lane at speed (the v0.4 control)
  exitSpeed: 15,           // m/s offramp design speed an exiting driver slows to by the gore

  // --- open-road mode (Stage 13) ---
  // false: the closed loop. true: the same road opened at x=0 — vehicles enter at the
  // upstream boundary at `upstreamDemand` veh/h (all lanes together) and leave where the
  // road ends, openDeadZone m short of the wrap point. That void is longer than any scan
  // (400 m), so no vehicle sees across the boundary and the wrap-aware neighbour code is
  // unchanged. Capacity-drop experiments need this: a closed ring cannot drain a jam.
  openRoad: false,
  upstreamDemand: 3000,    // veh/h entering at x=0, all lanes (open road only)
  openDeadZone: 600,       // m of void before the wrap point (> the longest scan)
  laneDropAt: null,        // m, open road + bicycle body: an extra rightmost lane runs from the
                           // entrance and ENDS here (a through lane that ends — Stage 10's
                           // lane-that-ends geometry; laneCount counts the lanes that continue)

  // --- body model: how decisions become motion ---
  // 'lane'    — the validated 1D control: continuous x + discrete lane, changes teleport
  // 'bicycle' — kinematic bicycle body: continuous (x, y, heading), IDM+MOBIL decisions
  //             executed via a steering cascade (highway-env architecture). Same brain,
  //             different embodiment — the whole point is the controlled comparison.
  bodyModel: 'bicycle',    // default since 2026-09-23; the suites pin 'lane' for the 1D controls
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
  idealDrivers: false,     // true = every driver at IDEAL_CONTROL (the v0.2 control) — browser toggle
  tReactX: 1,              // live multiplier on archetype reaction time (browser slider; new drivers)
  glanceX: 1,              // live multiplier on archetype glance rate (browser slider; new drivers)
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

  // --- lane-change desire (Stage 10): LMRS structure, MOBIL brain ---
  // Every lateral decision of the bicycle body runs through one continuous desire per
  // side (Schakel, Knoop & van Arem 2012). Route desire (a lane that ends, an exit) and
  // voluntary desire (the MOBIL gain) sum; thresholds gate gap acceptance, signalling +
  // synchronization, and cooperation by the would-be follower. The ramp is a lane that
  // ends; merging is lane changing.
  lc: {
    dFree: 0.365,          // desire above which a change is attempted (gap acceptance)
    dSync: 0.577,          // signal on; synchronize speed with the target-lane leader
    dCoop: 0.788,          // the target-lane follower cooperates (opens a gap)
    desirePerGain: 3.65,   // desire per m/s^2 of MOBIL gain: 0.1 m/s^2 (classic threshold) -> dFree
    x0: 295,               // m, route look-ahead per required change for a VISIBLE lane end (LMRS)
    t0: 43,                // s, time-based route look-ahead per required change (LMRS)
    tMinFrac: 0.47,        // accepted headway at full desire as a fraction of T (LMRS 0.56/1.2)
    tau: 25,               // s, relaxation of the accepted headway back to the driver's own T
    bAcceptMax: 8,         // m/s^2 imposed on the new follower at full (forced) desire
    followerReaction: 1.0, // s the new follower is assumed to coast before reacting to me
    courtesy: 0.35,        // desire to vacate a lane per unit of a neighbour's desire for it
                           // (sub-threshold alone: it tips a near-neutral driver, and never
                           // itself triggers claims — at 0.6 a 2-lane jam chain-reacted)
    coopRange: 120,        // m, a signal binds followers only within this range
    signalExpire: 10,      // s, a maneuver that cannot complete is abandoned
    latClearance: 0.4,     // m, lateral clearance kept from a body alongside
    taperLen: 35,          // m over which an ending lane's pavement edge closes
  },

  // --- attention & perception (Stage 11): the layer accidents come from ---
  // Nothing here is a crash rule. Ground truth leaves the driver: the emergency brake
  // is evidence accumulation on perceived looming (Markkula et al. 2016), eyes leave
  // the road in glances (SHRP2 / Klauer et al.), the shoulder check can be skipped.
  // Crashes are physical contacts that follow from those failure modes.
  attention: {
    loomLeak: 1.0,         // 1/s, looming evidence decays when the danger signal stops
    loomRef: 0.02,         // rad/s of visual-angle rate at which evidence arrives at unit rate
    glanceSigma: 0.5,      // lognormal σ of off-road glance duration
    demandGain: 3.0,       // glance suppression per unit inverse-TTC (Fuller: task demand)
    nearCrashTTC: 1.5,     // s, a near-crash event begins below this time-to-collision ...
    nearCrashExit: 2.5,    // ... and ends above this (hysteresis)
    evasiveDecel: 4.9,     // m/s² (0.5 g): a near-crash with braking this hard is SHRP2's definition
    crashSpeed: 3.0,       // m/s, contact with either body faster than this is a crash
    incidentClear: 120,    // s a crashed vehicle sits as an obstacle before it is cleared
    departSpeed: 8,        // m/s, leaving the pavement above this is a run-off-road crash
    shoulder: 1.5,         // m of shoulder beyond each pavement edge a body may straddle
    periphTol: 0.15,       // m from the lane line at which peripheral vision notices the body's edge
    signalAware: true,     // no glance begins while a vehicle within 80 m ahead or 30 m behind signals
                           // into my lane — a merging neighbour is driving demand (Tivesten & Dozza:
                           // glances adapt to demand). Adopted 2026-09-24 (Stage 15): on the interchange
                           // loop, paired seeds, crash events 45→31 (k=8) and 45→27 (k=20)
    glanceHeadwayFrac: 0.5, // a glance is capped at this fraction of the time headway (Tivesten &
                           // Dozza 2014: drivers shorten glances at short headways). Adopted
                           // 2026-09-23: on the same 25 seeds it cut near-crashes 27 → 8 and
                           // lateral conflicts 3.8×, landing on SHRP2's rate; Infinity = no cap
    petConflict: 1.0,      // s, post-encroachment time below which a lane change is a conflict
  },

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
  colorMode: 'speed',      // 'speed' | 'type' | 'safety' (TTC; eyes-off marked)

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

// Driver archetypes. Car-following means (T, s0, a, b) and the car shares are CALIBRATED to
// NGSIM I-80 trajectories (Stage 14, 2026-09-24; tools/ngsim_classes.py, results/
// ngsim-classes-fixb.json): three car classes and trucks, each one IDM parameter set fitted
// jointly over the car-following episodes it explains best (hard-assignment EM, 877 car and
// 49 truck episodes), bounds kept plausible at highway speed. NOT fitted: v0 (the congested
// data never approach free speed) and b — left free, b ran to its 0.8 bound, fitting no
// better than with b fixed (21.8% vs 21.8% median gap error), i.e. unidentifiable here; and
// at highway speed that small b made cut-in followers brake hard (near-crashes 3.5×). b is
// held at the literature values. Within-class spreads (sd) are the literature ones. Previously: literature ranges (Treiber, Hennecke &
// Helbing 2000; Treiber & Kesting 2013) with assumed 20/50/20 shares. Each [mean, sd] is
// sampled per driver (sd scaled by profileVariability).
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
//             is NO lateral correction (satisficing lane keeping). Lane-position SD ≈ the
//             band's half-width / √3. Calibrated 2026-09-24 (+0.35 m on every archetype)
//             to the standardised on-road highway test: SDLP 13.5-15.3 cm for sober
//             drivers over 10-100 km (probes/lateral.mjs: 0.147 m; was 0.32)
// Attention & perception (Stage 11), each [mean, sd] per driver:
//   loomGain — 1/s of looming evidence per unit of danger above the emergency threshold
//              (brake onset 0.2-1 s after onset at realistic values; ∞ = same-tick reflex)
//   glanceRate — off-road glances per minute (naturalistic ~4-8; mirrors, instruments)
//   glanceMean — s mean glance duration (SHRP2: >2 s is the risky tail)
//   checkProb — probability the shoulder is checked before a lateral move
var ARCHETYPES = {
  aggressive: { share: 0.287, v0mult: [1.16, 0.05], T: [0.85, 0.10], a: [1.45, 0.10],
                b: [2.1, 0.15], s0: [1.84, 0.20], len: 4.8, width: 1.8, politeness: 0.10,
                bSafe: 5.0, exitPrep: 700,  truck: false,
                tReact: [0.35, 0.08], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.60, 0.08],
                loomGain: [4.0, 1.0], glanceRate: [8, 2], glanceMean: [0.9, 0.2], checkProb: [0.95, 0.02] },
  normal:     { share: 0.382, v0mult: [1.04, 0.04], T: [1.39, 0.15], a: [1.27, 0.10],
                b: [1.7, 0.15], s0: [1.95, 0.30], len: 4.8, width: 1.8, politeness: 0.35,
                bSafe: 4.0, exitPrep: 1300, truck: false,
                tReact: [0.50, 0.12], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.75, 0.10],
                loomGain: [3.0, 0.8], glanceRate: [6, 1.5], glanceMean: [0.8, 0.2], checkProb: [0.98, 0.01] },
  cautious:   { share: 0.331, v0mult: [0.94, 0.04], T: [2.05, 0.20], a: [0.82, 0.08],
                b: [1.4, 0.12], s0: [2.38, 0.30], len: 4.8, width: 1.8, politeness: 0.60,
                bSafe: 3.5, exitPrep: 2000, truck: false,
                tReact: [0.70, 0.15], percErr: [0.08, 0.02], motorErr: [0.0004, 0.00015],
                laneTol: [0.90, 0.10],
                loomGain: [2.5, 0.6], glanceRate: [4, 1], glanceMean: [0.7, 0.15], checkProb: [0.99, 0.01] },
  truck:      { share: 0.10, v0mult: [0.88, 0.03], T: [1.48, 0.15], a: [0.98, 0.06],
                b: [1.2, 0.10], s0: [2.97, 0.30], len: 16,  width: 2.5, politeness: 0.40,
                bSafe: 3.5, exitPrep: 1800, truck: true,
                tReact: [0.55, 0.10], percErr: [0.07, 0.02], motorErr: [0.0003, 0.0001],
                laneTol: [0.80, 0.10],
                loomGain: [3.0, 0.8], glanceRate: [5, 1.5], glanceMean: [0.8, 0.2], checkProb: [0.97, 0.02] },
};

// Overrides that recover the IDEAL controller (the v0.1/v0.2 validated behavior) —
// applied by the test suites; experiments interpolate between this point and the
// archetype values above.
// (attention values are scalars: a scalar draws no random number, which keeps the
// ideal-point control suites byte-identical to v0.4)
var IDEAL_CONTROL = { tReact: [0.05, 0], percErr: [0, 0], motorErr: [0, 0], laneTol: [1.5, 0],
                      loomGain: 1e6, glanceRate: 0, glanceMean: 0.5, checkProb: 1 };

// Schema drives the auto-generated control panel (ui.js). One entry per live-tunable.
var PARAM_SCHEMA = [
  { key: 'laneCount', label: 'Lanes', min: 2, max: 4, step: 1, resets: true },
  { key: 'initialDensity', label: 'Init density (veh/km/ln)', min: 2, max: 45, step: 1, resets: true },
  { key: 'demand', label: 'Ramp demand (veh/h)', min: 0, max: 2000, step: 50 },
  { key: 'speedLimitMph', label: 'Speed limit (mph)', min: 45, max: 80, step: 5 },
  { key: 'truckFraction', label: 'Truck share', min: 0, max: 0.3, step: 0.05 },
  { key: 'tReactX', label: 'Reaction time ×', min: 0.5, max: 2.5, step: 0.1, resets: true },
  { key: 'glanceX', label: 'Glance rate ×', min: 0, max: 5, step: 0.5, resets: true },
  { key: 'updatesPerDraw', label: 'Speed (updates/frame)', min: 1, max: 60, step: 1 },
];
