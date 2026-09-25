// Stage 12: the reaction-time × density phase diagram. Human archetypes, bicycle body,
// 3-lane 4 km ring. For each cell: mean speed, detector speed std (wave onset), near-crash
// and crash rates per 1000 veh·km, averaged over seeds. Writes results/phase.json and
// results/phase.md. ~25 min at the default grid.
//   node phase.mjs [--secs 600] [--seeds 5,6,7] [--quick] [--params JSON] [--out name]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { loadSim } from './headless.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const secs = parseInt(flag('secs', '600'), 10);
const seeds = flag('seeds', '5,6,7').split(',').map(Number);
const quick = argv.includes('--quick');
const params = JSON.parse(flag('params', '{}'));
const outName = flag('out', 'phase');

const ctx = loadSim();   // main realm: ~4× faster than a vm context, same numbers
const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));

const densities = quick ? [8, 16, 25] : [8, 12, 16, 20, 25, 30];
const tReacts = quick ? [0.6, 1.0, 1.6] : [0.6, 0.8, 1.0, 1.3, 1.6, 2.0];

function run(density, tReactX, seed) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
    bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0, loopLength: 4000,
    initialDensity: density, profileVariability: 1, truckFraction: 0.1, seed,
    detectorFracs: [0.5],
  });
  for (const [key, val] of Object.entries(params)) {   // --params: variants, nested objects merged
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
  }
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    const a = Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    a.tReact = [a.tReact[0] * tReactX, a.tReact[1] * tReactX];
  }
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const ticks = Math.round(secs / P.dt), warm = Math.round(ticks / 3);
  let vehKm = 0;
  const detV = [];
  for (let t = 1; t <= ticks; t++) {
    engine.tick = t; world.update(engine);
    if (t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
    if (t > warm && t % 100 === 0) {                       // 5-s detector bins after warm-up
      const d = world.detectors[0];
      if (d.count) detV.push(d.speedSum / d.count);
      d.count = 0; d.speedSum = 0;
    }
  }
  const s = world.stats, m = world.metrics();
  const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const mu = mean(detV);
  const std = Math.sqrt(mean(detV.map((x) => (x - mu) * (x - mu))));
  const per = (x) => 1000 * x / Math.max(vehKm, 1e-9);
  return {
    meanV: m.meanV * 2.23694, detStd: std, vehKm,
    near: per(s.nearCrashes), crash: per(s.crashes / 2),
    rear: per(s.rearEnds), side: per(s.sideswipeCrashes), depart: per(s.departures),
  };
}

mkdirSync(path.join(__dirname, 'results'), { recursive: true });
const cells = [];
const t0 = Date.now();
let done = 0, total = densities.length * tReacts.length * seeds.length;
for (const k of densities) for (const tr of tReacts) {
  const reps = seeds.map((sd) => run(k, tr, sd));
  const avg = (key) => reps.reduce((a, r) => a + r[key], 0) / reps.length;
  const cell = { density: k, tReactX: tr, seeds: reps,
    meanV: avg('meanV'), detStd: avg('detStd'), near: avg('near'), crash: avg('crash'),
    rear: avg('rear'), side: avg('side'), depart: avg('depart') };
  cells.push(cell);
  done += seeds.length;
  console.log(`k=${String(k).padStart(2)} tReact×${tr.toFixed(1)}: ${cell.meanV.toFixed(0)} mph  ` +
    `std ${cell.detStd.toFixed(1)} m/s  near ${cell.near.toFixed(2)}  crash ${cell.crash.toFixed(2)} /1000 veh·km` +
    `   [${done}/${total}, ${((Date.now() - t0) / 60000).toFixed(1)} min]`);
}

const out = { generated: new Date().toISOString(), secs, seeds, densities, tReacts, params, cells };
writeFileSync(path.join(__dirname, 'results', outName + '.json'), JSON.stringify(out, null, 1));

// markdown grids: mean speed, detector speed std, near-crash rate
const grid = (key, fmt) => {
  let md = '| k \\ tReact× | ' + tReacts.map((t) => t.toFixed(1)).join(' | ') + ' |\n';
  md += '|---|' + tReacts.map(() => '---').join('|') + '|\n';
  for (const k of densities) {
    md += `| ${k} | ` + tReacts.map((t) => fmt(cells.find((c) => c.density === k && c.tReactX === t)[key])).join(' | ') + ' |\n';
  }
  return md;
};
let md = `# Reaction time × density phase diagram\n\n${secs} s runs, 3-lane 4 km ring, human archetypes, seeds ${seeds.join(',')}; cells are seed means.${Object.keys(params).length ? ' Variant ' + JSON.stringify(params) + '.' : ''} Generated ${out.generated}.\n\n`;
md += '## Mean speed (mph)\n\n' + grid('meanV', (v) => v.toFixed(0)) + '\n';
md += '## Detector speed std after warm-up (m/s) — wave onset\n\n' + grid('detStd', (v) => v.toFixed(1)) + '\n';
md += '## Near-crashes per 1000 veh·km\n\n' + grid('near', (v) => v.toFixed(2)) + '\n';
md += '## Crashes per 1000 veh·km (SHRP2 all-severity ≈ 0.027)\n\n' + grid('crash', (v) => v.toFixed(3)) + '\n';
writeFileSync(path.join(__dirname, 'results', outName + '.md'), md);
console.log(`wrote results/${outName}.json and results/${outName}.md`);
