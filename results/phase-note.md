# Reaction time as a phase-transition control parameter

*Results note, revised 2026-09-24. Data: `phase.json` / `phase.md` (tables), `phase.html` (figure). Regenerate with `node phase.mjs --seeds 1,2,3,4,5 && node phasefig.mjs`. Model state: the lane-keeping comfort band calibrated to on-road SDLP (lane-position SD 0.15 m) and glances budgeted against headway. The first version of this note used an unsourced, wider band (SD 0.32 m); how that changed the result is below.*

## Setup

A 3-lane, 4 km closed ring; the bicycle body with fallible perception (Stage 11); the four
human archetypes at their default attention and lane-keeping parameters. Two things vary:
the seeded density (8 to 30 veh/km/lane) and a multiplier on every driver's reaction time,
the interval between decision points at which commands are held open-loop (0.6× to 2.0×
the archetype values of 0.35 to 0.70 s). Each cell is five seeds of 600 s. Recorded per
run: mean speed, the standard deviation of 5-s detector speeds after a 200-s warm-up (wave
onset), and near-crash and crash rates per 1000 veh·km (a near-crash is a TTC < 1.5 s
episode with a leader genuinely ahead; a crash is any contact above 3 m/s).

## Finding

The breakdown boundary runs diagonally through the grid. At normal and faster reaction
times the ring is fluid through 25 veh/km/lane (43 mph, detector std 0.5 m/s, 0.17
near-crashes per 1000 veh·km) and congested but steady at 30. At 1.3× it is still wave-free
by the 2 m/s criterion, but k=30 slows to 31 mph with 13.5 near-crashes. At 1.6× the ring
breaks at 25 (37 mph, std 4.0); at 2.0× it breaks from 12 upward, with 8 and 16 just
under the threshold (std 1.8 and 1.9, near-crashes 10 to 17). The safety rates ride the
same boundary: at or below 1.3× no cell below k=30 has a crash and near-crashes stay under
3.1; across it near-crashes rise through two orders of magnitude (to 315 at k=30 × 2.0)
and crashes appear (0.1 to 2.6).

Reaction time therefore behaves as a control parameter for the flow's phase, not merely as
a safety parameter: the same density is fluid or broken depending on it, and the transition
is sharp in the multiplier (between 1.3× and 1.6× at k=25; between 1.6× and 2.0× at k=20).

## Lane-keeping precision moves the boundary

Calibrating the comfort band to on-road SDLP (lane-position SD 0.32 → 0.15 m) moved the
boundary outward at the slow end: at 1.6× from k=16–20 to k=25, and at 2.0× from a clean
break at 12 to a borderline one from 12 to 20. Normal reaction times were unaffected. The
wandering fleet broke earlier because drivers near a lane line inherit the neighbouring
lane's leader and change lanes more often (the v0.3 finding: 2.8× the ideal rate), and each
change is a perturbation. Lateral precision is a second micro parameter with a macro effect.

## The transition is metastable

In cells on the boundary, individual realizations either break down or do not. At k=25 ×
2.0 the five seeds span 8 to 34 mph; at k=20 × 2.0, 30 to 46 mph; at k=8 × 2.0 near-crashes
range from 0 to 40 per 1000 veh·km across seeds. Away from the boundary the spreads are
narrow (k=25 × 1.0: 43 mph in every seed). This is the signature of a first-order-like
transition in a finite closed system: a perturbation of sufficient size tips the ring into a
jam that then persists, and whether one occurs within 600 s is a matter of the realization.
It is also why near-crash counts spread 4 to 5× between independent seed sets at fixed
parameters (`calib-note.md`): near-crashes cluster in the realizations that break.

## Caveats

- Closed ring: the "density" is the seeded density and the breakdown, once triggered,
  cannot drain. The open-road capacity-drop experiment (`capdrop-note.md`) is the
  complementary measurement.
- 600 s per run under-samples the metastable cells; the boundary cells need longer runs
  and more seeds before the transition multiplier is quoted to better than ±0.3.
- The reaction-time multiplier is a scan, not a calibrated population. The fluid-side crash
  rate of exactly zero reflects 600-s runs at 1.5 to 3.5 thousand veh·km per cell, an upper
  bound of roughly 0.3 per 1000 veh·km, not a measurement.
- The detector-std threshold of 2 m/s for "broken" is a convention; cells at 1.8 to 1.9 sit
  on it, and the speed and near-crash tables tell the same story without it.

## What this buys the program

The micro→macro coupling the project was built to study is a measured object: a boundary
in (reaction time, density) with flow and safety observables on both sides, and a second
micro parameter, lateral precision, that moves it. The natural next experiments are the
glance-rate analogue (the sweep shows the boundary moving inward under 3× glances: k=15 ×
1.6 collapses to 17 mph) and the open-road version where the transition becomes a capacity
drop.
