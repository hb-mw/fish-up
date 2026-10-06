// Green sea turtle (Chelonia mydas) — side view facing +X, seen a little from above so the scute pattern reads;
// len = carapace length. Cached sprites: shell (+plastron, tail), head, front flipper, rear flipper. The front
// flippers "fly" (slow synchronous down/up stroke, foreshortening as they twist); rear flippers steer; the head bobs.
import { TAU, createRng, unitSprite, drawUnitSprite, variant, easePose, blurred } from './kit.js';

const SHELL = { x0: -0.6, x1: 0.56, y0: -0.27, y1: 0.13 };
const HEAD = { x0: 0.38, x1: 0.8, y0: -0.13, y1: 0.12 };
const FLIP = { x0: -0.03, x1: 0.6, y0: -0.09, y1: 0.09 };
const REAR = { x0: -0.02, x1: 0.24, y0: -0.07, y1: 0.07 };
const DOME = (x) => -0.215 * Math.pow(Math.max(0, 1 - Math.pow((x + 0.03) / 0.5, 2)), 0.62) + 0.03;

function shellPath(g) {
  g.beginPath();
  g.moveTo(-0.52, 0.04);
  for (let i = 0; i <= 40; i++) {
    const x = -0.52 + (i / 40) * 1.02;
    g.lineTo(x, DOME(x));
  }
  g.quadraticCurveTo(0.52, 0.07, 0.44, 0.075);
  g.lineTo(-0.44, 0.075);
  g.quadraticCurveTo(-0.55, 0.07, -0.52, 0.04);
  g.closePath();
}

/** One scute: a soft polygon with a radiating "sunburst" from its growth centre (cx, cy). */
function scute(g, rng, pts, cx, cy) {
  g.save();
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.clip();
  const gr = g.createRadialGradient(cx, cy, 0.005, cx, cy, 0.16);
  gr.addColorStop(0, '#d2b46a');
  gr.addColorStop(0.35, '#8c7440');
  gr.addColorStop(1, '#4e3e1e');
  g.fillStyle = gr;
  g.fillRect(cx - 0.3, cy - 0.3, 0.6, 0.6);
  for (let k = 0; k < 26; k++) {
    const a = rng.next() * TAU, l = 0.05 + rng.next() * 0.12;
    g.strokeStyle = rng.next() < 0.5 ? 'rgba(236,206,130,0.35)' : 'rgba(40,28,10,0.35)';
    g.lineWidth = 0.004 + rng.next() * 0.008;
    g.beginPath();
    g.moveTo(cx, cy);
    g.quadraticCurveTo(cx + Math.cos(a + 0.3) * l * 0.5, cy + Math.sin(a + 0.3) * l * 0.5 * 0.6, cx + Math.cos(a) * l, cy + Math.sin(a) * l * 0.6);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = 'rgba(232,214,160,0.55)';
  g.lineWidth = 0.006;
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.stroke();
}

function paintShell(g, res) {
  const rng = createRng(500);
  // tail + plastron (cream) under the shell
  g.fillStyle = '#8a8662';
  g.beginPath();
  g.moveTo(-0.46, 0.05);
  g.quadraticCurveTo(-0.56, 0.07, -0.6, 0.1);
  g.quadraticCurveTo(-0.52, 0.1, -0.44, 0.085);
  g.fill();
  const pl = g.createLinearGradient(0, 0.05, 0, 0.12);
  pl.addColorStop(0, '#efe0a8');
  pl.addColorStop(1, '#c8b67a');
  g.fillStyle = pl;
  g.beginPath();
  g.moveTo(-0.42, 0.07);
  g.quadraticCurveTo(0.0, 0.135, 0.42, 0.07);
  g.lineTo(0.42, 0.06);
  g.lineTo(-0.42, 0.06);
  g.closePath();
  g.fill();
  shellPath(g);
  g.fillStyle = '#5e4c26';
  g.fill();
  g.save();
  shellPath(g);
  g.clip();
  // vertebral row along the ridge, costal row on the flank, marginal row along the edge
  const top = (x) => DOME(x);
  for (let i = 0; i < 5; i++) {
    const x0 = -0.4 + i * 0.165, x1 = x0 + 0.165;
    const y0a = top(x0) - 0.01, y0b = top(x1) - 0.01;
    scute(g, rng, [x0, y0a, (x0 + x1) / 2, top((x0 + x1) / 2) - 0.02, x1, y0b, x1 - 0.01, y0b + 0.075, x0 + 0.01, y0a + 0.075], (x0 + x1) / 2, top((x0 + x1) / 2) + 0.03);
  }
  for (let i = 0; i < 4; i++) {
    const x0 = -0.44 + i * 0.215, x1 = x0 + 0.215;
    const ya = top(x0) + 0.065, yb = top(x1) + 0.065;
    scute(g, rng, [x0 + 0.01, ya, x1 - 0.01, yb, x1, 0.035, x0, 0.035], (x0 + x1) / 2, (ya + yb) / 2 + 0.02);
  }
  for (let i = 0; i < 12; i++) {
    const x0 = -0.52 + i * 0.085;
    scute(g, rng, [x0, 0.032, x0 + 0.085, 0.032, x0 + 0.08, 0.08, x0 + 0.005, 0.08], x0 + 0.042, 0.05);
  }
  // form shading: light from above, darker toward the flank
  const sh = g.createLinearGradient(0, -0.2, 0, 0.08);
  sh.addColorStop(0, 'rgba(255,250,210,0.22)');
  sh.addColorStop(0.5, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(20,14,0,0.35)');
  g.fillStyle = sh;
  g.fillRect(-0.6, -0.3, 1.2, 0.4);
  blurred(g, res, 0.015, () => {
    g.fillStyle = 'rgba(255,250,220,0.35)';
    g.beginPath();
    g.ellipse(-0.06, -0.16, 0.24, 0.03, -0.02, 0, TAU);
    g.fill();
  });
  g.restore();
}

function paintHead(g, res) {
  const rng = createRng(77);
  // neck (soft wrinkled skin tucked under the shell) then the rounded head with a short beak
  const ng = g.createLinearGradient(0, -0.06, 0, 0.08);
  ng.addColorStop(0, '#8a8660');
  ng.addColorStop(1, '#c9bd8a');
  g.fillStyle = ng;
  g.beginPath();
  g.moveTo(0.4, -0.035);
  g.bezierCurveTo(0.46, -0.07, 0.53, -0.06, 0.58, -0.05);
  g.lineTo(0.58, 0.06);
  g.bezierCurveTo(0.52, 0.075, 0.45, 0.08, 0.4, 0.07);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,56,30,0.3)';
  g.lineWidth = 0.004;
  for (let k = 0; k < 4; k++) {
    g.beginPath();
    g.moveTo(0.45 + k * 0.03, -0.05 + k * 0.004);
    g.quadraticCurveTo(0.44 + k * 0.03, 0.01, 0.455 + k * 0.03, 0.065);
    g.stroke();
  }
  const head = () => {
    g.beginPath();
    g.moveTo(0.5, -0.02);
    g.bezierCurveTo(0.52, -0.11, 0.66, -0.12, 0.74, -0.06);
    g.bezierCurveTo(0.79, -0.02, 0.79, 0.03, 0.76, 0.05);
    g.bezierCurveTo(0.7, 0.09, 0.56, 0.1, 0.5, 0.05);
    g.closePath();
  };
  head();
  const hg = g.createLinearGradient(0, -0.12, 0, 0.1);
  hg.addColorStop(0, '#8e8a5a');
  hg.addColorStop(0.6, '#6e6a44');
  hg.addColorStop(1, '#d8cc96');
  g.fillStyle = hg;
  g.fill();
  g.save();
  head();
  g.clip();
  // large head scales with pale borders (the single pair of prefrontals marks a green turtle)
  // scale mosaic: darker tiles separated by pale seams, on a staggered grid
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const cx = 0.52 + col * 0.038 + (row % 2) * 0.019 + (rng.next() - 0.5) * 0.006;
      const cy = -0.105 + row * 0.03 + (rng.next() - 0.5) * 0.006;
      const r = 0.017 + rng.next() * 0.004;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU + 0.5;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.75);
      }
      g.closePath();
      g.fillStyle = `rgba(70,66,36,${0.22 + rng.next() * 0.18})`;
      g.fill();
    }
  }
  g.restore();
  // beak line + nostril
  g.strokeStyle = 'rgba(40,36,20,0.7)';
  g.lineWidth = 0.005;
  g.beginPath();
  g.moveTo(0.775, 0.02);
  g.quadraticCurveTo(0.72, 0.035, 0.66, 0.03);
  g.stroke();
  g.fillStyle = '#2a2614';
  g.beginPath();
  g.ellipse(0.765, -0.03, 0.005, 0.003, 0, 0, TAU);
  g.fill();
  // gentle eye with a heavy upper lid
  const ex = 0.665, ey = -0.035;
  g.fillStyle = '#4a4628';
  g.beginPath();
  g.ellipse(ex, ey, 0.032, 0.024, -0.1, 0, TAU);
  g.fill();
  const eg = g.createRadialGradient(ex - 0.005, ey - 0.006, 0.002, ex, ey, 0.02);
  eg.addColorStop(0, '#6a5a3a');
  eg.addColorStop(0.5, '#2a2014');
  eg.addColorStop(1, '#0a0806');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(ex, ey, 0.019, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.ellipse(ex - 0.007, ey - 0.007, 0.006, 0.004, -0.5, 0, TAU);
  g.fill();
  // soft upper lid: a thin crescent, not a frown
  g.strokeStyle = '#8a865a';
  g.lineWidth = 0.008;
  g.beginPath();
  g.ellipse(ex, ey + 0.002, 0.026, 0.024, -0.1, Math.PI * 1.15, Math.PI * 1.9);
  g.stroke();
}

function paintFlipper(g, res, len0) {
  const rng = createRng(31 + len0 * 100);
  const L = len0;
  const path = () => {
    g.beginPath();
    g.moveTo(0, -0.045);
    g.bezierCurveTo(L * 0.3, -0.085, L * 0.75, -0.06, L, -0.004);
    g.bezierCurveTo(L * 0.7, 0.02, L * 0.3, 0.06, 0, 0.045);
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, -0.08, 0, 0.06);
  gr.addColorStop(0, '#9a9662');
  gr.addColorStop(0.5, '#6e6a42');
  gr.addColorStop(1, '#4c4a2e');
  g.fillStyle = gr;
  g.fill();
  g.save();
  path();
  g.clip();
  // scale mosaic: larger plates along the leading edge, small ones behind
  for (let row = 0; row < 3; row++) {
    const n = Math.round((L / 0.04) * (1 - row * 0.15));
    for (let col = 0; col < n; col++) {
      const u = (col + 0.5) / n;
      const cx = u * L * 0.95 + (row % 2) * 0.01, cy = -0.045 + row * 0.032 + u * 0.03 * (row - 1) * 0;
      const r = (0.016 - row * 0.003) * (1 - u * 0.6);
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * TAU;
        g.lineTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * (1 - u * 0.5));
      }
      g.closePath();
      g.fillStyle = `rgba(48,46,24,${0.2 + rng.next() * 0.16})`;
      g.fill();
    }
  }
  g.strokeStyle = 'rgba(220,210,150,0.4)';
  g.lineWidth = 0.004;
  path();
  g.stroke();
  g.restore();
  // single claw on the leading edge
  g.fillStyle = '#3a3420';
  g.beginPath();
  g.ellipse(L * 0.32, -0.068, 0.012, 0.006, -0.2, 0, TAU);
  g.fill();
}

export const DRAWERS = {
  sea_turtle: {
    bounds: { x0: -0.64, x1: 0.82, y0: -0.42, y1: 0.55 },
    mouth: { x: 0.77, y: 0.03 },
    draw(ctx, len, anim, opts) {
      const lenPx = len * (opts.pxScale || 1);
      const shell = variant(unitSprite('tu_shell', SHELL, lenPx, paintShell), opts);
      const head = variant(unitSprite('tu_head', HEAD, lenPx, paintHead), opts);
      const flip = variant(unitSprite('tu_flip', FLIP, lenPx, (g, r) => paintFlipper(g, r, 0.56)), opts);
      const rear = variant(unitSprite('tu_rear', REAR, lenPx, (g, r) => paintFlipper(g, r, 0.22)), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const h = easePose(anim, 0, hooked ? 1 : 0, 3);
      const ph = anim.phase * 0.55; // slow, flying stroke
      const s = Math.sin(ph), c = Math.cos(ph);
      const stroke = (0.6 + 0.25 * Math.min(1, anim.amp) + 0.3 * h);
      // downstroke while s > 0 (deep, powerful), shallow recovery upstroke that stays near the shell line
      const theta = Math.PI - 0.32 - stroke * (s > 0 ? 0.95 : 0.55) * s;
      const twist = 0.62 + 0.38 * Math.abs(c);
      const bob = -s * 0.012 * len;
      ctx.save();
      ctx.translate(0, bob);
      // far front flipper (darker, peeking above / below the shell)
      ctx.save();
      ctx.translate(0.24 * len, 0.0);
      ctx.rotate(theta - 0.12);
      ctx.scale(0.92, -twist * 0.9);
      ctx.globalAlpha *= 0.85;
      drawUnitSprite(ctx, flip, len);
      ctx.restore();
      // rear flippers steer
      for (const [x, y, a] of [[-0.4, 0.05, Math.PI - 0.35], [-0.38, 0.06, Math.PI - 0.1]]) {
        ctx.save();
        ctx.translate(x * len, y * len);
        ctx.rotate(a + Math.sin(ph + x) * 0.12 + h * Math.sin(anim.t * 6 + x) * 0.2);
        drawUnitSprite(ctx, rear, len);
        ctx.restore();
      }
      drawUnitSprite(ctx, shell, len);
      ctx.save();
      const nod = Math.sin(ph - 0.6) * 0.03 + h * Math.sin(anim.t * 4) * 0.05;
      ctx.translate(0.45 * len, 0);
      ctx.rotate(nod);
      ctx.translate(-0.45 * len, 0);
      drawUnitSprite(ctx, head, len);
      ctx.restore();
      // near front flipper
      ctx.translate(0.3 * len, 0.03 * len);
      ctx.rotate(theta);
      ctx.scale(1, -twist);
      drawUnitSprite(ctx, flip, len);
      ctx.restore();
    },
  },
};
