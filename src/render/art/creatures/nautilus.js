// Chambered nautilus (Nautilus pompilius) — side view facing +X, len = shell diameter.
// Cached sprite: the logarithmic-spiral shell (cream with brown tiger flames, dark umbilical callus), leathery hood,
// pinhole eye and siphon. Live: the brush of ~90 cirri (drawn as a few dozen strokes) and the bobbing.
import { TAU, clamp, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, blurred, rnd } from './kit.js';

const BOX = { x0: -0.6, x1: 0.46, y0: -0.47, y1: 0.48 };
const SX = 0.0, SY = -0.04; // spiral centre (umbilicus)
const R0 = 0.56, B = 0.11, PH0 = 1.45, KX = 1.12, KY = 0.92;
const rOf = (ph) => R0 * Math.exp(-B * (ph - PH0));
const px = (ph, k = 1) => SX + rOf(ph) * k * Math.cos(ph) * KX;
const py = (ph, k = 1) => SY + rOf(ph) * k * Math.sin(ph) * KY;
const PH_END = PH0 + TAU * 0.86;

const PAL = palette({
  near: '#f0d4b8',
  nearDark: '#c79a7c',
  far: '#a87a62',
  sheath: '#b86a42',
});

function shellPath(g) {
  g.beginPath();
  g.moveTo(px(PH0), py(PH0));
  for (let i = 1; i <= 90; i++) {
    const ph = PH0 + ((PH_END - PH0) * i) / 90;
    g.lineTo(px(ph), py(ph));
  }
  // aperture rim back down to the outer lip
  g.quadraticCurveTo(SX + 0.3, SY + 0.32, px(PH0), py(PH0));
  g.closePath();
}

function paintShell(g, res) {
  const rng = createRng(2024);
  shellPath(g);
  const sh = g.createRadialGradient(SX - 0.16, SY - 0.2, 0.04, SX, SY, 0.62);
  sh.addColorStop(0, '#fffaf0');
  sh.addColorStop(0.45, '#f2e2c8');
  sh.addColorStop(0.8, '#d9bf9c');
  sh.addColorStop(1, '#a88866');
  g.fillStyle = sh;
  g.fill();
  g.save();
  shellPath(g);
  g.clip();
  // tiger flames: sinuous bands radiating from the umbilicus over the older (rear/upper) part of the whorl
  const n = 15;
  for (let k = 0; k < n; k++) {
    const ph = PH0 + 1.15 + (k / (n - 1)) * (PH_END - PH0 - 1.3) + (rng.next() - 0.5) * 0.08;
    const fade = clamp((ph - PH0 - 1.1) / 0.9, 0, 1);
    const w = (0.17 + rng.next() * 0.1) * (0.6 + 0.4 * fade);
    const wob = rng.next() * 6;
    blurred(g, res, 0.005, () => {
      g.fillStyle = `rgba(176,82,38,${0.78 * fade})`;
      g.beginPath();
      for (let j = 0; j <= 16; j++) {
        const u = 0.32 + (j / 16) * 0.72;
        const a = ph - w * (1 - u * 0.5) * 0.5 + 0.06 * Math.sin(u * 9 + wob) - u * 0.35;
        const x = SX + rOf(a) * u * Math.cos(a) * KX, y = SY + rOf(a) * u * Math.sin(a) * KY;
        if (j === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      for (let j = 16; j >= 0; j--) {
        const u = 0.32 + (j / 16) * 0.72;
        const a = ph + w * (1 - u * 0.5) * 0.5 + 0.06 * Math.sin(u * 9 + wob + 1) - u * 0.35;
        g.lineTo(SX + rOf(a) * u * Math.cos(a) * KX, SY + rOf(a) * u * Math.sin(a) * KY);
      }
      g.closePath();
      g.fill();
    });
    // darker core line
    g.strokeStyle = `rgba(110,44,18,${0.5 * fade})`;
    g.lineWidth = 0.008;
    g.beginPath();
    for (let j = 0; j <= 12; j++) {
      const u = 0.36 + (j / 12) * 0.62;
      const a = ph + 0.06 * Math.sin(u * 9 + wob + 0.5) - u * 0.35;
      const x = SX + rOf(a) * u * Math.cos(a) * KX, y = SY + rOf(a) * u * Math.sin(a) * KY;
      if (j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // fine growth lines
  g.strokeStyle = 'rgba(120,80,50,0.12)';
  g.lineWidth = 0.003;
  for (let k = 0; k < 60; k++) {
    const ph = PH0 + (k / 60) * (PH_END - PH0);
    g.beginPath();
    g.moveTo(px(ph, 0.4), py(ph, 0.4));
    g.quadraticCurveTo(px(ph - 0.15, 0.75), py(ph - 0.15, 0.75), px(ph - 0.3, 0.99), py(ph - 0.3, 0.99));
    g.stroke();
  }
  // rim shading + glossy highlight
  blurred(g, res, 0.03, () => {
    shellPath(g);
    g.strokeStyle = 'rgba(90,56,30,0.35)';
    g.lineWidth = 0.07;
    g.stroke();
  });
  blurred(g, res, 0.02, () => {
    g.fillStyle = 'rgba(255,255,250,0.55)';
    g.beginPath();
    g.ellipse(SX - 0.22, SY - 0.24, 0.17, 0.06, -0.7, 0, TAU);
    g.fill();
  });
  // umbilical callus: dark, glossy
  const um = g.createRadialGradient(SX - 0.006, SY - 0.008, 0.002, SX, SY, 0.05);
  um.addColorStop(0, '#3a2010');
  um.addColorStop(0.55, 'rgba(90,46,22,0.75)');
  um.addColorStop(1, 'rgba(120,70,40,0)');
  g.fillStyle = um;
  g.beginPath();
  g.arc(SX, SY, 0.05, 0, TAU);
  g.fill();
  g.restore();
  // body in the aperture: pale skin, siphon, hood, eye
  g.fillStyle = '#e2bfa0';
  g.beginPath();
  g.moveTo(0.16, 0.06);
  g.quadraticCurveTo(0.34, 0.12, 0.33, 0.32);
  g.quadraticCurveTo(0.25, 0.42, 0.05, 0.4);
  g.quadraticCurveTo(0.08, 0.2, 0.16, 0.06);
  g.fill();
  g.fillStyle = '#c99476';
  g.beginPath();
  g.ellipse(0.17, 0.39, 0.075, 0.03, 0.25, 0, TAU);
  g.fill();
  const hood = () => {
    g.beginPath();
    g.moveTo(0.12, -0.12);
    g.bezierCurveTo(0.24, -0.15, 0.37, -0.06, 0.38, 0.06);
    g.bezierCurveTo(0.38, 0.13, 0.33, 0.17, 0.27, 0.16);
    g.bezierCurveTo(0.2, 0.15, 0.12, 0.1, 0.1, 0.02);
    g.closePath();
  };
  hood();
  const hg = g.createLinearGradient(0.1, -0.13, 0.32, 0.17);
  hg.addColorStop(0, '#c77a46');
  hg.addColorStop(0.5, '#a3552e');
  hg.addColorStop(1, '#6e3218');
  g.fillStyle = hg;
  g.fill();
  g.save();
  hood();
  g.clip();
  for (let i = 0; i < 26; i++) {
    g.fillStyle = `rgba(250,232,206,${0.35 + rng.next() * 0.35})`;
    g.beginPath();
    g.ellipse(0.1 + rng.next() * 0.28, -0.12 + rng.next() * 0.28, 0.008 + rng.next() * 0.02, 0.006 + rng.next() * 0.012, rng.next() * 3, 0, TAU);
    g.fill();
  }
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(60,24,10,${0.15 + rng.next() * 0.2})`;
    g.beginPath();
    g.arc(0.1 + rng.next() * 0.28, -0.12 + rng.next() * 0.28, 0.002 + rng.next() * 0.004, 0, TAU);
    g.fill();
  }
  blurred(g, res, 0.01, () => {
    g.fillStyle = 'rgba(255,220,180,0.35)';
    g.beginPath();
    g.ellipse(0.24, -0.08, 0.1, 0.025, 0.4, 0, TAU);
    g.fill();
  });
  g.restore();
  // pinhole eye on a short stalk, below the hood
  g.fillStyle = '#b07a5a';
  g.beginPath();
  g.ellipse(0.215, 0.2, 0.05, 0.042, 0, 0, TAU);
  g.fill();
  const eg = g.createRadialGradient(0.21, 0.192, 0.004, 0.215, 0.2, 0.036);
  eg.addColorStop(0, '#6a6460');
  eg.addColorStop(0.7, '#2c2826');
  eg.addColorStop(1, '#141210');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(0.215, 0.2, 0.034, 0, TAU);
  g.fill();
  g.fillStyle = '#000';
  g.beginPath();
  g.arc(0.218, 0.2, 0.007, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(0.203, 0.188, 0.01, 0.006, -0.5, 0, TAU);
  g.fill();
}

function tentacles(ctx, len, anim, n, far, style, lw) {
  const t = anim.t;
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const r1 = rnd(far ? 17 : 5, i), r2 = rnd(far ? 29 : 11, i);
    const bx = (0.26 + r1 * 0.08) * len, by = (0.2 + r2 * 0.16) * len;
    const L = (0.26 + rnd(3, i + (far ? 50 : 0)) * 0.2) * len;
    const a0 = -0.35 + r2 * 0.75 + (far ? -0.1 : 0);
    const w1 = Math.sin(t * 1.3 + i * 1.7) * 0.18, w2 = Math.sin(t * 1.7 + i * 2.3 + 1) * 0.35;
    const a1 = a0 + w1, a2 = a0 + w1 + w2 + (r1 - 0.5) * 0.7, a3 = a2 + 0.5 * Math.sin(t * 2.1 + i) + (r2 - 0.5);
    const mx = bx + Math.cos(a1) * L * 0.4, my = by + Math.sin(a1) * L * 0.4;
    const qx = mx + Math.cos(a2) * L * 0.35, qy = my + Math.sin(a2) * L * 0.35;
    ctx.moveTo(bx, by);
    ctx.bezierCurveTo(mx, my, qx, qy, qx + Math.cos(a3) * L * 0.25, qy + Math.sin(a3) * L * 0.25);
  }
  ctx.stroke();
}

export const DRAWERS = {
  nautilus: {
    bounds: { x0: -0.62, x1: 0.86, y0: -0.5, y1: 0.52 },
    mouth: { x: 0.44, y: 0.25 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const card = opts.detail === 'card';
      const shell = variant(unitSprite('nau_shell', BOX, lenPx, paintShell), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const bob = Math.sin(anim.phase * 0.5) * 0.025 * len;
      const rock = Math.sin(anim.phase * 0.5 - 0.8) * 0.05 + (hooked ? Math.sin(anim.t * 3) * 0.08 : 0);
      const lw = Math.max(0.7 / (opts.pxScale || 1), len * 0.0075);
      ctx.save();
      ctx.translate(0, bob);
      ctx.rotate(rock);
      ctx.lineCap = 'round';
      tentacles(ctx, len, anim, card ? 26 : 12, true, P.far, lw * 0.9);
      drawUnitSprite(ctx, shell, len);
      tentacles(ctx, len, anim, card ? 34 : 16, false, P.near, lw);
      // sheaths at the base of the near cirri
      ctx.strokeStyle = P.sheath;
      ctx.lineWidth = lw * 1.9;
      ctx.beginPath();
      for (let i = 0; i < 7; i++) {
        const bx = (0.27 + rnd(41, i) * 0.06) * len, by = (0.21 + rnd(43, i) * 0.13) * len;
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 0.05 * len, by + (rnd(47, i) - 0.4) * 0.03 * len);
      }
      ctx.stroke();
      ctx.restore();
    },
  },
};
