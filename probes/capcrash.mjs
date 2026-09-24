// Which crashes happen at the ideal point in the open-road merge experiment, and how?
//   node probes/capcrash.mjs [seed]
import { loadSim } from '../headless.mjs';
const ctx = loadSim(); const P = ctx.PARAMETERS;
const seed = +(process.argv[2] || 1);
Object.assign(P, { bodyModel: 'bicycle', openRoad: true, loopLength: 9000, openDeadZone: 600,
  laneCount: 2, numInterchanges: 1, demand: 600, laneDropAt: null, detectorFracs: [2400 / 9000, 4400 / 9000],
  upstreamDemand: 1800, initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed });
for (const k of Object.keys(ctx.ARCHETYPES)) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
const world = new ctx.World(), engine = new ctx.GameEngine();
const snap = new Map();   // id -> ring buffer of the last 3 s of state
for (let m = 0; m < 65; m++) {
  P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + 1800 * (m - 5) / 30 : 3600;
  for (let t = 0; t < 1200; t++) {
    engine.tick++; world.update(engine);
    if (t % 4 === 0) for (const v of world.vehicles) {
      const b = snap.get(v.id) || []; b.push({ t: +world.time.toFixed(1), x: Math.round(v.x), y: +v.y.toFixed(2),
        v: +v.v.toFixed(1), acc: +v.acc.toFixed(1), psi: +v.psi.toFixed(3), chg: v.changing ? v.startLane + '>' + v.targetLane : '-',
        ramp: !!v.onRamp, loom: +v.loomA.toFixed(2), crashed: v.crashed }); if (b.length > 15) b.shift(); snap.set(v.id, b);
    }
  }
}
console.log('crashes', world.stats.crashes / 2, 'rear', world.stats.rearEnds, 'side', world.stats.sideswipeCrashes, 'depart', world.stats.departures);
for (const e of (world.crashLog || []).slice(0, 6)) {
  console.log('CRASH', JSON.stringify(e));
  const h = snap.get(e.id); if (h) console.log(h.filter((_, i) => i % 3 === 0).map((s) => '   ' + JSON.stringify(s)).join('\n'));
}
console.log('contact log (first 6):');
for (const c of (world.collisionLog || []).slice(0, 6)) console.log('  ', JSON.stringify(c));
