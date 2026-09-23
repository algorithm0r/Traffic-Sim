# Traffic Sim

An agent-based freeway traffic simulator: a looping multi-lane freeway (2-4 lanes) with right-hand onramps and exits, heterogeneous driver profiles, and car-following/lane-change physics grounded in real traffic data.

A browser-based agent-based simulation (vanilla JS + Canvas, no build step), scaffolded from
the shared engine v2.

## Run
- **Browser:** open `index.html`.
- **Headless batch:** `node runner.mjs --reps 50 [--params '{"laneCount":2}']` — runs the same
  sim core via `vm` and writes self-describing packets to MongoDB through the research Server.
- **Smoke test:** `node smoketest.mjs` — no DB, ~15 s; asserts conservation, collision-free
  running, the analytic IDM equilibrium, and renderer sanity.
- **Validation:** `node validate.mjs` — no DB, ~3 min; fundamental diagram vs analytic IDM,
  stop-and-go wave speed, onramp bottleneck breakdown, embodiment head-to-head, all
  against literature bands.
- **Safety sweep:** `node sweep.mjs` — no DB, ~5 min; near-crash and crash rates per
  1000 veh·km over density × reaction time × glance rate with human drivers.
- **Live:** https://algorithm0r.github.io/Traffic-Sim/

## Layout
- `src/` — sim core (`engine`, `params`, `world`, `agent`, `observer`, `datamanager`, `charts`,
  `util`) + `db.js` (vendored standard DB client) + `ui.js`/`main.js` (browser-only, all DOM).
- `runner.mjs` / `smoketest.mjs` — headless entry points.
- `DEVPLAN.md` / `DEVLOG.md` — the plan (forward) and the log (backward, append-only).

See `~/.claude/conventions.md` for the shared standards this follows.
