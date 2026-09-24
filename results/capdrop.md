# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-24T03:58:37.228Z.

```
  case                   seed  breakdown(min)  pre-max   QDR    drop   merges  crashes  grazes
  merge-lane-ideal          1              40     1590   1239   22.1%     654        0       0
  merge-lane-ideal       mean drop 22.1%  (seeds 22.1–22.1%, 1/1 broke down)   [0.3 min]
  merge-bicycle-ideal       1              32     1602   1095   31.6%     587        2       0
  merge-bicycle-ideal    mean drop 31.6%  (seeds 31.6–31.6%, 1/1 broke down)   [1.7 min]
```
