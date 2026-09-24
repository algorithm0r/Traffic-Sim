// The lane-drop gridlock in capdrop (drop-bicycle-ideal, seed 1, from ~minute 52): dump the
// vehicles at the drop once traffic has stopped.   node probes/dropjam.mjs [seed] [minute]
import { loadSim } from '../headless.mjs';
const ctx = loadSim(); const P = ctx.PARAMETERS;
const seed = +(process.argv[2] || 1), stopAt = +(process.argv[3] || 53);
Object.assign(P, { bodyModel: 'bicycle', openRoad: true, loopLength: 9000, openDeadZone: 600,
  laneCount: 2, numInterchanges: 0, demand: 0, laneDropAt: 3000, detectorFracs: [2200 / 9000, 4200 / 9000],
  upstreamDemand: 1800, initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed });
for (const k of Object.keys(ctx.ARCHETYPES)) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
const world = new ctx.World(), engine = new ctx.GameEngine();
for (let m = 0; m < stopAt; m++) {
  P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + 2400 * (m - 5) / 30 : 4200;
  for (let t = 0; t < 1200; t++) { engine.tick++; world.update(engine); }
}
const near = world.vehicles.filter((v) => v.x > 2880 && v.x < 3060).sort((a, b) => b.x - a.x);
console.log(`t=${world.time.toFixed(0)}  vehicles 2880-3060 m: ${near.length}; moving>0.5: ${near.filter((v) => v.v > 0.5).length}; crashed: ${world.vehicles.filter((v) => v.crashed).length}`);
for (const v of near.slice(0, 22)) {
  const lead = world.scanAhead(v, world.sweptBand(v), 400);
  console.log(`  #${v.id} ${v.p.name[0]} x=${v.x.toFixed(1)} y=${v.y.toFixed(2)} ψ=${v.psi.toFixed(3)} v=${v.v.toFixed(2)} acc=${v.acc.toFixed(2)} lane=${v.lane}${v.onRamp ? '(drop)' : ''}` +
    ` chg=${v.changing ? v.startLane + '>' + v.targetLane : '-'} d=${v.desire.toFixed(2)} claim=${v.claimLane} stall=${(v.stallT || 0).toFixed(0)}` +
    ` wall=${isFinite(world.wallDist(v)) ? world.wallDist(v).toFixed(1) : '∞'} clrL=${world.lateralClearance(v, -1).toFixed(2)} clrR=${world.lateralClearance(v, 1).toFixed(2)}` +
    ` lead=${lead ? '#' + lead.id + '@' + world.gapX(v, lead).toFixed(1) + (v._leadClaim ? 'C' : '') : '-'}`);
}
