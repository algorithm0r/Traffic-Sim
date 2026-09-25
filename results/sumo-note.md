# This model vs SUMO: capacity drop and conflicts at two bottlenecks

*Results note, 2026-09-25 (Stage 16). Data: `sumo-capdrop.md` / `sumo-capdrop.json` (both models,
one table), `capdrop-gapf-*` (this model with SUMO-style gap acceptance), `mergeconflict-*.txt`
(conflict attribution). Regenerate: `python tools/sumo_capdrop.py --workers 3` (SUMO 1.27.1 via
`pip install eclipse-sumo`; about 4 h of CPU, most of it in SL2015; `--reuse` re-scores saved
output), `node capdrop.mjs --gap follower --cases <case> --out capdrop-gapf-<case>`,
`node probes/mergeconflict.mjs --case merge-bicycle-ideal [--gap follower]`.*

## Setup

The capacity-drop experiment (`capdrop-note.md`) rebuilt in SUMO with the same geometry,
demand profile and driver population. There are two bottlenecks. The merge is 2 lanes with a
600 veh/h onramp whose acceleration lane ends. The drop is 3 lanes to 2. Upstream demand ramps
past capacity and then holds, with 1-min detectors at the same positions.

SUMO's IDM (δ = 4) is given our NGSIM-calibrated archetypes: a = accel, b = decel, T = tau,
s0 = minGap, desired-speed factor. Each class is spread into ten sampled vTypes. There are
three driver settings:

- **ideal:** an action step of 0.1 s.
- **human:** SUMO's action step is set to each class's reaction time, the same decide-then-hold
  mechanism as our tReact, but with no perception noise or attention model.
- **default:** SUMO out of the box, with default passenger and truck vTypes (Krauss, σ = 0.5)
  and nothing matched.

Two lane-change models are tested: LC2013, which is lane-based, and SL2015, which is sublane
with continuous lateral motion. Teleporting is disabled, as in ours.

Conflicts come from SUMO's SSM device: encounters with min TTC < 1.5 s, and those with max
DRAC ≥ 4.9 m/s². Ours are near-crash episodes (TTC < 1.5 s with a leader ahead) and those with
braking ≥ 4.9 m/s². Both are per 1000 veh·km.

The breakdown rule in `capdrop.mjs` (upstream speed below 60% of free flow for 5 min) proved
fragile in SUMO, whose congested state often hovers at the threshold. Both models are therefore
also scored threshold-free, by the same function:

- **P:** the peak 5-min downstream flow before minute 45.
- **H:** the mean over minutes 45–65, when demand has exceeded capacity for at least 10 min in
  both.
- **Hold drop:** 1 − H/P.

On our runs, the hold drop agrees with the rule-based drop to within about a point.

## Results (5 seeds each; flows in veh/h/lane)

| | P | hold drop | TTC < 1.5 | hard (≥ 0.5 g) |
|---|---|---|---|---|
| **this model**, merge, ideal / human | 1595 / 1432 | 14.2% / 9.7% | 6.3 / 16.1 | 5.7 / 12.6 |
| **this model**, drop, ideal / human | 1552 / 1464 | 13.2% / 12.5% | 6.2 / 17.9 | 5.6 / 14.0 |
| this model, follower gap (4 cases) | 1442–1532 | 8.5–10.0% | 6.3–19.1 | 5.8–13.6 |
| **SUMO LC2013**, merge, ideal / human | 1498 / 1466 | 2.5% / 7.2% | 1.05 / 0.86 | 0 / 0 |
| **SUMO LC2013**, drop, ideal / human | 1508 / 1540 | −1.6% / 10.2% | 0.25 / 0.83 | 0 / 0 |
| **SUMO SL2015**, scored runs | 1098–1534 | 19–40% | 33–89 | 29–86 |
| **SUMO default** (Krauss), all four | 2137–2185 | no sustained breakdown | 0–21 | 0–18 |

SL2015 without teleporting deadlocked in 6 of its 20 matched-driver runs. Another 6 slowed so
far under their own queues that they were stopped at a 90-min wall-clock cap, and are not
scored. This model deadlocked in none.

## Findings

**1. The same car-following gives the same capacity.** With matched IDM parameters, SUMO's
pre-breakdown peak falls within 1,466–1,540 veh/h/lane. Ours falls within 1,432–1,595. SUMO's
defaults carry about 45% more (2,140–2,190). They never break down at this demand under
LC2013, and only late under SL2015 (minutes 48 and 56, in 2 of 10 runs). An out-of-the-box comparison would therefore be a comparison of calibrations, not models.

**2. The capacity drop differs, and the lane-change model sets it.** The empirical drop is
roughly 5–20% (Cassidy & Bertini 1999; Chung, Rudjanakanoknad & Cassidy 2007).

- **Ours: 10–15%**, inside that range.
- **LC2013 with ideal drivers: essentially none** (−2 to +3%). Its congested state is a long,
  fast synchronized queue at about 15 m/s rather than a collapse.
- **LC2013 with an action step: 7–10%.** Held commands produce a drop even in SUMO.
- **SL2015: 19–40%** where it could be measured, beyond the empirical range.

Three tests locate the difference in ours:

- **The 2D body is not the cause.** The lane body and the bicycle body give the same drop at
  the merge (14.8% vs 14.2%).
- **Gap acceptance is part of it.** Our changers accept gaps that make the new follower brake
  at up to 3.5–5 m/s², or 8 m/s² in a forced merge. LC2013 accepts only gaps the follower can
  absorb at its comfortable deceleration. Imposing LC2013's rule on ours (`--gap follower`)
  cuts the drop by a quarter to a third, to 8.5–10.0%.
- **The rest is untraced.** Most of the gap to LC2013 remains. The likely candidates are
  LC2013's cooperative speed adjustment for mergers and IDM's hard response to cut-ins (below).

**3. Conflict rates span two orders of magnitude, and the lane-change model sets them.** The
car-following parameters are identical in every run. Yet TTC < 1.5 conflicts run at about 1 per
1000 veh·km under LC2013, 6–18 in ours and 33–89 under SL2015. Hard-braking conflicts run at 0,
6–14 and 29–86. For microsimulated surrogate safety, the choice of lane-change model matters
more than the car-following calibration. SL2015's rate, and its deadlocks, are also a caution
about the sublane model at bottlenecks without teleporting. SUMO's default time-to-teleport of
300 s would hide the deadlocks.

**4. Our conflicts are cut-ins, and IDM's response to them makes them "evasive".**
`probes/mergeconflict.mjs` classified every near-crash at onset over two seeds per variant:

- **What they are.** In the ideal merge, 43% are a ramp vehicle entering in front of the
  follower. Another 36% are a mainline car changing into its lane. Plain following accounts for
  1%.
- **How they look at onset.** For mainline cut-ins, the median changer is 0.5 s into its
  change, 4.7 m ahead, closing at 6.0 m/s. That requires 3.2 m/s², within what our drivers
  accept.
- **What does the braking.** 77–80% of the ≥ 0.5 g braking comes from IDM itself saturating at
  the 9 m/s² cap, not from the looming reflex. IDM's interaction term (s*/s)² treats any close
  cut-in as an emergency.
- **Stricter acceptance doesn't help.** Under `--gap follower`, conflicts rise from 6.4 to 8.7
  per 1000 veh·km. Mergers now wait for the lane end and enter from a crawl, so the follower
  still meets a close, slow leader.
- **Human drivers add a class.** Queue stop-and-go upstream accounts for 29% of their
  episodes.

This over-reaction is a known IDM defect. The Enhanced IDM's constant-acceleration heuristic
(Kesting, Treiber & Helbing 2010) exists to fix it, and it is the natural first item for
Stage 17.

## Two SUMO pitfalls (both silent)

- **Insertion.** At `departSpeed="max"` from a fixed position, a mixed-speed fleet enters at no
  more than about 1,800 veh/h: a fast type cannot enter behind a slow one. `departPos="last"` is
  worse, placing vehicles far down the road behind the last one. The fix is leader-matched speed
  (`departSpeed="last"`) at the edge start.
- **Route order.** SUMO reads route files incrementally and expects departures sorted. A flow
  beginning at t = 0, written after flows beginning later, was never loaded. The merge ran for
  an hour without its onramp before this was caught.

## Caveats

- **Encounter scope.** The SSM device counts every encounter type within 60 m: following,
  merging and crossing. Ours counts leader-ahead episodes only. SUMO's definition is the broader
  one, so LC2013's low counts are not a definitional artifact.
- **Hard braking is measured differently.** DRAC is the deceleration a situation requires.
  Ours is the braking actually applied, and an over-braking IDM exceeds the requirement. Our
  hard counts are an upper bound on DRAC-comparable conflicts.
- **SL2015 is under-sampled.** 12 of its 20 matched runs are deadlocked or unscored; its rates
  come from fewer, shorter runs.
- **The human setting is not our human driver.** SUMO's human setting is an action step only.
  Ours adds perception error, attention and lane-keeping noise. The ideal rows are the cleaner
  comparison.
- **Scope.** One geometry per bottleneck and five seeds. Seed-to-seed spreads are wide, e.g.
  LC2013 human merge hold drop 1–16%.
