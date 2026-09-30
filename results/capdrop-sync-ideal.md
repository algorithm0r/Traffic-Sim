# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T14:58:21.767Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.577}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-ideal       1              35     1764    1584   1229   30.3%   22.4%     645        0       0            0
  merge-bicycle-ideal       2              44     1872    1665   1185   36.7%   28.8%     683        0       0            0
  merge-bicycle-ideal       3              29     1512    1347   1340   11.4%    0.5%     646        0       0            0
  merge-bicycle-ideal       4              34     1698    1524   1400   17.6%    8.2%     638        0       0            0
  merge-bicycle-ideal       5              43     1824    1752   1285   29.6%   26.7%     612        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 25.1% (11.4%–36.7%); vs 10-min pre-mean 17.3% (0.5%–28.8%); 5/5 broke down   [8.3 min]
  drop-bicycle-ideal        1              38     1698    1587    959   43.5%   39.6%     913        0       0            0
  drop-bicycle-ideal        2              42     1854    1710    885   52.3%   48.2%     966        0       0            0
  drop-bicycle-ideal        3              42     1812    1680    903   50.1%   46.2%     979        0       0            0
  drop-bicycle-ideal        4              41     1824    1638    913   50.0%   44.3%     946        0       0            0
  drop-bicycle-ideal        5              42     1824    1701    970   46.8%   43.0%     943        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 48.5% (43.5%–52.3%); vs 10-min pre-mean 44.3% (39.6%–48.2%); 5/5 broke down   [18.8 min]
```
