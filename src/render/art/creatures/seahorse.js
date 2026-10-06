// Lined seahorse (Hippocampus erectus) — upright, facing +X; len = height. Cached body sprite (coronet, tubular
// snout, bony rings with knobs, brood pouch, prehensile curled tail, yellow-orange with fine dark lines) bent with
// sheared strips so the tail sways and curls; the dorsal and pectoral fins are live fans with a travelling ripple.
import { TAU, createRng, unitSprite, palette, modeOf, variant, easePose, blurred, limbPath, hang, hangEdgeY } from './kit.js';

const BOX = { x0: -0.17, x1: 0.34, y0: -0.52, y1: 0.48 };
const PAL = palette({ fin: ['#ffcf6a', 0.5], ray: ['#c27a1e', 0.6], finEdge: ['#fff0c0', 0.65] });
const OFFS = new Float32Array(24);

// tail centreline: from the trunk down, then curling forward into a spiral
const TAIL = [];
{
  const pts = [[-0.01, 0.06], [-0.05, 0.15], [-0.075, 0.24], [-0.07, 0.32], [-0.04, 0.38]];
  for (const p of pts) TAIL.push(p);
  for (let k = 1; k <= 9; k++) {
    const a = Math.PI * 0.75 - k * 0.55, r = 0.065 * (1 - k * 0.075);
    TAIL.push([0.0 + Math.cos(a) * r * 1.05, 0.36 + Math.sin(a) * r]);
  }
}

/** Each body part as its own path (filled one by one: overlapping sub-paths would cancel out). */
function bodyParts(g, fill) {
  const n = TAIL.length;
  const xs = new Float32Array(n), ys = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = TAIL[i][0];
    ys[i] = TAIL[i][1];
  }
  const part = (fn) => {
    g.beginPath();
    fn();
    g.fill();
  };
  g.fillStyle = fill;
  part(() => limbPath(g, xs, ys, n, 0.105, 0.012, 0.8));
  part(() => g.ellipse(0.0, -0.06, 0.088, 0.15, 0.08, 0, TAU)); // trunk
  part(() => g.ellipse(0.045, 0.0, 0.085, 0.09, 0, 0, TAU)); // brood pouch
  const nx = new Float32Array([0.0, -0.045, -0.035, 0.0]), ny = new Float32Array([-0.18, -0.26, -0.33, -0.38]);
  part(() => limbPath(g, nx, ny, 4, 0.1, 0.08, 1)); // neck
  part(() => g.ellipse(0.02, -0.39, 0.068, 0.056, -0.2, 0, TAU)); // head
  const sx = new Float32Array([0.05, 0.12, 0.19, 0.225]), sy = new Float32Array([-0.38, -0.365, -0.345, -0.34]);
  part(() => limbPath(g, sx, sy, 4, 0.056, 0.04, 1)); // tubular snout
}

function paintBody(g, res) {
  const rng = createRng(919);
  const gr = g.createLinearGradient(-0.12, 0, 0.16, 0);
  gr.addColorStop(0, '#a8661c');
  gr.addColorStop(0.35, '#e8a83a');
  gr.addColorStop(0.7, '#f6c860');
  gr.addColorStop(1, '#d08a2a');
  bodyParts(g, gr);
  g.save();
  g.globalCompositeOperation = 'source-atop'; // details only where the body is
  // bony rings across trunk and tail, with knobs at their ends
  g.strokeStyle = 'rgba(120,64,12,0.45)';
  g.lineWidth = 0.006;
  for (let k = 0; k < 11; k++) {
    const y = -0.2 + k * 0.026;
    g.beginPath();
    g.moveTo(-0.1, y + 0.012);
    g.quadraticCurveTo(0.02, y - 0.012, 0.14, y + 0.01);
    g.stroke();
  }
  for (let i = 1; i < TAIL.length - 2; i++) {
    const [x, y] = TAIL[i], [x2, y2] = TAIL[i + 1];
    const a = Math.atan2(y2 - y, x2 - x) + Math.PI / 2, w = 0.05 * (1 - i / TAIL.length);
    g.beginPath();
    g.moveTo(x - Math.cos(a) * w, y - Math.sin(a) * w);
    g.lineTo(x + Math.cos(a) * w, y + Math.sin(a) * w);
    g.stroke();
  }
  // the "lines" of the lined seahorse: fine dark streaks down the neck and trunk + white dots
  g.strokeStyle = 'rgba(70,36,8,0.3)';
  g.lineWidth = 0.003;
  for (let k = 0; k < 6; k++) {
    const x = -0.065 + k * 0.03;
    g.beginPath();
    g.moveTo(x - 0.01, -0.3);
    g.bezierCurveTo(x - 0.03, -0.2, x + 0.01, -0.05, x - 0.005, 0.08);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(255,250,230,${0.4 + rng.next() * 0.4})`;
    g.beginPath();
    g.arc(-0.09 + rng.next() * 0.22, -0.32 + rng.next() * 0.4, 0.003 + rng.next() * 0.003, 0, TAU);
    g.fill();
  }
  blurred(g, res, 0.012, () => {
    g.fillStyle = 'rgba(255,240,200,0.45)';
    g.beginPath();
    g.ellipse(0.05, -0.08, 0.03, 0.11, 0.1, 0, TAU);
    g.fill();
  });
  g.restore();
  // knobs along the back edge and the coronet
  g.fillStyle = '#b8701e';
  for (let k = 0; k < 8; k++) {
    g.beginPath();
    g.arc(-0.085 + Math.sin(k * 0.6) * 0.008, -0.2 + k * 0.038, 0.009, 0, TAU);
    g.fill();
  }
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI / 2 - 0.9 + k * 0.45;
    g.beginPath();
    g.ellipse(0.0 + Math.cos(a) * 0.035, -0.43 + Math.sin(a) * 0.035, 0.011, 0.02, a + Math.PI / 2, 0, TAU);
    g.fill();
  }
  // gill cover ridge + eye
  g.strokeStyle = 'rgba(120,64,12,0.55)';
  g.lineWidth = 0.006;
  g.beginPath();
  g.arc(0.0, -0.37, 0.05, 0.4, 2.0);
  g.stroke();
  const ex = 0.035, ey = -0.4;
  g.fillStyle = '#6a3a10';
  g.beginPath();
  g.arc(ex, ey, 0.022, 0, TAU);
  g.fill();
  const eg = g.createRadialGradient(ex - 0.004, ey - 0.005, 0.002, ex, ey, 0.016);
  eg.addColorStop(0, '#f0c050');
  eg.addColorStop(0.6, '#8a5a10');
  eg.addColorStop(1, '#2a1804');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(ex, ey, 0.016, 0, TAU);
  g.fill();
  g.fillStyle = '#080604';
  g.beginPath();
  g.arc(ex + 0.002, ey, 0.007, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.beginPath();
  g.arc(ex - 0.005, ey - 0.006, 0.004, 0, TAU);
  g.fill();
}

/** A fan fin: base from (x0,y0) to (x1,y1), rays of length L pointing along `dir`, with a travelling ripple. */
function fanFin(ctx, len, P, x0, y0, x1, y1, L, dir, rays, t, speed) {
  ctx.beginPath();
  ctx.moveTo(x0 * len, y0 * len);
  for (let k = 0; k <= rays; k++) {
    const u = k / rays;
    const a = dir + 0.5 * Math.sin(t * speed - u * 5.5) * (0.4 + 0.6 * u);
    const bx = x0 + (x1 - x0) * u, by = y0 + (y1 - y0) * u;
    const l = L * (0.55 + 0.45 * Math.sin(u * Math.PI));
    ctx.lineTo((bx + Math.cos(a) * l) * len, (by + Math.sin(a) * l) * len);
  }
  ctx.lineTo(x1 * len, y1 * len);
  ctx.closePath();
  ctx.fillStyle = P.fin;
  ctx.fill();
  ctx.strokeStyle = P.finEdge;
  ctx.lineWidth = 0.004 * len;
  ctx.stroke();
  ctx.beginPath();
  for (let k = 0; k <= rays; k++) {
    const u = k / rays;
    const a = dir + 0.5 * Math.sin(t * speed - u * 5.5) * (0.4 + 0.6 * u);
    const bx = x0 + (x1 - x0) * u, by = y0 + (y1 - y0) * u;
    const l = L * (0.55 + 0.45 * Math.sin(u * Math.PI));
    ctx.moveTo(bx * len, by * len);
    ctx.lineTo((bx + Math.cos(a) * l * 0.95) * len, (by + Math.sin(a) * l * 0.95) * len);
  }
  ctx.strokeStyle = P.ray;
  ctx.lineWidth = 0.003 * len;
  ctx.stroke();
}

export const DRAWERS = {
  seahorse: {
    bounds: { x0: -0.26, x1: 0.36, y0: -0.53, y1: 0.48 },
    mouth: { x: 0.235, y: -0.34 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const body = variant(unitSprite('sh_body', BOX, lenPx, paintBody), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const h = easePose(anim, 0, hooked ? 1 : 0, 4);
      const t = anim.t;
      const bob = Math.sin(t * 1.3 + anim.seed * 6) * 0.012 * len;
      const lean = 0.08 * Math.min(1, anim.amp) + Math.sin(t * 0.8) * 0.03 + h * Math.sin(t * 5) * 0.12;
      // tail sways and curls a little; strips below the trunk follow a lagging wave
      const n = 10;
      for (let j = 0; j <= n; j++) {
        const u = Math.max(0, (hangEdgeY(body, 0.05, n, j) - 0.05) / 0.43);
        OFFS[j] = (Math.sin(t * 1.1 - u * 2.5 + anim.seed * 4) * 0.025 + h * Math.sin(t * 6 - u * 3) * 0.06) * len * u;
      }
      ctx.save();
      ctx.translate(0, bob);
      ctx.rotate(lean);
      if (!opts.silhouette) fanFin(ctx, len, P, -0.09, -0.08, -0.1, 0.06, 0.075, Math.PI + 0.15, 9, t, 9 + 4 * h);
      hang(ctx, body, len, 0.05, n, OFFS, opts);
      if (!opts.silhouette) fanFin(ctx, len, P, -0.035, -0.31, -0.045, -0.27, 0.045, Math.PI * 0.85, 5, t + 1, 11);
      ctx.restore();
    },
  },
};
