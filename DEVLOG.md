# Traffic Sim — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-07-10 — full prototype: IDM/MOBIL freeway, rendering, validation
**Done:** replaced the demo model end-to-end. IDM car-following (ballistic integration) +
MOBIL lane changes (keep-right bias, politeness, truck left-lane ban); interchanges with
Poisson onramp demand, acceleration-lane merging (speed-matching over the first 70%,
urgency-relaxed safety, courtesy left-changes alongside active ramps), destination exits
with planning horizon + forced gap acceptance; four literature-grounded driver archetypes;
stacked-leg renderer with live speed graph + fundamental-diagram scatter; validation suite.
**Changed:** all of `src/` (params/util/agent/world/observer/charts/datamanager/main),
`index.html`, `runner.mjs`, `smoketest.mjs`; new `validate.mjs`.
**State:** smoke PASS + VALIDATION PASS @ 2a3838e. Numbers: equilibrium err 0.0% vs analytic;
fundamental diagram within ~1% of analytic across k=5..80 veh/km, capacity 1836 veh/h/ln
@ 30 veh/km, congested slope -18.4 km/h (analytic -18.1); stop-and-go waves upstream at
13 km/h (empirical 15±5); onramp breakdown Δ17 m/s with self-metering queue, discharge 74%
of fleet ring capacity (1752 veh/h/ln ref). All scenarios collision-free. Three bugs found
by the harness, all the same disease (wrap-safe `gap()` reads overlap as free space):
mainline insertion checks, ramp end-wall ghosting, ramp-interior stacking — all now signed
geometry. Browser view is UNVERIFIED (headless stub-render check only); DB write path
UNVERIFIED from this box.
**Next:** Chris eyeballs `index.html` (Stage 5 visual); then Stage 7 calibration (merge
discharge toward empirical 80-95%, open-boundary mode).

## 2026-07-10 — scaffolded
**Done:** project scaffolded from engine v2 — vanilla-JS canvas microframework with
model/view split, the vendored standard DB client, a headless `runner.mjs`, and `smoketest.mjs`.
**Changed:** initial file tree.
**State:** runs (demo drifters model, in-browser + headless); `smoketest.mjs` passes.
**Next:** replace the demo model with the real Traffic Sim dynamics (DEVPLAN Stage 1).
