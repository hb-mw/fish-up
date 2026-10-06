// Jellyfish: moon jelly (Aurelia aurita) and lion's mane (Cyanea capillata).
// Local space: bell up (−Y), tentacles hanging (+Y); len = bell diameter. anim.phase = bell pulse
// (contraction peaks at sin(phase) = 1). The bell is a cached sprite scaled for the pulse; oral arms and the mane
// are cached sprites bent with sheared strips (a travelling wave with lag); the marginal fringe is live strokes.
import {
  TAU, clamp, createRng, unitSprite, palette, modeOf, glowK, variant, drawUnitSpriteScaled, hang,
  hangEdgeY, glowDot, glow, rnd, blurred, rgba,
} from './kit.js';

const OFFS = new Float32Array(48);

/** Bell contraction 0..1 from the pulse phase: smooth, brief peak at sin(phase)=1, long relaxed rest. */
const pulseOf = (phase, sharp) => Math.pow(0.5 + 0.5 * Math.sin(phase), sharp);

// ════════════════════════════════════════════════════════════════════════════
// MOON JELLY
// ════════════════════════════════════════════════════════════════════════════
const MJ_E = 0.16; // view elevation factor (margin ellipse ry / rx)
const MJ_M = 0.02; // margin plane y
const MJ_H = 0.31; // bell height (relaxed)
const MJ_BELL = { x0: -0.53, x1: 0.53, y0: -0.33, y1: 0.12 };
const MJ_ARMS = { x0: -0.2, x1: 0.2, y0: 0, y1: 0.6 };
const MJ_GONAD = ['#c6a8e6', '#e6aed0', '#aebdf0'];
const MJ_PAL = palette({
  tentFront: ['#eef8ff', 0.62],
  tentBack: ['#cfe6ff', 0.34],
  tentCore: ['#ffffff', 0.5],
  tentShade: ['#5a86b0', 0.22],
});

function moonBellOutline(g) {
  const w = 0.5, m = MJ_M, h = MJ_H, e = MJ_E;
  g.beginPath();
  g.moveTo(-w, m);
  g.bezierCurveTo(-w * 1.03, m - h * 0.46, -w * 0.64, m - h, 0, m - h);
  g.bezierCurveTo(w * 0.64, m - h, w * 1.03, m - h * 0.46, w, m);
  g.ellipse(0, m, w, w * e, 0, 0, Math.PI, false); // near lip (lower half of the margin ellipse)
  g.closePath();
}

function paintMoonBell(g, res, gonadHex, seed) {
  const w = 0.5, m = MJ_M, h = MJ_H, e = MJ_E;
  const rng = createRng(1234 + seed * 7);
  // body: clear, milky toward the rim (looking through more jelly at grazing angles)
  moonBellOutline(g);
  const body = g.createRadialGradient(0, -0.1, 0.02, 0, -0.04, 0.55);
  body.addColorStop(0, 'rgba(226,240,255,0.16)');
  body.addColorStop(0.55, 'rgba(206,226,252,0.22)');
  body.addColorStop(0.85, 'rgba(222,236,255,0.36)');
  body.addColorStop(1, 'rgba(240,248,255,0.55)');
  g.fillStyle = body;
  g.fill();
  g.save();
  moonBellOutline(g);
  g.clip();
  // subumbrella: the concave underside seen through the dome
  const sub = g.createRadialGradient(0, m - 0.02, 0.05, 0, m, 0.5);
  sub.addColorStop(0, 'rgba(190,214,250,0.05)');
  sub.addColorStop(0.7, 'rgba(176,204,246,0.16)');
  sub.addColorStop(1, 'rgba(210,230,255,0.28)');
  g.fillStyle = sub;
  g.beginPath();
  g.ellipse(0, m - 0.01, w * 0.97, h * 0.6, 0, Math.PI, TAU);
  g.ellipse(0, m, w * 0.97, w * e * 0.97, 0, 0, Math.PI);
  g.fill();
  // far lip seen through the jelly
  g.strokeStyle = 'rgba(232,244,255,0.32)';
  g.lineWidth = 0.008;
  g.beginPath();
  g.ellipse(0, m, w * 0.985, w * e * 0.985, 0, Math.PI, TAU);
  g.stroke();
  // radial canals: meridians over the dome (front bright, back faint) with a little branching
  const nMer = 24;
  for (let k = 0; k < nMer; k++) {
    const th = (k / nMer) * TAU + 0.07;
    const ct = Math.cos(th), st = Math.sin(th);
    const front = st > 0;
    g.strokeStyle = front ? 'rgba(255,255,255,0.34)' : 'rgba(225,238,255,0.16)';
    g.lineWidth = k % 3 === 0 ? 0.0065 : 0.0045;
    g.beginPath();
    for (let j = 0; j <= 14; j++) {
      const ph = (0.18 + (j / 14) * 0.82) * (Math.PI / 2);
      const rho = w * 0.985 * Math.sin(ph);
      const wob = 0.006 * Math.sin(j * 1.7 + k);
      const x = rho * ct + wob, y = m - h * 0.98 * Math.cos(ph) + rho * st * e;
      if (j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // gonads: four horseshoes ringed around the centre on the floor of the gastric pouches (drawn as if seen a
  // little more from above than the bell, so they read as rings rather than slivers)
  const gy = m - h * 0.42, gr0 = 0.2, ge = 0.42;
  const quads = [];
  for (let q = 0; q < 4; q++) {
    const th = 0.38 + (q * Math.PI) / 2;
    quads.push([th, Math.sin(th)]);
  }
  quads.sort((a, b) => a[1] - b[1]); // far ones first
  blurred(g, res, 0.0065, () => {
    for (const [th, st] of quads) {
      const ct = Math.cos(th);
      const near = (st + 1) * 0.5; // 0 far … 1 near
      const cx = gr0 * ct, cy = gy + gr0 * st * ge;
      const rx = 0.085 + 0.02 * near, ry = rx * ge * 1.05;
      const a = 0.3 + 0.36 * near;
      // milky gastric pouch, then the horseshoe band opening toward the centre
      g.fillStyle = `rgba(240,234,255,${0.08 + 0.1 * near})`;
      g.beginPath();
      g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
      g.fill();
      const open = Math.atan2((gy - cy) / ge, -cx);
      g.strokeStyle = rgba(gonadHex, a);
      g.lineWidth = 0.026 + 0.008 * near;
      g.beginPath();
      g.ellipse(cx, cy, rx * 0.7, ry * 0.7, 0, open + 0.9, open + TAU - 0.9);
      g.stroke();
      g.strokeStyle = `rgba(255,236,250,${0.2 + 0.35 * near})`;
      g.lineWidth = 0.008;
      g.beginPath();
      g.ellipse(cx, cy - ry * 0.15, rx * 0.7, ry * 0.62, 0, open + 1.1, open + TAU - 1.1);
      g.stroke();
    }
  });
  // central manubrium / mouth area
  g.fillStyle = 'rgba(236,230,255,0.18)';
  g.beginPath();
  g.ellipse(0, gy + 0.005, 0.05, 0.022, 0, 0, TAU);
  g.fill();
  // fresnel rim: milky glow just inside the silhouette
  blurred(g, res, 0.012, () => {
    moonBellOutline(g);
    g.strokeStyle = 'rgba(244,250,255,0.55)';
    g.lineWidth = 0.05;
    g.stroke();
  });
  // faint cellular texture
  for (let i = 0; i < 70; i++) {
    const a = rng.next() * Math.PI, r = Math.sqrt(rng.next()) * 0.46;
    g.fillStyle = `rgba(255,255,255,${0.04 + rng.next() * 0.06})`;
    g.beginPath();
    g.arc(Math.cos(a) * r, m - Math.sin(a) * r * 0.62, 0.004 + rng.next() * 0.008, 0, TAU);
    g.fill();
  }
  // specular: wet highlight across the upper-left dome + small hot spot
  blurred(g, res, 0.01, () => {
    g.fillStyle = 'rgba(255,255,255,0.42)';
    g.beginPath();
    g.ellipse(-0.17, m - h * 0.78, 0.17, 0.045, -0.32, 0, TAU);
    g.fill();
  });
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.beginPath();
  g.ellipse(-0.2, m - h * 0.8, 0.05, 0.013, -0.35, 0, TAU);
  g.fill();
  g.restore();
  // faint cool outer rim: keeps the bell readable on pale backgrounds, invisible on dark water
  moonBellOutline(g);
  g.strokeStyle = 'rgba(96,140,184,0.28)';
  g.lineWidth = 0.006;
  g.stroke();
  // crisp top edge + margin (ring canal) and the eight rhopalia
  g.strokeStyle = 'rgba(250,253,255,0.6)';
  g.lineWidth = 0.006;
  g.beginPath();
  g.moveTo(-w * 0.97, m - 0.04);
  g.bezierCurveTo(-w * 0.96, m - h * 0.5, -w * 0.62, m - h, 0, m - h);
  g.bezierCurveTo(w * 0.62, m - h, w * 0.96, m - h * 0.5, w * 0.97, m - 0.04);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.lineWidth = 0.009;
  g.beginPath();
  g.ellipse(0, m, w * 0.995, w * e, 0, 0.02, Math.PI - 0.02);
  g.stroke();
  g.fillStyle = 'rgba(255,250,235,0.9)';
  for (let k = 0; k < 8; k++) {
    const th = (k / 8) * TAU + Math.PI / 8;
    const st = Math.sin(th);
    if (st < -0.2) continue;
    g.beginPath();
    g.arc(w * Math.cos(th) * 0.99, m + w * e * st, 0.008, 0, TAU);
    g.fill();
  }
}

function paintMoonArms(g, res) {
  // four frilly oral arms hanging from the manubrium; back pair dimmer
  const arms = [
    [-0.02, -0.075, 0.5, 0.45, 1.3],
    [0.02, 0.085, 0.47, 0.45, 2.9],
    [-0.012, -0.02, 0.57, 1, 0.4],
    [0.014, 0.04, 0.53, 1, 4.1],
  ];
  const N = 160;
  const xs = new Float32Array(N + 1), ys = new Float32Array(N + 1), ws = new Float32Array(N + 1);
  for (const [x0, dx, L, a, k] of arms) {
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      xs[i] = x0 * (0.3 + u) + dx * Math.pow(u, 1.4) + 0.016 * Math.sin(u * 5 + k) * u;
      ys[i] = 0.005 + u * L;
      const root = Math.sin(Math.min(1, u * 7) * Math.PI * 0.5);
      const tip = Math.min(1, (1 - u) * 9);
      ws[i] = (0.046 * Math.pow(1 - u, 0.6) + 0.008) * root * tip * (1 + 0.3 * Math.sin(u * 34 + k * 3));
    }
    const ribbon = () => {
      g.beginPath();
      g.moveTo(xs[0] - ws[0], ys[0]);
      for (let i = 1; i <= N; i++) g.lineTo(xs[i] - ws[i], ys[i]);
      for (let i = N; i >= 0; i--) g.lineTo(xs[i] + ws[i] * 0.85, ys[i]);
      g.closePath();
    };
    ribbon();
    const fill = g.createLinearGradient(0, 0, 0, L);
    fill.addColorStop(0, `rgba(226,222,255,${0.42 * a})`);
    fill.addColorStop(0.6, `rgba(236,232,255,${0.3 * a})`);
    fill.addColorStop(1, `rgba(246,244,255,${0.14 * a})`);
    g.fillStyle = fill;
    g.fill();
    // frilled edges
    g.strokeStyle = `rgba(255,255,255,${0.5 * a})`;
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(xs[0] - ws[0], ys[0]);
    for (let i = 1; i <= N; i++) g.lineTo(xs[i] - ws[i], ys[i]);
    g.moveTo(xs[0] + ws[0] * 0.85, ys[0]);
    for (let i = 1; i <= N; i++) g.lineTo(xs[i] + ws[i] * 0.85, ys[i]);
    g.stroke();
    // groove
    g.strokeStyle = `rgba(200,190,240,${0.35 * a})`;
    g.lineWidth = 0.005;
    g.beginPath();
    g.moveTo(xs[0], ys[0]);
    for (let i = 1; i < N * 0.85; i++) g.lineTo(xs[i] + ws[i] * 0.1, ys[i]);
    g.stroke();
  }
}

function moonTentacles(ctx, len, anim, n, front, sx, sy, lw, style) {
  const e = MJ_E, m = MJ_M * len, L = 0.15 * len;
  const ph = anim.phase, t = anim.t;
  const cl = pulseOf(ph - 0.9, 2); // lagging contraction
  const flare = 0.62 * (1 - cl) + 0.12;
  const trail = clamp(anim.amp, 0, 1.5) * 0.22;
  ctx.strokeStyle = style;
  ctx.lineWidth = lw;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const th = ((i + 0.5) / n) * Math.PI * (front ? 1 : -1);
    const ct = Math.cos(th), st = Math.sin(th);
    let x = 0.5 * sx * ct * len * 0.99, y = m + 0.5 * e * st * len * sy;
    const Li = L * (0.75 + 0.5 * rnd(7, i + (front ? 0 : 100)));
    ctx.moveTo(x, y);
    let px = x, py = y;
    for (let k = 1; k <= 3; k++) {
      const a = ct * flare * (1.15 - k * 0.22) + (0.22 * Math.sin(t * 1.4 + i * 1.9 + k * 0.9) - trail) * (k / 3);
      const nx = px + Math.sin(a) * (Li / 3), ny = py + Math.cos(a) * (Li / 3);
      if (k < 3) ctx.quadraticCurveTo(px, py, (px + nx) * 0.5, (py + ny) * 0.5);
      else ctx.quadraticCurveTo(px, py, nx, ny);
      px = nx;
      py = ny;
    }
  }
  ctx.stroke();
}

function moonState(anim, len) {
  const c = pulseOf(anim.phase, 2);
  return { c, sx: 1 - 0.1 * c, sy: 1 + 0.17 * c };
}

const moonJelly = {
  bounds: { x0: -0.62, x1: 0.62, y0: -0.4, y1: 0.66 },
  mouth: { x: 0, y: 0.06 },
  draw(ctx, len, anim, opts) {
    const mode = modeOf(opts);
    const P = MJ_PAL[mode];
    const lenPx = len * (opts.pxScale || 1);
    const card = opts.detail === 'card';
    const gi = Math.min(2, (anim.seed * 3) | 0);
    const bell = variant(unitSprite('mj_bell' + gi, MJ_BELL, lenPx, (g, res) => paintMoonBell(g, res, MJ_GONAD[gi], gi)), opts, true);
    const arms = variant(unitSprite('mj_arms', MJ_ARMS, lenPx, paintMoonArms), opts, true);
    const c = pulseOf(anim.phase, 2);
    const sx = 1 - 0.1 * c, sy = 1 + 0.17 * c;
    const lw = Math.max(0.6 / (opts.pxScale || 1), len * 0.006);
    const nT = card ? 34 : lenPx > 90 ? 18 : 12;
    ctx.save();
    // back fringe
    moonTentacles(ctx, len, anim, nT, false, sx, sy, lw, P.tentBack);
    // oral arms: sway with a lag behind the pulse and drift
    const n = 8;
    const t = anim.t, ph = anim.phase;
    const trail = clamp(anim.amp, 0, 1.5) * 0.12 * len;
    for (let j = 0; j <= n; j++) {
      const u = (hangEdgeY(arms, 0.02, n, j) - 0.02) / 0.6;
      OFFS[j] = (0.05 * Math.sin(t * 0.9 + anim.seed * 6 - u * 2.6) + 0.025 * Math.sin(ph - 1.6 - u * 2)) * len * u - trail * u * u;
    }
    ctx.save();
    ctx.translate(0, MJ_M * len * (1 - sy) * 0.4);
    ctx.scale(1, 1 - 0.08 * pulseOf(ph - 1.2, 2));
    hang(ctx, arms, len, 0.02, n, OFFS, opts);
    ctx.restore();
    // bell (scaled about the margin plane)
    drawUnitSpriteScaled(ctx, bell, len, sx, sy, 0, MJ_M * len);
    // front fringe (cards get a faint cool under-stroke so the fringe also reads on pale backgrounds)
    if (card && mode === 0) moonTentacles(ctx, len, anim, nT, true, sx, sy, lw * 2.2, P.tentShade);
    moonTentacles(ctx, len, anim, nT, true, sx, sy, lw, P.tentFront);
    if (card && mode !== 2) moonTentacles(ctx, len, anim, nT, true, sx, sy, lw * 0.45, P.tentCore);
    ctx.restore();
  },
  drawGlow(ctx, len, anim, opts) {
    const k = glowK(opts);
    const c = pulseOf(anim.phase, 2);
    const sx = 1 - 0.1 * c, sy = 1 + 0.17 * c;
    const flick = 0.85 + 0.15 * Math.sin(anim.t * 2.3 + anim.seed * 9);
    const a0 = ctx.globalAlpha;
    ctx.globalAlpha = a0 * 0.3 * k * flick;
    glow(ctx, glowDot('#bfe9ff'), 0, -0.1 * len, 0.78 * len * sx, 0.55 * len * sy);
    // the bell itself lit from within (additive copy → luminous rim, canals and gonads)
    const lenPx = len * (opts.pxScale || 1);
    const gi = Math.min(2, (anim.seed * 3) | 0);
    const bell = unitSprite('mj_bell' + gi, MJ_BELL, lenPx, (g, res) => paintMoonBell(g, res, MJ_GONAD[gi], gi));
    ctx.globalAlpha = a0 * (0.25 + 0.2 * c) * k;
    drawUnitSpriteScaled(ctx, opts.shiny ? variant(bell, opts) : bell, len, sx, sy, 0, MJ_M * len);
    // rhopalia twinkle
    const dot = glowDot('#dff6ff', 0.9);
    for (let i = 0; i < 4; i++) {
      const th = (i / 4) * Math.PI + 0.35;
      const tw = Math.max(0, Math.sin(anim.t * 1.7 + i * 2.1 + anim.seed * 5));
      ctx.globalAlpha = a0 * 0.5 * k * tw * tw;
      glow(ctx, dot, 0.5 * sx * Math.cos(th) * len, MJ_M * len + 0.5 * MJ_E * Math.sin(th) * len * sy, len * 0.05);
    }
    ctx.globalAlpha = a0;
  },
};

// ════════════════════════════════════════════════════════════════════════════
// LION'S MANE
// ════════════════════════════════════════════════════════════════════════════
const LM_E = 0.2;
const LM_M = 0.03;
const LM_H = 0.27;
const LM_BELL = { x0: -0.54, x1: 0.54, y0: -0.29, y1: 0.16 };
const LM_ARMS = { x0: -0.36, x1: 0.36, y0: 0, y1: 0.95 };
const LM_MANE = { x0: -0.62, x1: 0.62, y0: 0, y1: 1.95 };

function lmOutline(g) {
  const w = 0.5, m = LM_M, h = LM_H, e = LM_E;
  g.beginPath();
  g.moveTo(-w, m);
  g.bezierCurveTo(-w * 1.04, m - h * 0.42, -w * 0.66, m - h, 0, m - h);
  g.bezierCurveTo(w * 0.66, m - h, w * 1.04, m - h * 0.42, w, m);
  // scalloped near margin: 8 lobes around, ~5 on the near half
  const nL = 16;
  for (let i = 0; i <= nL; i++) {
    const th = (i / nL) * Math.PI;
    const x = w * Math.cos(th), y = m + w * e * Math.sin(th);
    const lobe = i % 2 === 1 ? 0.035 : -0.005;
    if (i === 0) g.lineTo(x, y);
    else {
      const thm = ((i - 0.5) / nL) * Math.PI;
      g.quadraticCurveTo(w * Math.cos(thm) * 1.01, m + w * e * Math.sin(thm) + lobe * 1.8, x, y);
    }
  }
  g.closePath();
}

function paintLionBell(g, res) {
  const w = 0.5, m = LM_M, h = LM_H, e = LM_E;
  const rng = createRng(77);
  lmOutline(g);
  const body = g.createRadialGradient(0, m - h * 0.9, 0.02, 0, m - 0.05, 0.6);
  body.addColorStop(0, 'rgba(120,28,22,0.96)');
  body.addColorStop(0.3, 'rgba(168,48,26,0.92)');
  body.addColorStop(0.62, 'rgba(214,104,44,0.82)');
  body.addColorStop(0.86, 'rgba(236,160,84,0.7)');
  body.addColorStop(1, 'rgba(246,196,120,0.62)');
  g.fillStyle = body;
  g.fill();
  g.save();
  lmOutline(g);
  g.clip();
  // radial streaks (the 16 dark rays of Cyanea) as meridians
  for (let k = 0; k < 32; k++) {
    const th = (k / 32) * TAU + 0.05;
    const ct = Math.cos(th), st = Math.sin(th);
    if (st < -0.1) continue;
    g.strokeStyle = k % 2 ? 'rgba(110,22,14,0.32)' : 'rgba(255,214,150,0.18)';
    g.lineWidth = k % 2 ? 0.016 : 0.008;
    g.beginPath();
    for (let j = 0; j <= 12; j++) {
      const ph = (0.12 + (j / 12) * 0.88) * (Math.PI / 2);
      const rho = w * Math.sin(ph);
      const x = rho * ct, y = m - h * Math.cos(ph) + rho * st * e;
      if (j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // mottling
  for (let i = 0; i < 90; i++) {
    const a = rng.next() * Math.PI, r = Math.sqrt(rng.next()) * 0.5;
    g.fillStyle = rng.next() < 0.5 ? `rgba(255,200,140,${0.05 + rng.next() * 0.08})` : `rgba(110,20,16,${0.05 + rng.next() * 0.08})`;
    g.beginPath();
    g.ellipse(Math.cos(a) * r, m - Math.sin(a) * r * 0.55, 0.01 + rng.next() * 0.02, 0.006 + rng.next() * 0.01, 0, 0, TAU);
    g.fill();
  }
  // central dark crown
  blurred(g, res, 0.02, () => {
    g.fillStyle = 'rgba(90,16,14,0.45)';
    g.beginPath();
    g.ellipse(0, m - h * 0.86, 0.17, 0.06, 0, 0, TAU);
    g.fill();
  });
  // translucent rim (thin bell edge is lighter)
  blurred(g, res, 0.012, () => {
    lmOutline(g);
    g.strokeStyle = 'rgba(255,214,150,0.42)';
    g.lineWidth = 0.045;
    g.stroke();
  });
  // wet specular sheen
  blurred(g, res, 0.012, () => {
    g.fillStyle = 'rgba(255,236,210,0.4)';
    g.beginPath();
    g.ellipse(-0.16, m - h * 0.78, 0.18, 0.04, -0.28, 0, TAU);
    g.fill();
  });
  g.fillStyle = 'rgba(255,248,236,0.6)';
  g.beginPath();
  g.ellipse(-0.2, m - h * 0.8, 0.055, 0.012, -0.3, 0, TAU);
  g.fill();
  g.restore();
  // margin lobes highlight
  g.strokeStyle = 'rgba(255,224,170,0.55)';
  g.lineWidth = 0.007;
  g.beginPath();
  g.ellipse(0, m, w * 0.99, w * e * 0.98, 0, 0.05, Math.PI - 0.05);
  g.stroke();
}

function paintLionArms(g, res) {
  // massive curtain-like oral arms: many folded ruffled ribbons, crimson to orange
  const rng = createRng(4242);
  const folds = 8;
  const N = 140;
  const lx = new Float32Array(N + 1), rx = new Float32Array(N + 1), cx = new Float32Array(N + 1), ys = new Float32Array(N + 1);
  for (let f = 0; f < folds; f++) {
    const back = f % 2 === 0;
    const x0 = (((f * 3) % folds) / (folds - 1) - 0.5) * 0.3;
    const L = 0.62 + rng.next() * 0.3;
    const sw = 0.055 + rng.next() * 0.035;
    const ph = rng.next() * 6;
    const drift = (rng.next() - 0.5) * 0.12;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const root = Math.sin(Math.min(1, u * 5) * Math.PI * 0.5);
      const tip = Math.pow(Math.max(0, 1 - u), 0.55);
      const w = sw * (0.55 + 0.6 * u) * root * tip;
      const c = x0 * (1 + u * 0.7) + drift * u * u + 0.03 * Math.sin(u * 6 + ph);
      cx[i] = c;
      ys[i] = 0.02 + u * L;
      // soft ruffles: two gentle frequencies, never sharper than the sampling
      lx[i] = c - w * (1 + 0.28 * Math.sin(u * 26 + ph) + 0.12 * Math.sin(u * 47 + ph * 2));
      rx[i] = c + w * (1 + 0.28 * Math.sin(u * 23 + ph * 1.7) + 0.12 * Math.sin(u * 41 + ph));
    }
    g.beginPath();
    g.moveTo(lx[0], ys[0]);
    for (let i = 1; i <= N; i++) g.lineTo(lx[i], ys[i]);
    for (let i = N; i >= 0; i--) g.lineTo(rx[i], ys[i]);
    g.closePath();
    const a = back ? 0.5 : 0.78;
    const gr = g.createLinearGradient(0, 0, 0, L + 0.02);
    gr.addColorStop(0, `rgba(140,30,28,${a})`);
    gr.addColorStop(0.35, `rgba(190,58,36,${a * 0.92})`);
    gr.addColorStop(0.75, `rgba(228,116,62,${a * 0.62})`);
    gr.addColorStop(1, `rgba(246,172,110,${a * 0.25})`);
    g.fillStyle = gr;
    g.fill();
    // volume: darker fold valley down the middle, bright frilled edges
    g.save();
    g.clip();
    blurred(g, res, 0.008, () => {
      g.strokeStyle = `rgba(96,16,18,${back ? 0.3 : 0.4})`;
      g.lineWidth = 0.025;
      g.beginPath();
      g.moveTo(cx[0], ys[0]);
      for (let i = 1; i <= N; i++) g.lineTo(cx[i] + 0.01 * Math.sin(i * 0.2 + ph), ys[i]);
      g.stroke();
    });
    g.restore();
    g.strokeStyle = `rgba(255,200,150,${back ? 0.22 : 0.45})`;
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(lx[0], ys[0]);
    for (let i = 1; i <= N; i++) g.lineTo(lx[i], ys[i]);
    g.moveTo(rx[0], ys[0]);
    for (let i = 1; i <= N; i++) g.lineTo(rx[i], ys[i]);
    g.stroke();
  }
}

function paintLionMane(g, res, front) {
  // hundreds of hair-fine tentacles in eight clusters under the bell
  const rng = createRng(front ? 991 : 517);
  const n = front ? 110 : 190;
  const lw = 1 / res;
  for (let i = 0; i < n; i++) {
    const cluster = (rng.next() * 8) | 0;
    const cx = ((cluster + 0.5) / 8 - 0.5) * 0.8 + (rng.next() - 0.5) * 0.08;
    const L = (0.9 + rng.next() * 1.0) * (front ? 0.95 : 1);
    const a = front ? 0.16 + rng.next() * 0.3 : 0.1 + rng.next() * 0.22;
    const warm = rng.next();
    const col = warm < 0.45 ? [255, 196, 140] : warm < 0.8 ? [250, 160, 110] : [255, 226, 190];
    g.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
    g.lineWidth = lw * (0.7 + rng.next() * 0.9);
    const p1 = rng.next() * 6, f1 = 2 + rng.next() * 3;
    const spread = (rng.next() - 0.5) * 0.35;
    g.beginPath();
    for (let j = 0; j <= 24; j++) {
      const u = j / 24;
      const x = cx * (1 - 0.35 * u) + spread * u * u + 0.025 * Math.sin(u * f1 * 3 + p1) * u;
      const y = 0.03 + u * L;
      if (j === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // a few thicker, brighter strands for depth
  if (front) {
    for (let i = 0; i < 14; i++) {
      const cx = (rng.next() - 0.5) * 0.7;
      const L = 1.1 + rng.next() * 0.8;
      g.strokeStyle = `rgba(255,214,170,${0.28 + rng.next() * 0.2})`;
      g.lineWidth = lw * 1.8;
      const p1 = rng.next() * 6;
      g.beginPath();
      for (let j = 0; j <= 24; j++) {
        const u = j / 24;
        const x = cx * (1 - 0.3 * u) + 0.03 * Math.sin(u * 8 + p1) * u;
        if (j === 0) g.moveTo(x, 0.03);
        else g.lineTo(x, 0.03 + u * L);
      }
      g.stroke();
    }
  }
}

function lionManeOffsets(spr, len, anim, n, from, span, lagK, ampK, phaseK) {
  const t = anim.t, ph = anim.phase;
  const trail = (0.1 + clamp(anim.amp, 0, 1.5) * 0.3) * len;
  for (let j = 0; j <= n; j++) {
    const u = clamp((hangEdgeY(spr, from, n, j) - from) / span, 0, 1.2);
    const wave = Math.sin(t * 0.55 * phaseK + anim.seed * 6 - u * 3.2 * lagK) * 0.09 + Math.sin(t * 0.31 + 1.3 - u * 1.7) * 0.05;
    const pulse = Math.sin(ph - 1.4 - u * 2.4) * 0.025;
    OFFS[j] = (wave + pulse) * len * ampK * Math.pow(u, 1.2) - trail * Math.pow(u, 1.6);
  }
}

const lionsMane = {
  bounds: { x0: -0.95, x1: 0.62, y0: -0.34, y1: 1.98 },
  mouth: { x: 0, y: 0.08 },
  draw(ctx, len, anim, opts) {
    const lenPx = len * (opts.pxScale || 1);
    const bell = variant(unitSprite('lm_bell', LM_BELL, lenPx, paintLionBell), opts, true);
    const arms = variant(unitSprite('lm_arms', LM_ARMS, lenPx, paintLionArms), opts, true);
    const maneB = variant(unitSprite('lm_maneB', LM_MANE, lenPx, (g, r) => paintLionMane(g, r, false)), opts, true);
    const maneF = variant(unitSprite('lm_maneF', LM_MANE, lenPx, (g, r) => paintLionMane(g, r, true)), opts, true);
    const c = pulseOf(anim.phase, 2.5);
    const sx = 1 - 0.06 * c, sy = 1 + 0.11 * c;
    const n = opts.detail === 'card' ? 22 : 14;
    ctx.save();
    lionManeOffsets(maneB, len, anim, n, 0.03, 1.9, 1, 1, 0.9);
    hang(ctx, maneB, len, 0.03, n, OFFS, opts);
    lionManeOffsets(arms, len, anim, 10, 0.02, 0.9, 0.7, 0.6, 0.7);
    hang(ctx, arms, len, 0.02, 10, OFFS, opts);
    lionManeOffsets(maneF, len, anim, n, 0.03, 1.9, 1.15, 1.1, 1.1);
    hang(ctx, maneF, len, 0.03, n, OFFS, opts);
    drawUnitSpriteScaled(ctx, bell, len, sx, sy, 0, LM_M * len);
    ctx.restore();
  },
};

export const DRAWERS = {
  moon_jelly: moonJelly,
  lions_mane: lionsMane,
};
