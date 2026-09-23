# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-22 (v0.4.1) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 10 `[ DONE ]` (one lane-change model; rotated bodies) / Stage 11 `[ ACTIVE ]`
(fallible perception: the layer accidents come from)

## State
- Program goals set 2026-09-22 (DEVPLAN): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. OpenTrafficSim assessed: borrow LMRS + Fuller structure,
  not a substrate (no steering body, no crashes).
- Bicycle body runs on ONE lane-change model: continuous desire per side (route + θ·MOBIL
  gain + courtesy), thresholds dFree/dSync/dCoop, T(d) + relaxation (τ 25 s), kinematic
  abort, forced regime on an ending lane, lateral clearance. The ramp is a lane that ends.
- Bodies are rotated (segments along the heading; cars 2, trucks 6) and the bicycle pivots
  about the rear. Commanded heading capped at ~11°.
- smoke 9/9 PASS + VALIDATION PASS @ v0.4.1 (2026-09-22); T1-T3 byte-identical to v0.3 —
  the 1D control is untouched.
- Published: github.com/algorithm0r/Traffic-Sim (public); Pages on main at
  https://algorithm0r.github.io/Traffic-Sim/ (live, HTTP 200 @ 2026-09-22).
- Browser view UNVERIFIED since 2026-07-12 (new merging + rotated bodies not eyeballed);
  DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤2.8% (k=12/25/40)
- D2 bottleneck (bicycle, seed 21): discharge 1410 veh/h/ln, 332 merges, breakdown Δ11.9
  m/s, 0 rear-ends, 1 graze — v0.3 deadlocked here (375). 115% of lane body (1230); 84% of
  fleet ring capacity → 16% capacity drop (empirical 5-20%; lane body 27%). Seeds 22-24:
  1308-1356, 0 collisions. Human mode 20 min: 1263, 0 collisions.
- T7dense (3 lanes, k=22, 1200 veh/h ramps): 0 collisions, stuck 4.8 avg (v0.4: 48
  grazes / 34 stuck; v0.3: 35 stuck + 275 missed exits)
- T7: aborts 1, expiries 0, missed exits 16; T8 wander SD 0.328 m

## Branches / tags
- `main` tracks origin/main; tags v0.1 (1D), v0.2 (bicycle), v0.3 (human loop),
  v0.4 (Stage 10), v0.4.1 (rotated bodies)

## Open
- Lane-change RATE is uncalibrated (T7 ~2200/10 min on 6 km × 3 lanes) — a Stage 12 target
- Chris to eyeball merging + rotated bodies on the Pages site (Body: bicycle)
- Smoke runtime ~40 s (was 25 s at v0.3): desire evaluated every tick at the ideal point;
  segment loops in every scan

## Next action
Stage 11: looming accumulator replaces the threshold reflex; off-road glances; shoulder
check as a glance; post-crash state; TTC/PET conflict metrics. At the ideal point the
suite must be unchanged.

## Blockers
- none
