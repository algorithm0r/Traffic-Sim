# Cut-ins: the model against NGSIM I-80

*Results note, 2026-09-25 (Stage 17, second item). Data: `ngsim-cutins.json`
(`python tools/ngsim_cutins.py`), `cutins-ring.txt` / `cutins-merge.txt` / `cutins-*.json`
(`node probes/cutins.mjs --setting ring|merge`), `capdrop-lmrs-*`, `mergeconflict-lmrs.txt`.*

## Question

Stage 16 found our bottleneck conflicts (TTC < 1.5 s) are cut-ins, at 6–18 per 1000 veh·km
against about 1 in SUMO's LC2013. Crash traces showed slow vehicles entering faster lanes at
11–18 m/s closing. Do real lane changers do that?

## Method

NGSIM I-80 (4:00–4:15 pm; congested, changer median 8 m/s), positions smoothed as in the
Stage 14 calibration. Mainline changes are between lanes 1–6; ramp merges are from the
Powell St auxiliary lane (7) into lane 6. Kinematics are taken at two moments:

- **Centre crossing:** when `lane_id` switches, which is how NGSIM marks a change.
- **Entry:** when the changer's near edge first crosses the line, a median 1.3 s earlier.
  Lane lines are inferred from where lane ids switch; they come out 3.65 m apart, matching
  I-80's 12-ft lanes.

Entry is when the model's conflicts begin (median onset 0.5 s into the change). By the centre
crossing the follower has usually responded.

The model is measured identically, with human drivers and the bicycle body, in two settings:

- **The congested ring** (k = 45, mean 8.8 m/s), matched to NGSIM's speeds.
- **capdrop's merge.** This is where our crashes happen.

## Results

| at entry | NGSIM mainline | model ring | model merge, mainline ≤ 15 m/s | NGSIM ramp merges | model ramp merges |
|---|---|---|---|---|---|
| n | 636 | 1,726 | 4,420 | 147 | 1,817 |
| closing > 5 m/s | 2.2% | 3.5% | 5.5% | 0.7% | 17.8% |
| closing > 8 m/s | 0.9% | 0.3% | 1.5% | 0% | 9.5% |
| TTC < 1.5 s | 1.3% | 0.9% | 4.7% | 0.7% | 8.9% |

- **Ordinary lane changes match real ones.** On the congested ring our mainline changes
  have NGSIM's closing speeds and conflict shares.
- **The same holds at the centre crossing.** Closing > 5 m/s is 1.5% in the model against
  1.9% in NGSIM, and followers brake harder than 4.9 m/s² (hardest 1-s mean) in 1.6%
  against 0.9%.
- **The excess is specific to the merge area, and above all to ramp merges.** There TTC < 1.5
  at entry is 13 times NGSIM's rate.
- **Real mergers match speed; ours don't.** Real ramp mergers squeeze into small gaps (median
  6.8 m, 10th percentile 0.8 m), but at or above the follower's speed (median closing
  −0.8 m/s). Ours take comfortable gaps, yet one in six is more than 5 m/s slower than the
  follower.
- **The fast-closing merges have one profile** (seed 1: 24% of merges). They happen before
  breakdown (median minute 17), a median 212 m before the lane end, so about 50 m after the
  gore, with the merger at 13 m/s and the follower at 22. Our ramp vehicles merge as soon as
  they reach the acceleration lane, about 9 m/s below the mainline, instead of using the lane
  to accelerate.

## Why: MOBIL's acceptance inside an LMRS desire model

Our desire model is LMRS (thresholds, time- and distance-based route desire). With
t0 = 43 s, a merger 212 m from the lane end at 13 m/s already has route desire
1 − 16/43 = 0.62, above d_sync, so it looks for a gap at once. Our gap acceptance is
MOBIL-style: the changer may impose bSafe (3.5–5 m/s²), rising to 8 m/s² when forced.

LMRS's own acceptance (Schakel, Knoop & van Arem 2012, eq. 12) is stricter. Both the changer
and the new follower must keep an acceleration above −b_c·d, the changer's comfortable
deceleration scaled by its desire. The paper calls MOBIL's 4 m/s² "rather high" and relies
on relaxation and synchronization instead.

## Test: LMRS acceptance (`lc.accept: 'lmrs'`)

- **Early slow merges disappear** (seed 1: ramp merges closing > 5 m/s go from 23.6% to
  5.4%; > 8 m/s from 13.5% to 2.1%; TTC < 1.5 at entry from 9.9% to 5.9%).
- **The capacity drop falls** to 7–9% (hold measure), toward the low end of the empirical
  5–20%. No gridlock.
- **Conflicts rise overall.** Near-crashes per 1000 veh·km go from 6.3 to 9.5 (merge, ideal)
  and from 17.9 to 22.7 (drop, human). Crashes across the four cases go from 9 to 17. The
  remaining fast-closing merges are mergers that stalled near the lane end (median 1.9 m/s,
  57 m from it) entering in front of ~10 m/s followers.

This is the same pattern as the follower-gap test in Stage 16. Stricter acceptance alone makes
mergers wait, the ramp queue crawls, and they enter from near standstill. In LMRS, acceptance
comes with two partner processes. **Synchronization:** the merger matches its speed to the
target-lane leader, braking no more than b. **Gap creation:** the follower yields once the
merger's desire passes d_coop. The paper cites Daamen et al. (2010): at an onramp, "no
merging vehicle is overtaken by multiple vehicles". If our synchronization and cooperation
worked as LMRS intends, mergers would not stall.

**Not adopted yet.** `lc.accept` stays `'mobil'`. Next: measure how many mainline vehicles
overtake each merger (NGSIM lane 7 vs the model), then audit our synchronization and gap
creation against LMRS eq. 15 before adopting its acceptance.

## Overtakings per merger: the missing zipper

`tools/ngsim_overtakes.py` and `probes/overtakes.mjs` count the through-lane vehicles that pass
a merger between the start of the auxiliary lane and its merge.

| congested mergers (merge speed ≤ 12 m/s) | median time beside the mainline | overtaken by 3+ | mean overtakings |
|---|---|---|---|
| NGSIM I-80 lane 7 (n = 200) | 12 s | **0%** (82% by none) | 0.21 |
| model, ideal | 46 s | 53% | 5.0 |
| model, human | 53 s | 60% | 5.2 |
| model, human, LMRS acceptance | 73 s | 76% | 9.7 |
| model, human, LMRS gap creation (`lc.coop: 'lmrs'`) | 41 s | 48% | 3.5 |
| model, human, LMRS acceptance + gap creation | 56 s | 67% | 6.2 |

Real mainline traffic lets mergers in one by one (Daamen et al. 2010: no merger is overtaken
by several vehicles). Ours drives past them, so the ramp queue crawls and mergers finally
enter from near standstill.

Our cooperation differs from LMRS's. Ours gates the claim: a follower yields only if it costs
less than a politeness-scaled bound, and otherwise ignores the merger. LMRS clamps it: the
follower always yields, braking no more than b. The clamp is now an option (`coopAcc`,
`lc.coop: 'lmrs'`). It helps, but only partly.

A sample of the congested ramp queue (minutes 35–65) shows why:

- **Most of the queue never asks.** 76% of the queue sits 60–200 m from the lane end,
  crawling at 1.3–1.9 m/s. Its route desire is 0.49–0.64 (distance-based, LMRS
  x0 = 295 m), and only 9–17% of it claims (desire ≥ d_coop).
- **Only the head gets in.** Within 60 m of the end, 99% claim, at 7.6 m/s.
- **Real mergers take gaps our car-following cannot.** At I-80's merges the median gap to
  the new follower is 6.8 m and the 10th percentile 0.8 m, at matched speed. An IDM
  follower with a 2–3 m standstill distance reads a 1–3 m gap as an emergency, so our
  acceptance refuses what real drivers take.

**Neither option is adopted.** Both `lc.accept` and `lc.coop` default to the old behaviour.
The zipper needs either smaller accepted gaps at low speed (relaxing s0 as well as T during a
merge), or cooperation that starts before d_coop, or both. That is a design choice
calibrated against the lane-7 statistics above.

## Caveats

- **Congested data only.** NGSIM I-80 is congested (changers under 12 m/s at the 90th
  percentile). The free-flow comparison would need highD or similar.
- **Changer-speed mix.** The model ring's changers run faster than NGSIM's (median 14 vs
  8 m/s) despite a matched mean speed.
- **Entry detection.** NGSIM entry uses smoothed lateral positions and inferred lane lines.
  The model uses body-band overlap.
- **Small sample.** One geometry, and 147 real ramp merges.
