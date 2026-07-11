'use strict';
// Pure helpers — no DOM, no globals beyond these. Safe to load in the browser AND in the
// headless vm context (declared as `var`/`function` so they attach to either global).
var TAU = Math.PI * 2;
var MPH2MS = 0.44704, MS2MPH = 2.23694;

function randomInt(n) { return Math.floor(Math.random() * n); }
function clamp(x, lo, hi) { return x < lo ? lo : (x > hi ? hi : x); }

// Box–Muller normal sample (Math.random)
function normalSample(mean, sd) {
  mean = mean || 0; sd = (sd == null) ? 1 : sd;
  const u = 1 - Math.random(), v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

// Deterministic PRNG (mulberry32) — reproducible runs when PARAMETERS.seed >= 0
function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller from a supplied rng (for seeded sampling)
function gaussFrom(rng, mean, sd) {
  const u = 1 - rng(), v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function rgb(r, g, b) { return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }
function hsl(h, s, l) { return 'hsl(' + (h | 0) + ',' + (s | 0) + '%,' + (l | 0) + '%)'; }
