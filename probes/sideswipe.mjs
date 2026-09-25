// Stage 15: trace the first sideswipes on the interchange loop, tick by tick, for the 4 s
// before contact: both vehicles' longitudinal offset, lateral position, heading, speed, held
// steering, lateral clearance toward each other, maneuver state and decision timing.
//   node probes/sideswipe.mjs [--k 8] [--max 2]
import { loadSim } from '../headless.mjs';
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const k = +flag('k', '8'), maxCases = +flag('max', '2');
const ctx = loadSim(); const P = ctx.PARAMETERS; const BASE = JSON.parse(JSON.stringify(P));
let found = 0;
for (let seed = 1000; seed < 1040 && found < maxCases; seed++) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), { bodyModel: 'bicycle', laneCount: 3, numInterchanges: 3,
    loopLength: 6000, demand: 800, initialDensity: k, throughFraction: 1, profileVariability: 1, truckFraction: 0.1, seed });
  const world = new ctx.World(), engine = new ctx.GameEngine();
  const hist = new Map();
  let caught = null;
  const origCrash = world.crash.bind(world); let first = null;
  world.crash = (veh, type) => {
    if (!veh.crashed && type === 'sideswipe' && !caught) {
      if (first && first.t === world.time) caught = [first.veh, veh]; else first = { t: world.time, veh };
    }
    return origCrash(veh, type);
  };
  for (let t = 1; t <= 1500 / P.dt && !caught; t++) {
    engine.tick = t; world.update(engine);
    for (const v of world.vehicles) {
      const h = hist.get(v.id) || [];
      h.push({ t: world.time, x: v.x, y: v.y, psi: v.psi, v: v.v, acc: v.acc, delta: v.heldDelta, chg: v.changing ? `${v.startLane}>${v.targetLane}` : '-',
               ramp: !!v.onRamp, decide: world.time >= v.nextDecision - 1e-9, glance: world.time < v.glanceUntil });
      if (h.length > 40) h.shift(); hist.set(v.id, h);
    }
  }
  if (!caught) continue;
  found++;
  const [a, b] = caught;
  console.log(`\n=== seed ${seed}, t=${world.time.toFixed(1)}: sideswipe #${a.id} (${a.p.name}, len ${a.len}) × #${b.id} (${b.p.name}, len ${b.len})`);
  const ha = hist.get(a.id), hb = hist.get(b.id);
  for (let i = 0; i < ha.length; i += 2) {
    const A = ha[i], B = hb[i]; if (!B) continue;
    const dx = world.distAhead(B.x, A.x); const dxs = dx > world.L / 2 ? dx - world.L : dx;
    console.log(`  t=${A.t.toFixed(1)}  A: y=${A.y.toFixed(2)} ψ=${A.psi.toFixed(3)} v=${A.v.toFixed(1)} acc=${A.acc.toFixed(1)} δ=${A.delta.toFixed(3)} ${A.chg}${A.ramp ? ' ramp' : ''}${A.glance ? ' GLANCE' : ''}  |  ` +
      `B: y=${B.y.toFixed(2)} ψ=${B.psi.toFixed(3)} v=${B.v.toFixed(1)} acc=${B.acc.toFixed(1)} δ=${B.delta.toFixed(3)} ${B.chg}${B.ramp ? ' ramp' : ''}${B.glance ? ' GLANCE' : ''}  |  A front ahead of B front by ${dxs.toFixed(1)} m`);
  }
}
