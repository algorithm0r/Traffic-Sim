# Safety exposure across traffic regimes

Interchange loop (3 lanes, 6 km, 3 interchanges, 800 veh/h per ramp), human drivers at calibrated defaults, variant {"attention":{"signalAware":true},"lc":{"bAcceptMax":5}}, 60 seeds × 1500 s after a 300-s warm-up per density. Generated 2026-09-25T06:41:07.528Z.

| k (veh/km/ln) | veh·km | mean speed (mph) | detector std (m/s) | crash events | per 1000 veh·km | rear-end | sideswipe | run-off | secondary | lane-change involved | near-crashes /1000 veh·km | evasive (≥0.5 g) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 8 | 525234 | 48 | 1.1 | 55 | 0.100 | 14 (25%) | 41 (75%) | 0 (0%) | 5 | 42 | 19.256 | 15.486 |
| 20 | 593814 | 24 | 0.8 | 17 | 0.028 | 3 (18%) | 14 (82%) | 0 (0%) | 1 | 14 | 78.984 | 58.352 |
