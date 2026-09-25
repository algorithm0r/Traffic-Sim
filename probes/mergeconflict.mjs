// Stage 16: where do the capacity-drop runs' near-crashes come from? Replays capdrop.mjs's
// merge case and classifies every near-crash episode (TTC < 1.5 s, leader ahead) at onset:
// the leader cutting in (changing or merging into the follower's lane), the follower itself
// changing, or plain following; and where on the road (relative to the gore at 3160 m).
// The lane body has none in this experiment; the bicycle body has 6-18 per 1000 veh·km.
//   node probes/mergeconflict.mjs [--case merge-bicycle-ideal] [--seeds 1,2] [--gap follower]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const caseName = flag('case', 'merge-bicycle-ideal'), seeds = flag('seeds', '1,2').split(',').map(Number);
const gap = flag('gap', null);
const human = caseName.endsWith('human');
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P)), BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));
const GORE = 3160, ACCEND = 3440;

const tally = new Map(); let total = 0, evasive = 0, km = 0;
const onsets = [];
const src = { reflex: [], 'car-following law': [] };   // what produced the >= 0.5 g braking   // cut-in kinematics at onset
const q = (a, f) => { const s = a.map(f).sort((x, y) => x - y); return [0.1, 0.5, 0.9].map((p) => s[Math.floor(p * (s.length - 1))]); };
const add = (k, ev) => { const t = tally.get(k) || [0, 0]; t[0]++; if (ev) t[1]++; tally.set(k, t); };
for (const seed of seeds) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {   // capdrop.mjs's merge geometry
    bodyModel: 'bicycle', openRoad: true, loopLength: 9000, openDeadZone: 600, laneCount: 2, numInterchanges: 1,
    demand: 600, laneDropAt: null, detectorFracs: [2400 / 9000, 4400 / 9000], upstreamDemand: 1800,
    initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    if (!human) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
  }
  if (gap === 'follower') {
    const bOf = (a) => Array.isArray(a.b) ? a.b[0] : a.b;
    for (const a of Object.values(ctx.ARCHETYPES)) a.bSafe = bOf(a);
    P.lc.bAcceptMax = Math.max(...Object.values(ctx.ARCHETYPES).map(bOf));
  }
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const open = new Map(), ep = new Map();   // ep: per-episode reflex firing and hardest braking   // follower id -> class key, resolved when the episode ends
  world.onNearCrash = (veh, lead) => {
    const intoMine = lead.changing && lead.targetLane === veh.lane;
    const who = lead.onRamp && veh.onRamp && !lead.changing ? 'ramp queue: following on the ramp'
      : lead.onRamp ? 'leader merging from ramp'
      : intoMine ? 'leader cutting in (lane change)'
      : veh.onRamp ? 'follower merging from ramp'
      : veh.changing ? 'follower changing lanes'
      : lead.changing ? 'leader changing out' : 'plain following';
    const where = veh.x < GORE - 300 ? 'upstream (> 300 m before gore)' : veh.x <= ACCEND + 200 ? 'merge area' : 'downstream';
    open.set(veh.id, `${who} | ${where}`);
    ep.set(veh.id, { reflex: false, minAcc: 0 });
    if (lead.onRamp || intoMine) {
      const gap = world.gapX(veh, lead), closing = veh.v - lead.v;
      onsets.push({ ramp: !!lead.onRamp, gap, closing, vF: veh.v, vL: lead.v, accL: lead.acc,
                    req: closing > 0 ? closing * closing / (2 * Math.max(gap, 0.1)) : 0,
                    since: lead.changing ? world.time - lead.changeStart : NaN,
                    wall: lead.onRamp ? world.wallDist(lead) : NaN });
    }
  };
  const ticks = Math.round(65 * 60 / P.dt);
  for (let t = 0; t < ticks; t++) {
    const m = Math.floor(t * P.dt / 60);
    P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + 1800 * (m - 5) / 30 : 3600;
    engine.tick++; world.update(engine);
    if (t % 20 === 0) for (const v of world.vehicles) km += v.v * P.dt * 20 / 1000;
    for (const [id, key] of open) {   // episode closed (or vehicle gone): record with its outcome
      const v = world.vehicles.find((u) => u.id === id), e = ep.get(id);
      if (v && v.inNearCrash) { e.minAcc = Math.min(e.minAcc, v.acc); if (v.loomA >= 1) e.reflex = true; continue; }
      const ev = v ? v.nearEvasive : false;
      add(key, ev); total++; if (ev) { evasive++; src[e.reflex ? 'reflex' : 'car-following law'].push(e.minAcc); }
      open.delete(id); ep.delete(id);
    }
  }
  console.log(`seed ${seed}: ${total} episodes so far`);
}
console.log(`\n${caseName}${gap ? ' gap=' + gap : ''}, seeds ${seeds}: ${total} near-crashes (${(1000 * total / km).toFixed(2)} /1000 veh·km), ${evasive} evasive`);
for (const kind of [true, false]) {
  const o = onsets.filter((e) => e.ramp === kind); if (!o.length) continue;
  const f = (k) => q(o, (e) => e[k]).map((x) => isFinite(x) ? x.toFixed(1) : '–').join(' / ');
  console.log(`
  ${kind ? 'ramp merger' : 'mainline cut-in'} leaders at onset (n=${o.length}; 10th / 50th / 90th percentile):`);
  for (const [k, lab] of [['gap', 'bumper gap m'], ['closing', 'closing m/s'], ['vF', 'follower speed'], ['vL', 'leader speed'],
                          ['accL', 'leader accel'], ['req', 'required decel'], ['since', 's since change began'], ['wall', 'leader to lane end m']])
    console.log(`    ${lab.padEnd(22)} ${f(k)}`);
}
console.log('');
for (const [k, a] of Object.entries(src))
  console.log(`  evasive episodes braked by the ${k}: ${a.length}` + (a.length ? `, hardest decel median ${(-q(a, (x) => x)[1]).toFixed(1)} m/s²` : ''));
console.log('');
for (const [k, [n, ev]] of [...tally].sort((a, b) => b[1][0] - a[1][0]))
  console.log(`  ${String(n).padStart(4)} (${(100 * n / total).toFixed(0).padStart(3)}%)  evasive ${String(ev).padStart(3)}   ${k}`);
