# Reaction time as a phase-transition control parameter

*Results note, revised 2026-09-24 for the NGSIM-calibrated drivers (Stage 14). Data: `phase.json` / `phase.md` (tables), `phase.html` (figure). Regenerate with `node phase.mjs --seeds 1,2,3,4,5 && node phasefig.mjs`. Model state: car-following classes calibrated to NGSIM I-80 (`ngsim-note.md`), lane keeping calibrated to on-road SDLP, glances budgeted against headway. The diagram has now been measured under three driver calibrations; how the boundary moved is below.*

## Setup

A 3-lane, 4 km closed ring; the bicycle body with fallible perception (Stage 11); the four
human archetypes at their default parameters. Two things vary: the seeded density (8 to 30
veh/km/lane) and a multiplier on every driver's reaction time, the interval between decision
points at which commands are held open-loop (0.6× to 2.0× the archetype values of 0.35 to
0.70 s). Each cell is five seeds of 600 s. Recorded per run: mean speed, the standard
deviation of 5-s detector speeds after a 200-s warm-up (wave onset), and near-crash and
crash rates per 1000 veh·km (a near-crash is a TTC < 1.5 s episode with a leader genuinely
ahead; a crash is any contact above 3 m/s).

## Finding

The breakdown boundary runs diagonally through the grid. At normal and faster reaction times
the ring is fluid through 25 veh/km/lane (43 mph, detector std 0.5 m/s) and congested but
steady at 30 (37 mph, std 0.9); across those 18 cells near-crashes stay at or below 5.6 per
1000 veh·km and one cell has a crash. At 1.3× the ring breaks at 25 (std 2.4, 12.8
near-crashes); at 1.6× from 16 to 20 upward (std 2.1 to 2.6, 8 to 23 near-crashes); at 2.0×
the detector std crosses 2 m/s even at 8. Across the boundary near-crashes rise through two
orders of magnitude (to 750 at k=30 × 2.0) and crashes reach 5 per 1000 veh·km.

Reaction time therefore behaves as a control parameter for the flow's phase, not merely as
a safety parameter: the same density is fluid or broken depending on it, and the transition
is sharp in the multiplier (between 1.0× and 1.3× at k=25; between 1.3× and 1.6× at k=20).

## The boundary's position depends on the fleet

The diagonal has held under three driver calibrations; where it sits has not:

| drivers | breaks at 1.6× reaction time | breaks at 2.0× |
|---|---|---|
| v0.5: literature car-following, unsourced wide lane keeping (SD 0.32 m) | k = 16–20 | k = 12 |
| v0.6: lane keeping calibrated to on-road SDLP (0.15 m) | k = 25 | k = 12–20 |
| Stage 14: car-following calibrated to NGSIM I-80 | k = 16–20 | k = 8–12 |

Two micro parameters move it. Lateral precision: a wandering fleet changes lanes more (drivers
near a line inherit the next lane's leader), and each change is a perturbation. And the
headway distribution: the NGSIM classes put 29% of drivers at a 0.85 s headway, and a short
headway held with a slow reaction is unstable — the classic condition that a car-following
loop is stable only when the headway comfortably exceeds the reaction delay. The sensitivity
is itself a result: a fleet's breakdown density depends on the joint distribution of reaction
times and headways, not on either alone.

## The transition is metastable

In cells on the boundary, individual realizations either break down or do not. At k=16 × 2.0
the five seeds span 15 to 50 mph; at k=20 × 1.6, 31 to 50 mph; at k=12 × 2.0 near-crashes
range from 4 to 112 per 1000 veh·km. Away from the boundary the spreads are narrow (k=25 ×
1.0: 43–44 mph). This is the signature of a first-order-like transition in a finite closed
system: a perturbation of sufficient size tips the ring into a jam that then persists, and
whether one occurs within 600 s is a matter of the realization. It is also why near-crash
counts spread 3–5× between independent seed sets at fixed parameters (`calib-note.md`).

## Caveats

- Closed ring: the "density" is the seeded density and a breakdown cannot drain. The
  open-road capacity-drop experiment (`capdrop-note.md`) is the complementary measurement.
- 600 s per run under-samples the metastable cells; the boundary cells need longer runs and
  more seeds before the transition multiplier is quoted to better than ±0.3.
- The reaction-time multiplier is a scan, not a calibrated population. The NGSIM
  calibration is of congested following (median 7 m/s); the headway classes are applied at
  highway speed on the assumption that time headway transfers.
- The detector-std threshold of 2 m/s for "broken" is a convention; several cells sit at
  2.1, and the speed and near-crash tables tell the same story without it.
