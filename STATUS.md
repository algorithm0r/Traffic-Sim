# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-23 (Stage 11 complete) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 11 `[ DONE ]` (fallible perception — accidents emerge) / Stage 12 `[ ACTIVE ]`
(safety validation & calibration)

## State
- Program goals (DEVPLAN, 2026-09-22): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. Both first passes landed (Stages 10, 11).
- Bicycle body: one lane-change model (desire / relaxation / cooperation; the ramp is a
  lane that ends), rotated bodies, rear-pivot bicycle with a rear-referenced cascade.
- Perception is fallible: looming-evidence reflex (gain × visual-angle-rate salience),
  off-road glances as a process (begun only when stable, wheel centred, nothing closing
  ahead), peripheral lane keeping during glances, shoulder check with a skip probability,
  post-crash obstacles, shoulder + run-off-road, TTC near-crashes, PET at lane changes,
  typed crash log. No crash rule anywhere. Ideal point = v0.4.1 behaviour exactly.
- smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS @ v0.4.1-4 (2026-09-23, pre-commit)
- Published: github.com/algorithm0r/Traffic-Sim; Pages live at
  https://algorithm0r.github.io/Traffic-Sim/
- Browser view: Chris saw the truck saw-tooth 2026-09-23 (fixed in trace); the fix and
  everything since UNVERIFIED by eye. DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤3.5%; D2 bottleneck 1314 veh/h/ln, 0 grazes
- Human defaults (T9, k=15, 300 s): 0 crash events, 2 near-crashes, 4948 glances, 69
  peripheral corrections, PET mean 1.75 s (68 changes < 1 s), 54 mph
- Sweep (per 1000 veh·km, 600 s, seed 5): near-crash rate rises with density 6/6, with
  tReact 5/6. k=15 defaults: 0.37 near, 0.37 crash (empirical crash ~0.0015 — ~100× high).
  k=25 × 1.6 tReact: COLLAPSE — 27 mph, 160 near, 2.8 crash; same density at 1.0×: 43 mph,
  0.29 near, 0 crash
- T10 stress (3× glances, 2 s mean, 60% checks): 111 crashes / 216 — rear 42, side 19,
  depart 2, secondary 12; near-crashes 279

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1. Stage 11 complete is a v0.5 candidate
  (Chris's call)

## Open
- Crash-rate magnitude ~100× empirical at default attention (scaling correct) — Stage 12
- PET-conflict share (27% of changes < 1 s) unchecked against NGSIM
- Lane-change RATE uncalibrated (T7 ~2200/10 min on 6 km × 3 lanes)
- Smoke ~75 s; validate ~3 min; sweep ~5 min

## Next action
Stage 12: the tReact × density phase diagram (multi-seed, long runs via runner.mjs, FD +
wave onset + near-crash rate) as the first paper-shaped result; then calibrate default
attention toward empirical rates without touching the ideal point.

## Blockers
- none
