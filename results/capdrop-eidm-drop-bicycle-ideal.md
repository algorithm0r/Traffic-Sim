# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:23:53.091Z. Variant: {"params":{"coolness":0.99},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  drop-bicycle-ideal        1              33     1494    1443   1299   13.1%   10.0%     920        0       0            0
  drop-bicycle-ideal        2              37     1674    1536   1388   17.1%    9.6%     942        0       0            0
  drop-bicycle-ideal        3              33     1470    1374   1311   10.8%    4.6%     916        0       0            0
  drop-bicycle-ideal        4              33     1632    1521   1376   15.7%    9.6%    1003        0       0            0
  drop-bicycle-ideal        5              35     1620    1509   1290   20.4%   14.5%     939        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 15.4% (10.8%–20.4%); vs 10-min pre-mean 9.7% (4.6%–14.5%); 5/5 broke down   [11.1 min]
```
