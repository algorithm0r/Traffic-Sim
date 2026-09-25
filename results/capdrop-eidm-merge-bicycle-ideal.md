# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:16:12.263Z. Variant: {"params":{"coolness":0.99},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              24     1500    1344   1354    9.7%   -0.8%     690        0       0            0
  merge-bicycle-ideal       2              32     1536    1479   1363   11.3%    7.9%     684        0       0            0
  merge-bicycle-ideal       3              31     1698    1575   1376   19.0%   12.6%     620        0       0            0
  merge-bicycle-ideal       4              28     1422    1167   1379    3.0%  -18.2%     628        1       1            0
  merge-bicycle-ideal       5              34     1626    1500   1440   11.4%    4.0%     630        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 10.9% (3.0%–19.0%); vs 10-min pre-mean 1.1% (-18.2%–12.6%); 5/5 broke down   [7.7 min]
```
