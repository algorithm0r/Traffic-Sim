# Traffic Sim — DEVPLAN
*Living document, not frozen. Update as the design evolves.*

## Design spec (from Chris, 2026-07-10)
- One long freeway of 2, 3, or 4 lanes, broken into **segments** between exits and onramps;
  ramps are always on the right.
- The freeway **loops** — the end feeds back into the start (closed system).
- **Rendering:** the loop is drawn as several horizontal legs in a vertical stack; the bottom
  leg links back to the top leg.
- **Driver profiles** (heterogeneous agents): where they enter and exit; speed relative to the
  limit; lane-change behavior (moving into faster lanes, working right to make an exit);
  following distance; braking anticipation (how soon they brake).
- **Physics as advanced as we can get, grounded in real data** — the literature standard is
  IDM (Intelligent Driver Model, Treiber) for car-following + MOBIL for lane changes, with
  parameters calibrated against published empirical datasets (e.g. NGSIM). Candidate
  validation targets: the flow–density fundamental diagram, stop-and-go wave formation,
  capacity drop at onramps.

## Built
- Full IDM/MOBIL freeway on the looping road: 1-4 lanes, interchanges (onramp accel lanes
  with Poisson demand, destination exits with mandatory lane changes), four driver
  archetypes with literature-grounded spreads, stacked-leg renderer, live charts, headless
  runner + smoketest + validation suite. All headless checks PASS (see DEVLOG 2026-07-10).

## Not yet built
- Browser visual confirmed by Chris (headless render check passes; eyes pending).
- DB round-trip from this box (runner written; Server/Mongo not exercised this session).
- Calibration refinement: merge-zone capacity drop is 26% vs the empirical 5-20%.

## Stages
### Stage 1 — IDM car-following on the ring  [ DONE ]
- [x] Full parameter set in `params.js` (SI units; archetype table with literature values)
- [x] `Vehicle` with IDM acceleration + ballistic integration (`agent.js`)
- [x] `World`: loop geometry, per-lane sorted arrays, wrap-aware gaps, seeded PRNG
**Done when:** homogeneous single-lane ring holds vehicle count, stays collision-free, and
settles within 4% of the analytic IDM equilibrium speed (smoketest assertion). ✓ err 0.0%

### Stage 2 — MOBIL lane changes  [ DONE ]
- [x] MOBIL incentive + safety criterion (politeness, keep-right bias, cooldown)
- [x] Truck left-lane restriction (no lane 0 when ≥3 lanes)
**Done when:** heterogeneous 3-lane ring runs collision-free with lane changes occurring and
aggressive drivers averaging faster than cautious ones. ✓

### Stage 3 — Interchanges: onramps, exits, OD demand  [ DONE ]
- [x] Poisson arrivals per onramp; acceleration lane with end-of-ramp wall; urgency-relaxed
      merge safety (+ merge speed-matching, courtesy left-changes alongside active ramps)
- [x] Destination exits; mandatory rightward changes ramping with urgency; missed-exit
      retarget to next interchange (+ planning horizon blocking late overtakes)
**Done when:** with ramps active the sim spawns/merges/exits collision-free and the
missed-exit rate stays low. ✓ 0 collisions, missed exits ≈ 5%

### Stage 4 — Driver profiles  [ DONE ]
- [x] Archetypes (aggressive / normal / cautious / truck) with within-archetype spread,
      grounded in Treiber & Kesting parameter ranges and NGSIM calibration spreads
**Done when:** profile heterogeneity shows in behavior (speed ordering, truck lane usage)
under the smoketest. ✓

### Stage 5 — Rendering, UI, live charts  [ TESTING ]
- [x] Observer: stacked horizontal legs, bottom wraps to top; right-side ramp stubs; vehicles
      colored by speed or type
- [x] Control panel schema (lanes, density, demand, speed limit, trucks, speed)
- [x] Live mean-speed graph + flow–density scatter; DataManager packets
**Done when:** in-browser sim shows moving traffic on the stacked loop with working controls
(visual check: Chris). — headless render check passes; awaiting eyes

### Stage 6 — Validation vs expected output  [ DONE ]
- [x] `validate.mjs`: fundamental diagram vs analytic IDM equilibrium; capacity + congested-
      branch wave slope; stop-and-go wave speed; onramp breakdown experiment
**Done when:** all validation experiments land inside the expected bands from the traffic-flow
literature (see Design spec) and are recorded in the DEVLOG. ✓ VALIDATION PASS

### Stage 7 — Calibration & realism refinements  [ PLANNED ]
- [ ] Merge-zone discharge: raise toward the empirical 80-95% of capacity (candidates:
      ramp-head patience/forced merge, gap anticipation, higher fleet `a`)
- [ ] Open-boundary mode (independent upstream demand) for true capacity-discharge
      experiments alongside the closed loop
- [ ] Per-segment lane counts / lane drops; deceleration lanes at exits
**Done when:** capacity drop lands in the 5-20% empirical band under an open-boundary test.
