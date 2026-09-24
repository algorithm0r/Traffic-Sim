// capdrop merge-bicycle-ideal showed downstream flow collapsing for a minute at a time in
// free flow (demand ~1100/ln, speeds 26 m/s). Who is slow near the merge, and why?
//   node probes/mergeflicker.mjs [seed] [fromMin] [toMin]
import { loadSim } from '../headless.mjs';
const ctx = loadSim(); const P = ctx.PARAMETERS;
const seed = +(process.argv[2] || 2), m0 = +(process.argv[3] || 8), m1 = +(process.argv[4] || 13);
Object.assign(P, { bodyModel: 'bicycle', openRoad: true, loopLength: 9000, openDeadZone: 600,
  laneCount: 2, numInterchanges: 1, demand: 600, laneDropAt: null, detectorFracs: [2400 / 9000, 4400 / 9000],
  upstreamDemand: 1800, initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed });
for (const k of Object.keys(ctx.ARCHETYPES)) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
const world = new ctx.World(), engine = new ctx.GameEngine();
const perMin = [];
for (let m = 0; m < m1; m++) {
  P.upstreamDemand = m < 5 ? 1800 : 1800 + 1800 * (m - 5) / 30;
  const d = world.detectors[1]; d.count = 0;
  for (let t = 0; t < 1200; t++) {
    engine.tick++; world.update(engine);
    if (m >= m0 && t % 100 === 0) {
      const slow = world.vehicles.filter((v) => v.v < 8 && v.x > 2400 && v.x < 4400);
      if (slow.length) {
        const s = slow.sort((a, b) => b.x - a.x)[0];
        const lead = world.scanAhead(s, world.sweptBand(s), 400);
        console.log(`t=${world.time.toFixed(0)} slow=${slow.length} head #${s.id} ${s.p.name} x=${s.x.toFixed(0)} y=${s.y.toFixed(2)} v=${s.v.toFixed(1)} ` +
          `lane=${s.lane}${s.onRamp ? '(ramp)' : ''} chg=${s.changing ? s.startLane + '>' + s.targetLane : '-'} d=${s.desire.toFixed(2)} ` +
          `wall=${isFinite(world.wallDist(s)) ? world.wallDist(s).toFixed(0) : '∞'} clrL=${world.lateralClearance(s, -1).toFixed(2)} ` +
          `lead=${lead ? '#' + lead.id + (lead.onRamp ? '(ramp)' : '') + '@' + world.gapX(s, lead).toFixed(1) + ' v' + lead.v.toFixed(1) + (s._leadClaim ? ' CLAIM' : '') : '-'}`);
      }
    }
  }
  perMin.push(`m${m}:${d.count * 30}`);
}
console.log('downstream veh/h/ln by minute:', perMin.join(' '));
