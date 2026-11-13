# Traffic Sim — STATUS
*One screen. The current pulse. Overwritten, never appended — for history read DEVLOG.*

**Updated:** 2026-11-13 (Stage 18 presentation done; Stage 17 in progress) — refreshed every session close; may carry unverified claims
**Verified:** 2026-07-10 (scaffold) — last cold audit (`/audit`); the State section is trusted only as of this date

## Stage
Stage 18 `[ DONE 2026-11-13 ]` (presentation: Claude Basic live view, scenario presets, for
showing incoming grad students). Stage 17 `[ IN PROGRESS ]` (merge and weaving safety) unchanged:
the zipper costs queue discharge; the tradeoff is with Chris (DEVLOG 2026-09-30)

## State
- Program goals (DEVPLAN, 2026-09-22): (1) cleaner, less rule-based 2D model; (2) traffic
  safety with EMERGENT accidents. Both landed (Stages 10, 11); Stage 12 is measuring them.
- Bicycle body: one lane-change model, rotated bodies, rear-pivot bicycle with a
  rear-referenced cascade. Perception fallible: looming-evidence reflex, glances as a
  process, peripheral lane keeping, shoulder-check skips, post-crash obstacles, TTC and
  PET metrics. No crash rule anywhere. Ideal point = v0.4.1 behaviour exactly.
- Browser (Stage 18, @ v0.9-5-gb11e421 pre-commit): Claude Basic 0.6.0 vendored in `vendor/`;
  `.cb-sim` layout, controls under the world, `<cb-sim-*>` charts (speed, speed heatmap, flow,
  queue, near-crashes, hard-braking rate vs SHRP2, crashes by type), a per-500-m Edie flow–density
  scatter, a "What am I looking at" card; six scenario presets (`src/scenarios.js`), opens on
  rush-hour interchanges. Looked at in the browser pane 2026-11-13 (dark + paper, wide + stacked)
- smoke PASS + VALIDATION PASS @ v0.9-5-gb11e421-dirty (2026-11-13, pre-commit); smoke output
  identical to b11e421 outside the renderer check T4 (model untouched). SWEEP last PASS
  2026-09-25 (not rerun). Runner → Server → Mongo round trip VERIFIED 2026-09-23 (scratch, dropped)
- Published: github.com/algorithm0r/Traffic-Sim; Pages at https://algorithm0r.github.io/Traffic-Sim/
  (Pages still serves the pre-Stage-18 view: the Stage 18 commit is local, not pushed)
- DB path VERIFIED (socket transport through the research Server on mint)
- Browser: Chris eyeballed the safety views, rotated bodies and merging 2026-09-23 —
  "looking great", and the phase figure 2026-09-24 ("really cool"). He has NOT yet seen the
  Stage 18 view. Bicycle body is the DEFAULT (suites pin 'lane' for the 1D controls)
- Open road (`openRoad`) for both bodies and lane drops (`laneDropAt`, bicycle); trucks'
  heading capped by length (the open-road merge exposed cab overshoot at the ideal point)

## Metrics
- Controls: FD ≈1% of analytic; capacity 1932 (homogeneous) and 1698 mixed fleet; waves
  13 km/h; bicycle bottleneck ≥80% of lane body; all suites PASS
- NGSIM (results/ngsim-note.md): population gap error 21.8% (was 22.1%), 90th pct 36% (40%),
  held-out the same; lane-change time gaps within 0.1-0.3 s of NGSIM at the median
- Lateral: SDLP 0.139-0.147 m ✓; lane changes 0.22/veh·km (highD 0.24) ✓; duration 3.1 s
- Plain ring k=15, 4.1×10⁵ veh·km: 0 crashes, near-crashes 0.025 (SHRP2 all-roads 0.048)
- Interchange exposure (results/exposure-note.md, 4.7 M veh·km): 0.040 crashes per 1000
  veh·km; rear-end share 24% → 42-50% into congestion (Golob's direction) but lane-change
  involved 74-92% everywhere (Golob: rear-ends prevail in congestion) — Stage 17
- Phase diagram (results/phase-note.md): steady to k=30 at ≤1.0×; breaks at 30 at 1.3×, 25
  at 1.6×, from 16 at 2.0×. Position depends on headways, lateral precision and attention
- Capacity drop (results/capdrop-note.md): 10.9-13.9% in all five cases (vs 5-min pre-max)
- vs SUMO (results/sumo-note.md): same capacity with matched IDM; drop ours 10-15%, LC2013
  −2-3% (ideal) / 7-10% (action step), SL2015 19-40% (deadlocks 6/20); TTC<1.5 conflicts per
  1000 veh·km LC2013 ~1, ours 6-18, SL2015 33-89. Ours are cut-ins braked by IDM saturating
- Enhanced IDM (coolness 0.99, not adopted): evasive braking halves, human crashes double
  (29 → 62), phase boundary moves out (over-stabilised)

## Branches / tags
- `main` tracks origin/main (at b11e421 as last fetched); the Stage 18 commit is local only; tags
  v0.1-v0.4.1, v0.5-v0.8, **v0.9** (2026-09-25: Stage 16, SUMO comparison)

## Open
- Realization variance 4-5× between independent 10⁵ veh·km sets — quote spreads, not Poisson
- Lane-change rate half of highD's (fleet speed spread differs) — recorded, not tuned
- Runtimes (main realm): smoke ~40 s; validate ~2 min; sweep ~3 min; phase ~9 min;
  calib ~2 min per variant; capdrop ~30 min; SUMO grid ~4 h CPU (SL2015 dominates)
- Workstation load: keep batches ≤4 processes (an 18-process batch hard-reset the machine)
- The browser view still writes a packet to the research DB at 30 sim-minutes (Backlog)
- The hard-braking near-crash chart shows the model ~10³× above SHRP2 in congested scenarios
  (Stage 17's problem, visible to any viewer; Backlog)

## Next action
Chris looks at the Stage 18 view (http://localhost:8000/research/Traffic%20Sim/sim/) and decides
whether to push it to Pages before showing the students. Research: Stage 17's zipper decision
with Chris (which claimants a follower yields to). Blocked item: a manual-driving
glance-duration reference for the attention tail.

## Blockers
- none
