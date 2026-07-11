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
### Stage 1 — Replace the demo model  [ ACTIVE ]
- [ ] Define state + parameters in `params.js`
- [ ] Implement the agent/world dynamics (`agent.js`, `world.js`)
- [ ] Pick the metric(s) and wire `datamanager.js`
**Done when:** the sim shows the intended dynamics in-browser and `smoketest.mjs` asserts a
real invariant (not the demo drift check).

### Stage 2 — {{NEXT STAGE}}  [ PLANNED ]
- [ ] ...
**Done when:** ...
