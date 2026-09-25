# The Enhanced IDM: fewer hard brakings, twice the crashes

*Results note, 2026-09-25 (Stage 17, first item). Data: `mergeconflict-eidm*.txt`,
`capdrop-eidm-*` (seeds 1–5), `capdrop-rep-{idm,eidm}` (seeds 6–15, human drivers),
`phase-eidm.{md,json}`. The option: `coolness` in `src/params.js` (0 = pure IDM, the default;
the literature value is 0.99). Crash traces: `node probes/eidmcrash.mjs`.*

## Why it was tried

Stage 16 (`sumo-note.md`) found that 77–80% of our fleet's ≥ 0.5 g braking at bottlenecks was
IDM's (s*/s)² term saturating at the 9 m/s² cap on close cut-ins that needed only about
3 m/s². The Enhanced IDM (Kesting, Treiber & Helbing 2010) is the established fix. It adds a
constant-acceleration heuristic (CAH): the braking that avoids a collision if the leader keeps
its current acceleration. When IDM brakes harder than CAH, the command relaxes toward CAH.

In steady following it reduces to IDM. It was applied to the driving command only; MOBIL and
gap acceptance still evaluate plain IDM. The leader's acceleration is taken as seen, the
brake-light cue.

On canonical cases it does what it should:

| situation | IDM | Enhanced IDM | kinematic requirement |
|---|---|---|---|
| cut-in 4.7 m ahead, closing at 6 m/s | −9.0 | −5.6 | 3.8 |
| cut-in 2 m ahead, same speed | −9.0 | −0.8 | 0 |
| stopped leader 10 m ahead | −9.0 | −9.0 | 16.2 |

Steady following is unchanged. Values are in m/s².

## Results (coolness 0.99 vs pure IDM)

| measure | IDM | Enhanced IDM |
|---|---|---|
| evasive near-crashes, merge, 2 seeds (ideal / human) | 262 / 554 | 177 / 315 |
| of which the car-following law braked (ideal / human) | 202 / 435 | 40 / 89 |
| of which the reflex braked (ideal / human) | 60 / 119 | 137 / 226 |
| TTC < 1.5 near-crashes per 1000 veh·km (ideal / human) | 6.4 / 17.0 | 7.3 / 16.5 |
| **crashes, human drivers, 20 seeds each of merge and drop** | **29** | **62** |
| crashes, ideal drivers, seeds 1–5 | 1 | 1 |
| capacity drop (hold measure), four cases | 9.7–14.2% | 11.5–17.0% |

- **Hard braking halves** for human drivers, as intended. Some of the shift toward the reflex
  is relabelling: IDM's instant 9 m/s² kept the looming evidence below threshold, and a calmer
  response lets it build.
- **Near-crash counts don't move.** A TTC < 1.5 episode is created by the cut-in's geometry
  before anyone responds, which is consistent with Stage 16. SUMO's LC2013 has few because it
  makes few such cut-ins.
- **Crashes with human drivers double.** The first five seeds gave 8 against 19. Ten fresh
  seeds per case gave 21 against 43 (0.042 → 0.095 per 1000 veh·km at the merge, 0.054 → 0.105
  at the drop). With ideal drivers there is no change.
- **The capacity drop survives** and stays within the empirical 5–20%. Our drop was never an
  artifact of IDM over-braking.

## Congestion dynamics (phase diagram, `phase-eidm.md`)

- **At normal and faster reaction times (≤ 1.0×),** both models are steady to k = 30.
- **Slow reactions stop breaking the ring.** At 1.6× the ring breaks only at k = 30, not from
  k = 25. At 2.0×, k = 16 and 20 become steady, and k = 25 breaks with half the detector
  swing.
- **The broken cells get much safer.** At k = 20 × 2.0, near-crashes fall from 214 to 6 and
  crashes from 1.44 to 0.16 per 1000 veh·km.
- **The dense edge gets worse.** k = 30 × 1.3 goes from 0 crashes to 0.69, and dense steady
  cells show slightly more near-crashes.
- **A one-seed ring check at k = 35** gave 25% more flow and half the speed swing.

Our fleet was already on the stable side at normal reaction times. The Enhanced IDM moves it
further from the stop-and-go that real traffic shows near capacity.

## Mechanism: not yet traced

Traces of five crashes (`probes/eidmcrash.mjs`) show the same shape as under IDM.

- **Three are high-closing cut-ins.** A slow car enters the faster lane 6–20 m ahead of a
  follower closing at 11–18 m/s. The reflex fires within half a second and brakes at
  9 m/s², but there isn't room.
- **One is a glance-then-brake rear-end.**
- **One is a ramp vehicle struck from behind.** Its trace shows the striker's speed jumping
  from 8.8 to 18.5 m/s in half a second, which is physically impossible, so it is probably a
  probe artifact (perhaps an id reused at the road boundary). It is not interpreted.
- **The car-following law never gets a say in the final second,** so the Enhanced IDM's
  effect on crashes must be indirect.

Two hypotheses are untested:

- Cool followers do not back off after a cut-in, so traffic runs with less buffer when the
  next disturbance arrives.
- Damped waves change how fast each lane flows, so the speed gap between lanes grows, and
  with it the closing speed of cut-ins.

The Enhanced IDM was designed for ACC vehicles, which perceive continuously. Our human
drivers hold commands for their reaction time and perceive with error, and its cool response
may assume more than they have.

## Decision

**Not adopted.** `coolness` stays 0. The Enhanced IDM trades IDM's over-braking for a doubled
crash rate among human drivers and over-stabilised congestion. The conflict excess found in
Stage 16 is set by the cut-ins themselves: their closing speeds and where they happen. That
is where Stage 17 goes next.
