'use strict';
// The one live chart the kit doesn't have: a scatter. The flow–density cloud is the
// fundamental diagram, the picture traffic flow theory is built on, so it stays. Every
// time series moved to <cb-sim-series> (ui.js); this paints its own small canvas with a
// palette resolved from the kit's tokens, like the Observer. No DOM here: ui.js hands
// it a ctx and the arrays, so the smoke test can draw it against a stub.

var ScatterGraph = class ScatterGraph {
  constructor(xmin, xmax, ymin, ymax, xLabel, yLabel, maxPoints) {
    this.xmin = xmin; this.xmax = xmax; this.ymin = ymin; this.ymax = ymax;
    this.xLabel = xLabel; this.yLabel = yLabel;
    this.maxPoints = maxPoints || 2400;   // only the most recent points are drawn
  }

  // xs, ys: the datamanager's own arrays (gaps allowed); older points fade.
  // pal: { axis, grid, point, font } resolved colours.
  draw(ctx, W, H, xs, ys, pal) {
    const padL = 4, padB = 14, padT = 4, pw = W - padL, ph = H - padB - padT;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = pal.grid; ctx.lineWidth = 1;
    for (const f of [0, 0.5, 1]) {
      const y = Math.round(padT + ph * (1 - f)) + 0.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.fillStyle = pal.axis; ctx.font = pal.font; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
    ctx.fillText(String(this.ymax) + ' ' + this.yLabel, padL + 2, padT + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(this.xmin), padL, H - 2);
    ctx.textAlign = 'center'; ctx.fillText(this.xLabel, padL + pw / 2, H - 2);
    ctx.textAlign = 'right'; ctx.fillText(String(this.xmax), W, H - 2);
    const n = Math.min(xs.length, ys.length), first = Math.max(0, n - this.maxPoints);
    for (let i = first; i < n; i++) {
      const vx = xs[i], vy = ys[i];
      if (!isFinite(vx) || !isFinite(vy)) continue;
      const px = padL + clamp((vx - this.xmin) / (this.xmax - this.xmin), 0, 1) * pw;
      const py = padT + ph - clamp((vy - this.ymin) / (this.ymax - this.ymin), 0, 1) * ph;
      ctx.globalAlpha = 0.2 + 0.6 * (i - first) / (n - first);   // older samples fade
      ctx.fillStyle = pal.point;
      ctx.fillRect(px - 1, py - 1, 2.5, 2.5);
    }
    ctx.globalAlpha = 1;
  }
};
