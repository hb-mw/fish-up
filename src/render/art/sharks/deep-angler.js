// Deep-sea anglerfish: globose velvet-black body, a huge upturned mouth of needle teeth, a tiny eye, and the
// illicium carrying a bacterial lure that bobs in front of the face — and lights it (additive pass).
import { unitSprite, paintEye } from '../common.js';
import { TAU, look, easeState, shape, soft, softStroke, clipTo, texture, lod, spline, rngFor, variantOf, swimBlit, blitAbout, pxsOf, hookedness, liveColor, glowDot, haloDot, clamp } from './kit.js';
import { rayFin } from './deep-kit.js';

const GLOW = '#9ffcff';
const BOX = { x0: -0.52, x1: 0.53, y0: -0.33, y1: 0.27 };
const SWIM = { swing: 0.06, waves: 0.7, power: 1.5, rigid: -0.12, squash: 0.3, strips: 10 };
const BODY = [
  [0.5, -0.074, 1], [0.46, -0.09], [0.42, -0.12], [0.35, -0.2], [0.22, -0.27], [0.06, -0.295], [-0.1, -0.265], [-0.21, -0.18], [-0.27, -0.1],
  [-0.31, -0.05, 1], [-0.31, 0.04, 1], [-0.25, 0.12], [-0.12, 0.215], [0.04, 0.245], [0.2, 0.22], [0.33, 0.15], [0.43, 0.06], [0.485, -0.02],
];
const H = [0.13, 0.035];
const MOUTH = [[0.13, 0.035], [0.22, 0.008], [0.31, -0.026], [0.4, -0.055], [0.47, -0.07], [0.5, -0.074]];
const JAW = [[0.13, 0.035, 1], [0.22, 0.008], [0.31, -0.026], [0.4, -0.055], [0.47, -0.07], [0.5, -0.074, 1], [0.485, -0.02], [0.43, 0.06], [0.33, 0.15], [0.2, 0.22], [0.11, 0.24, 1]];
// the jaw sprite reaches a little past the cut (mouth line raised, throat pushed back) so no seam shows when shut
const JAW_GROW = JAW.map((p, i) => (i <= 5 ? [p[0] + (i === 5 ? 0.004 : 0), p[1] - 0.007, p[2]] : i === JAW.length - 1 ? [p[0] - 0.008, p[1], p[2]] : p));
const JAW_BOX = { x0: 0.06, x1: 0.56, y0: -0.16, y1: 0.27 };
const TEETH_BOX = { x0: 0.08, x1: 0.56, y0: -0.12, y1: 0.12 };
const ESCA = [0.6, -0.27];
const FIN = { mem: 'rgba(40,30,38,0.75)', memEdge: 'rgba(70,58,66,0.4)', ray: 'rgba(120,100,110,0.45)' };
const FINS = {
  caudal: { pts: [[-0.29, -0.05, 1], [-0.38, -0.11], [-0.47, -0.15], [-0.51, -0.08], [-0.52, 0], [-0.51, 0.08], [-0.47, 0.15], [-0.38, 0.11], [-0.29, 0.04, 1]], base: [[-0.29, -0.05], [-0.29, 0.04]], tips: [[-0.5, -0.17], [-0.5, 0.17]], rays: 9 },
  dorsal: { pts: [[-0.12, -0.255, 1], [-0.16, -0.3], [-0.21, -0.28], [-0.22, -0.2, 1]], base: [[-0.12, -0.25], [-0.21, -0.19]], tips: [[-0.15, -0.32], [-0.24, -0.27]], rays: 4 },
  anal: { pts: [[-0.12, 0.2, 1], [-0.17, 0.25], [-0.22, 0.22], [-0.23, 0.14, 1]], base: [[-0.12, 0.2], [-0.22, 0.13]], tips: [[-0.15, 0.27], [-0.25, 0.2]], rays: 4 },
  pec: { pts: [[0.03, 0.02, 1], [-0.02, -0.02], [-0.07, -0.01], [-0.09, 0.04], [-0.07, 0.09], [-0.02, 0.1], [0.03, 0.06, 1]], base: [[0.03, 0.02], [0.03, 0.06]], tips: [[-0.09, -0.03], [-0.09, 0.11]], rays: 9 },
};
const PEC_BOX = { x0: -0.12, x1: 0.06, y0: -0.05, y1: 0.13 };

function needles(g, pts, up, n, size, key) {
  const r = rngFor(key);
  for (let i = 0; i < n; i++) {
    const u = 0.08 + (i / (n - 1)) * 0.9;
    const k = u * (pts.length - 1), j = Math.min(pts.length - 2, Math.floor(k)), f = k - j;
    const x = pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, y = pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f;
    const L = size * (0.45 + 0.55 * Math.sin(u * Math.PI)) * (0.7 + r.next() * 0.6);
    const dir = up ? -1 : 1, lean = -0.35 - r.next() * 0.3;
    const tx = x + lean * L * 0.6, ty = y + dir * L;
    const gr = g.createLinearGradient(x, y, tx, ty);
    gr.addColorStop(0, 'rgba(200,190,175,0.9)');
    gr.addColorStop(1, 'rgba(250,250,245,0.75)');
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(x - L * 0.06, y);
    g.quadraticCurveTo(x + (tx - x) * 0.4, y + (ty - y) * 0.6, tx, ty);
    g.quadraticCurveTo(x + (tx - x) * 0.6, y + (ty - y) * 0.4, x + L * 0.06, y);
    g.closePath();
    g.fill();
  }
}

function skin(g, res, v) {
  const L = lod(res);
  g.fillStyle = '#2a2027';
  g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
  // the round body: a dim top light and a deep shadowed underside, warm brown in the velvet
  soft(g, res, 0.08, 'rgba(92,70,80,0.55)', (q) => q.ellipse(0.06, -0.17, 0.28, 0.1, -0.05, 0, TAU));
  soft(g, res, 0.08, 'rgba(8,4,8,0.6)', (q) => q.ellipse(0.02, 0.22, 0.34, 0.1, 0, 0, TAU));
  soft(g, res, 0.05, 'rgba(70,45,58,0.35)', (q) => q.ellipse(-0.05, 0.02, 0.2, 0.12, 0, 0, TAU));
  const r = rngFor('angler' + v);
  for (let i = 0; i < 18; i++) {
    const x = -0.25 + r.next() * 0.6, y = -0.24 + r.next() * 0.42, rr = 0.012 + r.next() * 0.03;
    soft(g, res, rr * 0.8, `rgba(${r.next() < 0.5 ? '18,10,16' : '70,52,62'},0.3)`, (q) => q.ellipse(x, y, rr, rr * 0.8, 0, 0, TAU));
  }
  texture(g, 'mottle', 0.25, 0.22, BOX);
  texture(g, 'grain', 0.04, L >= 2 ? 0.3 : 0.18, BOX, 'soft-light');
  // tiny skin spinules catching light (big renders)
  if (L >= 2) {
    g.fillStyle = 'rgba(150,130,140,0.35)';
    for (let i = 0; i < 60; i++) {
      const x = -0.28 + r.next() * 0.7, y = -0.27 + r.next() * 0.48;
      g.beginPath();
      g.arc(x, y, 0.0018, 0, TAU);
      g.fill();
    }
  }
  softStroke(g, res, 0.012, 'rgba(110,150,160,0.22)', 0.01, (q) => spline(q, [[0.42, -0.12], [0.3, -0.24], [0.1, -0.29], [-0.1, -0.26]], true));
}

function paintBody(g, res, v) {
  rayFin(g, res, FINS.caudal, FIN, { bend: 0.05 });
  rayFin(g, res, FINS.dorsal, FIN);
  rayFin(g, res, FINS.anal, FIN);
  clipTo(g, (q) => shape(q, BODY), () => {
    skin(g, res, v);
    // gill opening behind the pectoral, a pale-lipped mouth crease
    softStroke(g, res, 0.006, 'rgba(0,0,0,0.5)', 0.006, (q) => { q.moveTo(0.06, -0.01); q.quadraticCurveTo(0.03, 0.06, 0.05, 0.12); });
    softStroke(g, res, 0.003, 'rgba(10,4,8,0.8)', 0.008, (q) => spline(q, MOUTH, true));
    softStroke(g, res, 0.004, 'rgba(0,0,0,0.5)', 0.02, (q) => shape(q, BODY));
  });
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  shape(g, JAW);
  g.fill();
  g.restore();
  // illicium base: a little knob on the forehead
  soft(g, res, 0.006, '#3a2c35', (q) => q.ellipse(0.345, -0.205, 0.018, 0.012, -0.5, 0, TAU));
  paintEye(g, 0.3, -0.125, 0.012, { iris: '#55606a', irisDark: '#101418', pupil: 0.6, sclera: null, ring: 'rgba(0,0,0,0.8)' });
}

function paintJaw(g, res, v) {
  clipTo(g, (q) => shape(q, JAW_GROW), () => {
    skin(g, res, v);
    soft(g, res, 0.02, 'rgba(0,0,0,0.45)', (q) => q.ellipse(0.32, 0.12, 0.2, 0.08, -0.4, 0, TAU));
    softStroke(g, res, 0.003, 'rgba(10,4,8,0.8)', 0.008, (q) => spline(q, MOUTH, true));
  });
  needles(g, MOUTH, true, 11, 0.065, 'alt');
}

const lenPxOf = (len, opts) => Math.min(Math.max(len * (opts.pxScale || 1), 40), opts.detail === 'card' ? 2400 : 1000);
const lure = (len, t, hk, seed, out) => {
  // springy bob, a little lag behind the head
  out[0] = (ESCA[0] + Math.sin(t * 1.15 + seed * 7) * 0.016 + hk * Math.sin(t * 8.1) * 0.03) * len;
  out[1] = (ESCA[1] + Math.sin(t * 1.9 + seed * 3) * 0.022 + hk * Math.cos(t * 7.3) * 0.03) * len;
  return out;
};
const L2 = new Float32Array(2);

export const anglerfish = {
  bounds: { x0: -0.52, x1: 0.65, y0: -0.4, y1: 0.27 },
  mouth: { x: 0.46, y: -0.05 },
  iconBounds: { x0: -0.53, x1: 0.645, y0: -0.365, y1: 0.265 }, // the lure's resting bob (no hooked thrash)
  draw(ctx, len, anim, opts) {
    const lp = lenPxOf(len, opts), t = anim.t || 0, v = variantOf(anim.seed, 2);
    const hkT = hookedness(anim);
    let openT = Math.max(anim.mouth || 0, 0.05 + 0.05 * Math.sin(t * 0.6 + (anim.seed || 0) * 9));
    if (hkT >= 1) openT = Math.max(openT, 0.55 + 0.35 * Math.sin(t * 6.2 + (anim.uid || 0)));
    const E = easeState(anim, 'angler', hkT, clamp(openT, 0, 1));
    const hk = E.hk, open = E.open;
    const body = unitSprite('angler:body' + v, BOX, lp, (g, res) => paintBody(g, res, v));
    const jaw = unitSprite('angler:jaw' + v, JAW_BOX, lp, (g, res) => paintJaw(g, res, v));
    const teeth = unitSprite('angler:teeth', TEETH_BOX, lp, (g) => needles(g, MOUTH, false, 13, 0.07, 'aut'));
    const pec = unitSprite('angler:pec', PEC_BOX, lp, (g, res) => rayFin(g, res, FINS.pec, FIN, { bend: -0.08 }));
    const ang = open * 0.65;
    ctx.save();
    if (hk) ctx.rotate(Math.sin(t * 8.7) * 0.06 * hk);
    if (ang > 0.01) {
      const c = Math.cos(ang), s = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo((H[0] - 0.02) * len, H[1] * len);
      for (const p of MOUTH) ctx.lineTo(p[0] * len, (p[1] - 0.006) * len);
      for (let i = MOUTH.length - 1; i >= 0; i--) {
        const dx = (MOUTH[i][0] - H[0]) * len, dy = (MOUTH[i][1] - H[1] + 0.006) * len;
        ctx.lineTo(H[0] * len + dx * c - dy * s, H[1] * len + dx * s + dy * c);
      }
      ctx.closePath();
      ctx.fillStyle = liveColor(opts, '#070305', '#4a2c0c');
      ctx.fill();
    }
    swimBlit(ctx, look(body, opts), len, anim.phase || 0, clamp((anim.amp || 0.4) + hk * 0.6, 0, 1.6), SWIM, pxsOf(anim, opts));
    blitAbout(ctx, look(jaw, opts), len, H[0], H[1], ang);
    blitAbout(ctx, look(teeth, opts), len, H[0], H[1], 0);
    blitAbout(ctx, look(pec, opts), len, 0.03, 0.04, Math.sin(t * 3.1 + (anim.seed || 0) * 5) * 0.25 + hk * Math.sin(t * 11) * 0.3);
    // the illicium: a slender rod from the forehead knob to the bobbing esca
    const e = lure(len, t, hk, anim.seed || 0, L2);
    ctx.strokeStyle = liveColor(opts, '#4a3a44', '#c9973a');
    ctx.lineWidth = Math.max(0.8, len * 0.009);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0.345 * len, -0.205 * len);
    ctx.quadraticCurveTo(0.42 * len, -0.42 * len, e[0], e[1] - 0.02 * len);
    ctx.stroke();
    // the esca: a pale translucent bulb with frilly filaments
    ctx.fillStyle = liveColor(opts, '#b9d6d6', '#f2d27a');
    ctx.beginPath();
    ctx.ellipse(e[0], e[1], 0.021 * len, 0.025 * len, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = liveColor(opts, 'rgba(180,220,220,0.6)', 'rgba(240,210,120,0.6)');
    ctx.lineWidth = Math.max(0.5, len * 0.003);
    ctx.beginPath();
    for (let i = -1; i <= 1; i++) {
      ctx.moveTo(e[0] + i * 0.008 * len, e[1] + 0.022 * len);
      ctx.quadraticCurveTo(e[0] + i * 0.02 * len, e[1] + 0.05 * len, e[0] + i * 0.012 * len + Math.sin(t * 2 + i) * 0.006 * len, e[1] + 0.07 * len);
    }
    ctx.stroke();
    ctx.restore();
  },
  drawGlow(ctx, len, anim, opts) {
    const lp = lenPxOf(len, opts), t = anim.t || 0;
    const hk = easeState(anim, 'angler', hookedness(anim), 0).hk;
    const e = lure(len, t, hk, anim.seed || 0, L2);
    const flick = clamp(0.82 + 0.12 * Math.sin(t * 3.7 + (anim.seed || 0) * 11) + 0.06 * Math.sin(t * 17.3), 0, 1);
    const a = ctx.globalAlpha;
    ctx.save();
    if (hk) ctx.rotate(Math.sin(t * 8.7) * 0.06 * hk);
    // light spilling onto the face, teeth and lip — a pre-lit sprite of the head
    const face = unitSprite('angler:facelight', BOX, lp, paintFaceLight);
    ctx.globalAlpha = a * flick * 0.85;
    blitAbout(ctx, face, len, 0, 0, 0);
    ctx.globalAlpha = a * flick;
    const R = len * 0.34;
    ctx.drawImage(haloDot(GLOW), e[0] - R, e[1] - R, R * 2, R * 2);
    const r = len * (0.07 + 0.01 * Math.sin(t * 5.3));
    ctx.drawImage(glowDot(GLOW, 0.22), e[0] - r, e[1] - r, r * 2, r * 2);
    ctx.globalAlpha = a;
    ctx.restore();
  },
};

function paintFaceLight(g, res) {
  // what the lure's light touches: the brow and snout, the upper lip, the needle teeth, the eye's wet glint
  const gr = g.createRadialGradient(ESCA[0], ESCA[1], 0.02, ESCA[0], ESCA[1], 0.62);
  gr.addColorStop(0, 'rgba(170,252,255,0.85)');
  gr.addColorStop(0.3, 'rgba(120,228,240,0.42)');
  gr.addColorStop(0.6, 'rgba(80,190,215,0.14)');
  gr.addColorStop(1, 'rgba(60,160,190,0)');
  clipTo(g, (q) => shape(q, BODY), () => {
    g.fillStyle = gr;
    g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
    softStroke(g, res, 0.006, 'rgba(170,250,255,0.5)', 0.01, (q) => spline(q, [[0.5, -0.074], [0.45, -0.1], [0.39, -0.16], [0.3, -0.23]], true));
  });
  g.save();
  g.globalAlpha = 0.55;
  needles(g, MOUTH, false, 13, 0.07, 'aut');
  needles(g, MOUTH, true, 11, 0.065, 'alt');
  g.restore();
  soft(g, res, 0.004, 'rgba(200,255,255,0.8)', (q) => q.arc(0.304, -0.13, 0.005, 0, TAU));
}
