# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T16:02:01.670Z. Variant: {"params":{},"gap":"follower"}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              22     1296    1131   1337   -3.1%  -18.2%     652        1       1            0
  merge-bicycle-human       2              25     1374    1359   1341    2.4%    1.3%     654        0       0            0
  merge-bicycle-human       3              27     1446    1335   1334    7.8%    0.1%     656        2       2            0
  merge-bicycle-human       4              24     1446    1365   1340    7.3%    1.8%     721        0       0            0
  merge-bicycle-human       5              26     1440    1362   1324    8.1%    2.8%     655        0       0            0
  merge-bicycle-human    drop vs 5-min max 4.5% (-3.1%–8.1%); vs 10-min pre-mean -2.4% (-18.2%–2.8%); 5/5 broke down   [5.9 min]
```
