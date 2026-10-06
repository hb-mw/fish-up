// Sloane's viperfish (Chauliodus sloani): slender dark iridescent body with a hexagon scale net, fangs so long
// they sit outside the shut mouth, a whip-like first dorsal ray carrying a lure, rows of belly photophores.
import { unitSprite, paintEye } from '../common.js';
import { TAU, look, easeState, makeProfile, shape, soft, softStroke, clipTo, band, lod, spline, variantOf, swimBlit, blitAbout, pxsOf, hookedness, liveColor, glowDot, clamp } from './kit.js';
import { rayFin, fishSkin, photophore, paintGlowDots } from './deep-kit.js';

const GLOW = '#8affc1';
const BOX = { x0: -0.53, x1: 0.53, y0: -0.12, y1: 0.12 };
const SWIM = { swing: 0.05, waves: 1.1, power: 1.6, rigid: 0.3, squash: 0.3, strips: 18 };
const P = makeProfile(
  [[0.5, -0.012], [0.489, -0.045], [0.462, -0.07], [0.42, -0.082], [0.36, -0.08], [0.25, -0.07], [0.1, -0.06], [-0.05, -0.05], [-0.2, -0.038], [-0.32, -0.026], [-0.39, -0.02], [-0.41, -0.018]],
  [[0.5, -0.012], [0.494, 0.022], [0.47, 0.05], [0.43, 0.066], [0.37, 0.07], [0.25, 0.064], [0.1, 0.056], [-0.05, 0.046], [-0.2, 0.034], [-0.32, 0.024], [-0.39, 0.018], [-0.41, 0.016]],
);
const H = [0.36, 0.022];
const MOUTH = [[0.36, 0.022], [0.4, 0.019], [0.44, 0.014], [0.475, 0.008], [0.497, 0.004]];
const JAW_BOX = { x0: 0.32, x1: 0.53, y0: -0.125, y1: 0.09 };
const FANG_BOX = { x0: 0.38, x1: 0.53, y0: -0.03, y1: 0.1 };
const FIN = { mem: 'rgba(40,60,70,0.55)', memEdge: 'rgba(90,130,140,0.25)', ray: 'rgba(150,190,200,0.5)', edge: 'rgba(170,220,230,0.2)' };
const FINS = {
  caudal: { pts: [[-0.39, -0.02, 1], [-0.44, -0.04], [-0.5, -0.07, 1], [-0.465, -0.02], [-0.452, 0, 1], [-0.465, 0.02], [-0.5, 0.07, 1], [-0.44, 0.04], [-0.39, 0.018, 1]], base: [[-0.39, -0.02], [-0.39, 0.018]], tips: [[-0.51, -0.075], [-0.51, 0.075]], rays: 12 },
  dorsal: { pts: [[0.335, -0.068, 1], [0.322, -0.105], [0.3, -0.112], [0.27, -0.09], [0.255, -0.066, 1]], base: [[0.335, -0.066], [0.255, -0.064]], tips: [[0.32, -0.12], [0.24, -0.08]], rays: 7 },
  adipose: { pts: [[-0.27, -0.03, 1], [-0.29, -0.052], [-0.31, -0.052], [-0.322, -0.028, 1]], base: [[-0.27, -0.03], [-0.32, -0.027]], tips: [[-0.28, -0.06], [-0.33, -0.05]], rays: 1 },
  anal: { pts: [[-0.29, 0.026, 1], [-0.31, 0.06], [-0.345, 0.062], [-0.37, 0.022, 1]], base: [[-0.29, 0.026], [-0.37, 0.02]], tips: [[-0.3, 0.07], [-0.38, 0.05]], rays: 8 },
  pelvic: { pts: [[0.08, 0.056, 1], [0.05, 0.09], [0.02, 0.098, 1], [0.035, 0.07], [0.045, 0.054, 1]], base: [[0.08, 0.055], [0.045, 0.053]], tips: [[0.05, 0.1], [0.015, 0.1]], rays: 7 },
  pec: { pts: [[0.335, 0.04, 1], [0.3, 0.065], [0.26, 0.078, 1], [0.29, 0.05], [0.32, 0.034, 1]], base: [[0.335, 0.04], [0.32, 0.034]], tips: [[0.25, 0.085], [0.26, 0.06]], rays: 8 },
};
const PHOTO = (() => {
  const L = [];
  for (let x = 0.34; x > -0.37; x -= 0.024) L.push([x, P.at(x, 0.9), 0.0058]);
  for (let x = 0.3; x > -0.22; x -= 0.034) L.push([x, P.at(x, 0.72), 0.005]);
  return L;
})();
const POSTORB = [0.405, 0.008, 0.009];

function fang(g, x0, y0, x1, y1, bend, w) {
  const mx = (x0 + x1) / 2 + bend * (y1 - y0), my = (y0 + y1) / 2 - bend * (x1 - x0);
  const gr = g.createLinearGradient(x0, y0, x1, y1);
  gr.addColorStop(0, 'rgba(210,200,180,0.95)');
  gr.addColorStop(0.6, 'rgba(242,238,226,0.95)');
  gr.addColorStop(1, 'rgba(255,255,255,0.85)');
  g.fillStyle = gr;
  g.beginPath();
  const nx = -(y1 - y0), ny = x1 - x0, nl = Math.hypot(nx, ny) || 1;
  const ox = (nx / nl) * w * 0.5, oy = (ny / nl) * w * 0.5;
  g.moveTo(x0 + ox, y0 + oy);
  g.quadraticCurveTo(mx + ox * 0.5, my + oy * 0.5, x1, y1);
  g.quadraticCurveTo(mx - ox * 0.5, my - oy * 0.5, x0 - ox, y0 - oy);
  g.closePath();
  g.fill();
}

function jawRegion(q) {
  spline(q, MOUTH.slice().reverse(), true);
  q.lineTo(H[0] - 0.004, H[1]);
  q.lineTo(0.35, P.bot(0.35) + 0.01);
  for (let i = 0; i <= 12; i++) {
    const x = 0.35 + (0.5 - 0.35) * (i / 12);
    q.lineTo(x, P.bot(x) + 0.01);
  }
  q.closePath();
}

function skin(g, res) {
  fishSkin(g, res, P, { back: '#0d1218', flank: 'rgba(36,52,62,0.95)', belly: '#3a4650', iris: 'rgba(70,170,170,0.3)', bellyShade: 'rgba(0,0,0,0.4)' },
    { cf: 0.5, soft: 0.04, box: BOX, mottle: 0.1, sheen: 0.7 });
  // iridescence: violet over the upper flank, teal-green below it, a pewter sheen on the belly
  soft(g, res, 0.02, 'rgba(120,96,210,0.22)', (q) => band(q, P, 0.42, -0.4, 0.18, 0.42));
  soft(g, res, 0.02, 'rgba(60,180,160,0.2)', (q) => band(q, P, 0.42, -0.4, 0.42, 0.68));
  soft(g, res, 0.02, 'rgba(170,190,200,0.28)', (q) => band(q, P, 0.42, -0.4, 0.74, 1.05));
  // hexagon scale net: dark mesh with silvery centres (big renders)
  if (lod(res) >= 1) {
    const s = 0.016;
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = s * 0.12;
    g.beginPath();
    for (let row = 0, y = -0.08; y < 0.08; y += s * 0.86, row++) {
      for (let x = -0.42 + (row % 2) * s * 0.5; x < 0.36; x += s) {
        for (let k = 0; k < 6; k++) {
          const a = (k / 6) * TAU + Math.PI / 6, b = ((k + 1) / 6) * TAU + Math.PI / 6;
          if (k === 0) g.moveTo(x + Math.cos(a) * s * 0.55, y + Math.sin(a) * s * 0.55);
          g.lineTo(x + Math.cos(b) * s * 0.55, y + Math.sin(b) * s * 0.55);
        }
      }
    }
    g.stroke();
    soft(g, res, 0.02, 'rgba(150,220,215,0.16)', (q) => band(q, P, 0.33, -0.36, 0.25, 0.55));
  }
}

function paintBody(g, res) {
  const L = lod(res);
  rayFin(g, res, FINS.caudal, FIN);
  rayFin(g, res, FINS.anal, FIN);
  rayFin(g, res, FINS.adipose, FIN);
  rayFin(g, res, FINS.dorsal, FIN);
  clipTo(g, (q) => P.outline(q), () => {
    skin(g, res);
    softStroke(g, res, 0.003, 'rgba(150,200,210,0.3)', 0.003, (q) => { q.moveTo(0.345, -0.06); q.quadraticCurveTo(0.33, 0, 0.345, 0.055); });
    for (const [x, y, r] of PHOTO) {
      if (L >= 2) photophore(g, x, y, r, '#9dffd0');
      else soft(g, res, r * 0.5, 'rgba(170,255,215,0.9)', (q) => q.arc(x, y, r, 0, TAU));
    }
    photophore(g, POSTORB[0], POSTORB[1], POSTORB[2], '#b6ffe0');
    softStroke(g, res, 0.0015, 'rgba(0,0,0,0.6)', 0.003, (q) => spline(q, MOUTH.map((p) => [p[0], p[1] - 0.0015]), true));
  });
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  jawRegion(g);
  g.fill();
  g.restore();
  rayFin(g, res, FINS.pelvic, FIN);
  rayFin(g, res, FINS.pec, FIN);
  // big reflective deep-sea eye
  paintEye(g, 0.432, -0.032, 0.026, { iris: '#2f5a62', irisDark: '#081418', pupil: 0.72, sclera: null, ring: 'rgba(0,0,0,0.85)', look: { x: 0.3, y: 0 } });
  soft(g, res, 0.006, 'rgba(140,255,220,0.25)', (q) => q.arc(0.434, -0.03, 0.014, 0, TAU));
}

function paintJaw(g, res) {
  clipTo(g, (q) => { jawRegion(q); }, () => {
    clipTo(g, (q) => P.outline(q), () => skin(g, res));
    softStroke(g, res, 0.0015, 'rgba(0,0,0,0.7)', 0.003, (q) => spline(q, MOUTH, true));
  });
  // the lower jaw's front fangs rise outside the shut mouth, past the eye
  fang(g, 0.489, 0.006, 0.444, -0.102, -0.2, 0.0095);
  fang(g, 0.475, 0.009, 0.45, -0.066, -0.14, 0.007);
  for (let i = 0; i < 5; i++) fang(g, 0.462 - i * 0.02, 0.012 + i * 0.0015, 0.459 - i * 0.02, -0.002 + i * 0.002, 0, 0.003);
}

function paintFangs(g) {
  // upper fangs hang down outside the lower jaw
  fang(g, 0.494, -0.002, 0.484, 0.085, 0.16, 0.0085);
  fang(g, 0.47, 0.006, 0.461, 0.058, 0.1, 0.006);
  for (let i = 0; i < 4; i++) fang(g, 0.448 - i * 0.022, 0.012 + i * 0.002, 0.446 - i * 0.022, 0.03 + i * 0.002, 0, 0.0028);
}

const lenPxOf = (len, opts) => Math.min(Math.max(len * (opts.pxScale || 1), 40), opts.detail === 'card' ? 2400 : 900);
const filament = (len, t, hk, out) => {
  // first dorsal ray: a whip that arches back over the body; the lure dangles and sways
  const sway = Math.sin(t * 1.6) * 0.012 + hk * Math.sin(t * 9) * 0.02;
  out[0] = 0.33 * len; out[1] = -0.068 * len;
  out[2] = 0.3 * len; out[3] = -0.19 * len;
  out[4] = (0.16 + sway) * len; out[5] = (-0.165 + Math.cos(t * 1.3) * 0.008) * len;
  return out;
};
const F6 = new Float32Array(6);

export const viperfish = {
  bounds: { x0: -0.52, x1: 0.52, y0: -0.2, y1: 0.13 },
  mouth: { x: 0.47, y: 0.02 },
  draw(ctx, len, anim, opts) {
    const lp = lenPxOf(len, opts), t = anim.t || 0;
    const hkT = hookedness(anim);
    let openT = Math.max(anim.mouth || 0, 0.06 + 0.06 * Math.sin(t * 0.9 + (anim.seed || 0) * 9));
    if (hkT >= 1) openT = Math.max(openT, 0.6 + 0.35 * Math.sin(t * 7 + (anim.uid || 0)));
    const E = easeState(anim, 'viper', hkT, clamp(openT, 0, 1));
    const hk = E.hk, open = E.open;
    const body = unitSprite('viper:body', BOX, lp, paintBody);
    const jaw = unitSprite('viper:jaw', JAW_BOX, lp, paintJaw);
    const fangs = unitSprite('viper:fangs', FANG_BOX, lp, paintFangs);
    const ang = open * 0.95;
    if (ang > 0.01) {
      // gaping interior
      const c = Math.cos(ang), s = Math.sin(ang);
      ctx.beginPath();
      ctx.moveTo((H[0] - 0.01) * len, H[1] * len);
      for (const p of MOUTH) ctx.lineTo(p[0] * len, (p[1] - 0.003) * len);
      for (let i = MOUTH.length - 1; i >= 0; i--) {
        const dx = (MOUTH[i][0] - H[0]) * len, dy = (MOUTH[i][1] - H[1] + 0.004) * len;
        ctx.lineTo(H[0] * len + dx * c - dy * s, H[1] * len + dx * s + dy * c);
      }
      ctx.closePath();
      ctx.fillStyle = liveColor(opts, '#120609', '#4a2c0c');
      ctx.fill();
    }
    swimBlit(ctx, look(body, opts), len, anim.phase || 0, clamp((anim.amp || 0.5) + hk * 0.5, 0, 1.6), SWIM, pxsOf(anim, opts));
    blitAbout(ctx, look(jaw, opts), len, H[0], H[1], ang);
    blitAbout(ctx, look(fangs, opts), len, H[0], H[1], 0);
    const f = filament(len, t, hk, F6);
    ctx.strokeStyle = liveColor(opts, 'rgba(160,200,205,0.7)', 'rgba(240,200,110,0.8)');
    ctx.lineWidth = Math.max(0.6, len * 0.004);
    ctx.beginPath();
    ctx.moveTo(f[0], f[1]);
    ctx.quadraticCurveTo(f[2], f[3], f[4], f[5]);
    ctx.stroke();
    ctx.fillStyle = liveColor(opts, '#bfffe0', '#ffe9a0');
    ctx.beginPath();
    ctx.arc(f[4], f[5], Math.max(1, len * 0.007), 0, TAU);
    ctx.fill();
  },
  drawGlow(ctx, len, anim, opts) {
    const lp = lenPxOf(len, opts), t = anim.t || 0;
    const hk = easeState(anim, 'viper', hookedness(anim), 0).hk;
    const spr = unitSprite('viper:glow', BOX, lp, (g, res) => paintGlowDots(g, res, PHOTO.concat([POSTORB]), GLOW, 3.4));
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * clamp(0.7 + 0.2 * Math.sin(t * 1.7 + (anim.seed || 0) * 13), 0, 1);
    swimBlit(ctx, spr, len, anim.phase || 0, clamp((anim.amp || 0.5) + hk * 0.5, 0, 1.6), SWIM, pxsOf(anim, opts));
    const f = filament(len, t, hk, F6);
    const r = len * (0.045 + 0.012 * Math.sin(t * 3.1 + (anim.seed || 0) * 5));
    ctx.globalAlpha = a * 0.95;
    ctx.drawImage(glowDot(GLOW), f[4] - r, f[5] - r, r * 2, r * 2);
    ctx.globalAlpha = a;
  },
};
