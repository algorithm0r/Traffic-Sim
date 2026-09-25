# Safety exposure across traffic regimes

*Results note, 2026-09-25 (Stage 15). Data: `exposure.md` / `exposure.json` (adopted model), `exposure-signal`, `exposure-baccept5`, `exposure-both` (variants). Regenerate with `node exposure.mjs --ks 8,14,20,28,36 --seeds-per-k 100 --secs 1800` (~1 h on 14 workers). Diagnostics: `probes/crashcontext.mjs`, `probes/sideswipe.mjs`.*

## Setup

The interchange loop (3 lanes, 6 km, 3 interchanges, 800 veh/h on each onramp), bicycle body,
human drivers at their calibrated defaults (NGSIM car-following, SDLP lane keeping, attention).
Seeded traffic is through traffic, so each density holds; the ramps add weaving, vehicles
merging in and leaving at the next exits. Five densities, 100 seeds each, 25 minutes of traffic
after a 5-minute warm-up: 4.7 million veh·km in all. A crash is any contact above 3 m/s;
"lane-change involved" means either vehicle was changing lanes or merging at contact.

## Reference

Golob, Recker and Alvarez classified over 1,000 crashes on six Orange County freeways by the
traffic regime they occurred in (via FHWA's SHRP2 freeway-operations report, fig. 4). The
prevailing crash type shifts with regime: in low-flow free flow, two-vehicle lane-change
crashes (47%) and rear-ends (48%); in high-flow free flow, rear-end plus lane-change (58–79%);
in congestion, rear-ends (54–83%). The crash mix is the target, not only the rate.

## Result

| density, veh/km/lane | mean speed | crash events | per 1000 veh·km | rear-end share | lane-change involved | evasive near-crashes per 1000 veh·km |
|---|---|---|---|---|---|---|
| 8 | 51 mph | 49 | 0.053 | 24% | 88% | 9.3 |
| 14 | 34 mph | 40 | 0.040 | 28% | 90% | 37.4 |
| 20 | 25 mph | 38 | 0.038 | 24% | 92% | 59.4 |
| 28 | 17 mph | 30 | 0.032 | 50% | 77% | 80.5 |
| 36 | 12 mph | 31 | 0.035 | 42% | 74% | 100.2 |

- **The direction of the shift is right.** Rear-end share roughly doubles from free-flowing to
  congested traffic, and lane-change involvement falls, as in Golob's data.
- **The levels are not.** Three quarters or more of crashes involve a lane change or merge at
  every density; in Golob's congested regimes rear-ends prevail at 54–83%. The model's merges
  and lane changes produce too large a share of its crashes.
- **Near-crashes at interchanges are far above naturalistic rates** (9–100 per 1000 veh·km
  evasive, against SHRP2's all-roads 0.048), while on the plain ring at k=15 they sit below it
  (0.025, 4×10⁵ veh·km). The excess is specific to merging and weaving.
- **Even the lightest density is congested at the merges** (51 mph): three interchanges on 6 km
  with 800 veh/h per ramp is a weaving-heavy geometry.

## Mechanism

Crash contexts (`probes/crashcontext.mjs`) and tick-by-tick traces (`probes/sideswipe.mjs`):
every crashing lane-changer had checked its shoulder and no driver was glancing at contact.
The typical crash is a forced merge meeting a delayed follower. A slow merger, a ramp vehicle
or a changer at 1–14 m/s, angles into the next lane; a faster lane-keeping vehicle 2–9 m/s
quicker was glancing away as the conflict formed, looks back with a time-to-collision under
1 s, and its looming brake fires too late. It strikes the merger's rear corner while the merger
is still laterally offset, so the geometry classifier often labels a rear strike a sideswipe
(overlap under 60% of width); that is why the comparison above uses lane-change involvement.

Two candidate fixes were tested pairwise on the same seeds (60 per density):

| crash events | k=8 | k=20 |
|---|---|---|
| baseline | 45 | 45 |
| no glance begins while a neighbour signals into my lane | 31 | 27 |
| forced merges capped at 5 m/s² imposed on the follower | 70 | 42 |
| both | 55 | 17 |

Signal-aware glances cut crashes by about a third at both densities and were adopted (drivers
adapt glances to demand; Tivesten & Dozza). Capping forced merges made light traffic worse
(mergers stall at the lane end and enter from standstill) and was rejected. Neither changes the
lane-change share, which points at the merge process itself.

## Caveats

- One geometry, one ramp demand, one fleet; Golob's reference is police-reported crashes on six
  freeways in 1998, reported as the prevailing type per regime, not full distributions.
- Crash typing by geometry at contact is not police coding; lane-change involvement is the
  closer comparison.
- The glance tail remains uncalibrated: no sourced manual-driving glance distribution is in hand.
