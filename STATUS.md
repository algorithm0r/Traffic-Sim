# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-24 (Stage 12 cleanup) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 13 `[ DONE ]` (open road, lane drops, deceleration lanes; capacity drop in band) /
Stage 12 `[ ACTIVE ]` — calibration closed except crash-type proportions (needs a sourced
freeway reference and far more exposure)

## State
- Program goals (DEVPLAN, 2026-09-22): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. Both landed (Stages 10, 11); Stage 12 is measuring them.
- Bicycle body: one lane-change model, rotated bodies, rear-pivot bicycle with a
  rear-referenced cascade. Perception fallible: looming-evidence reflex, glances as a
  process, peripheral lane keeping, shoulder-check skips, post-crash obstacles, TTC and
  PET metrics. No crash rule anywhere. Ideal point = v0.4.1 behaviour exactly.
- Browser: safety panel (rates vs SHRP2, PET, crash mix), near-crash graph, safety colour
  mode, reaction-time × and glance-rate × sliders, Drivers human/ideal toggle.
- smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS (main-realm loader, 23 s / 2 min);
  runner → Server → Mongo round trip VERIFIED 2026-09-23 (scratch, dropped)
- Published: github.com/algorithm0r/Traffic-Sim; Pages at https://algorithm0r.github.io/Traffic-Sim/
- DB path VERIFIED (socket transport through the research Server on mint)
- Browser: Chris eyeballed the safety views, rotated bodies and merging 2026-09-23 —
  "looking great", and the phase figure 2026-09-24 ("really cool"). Bicycle body is the
  DEFAULT (suites pin 'lane' for the 1D controls)
- Open road (`openRoad`) for both bodies and lane drops (`laneDropAt`, bicycle); trucks'
  heading capped by length (the open-road merge exposed cab overshoot at the ideal point)

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤3.5%; D2 bottleneck 1302 veh/h/ln, 0 grazes
- Lateral calibration (probes/lateral.mjs): SDLP 0.147 m vs on-road test 0.135-0.153 ✓
  (was 0.32, unsourced); change duration 3.2 s vs NGSIM 4.0 ± 2.3 ✓; post-change headway
  1.8 s mean vs highD peak 1 s ✓; lane changes 0.13/veh·km vs highD 0.24 (fleet spread)
- Safety at calibrated defaults (results/calib-note.md, 2×10⁵ veh·km, k=15): 0 crashes,
  near-crashes 0.010, lateral conflicts 0 — below SHRP2 all-roads (0.027 / 0.048)
- Phase diagram (results/phase-note.md): fluid to k=25 at ≤1.3×; breaks at 25 at 1.6×,
  from 12 at 2.0×. Calibrated lane keeping moved the slow-end boundary outward.
  Boundary cells METASTABLE (8-34 mph across seeds at k=25 × 2.0)
- Capacity drop (results/capdrop-note.md, 5 seeds): merge 1D 17.4%, 2D ideal 8.9%, 2D
  human 10.8%; lane drop 2D ideal 7.8%, human 20.0% (vs 5-min pre-max; conservative
  estimator 1-11%). Humans raise the drop at both bottlenecks

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1, v0.5 (2026-09-23). Stage 13 complete is a
  v0.6 candidate (Chris's call)

## Open
- Realization variance 4-5× between independent 10⁵ veh·km sets — quote spreads, not Poisson
- Lane-change rate half of highD's (fleet speed spread differs) — recorded, not tuned
- Runtimes (main realm): smoke ~40 s; validate ~2 min; sweep ~3 min; phase ~9 min;
  calib ~2 min per variant; capdrop ~30 min

## Next action
Crash-type proportions need a sourced freeway reference and interchange runs at ≥10⁶
veh·km (runner.mjs overnight). Otherwise: more capdrop seeds, the glance-rate phase
diagram, the stochastic-breakdown curve.

## Blockers
- none
