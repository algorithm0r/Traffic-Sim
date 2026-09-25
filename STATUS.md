# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-24 (Stage 14 done) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 14 `[ DONE ]` (car-following calibrated to NGSIM I-80) / Stage 15 `[ ACTIVE ]`
(safety exposure + joint attention/car-following calibration) / Stage 16 `[ PLANNED ]` (SUMO)

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
- Controls: FD ≈1% of analytic; capacity 1932 (homogeneous, was 1836) and 1698 mixed fleet;
  waves 13 km/h; ring embodiment deltas ≤1.4%; bicycle bottleneck 1527 veh/h/ln, 0 grazes
- NGSIM (results/ngsim-note.md): 877 car episodes; population gap error 21.8% (was 22.1%),
  90th pct 36% (40%), held-out the same; per-episode fits 11% (not transferable). Lane-change
  time gaps within 0.1-0.3 s of NGSIM at the median
- Lateral: SDLP 0.139 m (on-road 0.135-0.153 ✓); lane changes 0.22/veh·km (highD 0.24 ✓);
  change duration 3.1 s (NGSIM 4.0 ± 2.3)
- Safety at defaults (k=15, 4.1×10⁵ veh·km): 0 crashes; near-crashes 0.054 (SHRP2 all-roads
  0.048), all cut-in-then-brake; glances > 2 s 0.7% (naturalistic ~4% — coupling, Stage 15)
- Phase diagram (results/phase-note.md): fluid to k=25 at ≤1.0×; breaks at 25 at 1.3×,
  16-20 at 1.6×, from 8 at 2.0× — moved inward with the NGSIM headways
- Capacity drop (results/capdrop-note.md): 5.9-16.0% by case (vs 5-min pre-max)

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1, v0.5, v0.6 (2026-09-24), **v0.7** (2026-09-24:
  Stage 14, NGSIM-calibrated car-following)

## Open
- Realization variance 4-5× between independent 10⁵ veh·km sets — quote spreads, not Poisson
- Lane-change rate half of highD's (fleet speed spread differs) — recorded, not tuned
- Runtimes (main realm): smoke ~40 s; validate ~2 min; sweep ~3 min; phase ~9 min;
  calib ~2 min per variant; capdrop ~30 min

## Next action
Stage 15: calibrate attention jointly with the NGSIM car-following (the glance tail), check
the cut-in-then-brake near-crash mechanism against freeway typology, long interchange runs.
Stage 16: SUMO side-by-side on the capacity-drop experiment.

## Blockers
- none
