# Attention and lane-keeping calibration

*Results note, revised 2026-09-24. The generated table is `calib.md` (`node calib.mjs --seeds 1..50 --secs 900`); lateral measures come from `probes/lateral.mjs`. This note records how the defaults were reached, including two wrong turns.*

## References

- **Crash and near-crash rates:** SHRP2 naturalistic driving study, 35 M miles, 1,541
  crashes and 2,705 near-crashes, all severities and all road types: 0.027 crashes and
  0.048 near-crashes per 1000 veh·km (experienced adults 0.023). SHRP2 counts a near-crash
  only with an evasive maneuver; the sim's "evasive" count is a longitudinal TTC < 1.5 s
  episode with braking ≥ 0.5 g.
- **Lane-position SD (SDLP):** the standardised on-road highway test, 13.5–15.3 cm for sober
  drivers over 10–100 km at 95 km/h; above 35 cm is the published unsafe cut-off.
- **Lane changes:** highD, 11,000 changes over 45,000 km of German motorway (0.24 per
  veh·km); cut-in follower time headways 0.1–4 s peaking at 1 s. NGSIM change duration
  4.0 ± 2.3 s, mode about 3 s (Thiemann, Treiber & Kesting 2008).
- **Glances:** naturalistic baseline about 4% of off-road glances longer than 2 s; drivers
  shorten glances at short headways (Tivesten & Dozza 2014).

## How the defaults were reached

1. **The first "9× SHRP2 near-crash excess" was a miscount.** Every default-attention
   "near-crash" had a negative TTC: a body alongside, not a leader ahead. The metric now
   separates longitudinal near-crashes from lateral conflicts.
2. **Realization variance is 4–5×** between independent 10⁵ veh·km seed sets at fixed
   parameters (27 vs 6 events). Near-crashes cluster in realizations that form a wave, so
   Poisson error bars on a single set are wrong by that factor. An apparent effect of the
   shoulder-check probability was this variance.
3. **Glances budgeted against time headway** (`glanceHeadwayFrac` 0.5): on the same seeds,
   near-crashes 27 → 8 and lateral conflicts down 3.8×, leaving glance durations at the
   naturalistic distribution (0.90 s mean, 5.5% > 2 s). Adopted.
4. **Lane-position SD calibrated.** The code's "empirical 0.2–0.3 m" was never sourced. SD
   ≈ the comfort band's half-width / √3, so the band set it: +0.35 m on every archetype's
   `laneTol` takes SDLP from 0.32 to 0.147 m. A second wrong turn is corrected here: an
   earlier variant that multiplied `laneTol` by 0.6 made wander worse and was attributed to
   "held-command overshoot"; in fact it widened the band. Adopted.

## Result at the calibrated defaults

k=15 veh/km/lane, 3-lane ring, no ramps, 50 seeds × 900 s = 2.0×10⁵ veh·km:

| measure | sim | reference |
|---|---|---|
| lane-position SD | 0.149 m | 0.135–0.153 m (on-road test) |
| crashes per 1000 veh·km | 0 events (upper bound ~0.015) | 0.027 (SHRP2, all roads) |
| near-crashes (evasive) per 1000 veh·km | 0.010 (2 events) | 0.048 (SHRP2, all roads) |
| lateral conflicts per 1000 veh·km | 0 | — |
| lane changes per veh·km | 0.13 | 0.24 (highD) |
| lane-change duration | 3.2 s | 4.0 ± 2.3 s, mode ~3 s (NGSIM) |
| follower headway after a change | mean 1.8 s, ~30% < 1 s | 0.1–4 s, peak 1 s (highD cut-ins) |

## Reading

- The lateral-conflict excess was the unsourced wander and nothing else: at empirical SDLP
  it is zero.
- Crash and near-crash rates now sit below SHRP2's, as they should for a basic freeway
  segment at moderate density with no ramps or weaving; SHRP2 spans all road types and
  includes minor contacts. SHRP2 is therefore a ceiling here, not a target, and further
  tuning against it would be fitting. A freeway-specific naturalistic reference, and
  runs with interchanges, are the next calibration step.
- The lane-change rate is about half highD's. highD records German motorways with
  unlimited sections and a much wider desired-speed spread, so more passing; this fleet
  has a ±5% spread under a 65 mph limit. Recorded, not tuned.
