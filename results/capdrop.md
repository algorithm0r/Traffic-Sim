# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T15:00:10.687Z.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-lane-ideal          1              35     1692    1587   1421   16.0%   10.5%     624        0       0            0
  merge-lane-ideal          2              32     1566    1482   1415    9.6%    4.5%     685        0       0            0
  merge-lane-ideal          3              32     1644    1491   1350   17.9%    9.5%     670        0       0            0
  merge-lane-ideal          4              38     1602    1521   1349   15.8%   11.3%     631        0       0            0
  merge-lane-ideal          5              34     1578    1482   1418   10.1%    4.3%     632        0       0            0
  merge-lane-ideal       drop vs 5-min max 13.9% (9.6%–17.9%); vs 10-min pre-mean 8.0% (4.3%–11.3%); 5/5 broke down   [1.4 min]
  merge-bicycle-ideal       1              29     1530    1419   1399    8.5%    1.4%     639        0       0            0
  merge-bicycle-ideal       2              27     1584    1344   1407   11.2%   -4.7%     631        0       0            0
  merge-bicycle-ideal       3              32     1656    1497   1382   16.5%    7.7%     667        0       0            0
  merge-bicycle-ideal       4              34     1626    1515   1299   20.1%   14.2%     649        0       0            0
  merge-bicycle-ideal       5              31     1578    1338   1380   12.5%   -3.1%     624        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 13.8% (8.5%–20.1%); vs 10-min pre-mean 3.1% (-4.7%–14.2%); 5/5 broke down   [9.6 min]
  merge-bicycle-human       1              35     1524    1359   1230   19.3%    9.5%     654        0       0            0
  merge-bicycle-human       2              27     1422    1344   1280   10.0%    4.8%     703        0       0            0
  merge-bicycle-human       3              25     1416    1113   1284    9.3%  -15.4%     633        1       2            0
  merge-bicycle-human       4              28     1416    1356   1325    6.4%    2.3%     659        0       0            0
  merge-bicycle-human       5              30     1380    1302   1252    9.3%    3.8%     669        2       2            0
  merge-bicycle-human    drop vs 5-min max 10.9% (6.4%–19.3%); vs 10-min pre-mean 1.0% (-15.4%–9.5%); 5/5 broke down   [14.7 min]
  drop-bicycle-ideal        1              32     1494    1242   1362    8.8%   -9.6%     948        0       0            0
  drop-bicycle-ideal        2              35     1614    1452   1340   17.0%    7.7%     951        0       0            0
  drop-bicycle-ideal        3              32     1554    1398   1356   12.7%    3.0%     979        0       0            0
  drop-bicycle-ideal        4              24     1380    1041   1325    4.0%  -27.3%     879        1       1            0
  drop-bicycle-ideal        5              36     1644    1434   1346   18.1%    6.1%     970        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 12.1% (4.0%–18.1%); vs 10-min pre-mean -4.0% (-27.3%–7.7%); 5/5 broke down   [25.0 min]
  drop-bicycle-human        1              35     1518    1449   1274   16.0%   12.0%    1022        1       2            0
  drop-bicycle-human        2              31     1500    1362   1276   15.0%    6.3%     990        1       0            0
  drop-bicycle-human        3              28     1404    1164   1259   10.3%   -8.2%     961        1       1            0
  drop-bicycle-human        4              35     1380    1320   1267    8.2%    4.0%     971        1       1            0
  drop-bicycle-human        5              34     1518    1398   1299   14.4%    7.1%    1007        1       1            0
  drop-bicycle-human     drop vs 5-min max 12.8% (8.2%–16.0%); vs 10-min pre-mean 4.3% (-8.2%–12.0%); 5/5 broke down   [32.0 min]
```
