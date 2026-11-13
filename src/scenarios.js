'use strict';
// Scenario presets for the browser view. Each is a set of PARAMETERS overrides applied
// on top of a fresh copy of the params.js defaults (ui.js keeps that copy), so switching
// scenarios never leaks a setting from the last one. Browser-only: the headless suites
// and experiments never load this file, and nothing here changes a model default.
//
// Every value here is one the model already supports. The geometries of 'merge' and
// 'drop' are capdrop.mjs's (Stage 13); the demands are raised so the bottleneck breaks
// down within a few simulated minutes instead of capdrop's 35-minute demand ramp.
// Timings measured headless (seed 7, 2026-11-13): rush breaks down at ~3-4 min, phantom
// within 30 s, merge at ~4.5 min, drop at ~2-4 min, zipper at ~5 min.
//
// `legs` is a rendering setting: the road is folded into rows of ~750 m, so a car is
// ~7 px long and reads as a car rather than a tick.
var SCENARIOS = [
  {
    key: 'rush', label: 'Interchanges at rush hour',
    blurb: 'A 6 km loop with three interchanges, busier than the model defaults: ' +
           'traffic flows at first, then queues form where the onramps merge.',
    set: { initialDensity: 20, demand: 1400, legs: 8 },
  },
  {
    key: 'light', label: 'Interchanges, light traffic (model defaults)',
    blurb: 'The same loop at the calibrated defaults. Traffic stays fluid. This is the ' +
           'baseline the safety rates are measured on.',
    set: { legs: 8 },
  },
  {
    key: 'phantom', label: 'Phantom jam (ring, no ramps)',
    blurb: 'A plain 3-lane ring with no ramps, dense, and drivers reacting 1.6× slower ' +
           'than calibrated. Stop-and-go waves appear with no bottleneck at all and ' +
           'travel backwards against the traffic.',
    set: { numInterchanges: 0, initialDensity: 26, tReactX: 1.6, legs: 8 },
  },
  {
    key: 'merge', label: 'Ramp merge (open road)',
    blurb: 'A straight 2-lane road: cars enter at IN, leave at OUT. One onramp feeds ' +
           '1200 veh/h into heavy mainline traffic until the merge breaks down.',
    set: { openRoad: true, loopLength: 9000, laneCount: 2, numInterchanges: 1, demand: 1200,
           upstreamDemand: 3200, detectorFracs: [2400 / 9000, 4400 / 9000], legs: 12 },
  },
  {
    key: 'drop', label: 'Lane drop, 3 → 2 (open road)',
    blurb: 'Three lanes become two at 3 km. Drivers in the ending lane have to merge; ' +
           'watch where the queue starts. Needs the 2D body.',
    set: { openRoad: true, loopLength: 9000, laneCount: 2, numInterchanges: 0, demand: 0,
           laneDropAt: 3000, upstreamDemand: 4200, detectorFracs: [2200 / 9000, 4200 / 9000],
           bodyModel: 'bicycle', legs: 12 },
  },
  {
    key: 'zipper', label: 'Lane drop with zipper cooperation (Stage 17 test)',
    blurb: 'The lane drop with the Stage 17 test variant switched on: drivers accept ' +
           'shorter gaps and the through lane yields from the signal on. It produces ' +
           'the zipper seen in real data, but costs queue discharge. Not the default model.',
    set: { openRoad: true, loopLength: 9000, laneCount: 2, numInterchanges: 0, demand: 0,
           laneDropAt: 3000, upstreamDemand: 4200, detectorFracs: [2200 / 9000, 4200 / 9000],
           bodyModel: 'bicycle', legs: 12,
           // probes/lateral.mjs and capdrop's 'sync' variant (DEVLOG 2026-09-30)
           lc: { s0MinFrac: 0.47, coop: 'lmrs', dCoop: 0.577 } },
  },
];
