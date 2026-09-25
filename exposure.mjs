// Stage 15: safety exposure across traffic regimes. Human drivers (calibrated defaults),
// bicycle body, the interchange loop (3 lanes, 6 km, 3 interchanges, 800 veh/h per ramp),
// run at densities from light free flow to heavy congestion, many seeds in parallel worker
// processes. Per density: exposure (veh·km), crash events by type (rear-end, sideswipe,
// run-off-road, secondary; lane-change- or merge-involved), near-crashes, and the traffic
// state (mean speed, flow, speed variability) that places it among Golob et al.'s freeway
// regimes. Reference: Golob, Recker & Alvarez (Orange County freeways, >1000 crashes, 8
// regimes): heavily congested flow 83% rear-end; heavy variable free flow 79% rear-end +
// lane-change; light free flow 47% lane-change crashes (via FHWA's SHRP2 freeway-operations
// report, fig. 4).
//   node exposure.mjs [--ks 8,14,20,28,36] [--seeds-per-k 40] [--secs 1800] [--workers 3]
import { fork } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };

if (argv[0] === '--worker') {
  // ---- worker: run the (k, seed) jobs it is sent, report each result
  const { loadSim } = await import('./headless.mjs');
  const ctx = loadSim(); const P = ctx.PARAMETERS;
  const BASE = JSON.parse(JSON.stringify(P));
  process.on('message', (job) => {
    if (job === 'done') process.exit(0);
    const { k, seed, secs, params } = job;
    Object.assign(P, JSON.parse(JSON.stringify(BASE)), {
      bodyModel: 'bicycle', laneCount: 3, numInterchanges: 3, loopLength: 6000, demand: 800,
      // seeded traffic is THROUGH traffic, so each density holds; the ramps still add weaving
      // (800 veh/h per ramp merging in and leaving at the next exits)
      initialDensity: k, throughFraction: 1, profileVariability: 1, truckFraction: 0.1, seed, detectorFracs: [0.5],
    });
    for (const [key, val] of Object.entries(params || {})) {   // --params: variants, nested objects merged
      if (val && typeof val === 'object' && !Array.isArray(val)) Object.assign(P[key], val); else P[key] = val;
    }
    const world = new ctx.World(), engine = new ctx.GameEngine();
    const ticks = Math.round(secs / P.dt), warm = Math.round(300 / P.dt);
    let vehKm = 0; const detV = [];
    let s0 = null;
    for (let t = 1; t <= ticks; t++) {
      engine.tick = t; world.update(engine);
      if (t === warm) { s0 = Object.assign({}, world.stats); for (const d of world.detectors) { d.count = 0; d.speedSum = 0; } }
      if (t > warm && t % 20 === 0) for (const v of world.vehicles) vehKm += v.v * P.dt * 20 / 1000;
      if (t > warm && t % 100 === 0) { const d = world.detectors[0]; if (d.count) detV.push(d.speedSum / d.count); }
    }
    const s = world.stats, d = (key) => (s[key] || 0) - (s0[key] || 0);
    const mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
    const mu = mean(detV);
    const det = world.detectors[0];
    process.send({ k, seed, vehKm, secs: secs - 300, meanV: world.metrics().meanV,
      detStd: Math.sqrt(mean(detV.map((x) => (x - mu) * (x - mu)))),
      crashes: d('crashes') / 2, rear: d('rearEnds'), side: d('sideswipeCrashes'), depart: d('departures'),
      secondary: d('secondary'), laneChangeInvolved: d('mergeCrashes'), near: d('nearCrashes'),
      evasive: d('evasiveNear'), lateral: d('lateralConflicts') });
  });
} else {
  // ---- coordinator
  const ks = flag('ks', '8,14,20,28,36').split(',').map(Number);
  const per = +flag('seeds-per-k', '40'), secs = +flag('secs', '1800');
  const params = JSON.parse(flag('params', '{}'));
  const out = flag('out', 'exposure');
  const nw = Math.min(+flag('workers', '3'), ks.length * per);   // a workstation: keep it light (an 18-process batch hard-reset it)
  const jobs = [];
  for (const k of ks) for (let i = 0; i < per; i++) jobs.push({ k, seed: 1000 + i, secs, params });
  const results = []; const t0 = Date.now();
  await new Promise((resolve) => {
    let next = 0, live = nw;
    for (let w = 0; w < nw; w++) {
      const child = fork(__filename, ['--worker']);
      const give = () => { if (next < jobs.length) child.send(jobs[next++]); else { child.send('done'); } };
      child.on('message', (r) => {
        results.push(r);
        if (results.length % 20 === 0) console.log(`  ${results.length}/${jobs.length}  [${((Date.now() - t0) / 60000).toFixed(1)} min]`);
        give();
      });
      child.on('exit', () => { if (--live === 0) resolve(); });
      give();
    }
  });
  const rows = [];
  for (const k of ks) {
    const r = results.filter((x) => x.k === k);
    const sum = (key) => r.reduce((a, x) => a + x[key], 0);
    const km = sum('vehKm');
    const per1000 = (key) => 1000 * sum(key) / km;
    const events = sum('rear') + sum('side') + sum('depart');
    rows.push({ k, runs: r.length, vehKm: km, meanV: sum('meanV') / r.length, detStd: sum('detStd') / r.length,
      crashes: sum('crashes'), crashRate: 1000 * sum('crashes') / km,
      rear: sum('rear'), side: sum('side'), depart: sum('depart'), secondary: sum('secondary'),
      laneChangeInvolved: sum('laneChangeInvolved'), events,
      rearShare: events ? sum('rear') / events : NaN, sideShare: events ? sum('side') / events : NaN,
      departShare: events ? sum('depart') / events : NaN,
      near: per1000('near'), evasive: per1000('evasive'), lateral: per1000('lateral') });
  }
  mkdirSync(path.join(__dirname, 'results'), { recursive: true });
  writeFileSync(path.join(__dirname, 'results', out + '.json'), JSON.stringify({ generated: new Date().toISOString(), secs, per, params, rows, results }));
  const NL = String.fromCharCode(10);
  let md = '# Safety exposure across traffic regimes' + NL + NL +
    `Interchange loop (3 lanes, 6 km, 3 interchanges, 800 veh/h per ramp), human drivers at calibrated defaults${Object.keys(params).length ? ', variant ' + JSON.stringify(params) : ''}, ${per} seeds × ${secs - 300} s after a 300-s warm-up per density. Generated ${new Date().toISOString()}.` + NL + NL +
    '| k (veh/km/ln) | veh·km | mean speed (mph) | detector std (m/s) | crash events | per 1000 veh·km | rear-end | sideswipe | run-off | secondary | lane-change involved | near-crashes /1000 veh·km | evasive (≥0.5 g) |' + NL +
    '|---|---|---|---|---|---|---|---|---|---|---|---|---|' + NL;
  for (const r of rows) {
    const pc = (x) => Number.isFinite(x) ? (100 * x).toFixed(0) + '%' : '–';
    md += `| ${r.k} | ${r.vehKm.toFixed(0)} | ${(r.meanV * 2.23694).toFixed(0)} | ${r.detStd.toFixed(1)} | ${r.events} | ${r.crashRate.toFixed(3)} | ${r.rear} (${pc(r.rearShare)}) | ${r.side} (${pc(r.sideShare)}) | ${r.depart} (${pc(r.departShare)}) | ${r.secondary} | ${r.laneChangeInvolved} | ${r.near.toFixed(3)} | ${r.evasive.toFixed(3)} |` + NL;
  }
  writeFileSync(path.join(__dirname, 'results', out + '.md'), md);
  console.log(md);
  console.log(`[${((Date.now() - t0) / 60000).toFixed(1)} min]`);
}
