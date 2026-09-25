// Near-crash decomposition at default attention: who was glancing, how hard the leader
// braked, the hard-braking event rate, and glance statistics. A diagnostic, not a suite.
//   node probes/decomp.mjs [seeds]
import { loadSim } from '../headless.mjs';
const ctx = loadSim(); const P = ctx.PARAMETERS;
const seeds = (process.argv[2] || '1,2,3,4,5,6').split(',').map(Number);
const secs = 900;
const byProf = {}, byLeadProf = {};
let lateral = 0, vehKm = 0, near = 0, nearGlance = 0, nearLeadBrake = 0, nearLeadHard = 0, nearLeadCutIn = 0, hardBrakes = 0, ttcSum = 0;
let glanceN = 0, glanceOver2 = 0, glanceDurSum = 0, eyesOffTicks = 0, vehTicks = 0;
const leadAccHist = new Map();   // id -> recent acc samples
for (const seed of seeds) {
  Object.assign(P, { bodyModel: 'bicycle', laneCount: 3, numInterchanges: 0, loopLength: 4000, initialDensity: 15, profileVariability: 1, truckFraction: 0.1, seed });
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const hist = new Map(), hard = new Set(), glanceStart = new Map();
  world.onNearCrash = (veh, lead, ttc) => {
    near++; ttcSum += ttc;
    byProf[veh.p.name] = (byProf[veh.p.name] || 0) + 1; byLeadProf[lead.p.name] = (byLeadProf[lead.p.name] || 0) + 1;
    if (world.time < veh.glanceUntil) nearGlance++;
    const h = hist.get(lead.id) || [];
    const minAcc = Math.min(0, ...h);
    if (minAcc <= -2) nearLeadBrake++;
    if (minAcc <= -4.9) nearLeadHard++;
    if (lead.changing || (world.time - (lead.changeEnd || -99)) < 2) nearLeadCutIn++;
  };
  for (let t = 1; t <= secs / P.dt; t++) {
    engine.tick = t; world.update(engine);
    if (t === Math.round(secs / P.dt)) lateral += world.stats.lateralConflicts;
    for (const v of world.vehicles) {
      const h = hist.get(v.id) || []; h.push(v.acc); if (h.length > 40) h.shift(); hist.set(v.id, h);   // last 2 s
      if (!v.changing && v._wasChanging) v.changeEnd = world.time; v._wasChanging = v.changing;
      if (v.acc <= -4.9) { if (!hard.has(v.id)) { hard.add(v.id); hardBrakes++; } } else hard.delete(v.id);
      const inG = world.time < v.glanceUntil;
      if (inG && !glanceStart.has(v.id)) glanceStart.set(v.id, world.time);
      if (!inG && glanceStart.has(v.id)) { const d = world.time - glanceStart.get(v.id); glanceN++; glanceDurSum += d; if (d > 2) glanceOver2++; glanceStart.delete(v.id); }
      vehTicks++; if (inG) eyesOffTicks++;
    }
    if (t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
  }
}
const per = (x) => (1000 * x / vehKm).toFixed(3);
console.log(`exposure ${vehKm.toFixed(0)} veh·km over ${seeds.length} seeds`);
console.log(`near-crashes ${near} → ${per(near)} /1000 veh·km; mean TTC at onset ${(ttcSum / Math.max(near, 1)).toFixed(2)} s; lateral conflicts ${lateral} → ${per(lateral)}`);
console.log(`  follower glancing at onset: ${nearGlance} (${(100 * nearGlance / Math.max(near, 1)).toFixed(0)}%)`);
console.log(`  leader braked ≤ -2 m/s² in prior 2 s: ${nearLeadBrake} (${(100 * nearLeadBrake / Math.max(near, 1)).toFixed(0)}%);  ≤ -4.9: ${nearLeadHard} (${(100 * nearLeadHard / Math.max(near, 1)).toFixed(0)}%)`);
console.log(`  leader mid-change or just completed one (cut-in): ${nearLeadCutIn} (${(100 * nearLeadCutIn / Math.max(near, 1)).toFixed(0)}%)`);
console.log(`hard-braking events (≤ -4.9 m/s²) ${hardBrakes} → ${per(hardBrakes)} /1000 veh·km`);
console.log(`glances ${glanceN}: mean ${(glanceDurSum / Math.max(glanceN, 1)).toFixed(2)} s, > 2 s: ${(100 * glanceOver2 / Math.max(glanceN, 1)).toFixed(1)}%, eyes-off-road ${(100 * eyesOffTicks / vehTicks).toFixed(1)}% of time`);
console.log('near-crash followers by archetype', JSON.stringify(byProf), ' leaders', JSON.stringify(byLeadProf));
