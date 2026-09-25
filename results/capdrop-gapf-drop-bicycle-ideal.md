# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T16:10:55.260Z. Variant: {"params":{},"gap":"follower"}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-ideal        1              27     1518    1515   1386    8.7%    8.5%     929        1       1            0
  drop-bicycle-ideal        2              34     1482    1413   1336    9.8%    5.4%     895        0       0            0
  drop-bicycle-ideal        3              32     1392    1368   1406   -1.0%   -2.8%     924        0       0            0
  drop-bicycle-ideal        4              31     1458    1365   1388    4.8%   -1.7%     952        0       0            0
  drop-bicycle-ideal        5              31     1404    1341   1368    2.6%   -2.0%     882        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 5.0% (-1.0%–9.8%); vs 10-min pre-mean 1.5% (-2.8%–8.5%); 5/5 broke down   [11.3 min]
```
