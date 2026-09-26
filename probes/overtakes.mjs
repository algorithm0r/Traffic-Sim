// Stage 17: how many through-lane vehicles overtake an onramp merger before it merges — the
// model side of tools/ngsim_overtakes.py (NGSIM I-80: 82% overtaken by none, 3.5% by two,
// none by three or more; Daamen et al. 2010: "no merging vehicle is overtaken by multiple
// vehicles"). capdrop.mjs's merge case; counted from the start of the acceleration lane to the
// merge (the vehicle leaving the ramp); split by merge speed (NGSIM I-80 is congested).
//   node probes/overtakes.mjs [--seeds 1,2] [--human] [--params JSON]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const seeds = flag('seeds', '1,2').split(',').map(Number), human = argv.includes('--human');
const params = JSON.parse(flag('params', '{}'));
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P)), BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));
const recs = [];
for (const seed of seeds) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', openRoad: true, loopLength: 9000,
    openDeadZone: 600, laneCount: 2, numInterchanges: 1, demand: 600, laneDropAt: null,
    detectorFracs: [2400 / 9000, 4400 / 9000], upstreamDemand: 1800, initialDensity: 0, throughFraction: 1,
    profileVariability: 1, truckFraction: 0.08, seed });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    if (!human) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
  }
  for (const [key, val] of Object.entries(params)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
  }
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const track = new Map();   // ramp vehicle id -> { behind:Set, passed:Set, t0 }
  const target = P.laneCount - 1;
  for (let t = 1; t <= Math.round(65 * 60 / P.dt); t++) {
    const m = Math.floor(t * P.dt / 60);
    P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + 1800 * (m - 5) / 30 : 3600;
    engine.tick = t; world.update(engine);
    if (t % Math.max(1, Math.round(0.1 / P.dt))) continue;
    const through = world.vehicles.filter((o) => !o.onRamp && world.laneOf(o) === target);
    const seen = new Set();
    for (const v of world.vehicles) {
      if (!v.onRamp) continue;
      const along = world.distAhead(v.onRamp.x, v.x);
      if (along > v.onRamp.len + 50) continue;          // not yet beside the mainline
      seen.add(v.id);
      let r = track.get(v.id);
      if (!r) track.set(v.id, r = { behind: new Set(), passed: new Set(), t0: world.time });
      r.v = v.v; r.minute = m;
      for (const o of through) {
        const rel = world.distAhead(v.x, o.x); const d = rel > world.L / 2 ? rel - world.L : rel;
        if (d < 0 && d > -150) r.behind.add(o.id);
        else if (d > 0 && d < 150 && r.behind.has(o.id)) r.passed.add(o.id);
      }
    }
    for (const [id, r] of track) {   // merged (left the ramp) or gone: record
      if (seen.has(id)) continue;
      recs.push({ n: r.passed.size, v: r.v, secs: world.time - r.t0, minute: r.minute }); track.delete(id);
    }
  }
}
const dist = (rs) => { const c = [0, 0, 0, 0]; for (const r of rs) c[Math.min(r.n, 3)]++;
  return c.map((x, i) => `${i === 3 ? '3+' : i}: ${(100 * x / rs.length).toFixed(1)}%`).join('  ') + `   mean ${(rs.reduce((a, r) => a + r.n, 0) / rs.length).toFixed(2)}`; };
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
console.log(`merge, ${human ? 'human' : 'ideal'} drivers, seeds ${seeds}${Object.keys(params).length ? ', ' + JSON.stringify(params) : ''}`);
for (const [lab, rs] of [['all mergers', recs], ['merge speed <= 12 m/s (NGSIM-like)', recs.filter((r) => r.v <= 12)], ['merge speed > 12 m/s', recs.filter((r) => r.v > 12)]])
  if (rs.length) console.log(`  ${lab} (n=${rs.length}, median ${med(rs.map((r) => r.secs)).toFixed(1)} s beside the mainline): overtaken by ${dist(rs)}`);
