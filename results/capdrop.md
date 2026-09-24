# Capacity drop on the open road

*Results note, 2026-09-24. Data: `capdrop.md` (table), `capdrop.json` (per-run minute series). Regenerate with `node capdrop.mjs --seeds 1..5` (~48 min). Model state: commit 50455c2 (v0.5 + open road, lane drops, deceleration lanes, the lane-end gridlock and wall fixes).*

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

| case | pre-breakdown (5-min max) | queue discharge | drop vs 5-min max | drop vs 10-min mean |
|---|---|---|---|---|
| merge, 1D lane body, ideal drivers | 1500–1600 | 1240–1310 | 17.4% (14.0–22.1) | 7.7% (0.8–13.9) |
| merge, bicycle body, ideal | 1280–1550 | 1195–1342 | 8.9% (1.1–19.1) | 0.8% (−5.2–11.3) |
| merge, bicycle body, human | 1150–1300 | 1122–1193 | 7.3% (−1.5–12.2) | −2.1% (−15.7–3.8) |
| lane drop, bicycle, ideal | 1250–1490 | 1202–1319 | 7.8% (−2.1–13.0) | 1.3% (−9.2–6.8) |
| lane drop, bicycle, human | 1240–1550 | 1101–1190 | 16.6% (7.0–27.0) | 7.7% (0.7–19.0) |

Flows in veh/h/lane; drops are seed means with the seed range in brackets. Every run broke
down; no run stalled; crashes only in human runs (0–3 per run, in the queue).

On the literature's measure every case mean lies in the empirical 5–20% band, and the
queue discharges at 83–93% of the pre-breakdown flow — the Stage 13 done-when, and the
"merge-zone discharge into 80–95%" item.

## Reading

- **The 2D body breaks down earlier, not harder.** Its queue discharge is about the same
  as the 1D body's (1195–1342 vs 1240–1310), but breakdown comes at lower flow (minute
  19–33 of the ramp vs 29–40). Merge disturbances — slow trucks entering from the
  acceleration lane, lane changes that take time and lateral room — trigger breakdown
  before the flow reaches its maximum. That is the stochastic-breakdown picture of freeway
  capacity (breakdown probability rising with flow), and it is why the 2D drop is smaller:
  the pre-breakdown flow is lower, not the discharge higher.
- **Human drivers lower the discharge.** At the lane drop the human queue discharges
  about 150 veh/h/lane below the ideal one, and the drop doubles (7.8% → 16.6%). Reaction
  time and relaxation after merging are exactly the mechanisms the capacity-drop literature
  names (Laval & Leclercq 2008; Leclercq et al. 2011).
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
