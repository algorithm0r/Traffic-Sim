// Stage 17: why do human drivers crash more under the Enhanced IDM? Replays capdrop.mjs's
// merge case and, at each crash, prints the striking vehicle's last 4 s: its held command,
// actual acceleration, speed, gap and closing to the struck vehicle, the struck vehicle's
// acceleration, glance state and the looming evidence (reflex fires at 1).
//   node probes/eidmcrash.mjs [--case merge-bicycle-human] [--seeds 2,4] [--params JSON] [--max 6]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const caseName = flag('case', 'merge-bicycle-human'), seeds = flag('seeds', '2,4').split(',').map(Number);
const params = JSON.parse(flag('params', '{"coolness":0.99}')), maxCases = +flag('max', '6');
const human = caseName.endsWith('human'), drop = caseName.startsWith('drop');
const ctx = loadSim(); const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P)), BASE_ARCH = JSON.parse(JSON.stringify(ctx.ARCHETYPES));
let shown = 0;
for (const seed of seeds) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), {   // capdrop.mjs's geometries
    bodyModel: 'bicycle', openRoad: true, loopLength: 9000, openDeadZone: 600, laneCount: 2,
    numInterchanges: drop ? 0 : 1, demand: drop ? 0 : 600, laneDropAt: drop ? 3000 : null,
    detectorFracs: drop ? [2200 / 9000, 4200 / 9000] : [2400 / 9000, 4400 / 9000], upstreamDemand: 1800,
    initialDensity: 0, throughFraction: 1, profileVariability: 1, truckFraction: 0.08, seed });
  for (const k of Object.keys(ctx.ARCHETYPES)) {
    Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(BASE_ARCH[k])));
    if (!human) Object.assign(ctx.ARCHETYPES[k], JSON.parse(JSON.stringify(ctx.IDEAL_CONTROL)));
  }
  for (const [key, val] of Object.entries(params)) {
    if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
  }
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const hist = new Map(), keep = Math.round(4 / P.dt);
  const pending = [];
  const orig = world.crash.bind(world);
  world.crash = (veh, type) => { if (!veh.crashed) pending.push({ veh, type }); return orig(veh, type); };
  const upHi = drop ? 4200 : 3600;
  for (let t = 0; t < Math.round(65 * 60 / P.dt) && shown < maxCases; t++) {
    const m = Math.floor(t * P.dt / 60);
    P.upstreamDemand = m < 5 ? 1800 : m < 35 ? 1800 + (upHi - 1800) * (m - 5) / 30 : upHi;
    engine.tick++; world.update(engine);
    for (const v of world.vehicles) {
      let h = hist.get(v.id); if (!h) hist.set(v.id, h = []);
      h.push({ t: world.time, x: v.x, v: v.v, acc: v.acc, cmd: v.heldAcc, glance: world.time < v.glanceUntil,
               loom: v.loomA, chg: v.changing ? `${v.startLane}>${v.targetLane}` : '', ramp: !!v.onRamp });
      if (h.length > keep) h.shift();
    }
    if (pending.length >= 2) {
      const [a, b] = pending.splice(0, 2);
      // striker = the one behind (smaller front x along the road)
      const [s, o] = world.distAhead(a.veh.x, b.veh.x) < world.L / 2 ? [a.veh, b.veh] : [b.veh, a.veh];
      const hs = hist.get(s.id), ho = hist.get(o.id);
      console.log(`\n=== seed ${seed}, t=${world.time.toFixed(1)} ${a.type}: striker #${s.id} ${s.p.name} (tReact ${s.p.tReact.toFixed(2)}) ` +
        `→ #${o.id} ${o.p.name}${o.onRamp ? ' (ramp)' : ''}`);
      for (let i = 0; i < hs.length; i += Math.round(0.5 / P.dt)) {
        const S = hs[i], O = ho && ho[i + ho.length - hs.length];
        if (!O) continue;
        const gap = world.distAhead(S.x, O.x) - o.len;
        console.log(`  t=${S.t.toFixed(1)}  v ${S.v.toFixed(1)}  cmd ${S.cmd.toFixed(1)}  acc ${S.acc.toFixed(1)}  ` +
          `gap ${gap.toFixed(1)}  closing ${(S.v - O.v).toFixed(1)}  leader acc ${O.acc.toFixed(1)}  ` +
          `${S.glance ? 'GLANCE ' : ''}loom ${S.loom.toFixed(2)} ${S.chg}${O.chg ? ' leader ' + O.chg : ''}`);
      }
      shown++;
    }
  }
}
