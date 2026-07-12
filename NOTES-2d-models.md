# Survey: 2D physics in microscopic traffic models (2026-07-11)

Two background research sweeps (literature + simulators), run while deciding whether to
extend our IDM+MOBIL lane-based core to continuous 2D. Condensed; links verified by the
agents except where flagged.

## The short answer
Genuine 2D exists but is fragmented — no 2D model has IDM/MOBIL-level adoption or an
NGSIM-grade calibration standard. Four camps:

### 1. Force-field generalizations of car-following (academic, closest to us)
- **Kanagaraj & Treiber 2018** (Physica A 509; arXiv:1805.05076): IDM kept as longitudinal
  kernel + OVM-style lateral relaxation toward a desired lateral position, anisotropic
  repulsion, and a `pushlat` parameter for nosing-in/gap negotiation. **Open-source JS:**
  github.com/MTGermany/mixedTraffic (runs in-browser — directly readable reference code
  in our own stack). Validation: stylized facts, not formal trajectory calibration.
- **Delpiano et al. 2020** (TR-C 114:504): 2D social-force-paradigm model aimed at
  *lane-disciplined freeway* traffic — the closest match to our research target. Captures
  merge relaxation, lateral friction (adjacent-lane speed contrast), sideswipe crashes as
  emergent. Follow-up: Delpiano TRR 2021 measures the lateral dimension empirically.
  (Full text paywalled; mechanism from abstract + secondary sources.)
- **Sharath & Velaga 2020** (TR-C 120): "enhanced IDM" — surrounding vehicles/boundaries
  as force stimuli, mixed-traffic motion planning. (Via the IDM-25-years review,
  arXiv:2506.05909.)
- Caution: Jiang 2014 / Tian 2016 "2D-IDM" is NOT spatial 2D (phase-plane naming trap).

### 2. Mixed/disordered traffic (Asia) — lateral forced by no lane discipline
- **Strip-based**: Mathew, Munigety & Bajpai 2015 (ASCE JCCE) — lanes cut into strips,
  quantized lateral movement; adopted (SiMTraM). CA with sub-cells: Mallikarjuna & Rao 2009.
- **Econometric, best trajectory-validated 2D**: Nirmale, Pinjari & Chakroborty 2024
  (TR-C) — joint discrete-continuous accel+lateral choice, latent driver classes,
  estimated on Chennai two-wheeler trajectories.

### 3. Industry — "continuous lateral position, no steering"
- **VISSIM**: continuous within-lane lateral position, overtake-within-lane, per-class
  lateral gaps (used for motorcycles/bikes/Indian traffic). Rule-driven position choice
  at capped lateral speed on top of Wiedemann. No heading dynamics.
- **Aimsun Next**: per-class "non-lane-based" mode — continuous optimal lateral position,
  car-following generalized to the most-restrictive leader in a lateral strip.
- **SUMO sublane model** (`--lateral-resolution`): continuous lateral position, stripe-
  granular decisions, `maxSpeedLat`/`lcAccelLat`/`lcPushy`; the most-adopted
  continuous-lateral model (hundreds of studies). Waves still emerge (IDM/Krauss under it).
- Industrial pattern: lateral coordinate + speed cap + strip leader-scanning — never
  heading/steering.

### 4. AV simulators & learned models — 2D bodies, 1D brains
- CARLA/DRIVE Sim/esmini/BeamNG: ego has full 2D/3D physics; background traffic is
  lane-graph waypoint following (NVIDIA's rule-based fallback is literally IDM along the
  centerline). Not flow-validated.
- Learned 2D simulators (Waymax, GPUDrive, TrafficBots, WOSAC): genuinely 2D trajectories
  but built on ~9 s Waymo snippets — no demand, no steady state, structurally unable to
  study waves/capacity. A 2026 benchmark (arXiv:2512.18537) found SUMO beats learned
  agents on long-horizon stability. **No published work uses these to study emergent
  flow — a real gap.**
- **TrafficFluid-Sim** (TU Crete, Papageorgiou; open-source SUMO fork): lane-free 2D
  force fields + "nudging", Lyapunov-proofed 2D cruise control (Automatica 2022) — the
  one lineage doing flow research in true 2D, but for CAVs, not human drivers.
- **highway-env** (MIT, Python, farama.org): the cleanest architecture demo — every
  vehicle a kinematic bicycle model; IDM+MOBIL as the decision layer, executed via
  lateral-position → heading → steering P-control cascade. A few hundred lines; the
  natural porting template for us.

## Implications for this project
1. Nothing existing is JS-embeddable; if we go 2D we build it — with three proven design
   points of increasing fidelity: (a) Aimsun/sublane-style lateral coordinate (cheapest),
   (b) highway-env-style bicycle model with steering cascade (true 2D, IDM+MOBIL brain
   preserved as control condition), (c) TrafficFluid-style lane-free forces.
2. Validation for 2D freeway physics is thin everywhere — nobody has the NGSIM-calibrated
   2D standard. Behavioral invariants + stylized facts is the honest bar.
3. The unoccupied square: flow-capable (long road, demand, steady state) × genuinely 2D
   × human drivers. Kanagaraj-Treiber and Delpiano are the nearest papers; neither has a
   widely-used implementation. Our micro↔macro program sits exactly there.
