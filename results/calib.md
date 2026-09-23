# Attention calibration vs SHRP2

k=15/ln, 3 lanes, 4 km ring, human archetypes, 900 s x 25 seeds per row (about 1e5 veh-km each);
rates pooled over total exposure. SHRP2 all-severity reference (35 M miles, 1,541 crashes, 2,705
near-crashes): crash 0.027, near-crash 0.048 per 1000 veh-km (experienced adults 0.023). SHRP2 counts a
near-crash only with an evasive maneuver; "evasive" here is a longitudinal TTC<1.5 s episode with
braking >= 0.5 g. "lateral" = a body alongside whose band came within the 0.35 m margin of mine
(gap <= 0) - a different class of near-miss, split out 2026-09-23 after the decomposition probe found
every default-attention "near-crash" was one of these. Generated 2026-09-23.

## Realization variance (same defaults, two independent seed sets)

```
  variant     seeds   veh-km    near  evasive lateral   crash   events(near/evasive/crash)
  base        1..25   101279   0.267   0.197   0.563  0.0099   27/20/1
  base       26..50   102155   0.059   0.049   0.157  0.0000    6/5/0
```

A factor of 4-5 between independent 1e5 veh-km sets: near-crashes cluster in realizations that
form a wave. Poisson error bars on a single set are therefore wrong by that factor. (The earlier
"check" variant's 3x rise was this, not the shoulder check: +0.02 pushed the cautious archetype's
probability to exactly 1.0, which skips a random draw and shifts every stream.)

## Variants on seeds 1..25 (the harder set) - paired comparisons

```
  variant   veh-km   mph  wanderSD   near  evasive lateral   crash    rear    side  depart  events(near/evasive/crash)
  base      101279   56   0.324   0.267   0.197   0.563  0.0099  0.0000  0.0099  0.0000   27/20/1
  headway   101769   56   0.322   0.079   0.069   0.147  0.0000  0.0000  0.0000  0.0000    8/7/0    <- adopted (frac 0.5)
  headway3  101743   56   0.320   0.039   0.039   0.138  0.0000  0.0000  0.0000  0.0000    4/4/0
  tail      101718   56   0.323   0.049   0.049   0.295  0.0000  0.0000  0.0000  0.0000    5/5/0
  wander     97203   52   0.408   4.218     -       -    0.1337  0.0206  0.1235  0.0000  410/-/13
  loom      100436   55   0.325   0.707     -       -    0.0348  0.0000  0.0398  0.0000   71/-/4
  combo     101153   56   0.406   2.551     -       -    0.0198  0.0000  0.0198  0.0000  258/-/2
```

Variants: headway = a glance is capped at 0.5 x the time headway (Tivesten & Dozza 2014: drivers
shorten glances at short headways); headway3 = 0.33 x; tail = glance-duration lognormal sigma
0.5 -> 0.3; wander = comfort band x0.6; loom = looming gain x1.5; combo = wander + tail. Rows
marked "-" were run before the lateral split.

## Reading

- Crash rate at defaults (0.005 pooled over 2e5 veh-km, one event) is consistent with SHRP2's 0.027.
- Longitudinal near-crashes at the pre-2026-09-23 defaults: 0.16 pooled, 3x SHRP2, with a 4-5x
  spread between realization sets. The excess concentrated on the hard set and was driven by
  long glances in car-following.
- The headway budget is the mechanism that fixes it without thinning the glance-duration
  distribution where headways allow: on the SAME seeds it cut near-crashes 27 -> 8 (evasive 0.069
  vs SHRP2 0.048) and lateral conflicts 3.8x. Adopted as the default (glanceHeadwayFrac 0.5).
  The tail variant reaches the same rate but by making glances > 2 s vanish (0.1% vs the
  naturalistic ~4%) - the wrong way to get there.
- Glance statistics at defaults (decomposition probe): mean 0.90 s, 5.5% > 2 s, eyes-off-road 7.9%
  of time - beside the naturalistic figures (about 4% > 2 s). With the budget, long glances survive
  only at long headways, which is what Tivesten & Dozza report.
- Lateral conflicts (0.15-0.56 per 1000 veh-km) have no clean empirical reference; wander SD 0.32
  vs the empirical 0.2-0.3 is the likely driver. Open.
- Hard-braking events (<= 0.5 g): 8 per 1000 veh-km at k=15 - below telematics harsh-braking rates
  (tens per 1000 km), so leader braking is not the excess.
