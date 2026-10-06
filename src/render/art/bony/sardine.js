// Pacific sardine (Sardinops sagax) — slender silver schooling fish: blue-green back, a row of dark spots along
// the upper flank, deeply forked tail. Shimmers in a school via a periodic "flash" overlay.
import { profile, paintBody, fin, ridge, caudal, scales, gill, mouthLine, eye, spot, soft, glint, erase, mottle, rgba, mixc, lite, dark, shift, jawPolygon, createRng } from './kit.js';
import { scull, blitSwim } from './rig.js';
import { unitSprite, variantFor } from '../common.js';

const P = profile(
  [[0.5, -0.004], [0.49, -0.02], [0.46, -0.04], [0.4, -0.06], [0.3, -0.078], [0.17, -0.088], [0.03, -0.085], [-0.12, -0.07], [-0.25, -0.046], [-0.33, -0.03], [-0.36, -0.026]],
  [[0.5, -0.004], [0.49, 0.016], [0.46, 0.036], [0.4, 0.058], [0.3, 0.08], [0.17, 0.094], [0.03, 0.094], [-0.12, 0.078], [-0.25, 0.05], [-0.33, 0.031], [-0.36, 0.027]],
);
const HINGE = [0.432, 0.03], TIP = [0.498, 0.004], CORNER = [0.452, 0.02];
const PEC = [0.262, 0.05];
const BOX = { x0: -0.51, x1: 0.51, y0: -0.16, y1: 0.15 };

function paint(g, res, v) {
  const rng = createRng(301 + v * 13);
  const dh = [-8, 0, 9][v];
  const back = shift('#1d4a5a', dh, 0, 0), teal = shift('#2b7a7e', dh, 0.05, 0);
  const finCol = '#b9c4c6';
  // ── fins behind the body ──
  const tail = caudal({ P, root: 0.05, up: [-0.5, -0.116], lo: [-0.5, 0.112], notch: [-0.405, 0], lead: 0.04, trail: -0.12 });
  fin(g, res, {
    pts: tail,
    stops: [[0, rgba('#8fa3a6', 0.95)], [0.6, rgba(finCol, 0.85)], [1, rgba('#6c7d82', 0.8)]],
    axis: [-0.34, 0, -0.5, 0],
    rays: { n: 22, to: [3, 7], from: tail.root, col: '#2a3c44', a: 0.3, fade: 0.3, w: 0.0014, curl: 0.04, hl: '#ffffff', hla: 0.14 },
    scallop: { from: 3, to: 7, n: 11, depth: 0.0025 },
    edge: { col: 'rgba(40,60,70,0.35)', w: 0.0022, to: 3 },
  });
  const dTop = (x) => P.top(x) + 0.01;
  fin(g, res, {
    pts: ridge(P, 'top', [[0.13, -0.012], [0.112, 0.06, 1], [0.05, 0.036], [-0.01, 0.014, 1], [-0.025, -0.012]], 0.35),
    stops: [[0, rgba('#9fb0b4', 0.95)], [1, rgba('#d8e2e4', 0.7)]],
    rays: { n: 15, from: [[0.115, dTop(0.115)], [-0.02, dTop(-0.02)]], lean: [0.3, 1.0], col: '#2a3c44', a: 0.32, w: 0.0013, hl: '#ffffff' },
    edge: { col: 'rgba(40,60,70,0.4)', w: 0.002, to: 1 },
    shade: 'rgba(20,50,70,0.3)',
  });
  const aBot = (x) => P.bot(x) - 0.01;
  fin(g, res, {
    pts: ridge(P, 'bot', [[-0.16, -0.01], [-0.172, 0.026, 1], [-0.22, 0.018], [-0.265, 0.01, 1], [-0.275, -0.01]], 0.4),
    stops: [[0, rgba('#c9d4d6', 0.9)], [1, rgba('#e8eef0', 0.65)]],
    rays: { n: 10, from: [[-0.168, aBot(-0.168)], [-0.27, aBot(-0.27)]], lean: [0.4, 1.2], up: 1, col: '#2a3c44', a: 0.25, w: 0.0012 },
  });
  const py = P.bot(0.02);
  fin(g, res, {
    pts: [[0.03, py - 0.01], [0.012, py + 0.02], [-0.04, py + 0.04, 1], [-0.02, py + 0.012], [-0.005, py - 0.01]],
    stops: [[0, rgba('#c9d4d6', 0.9)], [1, rgba('#e8eef0', 0.6)]],
    rays: { n: 6, to: [1, 3], from: [[0.024, py], [0.0, py]], col: '#2a3c44', a: 0.25, w: 0.0012 },
  });

  // ── body ──
  paintBody(g, res, P, {
    fade: 0.03,
    skin(t, U) {
      U.grad([[0, dark(back, 0.3)], [0.1, back], [0.22, teal], [0.3, mixc(teal, '#9fd4c8', 0.5)], [0.36, '#c9d8d6'], [0.46, '#e9eef0'], [0.62, '#f4f6f6'], [0.82, '#ffffff'], [1, '#f2f4f2']]);
      // golden-green iridescent seam between back and silver
      U.band(0.3, 0.345, '#d9c56a', 0.5, 0.02, -0.3, 0.42);
      U.band(0.42, 0.47, '#b8d4e8', 0.28, 0.025, -0.3, 0.4);
    },
    over(gg) {
      mottle(gg, -0.37, -0.1, 0.5, 0.1, { color: '#ffffff', a: 0.14, scale: 0.26, lo: 0.5, hi: 0.8, seed: 21, sy: 0.4 });
      scales(gg, res, P, { rows: 9, x0: -0.33, x1: 0.27, xFade: (x) => Math.min(1, (0.27 - x) / 0.03), dark: '#1a3444', da: 0.15, la: 0.18, rng, glint: { p: 0.2, color: '#ffffff', a: 0.3 } });
      // the signature row of spots along the upper flank (+ a sparse second row)
      for (let i = 0; i < 9; i++) {
        const x = 0.25 - i * 0.052 + (rng.next() - 0.5) * 0.012;
        const vv = 0.3 + (rng.next() - 0.5) * 0.06;
        const r = 0.0075 + rng.next() * 0.0035;
        spot(gg, x, P.at(x, vv), r, '#0f2838', 0.8, 0.55, r * 0.92);
      }
      for (let i = 0; i < 5; i++) {
        const x = 0.2 - i * 0.07 + rng.next() * 0.03;
        spot(gg, x, P.at(x, 0.19), 0.0035 + rng.next() * 0.002, '#0f2838', 0.5, 0.5);
      }
    },
    shade: { dark: '#0f2236', sheen: 0.5, sheenV: 0.4, sheenW: 0.13, gloss: 0.38, belly: 0.22, bounce: 0.6, rim: 0.3, topLight: 0.22 },
    face(gg) {
      // radiating striae on the gill cover, the cover itself, a translucent adipose eyelid
      soft(gg, 0.003, 'rgba(30,55,75,0.22)', () => {
        gg.lineWidth = 0.0025;
        for (let i = 0; i < 4; i++) {
          gg.beginPath();
          gg.moveTo(0.4, -0.012 + i * 0.004);
          gg.quadraticCurveTo(0.36, 0.01 + i * 0.018, 0.31, 0.012 + i * 0.024);
          gg.stroke();
        }
      });
      gill(gg, res, { x: 0.3, y0: -0.062, y1: 0.075, bulge: 0.028, dark: '#1a3448', a: 0.4, shadow: 0.22, plate: 0.22, w: 0.0022 });
      spot(gg, 0.46, -0.016, 0.003, '#13283a', 0.7, 0.5);
      mouthLine(gg, res, { tip: TIP, corner: CORNER, sag: 0.003, dark: '#2a2a30', a: 0.55, w: 0.0026, lip: 'rgba(255,255,255,0.3)' });
      eye(gg, 0.385, -0.018, 0.027, { iris: '#c9c2b2', irisDark: '#4a4a52', pupil: 0.6, ring: 'rgba(20,30,45,0.35)', rim: 'rgba(230,220,160,0.5)', socket: 0.18 });
      spot(gg, 0.385, -0.018, 0.034, '#dfe8ec', 0.18, 0.75, 0.03);
      glint(gg, 0.44, -0.034, 0.02, 0.004, 0.3, -0.5);
    },
  });
}

function paintPec(g, res) {
  fin(g, res, {
    pts: [[0.27, 0.042], [0.235, 0.05], [0.165, 0.085, 1], [0.2, 0.082], [0.25, 0.066], [0.268, 0.058]],
    stops: [[0, 'rgba(220,228,230,0.9)'], [1, 'rgba(240,246,248,0.55)']],
    axis: [0.265, 0.05, 0.17, 0.084],
    rays: { n: 10, to: [2, 4], from: [[0.266, 0.045], [0.264, 0.056]], col: '#2a3c44', a: 0.3, w: 0.0013 },
    outline: { col: 'rgba(40,60,70,0.25)', w: 0.0014 },
  });
  erase(g, 0.272, 0.05, 0.016, 0.9, 0.25, 0.02);
}

// bright flank for the school shimmer (same box as the body so it rides the same wave)
function paintFlash(g) {
  g.save();
  P.trace(g);
  g.clip();
  const gr = g.createLinearGradient(0, -0.09, 0, 0.1);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.3, 'rgba(235,248,255,0.55)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.75, 'rgba(255,255,255,0.6)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(-0.4, -0.1, 0.95, 0.22);
  g.restore();
}

export const def = {
  id: 'sardine',
  bounds: { x0: -0.5, x1: 0.5, y0: -0.15, y1: 0.14 },
  mouth: { x: 0.49, y: 0.0 },
  box: BOX,
  paint,
  swim: { swing: 0.046, waves: 1.2, power: 2.0, head: 0.08, squash: 0.025, freq: 1.3, strips: 8 },
  parts: [{ key: 'pec', box: { x0: 0.15, x1: 0.29, y0: 0.03, y1: 0.1 }, pivot: PEC, paint: paintPec, pose: scull({ rest: 0.1, amp: 0.22, rate: 3.2, fold: 0.3 }) }],
  jaw: { hinge: HINGE, tip: TIP, corner: CORNER, poly: jawPolygon(P, HINGE, TIP, CORNER), gape: 0.45, cavity: '#2a1016' },
  gillSlit: { x: 0.3, y0: -0.055, y1: 0.07, bulge: 0.028, w: 0.003 },
  over(ctx, len, anim, opts, st, w, R) {
    if (R.sil) return;
    const k = Math.sin(anim.t * 2.2 + anim.uid * 1.7);
    if (k < 0.55) return;
    const a = Math.pow(k, 10) * 0.8;
    if (a < 0.02) return;
    const spr = variantFor(unitSprite('sardine/flash', BOX, R.lenPx, paintFlash), opts);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * a;
    blitSwim(ctx, spr, len, w, R.n, R.ov);
    ctx.globalAlpha = ga;
  },
};
