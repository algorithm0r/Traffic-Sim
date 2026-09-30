# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T14:58:21.767Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.577}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              30     1566    1413   1106   29.4%   21.7%     638        0       0            0
  merge-bicycle-human       2              32     1644    1068   1054   35.9%    1.3%     680        2       3            0
  merge-bicycle-human       3              23     1566    1176   1026   34.5%   12.7%     678        2       2            0
  merge-bicycle-human       4              42     1728    1554   1197   30.7%   23.0%     634        0       0            0
  merge-bicycle-human       5              18     1494    1176   1184   20.7%   -0.7%     628        1       3            0
  merge-bicycle-human    drop vs 5-min max 30.2% (20.7%–35.9%); vs 10-min pre-mean 11.6% (-0.7%–23.0%); 5/5 broke down   [5.7 min]
  drop-bicycle-human        1              34     1584    1437    871   45.0%   39.4%     911        1       1            0
  drop-bicycle-human        2              39     1632    1404    923   43.5%   34.3%     961        1       1            0
  drop-bicycle-human        3              37     1626    1527    879   45.9%   42.4%     941        1       1            0
  drop-bicycle-human        4              36     1656    1329    860   48.1%   35.3%     933        1       1            0
  drop-bicycle-human        5              34     1506    1290    907   39.8%   29.7%     917        1       1            0
  drop-bicycle-human     drop vs 5-min max 44.4% (39.8%–48.1%); vs 10-min pre-mean 36.2% (29.7%–42.4%); 5/5 broke down   [12.9 min]
```
