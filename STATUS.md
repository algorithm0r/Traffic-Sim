# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-09-22 (Stage 10 close) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 10 `[ DONE ]` (one lane-change model: desire / relaxation / cooperation — merging is
lane changing) / Stage 11 `[ ACTIVE ]` (fallible perception: the layer accidents come from)

## State
- Program goals set 2026-09-22 (DEVPLAN): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. OpenTrafficSim assessed: borrow LMRS + Fuller structure,
  not a substrate (no steering body, no crashes).
- Bicycle body runs on ONE lane-change model: continuous desire per side (route + θ·MOBIL
  gain + courtesy), thresholds dFree/dSync/dCoop, T(d) + relaxation (τ 25 s), kinematic
  abort, forced regime on an ending lane, lateral clearance. The ramp is a lane that ends.
  No ramp-specific decision branch remains; `onRamp` is a lane identity.
- smoke 9/9 PASS + VALIDATION PASS @ v0.3-2-g798c7fd (2026-09-22);
  T1-T3 byte-identical to HEAD — the 1D control is untouched.
- Browser view UNVERIFIED since 2026-07-12 (new merging not yet eyeballed); DB path UNVERIFIED

## Metrics
- Controls unchanged: FD ≈1% of analytic; capacity 1836; waves 13 km/h; ring embodiment
  deltas ≤1.4% (k=12/25/40)
- D2 bottleneck (bicycle, seed 21): discharge 1422 veh/h/ln, 284 merges, breakdown Δ8.4
  m/s, 0 rear-ends, 1 graze — HEAD deadlocked here (375). 116% of lane body (1230); 85% of
  fleet ring capacity → 15% capacity drop (empirical 5-20%; lane body 27%). Seeds 22-24:
  1416-1461, 0 collisions. Human mode 40 min: 1346, 0 collisions, queue 373.
- T7: aborts 1 (was 40), expiries 0, missed exits 18 (was 77), ramp speed 13.5 m/s (was 11)
- Smoke runtime 35 s (was 25 s): desire evaluated every tick at the ideal point

## Branches / tags
- `main`; tags v0.1 (1D), v0.2 (bicycle), v0.3 (human loop). Stage 10 is a v0.4 candidate
  (not tagged — Chris's call)

## Open
- KNOWN LIMITATION: bodies are unrotated boxes at the front's y; a turning truck's tail is
  up to 4.7 m off → dense-jam grazes (T7dense probe: 48 grazes / 34 stuck at ideal; HEAD
  35 stuck + 275 missed exits on the same config). Needs a rotated body in every query.
- Trucks are now 2.5 m wide (were 1.8 since v0.2 — width was never copied)
- Lane-change RATE is uncalibrated (T7 ~2300/10 min on 6 km × 3 lanes) — a Stage 12 target
- Chris to eyeball the new merging in-browser (Body: bicycle)

## Next action
Rotated body geometry (probe: 3 lanes, k=22, 1200 veh/h ramps, seed 5). Then Stage 11:
looming accumulator replaces the threshold reflex; glances; shoulder check as a glance;
post-crash state; TTC/PET conflict metrics.

## Blockers
- none
