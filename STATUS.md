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
- smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS (main-realm loader, 23 s / 2 min);
  runner → Server → Mongo round trip VERIFIED 2026-09-23 (scratch, dropped)
- Published: github.com/algorithm0r/Traffic-Sim; Pages at https://algorithm0r.github.io/Traffic-Sim/
- DB path VERIFIED (socket transport through the research Server on mint)
- Browser: Chris eyeballed the safety views, rotated bodies and merging 2026-09-23 —
  "looking great". Bicycle body is now the DEFAULT (suites pin 'lane' for the 1D
  controls). DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤3.5%; D2 bottleneck 1314 veh/h/ln, 0 grazes
- Phase diagram (results/phase.md): fluid to k=25 at 1.0× tReact (43 mph, 0.5 near/1000
  veh·km); breaks at k=20 at 1.3× (42 mph, 9.2); at k=12 at 2.0× (42 mph, 63). Crash rate
  ~0 at ≤1.0×; 10/1000 at k=30 × 2.0×
- Calibration (k=15, 10⁵ veh·km per variant, results/calib.md): crash 0.010 (SHRP2 0.027
  — consistent); near-crashes 0.52, evasive (≥0.5 g) 0.43 vs SHRP2 0.048 — ~9× on their
  definition, a real excess. Glance tail halves it; defaults not moved
- Human defaults (T9): 0 crash events; T10 stress: 111 crashes / 216 — rear 42, side 19,
  depart 2, secondary 12

## Branches / tags
- `main` tracks origin/main; tags v0.1-v0.4.1. Stage 11 complete + phase diagram is a
  v0.5 candidate (Chris's call)

## Open
- Near-crash rate ~9× SHRP2 at defaults (robust); the lever is the glance-duration tail —
  match the duration distribution to Klauer/SHRP2 next, not σ to the rate
- Higher shoulder-check probability RAISES near-crashes 2.4× — untraced
- PET share (28% < 1 s) vs NGSIM; lane-change rate
- Lane-change RATE uncalibrated
- Smoke ~75 s; validate ~3 min; sweep ~5 min; phase ~25 min; calib ~10 min

## Next action
Glance-duration distribution vs the naturalistic baseline; the shoulder-check anomaly
trace; the phase-diagram figure with the wave-onset boundary.

## Blockers
- none
