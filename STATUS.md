# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-23 (Stage 11 first pass) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 10 `[ DONE ]` (one lane-change model; rotated bodies, v0.4.1) / Stage 11 `[ ACTIVE ]`
(fallible perception — accidents emerge; first pass landed, scaling check + peripheral
lane awareness + PET pending)

## State
- Program goals (DEVPLAN, 2026-09-22): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. OpenTrafficSim assessed: borrow structure, not substrate.
- Bicycle body: ONE lane-change model (desire / relaxation / cooperation; the ramp is a
  lane that ends), rotated bodies (segments along the heading), rear-pivot bicycle.
- Perception is fallible (Stage 11): looming-evidence reflex with per-driver gain, off-road
  glances as a process (begun only when stable, wheel centred), shoulder check with a skip
  probability, post-crash obstacles, shoulder + run-off-road, near-crash (TTC) metric,
  crash log by type. No crash rule anywhere. Ideal point = old behaviour exactly.
- smoke 10/10 PASS + VALIDATION PASS @ v0.4.1-1-g564da88 (2026-09-23); T1-T7
  byte-identical to v0.4.1 — the 1D control and the ideal-point 2D controls are untouched.
- Published: github.com/algorithm0r/Traffic-Sim (public); Pages live at
  https://algorithm0r.github.io/Traffic-Sim/ (About link).
- Browser view UNVERIFIED since 2026-07-12; DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤2.8%; D2 bottleneck 1410 veh/h/ln, 332 merges, 0 rear-ends, 1 crawl graze
- Human defaults (T9: 3 lanes, k=15, 300 s): 0 crashes, 0 near-crashes, 4773 glances,
  54.6 mph. 600-s probe: 1 departure ≈ 4×10⁻⁴ per veh·km (empirical ~10⁻⁶ — uncalibrated)
- Elevated inattention (T10: 3× glances, 2 s mean, 60% shoulder checks, k=18, 600 s):
  164 crashes / 216 vehicles — rear-end 60, sideswipe 28, departure 8, secondary 18;
  89 while glancing; near-crashes 287 (4.8 per rear-end)
- T8 wander SD 0.337 m, max excursion 1.36 m (long-glance tail; centre stays in lane)

## Branches / tags
- `main` tracks origin/main; tags v0.1 (1D), v0.2 (bicycle), v0.3 (human loop),
  v0.4 (Stage 10), v0.4.1 (rotated bodies). Stage 11 not tagged (first pass; Chris's call)

## Open
- Crash and near-crash rates are orders of magnitude above empirical at the placeholder
  attention parameters — Stage 12 calibration; the missing mechanism is peripheral lane
  awareness during glances
- Near-crash scaling with density / tReact (Stage 11 done-when, third clause) untested
- PET for crossing paths not implemented
- Lane-change RATE uncalibrated (T7 ~2200/10 min on 6 km × 3 lanes)
- Chris to eyeball merging, rotated bodies, and crashes (T10-like settings) on the Pages site
- Smoke runtime ~70 s (T10 added)

## Next action
Stage 11 remainder: near-crash scaling sweep (density × tReact × glance rate, via
runner.mjs which now carries safety stats), peripheral lane keeping during glances, PET.
Then Stage 12 calibration against crash-type shares and SHRP2 near-crash:crash ratios.

## Blockers
- none
