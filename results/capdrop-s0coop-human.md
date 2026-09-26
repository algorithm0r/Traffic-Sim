# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-26T15:32:42.860Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs"}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              31     1614    1497   1362   15.6%    9.0%     617        0       0            0
  merge-bicycle-human       2              19     1302    1146   1390   -6.7%  -21.2%     652        1       2            0
  merge-bicycle-human       3              25     1512    1335   1287   14.9%    3.6%     660        1       1            0
  merge-bicycle-human       4              35     1800    1545   1290   28.3%   16.5%     642        1       1            0
  merge-bicycle-human       5              27     1524    1383   1244   18.4%   10.1%     655        0       0            0
  merge-bicycle-human    drop vs 5-min max 14.1% (-6.7%–28.3%); vs 10-min pre-mean 3.6% (-21.2%–16.5%); 5/5 broke down   [8.8 min]
  drop-bicycle-human        1              29     1386    1317   1279    7.7%    2.9%     988        0       0            0
  drop-bicycle-human        2              33     1572    1452   1257   20.1%   13.5%    1032        1       1            0
  drop-bicycle-human        3              32     1356    1317   1287    5.1%    2.3%     990        1       0            0
  drop-bicycle-human        4              31     1476    1383   1281   13.2%    7.4%    1008        1       1            0
  drop-bicycle-human        5              25     1236    1014   1238   -0.1%  -22.1%     950        1      43            0
  drop-bicycle-human     drop vs 5-min max 9.2% (-0.1%–20.1%); vs 10-min pre-mean 0.8% (-22.1%–13.5%); 5/5 broke down   [17.0 min]
```
