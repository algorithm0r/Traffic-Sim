# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-30T15:40:19.155Z. Variant: {"params":{"lc":{"s0MinFrac":0.47,"coop":"lmrs","dCoop":0.577,"courtesy":0}},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-ideal        1              39     1752    1629    939   46.4%   42.4%     945        0       0            0
  drop-bicycle-ideal        2              39     1752    1665   1011   42.3%   39.3%     924        0       0            0
  drop-bicycle-ideal        3              35     1674    1551    971   42.0%   37.4%     878        0       0            0
  drop-bicycle-ideal        4              40     1824    1665    959   47.5%   42.4%     959        0       0            0
  drop-bicycle-ideal        5              37     1806    1656    903   50.0%   45.5%     921        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 45.6% (42.0%–50.0%); vs 10-min pre-mean 41.4% (37.4%–45.5%); 5/5 broke down   [12.1 min]
```
