# Trajectory-grounded drivers: calibrating against NGSIM I-80

*Results note, 2026-09-24 (Stage 14). Data: NGSIM I-80, 4:00–4:15 pm, 1.17 M rows, 1,972 vehicles, from the public data.transportation.gov API (`tools/ngsim_fetch.py`; stored under data/, not committed). Code: `tools/ngsim_common.py`, `ngsim_calib.py`, `ngsim_classes.py`, `ngsim_lanechange.py`; `probes/gapaccept.mjs`. Outputs: `ngsim-calib.json`, `ngsim-classes.json` (b free), `ngsim-classes-fixb.json` (adopted), the `-holdout` versions, `ngsim-lanechange.json`.*

## Method

Car-following episodes are runs in which the same follower keeps the same leader in the same
mainline lane for at least 30 s (capped at 90 s): 927 episodes, 877 with a car following and
49 with a truck. Positions are smoothed with a Savitzky–Golay filter (2.1 s, cubic) and
episodes with tracking errors (smoothed |acceleration| > 8 m/s²) are dropped. The follower is
simulated with IDM, as the sim uses it (δ = 4), driven by the leader's observed trajectory
from the follower's observed initial state; the objective is the relative gap error, RMS gap
error over mean gap. The traffic is congested: median follower speed 7.1 m/s.

## Findings

**1. Per-episode fits are not transferable.** Fitting all five IDM parameters to each
episode gives a median gap error of 11%, but half the fits put b at a bound and 40% put s0 at
one, and v0 is unidentifiable because the drivers never approach free speed. At 7 m/s a small
headway with a large standstill gap reproduces the same spacing as moderate values of both;
the lowest-T fifth of the fits had T = 0.36 s with s0 = 4.3 m, which at 30 m/s would mean a
half-second headway and about 3,500 veh/h/lane.

**2. Population calibration.** The archetypes were instead calibrated as a population: three
car classes and trucks, each ONE parameter set fitted jointly over the episodes it explains
best (hard-assignment EM, 8 iterations), with bounds plausible at highway speed (T 0.8–2.4 s,
s0 1–4 m, a 0.4–3 m/s²) and v0 fixed at each archetype's value.

**b is not identifiable here, and fitting it is harmful.** With b free (bounds 0.8–4) it ran to
the 0.8 bound for three of four classes — yet holding b at the literature values fits exactly
as well (median 21.8% both ways). Adopted with b free, the gentle braking made the car that
had just cut in brake hard at highway speed; near-crashes at moderate density rose 3.5×
(paired test on 30 fresh seeds: 0.114 → 0.032 per 1000 veh·km with only b restored). So b is
held at the literature values and T, s0, a and the shares are fitted around it:

| class | share of cars | T (s) | s0 (m) | a (m/s²) | b (m/s², fixed) |
|---|---|---|---|---|---|
| aggressive | 28.7% (was 22%) | 0.85 (1.00) | 1.84 (2.0) | 1.45 (1.4) | 2.1 |
| normal | 38.2% (56%) | 1.39 (1.45) | 1.95 (2.5) | 1.27 (1.0) | 1.7 |
| cautious | 33.1% (22%) | 2.05 (1.85) | 2.38 (3.0) | 0.82 (0.8) | 1.4 |
| truck | — | 1.48 (1.70) | 2.97 (3.5) | 0.98 (0.6) | 1.2 |

Values before calibration in brackets. The data want a more evenly split fleet and a wider
spread of time headways.

**3. Fit quality, and what classes cannot do.** Median relative gap error, best class per episode:

| | old archetypes | calibrated classes |
|---|---|---|
| all 877 car episodes: median / 75th / 90th pct | 22.1 / 30.1 / 40.0% | 21.8 / 28.7 / 36.3% |
| held-out drivers (fit on the other half): median / 75th / 90th | 22.1 / 29.1 / 38.0% | 22.3 / 28.7 / 35.7% |
| truck episodes: median | 36.9% | 34.9% |

The literature-based archetypes were already nearly as good as any three-class population in
the median; calibration improves the tails. The held-out error equals the in-sample error, so
the classes are not overfitted, and the half-sample classes came out almost the same (T 0.84,
1.35, 2.11 s). The gap between population fits (22%) and per-episode fits (11%) is
heterogeneity that fixed classes cannot capture: within-class spread and the same driver
behaving differently over time.

**4. Gap acceptance at lane changes.** NGSIM switches lane_id when a vehicle's centre crosses
the line; the model was measured the same way, human drivers on a 3-lane ring at k=45
veh/km/lane (mean speed 8.5 m/s vs NGSIM's 8.1):

| time gap at the crossing, 10th / 50th / 90th pct | NGSIM I-80 (683 changes) | model, calibrated drivers |
|---|---|---|
| to the new leader, s | 0.40 / 1.01 / 2.79 | 0.61 / 1.09 / 2.12 |
| from the new follower, s | 0.66 / 1.56 / 3.38 | 0.67 / 1.29 / 2.33 |
| new followers closer than 1 s | 25.5% | 32% |
| speed at change, median | 8.1 m/s | 13.3 m/s |

(model: k=45, mean speed 9.0 m/s.) In time terms the medians match within 0.1–0.3 s; the
model's distribution is narrower, missing I-80's longest gaps. Before calibration the model's
lead gaps were longer at the short end (10th percentile 0.73 s). A first reading of this
comparison in metres, not seconds, suggested the model was far too conservative ahead; that was
confounded by speed — the model's drivers change lanes in the faster phases of the ring's
stop-and-go waves.

## Consequences for the model (all suites and results rerun)

| | v0.6 drivers | NGSIM-calibrated |
|---|---|---|
| homogeneous lane capacity, veh/h/lane | 1836 | 1932 |
| mixed-fleet ring capacity | 1680 | 1698 |
| 1D merge discharge, share of fleet capacity (validation C) | 75% | 82% |
| lane-position SD | 0.147 m | 0.139 m |
| lane changes per veh·km (highD 0.24) | 0.13 | 0.22 |
| near-crashes per 1000 veh·km, k=15, pooled 4×10⁵ veh·km (SHRP2 all roads 0.048) | 0.010 | 0.054 |
| off-road glances longer than 2 s (naturalistic ~4%) | 5.5% | 0.7% |

- Capacity moved toward US values without being tuned for it, but remains below them.
- The lane-change rate now matches highD's: the wider headway spread gives drivers reasons to
  pass.
- Near-crashes rose to SHRP2's all-roads rate. Every one at moderate density is a cut-in
  followed by hard braking by the vehicle that changed lanes; none involves a glancing
  follower. The shorter calibrated headways also tighten the glance budget, so long glances
  are now rarer than the naturalistic baseline: the attention and car-following calibrations
  interact and should next be done jointly (Stage 15).
- The phase diagram's boundary moved inward at slow reaction times (`phase-note.md`).
- The capacity drop stays in the empirical band (5.9–16.0% by case, `capdrop-note.md`), but
  the earlier "humans raise the drop at both bottlenecks" no longer holds at the merge.

## Caveats

- One site, one 15-minute period, congested throughout. The calibration speaks for congested
  following; v0 is not identified and a, b are fitted at low speed. A free-flow dataset (highD)
  would be needed to test the parameters at highway speed.
- b is bound-limited at 0.8 m/s²; the congested data want gentler braking still.
- NGSIM I-80 has known position errors; smoothing reduces but does not remove them, and part
  of the 22% floor is measurement noise.
- Within-class spreads are still the literature-based ones; the per-episode fits are too
  poorly identified to estimate them.
