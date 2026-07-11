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
