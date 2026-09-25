# Capacity drop and conflicts: this model vs SUMO

Eclipse SUMO sumo 1.27.1; same geometry, demand and driver population as capdrop.mjs; SUMO seeds [1, 2, 3, 4, 5]. Generated 2026-09-25 14:04. Protocol: tools/sumo_capdrop.py; discussion: sumo-note.md.

P = peak 5-min downstream flow before minute 45; H = mean downstream flow over minutes 45-65 (veh/h/lane); hold drop = 1 - H/P. "Rule" columns use capdrop.mjs's breakdown rule (upstream speed below 60% of free flow for 5 min) and its drop vs the 5-min pre-breakdown max. Conflicts per 1000 veh·km: SUMO = SSM encounters with min TTC < 1.5 s / with max DRAC >= 4.9 m/s²; this model = near-crash episodes (TTC < 1.5 s, leader ahead) / those with braking >= 4.9 m/s².

| model | case | lane change / body | drivers | P | H | hold drop (range) | rule: broke | rule: drop | collisions | TTC<1.5 | hard (≥0.5 g) | veh·km |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| this model | merge | lane body | ideal | 1616 | 1376 | 14.8% (10 to 19) | 5/5 | 13.9% | 0 | – | – | 115k |
| this model | merge | bicycle body | ideal | 1595 | 1366 | 14.2% (9 to 20) | 5/5 | 13.8% | 0 | 6.28 | 5.70 | 113k |
| this model | merge | bicycle body | human | 1432 | 1290 | 9.7% (5 to 19) | 5/5 | 10.9% | 3 | 16.10 | 12.64 | 106k |
| this model | drop | bicycle body | ideal | 1552 | 1345 | 13.2% (8 to 18) | 5/5 | 12.1% | 1 | 6.15 | 5.62 | 115k |
| this model | drop | bicycle body | human | 1464 | 1280 | 12.5% (9 to 15) | 5/5 | 12.8% | 5 | 17.85 | 14.03 | 112k |
| this model, follower gap | drop | bicycle body | human | 1458 | 1313 | 9.9% (5 to 13) | 5/5 | 6.2% | 3 | 19.05 | 13.64 | 110k |
| this model, follower gap | drop | bicycle body | ideal | 1511 | 1363 | 9.7% (5 to 14) | 5/5 | 5.0% | 1 | 6.31 | 5.79 | 116k |
| this model, follower gap | merge | bicycle body | human | 1442 | 1320 | 8.5% (7 to 10) | 5/5 | 4.5% | 3 | 18.76 | 13.18 | 106k |
| this model, follower gap | merge | bicycle body | ideal | 1532 | 1379 | 10.0% (6 to 15) | 5/5 | 8.6% | 1 | 7.83 | 6.72 | 112k |
| SUMO | merge | LC2013 | ideal | 1498 | 1458 | 2.5% (-1 to 9) | 4/5 | -2.9% | 0 | 1.05 | 0.00 | 110k |
| SUMO | merge | LC2013 | human | 1466 | 1357 | 7.2% (1 to 16) | 5/5 | -1.6% | 0 | 0.86 | 0.00 | 105k |
| SUMO | merge | LC2013 | default | 2185 | 2147 | 1.5% (-10 to 8) | 0/5 | – | 0 | 0.12 | 0.00 | 148k |
| SUMO | merge | SL2015 | ideal | – | – | – | 0/5 (3 deadlocked) | – | 0 | 33.08 | 29.20 | 36k |
| SUMO | merge | SL2015 | human | 1098 | 812 | 22.9% (6 to 40) | 2/5 | 15.0% | 1 | 89.23 | 85.62 | 63k |
| SUMO | merge | SL2015 | default | 2160 | 2011 | 6.9% (4 to 12) | 0/5 | – | 0 | 21.47 | 18.30 | 145k |
| SUMO | drop | LC2013 | ideal | 1508 | 1532 | -1.6% (-7 to 2) | 0/5 | – | 0 | 0.25 | 0.00 | 119k |
| SUMO | drop | LC2013 | human | 1540 | 1377 | 10.2% (1 to 19) | 4/5 | 2.6% | 0 | 0.83 | 0.00 | 113k |
| SUMO | drop | LC2013 | default | 2137 | 2152 | -0.9% (-7 to 8) | 0/5 | – | 0 | 0.00 | 0.00 | 148k |
| SUMO | drop | SL2015 | ideal | 1534 | 1254 | 18.8% (0 to 47) | 2/5 (2 deadlocked) | 20.5% | 1 | 87.29 | 82.13 | 89k |
| SUMO | drop | SL2015 | human | 1422 | 849 | 40.0% (35 to 44) | 1/5 (1 deadlocked) | 28.1% | 0 | 71.77 | 66.33 | 80k |
| SUMO | drop | SL2015 | default | 2146 | 2139 | -0.0% (-6 to 9) | 0/5 | – | 0 | 18.02 | 15.41 | 148k |
