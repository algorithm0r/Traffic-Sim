# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-23 (Stage 12 first pass) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 11 `[ DONE ]` (fallible perception — accidents emerge) / Stage 12 `[ ACTIVE ]`
(safety validation & calibration: phase diagram done, calibration grounded, long-exposure
runs and the figure pending)

## State
- Program goals (DEVPLAN, 2026-09-22): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. Both landed (Stages 10, 11); Stage 12 is measuring them.
- Bicycle body: one lane-change model, rotated bodies, rear-pivot bicycle with a
  rear-referenced cascade. Perception fallible: looming-evidence reflex, glances as a
  process, peripheral lane keeping, shoulder-check skips, post-crash obstacles, TTC and
  PET metrics. No crash rule anywhere. Ideal point = v0.4.1 behaviour exactly.
- Browser: safety panel (rates vs SHRP2, PET, crash mix), near-crash graph, safety colour
  mode, reaction-time × and glance-rate × sliders, Drivers human/ideal toggle.
- smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS @ v0.4.1-6-g43e9462 (2026-09-23)
- Published: github.com/algorithm0r/Traffic-Sim; Pages at https://algorithm0r.github.io/Traffic-Sim/
- Browser view UNVERIFIED by eye since the truck fix (Playwright cannot launch here);
  DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤3.5%; D2 bottleneck 1314 veh/h/ln, 0 grazes
- Phase diagram (results/phase.md): fluid to k=25 at 1.0× tReact (43 mph, 0.5 near/1000
  veh·km); breaks at k=20 at 1.3× (42 mph, 9.2); at k=12 at 2.0× (42 mph, 63). Crash rate
  ~0 at ≤1.0×; 10/1000 at k=30 × 2.0×
- Calibration (k=15, 12,000 veh·km): 0 crashes (SHRP2 0.027 — consistent); near-crashes
  0.66 (SHRP2 0.048 — ~14×, but 2-3 events). Glance tail is the only lever that registers
- Human defaults (T9): 0 crash events; T10 stress: 111 crashes / 216 — rear 42, side 19,
  depart 2, secondary 12

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1. Stage 11 complete + phase diagram is a
  v0.5 candidate (Chris's call)

## Open
- Near-crash rate ~14× SHRP2 at defaults — needs ≥10⁵ veh·km per setting before tuning
- Glance-duration distribution vs Klauer/SHRP2 (share > 2 s); PET share vs NGSIM
- Lane-change RATE uncalibrated
- Smoke ~75 s; validate ~3 min; sweep ~5 min; phase ~25 min; calib ~10 min

## Next action
Long-exposure attention runs via runner.mjs (overnight); the phase-diagram figure with
the wave-onset boundary; Chris eyeballs the safety views.

## Blockers
- none
