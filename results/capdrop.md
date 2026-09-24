# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-24T14:33:15.397Z.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-lane-ideal          1              40     1590    1341   1239   22.1%    7.6%     654        0       0            0
  merge-lane-ideal          2              31     1524    1428   1310   14.0%    8.2%     659        0       0            0
  merge-lane-ideal          3              29     1500    1275   1265   15.7%    0.8%     619        0       0            0
  merge-lane-ideal          4              34     1602    1506   1297   19.0%   13.9%     603        0       0            0
  merge-lane-ideal          5              29     1506    1365   1259   16.4%    7.8%     612        0       0            0
  merge-lane-ideal       drop vs 5-min max 17.4% (14.0%–22.1%); vs 10-min pre-mean 7.7% (0.8%–13.9%); 5/5 broke down   [3.1 min]
  merge-bicycle-ideal       1              27     1368    1296   1308    4.4%   -0.9%     677        0       0            0
  merge-bicycle-ideal       2              26     1554    1416   1256   19.1%   11.3%     650        0       0            0
  merge-bicycle-ideal       3              20     1422    1233   1195   16.0%    3.1%     709        0       0            0
  merge-bicycle-ideal       4              29     1398    1275   1342    4.0%   -5.2%     621        0       0            0
  merge-bicycle-ideal       5              23     1284    1218   1269    1.1%   -4.2%     638        0       0            0
  merge-bicycle-ideal    drop vs 5-min max 8.9% (1.1%–19.1%); vs 10-min pre-mean 0.8% (-5.2%–11.3%); 5/5 broke down   [19.9 min]
  merge-bicycle-human       1              26     1410    1296   1186   15.9%    8.5%     641        0       0            0
  merge-bicycle-human       2              26     1530    1392   1251   18.2%   10.1%     619        0       0            0
  merge-bicycle-human       3              20     1254    1203   1142    9.0%    5.1%     623        0       0            0
  merge-bicycle-human       4              25     1350    1287   1230    8.9%    4.4%     630        0       0            0
  merge-bicycle-human       5              25     1290    1161   1262    2.2%   -8.7%     616        0       0            0
  merge-bicycle-human    drop vs 5-min max 10.8% (2.2%–18.2%); vs 10-min pre-mean 3.9% (-8.7%–10.1%); 5/5 broke down   [26.9 min]
  drop-bicycle-ideal        1              30     1410    1311   1274    9.6%    2.8%     913        0       2            0
  drop-bicycle-ideal        2              31     1494    1395   1300   13.0%    6.8%     943        0       0            0
  drop-bicycle-ideal        3              28     1254    1173   1281   -2.1%   -9.2%     919        0       0            0
  drop-bicycle-ideal        4              28     1428    1332   1319    7.6%    1.0%     972        0       1            0
  drop-bicycle-ideal        5              33     1350    1269   1202   10.9%    5.3%     930        0       0            0
  drop-bicycle-ideal     drop vs 5-min max 7.8% (-2.1%–13.0%); vs 10-min pre-mean 1.3% (-9.2%–6.8%); 5/5 broke down   [36.9 min]
  drop-bicycle-human        1              28     1584    1407   1162   26.7%   17.4%     968        0       0            0
  drop-bicycle-human        2              30     1530    1350   1145   25.2%   15.2%     952        0       0            0
  drop-bicycle-human        3              34     1710    1500   1077   37.0%   28.2%     926        0       0            0
  drop-bicycle-human        4              30     1332    1251   1200    9.9%    4.1%     937        0       0            0
  drop-bicycle-human        5              25     1236    1119   1220    1.3%   -9.0%     943        1       1            0
  drop-bicycle-human     drop vs 5-min max 20.0% (1.3%–37.0%); vs 10-min pre-mean 11.2% (-9.0%–28.2%); 5/5 broke down   [43.2 min]
```
