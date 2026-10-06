// Coelacanth (Latimeria chalumnae): the living fossil. Deep steel-blue armoured scales flecked with white,
// fleshy lobed fins on stalks that paddle in a slow diagonal "trot", and the three-lobed tail with its tuft.
import { unitSprite, paintEye, paintScales } from '../common.js';
import { TAU, look, easeState, makeProfile, shape, soft, softStroke, clipTo, band, texture, lod, rngFor, variantOf, swimBlit, blitAbout, pxsOf, hookedness, clamp } from './kit.js';
import { rayFin, fishSkin } from './deep-kit.js';

const BOX = { x0: -0.53, x1: 0.52, y0: -0.29, y1: 0.27 };
const SWIM = { swing: 0.024, waves: 0.9, power: 1.8, rigid: 0.15, squash: 0.3, strips: 18 };
const P = makeProfile(
  [[0.5, 0.012], [0.49, -0.03], [0.46, -0.07], [0.4, -0.11], [0.3, -0.14], [0.18, -0.155], [0.05, -0.15], [-0.08, -0.13], [-0.18, -0.1], [-0.26, -0.07], [-0.32, -0.05], [-0.37, -0.03], [-0.41, -0.015], [-0.455, -0.009]],
  [[0.5, 0.012], [0.49, 0.042], [0.46, 0.072], [0.4, 0.1], [0.3, 0.125], [0.18, 0.135], [0.05, 0.13], [-0.08, 0.11], [-0.18, 0.085], [-0.26, 0.06], [-0.32, 0.045], [-0.37, 0.026], [-0.41, 0.012], [-0.455, 0.006]],
);
const FIN = { mem: 'rgba(40,62,110,0.8)', memEdge: 'rgba(90,120,180,0.45)', ray: 'rgba(170,195,235,0.45)', edge: 'rgba(200,220,255,0.2)' };
const FAR = { mem: 'rgba(20,32,60,0.85)', memEdge: 'rgba(40,58,96,0.5)', ray: 'rgba(90,110,150,0.4)' };
const CAUDAL = {
  up: { pts: [[-0.2, -0.085, 1], [-0.27, -0.135], [-0.35, -0.175], [-0.42, -0.165], [-0.445, -0.1], [-0.41, -0.055], [-0.37, -0.034, 1]], base: [[-0.2, -0.085], [-0.37, -0.034]], tips: [[-0.3, -0.2], [-0.46, -0.08]], rays: 12 },
  low: { pts: [[-0.2, 0.08, 1], [-0.27, 0.13], [-0.35, 0.168], [-0.42, 0.158], [-0.445, 0.095], [-0.41, 0.05], [-0.37, 0.03, 1]], base: [[-0.2, 0.08], [-0.37, 0.03]], tips: [[-0.3, 0.195], [-0.46, 0.075]], rays: 12 },
  tuft: { pts: [[-0.44, -0.008, 1], [-0.48, -0.032], [-0.505, -0.014], [-0.505, 0.012], [-0.48, 0.03], [-0.44, 0.008, 1]], base: [[-0.44, -0.008], [-0.44, 0.008]], tips: [[-0.51, -0.035], [-0.51, 0.035]], rays: 7 },
};
const D1 = { pts: [[0.13, -0.148, 1], [0.115, -0.21], [0.08, -0.245], [0.04, -0.22], [0.025, -0.15, 1]], base: [[0.13, -0.146], [0.025, -0.146]], tips: [[0.11, -0.26], [0.0, -0.2]], rays: 8 };

// A lobed fin: a scaly fleshy stalk from the root (0,0) along +x, ending in a fan of rays. Painted in a local
// frame, then placed with (root, angle). k scales it.
function lobedFin(g, res, k, col, far) {
  const stalk = [[-0.03 * k, -0.036 * k, 1], [0.03 * k, -0.04 * k], [0.08 * k, -0.032 * k], [0.105 * k, 0, 1], [0.08 * k, 0.032 * k], [0.03 * k, 0.04 * k], [-0.03 * k, 0.036 * k, 1]];
  rayFin(g, res, {
    pts: [[0.075 * k, -0.026 * k, 1], [0.13 * k, -0.066 * k], [0.19 * k, -0.058 * k], [0.215 * k, -0.01 * k], [0.205 * k, 0.04 * k], [0.15 * k, 0.066 * k], [0.075 * k, 0.026 * k, 1]],
    base: [[0.08 * k, -0.02 * k], [0.08 * k, 0.02 * k]], tips: [[0.17 * k, -0.09 * k], [0.18 * k, 0.09 * k]], rays: 11,
  }, far ? FAR : FIN, { bend: 0.1 });
  g.save();
  g.beginPath();
  shape(g, stalk);
  const gr = g.createLinearGradient(0, -0.03 * k, 0, 0.03 * k);
  gr.addColorStop(0, far ? '#1f3358' : '#3d63a8');
  gr.addColorStop(0.5, far ? '#1a2a4a' : '#2c4a85');
  gr.addColorStop(1, far ? '#101c34' : '#1d3260');
  g.fillStyle = gr;
  g.fill();
  g.clip();
  if (lod(res) >= 1) paintScales(g, -0.04 * k, -0.05 * k, 0.12 * k, 0.05 * k, 0.024 * k, { dark: 'rgba(5,10,30,0.22)', light: 'rgba(200,220,255,0.14)' });
  soft(g, res, 0.004 * k, 'rgba(235,240,250,0.8)', (q) => q.ellipse(0.04 * k, -0.01 * k, 0.014 * k, 0.008 * k, 0.4, 0, TAU));
  g.restore();
}
const LOBES = {
  // root (unit), resting angle, size, phase offset (diagonal pairs move together), far side?
  pecFar: [[0.26, 0.055], 2.25, 0.82, Math.PI, true],
  pelFar: [[0.0, 0.105], 2.05, 0.68, 0, true],
  d2: [[-0.13, -0.095], -2.4, 0.72, 0.5],
  anal: [[-0.13, 0.08], 2.4, 0.72, 0.5 + Math.PI],
  pec: [[0.24, 0.065], 2.4, 0.9, 0],
  pel: [[0.02, 0.108], 2.15, 0.7, Math.PI],
};
const LOBE_BOX = { x0: -0.045, x1: 0.23, y0: -0.1, y1: 0.1 };

function flecks(g, res, v) {
  // each coelacanth's white blotch pattern is unique: irregular clusters of pale spots
  const r = rngFor('coela' + v);
  for (let i = 0; i < 26; i++) {
    const x = 0.33 - r.next() * 0.62, f = 0.1 + r.next() * 0.8;
    const y = P.at(x, f);
    const n = 1 + Math.floor(r.next() * 3);
    for (let j = 0; j < n; j++) {
      const rr = 0.006 + r.next() * 0.01;
      soft(g, res, 0.003, 'rgba(232,238,248,0.82)', (q) => q.ellipse(x + (r.next() - 0.5) * 0.02, y + (r.next() - 0.5) * 0.014, rr * 1.3, rr * 0.8, r.next() * 3, 0, TAU));
    }
  }
}

function paintBody(g, res, v) {
  const L = lod(res);
  rayFin(g, res, CAUDAL.up, FIN, { bend: 0.06 });
  rayFin(g, res, CAUDAL.low, FIN, { bend: -0.06 });
  rayFin(g, res, CAUDAL.tuft, FIN);
  rayFin(g, res, D1, FIN, { rayW: 0.004 });
  clipTo(g, (q) => P.outline(q), () => {
    fishSkin(g, res, P, { back: '#1c3157', flank: 'rgba(44,74,132,0.95)', belly: '#3a5c9a', iris: 'rgba(110,150,220,0.25)', bellyShade: 'rgba(8,16,40,0.45)' },
      { cf: 0.45, soft: 0.05, scale: 0.048, scaleA: 0.13, box: BOX, mottle: 0.2, sheen: 0.8 });
    if (L >= 2) texture(g, 'grain', 0.03, 0.22, BOX, 'soft-light');
    flecks(g, res, v);
    // bony gill cover, heavy lower jaw, wide mouth
    softStroke(g, res, 0.004, 'rgba(5,12,30,0.55)', 0.006, (q) => { q.moveTo(0.35, -0.12); q.quadraticCurveTo(0.31, 0.0, 0.33, 0.12); });
    softStroke(g, res, 0.004, 'rgba(170,200,255,0.25)', 0.004, (q) => { q.moveTo(0.34, -0.12); q.quadraticCurveTo(0.3, 0.0, 0.32, 0.12); });
    softStroke(g, res, 0.003, 'rgba(5,10,25,0.7)', 0.006, (q) => { q.moveTo(0.497, 0.024); q.quadraticCurveTo(0.45, 0.05, 0.39, 0.052); });
    softStroke(g, res, 0.003, 'rgba(5,10,25,0.35)', 0.004, (q) => { q.moveTo(0.46, 0.07); q.quadraticCurveTo(0.42, 0.085, 0.37, 0.09); });
  });
  // big eye with a green-gold tapetum shine
  paintEye(g, 0.405, -0.035, 0.024, { iris: '#3c6a5a', irisDark: '#0a1a18', pupil: 0.66, sclera: null, ring: 'rgba(5,8,20,0.8)' });
  soft(g, res, 0.006, 'rgba(160,255,190,0.22)', (q) => q.arc(0.408, -0.033, 0.012, 0, TAU));
}

const lenPxOf = (len, opts) => Math.min(Math.max(len * (opts.pxScale || 1), 40), opts.detail === 'card' ? 2400 : 1100);

export const coelacanth = {
  bounds: { x0: -0.52, x1: 0.51, y0: -0.27, y1: 0.25 },
  mouth: { x: 0.48, y: 0.03 },
  draw(ctx, len, anim, opts) {
    const lp = lenPxOf(len, opts), t = anim.t || 0, v = variantOf(anim.seed, 3);
    // the lobed fins row in a slow diagonal gait; hooked → frantic sculling. The gait phase integrates its
    // effort-dependent rate per individual (t × rate would jump whenever amp changes).
    const hkT = hookedness(anim);
    const E = easeState(anim, 'coela', hkT, 0, 1.4 + (anim.amp || 0.4) * 1.5 + hkT * 4);
    const hk = E.hk, gait = E.ph;
    const body = unitSprite('coela:body' + v, BOX, lp, (g, res) => paintBody(g, res, v));
    const lobe = unitSprite('coela:lobe', LOBE_BOX, lp, (g, res) => lobedFin(g, res, 1, FIN, false));
    const lobeFar = unitSprite('coela:lobeFar', LOBE_BOX, lp, (g, res) => lobedFin(g, res, 1, FAR, true));
    const sweep = 0.28 + hk * 0.2;
    const fin = (key) => {
      const [root, base, k, ph, far] = LOBES[key];
      const ang = base + Math.sin(gait + ph) * sweep * (key === 'd2' ? -1 : 1);
      ctx.save();
      ctx.translate(root[0] * len, root[1] * len);
      ctx.rotate(ang);
      ctx.scale(k, k);
      const spr = look(far ? lobeFar : lobe, opts);
      const b = spr.box, s = len / spr.res;
      ctx.drawImage(spr.canvas, b.x0 * len - spr.pad * s, b.y0 * len - spr.pad * s, spr.canvas.width * s, spr.canvas.height * s);
      ctx.restore();
    };
    ctx.save();
    if (hk) ctx.rotate(Math.sin(t * 7.9) * 0.05 * hk);
    fin('pecFar');
    fin('pelFar');
    fin('d2');
    fin('anal');
    swimBlit(ctx, look(body, opts), len, anim.phase || 0, clamp((anim.amp || 0.4) + hk * 0.6, 0, 1.6), SWIM, pxsOf(anim, opts));
    fin('pel');
    fin('pec');
    ctx.restore();
  },
};
