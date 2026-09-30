# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T15:17:53.304Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.577}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              37     1758    1638   1417   19.4%   13.5%     596        0       0            0
  merge-bicycle-ideal       2              40     1812    1698   1445   20.3%   14.9%     610        0       0            0
  merge-bicycle-ideal       3              35     1770    1674   1196   32.4%   28.5%     626        0       0            0
  merge-bicycle-ideal       4              39     1830    1605   1246   31.9%   22.4%     677        0       0            0
  merge-bicycle-ideal       5              36     1704    1509   1204   29.4%   20.2%     648        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 26.7% (19.4%–32.4%); vs 10-min pre-mean 19.9% (13.5%–28.5%); 5/5 broke down   [9.3 min]
  drop-bicycle-ideal        1              37     1668    1569    913   45.3%   41.8%     895        0       0            0
  drop-bicycle-ideal        2              36     1668    1632    980   41.2%   40.0%     909        0       0            0
  drop-bicycle-ideal        3              38     1776    1719    926   47.9%   46.1%     933        0       0            0
  drop-bicycle-ideal        4              39     1794    1719    959   46.6%   44.2%     930        0       0            0
  drop-bicycle-ideal        5              38     1818    1701    901   50.4%   47.0%     921        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 46.3% (41.2%–50.4%); vs 10-min pre-mean 43.8% (40.0%–47.0%); 5/5 broke down   [21.8 min]
```
