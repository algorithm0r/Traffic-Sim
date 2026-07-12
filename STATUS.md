# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-11 (v0.3 close) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 9 `[ DONE ]` (human control loop, v0.3) / Stage 8 `[ PLANNED ]` (D2 deadlock + calibration)

## State
- THREE model layers: v0.1 lane body (1D control), v0.2 bicycle body (2D control), v0.3
  human control loop (tReact / percErr / motorErr / laneTol + reflexes) — ideal point
  recovers the controls; suites enforce it. Smoke 9/9 PASS @ HEAD (2026-07-11)
- Lane wander EMERGES from mechanism: SD 0.33 m, max 0.72 m, in-lane, collision-free
- Browser view UNVERIFIED (both bodies, wander); DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤2.5%; bottleneck discharge 103% (creep rule resolved the frequent deadlocks)
- Human loop: wander SD 0.33 m; realistic 3-lane traffic 55 mph collision-free;
  lane-change rate ~2.8× ideal under wander

## Branches / tags
- `main`; tags v0.1 (1D), v0.2 (bicycle), v0.3 pending final validation line

## Open
- KNOWN ISSUE: D2 over-capacity bottleneck (bicycle) deadlocks stochastically — 4th
  mutual-wait geometry undiagnosed; discharge check report-only (DEVPLAN Stage 8)
- Browser visual check (Body toggle; wander is visible at defaults)
- First experiment ready: tReact sweep → FD / wave onset / crash rate

## Next action
Fresh session: D2 deadlock instrumentation. Then the tReact sweep experiment.

## Blockers
- none
