// Load the browser sim files into THIS realm — no contextified vm. The sources declare
// everything as `var` / `function`, so a script run in the current context defines them
// on globalThis, exactly as a <script> tag does. Measured 3.9× faster than a vm context
// on a human-mode run (5.09 → 1.32 s per 200 s of 240 vehicles), identical results —
// the contextified global proxy defeats V8 inlining on every PARAMETERS.* read
// (~/.claude/conventions.md §4). Not isolated: one process, one sim at a time (the
// suites reuse the globals sequentially, which is what they did with the vm context).
//   import { loadSim } from './headless.mjs';
//   const ctx = loadSim(['observer.js', 'charts.js']);   // ctx === globalThis
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import vm from 'vm';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CORE = ['util.js', 'params.js', 'engine.js', 'agent.js', 'world.js'];

export function loadSim(extra) {
  for (const f of CORE.concat(extra || [])) {
    vm.runInThisContext(readFileSync(path.join(__dirname, 'src', f), 'utf8'), { filename: f });
  }
  return globalThis;
}
