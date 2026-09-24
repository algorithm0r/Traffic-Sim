// Stage 12 lateral calibration: lane-position SD (SDLP), lane-change rate and duration,
// PET and lateral conflicts, for human drivers on a 3-lane ring, across variants of the
// comfort band (laneTol shift) and the lateral speed cap. Targets:
//   SDLP 13.5-15.3 cm (standardised on-road highway test, sober drivers, 10-100 km)
//   lane-change rate ~0.24 per veh-km (highD: 11,000 changes over 45,000 km)
//   lane-change duration 4.0 ± 2.3 s, mode ~3 s (Thiemann, Treiber & Kesting 2008, NGSIM)
//   cut-in follower time headway peaking at 1 s, range 0.1-4 s (highD)
//   node probes/lateral.mjs [--seeds 1,2,3] [--secs 600] [--k 15]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const seeds = flag('seeds', '1,2,3').split(',').map(Number);
const secs = +flag('secs', '600'), k = +flag('k', '15');
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P)), BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));

const VARIANTS = (argv.includes('--variants') ? flag('variants') : 'base,tol+0.15,tol+0.30,lat1.0,tol+0.30:lat1.0').split(',');
function apply(name) {
  for (const part of name.split(':')) {
    if (part.startsWith('tol+')) {
      const d = +part.slice(4);
      for (const a of Object.values(ctx.ARCHETYPES)) a.laneTol = [a.laneTol[0] + d, a.laneTol[1]];
    } else if (part.startsWith('lat')) P.steering.maxLatSpeed = +part.slice(3);
  }
}

function run(name, seed) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
    bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0, loopLength: 4000,
    initialDensity: k, profileVariability: 1, truckFraction: 0.1, seed,
  });
  for (const key of Object.keys(ctx.ARCHETYPES)) Object.assign(ctx.ARCHETYPES[key], JSON.parse(JSON.stringify(BASE_ARCH[key])));
  apply(name);
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const ticks = secs / P.dt, warm = ticks / 3;
  const ys = new Map();
  let vehKm = 0, lc0 = 0, dur0 = 0, durN0 = 0;
  for (let t = 1; t <= ticks; t++) {
    engine.tick = t; world.update(engine);
    if (t === warm) { lc0 = world.stats.laneChanges; dur0 = world.stats.changeDurSum; durN0 = world.stats.changeDurN; }
    if (t > warm && t % 10 === 0) {
      for (const v of world.vehicles) {
        vehKm += v.v * P.dt * 10 / 1000;
        if (v.changing || v.p.truck) continue;   // SDLP is a car measure, outside maneuvers
        const off = v.y - world.laneCenter(v.lane);
        if (!ys.has(v.id)) ys.set(v.id, { lane: v.lane, a: [] });
        const r = ys.get(v.id);
        if (r.lane !== v.lane) { r.lane = v.lane; r.a = []; }   // restart after a change
        r.a.push(off);
      }
    }
  }
  let sd = 0, n = 0;
  for (const r of ys.values()) {
    if (r.a.length < 100) continue;
    const m = r.a.reduce((s, x) => s + x, 0) / r.a.length;
    sd += Math.sqrt(r.a.reduce((s, x) => s + (x - m) * (x - m), 0) / r.a.length); n++;
  }
  const s = world.stats;
  const lc = s.laneChanges - lc0;
  return { sdlp: n ? sd / n : NaN, lcRate: lc / vehKm, dur: (s.changeDurSum - dur0) / Math.max(s.changeDurN - durN0, 1),
           pet: s.petN ? s.petSum / s.petN : NaN, petShort: s.petN ? s.lcConflicts / s.petN : NaN,
           lateral: 1000 * s.lateralConflicts / vehKm, near: 1000 * s.nearCrashes / vehKm,
           meanV: world.metrics().meanV * 2.23694 };
}

console.log(`lateral calibration — 3 lanes, k=${k}, human, ${secs} s × seeds ${seeds.join(',')}`);
console.log('targets: SDLP 0.135-0.153 m | LC 0.24 /veh·km | duration 4.0 s (mode 3) | cut-in THW peak 1 s');
console.log('  variant            SDLP(m)  LC/veh·km  dur(s)  PET(s)  PET<1s  lateral/1000vkm  near/1000vkm  mph');
for (const name of VARIANTS) {
  const reps = seeds.map((sd) => run(name, sd));
  const avg = (key) => reps.reduce((a, r) => a + r[key], 0) / reps.length;
  console.log(`  ${name.padEnd(18)} ${avg('sdlp').toFixed(3)}    ${avg('lcRate').toFixed(3)}     ${avg('dur').toFixed(2)}   ` +
    `${avg('pet').toFixed(2)}    ${(100 * avg('petShort')).toFixed(0).padStart(3)}%       ${avg('lateral').toFixed(3)}          ` +
    `${avg('near').toFixed(3)}      ${avg('meanV').toFixed(0)}`);
}
