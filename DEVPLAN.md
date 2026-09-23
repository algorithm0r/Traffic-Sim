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

## Program goals (from Chris, 2026-09-22)
Two goals now steer everything after v0.3:

1. **A cleaner 2D model, less rule-based.** The bicycle body accumulated special cases for
   *merging* that ought to be consequences of *lane changing*: ramp-only speed matching,
   ramp-only safety schedules, courtesy keyed on ramp presence, taper-squeeze bookkeeping,
   straddler rules. The target: one lane-change model (continuous desire, LMRS-style) that
   covers discretionary changes, exits, merges, and lane drops with the same mechanism;
   the ramp is a lane that ends. Lateral interaction as clearance, not strip vetoes.
2. **Traffic safety with emergent accidents.** An accident is by definition emergent, so
   the model must not contain a crash rule. Instead the mechanisms that make crashes
   impossible today — a ground-truth emergency reflex, a ground-truth shoulder check, a
   hard safety criterion — become fallible perception processes (looming accumulator,
   attention/glances, skipped checks). Crashes then follow from their failure modes, and
   the validation targets are crash-type proportions and near-crash statistics.

The two goals converge on one change: strip ground truth out of the reflex, the shoulder
check and the claims, and replace them with a single perception-and-attention layer.

### Where this sits against the field (assessed 2026-09-22)
- **OpenTrafficSim** (TU Delft, Java, BSD-3) is the reference implementation of LMRS
  (Schakel, Knoop & van Arem 2012: route/speed/keep/courtesy incentives, synchronization,
  cooperation, relaxation) and of the Fuller task-demand human-factors framework (van Lint
  & Calvert 2018; Calvert & van Lint 2020: task saturation endogenously changes estimation
  error, reaction time, headway, speed; anticipation reliance). We borrow its *structure*
  for Stage 10 (desire, thresholds, relaxation) and Stage 11 (task demand → perception
  parameters). It is not a substrate: no steering body (lane path + lateral fraction), no
  crashes (i4Driving, its safety project, describes extending "collision-free driving
  models" and calls its state "from No to Maybe"), not embeddable in this stack.
- **Nearest papers for goal 1:** Kanagaraj & Treiber 2018 (IDM longitudinal + lateral
  relaxation + `pushlat`), Delpiano et al. 2020 (2D social-force for lane-disciplined
  freeways). See NOTES-2d-models.md.
- **Nearest models for goal 2:** Markkula et al. 2016 (brake response as evidence
  accumulation on looming, not a fixed reaction time) and Markkula 2018 (intermittent
  control — the architecture v0.3 already uses); SHRP2 / Klauer et al. on off-road
  glances as the leading rear-end mechanism; Hamdar, Mahmassani & Treiber 2008/2015
  (prospect-theory car-following where crashes emerge, NGSIM-calibrated); surrogate
  safety measures (TTC, PET, DRAC) as the abundant signal since crashes are rare.
- **The unoccupied square** remains: flow-capable × genuinely 2D (steered body) × human
  drivers × emergent crashes. Nothing published sits there.

### Control discipline
- v0.1 (lane body, 1D) stays untouched as the validated control. Restructuring is 2D-only.
- Every stage keeps `smoketest.mjs` and `validate.mjs` green, or re-baselines a check with
  the reason recorded in the DEVLOG entry. The suite is the regression test that the
  mechanisms the rule-based model discovered (DEVLOG 2026-07-11) survive the cleaner one.

## Built
- Full IDM/MOBIL freeway on the looping road: 1-4 lanes, interchanges (onramp accel lanes
  with Poisson demand, destination exits with mandatory lane changes), four driver
  archetypes with literature-grounded spreads, stacked-leg renderer, live charts, headless
  runner + smoketest + validation suite. All headless checks PASS (see DEVLOG 2026-07-10).
- Kinematic bicycle body (v0.2) and the human control loop (v0.3): see Stages 7 and 9.

## Not yet built
- DB round-trip from this box (runner written; Server/Mongo not exercised).
- Browser check of the new merging and rotated bodies (Pages: algorithm0r.github.io/Traffic-Sim).
- Everything under Stages 11-13.

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

### Stage 5 — Rendering, UI, live charts  [ DONE ]
- [x] Observer: stacked horizontal legs, bottom wraps to top; right-side ramp stubs; vehicles
      colored by speed or type
- [x] Control panel schema (lanes, density, demand, speed limit, trucks, speed)
- [x] Live mean-speed graph + flow–density scatter; DataManager packets
**Done when:** in-browser sim shows moving traffic on the stacked loop with working controls
(visual check: Chris). ✓ confirmed in-browser 2026-07-12 (commit c10a4ec)

### Stage 6 — Validation vs expected output  [ DONE ]
- [x] `validate.mjs`: fundamental diagram vs analytic IDM equilibrium; capacity + congested-
  branch wave slope; stop-and-go wave speed; onramp breakdown experiment
**Done when:** all validation experiments land inside the expected bands from the traffic-flow
literature (see Design spec) and are recorded in the DEVLOG. ✓ VALIDATION PASS

### Stage 7 — Kinematic bicycle body (embodiment control)  [ DONE ]
- [x] `bodyModel: 'lane' | 'bicycle'` switch; the validated 1D model untouched as control
- [x] Continuous (x, y, heading), steering cascade, maneuver lifecycle (commit/abort/expire)
- [x] Interaction geometry: min-rear-gap leader election, claimed-slot signal reading
      (comfort-bounded, 120 m), shoulder check + zipper drop-back, taper squeeze with
      pull-forward deadlock breaking and mirror check
- [x] Validation D: embodiment head-to-head (same brain, both bodies)
**Done when:** both bodies pass the full suite and the head-to-head quantifies embodiment. ✓
**Findings:** ring flows within 1.7% across bodies (k=12/25/40); lane changes take 2.7 s
mean; aborts emerge as real behavior; bottleneck discharge 102% of lane body BUT the
constraint relocates — the 1D body jams the mainline (Δ18 m/s), the 2D body meters the
ramp (queue 245, mainline fluid). Merge rate is ~55% of 1D (202 vs 360) — geometric
merging is expensive. Every 2D failure en route was a MISSING real-driver mechanism
(see DEVLOG 2026-07-11); the fix catalog is itself a research result.

### Stage 9 — Human control loop (v0.3, start of "our model")  [ DONE ]
- [x] Four continuous per-driver parameters, ideal controller = a point in the space
      (`IDEAL_CONTROL`, applied by suites): tReact (intermittent decisions, commands held
      open-loop), percErr (noisy gap/closing perception, 2× on closing), motorErr
      (tire-angle execution noise = wheel jitter / steering ratio; pedal ×20), laneTol
      (comfort band: hands-off inside — no heading straightening either — corrections
      restore margin)
- [x] Always-on emergency reflex (loom response + ramp wall) with startle; lateral
      reflex vs bodies alongside; anti-stalemate creep (a stopped car with clear
      pavement ignores phantom constraints after 3 s)
- [x] Steering planned over the driver's own hold horizon (dead-beat heading, 4× lateral)
- [x] T8 (wander emerges: SD 0.33 m, in-lane) + T9 (realistic traffic collision-free)
- [x] 2026-07-12: wall-straddler deadlock fixed (gore roll + creep-past-stalled-encroacher);
      acute D2 freeze gone; chronic human-mode merge congestion remains (→ Stage 10)
**Done when:** wander emerges from mechanism (not injected noise) in the empirical band,
controls regress clean at the ideal point. ✓
**Findings:** wander is perception-threshold-driven, not motor-driven (execution noise at
the tire is wheel jitter / ~15:1 ratio — at milliradian scale corrections drown in their
own noise); an instant-gain command held open-loop limit-cycles across the lane — drivers
must plan over their own reaction horizon; satisficing keeping without heading awareness
ping-pongs edge to edge; corrections restore margin or drivers pile up bimodally at band
edges. Lane changes run ~2.8× the ideal rate under wander (drivers near lines inherit
neighbor-lane leaders) — a genuine micro→macro coupling to study.

### Stage 10 — One lane-change model: desire, relaxation, cooperation (goal 1)  [ DONE ]
The ramp becomes a lane that ends. Every lateral decision runs through one continuous
**desire** per side (LMRS structure, MOBIL brain kept as the voluntary incentive so the
1D control comparison survives):
- [x] **Road geometry:** through lanes 0..N-1 on the whole loop; each onramp is auxiliary
      lane N over [gore, gore+len] with the pavement edge tapering over the next 35 m.
      `outerEdge(x)`, `laneEndDist(veh)`; the lane end is an obstacle at v=0 (plain IDM),
      not a special wall model. A non-changing vehicle stays inside its lane band, so the
      taper can never squeeze it into an occupied slot — the squeeze/straddler block goes.
- [x] **Route desire** (one function for merges, exits, lane drops): d = max(1 − x/(n·x0),
      1 − t/(n·t0)) toward the required side, negative toward the wrong side. x0 = the
      driver's `exitPrep` for exits (route knowledge), the LMRS 295 m for a lane end
      (visible geometry); t0 = 43 s.
- [x] **Voluntary desire** = MOBIL gain (politeness, keep-right) × `desirePerGain`, so the
      classic 0.1 m/s² threshold maps onto d_free = 0.365; θ-weighted against route desire.
      Courtesy = desire to vacate a lane someone with d ≥ d_coop wants, keyed on that
      driver's actual desire, not on ramp presence.
- [x] **Thresholds:** d_free 0.365 (gap acceptance with bAccept(d) from bSafe to
      bAcceptMax and headway T(d)); d_sync 0.577 (signal on; synchronize speed to the
      target-lane leader, decel bounded by b); d_coop 0.788 (the would-be follower
      cooperates: follows the claimant with T(d), yield bounded by its politeness-scaled
      comfortable braking). Replaces urgency, `forced`, bSafeM, ramp speed-matching, and
      the 250-m courtesy rule.
- [x] **Relaxation** (Laval & Leclercq 2008; LMRS τ = 25 s): changer and new follower
      take the accepted headway and relax to their own T. This is the mechanism the
      capacity-drop literature says merge discharge depends on.
- [x] **Lateral clearance** replaces the strip veto: lateral motion allowed up to a safety
      clearance from bodies alongside; drop back when none. Same function serves the
      peripheral-vision reflex.
- [x] Suites green (T5-T9, validation A-D) with re-baselines recorded; D2 discharge
      measured against the old 1305 veh/h/ln and the empirical 80-95% band.
- [x] **Rotated body** (v0.4.1): segments along the heading in every geometric query, and
      the bicycle pivots about the rear (the front-referenced integration swept a steering
      truck's tail sideways). Probe: 3 lanes, k=22, 1200 veh/h ramps, seed 5 — 48 grazes /
      34 stuck → 0 / 4.8.
**Done when:** `world.js` has no ramp-specific decision branch — `onRamp` is only a lane
identity — and the bicycle body passes the full suite with merge discharge at or above
the v0.2 number. ✓ 2026-09-22: discharge 1422 veh/h/ln (v0.2: 1305; lane body 1230; HEAD
deadlocked at 375), 0 rear-ends, 1 graze; suites PASS; T1-T3 byte-identical.
**Findings:** the deadlock class was three mechanisms, none of them a "merge" rule — a
merger losing its lane identity when squeezed across the line, an edge clamp halving the
heading component steering away from the edge, and IDM saturating at exactly −bMax so the
follower that most needed to see an entering body was the one that didn't. The 2D body's
capacity drop lands at 15% (empirical 5-20%) where the 1D body's is 27% — relaxation +
desire-scaled acceptance are what the capacity-drop literature says they are. The ideal
point still evaluates desire every tick (8 neighbour scans → 4); smoke 35 s vs 25 s.

### Stage 11 — Fallible perception: the layer accidents come from (goal 2)  [ DONE ]
Ground truth leaves the driver. No crash rule anywhere; crashes are physical overlaps.
- [x] **Looming accumulator** replaces the threshold reflex: brake response is evidence
      accumulation on perceived looming (required deceleration as perceived), with a
      per-driver gain. At the ideal point it recovers the old reflex exactly (suites
      byte-identical).
- [x] **Attention:** off-road glances as a process (Poisson rate, lognormal duration,
      suppressed by inverse-TTC task demand, begun only when the car is stable with the
      wheel centred). During a glance nothing is perceived, commands stay held, the
      accumulator does not accumulate. Rear-ends emerge when a glance meets a lead
      braking event (T10: 60 of 164 crashes).
- [x] **Peripheral lane awareness during glances** (Summala 1996): coarse correction when
      the body's edge nears a line, glance continuing, longitudinal still blind. Worst
      excursion 1.33 → 0.92 m; T10 departures 14 → 2; dense-jam stuck 21 → 0.7.
- [x] Looming evidence scales with visual-angle rate (Markkula: accumulation ∝ θ̇), so the
      brake fires at once close in and slowly far out; glances begin only when nothing is
      developing ahead.
- [x] **Shoulder check as a glance** that can be skipped (per-driver probability, once per
      maneuver), so lateral clearance is *believed*, not known → sideswipes emerge (T10: 28).
- [x] **Post-crash state:** contacts above crawl speed stop both vehicles as obstacles →
      secondary crashes emerge (T10: 18); incidents clear after 120 s. Shoulder + run-off-road.
- [x] **Conflict metrics (partial):** TTC with hysteresis → near-crash counts; DRAC is the
      reflex's danger signal; crash log with type (rear-end / sideswipe / departure /
      secondary / merge-involved), speed, glance state, heading.
- [x] PET at lane-change completion; `sweep.mjs` — near-crash rate rises with density
      (6/6) and tReact (5/6). Finding: slow reactors at k=25 collapse the ring.
**Done when:** at the ideal point the suite is unchanged; with realistic attention the
model produces crashes at a nonzero rate whose type mix is plausible, and near-crash
counts scale with density and tReact in the expected direction. ✓ 2026-09-23: suites
unchanged; T10 mix rear-end 42 / sideswipe 19 / departure 2 / secondary 12; sweep 6/6
and 5/6. Magnitudes ~100× empirical — Stage 12.

### Stage 12 — Safety validation & calibration  [ ACTIVE ]
- [ ] Crash-type proportions vs NHTSA/GES freeway shares; near-crash : crash ratio vs
      SHRP2; crash rate per VMT order of magnitude (rarity is the challenge — expect to
      lean on surrogates).
- [x] The tReact × density phase diagram (`phase.mjs`, 6×6×3 seeds, results/phase.md):
      the breakdown boundary runs diagonally — fluid to k=25 at 1.0×, breaks at k=20 at
      1.3×, at k=12 at 2.0×; near-crash rate spans 0.1 → 459 per 1000 veh·km; wave-onset
      std tracks the same boundary. Reaction time is a phase-transition control parameter.
- [ ] Phase diagram as a figure (boundary drawn, more seeds per cell, longer runs); the
      write-up of the finding
- [x] Reference rates grounded (SHRP2 NDS: 35 M miles, 1,541 crashes, 2,705 near-crashes
      → 0.027 crashes and 0.048 near-crashes per 1000 veh·km, all severity; experienced
      adults 37 near-crashes per million miles). These, not police-reported rates, are the
      comparison for a sim that counts any contact at speed.
- [x] `calib.mjs` (k=15, 900 s × 3 seeds ≈ 12,000 veh·km per variant): defaults give
      0 crashes (upper bound ~0.08, consistent with 0.027) and 0.66 near-crashes per 1000
      veh·km (~14× SHRP2, ±60% Poisson). The glance-duration tail is the only lever that
      registers (σ 0.5 → 0.3: 0.16); tightening the comfort band makes wander WORSE
      (SD 0.33 → 0.41, the held-command overshoot T8 found); loomGain and checkProb do not
      register at this exposure. Defaults left alone — three events is no basis for tuning.
- [ ] Long-exposure runs (≥10⁵ veh·km per setting, runner.mjs overnight) before any
      default is moved; then the glance-duration distribution against Klauer/SHRP2
      (share of glances > 2 s) rather than against the near-crash rate directly
- [ ] PET-conflict share (~26% of changes < 1 s) vs NGSIM lane-change headways
**Done when:** the safety indicators land in defensible bands and the sweeps are written up.

### Stage 13 — Calibration & realism refinements  [ PLANNED ]
- [ ] Open-boundary mode (independent upstream demand) for true capacity-discharge
      experiments alongside the closed loop
- [ ] Lane drops and deceleration lanes at exits — both fall out of Stage 10's
      lane-that-ends geometry
- [ ] Merge-zone discharge into the empirical 80-95% band under the open-boundary test
**Done when:** capacity drop lands in the 5-20% empirical band under an open-boundary test.
