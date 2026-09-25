# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:21:15.912Z. Variant: {"params":{"coolness":0.99},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-human        1              35     1530    1413   1308   14.5%    7.4%    1087        3       4            0
  drop-bicycle-human        2              32     1542    1401   1303   15.5%    7.0%     964        1       1            0
  drop-bicycle-human        3              32     1374    1209   1265    7.9%   -4.7%     911        0       0            0
  drop-bicycle-human        4              33     1560    1356   1313   15.8%    3.1%    1075        3       3            0
  drop-bicycle-human        5              38     1638    1482   1280   21.8%   13.6%    1010        1       1            0
  drop-bicycle-human     drop vs 5-min max 15.1% (7.9%–21.8%); vs 10-min pre-mean 5.3% (-4.7%–13.6%); 5/5 broke down   [6.3 min]
```
