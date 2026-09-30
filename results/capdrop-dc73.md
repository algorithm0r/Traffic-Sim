# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T15:40:19.166Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.73}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-ideal        1              37     1650    1527   1290   21.8%   15.5%     990        0       0            0
  drop-bicycle-ideal        2              41     1746    1617   1342   23.1%   17.0%     966        0       0            0
  drop-bicycle-ideal        3              37     1722    1590   1342   22.1%   15.6%     998        0       0            0
  drop-bicycle-ideal        4              37     1704    1629   1358   20.3%   16.6%     988        0       0            0
  drop-bicycle-ideal        5              39     1698    1611   1326   21.9%   17.7%     989        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 21.8% (20.3%–23.1%); vs 10-min pre-mean 16.5% (15.5%–17.7%); 5/5 broke down   [10.9 min]
```
