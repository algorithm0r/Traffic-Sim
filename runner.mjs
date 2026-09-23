// Headless batch runner. Loads the SAME browser sim files into this realm (no fork,
// ~4× faster than a vm context), runs reps, and writes self-describing packets via the
// standard DB client. Mongo lives on mint and its port is localhost-only there, so from
// another box the transport is 'socket' through the research Server (the browser's path);
// on mint itself 'direct' works.
//   node runner.mjs [--reps N] [--ticks N] [--params JSON] [--db NAME]
//                   [--collection NAME]   (default: the next batch_NNN in the DB)
//                   [--transport socket|direct] [--server URL] [--scratch] [--tag TEXT]
// Example: node runner.mjs --reps 20 --params '{"laneCount":2,"demand":1200}' --tag "merge sweep"
// Conventions (~/.claude/conventions.md §4): batch = collection batch_NNN; run names
// run_NNN inside it; --scratch writes to the project's _scratch database instead.
import { createRequire } from 'module';
import { loadSim } from './headless.mjs';

const require = createRequire(import.meta.url);
const { createDB } = require('./src/db.js');

const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const reps = parseInt(flag('reps', '1'), 10);
const ticksOverride = parseInt(flag('ticks', '0'), 10);
const overrides = JSON.parse(flag('params', '{}'));
const tag = flag('tag', '');

const ctx = loadSim();
const P = ctx.PARAMETERS;
Object.assign(P, overrides);
const dbName = flag('db', P.db.db);
const limit = ticksOverride || P.epoch;
const baseSeed = P.seed;

let db = createDB(Object.assign({}, P.db, {
  transport: flag('transport', P.db.transport),
  server: flag('server', P.db.server),
  mongoUrl: process.env.MONGO_URL || P.db.mongoUrl,
  db: dbName,
}));
if (argv.includes('--scratch')) db = db.scratch();
const collection = flag('collection', null) || await db.nextBatch();
console.log(`[runner] ${db.config.transport} → ${db.dbName}.${collection}  reps=${reps} ticks=${limit}` +
            (tag ? `  tag="${tag}"` : ''));

for (let r = 0; r < reps; r++) {
  const run = 'run_' + String(r).padStart(3, '0');
  db.config.run = run;
  if (baseSeed >= 0) P.seed = baseSeed + r;   // reproducible sweep when seeded
  const world = new ctx.World();
  const engine = new ctx.GameEngine();
  const samples = [];
  let vehKm = 0;
  for (let t = 1; t <= limit; t++) {
    engine.tick = t;
    world.update(engine);
    if (t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
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
        vehKm,
      });
    }
  }
  const final = world.metrics();
  final.vehKm = vehKm;
  const pkt = db.packet(P, { run, tag, samples, final, crashLog: world.crashLog || [] });
  const res = await db.insert(collection, pkt);
  console.log(run + ': n=' + final.count + ' meanV=' + (final.meanV * 2.23694).toFixed(1) +
              'mph vehKm=' + vehKm.toFixed(0) + ' near=' + final.stats.nearCrashes +
              ' crashes=' + (final.stats.crashes / 2 | 0) + '  saved=' + JSON.stringify(res));
}
await db.close();
