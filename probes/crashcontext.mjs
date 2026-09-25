// Stage 15: what are the interchange-loop crashes and near-crashes? For each crash, both
// vehicles' state at contact: ramp merger / exit-bound changer / discretionary changer /
// lane-keeping; shoulder check skipped; glancing; relative speed; where on the loop (merge
// area, exit approach, open road). For near-crashes, the same context for the leader.
//   node probes/crashcontext.mjs [--k 8] [--seeds 10] [--secs 1500]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const k = +flag('k', '8'), nSeeds = +flag('seeds', '10'), secs = +flag('secs', '1500');
const ctx = loadSim(); const P = ctx.PARAMETERS; const BASE = JSON.parse(JSON.stringify(P));

const tally = {}; const inc = (key) => { tally[key] = (tally[key] || 0) + 1; };
const nearTally = {}; const ninc = (key) => { nearTally[key] = (nearTally[key] || 0) + 1; };
const examples = [];
for (let s = 0; s < nSeeds; s++) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', laneCount: 3, numInterchanges: 3,
    loopLength: 6000, demand: 800, initialDensity: k, throughFraction: 1, profileVariability: 1, truckFraction: 0.1, seed: 1000 + s });
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const where = (x) => {
    for (const r of world.onramps) { const p = world.distAhead(r.x, x); if (p <= r.len + 60) return 'merge-area'; }
    for (const e of world.exits) { const d = world.distAhead(x, e.x); if (d <= 500) return 'exit-approach'; }
    return 'open-road';
  };
  const role = (v) => v.onRamp ? 'ramp-merger'
    : v.changing ? (v.destExit != null && v.targetLane > v.startLane && world.routeDesire(v).d > 0.2 ? 'exit-changer' : 'discretionary-changer')
    : 'lane-keeping';
  const state = (v, other) => ({ id: v.id, role: role(v), v: +v.v.toFixed(1), relV: other ? +(v.v - other.v).toFixed(1) : null,
    checked: v.changing ? v.checked : null, glancing: world.time < v.glanceUntil, desire: +v.desire.toFixed(2),
    lane: v.lane, y: +v.y.toFixed(2), psi: +v.psi.toFixed(3), prof: v.p.name });
  // pair each contact: collisionPass2D calls crash(f) then crash(l) in the same tick
  const origCrash = world.crash.bind(world); let pending = null;
  world.crash = (veh, type) => {
    const fresh = !veh.crashed;
    if (fresh && type !== 'departure') {
      if (pending && pending.t === world.time) {
        const a = pending.veh, b = veh;
        const rec = { t: +world.time.toFixed(1), type, where: where(b.x), a: state(a, b), b: state(b, a) };
        inc(`${type} | ${rec.where} | ${[rec.a.role, rec.b.role].sort().join(' + ')}`);
        const unchecked = [rec.a, rec.b].some((x) => x.checked === false);
        if (unchecked) inc(`${type} | shoulder check skipped by a changer`);
        if ([rec.a, rec.b].some((x) => x.glancing)) inc(`${type} | someone glancing`);
        if (examples.length < 12) examples.push(rec);
        pending = null;
      } else pending = { t: world.time, veh };
    }
    return origCrash(veh, type);
  };
  world.onNearCrash = (veh, lead) => {
    ninc(`${where(veh.x)} | leader ${role(lead)} | follower ${role(veh)}`);
  };
  for (let t = 1; t <= secs / P.dt; t++) { engine.tick = t; world.update(engine); }
}
const show = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]).forEach(([key, n]) => console.log(`  ${String(n).padStart(4)}  ${key}`));
console.log(`k=${k}, ${nSeeds} seeds × ${secs} s — crash contacts by type | location | roles:`); show(tally);
console.log('near-crashes by location | leader role | follower role:'); show(nearTally);
console.log('examples:'); for (const e of examples) console.log('  ' + JSON.stringify(e));
