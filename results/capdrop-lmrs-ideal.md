# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T23:18:11.476Z. Variant: {"params":{"lc":{"accept":"lmrs"}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              27     1416    1248   1399    1.2%  -12.1%     642        0       0            0
  merge-bicycle-ideal       2              25     1422    1143   1394    2.0%  -21.9%     649        1       2            0
  merge-bicycle-ideal       3              25     1320    1248   1425   -8.0%  -14.2%     674        0       0            0
  merge-bicycle-ideal       4              29     1464    1365   1372    6.3%   -0.5%     624        0       0            0
  merge-bicycle-ideal       5              29     1578    1446   1352   14.3%    6.5%     637        1       2            0
  merge-bicycle-ideal    drop vs 5-min max 3.2% (-8.0%–14.3%); vs 10-min pre-mean -8.5% (-21.9%–6.5%); 5/5 broke down   [10.6 min]
  drop-bicycle-ideal        1              34     1404    1290   1363    2.9%   -5.6%     912        0       0            0
  drop-bicycle-ideal        2              34     1542    1362   1295   16.0%    4.9%     886        0       0            0
  drop-bicycle-ideal        3              29     1428    1350   1359    4.9%   -0.6%     844        1       2            0
  drop-bicycle-ideal        4              32     1440    1410   1407    2.3%    0.2%     892        1       2            0
  drop-bicycle-ideal        5              29     1404    1368   1329    5.4%    2.9%     885        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 6.3% (2.3%–16.0%); vs 10-min pre-mean 0.4% (-5.6%–4.9%); 5/5 broke down   [27.3 min]
```
