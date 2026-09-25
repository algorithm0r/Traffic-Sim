# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T23:18:11.485Z. Variant: {"params":{"lc":{"accept":"lmrs"}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              23     1344    1203   1310    2.5%   -8.9%     641        2       2            0
  merge-bicycle-human       2              33     1422    1230   1332    6.3%   -8.3%     650        1       0            0
  merge-bicycle-human       3              26     1332    1242   1291    3.1%   -3.9%     628        0       0            0
  merge-bicycle-human       4              29     1434    1290   1316    8.2%   -2.0%     662        1       1            0
  merge-bicycle-human       5              24     1362    1308   1277    6.3%    2.4%     639        0       0            0
  merge-bicycle-human    drop vs 5-min max 5.3% (2.5%–8.2%); vs 10-min pre-mean -4.2% (-8.9%–2.4%); 5/5 broke down   [5.5 min]
  drop-bicycle-human        1              19      990     720   1275  -28.8%  -77.1%     892        2       2            0
  drop-bicycle-human        2              24     1200     954   1303   -8.6%  -36.6%     931        2       2            0
  drop-bicycle-human        3              25     1248    1221   1252   -0.3%   -2.6%     926        3       5            0
  drop-bicycle-human        4              28     1308    1167   1267    3.2%   -8.5%     941        1       2            0
  drop-bicycle-human        5              28     1272    1044   1243    2.3%  -19.1%     910        1       1            0
  drop-bicycle-human     drop vs 5-min max -6.5% (-28.8%–3.2%); vs 10-min pre-mean -28.8% (-77.1%–-2.6%); 5/5 broke down   [20.4 min]
```
