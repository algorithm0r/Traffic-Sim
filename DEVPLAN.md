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
- [ ] Crash-type proportions vs a sourced freeway crash-type distribution. Still open: at
      calibrated defaults crashes are too rare to have a type mix (0 in 2×10⁵ veh·km on a
      basic segment); needs interchange geometry and ≥10⁶ veh·km, or a stressed population
      named as such (T10: rear-end 45, sideswipe 5, run-off 1, secondary 7).
- [x] Crash and near-crash rates per veh·km vs SHRP2 (results/calib-note.md): below the
      all-roads reference at the calibrated defaults, as a basic freeway segment should be;
      SHRP2 is a ceiling here, not a target
- [x] The tReact × density phase diagram (`phase.mjs`, 6×6×3 seeds, results/phase.md):
      the breakdown boundary runs diagonally — fluid to k=25 at 1.0×, breaks at k=20 at
      1.3×, at k=12 at 2.0×; near-crash rate spans 0.1 → 459 per 1000 veh·km; wave-onset
      std tracks the same boundary. Reaction time is a phase-transition control parameter.
- [x] Phase diagram as a figure (results/phase.html: boundary drawn, seed spreads per cell,
      5 seeds) and the results note (results/phase-note.md) — the transition is metastable on
      the boundary. Longer runs on the boundary cells remain a caveat.
- [x] Reference rates grounded (SHRP2 NDS: 35 M miles, 1,541 crashes, 2,705 near-crashes
      → 0.027 crashes and 0.048 near-crashes per 1000 veh·km, all severity; experienced
      adults 37 near-crashes per million miles). These, not police-reported rates, are the
      comparison for a sim that counts any contact at speed.
- [x] `calib.mjs` (k=15, 900 s × 3 seeds ≈ 12,000 veh·km per variant): defaults give
      0 crashes (upper bound ~0.08, consistent with 0.027) and 0.66 near-crashes per 1000
      veh·km (~14× SHRP2, ±60% Poisson). The glance-duration tail is the only lever that
      registers (σ 0.5 → 0.3: 0.16); the "wander" variant made wander WORSE (SD 0.33 →
      0.41) — CORRECTED 2026-09-24: it multiplied laneTol by 0.6, which WIDENS the band;
      the "held-command overshoot" explanation written here was wrong. loomGain and
      checkProb do not register at this exposure. Defaults left alone.
- [x] Long-exposure runs (25 seeds × 900 s ≈ 10⁵ veh·km per variant, results/calib.md):
      crash rate at defaults 0.010 (1 event; SHRP2 0.027 — consistent); near-crash rate
      0.52, of which 0.43 with ≥0.5 g braking — **~9× SHRP2 on SHRP2's own definition**,
      a real excess (±14%). Glance tail σ 0.5 → 0.3 halves it; a WIDER comfort band ×8
      worse; loomGain, checkProb no help. Defaults not moved.
- [x] Glance-duration distribution checked against the naturalistic baseline: 0.90 s mean,
      5.5% > 2 s, 7.9% eyes-off (naturalistic ~4% > 2 s) — not the problem. Near-crash
      metric split into longitudinal vs LATERAL conflicts (every default "near-crash" was
      lateral). Realization variance measured: 4-5× between independent 10⁵ veh·km sets.
- [x] The missing mechanism: glances budgeted against time headway (Tivesten & Dozza 2014),
      `glanceHeadwayFrac` 0.5 adopted — paired 27 → 8 near-crashes, evasive rate ≈ SHRP2.
- [x] The shoulder-check "anomaly" was a random-stream shift (probability exactly 1.0 skips
      a draw), i.e. realization variance. Closed.
- [x] Lane-position SD calibrated (probes/lateral.mjs): the "empirical 0.2-0.3" in the code
      was never sourced; the standardised on-road highway test gives SDLP 13.5-15.3 cm for
      sober drivers over 10-100 km. SD ≈ the comfort band's half-width / √3, so laneTol
      +0.35 m on every archetype: 0.32 → 0.147 m (T8 now asserts 0.10-0.20)
- [x] Lane-change duration: human mode 3.2 s vs NGSIM 4.0 ± 2.3 s, mode ~3 s (Thiemann,
      Treiber & Kesting 2008) — in range; the lateral-speed cap left alone (1.0 m/s gives
      exactly 4.0 s but adds lateral conflicts and moves the validated 2D control)
- [x] PET after a change: mean 1.8 s, ~30% < 1 s vs highD cut-in follower headways
      spanning 0.1-4 s and peaking at 1 s — consistent; closed
- [x] Lane-change rate: 0.13 per veh·km (k=15 ring, no ramps) vs highD 0.24 (11,000 changes
      over 45,000 km, German motorways). Within a factor of 2; highD's wider desired-speed
      spread (unlimited sections) means more passing. Recorded, not tuned
**Done when:** the safety indicators land in defensible bands and the sweeps are written up.
2026-09-24: every indicator with a sourced reference is in band or explained (SDLP, change
duration, PET, crash and near-crash rates, capacity drop); phase diagram, calibration and
capacity drop written up. Open: crash-type proportions (see above).

### Stage 13 — Open road, capacity drop, lane drops  [ DONE ]
- [x] Open-boundary mode (`openRoad`, both bodies): a 600-m void past the road's end
      keeps every wrap-aware scan unchanged; capacity-aware entrance; T11
- [x] Lane drops (`laneDropAt`, bicycle): an auxiliary lane from the entrance that ends
- [x] `capdrop.mjs`: the empirical capacity-drop protocol, merge and lane drop, both bodies
- [x] Truck heading capped by length (the capdrop probe's ideal-point "crashes")
- [x] Deceleration lanes at exits (`decelLaneLength`, bicycle, default 0 = the v0.4 control):
      an auxiliary lane that opens before the gore and ends there; exit-bound drivers move
      into it by route desire and slow to `exitSpeed` by the gore. T12: 484/488 exits via
      the lane, missed exits 13 → 9, collision-free
- [x] Merge-zone discharge into the empirical 80-95% band under the open-boundary test:
      queue discharge 83-93% of pre-breakdown flow across all five cases
- [ ] Follow-ups: more seeds per case (five pin a mean to ~±4 points); a second acceleration
      lane length and lane-drop geometry; the stochastic-breakdown curve (breakdown
      probability vs flow) the 2D body now exhibits
**Done when:** capacity drop lands in the 5-20% empirical band under an open-boundary test.
✓ 2026-09-24 (results/capdrop-note.md): case means 7.8-20.0% on the literature-style measure
(after lane-keeping calibration); the conservative estimator reads lower (1 to 11%), and the
truth lies between.

### Stage 14 — Trajectory-grounded drivers (NGSIM)  [ DONE ]
The v0.6 evaluation's first gap: every driver parameter is a literature range or an
aggregate target; none is fitted to trajectories, the field's standard of evidence.
- [x] Data: NGSIM I-80, 4:00-4:15 pm, 1.17 M rows, 1,972 vehicles, pulled from the public
      data.transportation.gov API (`tools/ngsim_fetch.py`) into data/ (gitignored)
- [x] Episodes: 927 car-following runs ≥ 30 s (877 car, 49 truck followers), Savitzky-Golay
      smoothing, tracking errors dropped (`tools/ngsim_common.py`)
- [x] Per-episode IDM fits (`tools/ngsim_calib.py`): 11% median gap error but NOT
      transferable — b and s0 at bounds in half the fits, v0 unidentifiable, and the
      low-T/high-s0 trade-off implies half-second highway headways
- [x] Population calibration instead (`tools/ngsim_classes.py`): three car classes + trucks by
      hard-assignment EM, bounds plausible at highway speed. b left free ran to its bound and
      fit no better than b fixed; adopted with b fixed at literature values (free b made
      cut-in drivers brake hard: near-crashes 3.5×). Adopted: T 0.85/1.39/2.05 s, shares
      29/38/33%. Gap error 21.8% (was 22.1%), tails 36% (40%); held-out drivers the same
- [x] Every suite and result rerun (results/ngsim-note.md): capacity 1836 → 1932
      (homogeneous), lane changes 0.13 → 0.22/veh·km (highD 0.24), near-crashes → 0.054
      (SHRP2 0.048), phase boundary moved inward, capacity drop 5.9-16.0%
- [x] Lane-change gap acceptance vs NGSIM (`tools/ngsim_lanechange.py`, `probes/gapaccept.mjs`):
      time gaps at the line crossing within 0.1-0.3 s at the median; model narrower
- [ ] Follow-ups: a free-flow trajectory set (highD, on request) to test v0 and headways at
      highway speed; joint calibration of attention with car-following (Stage 15)
**Done when:** the archetypes' car-following parameters are fitted to NGSIM, with a
trajectory error reported against the pre-calibration baseline, and every suite passes.
✓ 2026-09-24 (results/ngsim-note.md).

### Stage 15 — Safety exposure and joint calibration  [ DONE ]
- [ ] Joint calibration of attention with car-following: the NGSIM headways tighten the
      glance budget (glances > 2 s: 0.7%). BLOCKED on a reference: the "naturalistic ~4%"
      used since Stage 12 was measured with ACC + lane-keeping assist (corrected 2026-09-24);
      a manual-driving glance-duration distribution (100-Car / SHRP2 baseline epochs) is needed
- [x] The cut-in-then-brake mechanism checked: freeway near-crashes in SHRP2 are mostly
      rear-end and sideswipe avoidance around merging and lane changing (FHWA freeway-ops
      report) — consistent in kind; the model's interchange rates are far higher in degree
- [x] A freeway-specific reference: Golob, Recker & Alvarez (Orange County, six freeways,
      >1000 crashes, 8 traffic regimes), via FHWA's SHRP2 freeway-operations report fig. 4:
      heavily congested flow 83% rear-end; heavy variable free flow 79% rear-end + lane-change;
      light free flow 47% lane-change crashes. The crash MIX shifts with traffic state
- [x] `exposure.mjs` (results/exposure-note.md): interchange loop, 5 densities × 100 seeds,
      4.7 M veh·km. The SHIFT matches Golob (rear-end share doubles into congestion); the
      LEVELS don't (lane-change involved 74-92% everywhere). Mechanism traced: forced merges
      meeting a follower whose glance overlapped the conflict's onset; rear strikes on mergers
      read as sideswipes by the geometric classifier
- [x] Signal-aware glances adopted (no glance begins while a neighbour signals into my lane):
      paired seeds, crashes 45→31 (k=8), 45→27 (k=20). Capping forced merges at 5 m/s²
      tested and rejected (worse in light traffic)
**Done when:** crash-type shares and rates at calibrated defaults are compared with a
freeway-specific reference, by traffic regime. ✓ 2026-09-25 (results/exposure-note.md) —
compared; the model over-produces lane-change crashes (Stage 17).

### Stage 16 — Cross-model comparison  [ DONE 2026-09-25 ]
- [x] The capacity-drop experiment reproduced in SUMO 1.27.1 (`tools/sumo_capdrop.py`: IDM
      matched to our archetypes, LC2013 and SL2015, ideal / action-step / SUMO-default drivers,
      SSM conflicts), same geometry and demand profile; both models scored by one function
- [x] Where the numbers differ, trace which mechanism differs: same capacity (matched IDM);
      the drop and the conflict rate are set by the lane-change model. Gap acceptance explains
      a quarter to a third of our larger drop (`capdrop.mjs --gap follower`); the 2D body none.
      Our conflicts are cut-ins, 77-80% of their hard braking IDM saturating
      (`probes/mergeconflict.mjs`). Written up in `results/sumo-note.md`.
**Done when:** the capacity-drop result is reported for this model and SUMO side by side. ✓

### Stage 17 — Merge and weaving safety  [ IN PROGRESS ]
Stage 15's open finding: at interchanges three quarters or more of crashes involve a lane
change or merge at every density (Golob: rear-ends prevail at 54-83% in congestion), and
evasive near-crashes run far above naturalistic rates. The merge process itself, not
attention, drives it.
Stage 16 sharpened it: our TTC < 1.5 conflicts at bottlenecks are cut-ins (6-18 per 1000 veh·km
vs SUMO LC2013's ~1), and 77-80% of their ≥ 0.5 g braking is IDM's (s*/s)² term saturating at
bMax on a close cut-in, not the reflex. Stricter gap acceptance does not reduce them.
- [x] IDM's response to cut-ins: the Enhanced IDM constant-acceleration heuristic (Kesting,
      Treiber & Helbing 2010) — tried (`coolness`), NOT adopted: hard braking halves but human
      drivers' crashes double (29 → 62, replicated on fresh seeds) and congestion
      over-stabilises (results/eidm-note.md). The conflicts are set by the cut-ins themselves
- [x] The cut-ins vs NGSIM I-80 (results/cutins-note.md): ordinary lane changes match real
      ones at entry and at the centre crossing; the excess is ramp merges (TTC < 1.5 at entry 13×
      NGSIM). Ours merge right after the gore ~9 m/s below the mainline; real mergers match
      speed. Cause: MOBIL-style acceptance inside an LMRS desire model. LMRS's own acceptance
      (d·b, eq. 12; `lc.accept`) removes the early merges but raises conflicts (mergers stall
      and enter from a crawl) — not adopted yet
- [x] Overtakings per merger (tools/ngsim_overtakes.py, probes/overtakes.mjs): NGSIM I-80
      lane 7 mean 0.21, none overtaken by 3+; model 5-10 in congestion, 48-76% by 3+. Our gap
      creation GATES claims (LMRS clamps at −b; `lc.coop: 'lmrs'` added, helps partly); only
      the queue head claims (desire ≥ d_coop within ~60 m of the end); real mergers accept
      0.8-7 m gaps at matched speed that IDM's s0 forbids
- [ ] The zipper: calibrate the merge process to NGSIM lane 7 (overtakings, time in the
      auxiliary lane, gap and speed difference at entry) — levers: s0 relaxation during a
      merge, cooperation onset (d_sync vs d_coop), LMRS acceptance + clamp. Design decision
      with Chris
- [ ] How real mergers behave at the end of an acceleration lane: yield and wait vs force in
      (empirical merge-location and accepted-gap data at freeway onramps)
- [ ] Mainline anticipation of mergers beyond the claim (earlier yielding and lane changes
      away from the ramp), and whether the heading cap lets slow changers cut in too sharply
- [ ] Crash typing closer to police coding (struck-merger rear strikes vs true sideswipes)
**Done when:** lane-change involvement at interchanges falls toward Golob's regime shares
without losing the capacity-drop and phase results.
