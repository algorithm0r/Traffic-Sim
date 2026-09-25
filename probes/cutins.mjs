// Stage 17: cut-ins in the MODEL, measured as tools/ngsim_cutins.py measures NGSIM I-80. At
// the moment a changer's centre crosses the line: the new follower's (lag's) gap, closing
// speed, TTC and required deceleration; then the lag's hardest 1-s mean deceleration over
// the next 4 s, against a control of random vehicle-moments. Human drivers, bicycle body.
//   node probes/cutins.mjs --setting ring  [--k 45] [--seeds 1,2,3] [--secs 600]
//   node probes/cutins.mjs --setting merge [--seeds 1,2,3]     (capdrop.mjs's merge, 65 min)
// Ramp merges are reported separately (NGSIM's comparison lanes are mainline 1-6).
import { writeFileSync } from 'fs';
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const setting = flag('setting', 'ring'), k = +flag('k', '45'), secs = +flag('secs', '600');
const seeds = flag('seeds', '1,2,3').split(',').map(Number);
const params = JSON.parse(flag('params', '{}')), out = flag('out', `cutins-${setting}`);
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const q = (a, p) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const share = (a, f) => { const s = a.filter(Number.isFinite); return s.length ? s.filter(f).length / s.length : NaN; };

const rec = [], ctrl = [], entry = [];
let ps = 12345; const prng = () => (ps = (ps * 1103515245 + 12345) % 2147483648) / 2147483648;
let vSum = 0, vN = 0;
for (const seed of seeds) {
  if (setting === 'ring') {
    Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0,
      loopLength: 4000, initialDensity: k, profileVariability: 1, truckFraction: 0.08, seed });
  } else {
    Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', openRoad: true, loopLength: 9000,
      openDeadZone: 600, laneCount: 2, numInterchanges: 1, demand: 600, laneDropAt: null,
      detectorFracs: [2400 / 9000, 4400 / 9000], upstreamDemand: 1800, initialDensity: 0, throughFraction: 1,
      profileVariability: 1, truckFraction: 0.08, seed });
  }
  for (const [key, val] of Object.entries(params)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
  }
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const every = Math.max(1, Math.round(0.1 / P.dt));            // sample speeds at 10 Hz, as NGSIM
  const total = setting === 'ring' ? Math.round(secs / P.dt) : Math.round(65 * 60 / P.dt);
  const warm = setting === 'ring' ? Math.round(total / 3) : Math.round(5 * 60 / P.dt);
  const prev = new Map(), pending = [], entered = new Set();
  const brake1 = (vv) => { let m = Infinity; for (let i = 0; i + 10 < vv.length; i++) m = Math.min(m, vv[i + 10] - vv[i]); return m; };
  for (let t = 1; t <= total; t++) {
    if (setting === 'merge') {
      const m = Math.floor(t * P.dt / 60);
      P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + 1800 * (m - 5) / 30 : 3600;
    }
    engine.tick = t; world.update(engine);
    if (t < warm) { for (const v of world.vehicles) prev.set(v.id, world.laneOf(v)); continue; }
    if (t % 20 === 0) for (const v of world.vehicles) { vSum += v.v; vN++; }
    for (const v of world.vehicles) {
      if (!v.changing) entered.delete(v.id);
      else if (!entered.has(v.id) && v.targetLane != null &&
               world.bandsOverlap(v.band(), world.laneBand(v.targetLane))) {
        entered.add(v.id);
        const nf = world.scanBehind(v, world.laneBand(v.targetLane), 100);
        if (nf) {
          const gap = world.gapX(nf, v), closing = nf.v - v.v;
          entry.push({ ramp: !!v.onRamp, v: v.v, lag_v: nf.v, wall: v.onRamp ? world.wallDist(v) : NaN, t: world.time,
                       lagYielding: nf.acc < -0.5, lag_gap: gap, closing,
                       req: closing > 0 ? closing * closing / (2 * Math.max(gap, 0.1)) : 0,
                       ttc: closing > 0 ? gap / closing : Infinity });
        }
      }
      const lane = world.laneOf(v);
      const was = prev.get(v.id); prev.set(v.id, lane);
      if (was == null || was === lane || !v.changing) continue;
      const nf = world.scanBehind(v, world.laneBand(lane), 100);
      if (!nf) continue;
      const gap = world.gapX(nf, v), closing = nf.v - v.v;
      const r = { ramp: !!v.onRamp, v: v.v, lag_v: nf.v, lag_gap: gap, closing,
                  req: closing > 0 ? closing * closing / (2 * Math.max(gap, 0.1)) : 0,
                  ttc: closing > 0 ? gap / closing : Infinity, vv: [nf.v], lag: nf };
      rec.push(r); pending.push(r);
    }
    if (t % every === 0) {
      for (let i = pending.length - 1; i >= 0; i--) {
        const r = pending[i];
        if (!world.vehicles.includes(r.lag)) { pending.splice(i, 1); delete r.lag; continue; }
        r.vv.push(r.lag.v);
        if (r.vv.length >= 41) {
          r.brake1 = brake1(r.vv); delete r.lag; delete r.vv; pending.splice(i, 1);
          if (r.ctrl) ctrl.push(r.brake1);
        }
      }
      // control: a random vehicle-moment, same 4-s window, not changing or being cut in on
      if (t % (every * 50) === 0 && world.vehicles.length) {
        const v = world.vehicles[Math.floor(prng() * world.vehicles.length)];   // own RNG: the sim's stream stays untouched
        if (!v.changing && !v.onRamp) pending.push({ ctrl: true, vv: [v.v], lag: v });
      }
    }
  }
}
const main = rec.filter((r) => !r.ramp && r.brake1 != null), ramp = rec.filter((r) => r.ramp && r.brake1 != null);
const fmt = (a) => [0.1, 0.25, 0.5, 0.75, 0.9, 0.99].map((p) => q(a, p).toFixed(2)).join(' / ');
const report = (lab, rs) => {
  if (!rs.length) return;
  console.log(`\n${lab}: n=${rs.length}, changer speed ${fmt(rs.map((r) => r.v))}`);
  console.log(`  closing (lag - changer) m/s ${fmt(rs.map((r) => r.closing))}`);
  console.log(`    share closing > 2 / 5 / 8 / 11 m/s: ${[2, 5, 8, 11].map((c) => (100 * share(rs.map((r) => r.closing), (x) => x > c)).toFixed(1) + '%').join(' / ')}`);
  console.log(`  required decel m/s²        ${fmt(rs.map((r) => r.req))}`);
  console.log(`    share > 1 / 2 / 3.4 / 4.9: ${[1, 2, 3.4, 4.9].map((c) => (100 * share(rs.map((r) => r.req), (x) => x > c)).toFixed(1) + '%').join(' / ')};  TTC < 1.5 s: ${(100 * share(rs.map((r) => r.ttc), (x) => x < 1.5)).toFixed(1)}%`);
  console.log(`  lag hardest 1-s decel      ${fmt(rs.map((r) => r.brake1))}`);
  console.log(`    share > 1 / 2 / 3 / 4.9: ${[1, 2, 3, 4.9].map((c) => (100 * share(rs.map((r) => r.brake1), (x) => x < -c)).toFixed(1) + '%').join(' / ')}`);
};
console.log(`${setting}${setting === 'ring' ? ' k=' + k : ''}, seeds ${seeds}, human drivers; mean speed ${(vSum / vN).toFixed(1)} m/s` +
  (Object.keys(params).length ? `; ${JSON.stringify(params)}` : ''));
report('mainline changes', main);
if (setting === 'merge') {
  report('  of which changer speed <= 15 m/s (NGSIM-like)', main.filter((r) => r.v <= 15));
  report('  of which changer speed > 15 m/s', main.filter((r) => r.v > 15));
}
report('ramp merges', ramp);
const rep2 = (lab, es) => {
  if (!es.length) return;
  console.log(`
${lab} AT ENTRY (near edge crosses the line): n=${es.length}`);
  console.log(`  lag gap m ${fmt(es.map((e) => e.lag_gap))}   closing m/s ${fmt(es.map((e) => e.closing))}`);
  console.log(`  share closing > 2 / 5 / 8: ${[2, 5, 8].map((c) => (100 * share(es.map((e) => e.closing), (x) => x > c)).toFixed(1) + '%').join(' / ')}` +
    `;  required > 2 / 3.4 / 4.9: ${[2, 3.4, 4.9].map((c) => (100 * share(es.map((e) => e.req), (x) => x > c)).toFixed(1) + '%').join(' / ')}` +
    `;  TTC < 1.5 s: ${(100 * share(es.map((e) => e.ttc), (x) => x < 1.5)).toFixed(1)}%`);
};
rep2('mainline changes', entry.filter((e) => !e.ramp));
if (setting === 'merge') { rep2('  changer <= 15 m/s', entry.filter((e) => !e.ramp && e.v <= 15)); rep2('  changer > 15 m/s', entry.filter((e) => !e.ramp && e.v > 15)); }
rep2('ramp merges', entry.filter((e) => e.ramp));
{
  const rm = entry.filter((e) => e.ramp), fast = rm.filter((e) => e.closing > 5), rest = rm.filter((e) => e.closing <= 5);
  const f2 = (a) => [0.1, 0.5, 0.9].map((p) => q(a, p).toFixed(1)).join(' / ');
  for (const [lab, g] of [['closing > 5 m/s', fast], ['closing <= 5 m/s', rest]]) {
    if (!g.length) continue;
    console.log(`
  ramp merges, ${lab} (n=${g.length}; 10th / 50th / 90th):`);
    console.log(`    merger speed ${f2(g.map((e) => e.v))}   follower speed ${f2(g.map((e) => e.lag_v))}   to lane end m ${f2(g.map((e) => e.wall))}`);
    console.log(`    follower already braking (< -0.5): ${(100 * g.filter((e) => e.lagYielding).length / g.length).toFixed(0)}%   minute ${f2(g.map((e) => e.t / 60))}`);
  }
}
console.log(`\ncontrol (random moments), n=${ctrl.length}: hardest 1-s decel ${fmt(ctrl)}`);
console.log(`    share > 1 / 2 / 3 / 4.9: ${[1, 2, 3, 4.9].map((c) => (100 * share(ctrl, (x) => x < -c)).toFixed(1) + '%').join(' / ')}`);
writeFileSync(new URL(`../results/${out}.json`, import.meta.url), JSON.stringify({ setting, k, seeds, params, changes: rec.map(({ vv, lag, ...r }) => r), entry, control: ctrl }));
