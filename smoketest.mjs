// No-DB sanity run. Verifies model invariants against analytic expectations and prints the
// numbers that belong in the DEVLOG entry (proof coupled to log). Exits non-zero on failure.
//   node smoketest.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ctx = { Math, console, Date };
vm.createContext(ctx);
for (const f of ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js',
                 'observer.js', 'charts.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
}

const P = ctx.PARAMETERS;
const BASE = JSON.parse(JSON.stringify(P));
let failures = 0;

function check(label, cond, detail) {
  console.log(`  ${cond ? 'ok  ' : 'FAIL'} ${label}${detail ? ' — ' + detail : ''}`);
  if (!cond) failures++;
}

function run(overrides, ticks) {
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), overrides);
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  for (let t = 1; t <= ticks; t++) { engine.tick = t; world.update(engine); }
  return world;
}

// --- T1: homogeneous single-lane ring settles to the analytic IDM equilibrium -----------
{
  console.log('T1  homogeneous ring vs analytic IDM equilibrium');
  const world = run({
    laneCount: 1, numInterchanges: 0, initialDensity: 15, loopLength: 3000,
    profileVariability: 0, forceArchetype: 'normal', truckFraction: 0, seed: 42,
  }, 12000); // 600 s
  const n = world.vehicles.length;
  const m = world.metrics();
  const prof = world.vehicles[0].p;
  const gap = world.L / n - prof.len;
  const vEq = world.equilibriumSpeed(prof, gap);
  const relErr = Math.abs(m.meanV - vEq) / vEq;
  check('count conserved', n === Math.round(15 * 3000 / 1000), `n=${n}`);
  check('collision-free', m.stats.collisions === 0, `collisions=${m.stats.collisions}`);
  check('mean speed within 4% of analytic equilibrium', relErr < 0.04,
        `sim=${m.meanV.toFixed(2)} m/s  analytic=${vEq.toFixed(2)} m/s  err=${(relErr * 100).toFixed(1)}%`);
}

// --- T2: heterogeneous 3-lane ring — conservation, no collisions, sane lane behavior ----
{
  console.log('T2  heterogeneous 3-lane ring');
  const world = run({
    laneCount: 3, numInterchanges: 0, initialDensity: 20, loopLength: 4000,
    profileVariability: 1, truckFraction: 0.1, seed: 7,
  }, 6000); // 300 s
  const m = world.metrics();
  const n0 = Math.round(20 * 4000 / 1000) * 3;
  const byType = {};
  let badLane = 0, truckInLane0 = 0;
  for (const veh of world.vehicles) {
    (byType[veh.p.name] = byType[veh.p.name] || []).push(veh.v);
    if (veh.lane < 0 || veh.lane >= 3 || veh.x < 0 || veh.x >= world.L) badLane++;
    if (veh.p.truck && veh.lane === 0) truckInLane0++;
  }
  const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  check('count conserved', world.vehicles.length === n0, `n=${world.vehicles.length}/${n0}`);
  check('collision-free', m.stats.collisions === 0, `collisions=${m.stats.collisions}`);
  check('lane/position bounds hold', badLane === 0);
  check('lane changes occur', m.stats.laneChanges > 0, `changes=${m.stats.laneChanges}`);
  check('no trucks in the left lane', truckInLane0 === 0);
  check('aggressive faster than cautious',
        mean(byType.aggressive) > mean(byType.cautious),
        `agg=${mean(byType.aggressive).toFixed(1)}  caut=${mean(byType.cautious).toFixed(1)} m/s`);
}

// --- T3: interchanges — spawn, merge, exit, all collision-free --------------------------
{
  console.log('T3  interchanges (spawn/merge/exit)');
  const world = run({
    laneCount: 3, numInterchanges: 3, initialDensity: 12, loopLength: 6000,
    demand: 800, profileVariability: 1, truckFraction: 0.1, seed: 11,
  }, 12000); // 600 s
  const m = world.metrics();
  const s = m.stats;
  check('vehicles spawned at ramps', s.spawned > 50, `spawned=${s.spawned}`);
  check('merges happened', s.merges > 50, `merges=${s.merges}`);
  check('vehicles exited', s.exited > 50, `exited=${s.exited}`);
  check('collision-free', s.collisions === 0, `collisions=${s.collisions}`);
  check('missed exits rare', s.missedExits < 0.2 * (s.exited + 1),
        `missed=${s.missedExits} vs exited=${s.exited}`);
  check('ramp queues bounded', m.queueTotal < 50, `queue=${m.queueTotal}`);
  check('population bounded', m.count < 1200, `n=${m.count}`);
  console.log(`      meanV=${(m.meanV * 2.23694).toFixed(1)} mph  density=${m.density.toFixed(1)} veh/km/ln` +
              `  travelTime=${(s.travelTimeSum / Math.max(s.travelTimeN, 1)).toFixed(0)} s avg`);
}

// --- T4: renderer draws without exceptions against a recording stub ctx -----------------
{
  console.log('T4  renderer smoke (stub canvas)');
  Object.assign(P, JSON.parse(JSON.stringify(BASE)), { seed: 3 });
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  for (let t = 1; t <= 400; t++) { engine.tick = t; world.update(engine); }
  const observer = new ctx.Observer(world);
  let calls = 0, rects = 0;
  const stub = new Proxy({ canvas: { width: 1150, height: 760 } }, {
    get(t, k) {
      if (k === 'canvas') return t.canvas;
      return (...a) => { calls++; if (k === 'fillRect') rects++; };
    },
    set() { return true; },
  });
  let threw = null;
  try {
    observer.draw(stub);
    const speed = new ctx.LineGraph(0, 0, 100, 50, 'x');
    speed.push(1); speed.push(2); speed.draw(stub);
    const fd = new ctx.ScatterGraph(0, 0, 100, 50, 'x', 0, 80, 0, 2600);
    fd.push(10, 1000); fd.draw(stub);
  } catch (e) { threw = e; }
  check('draw() completes', threw === null, threw ? threw.message : undefined);
  check('vehicles drawn', rects > world.vehicles.length,
        `fillRects=${rects} vehicles=${world.vehicles.length} (calls=${calls})`);
}

console.log(failures === 0 ? 'PASS' : `FAIL (${failures} check(s))`);
process.exit(failures === 0 ? 0 : 1);
