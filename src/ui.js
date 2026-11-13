'use strict';
// ALL DOM lives here (and in index.html). The sim classes never touch the document, which
// is what lets the same files run headlessly. This file builds the control strip under
// the world (Claude Basic's CB.sim.controls), resolves the road's colours from the kit's
// tokens, applies scenario presets, and wires each chart once to the datamanager's arrays.
var $ = (id) => document.getElementById(id);

// The params.js defaults, captured before anything changes them: every scenario starts
// from these, so switching scenarios never inherits a setting from the last one.
var DEFAULTS = JSON.parse(JSON.stringify(PARAMETERS));
// Viewer choices that survive a scenario switch (unless the scenario needs one of them).
var KEEP = ['bodyModel', 'idealDrivers', 'colorMode', 'updatesPerDraw'];
var UI = { scenario: 'rush' };

function scenarioByKey(key) { return SCENARIOS.find((s) => s.key === key) || SCENARIOS[0]; }

function applyScenario(key) {
  const sc = scenarioByKey(key), P = PARAMETERS;
  UI.scenario = sc.key;
  const keep = {};
  for (const k of KEEP) keep[k] = P[k];
  const fresh = JSON.parse(JSON.stringify(DEFAULTS));
  for (const k in fresh) {
    // nested groups are refilled in place, so any reference to PARAMETERS.lc stays good
    if (fresh[k] && typeof fresh[k] === 'object' && !Array.isArray(fresh[k]) && P[k]) Object.assign(P[k], fresh[k]);
    else P[k] = fresh[k];
  }
  Object.assign(P, keep);
  for (const k in sc.set) {
    const v = sc.set[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) Object.assign(P[k], v);
    else P[k] = Array.isArray(v) ? v.slice() : v;
  }
  describeScenario();
}

// --- colours: tokens → the strings a canvas can use ---------------------------------
// A canvas can't read var(), so the kit's resolver turns each token into rgb() here, and
// again on every theme change. Speed and time-to-collision run bad → warn → ok.
function rampStrings(res, n) {
  const lut = CB.sim.lut([res('var(--cb-bad)').rgb, res('var(--cb-warn)').rgb, res('var(--cb-ok)').rgb], n);
  const out = [];
  for (let i = 0; i < n; i++) out.push('rgb(' + lut[i * 4] + ',' + lut[i * 4 + 1] + ',' + lut[i * 4 + 2] + ')');
  return out;
}

function worldColors() {
  let c = null;
  CB.sim.palette($('world'), (res, pal) => {
    const css = (v) => res(v).css;
    const ramp = rampStrings(res, 24);
    c = {
      road: css('var(--cb-surface-2)'), edge: css('var(--cb-border-2)'), dash: css('var(--cb-border)'),
      ramp: css('var(--cb-surface-3)'), label: css('var(--cb-muted)'), queue: css('var(--cb-warn)'),
      signal: css('var(--cb-gold)'), eyes: css('var(--cb-text)'), crashed: css('var(--cb-accent)'),
      calm: css('var(--cb-muted-2)'), font: pal.family,
      speed: ramp, ttc: ramp,
      type: { aggressive: css('var(--cb-series-1)'), normal: css('var(--cb-series-2)'),
              cautious: css('var(--cb-series-3)'), truck: css('var(--cb-series-4)') },
      // the flow–density scatter
      axis: pal.axis, grid: pal.grid, point: css('var(--cb-series-2)'),
      chartFont: pal.font,
    };
  });
  return c;
}

// --- the key to the world: marks with names, matching the colour mode ---------------
var LEGENDS = {
  speed: [
    { label: 'at the speed limit', mark: 'square', color: 'var(--cb-ok)' },
    { label: 'slowing', mark: 'square', color: 'var(--cb-warn)' },
    { label: 'stopped', mark: 'square', color: 'var(--cb-bad)' },
  ],
  type: [
    { label: 'aggressive', mark: 'square', color: 'var(--cb-series-1)' },
    { label: 'normal', mark: 'square', color: 'var(--cb-series-2)' },
    { label: 'cautious', mark: 'square', color: 'var(--cb-series-3)' },
    { label: 'truck', mark: 'square', color: 'var(--cb-series-4)' },
  ],
  safety: [
    { label: 'no conflict', mark: 'square', color: 'var(--cb-muted-2)' },
    { label: 'time to collision 6 s', mark: 'square', color: 'var(--cb-ok)' },
    { label: '3 s', mark: 'square', color: 'var(--cb-warn)' },
    { label: 'under 1.5 s', mark: 'square', color: 'var(--cb-bad)' },
    { label: 'eyes off the road', mark: 'dot', color: 'var(--cb-text)' },
  ],
};
var LEGEND_TAIL = [
  { label: 'turn signal', mark: 'dot', color: 'var(--cb-gold)' },
  { label: 'crashed', mark: 'square', color: 'var(--cb-accent)' },
];
function updateLegend() {
  $('legend').data = (LEGENDS[PARAMETERS.colorMode] || LEGENDS.speed).concat(LEGEND_TAIL);
}

// --- what am I looking at --------------------------------------------------------------
function describeScenario() {
  const P = PARAMETERS, sc = scenarioByKey(UI.scenario);
  $('blurb').textContent = sc.blurb;
  const notes = [];
  if (P.laneDropAt && P.bodyModel !== 'bicycle') notes.push('The lane drop exists only for the 2D body: with 1D lanes this road has no drop.');
  if (P.colorMode === 'safety' && P.bodyModel !== 'bicycle') notes.push('Safety colours need the 2D body: the 1D body has no time-to-collision or glances.');
  if (P.idealDrivers) notes.push('Ideal drivers: no reaction delay, no perception error, never look away. Crashes become (nearly) impossible.');
  const el = $('scnote');
  el.textContent = notes.join(' ');
  el.hidden = notes.length === 0;
}

// --- the control strip -------------------------------------------------------------------
function buildControls() {
  const open = PARAMETERS.openRoad;
  const schema = [
    { key: 'ui.scenario', label: 'Scenario', type: 'select',
      options: SCENARIOS.map((s) => ({ value: s.key, label: s.label })) },
    { key: 'P.bodyModel', label: 'Car body', type: 'select', resets: true,
      options: [{ value: 'bicycle', label: '2D: steered (bicycle model)' },
                { value: 'lane', label: '1D: lane slots (changes jump)' }] },
    { key: 'P.colorMode', label: 'Colour cars by', type: 'select',
      options: [{ value: 'speed', label: 'speed' }, { value: 'type', label: 'driver type' },
                { value: 'safety', label: 'safety (time to collision)' }] },
    { key: 'P.idealDrivers', label: 'Ideal drivers', type: 'switch', resets: true },
  ];
  for (const spec of PARAM_SCHEMA) {
    if (open && spec.key === 'initialDensity') continue;   // the open road fills from IN
    if (spec.openOnly && !open) continue;
    if (spec.key === 'demand' && PARAMETERS.numInterchanges === 0) continue;   // no onramps
    schema.push(Object.assign({}, spec, { key: 'P.' + spec.key }));
  }
  CB.sim.controls($('controls'), schema, { P: PARAMETERS, ui: UI }, {
    onReset: reset,
    onChange: (key, v) => {
      if (key === 'ui.scenario') { applyScenario(v); buildControls(); reset(); }
      else if (key === 'P.colorMode') { updateLegend(); describeScenario(); }
      else describeScenario();
    },
    buttons: [
      { label: paused ? 'Run' : 'Pause', onClick: (e) => { togglePause(); e.target.textContent = paused ? 'Run' : 'Pause'; } },
      { label: 'Restart', primary: true, onClick: reset },
    ],
  });
}

// --- charts: wired once per reset to the datamanager's own arrays --------------------
function wireCharts(dm) {
  const s = dm.series, dx = PARAMETERS.reportingPeriod * PARAMETERS.dt / 60;   // x in minutes
  $('cSpeed').data = { dx, series: [{ label: 'mean speed', values: s.speed, color: 'var(--cb-series-2)' }] };
  $('cFlow').data = { dx, series: [{ label: 'flow', values: s.flow, color: 'var(--cb-series-2)' }] };
  $('cHist').data = { dx, columns: s.speedHist };
  $('cQueue').data = { dx, series: [{ label: 'waiting', values: s.queue, color: 'var(--cb-warn)' }] };
  $('cNear').data = { dx, series: [{ label: 'near-crashes', values: s.nearPerMin, color: 'var(--cb-warn)' }] };
  $('cRate').data = { dx, series: [
    { label: 'this run', values: s.evasiveRate, color: 'var(--cb-bad)' },
    { label: 'real drivers (SHRP2)', values: s.shrp2, color: 'var(--cb-muted)' }] };
  $('cCrash').data = { dx, series: [
    { label: 'rear-end', values: s.rearEnds, color: 'var(--cb-series-1)' },
    { label: 'sideswipe', values: s.sideswipes, color: 'var(--cb-series-3)' },
    { label: 'run off road', values: s.departures, color: 'var(--cb-series-4)' }] };
}

// the flow–density scatter: its own canvas, sized to its box at the device pixel ratio
var FD_GRAPH = new ScatterGraph(0, 120, 0, 2600, 'density (veh/km/lane)', 'veh/h/lane');
function drawFD(dm, colors) {
  const cv = $('cFD'), dpr = window.devicePixelRatio || 1;
  const w = cv.clientWidth, h = 150;
  if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  FD_GRAPH.draw(ctx, w, h, dm.series.fdDensity, dm.series.fdFlow,
                { axis: colors.axis, grid: colors.grid, point: colors.point, font: colors.chartFont });
}

// browser-only entity: keeps the dial and the scatter current, and re-reads colours on a theme change
var UiPump = class UiPump {
  constructor(world, observer, dm) { this.world = world; this.observer = observer; this.dm = dm; this.seen = -1; }
  update() {}
  draw() {
    $('clock').value = this.world.time / 60;   // minutes
    if (this.dm.series.speed.length !== this.seen) { this.seen = this.dm.series.speed.length; drawFD(this.dm, this.observer.c); }
  }
};

document.addEventListener('cb-theme', () => {
  if (!observer) return;
  observer.c = worldColors();
  if (dataManager) drawFD(dataManager, observer.c);
});
