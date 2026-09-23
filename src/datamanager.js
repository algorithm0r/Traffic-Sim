'use strict';
// Samples world metrics + loop detectors every reportingPeriod ticks, feeds the live
// graphs, and ships a self-describing packet (full PARAMETERS + samples) to the DB at
// epoch. The packet() helper (db.js) embeds PARAMETERS verbatim so every run reconstructs
// from its own record.
//
// NOTE: in the browser this auto-flushes at epoch (fire-and-forget, errors logged). The
// headless runner (runner.mjs) samples the same fields itself and awaits the write.
var DataManager = class DataManager {
  constructor(world, db, graphs) {
    this.world = world;
    this.db = db;
    this.graphs = graphs || {};   // { speed: LineGraph, fd: ScatterGraph, near: LineGraph }
    this.samples = [];
    this.vehKm = 0;               // exposure, for rates
    this._lastNear = 0;
    this.run = (PARAMETERS.db && PARAMETERS.db.run) || 'run';
    this.flushed = false;
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
      if (this.graphs.speed) this.graphs.speed.push(m.meanV * MS2MPH);
      if (this.graphs.fd && isFinite(det.flow)) this.graphs.fd.push(m.density, det.flow);
      if (this.graphs.near) {   // near-crashes per minute in this period
        this.graphs.near.push((m.stats.nearCrashes - this._lastNear) * 60 / period);
        this._lastNear = m.stats.nearCrashes;
      }
    }
    if (engine.tick % 20 === 0) {   // exposure: sum of distance travelled
      for (const v of this.world.vehicles) this.vehKm += v.v * P.dt * 20 / 1000;
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
