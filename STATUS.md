# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-25 (Stage 15 done) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 15 `[ DONE ]` (safety exposure by traffic regime; signal-aware glances) / Stage 16
`[ PLANNED ]` (SUMO) / Stage 17 `[ PLANNED ]` (merge and weaving safety — the open finding)

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
- Controls: FD ≈1% of analytic; capacity 1932 (homogeneous) and 1698 mixed fleet; waves
  13 km/h; bicycle bottleneck ≥80% of lane body; all suites PASS
- NGSIM (results/ngsim-note.md): population gap error 21.8% (was 22.1%), 90th pct 36% (40%),
  held-out the same; lane-change time gaps within 0.1-0.3 s of NGSIM at the median
- Lateral: SDLP 0.139-0.147 m ✓; lane changes 0.22/veh·km (highD 0.24) ✓; duration 3.1 s
- Plain ring k=15, 4.1×10⁵ veh·km: 0 crashes, near-crashes 0.025 (SHRP2 all-roads 0.048)
- Interchange exposure (results/exposure-note.md, 4.7 M veh·km): 0.040 crashes per 1000
  veh·km; rear-end share 24% → 42-50% into congestion (Golob's direction) but lane-change
  involved 74-92% everywhere (Golob: rear-ends prevail in congestion) — Stage 17
- Phase diagram (results/phase-note.md): steady to k=30 at ≤1.0×; breaks at 30 at 1.3×, 25
  at 1.6×, from 16 at 2.0×. Position depends on headways, lateral precision and attention
- Capacity drop (results/capdrop-note.md): 10.9-13.9% in all five cases (vs 5-min pre-max)

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1, v0.5, v0.6 (2026-09-24), **v0.7** (2026-09-24:
  Stage 14, NGSIM-calibrated car-following)

## Open
- Realization variance 4-5× between independent 10⁵ veh·km sets — quote spreads, not Poisson
- Lane-change rate half of highD's (fleet speed spread differs) — recorded, not tuned
- Runtimes (main realm): smoke ~40 s; validate ~2 min; sweep ~3 min; phase ~9 min;
  calib ~2 min per variant; capdrop ~30 min

## Next action
Stage 17: merge and weaving safety (empirical onramp merge behaviour; mainline anticipation;
crash typing). Stage 16: SUMO side by side. Blocked item: a manual-driving glance-duration
reference for the attention tail.

## Blockers
- none
