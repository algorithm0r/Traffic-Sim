# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-11 (session close) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 7 `[ DONE ]` (bicycle body) / Stage 5 `[ TESTING ]` (browser visual, both bodies) /
next: "our model" — the enriched driver against both controls

## State
- TWO validated control models behind `bodyModel`: 'lane' (1D, discrete lanes) and
  'bicycle' (continuous x/y/heading, steering cascade) — same IDM/MOBIL brain.
  Smoke 7/7 PASS + VALIDATION PASS @ 7bc3df0 (2026-07-11)
- Browser view UNVERIFIED for both bodies (headless stub-render only); DB path UNVERIFIED

## Metrics (definitive run @ 7bc3df0)
- Fundamental diagram ≈1% of analytic IDM (k=5..80); capacity 1836 veh/h/ln; congested
  slope -18.0 km/h (analytic -18.1); stop-and-go waves 13 km/h upstream (empirical 15±5)
- Onramp (1D): breakdown Δ18.9 m/s, discharge 74% of fleet capacity, self-metering queue
- Embodiment head-to-head: ring flow deltas ≤1.7%; discharge 102%; lane changes 2.7 s;
  merge rate 56% of 1D; bottleneck constraint relocates (1D mainline jam ↔ 2D ramp queue)
- Collisions + sideswipes: 0 in every scenario, both bodies

## Branches
- `main`

## Open
- Stage 5 visual: open `index.html`, toggle Body lane/bicycle (Chris's eyes)
- 2D merge rate 56% of 1D — real embodiment cost or residual over-conservatism? (Stage 8)
- Merge-zone capacity drop 26% vs empirical 5-20% (1D, Stage 8)
- DB round-trip untested; abort counter conflates maneuver-aborts with claim expiries

## Next action
Chris eyeballs both bodies in-browser; then design "our model" (enriched driver) against
the two controls.

## Blockers
- none
