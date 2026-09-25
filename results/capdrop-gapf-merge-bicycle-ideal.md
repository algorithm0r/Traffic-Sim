# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T16:02:01.679Z. Variant: {"params":{},"gap":"follower"}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              30     1524    1428   1395    8.5%    2.3%     663        0       0            0
  merge-bicycle-ideal       2              27     1512    1446   1422    6.0%    1.7%     643        1       3            0
  merge-bicycle-ideal       3              27     1488    1413   1364    8.4%    3.5%     654        0       0            0
  merge-bicycle-ideal       4              29     1512    1323   1413    6.6%   -6.8%     596        0       0            0
  merge-bicycle-ideal       5              32     1548    1488   1333   13.9%   10.4%     635        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 8.6% (6.0%–13.9%); vs 10-min pre-mean 2.2% (-6.8%–10.4%); 5/5 broke down   [8.9 min]
```
