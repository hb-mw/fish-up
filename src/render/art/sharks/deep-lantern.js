// Lanternfish (Myctophum punctatum): tiny silver-blue fish with a huge eye and rows of photophores along the
// belly and flank. Body sprite + a photophore glow sprite that rides the same swim wave.
import { unitSprite, paintEye } from '../common.js';
import { TAU, look, easeState, makeProfile, shape, soft, softStroke, clipTo, lod, variantOf, swimBlit, blitAbout, pxsOf, hookedness, haloDot, clamp } from './kit.js';
import { rayFin, fishSkin, photophore, paintGlowDots } from './deep-kit.js';

const GLOW = '#7fd8ff';
const BOX = { x0: -0.535, x1: 0.52, y0: -0.235, y1: 0.2 };
const SWIM = { swing: 0.06, waves: 1.0, power: 1.6, rigid: 0.24, squash: 0.35, strips: 12, stripPx: 14 };
const P = makeProfile(
  [[0.5, 0], [0.49, -0.035], [0.46, -0.07], [0.4, -0.1], [0.3, -0.12], [0.18, -0.125], [0.05, -0.115], [-0.08, -0.09], [-0.18, -0.06], [-0.25, -0.04], [-0.31, -0.033]],
  [[0.5, 0], [0.495, 0.03], [0.47, 0.06], [0.4, 0.09], [0.3, 0.11], [0.18, 0.118], [0.05, 0.11], [-0.08, 0.085], [-0.18, 0.055], [-0.25, 0.036], [-0.31, 0.03]],
);
const FIN = { mem: 'rgba(120,145,195,0.42)', memEdge: 'rgba(190,210,245,0.18)', ray: 'rgba(205,222,252,0.55)', edge: 'rgba(230,240,255,0.25)' };
const FINS = {
  caudal: {
    pts: [[-0.29, -0.03, 1], [-0.35, -0.06], [-0.42, -0.1], [-0.5, -0.14, 1], [-0.46, -0.07], [-0.42, -0.012], [-0.412, 0, 1], [-0.42, 0.012], [-0.46, 0.07], [-0.5, 0.14, 1], [-0.42, 0.1], [-0.35, 0.06], [-0.29, 0.03, 1]],
    base: [[-0.29, -0.03], [-0.29, 0.03]], tips: [[-0.52, -0.15], [-0.52, 0.15]], rays: 14,
  },
  dorsal: { pts: [[0.1, -0.112, 1], [0.08, -0.17], [0.05, -0.2, 1], [0, -0.18], [-0.06, -0.14], [-0.1, -0.09, 1]], base: [[0.1, -0.11], [-0.1, -0.088]], tips: [[0.06, -0.215], [-0.12, -0.12]], rays: 12 },
  anal: { pts: [[-0.04, 0.088, 1], [-0.06, 0.14], [-0.1, 0.152], [-0.18, 0.115], [-0.245, 0.068, 1]], base: [[-0.04, 0.084], [-0.245, 0.055]], tips: [[-0.07, 0.165], [-0.255, 0.09]], rays: 14 },
  pelvic: { pts: [[0.08, 0.108, 1], [0.05, 0.15], [0.02, 0.162, 1], [0.03, 0.124], [0.04, 0.104, 1]], base: [[0.08, 0.105], [0.04, 0.1]], tips: [[0.03, 0.17], [0.0, 0.16]], rays: 6 },
  pec: { pts: [[0.225, 0.035, 1], [0.17, 0.065], [0.11, 0.088, 1], [0.15, 0.052], [0.205, 0.022, 1]], base: [[0.225, 0.035], [0.205, 0.022]], tips: [[0.1, 0.095], [0.1, 0.07]], rays: 7 },
};
// photophores (unit space): the belly rows (PO, VO, AO), the oblique flank groups (PVO, VLO, SAO, Pol) and the tail (Prc)
const PHOTO = (() => {
  const L = [];
  const row = (x0, x1, n, f, df = 0) => { for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / Math.max(1, n - 1); L.push([x, P.at(x, f + df * i), 0.0105]); } };
  row(0.29, 0.1, 5, 0.9);
  row(0.24, 0.2, 2, 0.7, -0.09);
  row(0.04, -0.09, 4, 0.9);
  row(-0.02, -0.02, 1, 0.56);
  row(-0.1, -0.15, 3, 0.76, -0.14);
  row(-0.12, -0.24, 6, 0.88);
  row(-0.255, -0.29, 3, 0.84);
  row(-0.265, -0.265, 1, 0.48);
  L.push([-0.31, 0.022, 0.009], [-0.325, 0.026, 0.009]);
  L.push([0.43, -0.06, 0.008], [0.41, 0.045, 0.008]); // Dn + Vn by the eye
  return L;
})();

function paintBody(g, res, v) {
  const L = lod(res);
  rayFin(g, res, FINS.caudal, FIN);
  rayFin(g, res, FINS.dorsal, FIN);
  rayFin(g, res, FINS.anal, FIN);
  // adipose fin: a small fleshy flap, no rays
  soft(g, res, 0.003, 'rgba(70,90,130,0.8)', (q) => shape(q, [[-0.205, -0.043, 1], [-0.222, -0.07], [-0.243, -0.076], [-0.26, -0.062], [-0.256, -0.04, 1]]));
  clipTo(g, (q) => P.outline(q), () => {
    fishSkin(g, res, P, { back: '#0f1628', flank: 'rgba(72,90,134,0.9)', belly: '#b4c2d6', iris: 'rgba(150,130,255,0.2)', scaleLight: 'rgba(225,235,255,0.09)', scaleDark: 'rgba(5,10,30,0.06)' },
      { cf: 0.38, soft: 0.035, scale: 0.06, box: BOX, lateral: 0.34, sheen: 0.8 });
    // silver mirror flank (the guanine sheen that hides a lanternfish from below)
    soft(g, res, 0.03, 'rgba(225,235,255,0.22)', (q) => q.ellipse(0.05, 0.035, 0.24, 0.035, 0.02, 0, TAU));
    // gill cover edge + the big oblique mouth
    softStroke(g, res, 0.004, 'rgba(10,18,40,0.45)', 0.006, (q) => { q.moveTo(0.27, -0.08); q.quadraticCurveTo(0.235, 0.0, 0.25, 0.1); });
    softStroke(g, res, 0.004, 'rgba(235,242,255,0.35)', 0.004, (q) => { q.moveTo(0.258, -0.078); q.quadraticCurveTo(0.224, 0.0, 0.238, 0.1); });
    softStroke(g, res, 0.003, 'rgba(8,10,20,0.7)', 0.007, (q) => { q.moveTo(0.495, 0.018); q.quadraticCurveTo(0.42, 0.05, 0.31, 0.065); });
    // photophores: pearly buttons with dark cups (big renders), bright specks otherwise
    for (const [x, y, r] of PHOTO) {
      if (L >= 2) photophore(g, x, y, r * 0.72, '#9fe6ff');
      else soft(g, res, r * 0.4, 'rgba(200,240,255,0.95)', (q) => q.arc(x, y, r * 0.9, 0, TAU));
    }
    if (v === 1) soft(g, res, 0.006, 'rgba(210,240,255,0.8)', (q) => q.ellipse(-0.285, -0.03, 0.02, 0.008, 0.1, 0, TAU)); // male supracaudal gland
  });
  rayFin(g, res, FINS.pelvic, FIN);
  rayFin(g, res, FINS.pec, FIN);
  // the huge eye: silver-blue iris ring, black pupil, a wet glint
  soft(g, res, 0.01, 'rgba(5,10,25,0.5)', (q) => q.arc(0.358, -0.02, 0.06, 0, TAU));
  paintEye(g, 0.36, -0.022, 0.05, { iris: '#7d93b8', irisDark: '#1a2438', pupil: 0.72, sclera: null, ring: 'rgba(5,8,18,0.85)', look: { x: 0.25, y: 0 }, glint: false });
  // a small wet glint (the big cartoon glint made it look like a toy)
  g.fillStyle = 'rgba(240,248,255,0.85)';
  g.beginPath();
  g.ellipse(0.344, -0.04, 0.009, 0.006, -0.5, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(200,225,255,0.3)';
  g.beginPath();
  g.arc(0.375, -0.005, 0.005, 0, TAU);
  g.fill();
}

function paintGlow(g, res, v) {
  const list = PHOTO.map(([x, y, r]) => [x, y, r * 1.35]);
  if (v === 1) list.push([-0.285, -0.03, 0.016]);
  paintGlowDots(g, res, list, GLOW, 2.5);
}

const sizePx = (len, opts) => Math.max(len * (opts.pxScale || 1), 40);
const animAmp = (anim) => clamp((anim.amp || 0.5) + easeState(anim, 'lantern', hookedness(anim), 0).hk * 0.5, 0, 1.6);

export const lanternfish = {
  bounds: { x0: -0.53, x1: 0.51, y0: -0.23, y1: 0.19 },
  mouth: { x: 0.47, y: 0.03 },
  draw(ctx, len, anim, opts) {
    const v = variantOf(anim.seed, 2);
    const spr = unitSprite('lantern:body' + v, BOX, sizePx(len, opts), (g, res) => paintBody(g, res, v));
    swimBlit(ctx, look(spr, opts), len, anim.phase || 0, animAmp(anim), SWIM, pxsOf(anim, opts));
  },
  drawGlow(ctx, len, anim, opts) {
    const v = variantOf(anim.seed, 2);
    const t = anim.t || 0, s = anim.seed || 0;
    const spr = unitSprite('lantern:glow' + v, BOX, sizePx(len, opts), (g, res) => paintGlow(g, res, v));
    // lanternfish pulse their lights: a slow breathing glow with an occasional bright flash
    const flash = Math.max(0, Math.sin(t * 0.7 + s * 40) - 0.92) * 8;
    const a = ctx.globalAlpha;
    ctx.globalAlpha = a * clamp(0.62 + 0.25 * Math.sin(t * 2.1 + s * 17) + flash, 0, 1);
    // tiny on screen: the tail's sway is ~1 px, so the lights can ride rigidly (one blit instead of a strip set)
    if (len * (opts.pxScale || 1) < 70) blitAbout(ctx, spr, len, 0, 0, 0);
    else swimBlit(ctx, spr, len, anim.phase || 0, animAmp(anim), SWIM, pxsOf(anim, opts));
    ctx.globalAlpha = a * (0.07 + flash * 0.15);
    ctx.drawImage(haloDot(GLOW), -len * 0.62, -len * 0.42, len * 1.24, len * 0.84);
    ctx.globalAlpha = a;
  },
};
