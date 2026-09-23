// Stage 12: attention calibration experiment. Default-attention safety rates at moderate
// density versus SHRP2's all-severity naturalistic rates (35 M miles: 1,541 crashes,
// 2,705 near-crashes → 0.027 crashes and 0.048 near-crashes per 1000 veh·km; experienced
// adults 37 near-crashes per million miles ≈ 0.023), across candidate parameter
// variants. The ideal point is never touched. ~10 min.
//   node calib.mjs [--secs 900] [--seeds 5,6,7] [--k 15]
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { loadSim } from './headless.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const secs = parseInt(flag('secs', '900'), 10);
const seedSpec = flag('seeds', '5,6,7');
const seeds = seedSpec.includes('..')   // '1..25' or '5,6,7'
  ? Array.from({ length: +seedSpec.split('..')[1] - +seedSpec.split('..')[0] + 1 }, (_, i) => +seedSpec.split('..')[0] + i)
  : seedSpec.split(',').map(Number);
const density = parseInt(flag('k', '15'), 10);

const ctx = loadSim([]);   // main realm: ~4× faster than a vm context, same numbers
const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));

const VARIANTS = {
  base:    (a, p) => {},
  wander:  (a, p) => { a.laneTol = [a.laneTol[0] * 0.6, a.laneTol[1] * 0.6]; },   // toward SD 0.2 m
  tail:    (a, p) => { p.attention.glanceSigma = 0.3; },                          // shorter long-glance tail
  loom:    (a, p) => { a.loomGain = [a.loomGain[0] * 1.5, a.loomGain[1] * 1.5]; },
  check:   (a, p) => { a.checkProb = [Math.min(1, a.checkProb[0] + 0.02), a.checkProb[1]]; },
  combo:   (a, p) => { a.laneTol = [a.laneTol[0] * 0.6, a.laneTol[1] * 0.6]; p.attention.glanceSigma = 0.3; },
};

function run(variant, seed) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
    bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0, loopLength: 4000,
    initialDensity: density, profileVariability: 1, truckFraction: 0.1, seed,
  });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    const a = Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    VARIANTS[variant](a, P);
  }
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const ticks = Math.round(secs / P.dt);
  let vehKm = 0;
  const ys = new Map();
  for (let t = 1; t <= ticks; t++) {
    engine.tick = t; world.update(engine);
    if (t % 20 === 0) {
      for (const v of world.vehicles) {
        vehKm += v.v * P.dt * 20 / 1000;
        if (!v.changing && t > ticks / 3) {   // wander sample: settled, not maneuvering
          const c = world.laneCenter(v.lane);
          if (!ys.has(v.id)) ys.set(v.id, []);
          ys.get(v.id).push(v.y - c);
        }
      }
    }
  }
  let sdSum = 0, sdN = 0;
  for (const arr of ys.values()) {
    if (arr.length < 50) continue;
    const m = arr.reduce((s, x) => s + x, 0) / arr.length;
    sdSum += Math.sqrt(arr.reduce((s, x) => s + (x - m) * (x - m), 0) / arr.length); sdN++;
  }
  const s = world.stats, m = world.metrics();
  const per = (x) => 1000 * x / Math.max(vehKm, 1e-9);
  return {
    vehKm, meanV: m.meanV * 2.23694, wanderSD: sdN ? sdSum / sdN : NaN,
    near: per(s.nearCrashes), crash: per(s.crashes / 2), rear: per(s.rearEnds),
    side: per(s.sideswipeCrashes), depart: per(s.departures),
    petConf: s.petN ? s.lcConflicts / s.petN : NaN, glances: s.glances,
  };
}

console.log(`attention calibration — k=${density}/ln, 3 lanes, 4 km, ${secs} s × seeds ${seeds.join(',')}`);
console.log('SHRP2 targets per 1000 veh·km: crash ≈ 0.027 (all severity), near-crash ≈ 0.048 (0.023 experienced adults)');
const header = '  variant   veh·km(total)  mph  wanderSD   near   crash   rear   side  depart  PET<1s  glances   events(near/crash)';
console.log(header);
const lines = [];
const t0 = Date.now();
for (const name of Object.keys(VARIANTS)) {
  const reps = seeds.map((sd) => run(name, sd));
  // rates pooled over ALL exposure (events / total km), not averaged per seed
  const tot = (k) => reps.reduce((a, r) => a + r[k], 0);
  const km = tot('vehKm');
  const nearEv = reps.reduce((a, r) => a + r.near * r.vehKm / 1000, 0);
  const crashEv = reps.reduce((a, r) => a + r.crash * r.vehKm / 1000, 0);
  const pooled = (k) => reps.reduce((a, r) => a + r[k] * r.vehKm / 1000, 0) * 1000 / km;
  const avg = (k) => tot(k) / reps.length;
  const line = `  ${name.padEnd(8)} ${km.toFixed(0).padStart(12)}  ${avg('meanV').toFixed(0).padStart(4)}   ` +
    `${avg('wanderSD').toFixed(3)}   ${pooled('near').toFixed(3)}  ${pooled('crash').toFixed(4)}  ` +
    `${pooled('rear').toFixed(4)}  ${pooled('side').toFixed(4)}  ${pooled('depart').toFixed(4)}   ` +
    `${(100 * avg('petConf')).toFixed(0).padStart(3)}%  ${avg('glances').toFixed(0).padStart(6)}   ` +
    `${nearEv.toFixed(0)}/${crashEv.toFixed(0)}   [${((Date.now() - t0) / 60000).toFixed(1)} min]`;
  console.log(line); lines.push(line);
}
mkdirSync(path.join(__dirname, 'results'), { recursive: true });
writeFileSync(path.join(__dirname, 'results', 'calib.md'),
  `# Attention calibration vs SHRP2

k=${density}/ln, 3 lanes, 4 km ring, ${secs} s × ${seeds.length} seeds (${seedSpec}); ` +
  `rates pooled over total exposure. SHRP2 all-severity: crash 0.027, near-crash 0.048 per 1000 veh·km ` +
  `(experienced adults 0.023). Generated ${new Date().toISOString()}.

\`\`\`
${header}
${lines.join('
')}
\`\`\`
`);
console.log('wrote results/calib.md');
