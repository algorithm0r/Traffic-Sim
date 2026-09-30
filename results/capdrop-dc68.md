# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T15:40:19.158Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.68}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-ideal        1              37     1746    1626   1265   27.5%   22.2%    1005        0       0            0
  drop-bicycle-ideal        2              39     1722    1695   1317   23.5%   22.3%     993        0       0            0
  drop-bicycle-ideal        3              35     1614    1488   1300   19.5%   12.7%     971        0       0            0
  drop-bicycle-ideal        4              37     1794    1635   1299   27.6%   20.5%     977        0       0            0
  drop-bicycle-ideal        5              40     1770    1620   1274   28.1%   21.4%     965        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 25.2% (19.5%–28.1%); vs 10-min pre-mean 19.8% (12.7%–22.3%); 5/5 broke down   [11.0 min]
```
