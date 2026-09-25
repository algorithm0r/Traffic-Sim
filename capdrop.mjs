// Stage 13: the capacity-drop experiment on an OPEN road, measured as the empirical
// literature measures it (Cassidy & Bertini 1999; Chung, Rudjanakanoknad & Cassidy 2007):
// the highest sustained flow a detector downstream of the bottleneck passes BEFORE
// breakdown, versus the queue-discharge rate AFTER it. Empirical drops: roughly 5-20%.
//
// Protocol per run: open road, one bottleneck. Upstream demand is held at a moderate level
// for 5 min (fill), ramps linearly to over-capacity over 30 min, then holds for 30 min.
// 1-min detector bins. Breakdown = the first bin at which the upstream detector's speed
// falls below 60% of its free-flow speed and stays there 5 bins. Pre-breakdown capacity =
// the highest 5-bin rolling mean of downstream flow ending before breakdown. Queue
// discharge = the mean downstream flow from 5 bins after breakdown to the end, over bins
// in which the queue persists (upstream still below threshold). Drop = 1 − QDR / pre-max.
//   node capdrop.mjs [--seeds 1..5] [--cases merge-lane-ideal,...] [--params JSON] [--out name]
//                    [--gap follower]
// --gap follower (Stage 16): SUMO LC2013's gap acceptance — a changer accepts only a gap its
// new follower can absorb at that follower class's comfortable deceleration b, forced or not
// (bSafe = b per class, bAcceptMax = the largest class b). Ours otherwise imposes up to bSafe
// (3.5-5 m/s²), rising to 8 m/s² in a forced merge.
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { loadSim } from './headless.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const seedSpec = flag('seeds', '1..5');
const seeds = seedSpec.includes('..')
  ? Array.from({ length: +seedSpec.split('..')[1] - +seedSpec.split('..')[0] + 1 }, (_, i) => +seedSpec.split('..')[0] + i)
  : seedSpec.split(',').map(Number);

const ctx = loadSim();
const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));

// Bottleneck geometries. merge: 2 lanes, one onramp (exit 2940, gore 3160, accel lane to
// 3420, taper to 3455), 600 veh/h on the ramp. drop: 3 lanes → 2 at 3000 m.
const GEOM = {
  merge: { laneCount: 2, numInterchanges: 1, demand: 600, laneDropAt: null,
           detectorFracs: [2400 / 9000, 4400 / 9000], lanesDown: 2, upLo: 1800, upHi: 3600 },
  drop:  { laneCount: 2, numInterchanges: 0, demand: 0, laneDropAt: 3000,
           detectorFracs: [2200 / 9000, 4200 / 9000], lanesDown: 2, upLo: 1800, upHi: 4200 },
};
const CASES = {
  'merge-lane-ideal':     { geom: 'merge', body: 'lane', human: false },
  'merge-bicycle-ideal':  { geom: 'merge', body: 'bicycle', human: false },
  'merge-bicycle-human':  { geom: 'merge', body: 'bicycle', human: true },
  'drop-bicycle-ideal':   { geom: 'drop', body: 'bicycle', human: false },
  'drop-bicycle-human':   { geom: 'drop', body: 'bicycle', human: true },
};
const only = flag('cases', null);
const params = JSON.parse(flag('params', '{}'));
const outName = flag('out', 'capdrop');
const gap = flag('gap', null);

function run(c, seed) {
  const G = GEOM[c.geom];
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
    bodyModel: c.body, openRoad: true, loopLength: 9000, openDeadZone: 600,
    laneCount: G.laneCount, numInterchanges: G.numInterchanges, demand: G.demand,
    laneDropAt: G.laneDropAt, detectorFracs: G.detectorFracs, upstreamDemand: G.upLo,
    initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed,
  });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    if (!c.human) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
  }
  for (const [key, val] of Object.entries(params)) {   // --params: variants, nested objects merged
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
  }
  if (gap === 'follower') {
    const bOf = (a) => Array.isArray(a.b) ? a.b[0] : a.b;
    for (const a of Object.values(ctx.ARCHETYPES)) a.bSafe = bOf(a);
    P.lc.bAcceptMax = Math.max(...Object.values(ctx.ARCHETYPES).map(bOf));
  }
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const binTicks = Math.round(60 / P.dt), minutes = 65;
  const bins = [];
  let vehKm = 0;   // exposure, for conflict rates comparable with SUMO's SSM device (Stage 16)
  for (let m = 0; m < minutes; m++) {
    // demand profile: 5 min fill, 30 min ramp, 30 min hold
    P.upstreamDemand = m < 5 ? G.upLo : m < 35 ? G.upLo + (G.upHi - G.upLo) * (m - 5) / 30 : G.upHi;
    for (const d of world.detectors) { d.count = 0; d.speedSum = 0; }
    for (let t = 0; t < binTicks; t++) {
      engine.tick++; world.update(engine);
      if (t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
    }
    const [du, dd] = world.detectors;
    bins.push({ m, upV: du.count ? du.speedSum / du.count : NaN, downQ: dd.count * 60 / G.lanesDown,
                downV: dd.count ? dd.speedSum / dd.count : NaN, demand: P.upstreamDemand,
                queue: world.upstream.queue });
  }
  // analysis
  const free = bins.slice(3, 8).map((b) => b.upV).filter(isFinite).sort((a, b) => a - b);
  const vFree = free.length ? free[Math.floor(free.length / 2)] : NaN;
  const thr = 0.6 * vFree;
  let tb = -1;
  for (let i = 6; i + 4 < bins.length; i++) {
    if (bins.slice(i, i + 5).every((b) => b.upV < thr)) { tb = i; break; }
  }
  const roll = (i) => bins.slice(i - 4, i + 1).reduce((a, b) => a + b.downQ, 0) / 5;
  let preMax = NaN, pre10 = NaN, qdr = NaN, qdrBins = 0;
  if (tb > 0) {
    preMax = 0;
    for (let i = 8; i < tb; i++) preMax = Math.max(preMax, roll(i));
    // the conservative reference: the mean of the 10 min before breakdown (the max of
    // rolling means over noisy 1-min bins is biased upward)
    const pre = bins.slice(Math.max(8, tb - 10), tb);
    pre10 = pre.length ? pre.reduce((a, b) => a + b.downQ, 0) / pre.length : NaN;
    // after breakdown an empty upstream bin is a STANDING queue (nothing crossed), not
    // free road: count it as speed 0 rather than dropping it (the first run silently
    // excluded a 13-minute gridlock from the discharge average)
    const after = bins.slice(tb + 5).filter((b) => !isFinite(b.upV) || b.upV < thr);
    qdrBins = after.length;
    if (qdrBins >= 10) qdr = after.reduce((a, b) => a + b.downQ, 0) / qdrBins;
  }
  const s = world.stats;
  const stalls = tb > 0 ? bins.slice(tb).filter((b) => b.downQ === 0).length : 0;
  return { seed, vFree, tb, preMax, pre10, qdr, qdrBins, stalls, drop: 1 - qdr / preMax, drop10: 1 - qdr / pre10,
           crashes: s.crashes / 2 | 0, rear: s.collisions, side: s.sideswipes || 0,
           vehKm, near: s.nearCrashes || 0, evasive: s.evasiveNear || 0, lateral: s.lateralConflicts || 0,
           merges: s.merges, maxQueue: world.upstream.maxQueue, bins };
}

const t0 = Date.now();
const out = { generated: new Date().toISOString(), seeds, cases: {} };
const lines = [];
const NL = String.fromCharCode(10), FENCE = '```';
const header = '  case                   seed  breakdown(min)  pre-max  pre-10    QDR    drop  drop10   merges  crashes  grazes  stalled-min';
console.log(header);
for (const [name, c] of Object.entries(CASES)) {
  if (only && !only.split(',').includes(name)) continue;
  const reps = seeds.map((sd) => run(c, sd));
  out.cases[name] = reps.map(({ bins, ...r }) => r);
  out.cases[name + ':bins'] = reps.map((r) => r.bins);
  for (const r of reps) {
    const line = `  ${name.padEnd(22)} ${String(r.seed).padStart(4)}  ${String(r.tb).padStart(14)}  ` +
      `${isFinite(r.preMax) ? r.preMax.toFixed(0).padStart(7) : '      -'}  ${isFinite(r.pre10) ? r.pre10.toFixed(0).padStart(6) : '     -'}  ` +
      `${isFinite(r.qdr) ? r.qdr.toFixed(0).padStart(5) : '    -'}  ` +
      `${isFinite(r.drop) ? (100 * r.drop).toFixed(1).padStart(5) + '%' : '     -'}  ${isFinite(r.drop10) ? (100 * r.drop10).toFixed(1).padStart(5) + '%' : '     -'}  ${String(r.merges).padStart(6)}  ` +
      `${String(r.crashes).padStart(7)}  ${String(r.side).padStart(6)}  ${String(r.stalls).padStart(11)}`;
    console.log(line); lines.push(line);
  }
  const ok = reps.filter((r) => isFinite(r.drop));
  const stat = (key) => {
    const v = ok.map((r) => r[key]).filter(isFinite);
    return v.length ? { mean: v.reduce((a, x) => a + x, 0) / v.length, lo: Math.min(...v), hi: Math.max(...v) } : null;
  };
  const d = stat('drop'), d10 = stat('drop10');
  const pc = (x) => (100 * x).toFixed(1) + '%';
  const sum = `  ${name.padEnd(22)} drop vs 5-min max ${d ? pc(d.mean) + ' (' + pc(d.lo) + '–' + pc(d.hi) + ')' : '-'}; ` +
    `vs 10-min pre-mean ${d10 ? pc(d10.mean) + ' (' + pc(d10.lo) + '–' + pc(d10.hi) + ')' : '-'}; ` +
    `${ok.length}/${reps.length} broke down   [${((Date.now() - t0) / 60000).toFixed(1)} min]`;
  console.log(sum); lines.push(sum);
}
mkdirSync(path.join(__dirname, 'results'), { recursive: true });
out.params = params; out.gap = gap;
writeFileSync(path.join(__dirname, 'results', outName + '.json'), JSON.stringify(out));
writeFileSync(path.join(__dirname, 'results', outName + '.md'),
  '# Capacity drop on an open road' + NL + NL +
  'Pre-breakdown capacity (highest 5-min mean of downstream flow before breakdown) vs queue-discharge rate ' +
  '(mean downstream flow once the queue is established), veh/h/lane at a detector ~1 km downstream. ' +
  'Empirical drops are roughly 5-20%. Protocol in capdrop.mjs. Generated ' + out.generated + '.' +
  (Object.keys(params).length || gap ? ' Variant: ' + JSON.stringify({ params, gap }) + '.' : '') + NL + NL +
  FENCE + NL + header + NL + lines.join(NL) + NL + FENCE + NL);
console.log(`wrote results/${outName}.md and results/${outName}.json`);
