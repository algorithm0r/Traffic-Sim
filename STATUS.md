# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-07-10 (session close) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
DEVPLAN Stage 5 `[ TESTING ]` (browser visual, Chris's eyes) / Stage 7 `[ PLANNED ]` (calibration)

## State
- IDM/MOBIL freeway prototype complete: loop road 1-4 lanes, interchanges (onramps w/
  Poisson demand + accel-lane merging, destination exits), 4 driver archetypes,
  stacked-leg renderer, live charts — smoke PASS + VALIDATION PASS @ 2a3838e (2026-07-10)
- Browser view UNVERIFIED (headless stub-render only); DB write path UNVERIFIED from this box

## Metrics
- Analytic IDM equilibrium err 0.0%; fundamental diagram ≈1% of analytic (k=5..80)
- Capacity 1836 veh/h/ln @ 30 veh/km; congested slope -18.4 km/h (analytic -18.1)
- Stop-and-go wave speed 13 km/h upstream (empirical 15±5)
- Onramp: breakdown Δ17 m/s, self-metering queue, discharge 74% of fleet capacity
- Collisions: 0 in every smoke + validation scenario

## Branches
- `main`

## Open
- Stage 5 visual check (open `index.html`)
- Merge-zone capacity drop 26% vs empirical 5-20% (Stage 7 calibration)
- DB round-trip untested (runner written, Server/Mongo not exercised)

## Next action
Chris opens `index.html` — then Stage 7 calibration or first experiments.

## Blockers
- none
