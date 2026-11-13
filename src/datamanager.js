'use strict';
// Samples world metrics + loop detectors every reportingPeriod ticks, keeps the live
// chart series, and ships a self-describing packet (full PARAMETERS + samples) to the DB
// at epoch. The packet() helper (db.js) embeds PARAMETERS verbatim so every run
// reconstructs from its own record.
//
// The chart series are plain arrays, one value per reporting period. ui.js hands these
// same arrays to the kit's <cb-sim-*> elements once, and the elements repaint when they
// grow, so nothing here touches the DOM and the class still runs headless.
//
// NOTE: in the browser this auto-flushes at epoch (fire-and-forget, errors logged). The
// headless runner (runner.mjs) samples the same fields itself and awaits the write.
var SPEED_BIN_MPH = 5, SPEED_BINS = 18;   // speed histogram: 0-90 mph in 5 mph bins
var SHRP2_NEAR = 0.048;                    // SHRP2 near-crashes per 1000 veh·km, all severity
var FLOW_SMOOTH_S = 60;                    // s, rolling window of the charted detector flow
var FD_CELL = 500;                         // m, the cells the fundamental diagram is measured in

var DataManager = class DataManager {
  constructor(world, db) {
    this.world = world;
    this.db = db;
    this.samples = [];
    this.vehKm = 0;               // exposure, for rates
    this._lastNear = 0;
    this._flowWin = [];           // detector flow per period, last minute
    this._cellT = [];             // time spent (s) per 500-m mainline cell, this period
    this._cellD = [];             // distance travelled (m) per cell, this period
    this.run = (PARAMETERS.db && PARAMETERS.db.run) || 'run';
    this.flushed = false;
    this.series = {
      speed: [],        // mean speed, mph
      flow: [],         // detector flow, veh/h/lane
      fdDensity: [],    // Edie density per 500-m cell per period, veh/km/lane (flattened)
      fdFlow: [],       // Edie flow, same cells, veh/h/lane
      queue: [],        // vehicles waiting at onramps (and the open road's entrance)
      nearPerMin: [],   // TTC < 1.5 s near-crashes begun this period, per minute
      evasiveRate: [],  // near-crashes with >= 0.5 g braking per 1000 veh·km, running
      shrp2: [],        // the SHRP2 reference, as a flat line
      rearEnds: [], sideswipes: [], departures: [],   // crashes so far, by type
      speedHist: [],    // per period: vehicles per 5-mph speed bin
    };
  }

  update(engine) {
    const P = PARAMETERS;
    if (engine.tick % P.reportingPeriod === 0) {
      const period = P.reportingPeriod * P.dt;
      const det = this.world.readDetectors(period);
      const m = this.world.metrics();
      this.samples.push({
        t: this.world.time, n: m.count, meanV: m.meanV, density: m.density,
        flow: det.flow, detSpeed: det.detSpeed, queue: m.queueTotal,
        laneChanges: m.stats.laneChanges, merges: m.stats.merges,
        exited: m.stats.exited, missedExits: m.stats.missedExits,
        collisions: m.stats.collisions,
        crashes: m.stats.crashes, rearEnds: m.stats.rearEnds, sideswipeCrashes: m.stats.sideswipeCrashes,
        departures: m.stats.departures, secondary: m.stats.secondary,
        nearCrashes: m.stats.nearCrashes, glances: m.stats.glances, lcConflicts: m.stats.lcConflicts,
        vehKm: this.vehKm,
      });
      const s = this.series, st = m.stats;
      s.speed.push(m.meanV * MS2MPH);
      // A 5-s detector count is a handful of cars, so the flow line is a 1-minute rolling
      // mean (the packet's samples keep the raw per-period flow).
      if (isFinite(det.flow)) this._flowWin.push(det.flow);
      if (this._flowWin.length > FLOW_SMOOTH_S / period) this._flowWin.shift();
      s.flow.push(this._flowWin.length ? this._flowWin.reduce((a, b) => a + b, 0) / this._flowWin.length : null);
      // The fundamental diagram: Edie's flow and density in every 500-m cell of the
      // mainline this period (distance travelled and time spent in the cell, divided by its
      // space-time area). One point per cell per period, so the cloud traces both branches;
      // a single loop detector only sees a jam if one happens to pass it, and on a closed
      // ring the road's average density is fixed by the vehicle count.
      const nCells = Math.floor(this.world.xOut / FD_CELL);
      const drop = P.openRoad && P.laneDropAt && P.bodyModel === 'bicycle' ? P.laneDropAt : 0;
      for (let c = 0; c < nCells; c++) {
        // upstream of a lane drop the cell has one more lane (the one that ends)
        const cellArea = FD_CELL * period * (this.world.laneCount + ((c + 1) * FD_CELL <= drop ? 1 : 0));
        s.fdDensity.push(1000 * (this._cellT[c] || 0) / cellArea);
        s.fdFlow.push(3600 * (this._cellD[c] || 0) / cellArea);
      }
      this._cellT = []; this._cellD = [];
      s.queue.push(m.queueTotal + (m.upstreamQueue || 0));
      s.nearPerMin.push((st.nearCrashes - this._lastNear) * 60 / period);
      this._lastNear = st.nearCrashes;
      // a rate over a few veh·km is noise, so the line starts once exposure is meaningful
      s.evasiveRate.push(this.vehKm >= 50 ? 1000 * st.evasiveNear / this.vehKm : null);
      s.shrp2.push(SHRP2_NEAR);
      s.rearEnds.push(st.rearEnds); s.sideswipes.push(st.sideswipeCrashes); s.departures.push(st.departures);
      const hist = new Array(SPEED_BINS).fill(0);
      for (const v of this.world.vehicles) {
        hist[Math.min(SPEED_BINS - 1, Math.floor(v.v * MS2MPH / SPEED_BIN_MPH))]++;
      }
      s.speedHist.push(hist);
    }
    if (engine.tick % 20 === 0) {   // exposure: sum of distance travelled
      const w = this.world, h = P.dt * 20;
      for (const v of w.vehicles) {
        this.vehKm += v.v * h / 1000;
        if (v.onRamp && !v.onRamp.drop) continue;   // mainline only, as in world.metrics()
        const c = Math.floor(v.x / FD_CELL);
        this._cellT[c] = (this._cellT[c] || 0) + h;
        this._cellD[c] = (this._cellD[c] || 0) + v.v * h;
      }
    }
    if (!this.flushed && engine.tick >= P.epoch) {
      this.flushed = true;
      this.flush();
    }
  }

  async flush() {
    if (!this.db) return { ok: false };
    const m = this.world.metrics();
    const pkt = this.db.packet(PARAMETERS, { run: this.run, samples: this.samples, final: m });
    try {
      const res = await this.db.insert(this.run, pkt);
      if (typeof console !== 'undefined') console.log('[data] saved', JSON.stringify(res));
      return res;
    } catch (e) {
      if (typeof console !== 'undefined') console.error('[data] save failed:', e.message);
      return { ok: false, error: e.message };
    }
  }

  draw() {}
};
