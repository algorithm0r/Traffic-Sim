# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:39:09.132Z.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       6              29     1494    1356   1293   13.5%    4.7%     704        0       0            0
  merge-bicycle-human       7              28     1398    1248   1235   11.7%    1.1%     628        1       2            0
  merge-bicycle-human       8              24     1314    1248   1349   -2.7%   -8.1%     672        0       0            0
  merge-bicycle-human       9              33     1476    1359   1302   11.8%    4.2%     627        1       1            0
  merge-bicycle-human      10              35     1554    1338   1277   17.8%    4.6%     628        1       1            0
  merge-bicycle-human      11              32     1482    1284   1294   12.7%   -0.8%     616        0       0            0
  merge-bicycle-human      12              30     1404    1365   1247   11.2%    8.6%     677        1       1            0
  merge-bicycle-human      13              23     1416    1233   1341    5.3%   -8.8%     635        2       3            0
  merge-bicycle-human      14              27     1350    1131   1296    4.0%  -14.6%     687        1       1            0
  merge-bicycle-human      15              33     1602    1338   1358   15.2%   -1.5%     621        2       3            0
  merge-bicycle-human    drop vs 5-min max 10.0% (-2.7%–17.8%); vs 10-min pre-mean -1.1% (-14.6%–8.6%); 10/10 broke down   [15.7 min]
  drop-bicycle-human        6              33     1530    1335   1211   20.8%    9.3%     920        0       0            0
  drop-bicycle-human        7              28     1278    1215   1244    2.7%   -2.4%     973        2       2            0
  drop-bicycle-human        8              37     1578    1413   1283   18.7%    9.2%     995        1       1            0
  drop-bicycle-human        9              36     1494    1386   1245   16.7%   10.2%    1083        3       1            0
  drop-bicycle-human       10              35     1560    1440   1313   15.8%    8.8%    1040        1       1            0
  drop-bicycle-human       11              35     1518    1410   1318   13.2%    6.6%     989        0       0            0
  drop-bicycle-human       12              31     1524    1380   1289   15.4%    6.6%    1003        1       1            0
  drop-bicycle-human       13              31     1338    1188   1213    9.3%   -2.1%     951        2       3            0
  drop-bicycle-human       14              33     1428    1350   1123   21.3%   16.8%     929        2       2            1
  drop-bicycle-human       15              33     1434    1362   1304    9.0%    4.2%     962        0       0            0
  drop-bicycle-human     drop vs 5-min max 14.3% (2.7%–21.3%); vs 10-min pre-mean 6.7% (-2.4%–16.8%); 10/10 broke down   [28.5 min]
```
