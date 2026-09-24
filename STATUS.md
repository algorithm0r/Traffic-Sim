# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-24 (Stage 13 done) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 13 `[ DONE ]` (open road, lane drops, deceleration lanes; capacity drop in the
empirical band) / Stage 12 `[ ACTIVE ]` (leftovers: wander SD, PET share, lane-change rate)

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
  deltas ≤3.5%; D2 bottleneck 1314 veh/h/ln, 0 grazes
- Phase diagram (results/PHASE.md, phase.html; 5 seeds, calibrated defaults): fluid to k=25
  at 1.0× tReact; breaks at 30 at 1.3×, 16-20 at 1.6×, 12 at 2.0×. Fluid side ≤0.2 near
  /1000 veh·km, zero crashes; across it 10-330 near, 0.1-2.6 crash. Boundary cells are
  METASTABLE (17-55 mph across seeds at k=16 × 1.6)
- Calibration (results/calib.md, 2×10⁵ veh·km): crash 0.005 (SHRP2 0.027 ✓). The old
  "9× near-crash excess" was lateral conflicts miscounted; longitudinal near-crashes were
  3× SHRP2 with 4-5× realization variance. Glances budgeted against headway (new default)
  bring the hard set to evasive 0.069 vs SHRP2 0.048. Glance stats match naturalistic
- Human defaults (T9): 0 crash events; T10 stress: 111 crashes / 216 — rear 42, side 19,
  depart 2, secondary 12
- Capacity drop (results/CAPDROP.md, open road, 5 seeds): merge 1D 17.4%, merge 2D ideal
  8.9% / human 7.3%, lane drop 2D ideal 7.8% / human 16.6% (vs 5-min pre-max; the
  conservative estimator reads −2 to 8%). The 2D body breaks down earlier, not harder

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1, v0.5 (2026-09-23). Stage 13 complete is a
  v0.6 candidate (Chris's call)

## Open
- Lateral-conflict rate (0.15-0.56 per 1000 veh·km) has no empirical reference; wander SD
  0.32 vs 0.2-0.3 is the suspect
- Realization variance 4-5× between independent 10⁵ veh·km sets — quote spreads, not Poisson
- PET share (28% < 1 s) vs NGSIM; lane-change rate
- Lane-change RATE uncalibrated
- Runtimes (main realm): smoke ~40 s; validate ~2 min; sweep ~3 min; phase ~9 min;
  calib ~2 min per variant; capdrop ~30 min

## Next action
Stage 12 leftovers (wander SD toward 0.2-0.3 without overshoot; PET share vs NGSIM;
lane-change rate); more capdrop seeds; the glance-rate phase diagram.

## Blockers
- none
