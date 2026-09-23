// Headless batch runner. Loads the SAME browser sim files into one vm context (no fork),
// runs reps, and writes self-describing packets via the standard DB client (direct transport).
//   node runner.mjs [--reps N] [--ticks N] [--db NAME] [--collection NAME] [--params JSON]
// Example: node runner.mjs --reps 20 --params '{"laneCount":2,"demand":1200}'
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const reps = parseInt(flag('reps', '1'), 10);
const ticksOverride = parseInt(flag('ticks', '0'), 10);
const overrides = JSON.parse(flag('params', '{}'));

// load the DOM-free sim core into a shared vm context (browser globals become ctx props
// because everything is declared `var` / `var X = class X` — no const→var patch needed)
const ctx = { Math, console, Date };
vm.createContext(ctx);
for (const f of ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
}

const P = ctx.PARAMETERS;
Object.assign(P, overrides);
const dbName = flag('db', P.db.db);
const collection = flag('collection', null);
const limit = ticksOverride || P.epoch;
const baseSeed = P.seed;

const db = createDB(Object.assign({}, P.db, { transport: 'direct', db: dbName }));
for (let r = 0; r < reps; r++) {
  const run = 'run_' + String(r).padStart(3, '0');
  db.config.run = run;
  if (baseSeed >= 0) P.seed = baseSeed + r;   // reproducible sweep when seeded
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const samples = [];
  for (let t = 1; t <= limit; t++) {
    engine.tick = t;
    world.update(engine);
    if (t % P.reportingPeriod === 0) {
      const det = world.readDetectors(P.reportingPeriod * P.dt);
      const m = world.metrics();
      samples.push({
        t: world.time, n: m.count, meanV: m.meanV, density: m.density,
        flow: det.flow, detSpeed: det.detSpeed, queue: m.queueTotal,
        laneChanges: m.stats.laneChanges, merges: m.stats.merges,
        exited: m.stats.exited, missedExits: m.stats.missedExits,
        collisions: m.stats.collisions,
        crashes: m.stats.crashes, rearEnds: m.stats.rearEnds, sideswipeCrashes: m.stats.sideswipeCrashes,
        departures: m.stats.departures, secondary: m.stats.secondary,
        nearCrashes: m.stats.nearCrashes, glances: m.stats.glances,
        lcConflicts: m.stats.lcConflicts, petMean: m.stats.petN ? m.stats.petSum / m.stats.petN : null,
      });
    }
  }
  const final = world.metrics();
  const pkt = db.packet(P, { run, samples, final });
  const res = await db.insert(collection || run, pkt);
  console.log(run + ': n=' + final.count + ' meanV=' + (final.meanV * 2.23694).toFixed(1) +
              'mph exited=' + final.stats.exited + ' collisions=' + final.stats.collisions +
              '  saved=' + JSON.stringify(res));
}
await db.close();
