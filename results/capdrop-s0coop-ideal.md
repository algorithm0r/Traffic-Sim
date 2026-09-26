# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-26T15:32:42.858Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs"}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              37     1734    1569   1366   21.2%   13.0%     625        0       0            0
  merge-bicycle-ideal       2              30     1608    1407   1466    8.8%   -4.2%     638        0       0            0
  merge-bicycle-ideal       3              34     1764    1590   1507   14.6%    5.2%     638        0       0            0
  merge-bicycle-ideal       4              34     1692    1584   1389   17.9%   12.3%     671        0       0            0
  merge-bicycle-ideal       5              27     1470    1419   1458    0.8%   -2.8%     654        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 12.7% (0.8%–21.2%); vs 10-min pre-mean 4.7% (-4.2%–13.0%); 5/5 broke down   [12.5 min]
  drop-bicycle-ideal        1              36     1812    1614   1331   26.5%   17.5%     990        0       0            0
  drop-bicycle-ideal        2              45     1818    1758   1370   24.6%   22.1%    1089        0       0            0
  drop-bicycle-ideal        3              40     1848    1710   1376   25.6%   19.6%    1071        0       0            0
  drop-bicycle-ideal        4              32     1632    1563   1341   17.8%   14.2%     980        0       0            0
  drop-bicycle-ideal        5              35     1686    1569   1289   23.6%   17.9%     981        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 23.6% (17.8%–26.5%); vs 10-min pre-mean 18.2% (14.2%–22.1%); 5/5 broke down   [23.1 min]
```
