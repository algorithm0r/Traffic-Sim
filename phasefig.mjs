// Render results/phase.json as a self-contained figure page, results/phase.html:
// heatmaps of mean speed, wave-onset (detector speed std) and near-crash rate over the
// reaction-time × density grid, each cell carrying its seed spread; the breakdown boundary
// drawn where the seed-mean detector std crosses `--boundary` m/s (default 2). No
// dependencies, no network — the data are inlined so the page works from file:// and Pages.
//   node phasefig.mjs [--boundary 2]
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (n, d) => { const i = argv.indexOf('--' + n); return i >= 0 ? argv[i + 1] : d; };
const boundary = parseFloat(flag('boundary', '2'));

const data = JSON.parse(readFileSync(path.join(__dirname, 'results', 'phase.json'), 'utf8'));
const { densities, tReacts, cells, seeds, secs } = data;
const cell = (k, t) => cells.find((c) => c.density === k && c.tReactX === t);
const spread = (c, key) => {
  const v = c.seeds.map((s) => s[key]);
  return { lo: Math.min(...v), hi: Math.max(...v) };
};

// colour scales (light-on-dark, perceptually ordered): speed green→red, rates log grey→red
const lerp = (a, b, t) => a + (b - a) * t;
const speedColor = (mph) => { const t = Math.max(0, Math.min(1, (mph - 15) / 50)); return `hsl(${lerp(0, 130, t)},70%,${lerp(45, 40, t)}%)`; };
const rateColor = (r, max) => { const t = r <= 0 ? 0 : Math.max(0, Math.min(1, Math.log10(1 + r) / Math.log10(1 + max))); return `hsl(${lerp(210, 0, t)},${lerp(10, 80, t)}%,${lerp(22, 45, t)}%)`; };
const stdColor = (s) => { const t = Math.max(0, Math.min(1, s / 8)); return `hsl(${lerp(210, 0, t)},${lerp(10, 80, t)}%,${lerp(22, 45, t)}%)`; };

const W = 92, H = 56, L = 70, T = 30;
function heatmap(title, key, color, fmt, spreadFmt, withBoundary) {
  const w = L + tReacts.length * W + 10, h = T + densities.length * H + 40;
  let svg = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${title}">`;
  svg += `<text x="${L}" y="18" class="title">${title}</text>`;
  densities.forEach((k, i) => {
    svg += `<text x="${L - 8}" y="${T + i * H + H / 2 + 4}" class="lab" text-anchor="end">${k}</text>`;
    tReacts.forEach((t, j) => {
      const c = cell(k, t), v = c[key], sp = spread(c, key);
      const x = L + j * W, y = T + i * H;
      svg += `<rect x="${x}" y="${y}" width="${W - 2}" height="${H - 2}" fill="${color(v)}" rx="3"><title>k=${k} veh/km/ln, tReact×${t}: ${key} ${fmt(v)} (seeds ${spreadFmt(sp.lo)}–${spreadFmt(sp.hi)})</title></rect>`;
      svg += `<text x="${x + (W - 2) / 2}" y="${y + H / 2}" class="val" text-anchor="middle">${fmt(v)}</text>`;
      svg += `<text x="${x + (W - 2) / 2}" y="${y + H / 2 + 15}" class="sp" text-anchor="middle">${spreadFmt(sp.lo)}–${spreadFmt(sp.hi)}</text>`;
    });
  });
  tReacts.forEach((t, j) => { svg += `<text x="${L + j * W + (W - 2) / 2}" y="${T + densities.length * H + 16}" class="lab" text-anchor="middle">×${t.toFixed(1)}</text>`; });
  svg += `<text x="${L + tReacts.length * W / 2}" y="${h - 6}" class="axis" text-anchor="middle">reaction time multiplier</text>`;
  svg += `<text transform="translate(14,${T + densities.length * H / 2}) rotate(-90)" class="axis" text-anchor="middle">density (veh/km/lane)</text>`;
  if (withBoundary) {
    // boundary: between cells whose seed-mean detector std is below/above the threshold
    const broken = (k, t) => cell(k, t).detStd >= boundary;
    densities.forEach((k, i) => tReacts.forEach((t, j) => {
      const x = L + j * W, y = T + i * H;
      if (j + 1 < tReacts.length && broken(k, t) !== broken(k, tReacts[j + 1]))
        svg += `<line x1="${x + W - 1}" y1="${y - 1}" x2="${x + W - 1}" y2="${y + H - 1}" class="bnd"/>`;
      if (i + 1 < densities.length && broken(k, t) !== broken(densities[i + 1], t))
        svg += `<line x1="${x - 1}" y1="${y + H - 1}" x2="${x + W - 1}" y2="${y + H - 1}" class="bnd"/>`;
    }));
  }
  return svg + '</svg>';
}

const maxNear = Math.max(...cells.map((c) => c.near)), maxCrash = Math.max(...cells.map((c) => c.crash));
const f0 = (v) => v.toFixed(0), f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2), f3 = (v) => v.toFixed(3);
const html = `<!doctype html>
<meta charset="utf-8">
<title>Reaction time × density phase diagram</title>
<style>
  body { margin: 0; padding: 20px 24px; background: #11151c; color: #cdd2da; font: 14px/1.45 system-ui, sans-serif; max-width: 1100px; }
  h1 { font-size: 20px; margin: 0 0 4px; } p { color: #8a8f98; max-width: 78ch; }
  .row { display: flex; flex-wrap: wrap; gap: 24px; }
  svg { background: #0b0e13; border-radius: 8px; }
  .title { fill: #cdd2da; font-size: 13px; font-weight: 600; } .lab { fill: #8a8f98; font-size: 12px; }
  .axis { fill: #8a8f98; font-size: 11px; } .val { fill: #fff; font-size: 13px; font-weight: 600; }
  .sp { fill: rgba(255,255,255,.7); font-size: 10px; } .bnd { stroke: #ffd23f; stroke-width: 3; stroke-linecap: round; }
  code { color: #ffd479; }
</style>
<h1>Reaction time × density phase diagram</h1>
<p>3-lane 4 km ring, human archetypes (bicycle body, fallible perception), ${secs} s per run, ${seeds.length} seeds per cell
(${seeds.join(', ')}); each cell shows the seed mean with the seed min–max beneath. The yellow boundary is where the
seed-mean detector speed std crosses ${boundary} m/s — wave onset. Generated ${data.generated}. Regenerate:
<code>node phase.mjs --seeds ${seeds.join(',')} && node phasefig.mjs</code>.</p>
<div class="row">
${heatmap('Mean speed (mph)', 'meanV', speedColor, f0, f0, true)}
${heatmap(`Detector speed std after warm-up (m/s) — wave onset`, 'detStd', stdColor, f1, f1, true)}
</div>
<div class="row" style="margin-top:24px">
${heatmap('Near-crashes per 1000 veh·km (TTC < 1.5 s, leader ahead)', 'near', (v) => rateColor(v, maxNear), f2, f1, true)}
${heatmap('Crashes per 1000 veh·km (SHRP2 all-severity ≈ 0.027)', 'crash', (v) => rateColor(v, Math.max(maxCrash, 0.1)), f3, f2, true)}
</div>
<p>Reading: the breakdown boundary runs diagonally — the density at which the ring breaks down falls as reaction time
rises — and the safety rates ride the same boundary, spanning orders of magnitude across the grid while the crash rate stays
near zero on the fluid side. Reaction time is a phase-transition control parameter. Seed spreads are wide on the boundary:
near-crashes cluster in realizations that form a wave (results/calib-note.md).</p>
`;
writeFileSync(path.join(__dirname, 'results', 'phase.html'), html);
console.log('wrote results/phase.html');
