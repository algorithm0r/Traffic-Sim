# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T16:07:55.397Z. Variant: {"params":{},"gap":"follower"}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-human        1              30     1434    1314   1232   14.1%    6.2%     943        0       0            0
  drop-bicycle-human        2              34     1446    1260   1258   13.0%    0.2%     939        1      37            0
  drop-bicycle-human        3              32     1506    1338   1298   13.8%    3.0%     898        0       0            0
  drop-bicycle-human        4              25     1152     975   1327  -15.2%  -36.1%     945        2       2            0
  drop-bicycle-human        5              28     1410    1248   1338    5.1%   -7.2%     946        0       0            0
  drop-bicycle-human     drop vs 5-min max 6.2% (-15.2%–14.1%); vs 10-min pre-mean -6.8% (-36.1%–6.2%); 5/5 broke down   [8.4 min]
```
