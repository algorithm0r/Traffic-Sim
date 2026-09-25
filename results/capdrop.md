# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T00:32:06.615Z.

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
  merge-bicycle-ideal    drop vs 5-min max 13.8% (8.5%–20.1%); vs 10-min pre-mean 3.1% (-4.7%–14.2%); 5/5 broke down   [8.8 min]
  merge-bicycle-human       1              25     1404    1344   1281    8.8%    4.7%     580        0       0            0
  merge-bicycle-human       2              28     1428    1302   1326    7.2%   -1.8%     624        0       1            0
  merge-bicycle-human       3              31     1392    1344   1252   10.1%    6.9%     685        1       0            0
  merge-bicycle-human       4              28     1350    1278   1301    3.6%   -1.8%     623        0       0            0
  merge-bicycle-human       5              23     1290    1173   1292   -0.2%  -10.2%     603        2       2            0
  merge-bicycle-human    drop vs 5-min max 5.9% (-0.2%–10.1%); vs 10-min pre-mean -0.4% (-10.2%–6.9%); 5/5 broke down   [13.8 min]
  drop-bicycle-ideal        1              32     1494    1242   1362    8.8%   -9.6%     948        0       0            0
  drop-bicycle-ideal        2              35     1614    1452   1340   17.0%    7.7%     951        0       0            0
  drop-bicycle-ideal        3              32     1554    1398   1356   12.7%    3.0%     979        0       0            0
  drop-bicycle-ideal        4              24     1380    1041   1325    4.0%  -27.3%     879        1       1            0
  drop-bicycle-ideal        5              36     1644    1434   1346   18.1%    6.1%     970        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 12.1% (4.0%–18.1%); vs 10-min pre-mean -4.0% (-27.3%–7.7%); 5/5 broke down   [23.9 min]
  drop-bicycle-human        1              36     1530    1368   1261   17.6%    7.8%     984        2       2            0
  drop-bicycle-human        2              32     1410    1350   1287    8.7%    4.7%    1016        1       1            0
  drop-bicycle-human        3              34     1590    1380   1280   19.5%    7.3%     964        0       0            0
  drop-bicycle-human        4              33     1434    1212   1294    9.7%   -6.8%     997        2       2            0
  drop-bicycle-human        5              36     1590    1482   1200   24.5%   19.0%     960        0       0            0
  drop-bicycle-human     drop vs 5-min max 16.0% (8.7%–24.5%); vs 10-min pre-mean 6.4% (-6.8%–19.0%); 5/5 broke down   [30.1 min]
```
