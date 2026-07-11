// No-DB sanity run. Verifies the model invariant and prints the numbers that belong in the
// DEVLOG entry (proof coupled to log). Exits non-zero on failure.
//   node smoketest.mjs
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ctx = { Math, console, Date };
vm.createContext(ctx);
for (const f of ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js']) {
  vm.runInContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), ctx, { filename: f });
}

const P = ctx.PARAMETERS;
const world = new ctx.World(800, 600);
const engine = new ctx.GameEngine();
const start = world.meanX();
for (let t = 1; t <= 500; t++) { engine.tick = t; world.update(engine); }
const end = world.meanX();

// invariant: positive drift moves mean-x right, negative moves it left
const ok = P.drift > 0 ? end > start : (P.drift < 0 ? end < start : true);
console.log('smoke: startMeanX=' + start.toFixed(3) + ' endMeanX=' + end.toFixed(3) +
  ' drift=' + P.drift + ' -> ' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
