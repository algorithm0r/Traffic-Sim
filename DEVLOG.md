# Traffic Sim — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-07-11 — Stage 7: kinematic bicycle body, the embodiment control
**Done:** second body model behind a switch (`bodyModel: 'lane' | 'bicycle'`) — same
IDM/MOBIL brain, executed through continuous (x, y, heading) with a steering cascade
(highway-env architecture). Maneuvers have a lifecycle (initiate / monitor / abort /
expire); ramps end in a geometric taper that squeezes unmerged vehicles into the lane;
renderer draws true lateral position + heading with turn signals; validation gains
experiment D (embodiment head-to-head). Also: 2D-models literature survey committed
(NOTES-2d-models.md).
**Changed:** params/agent/world/observer/main/index, smoketest (T5-T7 + render),
validate (D), NOTES-2d-models.md.
**State:** smoke 7/7 PASS + VALIDATION PASS @ 7bc3df0. Head-to-head: ring flow deltas
+1.7%/+0.2%/+0.3% (k=12/25/40); changes avg 2.7 s; discharge 1305 vs 1281 veh/h/ln
(102%); merge rate 202 vs 360 — geometric merging is expensive, and the bottleneck
constraint RELOCATES: 1D jams the mainline (Δ18.9 m/s), 2D meters the ramp (queue 245,
mainline fluid). All scenarios collision- and sideswipe-free.
**The debugging log IS a finding for the micro↔macro program** — every 2D failure was a
missing real-driver mechanism the 1D body had defined away: (1) taper geometry (an
end-wall + IDM's s0 parked unmerged vehicles as permanent corks); (2) signal reading
(mergers invisible to followers for their first second → accept-abort thrash); claims
must expire (10 s) and bind only comfortable yields ≤2 m/s² within 120 m (unbounded
claims built phantom walls → closed-loop gridlock); (3) shoulder check (bodies alongside
are invisible to front-ordered scans → 93 sideswipes) plus zipper drop-back (holding
lateral in lockstep re-gridlocked); (4) pull-forward asymmetry (only conflicts AHEAD
stop a car — freezing for a body behind created a two-vehicle mutual wait that froze
8 km of loop); (5) min-REAR-gap leader election (a near car's front masked a truck's
tail at zero gap); (6) mirror check on the squeeze (don't descend ahead of a fast
approach). Also fixed: seeding computed start speeds from nominal spacing, not the
actual leader's length — cars spawned 10 m/s too fast behind trucks (the k=40
"collisions" were this artifact).
**Next:** Chris eyeballs both bodies in-browser (Body toggle button); then "our model"
— the enriched driver (reaction time, perception noise, persistent intentions,
negotiation) built against BOTH controls, per the micro↔macro research design.

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
