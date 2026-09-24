'use strict';
// The view. Reads world state and draws it; never mutates the model. The loop is folded
// into PARAMETERS.legs horizontal legs stacked vertically — traffic flows left→right on
// every leg, falls off the right edge onto the next leg down, and the bottom leg wraps
// back to the top (chevrons mark the linkage). Ramps hang below their leg (the road's
// right side, since we drive left→right).
var Observer = class Observer {
  constructor(world) { this.world = world; }

  update() {}

  // layout derived fresh each frame so live laneCount/legs changes just work
  layout(ctx) {
    const P = PARAMETERS, w = this.world;
    const margin = 34, laneH = 10, rampH = 14, top = 16;
    const legLen = w.L / P.legs;
    return {
      margin, laneH, rampH, top, legLen,
      pxm: (ctx.canvas.width - 2 * margin) / legLen,
      bandH: w.laneCount * laneH,
      legPitch: w.laneCount * laneH + rampH + 22,
    };
  }

  posToXY(g, x) {
    const leg = Math.min(Math.floor(x / g.legLen), PARAMETERS.legs - 1);
    return { leg, px: g.margin + (x - leg * g.legLen) * g.pxm, y: g.top + leg * g.legPitch };
  }

  draw(ctx) {
    const P = PARAMETERS, w = this.world, g = this.layout(ctx);
    const W = ctx.canvas.width;

    // --- roadway -------------------------------------------------------------------
    for (let leg = 0; leg < P.legs; leg++) {
      const y = g.top + leg * g.legPitch;
      ctx.fillStyle = '#1b212a';
      ctx.fillRect(g.margin, y, W - 2 * g.margin, g.bandH);
      ctx.strokeStyle = '#5a6272';
      ctx.lineWidth = 1;
      ctx.strokeRect(g.margin + 0.5, y + 0.5, W - 2 * g.margin - 1, g.bandH - 1);
      ctx.strokeStyle = '#39414f';
      ctx.setLineDash([6, 8]);
      for (let l = 1; l < w.laneCount; l++) {
        ctx.beginPath();
        ctx.moveTo(g.margin, y + l * g.laneH + 0.5);
        ctx.lineTo(W - g.margin, y + l * g.laneH + 0.5);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      // leg linkage chevrons: off the right edge, onto the next left edge
      ctx.fillStyle = '#4a5262';
      ctx.font = '10px sans-serif';
      ctx.fillText('▸', W - g.margin + 6, y + g.bandH / 2 + 3);
      ctx.fillText('▸', g.margin - 14, y + g.bandH / 2 + 3);
    }
    ctx.fillStyle = '#4a5262';
    if (!w.open) {
      ctx.fillText('↻ loop', W - g.margin - 30, g.top + (P.legs - 1) * g.legPitch + g.bandH + 12);
    } else {
      // open road: the void past the road's end, and the two boundaries labelled
      ctx.fillStyle = '#0b0e13';
      for (let s = w.xOut; s < w.L; s += 40) {
        const p = this.posToXY(g, s);
        ctx.fillRect(p.px, p.y, Math.min(40, w.L - s) * g.pxm + 1, g.bandH);
      }
      const pin = this.posToXY(g, 0), pout = this.posToXY(g, w.xOut);
      ctx.fillStyle = '#8a8f98'; ctx.font = '9px sans-serif';
      ctx.fillText('IN ' + (w.upstream.queue ? '(queue ' + w.upstream.queue + ')' : ''), pin.px, pin.y - 3);
      ctx.fillText('OUT', pout.px - 20, pout.y - 3);
    }

    // --- ramps (drawn in ~40 m steps so a ramp crossing a leg boundary splits itself) --
    for (const ramp of w.onramps) {
      ctx.fillStyle = ramp.drop ? '#1b212a' : '#242c37';
      for (let s = 0; s < ramp.len; s += 40) {
        const p = this.posToXY(g, (ramp.x + s) % w.L);
        const frac = s / ramp.len;
        // a dropped lane is a full lane until its taper; an onramp is a tapering stub
        const h = ramp.drop ? (ramp.len - s < 120 ? g.laneH * (ramp.len - s) / 120 : g.laneH)
                            : g.rampH * (1 - 0.55 * frac);
        ctx.fillRect(p.px, p.y + g.bandH, Math.min(40, ramp.len - s) * g.pxm + 1, h);
      }
      if (ramp.drop) continue;
      const p0 = this.posToXY(g, ramp.x);
      ctx.fillStyle = '#8a8f98';
      ctx.font = '9px sans-serif';
      ctx.fillText('ON ' + (ramp.idx + 1), p0.px, p0.y + g.bandH + g.rampH + 9);
      if (ramp.queue > 0) {
        ctx.fillStyle = '#e3b341';
        ctx.fillText('queue ' + ramp.queue, p0.px + 34, p0.y + g.bandH + g.rampH + 9);
      }
    }
    for (const exit of w.exits) {
      if (exit.decel) {
        ctx.fillStyle = '#1b212a';
        for (let s = 0; s < exit.decel.len; s += 20) {
          const p = this.posToXY(g, (exit.decel.start + s) % w.L);
          const h = g.laneH * Math.min(1, s / P.lc.taperLen);
          ctx.fillRect(p.px, p.y + g.bandH, Math.min(20, exit.decel.len - s) * g.pxm + 1, h);
        }
      }
      ctx.fillStyle = '#242c37';
      for (let s = 0; s < 120; s += 40) {
        const p = this.posToXY(g, (exit.x + s) % w.L);
        ctx.fillRect(p.px, p.y + g.bandH, 40 * g.pxm + 1, g.rampH * (0.45 + 0.55 * s / 120));
      }
      const p0 = this.posToXY(g, exit.x);
      ctx.fillStyle = '#8a8f98';
      ctx.font = '9px sans-serif';
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
      const h = veh.p.truck ? 7 : 6;
      const ttc = veh.ttc == null ? Infinity : veh.ttc;
      ctx.fillStyle = veh.crashed ? '#ff2d6f'
        : P.colorMode === 'type'
        ? ({ aggressive: '#ff7b72', normal: '#7fd1ff', cautious: '#d2a8ff', truck: '#e3b341' })[veh.p.name]
        : P.colorMode === 'safety'
        ? (ttc > 6 ? '#3d4a58' : hsl(120 * clamp((ttc - 1) / 5, 0, 1), 85, 55))   // grey = no conflict; red → green by TTC
        : hsl(130 * clamp(veh.v / vmax, 0, 1), 75, 55);
      if (bicycle) {
        const ang = Math.atan2(Math.sin(veh.psi) * latScale, Math.cos(veh.psi) * g.pxm * 8);
        ctx.save();
        ctx.translate(p.px, y);                   // (x, y) is the FRONT; rotate about it
        ctx.rotate(ang);
        ctx.fillRect(-len, -h / 2, len, h);
        if (veh.signal != null) {                 // turn signal toward the indicated lane
          const side = w.laneCenter(veh.signal) < veh.y ? -1 : 1;
          ctx.fillStyle = '#ffd23f';
          ctx.fillRect(-2, side * (h / 2) - 1, 2, 2);
        }
        if (P.colorMode === 'safety' && w.time < veh.glanceUntil) {   // eyes off the road
          ctx.fillStyle = '#ffffff';
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
