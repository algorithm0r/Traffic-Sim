# Traffic Sim

An agent-based freeway traffic simulator: a looping multi-lane freeway (2-4 lanes) with right-hand onramps and exits, heterogeneous driver profiles, and car-following/lane-change physics grounded in real traffic data.

A browser-based agent-based simulation (vanilla JS + Canvas, no build step), scaffolded from
the shared engine v2.

## Run
- **Browser:** open `index.html`.
- **Headless batch:** `npm install` once, then `node runner.mjs --reps 50 [--params '{"laneCount":2}']
  [--tag "why"] [--scratch]` — runs the same sim files in the main realm (`headless.mjs`) and
  writes self-describing packets to MongoDB through the research Server (`--transport direct`
  on mint itself) into the next `batch_NNN`.
- **Smoke test:** `node smoketest.mjs` — no DB, ~25 s; asserts conservation, collision-free
  running, the analytic IDM equilibrium, and renderer sanity.
- **Validation:** `node validate.mjs` — no DB, ~2 min; fundamental diagram vs analytic IDM,
  stop-and-go wave speed, onramp bottleneck breakdown, embodiment head-to-head, all
  against literature bands.
- **Safety sweep:** `node sweep.mjs` — no DB, ~5 min; near-crash and crash rates per
  1000 veh·km over density × reaction time × glance rate with human drivers.
- **Phase diagram:** `node phase.mjs --seeds 1,2,3,4,5` (~9 min) then `node phasefig.mjs` —
  reaction time × density grid → `results/phase.{json,md,html}`; the finding is written up
  in `results/phase-note.md`.
- **Calibration:** `node calib.mjs` — ~2 min per variant; default-attention safety rates vs
  SHRP2 across parameter variants → `results/calib.md`; the calibration story is
  `results/calib-note.md`; lateral measures via `probes/lateral.mjs`.
- **Capacity drop:** `node capdrop.mjs --seeds 1..5` — ~48 min; open road, merge and lane
  drop, both bodies, the empirical protocol → `results/capdrop.{md,json}`; written up in
  `results/capdrop-note.md`.
- **NGSIM calibration (Python: numpy, scipy, pandas):** `python tools/ngsim_fetch.py` (public API →
  data/, gitignored), then `tools/ngsim_calib.py` (per-episode), `tools/ngsim_classes.py --fix-b
  [--holdout]` (the adopted population calibration), `tools/ngsim_lanechange.py`; written up in
  `results/ngsim-note.md`.
- **Safety exposure:** `node exposure.mjs [--params JSON --out name]` — ~1 h on 14 workers; the
  interchange loop across five densities, crash types and rates → `results/exposure.{md,json}`;
  written up in `results/exposure-note.md`.
- **Open road / lane drops / deceleration lanes:** `openRoad`, `upstreamDemand`,
  `laneDropAt`, `decelLaneLength` in `src/params.js`.
- **Live:** https://algorithm0r.github.io/Traffic-Sim/

## Layout
- `src/` — sim core (`engine`, `params`, `world`, `agent`, `observer`, `datamanager`, `charts`,
  `util`) + `db.js` (vendored standard DB client) + `ui.js`/`main.js` (browser-only, all DOM).
- `runner.mjs` / `smoketest.mjs` — headless entry points.
- `DEVPLAN.md` / `DEVLOG.md` — the plan (forward) and the log (backward, append-only).

See `~/.claude/conventions.md` for the shared standards this follows.
