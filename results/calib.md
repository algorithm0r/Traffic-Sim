# Attention calibration vs SHRP2

k=15/ln, 3 lanes, 4 km ring, human archetypes, 900 s x 25 seeds per variant (about 10^5 veh-km each);
rates pooled over total exposure. SHRP2 all-severity reference (35 M miles, 1,541 crashes, 2,705
near-crashes): crash 0.027, near-crash 0.048 per 1000 veh-km (experienced adults 0.023). SHRP2 counts a
near-crash only with an evasive maneuver; "evasive" below is the TTC episode with braking >= 0.5 g.
Generated 2026-09-23.

```
  variant   veh-km(total)  mph  wanderSD   near  evasive   crash    rear    side  depart  PET<1s  glances   events(near/evasive/crash)
  base           101279    56   0.324   0.523   0.434   0.0099  0.0000  0.0099  0.0000    28%   15286   53/44/1
  tail           101718    56   0.323   0.226   0.226   0.0000  0.0000  0.0000  0.0000    28%   15303   23/23/0
  wander          97203    52   0.408   4.218     -     0.1337  0.0206  0.1235  0.0000    26%   15236   410/-/13
  loom           100436    55   0.325   0.707     -     0.0348  0.0000  0.0398  0.0000    28%   15239   71/-/4
  check          100199    56   0.325   1.277     -     0.0499  0.0100  0.0299  0.0200    28%   15292   128/-/5
  combo          101153    56   0.406   2.551     -     0.0198  0.0000  0.0198  0.0000    27%   15381   258/-/2
```

Variants: tail = glance-duration lognormal sigma 0.5 -> 0.3; wander = comfort band x0.6; loom = looming gain
x1.5; check = shoulder-check probability +0.02; combo = wander + tail.

Reading: the crash rate at defaults (0.010, one event) is consistent with SHRP2 (0.027). The near-crash
rate is ~9x SHRP2 on SHRP2's own evasive definition (0.43 vs 0.048) - a real excess, not a definitional
one (44 of 53 TTC episodes had >= 0.5 g braking). The glance-duration tail is the lever that moves it
(halves it); a tighter comfort band makes wander and everything else worse (held-command overshoot).
Defaults were not moved: the right next step is to match the glance-duration distribution itself to
the naturalistic baseline (share of glances > 2 s), not to tune sigma against the near-crash rate.
