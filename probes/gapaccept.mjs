// Stage 14: gaps at lane changes in the MODEL, measured as NGSIM measures them — at the
// moment a changing vehicle's centre crosses the lane line — for comparison with
// tools/ngsim_lanechange.py. Human drivers, bicycle body, 3-lane ring, density chosen to
// match NGSIM I-80's congested speeds (median ~8 m/s).
//   node probes/gapaccept.mjs [--k 45] [--seeds 1,2,3] [--secs 600]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const ks = flag('k', '35,45,55').split(',').map(Number);
const seeds = flag('seeds', '1,2,3').split(',').map(Number);
const secs = +flag('secs', '600');
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
for (const k of ks) {
  const rec = [];
  let vSum = 0, vN = 0;
  for (const seed of seeds) {
    Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0,
      loopLength: 4000, initialDensity: k, profileVariability: 1, truckFraction: 0.08, seed });
    const world = new ctx.World(), engine = new ctx.GameEngine();
    const prev = new Map();
    for (let t = 1; t <= secs / P.dt; t++) {
      engine.tick = t; world.update(engine);
      if (t < secs / P.dt / 3) continue;
      if (t % 20 === 0) for (const v of world.vehicles) { vSum += v.v; vN++; }
      for (const v of world.vehicles) {
        const lane = world.laneOf(v);
        const was = prev.get(v.id); prev.set(v.id, lane);
        if (was == null || was === lane || !v.changing || v.onRamp) continue;
        const band = world.laneBand(lane);
        const nl = world.scanAhead(v, band, 300), nf = world.scanBehind(v, band, 300);
        rec.push({ v: v.v, lead_gap: nl ? world.gapX(v, nl) : NaN, lag_gap: nf ? world.gapX(nf, v) : NaN,
                   lag_v: nf ? nf.v : NaN });
      }
    }
  }
  const lagT = rec.map((r) => r.lag_gap / Math.max(r.lag_v, 1)), leadT = rec.map((r) => r.lead_gap / Math.max(r.v, 1));
  const fmt = (a) => [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => q(a, p).toFixed(2)).join(' / ');
  console.log(`k=${k}: ${rec.length} changes, mean speed ${(vSum / vN).toFixed(1)} m/s, speed at change ${fmt(rec.map((r) => r.v))}`);
  console.log(`   lead gap m  ${fmt(rec.map((r) => r.lead_gap))}    lead time s ${fmt(leadT)}`);
  console.log(`   lag gap m   ${fmt(rec.map((r) => r.lag_gap))}    lag time s  ${fmt(lagT)}   lag<1s ${(100 * lagT.filter((x) => x < 1).length / lagT.filter(Number.isFinite).length).toFixed(0)}%`);
}
