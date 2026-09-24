# Reaction time as a phase-transition control parameter

*Results note, 2026-09-24. Data: `phase.json` / `phase.md` (tables), `phase.html` (figure). Regenerate with `node phase.mjs --seeds 1,2,3,4,5 && node phasefig.mjs`. Model state: v0.5 plus the headway-budgeted glance default (commit bf73d0b).*

## Setup

A 3-lane, 4 km closed ring; the bicycle body with fallible perception (Stage 11); the four
human archetypes at their default attention parameters. Two things vary: the seeded
density (8 to 30 veh/km/lane) and a multiplier on every driver's reaction time, the
interval between decision points at which commands are held open-loop (0.6× to 2.0× the
archetype values of 0.35 to 0.70 s). Each cell is five seeds of 600 s. Recorded per run:
mean speed, the standard deviation of 5-s detector speeds after a 200-s warm-up (wave
onset), and near-crash and crash rates per 1000 veh·km (a near-crash is a TTC < 1.5 s
episode with a leader genuinely ahead; a crash is any contact above 3 m/s).

## Finding

The breakdown boundary runs diagonally through the grid. At normal reaction time the ring
is fluid at every density tested up to 25 veh/km/lane (43 mph, detector std 0.5 m/s,
0.23 near-crashes per 1000 veh·km); at 30 it is congested but steady. Multiplying reaction
time by 1.3 moves the breakdown to 30; by 1.6, to 16 to 20; by 2.0, to 12, and even at 8
veh/km/lane the detector std has doubled and near-crashes have appeared. The safety rates
ride the same boundary: on the fluid side, near-crashes stay at or below 0.2 per 1000
veh·km and the crash rate is zero at every cell; across it, near-crashes rise through two
orders of magnitude (to 330 at k=30 × 2.0) and crashes appear (0.1 to 2.6).

Reaction time therefore behaves as a control parameter for the flow's phase, not merely as
a safety parameter: the same density is fluid or broken depending on it, and the
transition is sharp in the multiplier (between 1.3× and 1.6× at k=20 to 25).

## The transition is metastable

In cells on the boundary, individual realizations either break down or do not. At k=16 ×
1.6 the five seeds span 17 to 55 mph and 0.7 to 33 near-crashes per 1000 veh·km; at k=12 ×
2.0, 44 to 59 mph and 6 to 95. Away from the boundary the spreads are narrow (k=25 × 2.0:
17 to 35 mph, 209 to 290). This is the expected signature of a first-order-like transition
in a finite closed system: a perturbation of sufficient size tips the ring into a jam that
then persists, and whether one occurs within 600 s is a matter of the realization. It is
also why near-crash counts have a 4 to 5× spread between independent seed sets at fixed
parameters (`calib.md`): near-crashes cluster in the realizations that break.

## Caveats

- Closed ring: the "density" is the seeded density and the breakdown, once triggered,
  cannot drain. Open boundaries (Stage 13) are needed for a capacity statement.
- 600 s per run under-samples the metastable cells; the boundary cells need longer runs
  and more seeds before the transition multiplier is quoted to better than ±0.3.
- The attention defaults are calibrated to SHRP2 rates at k=15 and normal reaction time
  (`calib.md`); the reaction-time multiplier is a scan, not a calibrated population. The
  fluid-side crash rate of exactly zero reflects 600-s runs at 1.5 to 3.5 thousand veh·km
  per cell, i.e. an upper bound of roughly 0.3 per 1000 veh·km, not a measurement of the
  0.027 reference.
- The detector-std threshold of 2 m/s for "broken" is a convention chosen to separate the
  bimodal cells; the speed and near-crash tables tell the same story without it.

## What this buys the program

The micro→macro coupling the project was built to study is now a measured object: a
boundary in (reaction time, density) with flow and safety observables on both sides. The
natural next experiments are the attention analogue (glance rate as the second control
parameter; the sweep already shows the boundary moving inward under 3× glances) and the
open-boundary version where the transition becomes a capacity drop.
