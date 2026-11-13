'use strict';
// The view. Reads world state and draws it; never mutates the model. The loop is folded
// into PARAMETERS.legs horizontal legs stacked vertically — traffic flows left→right on
// every leg, falls off the right edge onto the next leg down, and the bottom leg wraps
// back to the top (chevrons mark the linkage). Ramps hang below their leg (the road's
// right side, since we drive left→right).
//
// Colours come in from ui.js, resolved from the Claude Basic tokens (a canvas can't read
// var()), so a theme change repaints the road. Headless callers (the smoke test) pass
// nothing and get the plain fallback below; no DOM is touched either way.
var OBSERVER_FALLBACK = {
  road: 'dimgray', edge: 'gray', dash: 'gray', ramp: 'gray', label: 'silver', queue: 'goldenrod',
  signal: 'gold', eyes: 'white', crashed: 'magenta', calm: 'gray', font: 'sans-serif',
  speed: ['red', 'orange', 'green'], ttc: ['red', 'orange', 'green'],
  type: { aggressive: 'red', normal: 'skyblue', cautious: 'plum', truck: 'goldenrod' },
};

var Observer = class Observer {
  constructor(world, colors) { this.world = world; this.c = colors || OBSERVER_FALLBACK; }

  update() {}

  // layout derived fresh each frame so live laneCount/legs changes just work
  layout(ctx) {
    const P = PARAMETERS, w = this.world;
    const margin = 34, laneH = 10, rampH = 14, top = 18;
    const legLen = w.L / P.legs;
    const bandH = w.laneCount * laneH;
    return {
      margin, laneH, rampH, top, legLen, bandH,
      pxm: (ctx.canvas.width - 2 * margin) / legLen,
      legPitch: bandH + rampH + 20,
    };
  }

  /** canvas height the current road needs (ui.js sizes the canvas with it) */
  height() {
    const g = this.layout({ canvas: { width: 1000 } });
    return Math.ceil(g.top + PARAMETERS.legs * g.legPitch);
  }

  posToXY(g, x) {
    const leg = Math.min(Math.floor(x / g.legLen), PARAMETERS.legs - 1);
    return { leg, px: g.margin + (x - leg * g.legLen) * g.pxm, y: g.top + leg * g.legPitch };
  }

  // a colour from an evenly spaced ramp (low → high), f in [0, 1]
  ramp(stops, f) { return stops[Math.round(clamp(f, 0, 1) * (stops.length - 1))]; }

  draw(ctx) {
    const P = PARAMETERS, w = this.world, g = this.layout(ctx), c = this.c;
    const W = ctx.canvas.width;
    const label = (px) => px + 'px ' + c.font;

    // --- roadway -------------------------------------------------------------------
    for (let leg = 0; leg < P.legs; leg++) {
      const y = g.top + leg * g.legPitch;
      ctx.fillStyle = c.road;
      ctx.fillRect(g.margin, y, W - 2 * g.margin, g.bandH);
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1;
      ctx.strokeRect(g.margin + 0.5, y + 0.5, W - 2 * g.margin - 1, g.bandH - 1);
      ctx.strokeStyle = c.dash;
      ctx.setLineDash([6, 8]);
      for (let l = 1; l < w.laneCount; l++) {
        ctx.beginPath();
        ctx.moveTo(g.margin, y + l * g.laneH + 0.5);
        ctx.lineTo(W - g.margin, y + l * g.laneH + 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // leg linkage chevrons: off the right edge, onto the next left edge
      ctx.fillStyle = c.label;
      ctx.font = label(10);
      ctx.fillText('▸', W - g.margin + 6, y + g.bandH / 2 + 3);
      ctx.fillText('▸', g.margin - 14, y + g.bandH / 2 + 3);
    }
    ctx.fillStyle = c.label;
    ctx.font = label(10);
    if (!w.open) {
      ctx.fillText('↻ back to the top', W - g.margin - 92, g.top + (P.legs - 1) * g.legPitch + g.bandH + 13);
    } else {
      // open road: the void past the road's end, and the two boundaries labelled
      for (let s = w.xOut; s < w.L; s += 40) {
        const p = this.posToXY(g, s);
        ctx.clearRect(p.px, p.y, Math.min(40, w.L - s) * g.pxm + 1, g.bandH);
      }
      const pin = this.posToXY(g, 0), pout = this.posToXY(g, w.xOut);
      ctx.fillStyle = c.label;
      ctx.fillText('IN', pin.px, pin.y - 4);
      if (w.upstream.queue) {
        ctx.fillStyle = c.queue;
        ctx.fillText('waiting to enter ' + w.upstream.queue, pin.px + 18, pin.y - 4);
      }
      ctx.fillStyle = c.label;
      ctx.fillText('OUT', pout.px - 22, pout.y - 4);
    }

    // --- ramps (drawn in ~40 m steps so a ramp crossing a leg boundary splits itself) --
    for (const ramp of w.onramps) {
      ctx.fillStyle = ramp.drop ? c.road : c.ramp;
      for (let s = 0; s < ramp.len; s += 40) {
        const p = this.posToXY(g, (ramp.x + s) % w.L);
        const frac = s / ramp.len;
        // a dropped lane is a full lane until its taper; an onramp is a tapering stub
        const h = ramp.drop ? (ramp.len - s < 120 ? g.laneH * (ramp.len - s) / 120 : g.laneH)
                            : g.rampH * (1 - 0.55 * frac);
        ctx.fillRect(p.px, p.y + g.bandH, Math.min(40, ramp.len - s) * g.pxm + 1, h);
      }
      const p0 = this.posToXY(g, ramp.drop ? ramp.len - 120 : ramp.x);
      ctx.fillStyle = c.label;
      ctx.font = label(10);
      if (ramp.drop) { ctx.fillText('LANE ENDS', p0.px, p0.y + g.bandH + g.laneH + 11); continue; }
      ctx.fillText('ON ' + (ramp.idx + 1), p0.px, p0.y + g.bandH + g.rampH + 9);
      if (ramp.queue > 0) {
        ctx.fillStyle = c.queue;
        ctx.fillText('waiting ' + ramp.queue, p0.px + 34, p0.y + g.bandH + g.rampH + 9);
      }
    }
    for (const exit of w.exits) {
      if (exit.decel) {
        ctx.fillStyle = c.road;
        for (let s = 0; s < exit.decel.len; s += 20) {
          const p = this.posToXY(g, (exit.decel.start + s) % w.L);
          const h = g.laneH * Math.min(1, s / P.lc.taperLen);
          ctx.fillRect(p.px, p.y + g.bandH, Math.min(20, exit.decel.len - s) * g.pxm + 1, h);
        }
      }
      ctx.fillStyle = c.ramp;
      for (let s = 0; s < 120; s += 40) {
        const p = this.posToXY(g, (exit.x + s) % w.L);
        ctx.fillRect(p.px, p.y + g.bandH, 40 * g.pxm + 1, g.rampH * (0.45 + 0.55 * s / 120));
      }
      const p0 = this.posToXY(g, exit.x);
      ctx.fillStyle = c.label;
      ctx.font = label(10);
      ctx.fillText('EXIT ' + (exit.idx + 1), p0.px, p0.y + g.bandH + g.rampH + 9);
    }

    // --- vehicles ---------------------------------------------------------------------
    // lane body: visLane eases through changes. bicycle body: true (y, heading) — the
    // rotation angle is computed in PIXEL space because the lateral and longitudinal
    // scales differ (laneH px/lane vs pxm px/m), otherwise headings look wildly wrong.
    const vmax = P.speedLimitMph * MPH2MS;
    const bicycle = P.bodyModel === 'bicycle';
    const latScale = g.laneH / P.laneWidth;
    const drawVeh = (veh) => {
      const p = this.posToXY(g, veh.x);
      const y = p.y + (bicycle ? veh.y * latScale : (veh.visLane + 0.5) * g.laneH);
      const len = Math.max(2.5, veh.len * g.pxm);
      const h = veh.p.truck ? 6 : 5;
      const ttc = veh.ttc == null ? Infinity : veh.ttc;
      ctx.fillStyle = veh.crashed ? c.crashed
        : P.colorMode === 'type' ? c.type[veh.p.name]
        : P.colorMode === 'safety'
        ? (ttc > 6 ? c.calm : this.ramp(c.ttc, (ttc - 1) / 5))   // calm = no conflict; red → green by TTC
        : this.ramp(c.speed, veh.v / vmax);
      if (bicycle) {
        const ang = Math.atan2(Math.sin(veh.psi) * latScale, Math.cos(veh.psi) * g.pxm * 8);
        ctx.save();
        ctx.translate(p.px, y);                   // (x, y) is the FRONT; rotate about it
        ctx.rotate(ang);
        ctx.fillRect(-len, -h / 2, len, h);
        if (veh.signal != null) {                 // turn signal toward the indicated lane
          const side = w.laneCenter(veh.signal) < veh.y ? -1 : 1;
          ctx.fillStyle = c.signal;
          ctx.fillRect(-2, side * (h / 2) - 1, 2, 2);
        }
        if (P.colorMode === 'safety' && w.time < veh.glanceUntil) {   // eyes off the road
          ctx.fillStyle = c.eyes;
          ctx.fillRect(-len / 2 - 1, -1, 2, 2);
        }
        ctx.restore();
      } else {
        ctx.fillRect(p.px - len, y - h / 2, len, h);
      }
    };
    for (const veh of w.vehicles) drawVeh(veh);
    if (!bicycle) for (const ramp of w.onramps) for (const veh of ramp.vehicles) drawVeh(veh);
  }
};
