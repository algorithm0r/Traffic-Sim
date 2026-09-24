# Traffic Sim — DEVLOG
Newest entry on top. **Append only — never edit past entries.**

<!-- append new entries above this line -->

## 2026-09-24 — Stage 13 done: the capacity drop lands in the empirical band

**Done:** capdrop rerun on the corrected model (5 cases × 5 seeds, 48 min): every run broke
down, none stalled. Drop vs the 5-min pre-breakdown max (literature style) / vs the 10-min
pre-breakdown mean (conservative): merge 1D ideal 17.4% / 7.7%; merge bicycle ideal 8.9% /
0.8%; merge bicycle human 7.3% / −2.1%; lane drop bicycle ideal 7.8% / 1.3%; lane drop
bicycle human 16.6% / 7.7%. Every case mean in the 5-20% band on the literature measure;
queue discharge 83-93% of pre-breakdown flow. Written up in results/CAPDROP.md.
**Findings:** the 2D body breaks down EARLIER, not harder — its queue discharge matches the
1D body's, but merge disturbances (slow trucks off the acceleration lane, time-extended lane
changes) trigger breakdown at lower flow; the stochastic-breakdown picture. Human drivers
lower the discharge (lane drop: −150 veh/h/ln, drop 7.8% → 16.6%) — reaction time and
relaxation, the mechanisms the capacity-drop literature names. Seed spread is wide
(−2% to 27%), as the empirical site-to-site range is.
**Changed:** results/capdrop.{md,json} (superseding the first run), results/CAPDROP.md,
DEVPLAN (Stage 13 DONE), STATUS, README.
**State:** smoke 12/12 + VALIDATION PASS @ 50455c2; capdrop as above.
**Next:** Stage 12 leftovers (wander SD, PET share, lane-change rate); more seeds on the
capdrop boundary; the glance-rate phase diagram; a v0.6 tag is Chris's call.


## 2026-09-24 — capdrop's first full run was not a result: a lane-drop gridlock and a wall bug

**Done:** the first 5-case × 5-seed capacity-drop run read 35-46% at the lane drop and
negative drops at the bicycle merge. The minute series (not the summary) showed why:
lane-drop seed 1 had NOTHING cross either detector for 13 minutes from minute 52 (the
discharge average had silently excluded those empty bins), and the bicycle merge's
downstream flow collapsed to 450 veh/h/ln in free flow. Two mechanisms, both traced with
probes (probes/dropjam.mjs, probes/mergeflicker.mjs):
(1) A new mutual wait for long bodies: a truck stopped at a lane end with its cab angled
0.7 m into the next lane (a stopped rear-pivot body cannot straighten), and a truck beside
it committed to moving AWAY into an empty lane, whose creep check saw the intruding cab
and never moved. The creep rule now lets a committed changer pass stopped blockers on the
side it is steering away from when its target lane is clear — creeping swings its cab away.
(2) My own rotated-body change: the lane-end distance measured the whole body's lateral
extent (rear corner included) against the taper at the FRONT's x, where the pavement had
already closed, so a truck fully merged except for a 0.39 m rear overhang saw "wall 0",
stayed flagged in the ending lane, and parked. Both the lane-end distance and the merged
test are back on the front: the front leads into the taper and the rear tracks inside it
(the taper widens 1.7 m over a truck's length, more than the cab's ≤1 m lead).
Also: capdrop counts an empty post-breakdown upstream bin as a standing queue (speed 0)
and reports stalled minutes instead of averaging them away.
**State:** lane drop flows past minute 60 on seeds 1, 2, 5; merge free-flow flicker gone
(930-1200 veh/h/ln at ~1100 demand — what remains is truck merge disruption, a 0.6 m/s²
truck cannot reach mainline speed on a 260-m acceleration lane). smoke PASS + VALIDATION
PASS (bicycle bottleneck 1302 veh/h/ln). The full capdrop rerun is in progress; the first
run's numbers are superseded and not reported.
**Next:** the rerun's result against the 5-20% band.


## 2026-09-24 — deceleration lanes

**Done:** `decelLaneLength` (bicycle; default 0 keeps the validated interchange behaviour):
each exit gets an auxiliary lane that OPENS over the taper length before the gore and ends
at it — the mirror of an acceleration lane. Exit-bound route desire counts one more change
(into lane N), lane N is a legal target only for a driver bound for the exit whose
deceleration lane is open there, `laneOf` admits lane N along it, and the gore imposes the
ramp's design speed (`exitSpeed` 15 m/s) as geometry, like a lane end. Late exiters may
still cut across from the right lane. T12 (the T7 configuration with 250-m lanes): 484 of
488 exits from the deceleration lane, missed exits 13 → 9, collision-free, no through
traffic in the lane.
**State:** smoke 12/12 PASS + VALIDATION PASS.
**Next:** the capacity-drop results (running); then decel lanes' safety effect (exit-
related rear-end conflicts in the through lane) as a sweep.


## 2026-09-24 — Stage 13 begins: the open road, lane drops, and a truck heading cap

**Done:** (1) Open-road mode (`openRoad`) for both bodies: the loop stays a loop, but
vehicles leave at `xOut = L − openDeadZone` (600 m, longer than any scan) and enter at x=0
from a Poisson upstream demand, so no vehicle sees across the boundary and every
wrap-aware scan, gap and MOBIL evaluation is unchanged. The entrance admits the queue's
head once the gap lets it enter in equilibrium at its leader's speed, never waiting for
more than the capacity gap — the first rule (take any gap ≥ s0+1 m at the matching
crawl) queued 38 cars at 1200 veh/h/ln, a boundary manufacturing a bottleneck. Open-road
exits: only exits still ahead; missed exits retarget downstream or become through.
(2) Lane drops (`laneDropAt`, bicycle): a through lane that ends is Stage 10's auxiliary
lane starting at the entrance, fed by the boundary — no new mechanism. (3) `capdrop.mjs`:
the empirical capacity-drop protocol (fill, 30-min demand ramp to over-capacity, 30-min
hold, 1-min bins; breakdown = upstream speed < 60% of free for 5 bins; pre-breakdown
capacity vs queue-discharge rate) for merge (lane/bicycle, ideal/human) and lane drop.
(4) Its first single-seed run exposed four "crashes" at the IDEAL point, all trucks
leaving the pavement mid-change at 9 m/s with a 10° heading (`probes/capcrash.mjs`):
pivoting about the rear, a 16 m body's cab leads its rear sideways by len·sin ψ = 2.7 m,
and the rear-referenced cascade (the saw-tooth fix) let the cab overshoot the target lane.
Commanded heading is now also capped by length (len·sin ψ ≤ 1 m; trucks ≤ 3.6°, cars
unchanged). Zero crashes on both probe seeds after.
**Changed:** params (openRoad, upstreamDemand, openDeadZone, laneDropAt), world
(boundaryPass, leavesRoad, nextExitAfter, eqGap/capacityGap, sampleDest, seeding,
metrics, drop lane), agent (length heading cap), observer (void, IN/OUT, drop lane),
smoketest T11 (open road both bodies + lane drop), capdrop.mjs, probes/capcrash.mjs.
**State:** smoke 11/11 PASS + VALIDATION PASS (bicycle bottleneck 1260 veh/h/ln, 102% of
lane body; T6 truck changes slower, all else identical). Full capacity-drop run (5 cases ×
5 seeds) in progress.
**Next:** the capacity-drop result against the 5-20% band; decel lanes at exits.


## 2026-09-24 — the phase diagram, re-run under the calibrated defaults, with a figure and a results note

**Done:** `phase.mjs` re-run at 5 seeds per cell under the headway-budgeted default
(6 × 6 × 5 = 180 runs, 9 min in the main realm). `phasefig.mjs` renders
results/phase.html — four heatmaps (speed, wave-onset std, near-crash rate, crash rate)
with the seed min–max in every cell and the breakdown boundary drawn where the seed-mean
detector std crosses 2 m/s; self-contained, works from file:// and Pages.
results/PHASE.md is the results note: setup, finding, the metastability, caveats.
**Finding, restated:** the breakdown boundary runs diagonally — fluid to k=25 at 1.0×
tReact; breaks at 30 at 1.3×, at 16-20 at 1.6×, at 12 at 2.0×. Safety rides the boundary:
fluid side ≤ 0.2 near-crashes per 1000 veh·km and zero crashes in every cell; across it
10 → 330 and 0.1 → 2.6. **The transition is metastable:** on the boundary individual
seeds either break or don't (k=16 × 1.6: 17-55 mph across five seeds; k=12 × 2.0: 44-59),
which is also why near-crash counts spread 4-5× between seed sets at fixed parameters.
**Changed:** phasefig.mjs (new), results/phase.{json,md,html}, results/PHASE.md, README.
**State:** suites unchanged (no model change). Figure UNVERIFIED by eye.
**Next:** wander SD toward empirical (lateral conflicts); the glance-rate analogue of the
diagram; Stage 13 open boundaries so the transition becomes a capacity drop.


## 2026-09-23 — v0.5 tagged; the near-crash excess decomposed and resolved (headway-budgeted glances)

**Done:** v0.5 tagged (Stage 11 complete, phase diagram, browser + DB verified). Then the
near-crash calibration taken apart source-first. `probes/decomp.mjs` (onNearCrash hook):
at defaults EVERY "near-crash" had a negative TTC — a body alongside whose band swung
within the 0.35 m margin, no follower glance, no leader braking. The metric now splits
longitudinal near-crashes (leader genuinely ahead, gap > 0) from **lateral conflicts**
(gap ≤ 0), both on the SafetyPanel. A second independent 25-seed base set showed
realization variance of 4-5× between 10⁵ veh·km sets (27 vs 6 events) — near-crashes
cluster in wave-forming realizations, so single-set Poisson bars are wrong by that
factor; the "shoulder-check anomaly" was exactly this (a +0.02 that made the cautious
probability exactly 1.0 skipped a random draw and shifted every stream). The glance
tail was NOT the problem: glances at defaults are 0.90 s mean, 5.5% > 2 s, 7.9%
eyes-off — beside the naturalistic ~4% > 2 s. The mechanism that was missing: drivers
budget a glance against their time headway (Tivesten & Dozza 2014). Added
`glanceHeadwayFrac`; on the SAME hard seeds it cut near-crashes 27 → 8 (evasive 0.069
vs SHRP2 0.048) and lateral conflicts 3.8×, leaving long glances where headways allow.
**Adopted as default (0.5).** T10 becomes a DISTRACTED population (budget off — a phone
is looked at regardless of the car ahead), same emergent mix. Sweep re-run: 6/6 and 5/6;
defaults give 0 near-crashes at k ≤ 15, the k=25 × 1.6 tReact collapse persists.
**Changed:** params (glanceHeadwayFrac), world (headway cap; lateral split; onNearCrash
hook), charts (panel line), calib.mjs (variants, columns), probes/decomp.mjs (new),
smoketest (T10 distracted), results/calib.md (consolidated).
**State:** smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS. Pooled defaults (pre-budget)
over 2×10⁵ veh·km: crash 0.005 (SHRP2 0.027 ✓), near 0.16 (3×); with the budget on the
hard set: near 0.079, evasive 0.069 (≈ SHRP2). Open: lateral-conflict rate has no
reference (wander SD 0.32 vs 0.2-0.3 empirical is the suspect).
**Next:** wander SD vs empirical (laneTol/motorErr, without the held-command overshoot);
the phase-diagram figure; Stage 13 open boundaries.


## 2026-09-23 — long-exposure calibration: crash rate matches SHRP2, near-crashes ~9× (real)

**Done:** `calib.mjs` at 25 seeds × 900 s ≈ 10⁵ veh·km per variant (2-3 min each in the
main realm), rates pooled over exposure, plus a SHRP2-style near-crash count (TTC episode
with ≥0.5 g braking, `evasiveNear`; also on the SafetyPanel). results/calib.md.
**State:** base: crash 0.010 per 1000 veh·km (1 event) vs SHRP2 0.027 — consistent;
near-crash 0.52 (53 events), evasive 0.43 (44) vs SHRP2 0.048 — ~9× on their definition,
so the excess is real, not definitional. Glance tail σ 0.3 halves it (0.23, 0 crashes);
comfort band ×0.6 makes wander 0.41 and near-crashes 4.2 (the held-command overshoot);
loomGain ×1.5 and checkProb +0.02 do not help — the latter RAISES near-crashes 2.4×
(128 events), untraced. Defaults untouched: the lever is the glance-duration
distribution, which should be matched to Klauer/SHRP2 directly rather than σ tuned to
the rate. Suites PASS.
**Next:** glance-duration distribution vs the naturalistic baseline; trace the
shoulder-check anomaly; phase-diagram figure.


## 2026-09-23 — headless in the main realm (3.9×), runner through the Server, DB path VERIFIED

**Done:** `headless.mjs` loads the browser sim files into the current realm with
`vm.runInThisContext` (the sources are `var`/function globals, so this is exactly a
<script> tag) instead of a contextified vm — conventions §4 warned the contextified global
proxy defeats V8 inlining on every `PARAMETERS.*` read. Measured 5.09 → 1.32 s per 200 s of
240 human vehicles, identical results; smoke 75 → 23 s, validate 3 → 2 min. Every headless
script uses it. `runner.mjs` rewritten: `--transport socket|direct`, `--server`,
`--scratch`, `--tag`, `--collection` (default: the next `batch_NNN` in the DB, per §4),
run names `run_NNN`, safety fields and the crash log in every packet, exposure (veh·km)
carried. `package.json` (socket.io-client; mongodb optional) — neither client had ever
been installed here, which is why the DB path stayed UNVERIFIED for ten weeks. Mongo is on
mint with 27017 localhost-only, so from this box the transport is the Server (the browser's
own path). **Round trip verified:** `node runner.mjs --reps 1 --ticks 2000 --scratch` →
`trafficSim_scratch.batch_001`, `{ok:true, inserted:1}`; scratch dropped after. Bicycle
body made the default; suites pin 'lane' for the 1D controls.
**Changed:** headless.mjs (new), runner.mjs, package.json + lock, smoketest/validate/
sweep/phase/calib (loader), calib (seed ranges `1..25`, pooled rates, results/calib.md).
**State:** smoke 10/10 PASS + VALIDATION PASS, numbers identical to the vm loader. Long-
exposure calibration (25 seeds × 900 s per variant ≈ 10⁵ veh·km) running.
**Next:** the long-exposure result → decide whether any attention default moves.


## 2026-09-23 — Stage 12 first pass: the phase diagram, calibration power, safety views

**Done:** (1) `phase.mjs` — reaction time × density, 6 × 6 cells × 3 seeds × 600 s, human
archetypes, 3-lane 4 km ring → `results/phase.md|json`. **The breakdown boundary runs
diagonally:** at 1.0× tReact the ring is fluid to k=25 (43 mph, near-crashes 0.5 per
1000 veh·km); at 1.3× it breaks at k=20 (42 mph, 9.2); at 1.6× at k=20 (38 mph, 28);
at 2.0× at k=12 (42 mph, 63). Near-crash rate spans three orders of magnitude across the
grid (0.1 → 459); crash rate is ~0 everywhere at ≤1.0× (max 0.15 at k=30) and reaches
10 per 1000 veh·km at k=30 × 2.0×. Detector speed std (wave onset) tracks the same
boundary (0.3-0.4 m/s fluid, 3-8 m/s broken). Reaction time is a phase-transition
control parameter — the micro→macro coupling the program was built to study, in one
table. (2) `calib.mjs` — default attention at k=15 vs SHRP2 (35 M miles: 1,541 crashes,
2,705 near-crashes → 0.027 / 0.048 per 1000 veh·km, all severity): 0 crashes in 12,000
veh·km (upper bound ~0.08, consistent), near-crashes 0.66 (~14× SHRP2, but 2-3 events —
±60%). Only the glance-duration tail registers (σ 0.5 → 0.3 gives 0.16); a tighter
comfort band makes wander worse (0.33 → 0.41 m: held-command overshoot); loomGain and
checkProb are invisible at this exposure. Defaults untouched. (3) Browser safety views:
SafetyPanel (exposure, rates vs SHRP2, PET, crash-mix bars), near-crashes-per-minute
graph, 'safety' colour mode (TTC red→green, white dot = eyes off, magenta = crashed),
sliders for reaction-time × and glance-rate ×, a Drivers: human/ideal toggle. Playwright
could not launch here; the stub-canvas T4 covers the draw paths.
**Changed:** new phase.mjs, calib.mjs, results/; charts (SafetyPanel), datamanager
(safety samples, exposure, near-rate graph), observer (safety mode), main/ui/index
(layout, toggles), params (idealDrivers, tReactX, glanceX, schema), agent (multipliers
apply to new drivers), world (veh.ttc), smoketest T4 (panel draws), README, DEVPLAN.
**State:** smoke 10/10 PASS (ideal suites unchanged: the multipliers default to 1 and the
toggle to false). Phase and calibration outputs committed under results/. Browser
verified by Chris ("looking great"); bicycle body made the default, suites pin 'lane'
for T1-T4 and validation A-C — all numbers identical.
**Next:** long-exposure runs (≥10⁵ veh·km per setting) through runner.mjs before moving
any attention default; glance-duration distribution vs Klauer/SHRP2; PET share vs NGSIM;
then the phase diagram as a figure with multiple seeds per cell and the wave-onset
boundary drawn — the first paper-shaped result. Chris: eyeball the new views.


## 2026-09-23 — Stage 11 complete: peripheral lane keeping, PET, the safety sweep

**Done:** (1) Peripheral lane keeping during glances (Summala et al. 1996: peripheral
vision keeps the lane, coarsely, and does not see the lead car brake): at the decision
cadence, if the body's edge has come within `periphTol` (0.15 m) of a lane line, a
correction is steered while the glance continues — longitudinal command held, no
looming evidence. T8's worst excursion 1.33 → 0.92 m; T10 departures 14 → 2; the dense
human probe's stuck count 21 → 0.7; T9 crash-free at 300 and 600 s. (2) PET at lane-change
completion (new follower's time to the vacated slot); conflicts counted below 1 s.
(3) `sweep.mjs`: near-crash and crash rates per 1000 veh·km over density {8,15,25} ×
tReact {0.6,1,1.6}× × glance rate {1,3}×, human archetypes, 600 s. **Near-crash rate
rises with density 6/6 and with tReact 5/6 — the done-when's third clause.** Finding:
at k=25 with 1.6× tReact the ring COLLAPSES (27 mph, 160 near-crashes and 2.8 crashes
per 1000 veh·km) where the same density with normal reactors is fluid at 43 mph — slow
reaction time is a phase-transition trigger, not just a safety parameter. Under 3× glances
the collapse comes earlier (k=25 at 1.0×: 20 mph, 84 near). Stage 11 done; Stage 12 active.
**Changed:** params (`periphTol`, `petConflict`), world (peripheral block, `keepTarget`
tolerance override, PET at completion, stats), runner (PET/conflicts in samples),
smoketest (T9 reports periphCorrections/PET), new `sweep.mjs`, README.
**State:** smoke 10/10 PASS + VALIDATION PASS + SWEEP PASS. Ideal-point controls unchanged.
Default-attention crash rates: 0 at k=8, ~0.4 per 1000 veh·km at k=15 (empirical
~0.0015) — the scaling is right, the magnitude is ~100× high: Stage 12's job. T9 PET mean
1.75 s with 68 of ~256 changes below 1 s (a 1-s follower headway after a change is common
tailgating; whether that share is realistic is a Stage 12 question).
**Next:** Stage 12 calibration — crash-type shares vs freeway GES/FARS, near-crash:crash
vs SHRP2, rates per veh·km (long runs through runner.mjs), the tReact × density phase
diagram as the first paper-shaped result. Chris to eyeball the Pages site.


## 2026-09-23 — trucks "vibrating" in lane changes: the cascade now references the rear

**Done:** Chris saw big trucks saw-toothing across the lane in the browser. Trace (human
truck, tReact 0.55 s): steering 72 → 18 → −40 → −0.5 → −19 mrad, the cab's lateral
position actually reversing at each held-command boundary. Cause: v0.4.1's rear-pivot
integration makes the FRONT swing by len·ψ̇ with every steering change, while the
dead-beat plan in `steerToward` assumed the front rolls along the heading — true before
the pivot. Fix: lateral error is measured at the REAR point (the one that rolls along the
heading; the standard kinematic-bicycle reference), and at the FRONT only when the
lateral-clearance gate binds — a cab that must hold beside a body is held by
counter-steering, and planning on the rear there let the front push past the clearance
(T7 and the bottleneck grew sideswipes before that gate). Trace after: 71 → −13 → −18 →
−14 → −10 mrad, front monotonic; change duration 2.2 s. Also from the human-mode fallout:
(a) glances now require nothing developing ahead (closing/gap < 0.15 ≈ TTC > 7 s) — every
crawl bump in the dense human probe was a follower glancing away while closing on a
stopped queue; (b) looming evidence arrives at the rate the looming does (× W·closing/gap²
relative to `loomRef` 0.02 rad/s, Markkula's accumulation ∝ θ̇) — a 14 m/s follower
meeting a cut-in 1.2 m ahead waited half a second without it. T10 rear-ends 35 → 23,
secondary 17 → 5.
**Changed:** agent (`steerToward(yTarget, horizon, atFront)`), world (gate sets
`gated`, glance precondition, salience), params (`loomRef`), smoketest (T9 bounds crash
EVENTS at one — see the comment: placeholder attention parameters produce one sideswipe
event on this seed, two wandering drivers converging on a shared line mid-glance).
**State:** smoke 10/10 PASS + VALIDATION PASS. Ideal-point controls unchanged (T1-T7
identical; D2 bottleneck 1314 veh/h/ln, 0 grazes, ring deltas ≤3.5%). Human mode: dense
probe rear contacts 7 → 3 (crawl bumps), bottleneck human 1242 veh/h/ln. Browser: Chris
confirmed the vibration; the fix is not yet eyeballed.
**Next:** unchanged — Stage 11 remainder (peripheral lane awareness during glances is now
clearly the lever: every remaining human-mode contact is a glance meeting a slow
convergence), scaling sweep, PET; Stage 12 calibration.


## 2026-09-23 — Stage 11 first pass: fallible perception — accidents emerge

**Done:** ground truth leaves the driver. (1) The emergency reflex is evidence
accumulation on PERCEIVED looming (Markkula et al. 2016): danger D = required decel
(closing²/2·gap, read through the decision's perception errors) over the emergency
threshold; evidence accrues at `loomGain`·(D−1) while the eyes are on the road, leaks
otherwise, the brake fires at 1 and holds while danger persists. Infinite gain = the old
same-tick reflex; the ideal-point suites are byte-identical. (2) Off-road glances as a
process: Poisson at `glanceRate`, lognormal duration around `glanceMean`, suppressed by
task demand (inverse TTC), and only begun when the car is STABLE — in the comfort band,
heading straight, wheel centred, not mid-maneuver (every logged departure before that
rule was a glance begun with the wheel slightly turned: a held tire angle integrates
heading, 0.01 rad at 29 m/s is 0.1 rad/s). During a glance: no decisions (the decision
fires when the eyes return), commands held, no lane correction, no looming evidence, no
peripheral reflex. (3) The shoulder check is decided once per maneuver with `checkProb`;
unchecked, the driver BELIEVES the strip clear (blind-spot sideswipes). (4) Post-crash:
a contact with either body above 3 m/s is a crash — both stop, stay obstacles, are
cleared after 120 s (secondary crashes emerge); a crawl scrape stays a graze. Through-lane
bodies may straddle a 1.5 m shoulder; the centre leaving the pavement at speed is a
run-off-road crash. (5) Near-crash = TTC < 1.5 s with hysteresis. Crash log carries
type / speed / glance state / heading. T10 added: elevated inattention (3× glance rate,
2 s mean, 60% shoulder checks) — crashes must EMERGE. No crash rule anywhere.
**Changed:** params (`attention` block; per-archetype loomGain/glanceRate/glanceMean/
checkProb; IDEAL_CONTROL scalars so the ideal point draws no random numbers), agent,
world (crash(), scheduleGlance(), reflex rewrite, edges/shoulder, contact→crash),
observer (crashed = magenta), runner (safety stats in samples), smoketest (T8 bound
re-baselined to the lane line; T9 asserts crash-free at defaults + conservation incl.
cleared; T10 new).
**State:** smoke 10/10 PASS + VALIDATION PASS (D unchanged from v0.4.1: 1410 veh/h/ln,
0 rear-ends, 1 crawl graze). T1-T7 byte-identical to v0.4.1. T9 (3 lanes, k=15, human
defaults, 300 s): 0 crashes, 0 near-crashes, 4773 glances. **T10: 164 crashes of 216
vehicles — rear-end 60, sideswipe 28, departure 8, secondary 18; 89 of 164 while
glancing; near-crashes 287 (4.8 per rear-end).** T8 wander SD 0.337 m, max excursion
1.36 m (a corner over the line in the long-glance tail). **Calibration gap, honest:** a
600-s T9 probe gave 1 departure ≈ 4×10⁻⁴ per veh·km vs the empirical ~10⁻⁶; near-crash
rate is likewise orders of magnitude high. The missing mechanism is peripheral lane
awareness during glances (drivers glancing at the radio still make gross corrections);
the attention parameters are placeholders from naturalistic ranges, not fitted. Browser
UNVERIFIED.
**Next:** Stage 11 remainder — PET for crossing paths, near-crash scaling with density
and tReact (the done-when's third clause), peripheral lane keeping during glances. Then
Stage 12 calibration: crash-type shares, near-crash:crash ratio, rates per veh·km (long
runs; the runner now carries the safety stats).


## 2026-09-22 — v0.4.1: rotated bodies, rear-pivot bicycle; repo published

**Done:** bodies are rotated. `Vehicle.segments()` splits each body into short segments
along its heading (cars 2, trucks 6), each an axis-aligned box at its own position with
its own sway (w·|cos ψ| + l·|sin ψ|); every 2D geometric query iterates segments (leader
scan by nearest segment, follower footprint, lateral clearance by segment pairs, contact
detection, creep check, pavement-end extent, merged criterion). The bicycle now pivots
about the REAR: the rear point rolls along the heading, the nose swings. The old
front-referenced integration made a steering truck's tail sweep sideways at >2 m/s (the
rotated body's first probe caught a stopped truck's tail 3 m inside the next lane).
Commanded heading capped at ~11° (the lateral-speed cap alone let crawling drivers command
30°). Observer rotates about the front. Repo published: github.com/algorithm0r/Traffic-Sim
(public), GitHub Pages on main → https://algorithm0r.github.io/Traffic-Sim/ (About link),
tags v0.1-v0.4 pushed; v0.4 = Stage 10.
**Changed:** agent (segments, band as union, ψ cap), world (segs cache + stamp,
segsOverlapX, all queries), observer (pivot). DEVPLAN Stage 10 rotated-body item checked.
**State:** smoke 9/9 PASS + VALIDATION PASS @ v0.4.1. Rings across bodies ≤2.8%. D2
bottleneck: 1410 veh/h/ln, 332 merges (most yet), 0 rear-ends, 1 graze; seeds 22-24:
1308-1356, 0 collisions; human 20 min: 1263, 0 collisions. **T7dense (3 lanes, k=22, 1200
veh/h ramps, seed 5) — the config that motivated this: 48 grazes / 34 stuck → 0 / 4.8 at
the ideal point; human 0 / 6.8.** T8 wander SD 0.328 m (was 0.333). Browser UNVERIFIED.
**Next:** Stage 11 — fallible perception (looming accumulator replaces the threshold
reflex; glances; shoulder check as a glance; post-crash state; TTC/PET conflict metrics).


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
