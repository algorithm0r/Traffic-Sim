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
- Scaffolded from engine v2 (vanilla-JS canvas + standard DB client). Demo "drifters"
  model runs in-browser and headless.

## Not yet built
- The actual Traffic Sim model.

## Stages
### Stage 1 — IDM car-following on the ring  [ ACTIVE ]
- [ ] Full parameter set in `params.js` (SI units; archetype table with literature values)
- [ ] `Vehicle` with IDM acceleration + ballistic integration (`agent.js`)
- [ ] `World`: loop geometry, per-lane sorted arrays, wrap-aware gaps, seeded PRNG
**Done when:** homogeneous single-lane ring holds vehicle count, stays collision-free, and
settles within 4% of the analytic IDM equilibrium speed (smoketest assertion).

### Stage 2 — MOBIL lane changes  [ PLANNED ]
- [ ] MOBIL incentive + safety criterion (politeness, keep-right bias, cooldown)
- [ ] Truck left-lane restriction (no lane 0 when ≥3 lanes)
**Done when:** heterogeneous 3-lane ring runs collision-free with lane changes occurring and
aggressive drivers averaging faster than cautious ones.

### Stage 3 — Interchanges: onramps, exits, OD demand  [ PLANNED ]
- [ ] Poisson arrivals per onramp; acceleration lane with end-of-ramp wall; urgency-relaxed
      merge safety
- [ ] Destination exits; mandatory rightward changes ramping with urgency; missed-exit
      retarget to next interchange
**Done when:** with ramps active the sim spawns/merges/exits collision-free and the
missed-exit rate stays low.

### Stage 4 — Driver profiles  [ PLANNED ]
- [ ] Archetypes (aggressive / normal / cautious / truck) with within-archetype spread,
      grounded in Treiber & Kesting parameter ranges and NGSIM calibration spreads
**Done when:** profile heterogeneity shows in behavior (speed ordering, truck lane usage)
under the smoketest.

### Stage 5 — Rendering, UI, live charts  [ PLANNED ]
- [ ] Observer: stacked horizontal legs, bottom wraps to top; right-side ramp stubs; vehicles
      colored by speed or type
- [ ] Control panel schema (lanes, density, demand, speed limit, trucks, speed)
- [ ] Live mean-speed graph + flow–density scatter; DataManager packets
**Done when:** in-browser sim shows moving traffic on the stacked loop with working controls
(visual check: Chris).

### Stage 6 — Validation vs expected output  [ PLANNED ]
- [ ] `validate.mjs`: fundamental diagram vs analytic IDM equilibrium; capacity + congested-
      branch wave slope; stop-and-go wave speed; onramp breakdown experiment
**Done when:** all validation experiments land inside the expected bands from the traffic-flow
literature (see Design spec) and are recorded in the DEVLOG.
