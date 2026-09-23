// Safety sweep (Stage 11/12): near-crash and crash rates vs density × reaction time ×
// glance rate, human archetypes, bicycle body. No DB; prints a table and checks the two
// monotonic expectations of Stage 11's done-when: near-crashes rise with density and
// with reaction time. ~5 min.
//   node sweep.mjs [--seed N] [--secs S]
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const seed = parseInt(flag('seed', '5'), 10);
const secs = parseInt(flag('secs', '600'), 10);

const ctx = { Math, console, Date };
vm.createContext(ctx);
for (const f of ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
}
const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
const BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));

function run(density, tReactX, glanceX) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
    bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0, loopLength: 4000,
    initialDensity: density, profileVariability: 1, truckFraction: 0.1, seed,
  });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    const a = Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    a.tReact = [a.tReact[0] * tReactX, a.tReact[1] * tReactX];
    a.glanceRate = [a.glanceRate[0] * glanceX, a.glanceRate[1] * glanceX];
  }
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const ticks = Math.round(secs / P.dt);
  let vehKm = 0;
  for (let t = 1; t <= ticks; t++) {
    engine.tick = t; world.update(engine);
    if (t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
  }
  const s = world.stats;
  const per = (x) => 1000 * x / Math.max(vehKm, 1e-9);   // per 1000 veh·km
  return {
    vehKm, near: per(s.nearCrashes), crash: per(s.crashes / 2), rear: per(s.rearEnds),
    side: per(s.sideswipeCrashes), depart: per(s.departures), lcConf: per(s.lcConflicts),
    glances: s.glances, periph: s.periphCorrections,
    meanV: world.metrics().meanV * 2.23694,
  };
}

const densities = [8, 15, 25], tReacts = [0.6, 1.0, 1.6], glances = [1, 3];
console.log(`safety sweep — 3 lanes, 4 km ring, ${secs} s, seed ${seed}; rates per 1000 veh·km`);
console.log('  k   tReact× glance×   veh·km   mph   near   crash   rear   side  depart  lcConf  glances periph');
const rows = {};
for (const g of glances) for (const k of densities) for (const tr of tReacts) {
  const r = run(k, tr, g);
  rows[`${g}|${k}|${tr}`] = r;
  console.log(`  ${String(k).padStart(2)}    ${tr.toFixed(1)}     ${g}     ${r.vehKm.toFixed(0).padStart(6)}  ` +
    `${r.meanV.toFixed(0).padStart(4)}  ${r.near.toFixed(2).padStart(5)}  ${r.crash.toFixed(2).padStart(6)}  ` +
    `${r.rear.toFixed(2).padStart(5)}  ${r.side.toFixed(2).padStart(5)}  ${r.depart.toFixed(2).padStart(6)}  ` +
    `${r.lcConf.toFixed(2).padStart(6)}  ${String(r.glances).padStart(7)} ${String(r.periph).padStart(6)}`);
}

// expectations: near-crash rate rises with reaction time (at each density, glance) and
// with density (at each tReact, glance) — counted as pairwise comparisons
let okT = 0, nT = 0, okK = 0, nK = 0;
for (const g of glances) for (const k of densities) {
  nT++; if (rows[`${g}|${k}|1.6`].near >= rows[`${g}|${k}|0.6`].near) okT++;
}
for (const g of glances) for (const tr of tReacts) {
  nK++; if (rows[`${g}|25|${tr}`].near >= rows[`${g}|8|${tr}`].near) okK++;
}
console.log(`near-crash rate rises with tReact: ${okT}/${nT} comparisons; with density: ${okK}/${nK}`);
const pass = okT >= nT - 1 && okK >= nK - 1;
console.log(pass ? 'SWEEP PASS (trends as expected)' : 'SWEEP: trends NOT as expected — investigate');
process.exit(pass ? 0 : 1);
