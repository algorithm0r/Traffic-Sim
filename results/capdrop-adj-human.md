# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T15:17:53.310Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.577}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              34     1560    1407   1097   29.7%   22.0%     631        1       0            0
  merge-bicycle-human       2              31     1782    1524   1173   34.2%   23.0%     672        0       0            0
  merge-bicycle-human       3              31     1566    1362   1133   27.7%   16.8%     635        1       1            0
  merge-bicycle-human       4              26     1566    1323    908   42.0%   31.4%     698        2       1            0
  merge-bicycle-human       5              32     1704    1491   1107   35.0%   25.8%     658        0       0            0
  merge-bicycle-human    drop vs 5-min max 33.7% (27.7%–42.0%); vs 10-min pre-mean 23.8% (16.8%–31.4%); 5/5 broke down   [5.9 min]
  drop-bicycle-human        1              35     1680    1401    892   46.9%   36.4%     842        0       0            0
  drop-bicycle-human        2              38     1662    1536    897   46.0%   41.6%     940        1       1            0
  drop-bicycle-human        3              31     1494    1314    822   45.0%   37.4%     924        2       4            0
  drop-bicycle-human        4              32     1644    1395    944   42.6%   32.3%     903        0       0            0
  drop-bicycle-human        5              38     1704    1590    896   47.4%   43.7%     944        0       0            0
  drop-bicycle-human     drop vs 5-min max 45.6% (42.6%–47.4%); vs 10-min pre-mean 38.3% (32.3%–43.7%); 5/5 broke down   [15.6 min]
```
