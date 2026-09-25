# Capacity drop on the open road

*Results note, revised 2026-09-24 for the NGSIM-calibrated drivers (Stage 14). Data: `capdrop.md` (table), `capdrop.json` (per-run minute series). Regenerate with `node capdrop.mjs --seeds 1..5` (~30 min on a multi-core machine). Earlier versions of this note reported the v0.6 drivers; that table is kept below for comparison.*

## Protocol

An open road (Stage 13): vehicles enter at x=0 from a Poisson upstream demand and leave
at the road's end. One bottleneck per case: a 2-lane road with one onramp (600 veh/h), or
3 lanes dropping to 2. Upstream demand is held for 5 minutes, ramped over 30 minutes to
well above capacity, then held for 30. One-minute detector bins, 760 m upstream and about
1 km downstream of the bottleneck. Breakdown is the first minute the upstream speed falls
below 60% of free-flow speed and stays there five minutes. The capacity drop compares the
queue-discharge rate (mean downstream flow once the queue is established) against the
pre-breakdown flow, estimated two ways: the highest 5-minute mean before breakdown (the
literature's style, biased up by taking a maximum over noisy bins), and the mean of the 10
minutes before breakdown (biased down, because demand was still rising). The truth lies
between. Five seeds per case.

## Result

| case | drop vs 5-min max | drop vs 10-min mean | v0.6 drivers, vs 5-min max |
|---|---|---|---|
| merge, 1D lane body, ideal drivers | 13.9% (9.6–17.9) | 8.0% (4.3–11.3) | 17.4% |
| merge, bicycle body, ideal | 13.8% (8.5–20.1) | 3.1% (−4.7–14.2) | 8.9% |
| merge, bicycle body, human | 5.9% (−0.2–10.1) | −0.4% (−10.2–6.9) | 10.8% |
| lane drop, bicycle, ideal | 12.1% (4.0–18.1) | −4.0% (−27.3–7.7) | 7.8% |
| lane drop, bicycle, human | 16.0% (8.7–24.5) | 6.4% (−6.8–19.0) | 20.0% |

Drops are seed means with the seed range in brackets. Every run broke down; no run stalled.

On the literature's measure four case means lie inside the empirical 5–20% band and the
human merge sits at its lower edge (5.9%) — the Stage 13 done-when, re-confirmed on the
NGSIM-calibrated drivers.

## Reading

- **The 2D body breaks down earlier, not harder.** Its queue discharge is about the same
  as the 1D body's (1195–1342 vs 1240–1310), but breakdown comes at lower flow (minute
  19–33 of the ramp vs 29–40). Merge disturbances — slow trucks entering from the
  acceleration lane, lane changes that take time and lateral room — trigger breakdown
  before the flow reaches its maximum. That is the stochastic-breakdown picture of freeway
  capacity (breakdown probability rising with flow), and it is why the 2D drop is smaller:
  the pre-breakdown flow is lower, not the discharge higher.
- **Human versus ideal drivers: not robust.** On the v0.6 drivers humans raised the drop at
  both bottlenecks. On the NGSIM-calibrated drivers they still do at the lane drop (16.0% vs
  12.1%) but not at the merge (5.9% vs 13.8%), with overlapping seed ranges. Five seeds per
  case cannot separate these; the claim is withdrawn until more seeds settle it.
- **The spread is wide.** Single seeds range from a slightly negative drop to 27%. That is
  also the empirical picture (Chung et al. 2007 report 3–18% across sites), but five seeds
  cannot pin a case's mean to better than about ±4 percentage points.

## Caveats

- Both pre-breakdown estimators are biased, in opposite directions; the band statement
  rests on the literature-style one.
- One geometry per bottleneck type (a 260 m acceleration lane, a 3-to-2 drop with the
  LMRS 295 m look-ahead), one fleet mix (8% trucks), 5 seeds.
- Absolute flows are below US freeway values (1800–2000 veh/h/lane discharge) because this
  fleet's own capacity is about 1680 veh/h/lane (validation C); the drop is a ratio and is
  the comparable quantity.
