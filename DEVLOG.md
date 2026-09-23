# Traffic Sim — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-09-22 — Stage 10: one lane-change model (desire, relaxation, cooperation); merging is lane changing

**Done:** the bicycle body's ramp-specific rules (speed-match over 70% of the ramp, bSafe
schedule, `forced` flag, 250-m courtesy, taper-squeeze bookkeeping, straddler roll) are
replaced by one continuous **desire** per side, LMRS structure with the MOBIL gain kept as
the voluntary incentive (Schakel, Knoop & van Arem 2012): route desire (a lane that ends,
an exit — one function, `routeDesire`) + θ-weighted voluntary desire (MOBIL gain ×
`desirePerGain`, courtesy keyed on a neighbour's actual desire). Thresholds dFree
(acceptance with T(d) and bAccept from ROUTE desire only), dSync (signal + synchronize
with the target-lane leader), dCoop (the would-be follower treats the claimant as leader,
bounded by politeness-scaled comfort). The onramp is auxiliary lane N that ends
(`outerEdge`, `wallDist`, `laneEndAcc`); the end binds only when comfortable braking no
longer suffices (accel-lane drivers hold speed, Daamen 2010), and never for a committed
merger with clear pavement beside (the gore is paint). Relaxation: changer and new follower
accept the given headway down to T(d) and relax to their own T over τ = 25 s. Lateral
clearance replaces the strip veto (`lateralClearance`). Abort is kinematic (closing²/2gap,
the loom quantity), impossible on an ending lane (Hidas's forced regime). Gap acceptance
projects the follower's need over a 1-s reaction (`followerNeed`). DEVPLAN rewritten with
the two program goals (cleaner 2D / emergent accidents), the OTS assessment, Stages 10-13.
**Changed:** params (`lc` block), agent (Teff, desire state, width copied — trucks were
1.8 m wide since v0.2), world (bicycle section rewritten; lane body untouched), observer
(signal-based indicator), validate (D2 discharge asserted ≥ 80% of lane body instead of
report-only), DEVPLAN, STATUS. Harness: contact events counted once per pair; grazes no
longer teleport the follower (phantom rear-ends).
**State:** smoke 9/9 PASS + VALIDATION PASS @ v0.3-1-gc10a4ec-dirty (pre-commit; committed as v0.3-2-g798c7fd). T1-T3
byte-identical to HEAD (1D control intact). Rings across bodies within 1.4%. **D2 bottleneck
(seed 21): HEAD deadlocks (375 veh/h/ln, 34 merges); now 1422 veh/h/ln, 284 merges, breakdown
Δ8.4 m/s, 0 rear-ends, 1 graze** — 116% of the lane body (1230) and 85% of fleet ring
capacity (1680): a 15% capacity drop, inside the empirical 5-20% band (the lane body's is
27%). Seeds 22-24: 1416-1461, 0 collisions; human mode 40 min: 1346, 0 collisions, queue 373.
T7: aborts 1 (was 40), expiries 0, missed exits 18 (was 77), mergers 13.5 m/s on the ramp
(was 11.0). The deadlock class is gone: the fourth geometry was a merger that lost its lane
identity when squeezed across the line (laneOf read y), read zero route desire, and sat at
the pavement end; two more mechanisms were the edge clamp halving the heading component
steering AWAY from the edge, and IDM saturating at exactly −bMax so the follower that most
needed to see a body entering its lane was the one that didn't. Every fix was probe-driven
(tick traces of one merger with neighbours). **Known limitation:** bodies are unrotated
boxes at the front's y; a 16 m truck at 0.3 rad has its tail 4.7 m to the side, so in dense
jams merging trucks' tails pass through cars alongside (T7dense probe: 48 grazes, 34 stuck
at the ideal point — HEAD has 35 stuck and 275 missed exits on the same config, so not a
regression; human mode 2.2 stuck vs HEAD 50). A single box spanning both ends was tried and
made it worse (crawling cars at 17° became phantom walls). Smoke runtime 35 s (was 25 s).
Browser view UNVERIFIED this session.
**Next:** rotated body (two segments or OBB) in every geometric query — the T7dense config
is the probe. Then Stage 11: the fallible perception layer (looming accumulator, glances,
shoulder check as a glance, post-crash state, TTC/PET conflict metrics) — the layer
accidents come from. Chris to eyeball the new merging in-browser (Body toggle).


## 2026-07-11 — v0.3: the human control loop (start of "our model")
**Done:** drivers become intermittent, noisy, satisficing controllers. Four continuous
per-driver parameters (tReact / percErr / motorErr / laneTol), ideal = a point in the
space (IDEAL_CONTROL, applied by the suites — v0.1/v0.2 stay intact controls). Commands
held open-loop between decisions; steering planned over the driver's own hold horizon;
comfort-band lane keeping with hands-off inside (Chris caught that straightening heading
in the band would kill drift — load-bearing correction); margin-restoring edge
corrections; always-on emergency reflex + lateral reflex + anti-stalemate creep.
Tags: v0.1 (1D control), v0.2 (bicycle control) created this session.
**Changed:** params/agent/world, smoketest (T8/T9, IDEAL_CONTROL harness), validate
(ideal-point controls; D2 discharge demoted to report — known issue).
**State:** smoke 9/9 PASS @ HEAD. Lane wander EMERGES from mechanism: SD 0.33 m
(empirical ~0.2-0.3), max 0.72 m, in-lane; realistic 3-lane traffic collision-free at
55 mph on the reflex; lane changes ~2.8× ideal rate under wander. Calibration journey
(each failure was physics): instant-gain commands held open-loop limit-cycle; one δ
can't zero position+heading in one interval (gentle lateral horizon); hands-off isn't
heading-blind (0.5° at 29 m/s = 0.3 m/s drift); motor noise lives at the TIRE (wheel
jitter / ~15:1 steering ratio) — at milliradian scale corrections drown in their own
noise and wander becomes perception-threshold-driven, matching the human-factors
literature. KNOWN ISSUE: D2 over-capacity bottleneck (bicycle) deadlocks in some
realizations — fourth mutual-wait geometry undiagnosed; creep rule resolves most;
bounded creep-speed grazes (≤2) accepted at that config.
**Next:** fresh session on the D2 deadlock (space-time instrumentation); then the first
real experiment: sweep tReact across the fleet, measure fundamental diagram / wave
onset / crash rate — micro reaction time → macro traffic physics.

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
