'use strict';
// Minimal in-canvas charts (entities). Browser-only in practice — headless runs record the
// same data into packets without drawing.

var LineGraph = class LineGraph {
  constructor(x, y, w, h, label, maxPoints) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
    this.maxPoints = maxPoints || 600;
    this.data = []; this.min = 0; this.max = 1;
  }

  push(v) {
    this.data.push(v);
    if (this.data.length > this.maxPoints) this.data.shift();
    if (v > this.max) this.max = v;
    if (v < this.min) this.min = v;
  }

  update() {}

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#333'; ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
    ctx.fillText(this.label, this.x + 4, this.y + 12);
    ctx.fillText(this.max.toFixed(0), this.x + 4, this.y + 24);
    ctx.fillText(this.min.toFixed(0), this.x + 4, this.y + this.h - 4);
    if (this.data.length > 1) {
      const range = (this.max - this.min) || 1;
      ctx.strokeStyle = '#7fd1ff'; ctx.beginPath();
      for (let i = 0; i < this.data.length; i++) {
        const px = this.x + (i / (this.data.length - 1)) * this.w;
        const py = this.y + this.h - ((this.data[i] - this.min) / range) * this.h;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
};

// Safety panel: rates per 1000 veh·km against the SHRP2 naturalistic reference, crash
// mix as bars, glance and PET summaries. Reads the DataManager's running totals.
var SafetyPanel = class SafetyPanel {
  constructor(x, y, w, h, dm) { this.x = x; this.y = y; this.w = w; this.h = h; this.dm = dm; }
  update() {}
  draw(ctx) {
    const s = this.dm.world.stats, km = Math.max(this.dm.vehKm, 1e-9);
    const per = (v) => 1000 * v / km;
    ctx.save();
    ctx.strokeStyle = '#333'; ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
    ctx.fillText('safety — per 1000 veh·km (SHRP2 all-severity: crash 0.027, near 0.048)', this.x + 4, this.y + 12);
    const line = (i, txt, color) => { ctx.fillStyle = color || '#cdd2da'; ctx.fillText(txt, this.x + 4, this.y + 28 + i * 14); };
    line(0, `exposure ${km.toFixed(1)} veh·km   glances ${s.glances}   peripheral corrections ${s.periphCorrections}`);
    line(1, `near-crashes ${s.nearCrashes} (TTC<1.5 s) → ${per(s.nearCrashes).toFixed(2)}   with ≥0.5 g braking ${s.evasiveNear} → ${per(s.evasiveNear).toFixed(3)}`,
         per(s.nearCrashes) > 0.1 ? '#ffd479' : '#cdd2da');
    line(2, `crashes ${s.crashes / 2 | 0} events → ${per(s.crashes / 2).toFixed(3)}   secondary ${s.secondary}   cleared ${s.cleared}`,
         s.crashes ? '#ff7b72' : '#cdd2da');
    line(3, `PET mean ${(s.petSum / Math.max(s.petN, 1)).toFixed(2)} s   lane-change conflicts (<1 s) ${s.lcConflicts}/${s.petN}`);
    // crash mix bars
    const mix = [['rear-end', s.rearEnds, '#ff7b72'], ['sideswipe', s.sideswipeCrashes, '#ffd479'],
                 ['run-off', s.departures, '#d2a8ff'], ['merge-involved', s.mergeCrashes, '#7fd1ff']];
    const maxv = Math.max(1, ...mix.map((m) => m[1]));
    const bx = this.x + 110, bw = this.w - 130, by = this.y + 92;
    mix.forEach(([name, v, color], i) => {
      ctx.fillStyle = '#8a8f98'; ctx.fillText(name, this.x + 4, by + i * 13 + 9);
      ctx.fillStyle = color; ctx.fillRect(bx, by + i * 13, bw * v / maxv, 9);
      ctx.fillStyle = '#cdd2da'; ctx.fillText(String(v), bx + bw * v / maxv + 4, by + i * 13 + 9);
    });
    ctx.restore();
  }
};

// Fixed-range scatter — used for the live flow–density fundamental diagram.
var ScatterGraph = class ScatterGraph {
  constructor(x, y, w, h, label, xmin, xmax, ymin, ymax, maxPoints) {
    this.x = x; this.y = y; this.w = w; this.h = h; this.label = label;
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
    this.maxPoints = maxPoints || 800;
    this.points = [];
  }

  push(px, py) {
    this.points.push([px, py]);
    if (this.points.length > this.maxPoints) this.points.shift();
  }

  update() {}

  draw(ctx) {
    ctx.save();
    ctx.strokeStyle = '#333'; ctx.strokeRect(this.x, this.y, this.w, this.h);
    ctx.fillStyle = '#8a8f98'; ctx.font = '11px sans-serif';
    ctx.fillText(this.label, this.x + 4, this.y + 12);
    ctx.fillText(String(this.ymax), this.x + 4, this.y + 24);
    ctx.fillText(String(this.xmax), this.x + this.w - 24, this.y + this.h - 4);
    const n = this.points.length;
    for (let i = 0; i < n; i++) {
      const [vx, vy] = this.points[i];
      const px = this.x + clamp((vx - this.xmin) / (this.xmax - this.xmin), 0, 1) * this.w;
      const py = this.y + this.h - clamp((vy - this.ymin) / (this.ymax - this.ymin), 0, 1) * this.h;
      ctx.fillStyle = i === n - 1 ? '#ffd479' : 'rgba(127,209,255,' + (0.15 + 0.5 * i / n) + ')';
      ctx.fillRect(px - 1, py - 1, i === n - 1 ? 4 : 2, i === n - 1 ? 4 : 2);
    }
    ctx.restore();
  }
};
