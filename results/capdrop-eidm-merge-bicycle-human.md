# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:16:12.265Z. Variant: {"params":{"coolness":0.99},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       1              30     1398    1278   1268    9.3%    0.8%     626        1       1            0
  merge-bicycle-human       2              31     1422    1251   1212   14.7%    3.1%     659        4       4            0
  merge-bicycle-human       3              29     1440    1371   1331    7.6%    2.9%     625        0       0            0
  merge-bicycle-human       4              19     1356    1020   1271    6.3%  -24.6%     609        4      21            1
  merge-bicycle-human       5              29     1590    1143   1334   16.1%  -16.7%     639        2       3            0
  merge-bicycle-human    drop vs 5-min max 10.8% (6.3%–16.1%); vs 10-min pre-mean -6.9% (-24.6%–3.1%); 5/5 broke down   [5.1 min]
```
