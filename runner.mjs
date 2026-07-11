// Headless batch runner. Loads the SAME browser sim files into one vm context (no fork),
// runs reps, and writes self-describing packets via the standard DB client (direct transport).
//   node runner.mjs [--reps N] [--ticks N] [--db NAME] [--collection NAME]
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

// load the DOM-free sim core into a shared vm context (browser globals become ctx props
// because everything is declared `var` / `var X = class X` — no const→var patch needed)
const ctx = { Math, console, Date };
vm.createContext(ctx);
for (const f of ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
}

const P = ctx.PARAMETERS;
const dbName = flag('db', P.db.db);
const collection = flag('collection', null);
const limit = ticksOverride || P.epoch;

const db = createDB(Object.assign({}, P.db, { transport: 'direct', db: dbName }));
for (let r = 0; r < reps; r++) {
  const run = 'run_' + String(r).padStart(3, '0');
  db.config.run = run;
  const world = new ctx.World(800, 600);
  const engine = new ctx.GameEngine();
  const samples = [];
  for (let t = 1; t <= limit; t++) {
    engine.tick = t;
    world.update(engine);
    if (t % P.reportingPeriod === 0) samples.push({ tick: t, meanX: world.meanX() });
  }
  const pkt = db.packet(P, { run, samples, finalMeanX: world.meanX() });
  const res = await db.insert(collection || run, pkt);
  console.log(run + ': finalMeanX=' + world.meanX().toFixed(3) + '  saved=' + JSON.stringify(res));
}
await db.close();
