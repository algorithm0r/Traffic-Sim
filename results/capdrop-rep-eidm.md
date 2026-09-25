# Capacity drop on an open road

Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate (mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated 2026-09-25T21:39:09.128Z. Variant: {"params":{"coolness":0.99},"gap":null}.

```
  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min
  merge-bicycle-human       6              32     1398    1350   1234   11.7%    8.6%     637        3       3            0
  merge-bicycle-human       7              22     1272     990   1317   -3.5%  -33.0%     616        2       1            0
  merge-bicycle-human       8              23     1548    1065   1314   15.1%  -23.4%     661        1       0            0
  merge-bicycle-human       9              26     1524    1398   1364   10.5%    2.4%     633        2       2            0
  merge-bicycle-human      10              25     1422    1218   1341    5.7%  -10.1%     669        1       2            0
  merge-bicycle-human      11              26     1518    1314   1299   14.4%    1.2%     668        1       1            0
  merge-bicycle-human      12              17     1284    1103   1302   -1.4%  -18.0%     678        3       3            0
  merge-bicycle-human      13              26     1404    1341   1322    5.9%    1.4%     612        1       0            0
  merge-bicycle-human      14              12      906     953   1360  -50.1%  -42.8%     665        3       2            0
  merge-bicycle-human      15              28     1494    1275   1313   12.1%   -2.9%     638        3       1            0
  merge-bicycle-human    drop vs 5-min max 2.0% (-50.1%–15.1%); vs 10-min pre-mean -11.7% (-42.8%–8.6%); 10/10 broke down   [16.4 min]
  drop-bicycle-human        6              34     1584    1506   1329   16.1%   11.7%    1044        0       0            0
  drop-bicycle-human        7              31     1290    1212   1231    4.6%   -1.6%     912        0       0            0
  drop-bicycle-human        8              32     1428    1212   1330    6.9%   -9.7%    1066        4       4            0
  drop-bicycle-human        9              29     1362    1245   1250    8.2%   -0.4%     954        1       1            0
  drop-bicycle-human       10              30     1434    1263   1266   11.7%   -0.2%    1000        2       3            0
  drop-bicycle-human       11              32     1428    1380   1264   11.5%    8.4%     977        2       2            0
  drop-bicycle-human       12              31     1656    1311   1264   23.7%    3.6%     985        7       9            0
  drop-bicycle-human       13              33     1440    1302   1206   16.3%    7.4%     907        2       3            0
  drop-bicycle-human       14              26     1236     972   1320   -6.8%  -35.8%     955        2       2            0
  drop-bicycle-human       15              36     1656    1485   1278   22.9%   14.0%    1065        3       7            0
  drop-bicycle-human     drop vs 5-min max 11.5% (-6.8%–23.7%); vs 10-min pre-mean -0.3% (-35.8%–14.0%); 10/10 broke down   [29.3 min]
```
