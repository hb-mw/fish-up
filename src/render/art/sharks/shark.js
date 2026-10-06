// Parametric shark builder: one spec → one drawer (body sprite + hinged lower jaw + live pectoral fin).
//
// Sprite layering per frame (all cached, unit space):
//   [mouth interior + teeth rows, only while the mouth is open]  →  body (swim strips; the lower-jaw region is
//   cut out of it)  →  lower jaw (rotated about the mouth corner; overlaps the cut so it is seamless when shut)
//   →  [upper jaw, for protrusible jaws]  →  near pectoral fin (rotated a little about its root: steering).
// The head is rigid in the swim wave (sharks swim with the rear body), so jaw + fin need no wave tracking.
import { unitSprite, paintEye } from '../common.js';
import { noise1, hashStr as hashSeedStr } from '../../../core/rng.js';
import {
  TAU, clamp, spline, shape, makeProfile, band, soft, softStroke, clipTo, texture, ca, mixc, shade, lod, rngFor,
  variantOf, swimBlit, blitAbout, pxsOf, hookedness, liveColor, SIL, makeLayer, putLayer, fadeX, easeState, look, peekEase,
} from './kit.js';

const DEF_SWIM = { swing: 0.03, waves: 0.85, power: 2.1, rigid: 0.2, tail: -0.5, squash: 0.6, strips: 22 };
const hashSeed = (s) => hashSeedStr(s) % 997;

/** Closed fin path: either fin.pts (smooth points, [x,y,1] = sharp corner) or fin.parts (open splines joined at corners). */
export function finPath(g, fin) {
  if (fin.pts) {
    shape(g, fin.pts, fin.t || 1);
    return;
  }
  fin.parts.forEach((p, i) => spline(g, p, i === 0, fin.t || 1));
  g.closePath();
}
function edgeLists(fin, which) {
  const sel = fin[which];
  if (!sel || !sel.length) return [];
  if (typeof sel[0] === 'number') return sel.map((i) => fin.parts[i]);
  return Array.isArray(sel[0][0]) ? sel : [sel];
}
export function finBox(fin, m) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const lists = fin.pts ? [fin.pts] : fin.parts;
  for (const part of lists) for (const p of part) {
    x0 = Math.min(x0, p[0]);
    y0 = Math.min(y0, p[1]);
    x1 = Math.max(x1, p[0]);
    y1 = Math.max(y1, p[1]);
  }
  return { x0: x0 - m, y0: y0 - m, x1: x1 + m, y1: y1 + m };
}

/**
 * Paint a fin: base→tip gradient, optional dark tip band (+ pale band under it), marks, leading-edge sheen,
 * translucent trailing edge, low-contrast skin texture.
 * fin: { pts | parts, lead, trail (part indices or point lists), base:[x,y], tip:[x,y], tipBand, tipCol, tipSoft,
 *        paleBand, paleCol, marks:[{at:[x,y], r, rx, ry, rot, col, soft} | {edge:[pts], w, col, soft}] }
 * col: { base, mid, tip, edge } colours.
 */
export function paintFin(g, res, fin, col, o = {}) {
  const [bx, by] = fin.base, [tx, ty] = fin.tip;
  const grad = g.createLinearGradient(bx, by, tx, ty);
  grad.addColorStop(0, col.base);
  grad.addColorStop(0.55, col.mid || col.base);
  grad.addColorStop(1, col.tip || col.mid || col.base);
  g.save();
  g.beginPath();
  finPath(g, fin);
  g.fillStyle = grad;
  g.fill();
  g.clip();
  const L = lod(res);
  const dx = tx - bx, dy = ty - by, d = Math.hypot(dx, dy) || 1;
  const ux = dx / d, uy = dy / d;
  const t = fin.t || 1;
  if (fin.tipBand !== undefined) {
    // everything beyond the plane at tipBand × (base→tip) gets the tip colour
    const k = fin.tipBand, px = bx + dx * k, py = by + dy * k;
    const nx = -uy, ny = ux, W = d * 2;
    if (fin.paleBand) {
      const k2 = k - fin.paleBand, qx = bx + dx * k2, qy = by + dy * k2, wd = d * fin.paleBand * 1.2;
      soft(g, res, fin.paleSoft || 0.006, fin.paleCol || 'rgba(238,232,218,0.6)', (q) => {
        q.moveTo(qx - nx * W, qy - ny * W);
        q.lineTo(qx + nx * W, qy + ny * W);
        q.lineTo(qx + nx * W + ux * wd, qy + ny * W + uy * wd);
        q.lineTo(qx - nx * W + ux * wd, qy - ny * W + uy * wd);
        q.closePath();
      });
    }
    soft(g, res, fin.tipSoft || 0.003, fin.tipCol || '#121416', (q) => {
      q.moveTo(px - nx * W, py - ny * W);
      const steps = 12;
      for (let i = 0; i <= steps; i++) {
        const s = -1 + (2 * i) / steps;
        const w = (fin.tipCurve || 0) * d * s * s;
        q.lineTo(px + nx * W * s + ux * w, py + ny * W * s + uy * w);
      }
      q.lineTo(px + nx * W + ux * W, py + ny * W + uy * W);
      q.lineTo(px - nx * W + ux * W, py - ny * W + uy * W);
      q.closePath();
    });
  }
  if (fin.marks) {
    for (const m of fin.marks) {
      if (m.edge) {
        softStroke(g, res, m.soft || 0.003, m.col, m.w, (q) => spline(q, m.edge, true, t));
      } else {
        soft(g, res, m.soft || 0.004, m.col, (q) => q.ellipse(m.at[0], m.at[1], m.rx || m.r, m.ry || m.r, m.rot || 0, 0, TAU));
      }
    }
  }
  // leading-edge sheen + trailing-edge translucency
  const w = Math.max(0.0025, d * 0.07);
  const leads = edgeLists(fin, 'lead'), trails = edgeLists(fin, 'trail');
  if (leads.length) softStroke(g, res, w * 0.5, col.edge || 'rgba(255,255,255,0.22)', w, (q) => leads.forEach((p) => spline(q, p, true, t)));
  if (trails.length) {
    softStroke(g, res, w * 0.5, o.trailCol || 'rgba(255,255,255,0.06)', w * 1.2, (q) => trails.forEach((p) => spline(q, p, true, t)));
    softStroke(g, res, w * 0.15, o.trailEdge || 'rgba(0,0,0,0.22)', w * 0.3, (q) => trails.forEach((p) => spline(q, p, true, t)));
  }
  if (L >= 1) {
    const box = { x0: Math.min(bx, tx) - d, y0: Math.min(by, ty) - d, x1: Math.max(bx, tx) + d, y1: Math.max(by, ty) + d };
    texture(g, 'mottle', 0.3, o.mottle !== undefined ? o.mottle : 0.12, box);
  }
  if (o.after) o.after(g);
  g.restore();
}

/** Build a drawer from a shark spec (see sharkspecies.js for the fields). */
export function makeShark(S) {
  const P = makeProfile(S.top, S.bot, S.tension || 1);
  const C = S.colors;
  const NV = S.variants || 3;
  const swim = Object.assign({}, DEF_SWIM, S.swim || {});
  const M = S.mouth;
  const H = M.hinge, F = M.front;
  // mouth line from the hinge (corner) to the front of the lower jaw
  const mouthLine = M.line || [H, [(H[0] + F[0]) / 2, (H[1] + F[1]) / 2 + 0.004], F];
  const throatX = M.throat !== undefined ? M.throat : H[0] - 0.012;
  const B = S.bounds;
  const box = S.box || { x0: B.x0 - 0.01, x1: B.x1 + 0.01, y0: B.y0 - 0.01, y1: B.y1 + 0.01 };
  const tSz = (M.teeth && Math.max(M.teeth.size || 0, M.teeth.sizeLow || 0)) || 0.01;
  const jawBox = {
    x0: throatX - 0.03, x1: F[0] + 0.03 + tSz,
    y0: Math.min(H[1], F[1]) - 0.03 - tSz * 1.5, y1: Math.max(P.bot(throatX), P.bot(F[0])) + 0.03,
  };
  const pec = S.fins.pec;
  const pecBox = pec ? finBox(pec, 0.02) : null;
  const teethBox = { x0: throatX - 0.04, x1: F[0] + 0.04, y0: Math.min(H[1], F[1]) - 0.06, y1: Math.max(H[1], F[1]) + 0.06 };
  const U = M.upper; // optional protrusible upper jaw: { pts (region), box }

  const cfn = typeof S.counter.f === 'function' ? S.counter.f : () => S.counter.f;
  const jitterFor = (v) => {
    const r = S.counter.rough || 0;
    if (!r) return null;
    const fr = S.counter.freq || 40;
    const sd = hashSeed(S.id) + v * 17;
    // irregular, flame-like boundary: low-frequency drift + sharper small notches
    return (x) => r * ((noise1(x * fr, sd) - 0.5) * 1.6 + (noise1(x * fr * 3.3, sd + 5) - 0.5) * 0.9 + (noise1(x * fr * 9, sd + 9) - 0.5) * 0.35);
  };

  function jawRegion(g, grow = 0) {
    // mouth line (front → hinge), down the throat to the ventral outline, forward along the belly to the front
    const ml = mouthLine.slice().reverse().map((p) => [p[0], p[1] - grow]);
    ml[0] = [F[0] + grow * 0.6, F[1] - grow];
    spline(g, ml, true);
    g.lineTo(H[0] - grow, H[1] - grow);
    const tx = throatX - grow;
    g.lineTo(tx, P.bot(tx) + 0.01);
    for (let i = 0; i <= 16; i++) {
      const x = tx + ((F[0] + grow - tx) * i) / 16;
      g.lineTo(x, P.bot(x) + 0.01);
    }
    g.closePath();
  }

  /** Everything painted on the skin (shared by the body and the jaw sprites so they match exactly). */
  function paintSkin(g, res, v) {
    const L = lod(res);
    const xa = P.x1 + 0.02, xb = P.x0 - 0.02;
    const jit = jitterFor(v);
    const cf = (x) => cfn(x);
    const LI = S.light || {};
    // 1 belly: pale, whitest just under the countershade line (the flank still faces the light), shading
    //   toward the ventral edge as the surface turns away
    g.fillStyle = C.belly;
    g.fillRect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
    soft(g, res, 0.03, ca(C.bellyLit || '#ffffff', LI.bellyLit !== undefined ? LI.bellyLit : 0.6), (q) => band(q, P, xa, xb, (x) => cf(x), (x) => cf(x) + 0.26));
    soft(g, res, 0.035, ca(C.bellyShade || '#7d8792', LI.belly !== undefined ? LI.belly : 0.55), (q) => band(q, P, xa, xb, 0.78, 1.25));
    soft(g, res, 0.012, ca(C.bellyShade || '#7d8792', 0.4), (q) => band(q, P, xa, xb, 0.93, 1.25));
    // 2 dorsal pigment above the countershading line
    soft(g, res, S.counter.soft || 0.004, C.back, (q) => band(q, P, xa, xb, -0.4, cf, 200, jit ? (x, side) => (side ? jit(x) : 0) : null));
    if (C.counterEdge) {
      soft(g, res, 0.008, C.counterEdge, (q) => band(q, P, xa, xb, (x) => cf(x) - 0.07, (x) => cf(x), 120, jit ? (x) => jit(x) : null));
    }
    // tonal modelling, lit from above: the back (facing the sun) is lighter, the flank (facing sideways)
    // darkens toward the boundary — that dark band over the white is what makes a shark read as round
    soft(g, res, 0.03, ca(C.top || shade(C.back, 1.25), LI.top !== undefined ? LI.top : 0.55), (q) => band(q, P, xa, xb, -0.3, 0.16));
    soft(g, res, 0.035, ca(C.flank || shade(C.back, 0.72), LI.flank !== undefined ? LI.flank : 0.55), (q) => band(q, P, xa, xb, (x) => cf(x) - 0.3, (x) => cf(x) + 0.02));
    if (S.paint && S.paint.pattern) S.paint.pattern(g, res, v, P, S);
    // 3 light: broad wet sheen on the upper flank, a tight specular streak, rim light along the back
    const shx0 = LI.sheenFrom !== undefined ? LI.sheenFrom : 0.44, shx1 = LI.sheenTo !== undefined ? LI.sheenTo : -0.25;
    soft(g, res, 0.035, `rgba(225,240,255,${LI.sheen !== undefined ? LI.sheen : 0.16})`, (q) => band(q, P, shx0, shx1, 0.13, 0.34));
    soft(g, res, 0.009, `rgba(255,255,255,${LI.spec !== undefined ? LI.spec : 0.2})`, (q) => band(q, P, shx0 - 0.08, shx1 + 0.22, 0.19, 0.225));
    // wet look: a narrow bright streak inside the sheen, strongest over the shoulders, and a glint on the snout
    soft(g, res, 0.004, `rgba(255,255,255,${(LI.spec !== undefined ? LI.spec : 0.2) * 0.9})`, (q) => band(q, P, shx0 - 0.14, shx1 + 0.38, 0.2, 0.212));
    soft(g, res, 0.006, 'rgba(255,255,255,0.22)', (q) => q.ellipse(P.x1 - 0.035, P.at(P.x1 - 0.035, 0.22), 0.018, 0.0045, 0.35, 0, TAU));
    soft(g, res, 0.005, ca(C.rim || '#cfe6f2', LI.rim !== undefined ? LI.rim : 0.38), (q) => band(q, P, xa, xb, -0.2, 0.03));
    // dome of the head catching the light
    const [ex] = S.eye;
    soft(g, res, 0.02, 'rgba(235,245,255,0.12)', (q) => q.ellipse(ex - 0.01, P.at(ex, 0.18), 0.05, 0.016, 0.1, 0, TAU));
    // occlusion behind the head / under the pectoral root
    if (S.fins.pec) {
      const fp = S.fins.pec.pivot || (S.fins.pec.pts ? S.fins.pec.pts[0] : S.fins.pec.parts[0][0]);
      soft(g, res, 0.03, 'rgba(10,18,28,0.2)', (q) => q.ellipse(fp[0] - 0.06, fp[1] + 0.014, 0.08, 0.026, -0.2, 0, TAU));
    }
    // 4 skin: matte denticle skin — very low contrast blotching + fine grain on big renders
    texture(g, 'mottle', LI.mottleScale || 0.45, LI.mottle !== undefined ? LI.mottle : 0.13, box);
    if (L >= 2) texture(g, 'grain', 0.025, LI.grain !== undefined ? LI.grain : 0.1, box, 'soft-light', 3.5);
    if (S.paint && S.paint.skin) S.paint.skin(g, res, v, P, S);
  }

  function paintGills(g, res) {
    const G = S.gills;
    if (!G) return;
    // full strength over the dark back, faint creases on the pale belly
    const ba = G.bellyAlpha !== undefined ? G.bellyAlpha : 0.45;
    clipTo(g, (q) => band(q, P, P.x1, P.x0, -0.6, (x) => cfn(x) + 0.03), () => slits(g, res, 1));
    clipTo(g, (q) => band(q, P, P.x1, P.x0, (x) => cfn(x) + 0.03, 1.6), () => slits(g, res, ba));
  }
  function slits(g, res, k) {
    const G = S.gills;
    const w = G.width || 0.0026;
    const n = G.xs.length;
    G.xs.forEach((x, i) => {
      // middle slits longest; each slit a gentle arc, posterior flap catching a little light
      const mid = 1 - Math.abs(i - (n - 1) / 2) / n;
      const ft = G.top + (1 - mid) * (G.taper || 0.08), fb = G.bot - (1 - mid) * (G.taper || 0.08) * 0.6;
      const lean = G.lean !== undefined ? G.lean : 0.008;
      const yt = P.at(x, ft), yb = P.at(x - lean, fb);
      const bow = G.bow !== undefined ? G.bow : 0.005;
      const path = (q, dx) => {
        q.moveTo(x + dx, yt);
        q.quadraticCurveTo(x - lean * 0.5 - bow + dx, (yt + yb) / 2, x - lean + dx, yb);
      };
      softStroke(g, res, w * 0.6, ca(C.gill || '#1c242c', (G.alpha || 0.42) * k), w, (q) => path(q, 0));
      softStroke(g, res, w * 0.4, ca(C.gill || '#1c242c', (G.alpha || 0.42) * 0.8 * k), w * 0.4, (q) => path(q, w * 0.2));
      softStroke(g, res, w * 0.8, `rgba(255,255,255,${0.14 * k})`, w * 0.9, (q) => path(q, -w * 1.25));
    });
  }

  function paintEyeAt(g, res, ex, ey, er, extra) {
    soft(g, res, er * 0.9, 'rgba(10,14,18,0.3)', (q) => q.ellipse(ex - er * 0.15, ey + er * 0.1, er * 1.9, er * 1.4, 0, 0, TAU));
    soft(g, res, er * 0.6, 'rgba(255,255,255,0.12)', (q) => q.ellipse(ex - er * 0.3, ey - er * 1.55, er * 1.7, er * 0.42, -0.08, 0, TAU));
    const es = Object.assign({}, S.eyeStyle || {}, extra || {});
    paintEye(g, ex, ey, er, Object.assign({ iris: '#1a1e23', irisDark: '#020304', pupil: 0.62, sclera: null, ring: 'rgba(8,10,12,0.7)', look: { x: 0.3, y: 0.05 }, glint: false }, es));
    if (es.glint !== true) {
      g.fillStyle = 'rgba(235,245,255,0.85)';
      g.beginPath();
      g.ellipse(ex - er * 0.32, ey - er * 0.38, er * 0.2, er * 0.14, -0.5, 0, TAU);
      g.fill();
      g.fillStyle = 'rgba(200,225,240,0.28)';
      g.beginPath();
      g.arc(ex + er * 0.3, ey + er * 0.35, er * 0.12, 0, TAU);
      g.fill();
    }
  }

  function paintHead(g, res, v) {
    const L = lod(res);
    const [ex, ey, er] = S.eye;
    if (S.nostril) {
      const [nx, ny, nl] = S.nostril;
      softStroke(g, res, 0.002, 'rgba(15,20,26,0.5)', 0.003, (q) => {
        q.moveTo(nx + nl * 0.5, ny - nl * 0.1);
        q.quadraticCurveTo(nx, ny + nl * 0.25, nx - nl * 0.5, ny);
      });
    }
    // ampullae of Lorenzini: rows of fine pores on the snout (only on big renders)
    if (L >= 2 && S.pores !== false) {
      const r = rngFor(S.id + 'pores');
      g.fillStyle = 'rgba(20,26,32,0.2)';
      const x0 = ex + er * 1.5, x1 = P.x1 - 0.006;
      for (let row = 0; row < 4; row++) {
        const f = 0.45 + row * 0.11;
        for (let i = 0; i < 7; i++) {
          const x = x0 + ((x1 - x0) * (i + 0.5 + (r.next() - 0.5) * 0.6)) / 7;
          if (x > x1) continue;
          const y = P.at(x, f + (r.next() - 0.5) * 0.04);
          g.beginPath();
          g.arc(x, y, 0.0006 + r.next() * 0.0005, 0, TAU);
          g.fill();
        }
      }
    }
    if (!S.eyeOutside) paintEyeAt(g, res, ex, ey, er);
    if (S.paint && S.paint.head) S.paint.head(g, res, v, P, S);
  }

  function paintTeeth(g, res, upper) {
    const T = M.teeth;
    if (!T) return;
    teethRow(g, res, mouthLine, T, upper, S.id, C, upper && !!M.bared);
  }

  // ── sprite painters ─────────────────────────────────────────────────────────────────────────
  function paintBody(g, res, v) { // eslint-disable-line no-param-reassign
    const F_ = S.fins;
    const fc = finColors(C, false), ff = finColors(C, true);
    const hook = (name) => (S.paint && S.paint[name] ? (q) => S.paint[name](q, res, v) : null);
    if (F_.pecFar) paintFin(g, res, F_.pecFar, ff);
    if (F_.pelvicFar) paintFin(g, res, F_.pelvicFar, ff);
    if (S.paint && S.paint.back) S.paint.back(g, res, v, P, S);
    if (F_.caudal) paintFin(g, res, F_.caudal, finColors(C, false, 'caudal'), { after: hook('caudal') });
    if (F_.anal) paintFin(g, res, F_.anal, fc, { after: hook('anal') });
    if (F_.d2) paintFin(g, res, F_.d2, fc, { after: hook('d2') });
    if (F_.d1) paintFin(g, res, F_.d1, finColors(C, false, 'd1'), { after: hook('dorsal') });
    if (S.paint && S.paint.behind) S.paint.behind(g, res, v, P, S);
    // the body goes into its own layer so its tail end can fade into the caudal fin painted underneath
    const outer = g;
    g = makeLayer(outer);
    clipTo(g, (q) => P.outline(q), () => {
      paintSkin(g, res, v);
      if (S.keel) {
        const [k0, k1, ky] = S.keel;
        softStroke(g, res, 0.003, 'rgba(10,16,24,0.35)', 0.004, (q) => {
          q.moveTo(k0, P.at(k0, ky) + 0.003);
          q.lineTo(k1, P.at(k1, ky) + 0.003);
        });
        softStroke(g, res, 0.003, 'rgba(255,255,255,0.22)', 0.003, (q) => {
          q.moveTo(k0, P.at(k0, ky) - 0.002);
          q.lineTo(k1, P.at(k1, ky) - 0.002);
        });
      }
      paintGills(g, res);
      // upper lip edge (visible when the jaw drops) + the labial fold running back from the mouth corner
      softStroke(g, res, 0.0018, 'rgba(20,14,16,0.4)', 0.0024, (q) => spline(q, mouthLine.map((p) => [p[0], p[1] - 0.0015]), true));
      if (M.fold !== false) {
        const fl = M.foldLen || 1;
        softStroke(g, res, 0.002, 'rgba(18,14,16,0.42)', 0.0026, (q) => {
          q.moveTo(H[0] + 0.004, H[1] - 0.001);
          q.quadraticCurveTo(H[0] - 0.008 * fl, H[1] + 0.002 * fl, H[0] - 0.014 * fl, H[1] + 0.012 * fl);
        });
      }
      paintHead(g, res, v);
      if (S.paint && S.paint.extras) S.paint.extras(g, res, v, P, S);
      // soft rim darkening at the silhouette (no outline, just turning away from the light) — not where
      // the body tapers into the tail fin
      clipTo(g, (q) => q.rect(S.rimFrom !== undefined ? S.rimFrom : -0.27, -1, 2, 2), () => {
        softStroke(g, res, 0.006, 'rgba(10,20,30,0.22)', 0.006, (q) => P.outline(q));
      });
    });
    // cut the lower jaw out (it lives in its own sprite)
    g.save();
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    jawRegion(g, 0);
    g.fillStyle = '#000';
    g.fill();
    g.restore();
    fadeX(g, S.tailFade ? S.tailFade[0] : P.x0 + 0.06, S.tailFade ? S.tailFade[1] : P.x0 - 0.005, box);
    putLayer(outer, g);
    g = outer;
    if (F_.pelvic) paintFin(g, res, F_.pelvic, fc, { after: hook('pelvic') });
    if (S.paint && S.paint.front) S.paint.front(g, res, v, P, S, { paintEyeAt: (...a) => paintEyeAt(g, res, ...a) });
  }

  function paintJaw(g, res, v) {
    clipTo(g, (q) => jawRegion(q, 0.005), () => {
      clipTo(g, (q) => P.outline(q), () => {
        paintSkin(g, res, v);
        softStroke(g, res, 0.006, 'rgba(10,20,30,0.25)', 0.006, (q) => P.outline(q));
        if (S.paint && S.paint.jaw) S.paint.jaw(g, res, v, P, S);
      });
      // the closed mouth: a dark crease, deepest toward the corner
      softStroke(g, res, 0.0016, 'rgba(18,10,12,0.5)', 0.0026, (q) => spline(q, mouthLine, true));
      softStroke(g, res, 0.002, 'rgba(14,8,10,0.55)', 0.0042, (q) => spline(q, mouthLine.slice(0, Math.max(2, Math.ceil(mouthLine.length / 2))), true));
      softStroke(g, res, 0.002, 'rgba(255,255,255,0.12)', 0.002, (q) => spline(q, mouthLine.map((p) => [p[0], p[1] + 0.0035]), true));
    });
    // teeth that show even with the mouth shut (mako, megalodon): they ride with the lower jaw
    if (M.showTeeth) M.showTeeth(g, res, v, mouthLine);
  }

  function paintUpper(g, res, v) {
    clipTo(g, (q) => shape(q, U.pts), () => {
      paintSkin(g, res, v);
      if (U.paint) U.paint(g, res, v, P, S);
    });
  }

  function paintPec(g, res, v) {
    paintFin(g, res, pec, finColors(C, false, 'pec'), { after: S.paint && S.paint.pec ? (q) => S.paint.pec(q, res, v) : null });
  }

  const keyBase = S.id + ':';
  const pecVar = !!(S.paint && S.paint.pecVaries);
  const sprites = (lenPx, v) => ({
    body: unitSprite(keyBase + 'body' + v, box, lenPx, (g, res) => paintBody(g, res, v)),
    jaw: unitSprite(keyBase + 'jaw' + v, jawBox, lenPx, (g, res) => paintJaw(g, res, v)),
    pec: pec ? unitSprite(keyBase + 'pec' + (pecVar ? v : ''), pecBox, lenPx, (g, res) => paintPec(g, res, v)) : null,
    up: U ? unitSprite(keyBase + 'up' + v, U.box, lenPx, (g, res) => paintUpper(g, res, v)) : null,
  });
  const teethSprites = (lenPx) => ({
    up: unitSprite(keyBase + 'tu', teethBox, lenPx, (g, res) => paintTeeth(g, res, true)),
    low: unitSprite(keyBase + 'tl', teethBox, lenPx, (g, res) => paintTeeth(g, res, false)),
  });

  const mlSamples = [];
  for (let i = 0; i <= 10; i++) mlSamples.push(pointOn(mouthLine, i / 10));
  // jaw region polygon (unit space) for the protrusible-jaw backing flesh
  const jawPoly = [];
  for (let i = 0; i <= 10; i++) jawPoly.push(pointOn(mouthLine, i / 10));
  for (let i = 0; i <= 8; i++) {
    const x = F[0] + ((throatX - F[0]) * i) / 8;
    jawPoly.push([x, P.bot(x)]);
  }

  function interior(ctx, len, ang, ox, oy, opts) {
    // gap between the upper mouth line and the dropped jaw (same line rotated about the hinge)
    const c = Math.cos(ang), s = Math.sin(ang);
    const hx = H[0] * len + ox, hy = H[1] * len + oy;
    ctx.beginPath();
    ctx.moveTo(hx - 0.012 * len, hy);
    for (let i = 0; i < mlSamples.length; i++) ctx.lineTo(mlSamples[i][0] * len + ox, mlSamples[i][1] * len - 0.003 * len + oy);
    for (let i = mlSamples.length - 1; i >= 0; i--) {
      const dx = mlSamples[i][0] * len + ox - hx, dy = mlSamples[i][1] * len + oy - hy + 0.004 * len;
      ctx.lineTo(hx + dx * c - dy * s, hy + dx * s + dy * c);
    }
    ctx.closePath();
    if (opts.silhouette || opts.shiny) ctx.fillStyle = liveColor(opts, '', '#4a2c0c');
    else {
      const gr = ctx.createLinearGradient(F[0] * len + ox, F[1] * len + oy, hx - 0.02 * len, hy);
      gr.addColorStop(0, C.gum || '#7a2c34');
      gr.addColorStop(0.35, C.mouth || '#3a0f16');
      gr.addColorStop(1, C.throat || '#0c0406');
      ctx.fillStyle = gr;
    }
    ctx.fill();
  }
  function backing(ctx, len, opts, ox, oy) {
    // fleshy sling between the throat and the protruded jaws: the region the jaw sweeps through
    // (mouth line at rest → front edge → the displaced underside → back to the throat at rest)
    ctx.beginPath();
    const nm = mlSamples.length;
    for (let i = 0; i < nm; i++) ctx.lineTo(mlSamples[i][0] * len, mlSamples[i][1] * len);
    for (let i = nm; i < jawPoly.length; i++) ctx.lineTo(jawPoly[i][0] * len + ox, jawPoly[i][1] * len + oy);
    const last = jawPoly[jawPoly.length - 1];
    ctx.lineTo(last[0] * len, last[1] * len);
    ctx.closePath();
    ctx.fillStyle = liveColor(opts, C.flesh || '#6a2a32', '#7a5520');
    ctx.fill();
  }

  const drawer = {
    bounds: S.bounds,
    mouth: S.anchor,
    spec: S,
    profile: P,
    draw(ctx, len, anim, opts) {
      const pxs = pxsOf(anim, opts);
      const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2400 : S.capPx || 1500);
      const v = variantOf(anim.seed, NV);
      const sp = sprites(lenPx, v);
      const hkT = hookedness(anim);
      const t = anim.t || 0;
      let openT = Math.max(anim.mouth || 0, (M.min || 0) + (M.idle || 0) * (0.5 + 0.5 * Math.sin(t * (M.idleRate || 0.8) + (anim.seed || 0) * 7)));
      if (hkT >= 1) openT = Math.max(openT, 0.55 + 0.35 * Math.sin(t * 6.3 + (anim.uid || 0)));
      if (anim.state === 'bite') openT = Math.max(openT, 0.5);
      if (anim.state === 'jump') openT = Math.max(openT, 0.35);
      // eased per individual: escaping a hook or ending a bite window never snaps the jaw shut
      const E = easeState(anim, S.id, hkT, clamp(openT, 0, 1));
      const hk = E.hk, open = E.open;
      let amp = clamp((anim.amp || 0.5) + hk * 0.35, 0, 1.6);
      if (anim.state === 'icon') amp = Math.min(amp, 0.35);
      // breaching: the tail drives hard (eased, so a breach from a cruise does not pop the tail)
      const jmp = easeState(anim, S.id + 'j', anim.state === 'jump' ? 1 : 0, 0).hk;
      if (jmp > 0.001) amp = amp + (Math.max(amp, 1.25) - amp) * jmp;
      const jawAng = open * (M.open || 0.32);
      const push = M.thrust ? Math.min(1, open * 1.6) : 0;
      const ox = (M.thrust || 0) * push * len, oy = (M.drop || 0) * push * len;
      ctx.save();
      if (hk > 0) {
        const th = hk * (Math.sin(t * 9.3 + (anim.uid || 0)) * 0.045 + Math.sin(t * 15.1) * 0.015);
        ctx.rotate(th);
      }
      if (S.preDraw) S.preDraw(ctx, len, anim, opts, open);
      if (jawAng > 0.004 || push > 0.01) {
        if (push > 0.01) backing(ctx, len, opts, ox, oy);
        interior(ctx, len, jawAng, ox, oy, opts);
        const ts = teethSprites(lenPx);
        blitAbout(ctx, look(ts.low, opts), len, H[0], H[1], jawAng, ox, oy);
        if (!U && !M.bared) blitAbout(ctx, look(ts.up, opts), len, H[0], H[1], 0, ox, oy);
      }
      swimBlit(ctx, look(sp.body, opts), len, anim.phase || 0, amp, swim, pxs);
      blitAbout(ctx, look(sp.jaw, opts), len, H[0], H[1], jawAng, ox, oy);
      // bared teeth: the upper row hangs over the lower lip even with the mouth shut
      if (M.bared && M.teeth) blitAbout(ctx, look(teethSprites(lenPx).up, opts), len, H[0], H[1], 0, 0, 0);
      if (sp.up) {
        if (push > 0.01) blitAbout(ctx, look(teethSprites(lenPx).up, opts), len, H[0], H[1], 0, ox, oy);
        blitAbout(ctx, look(sp.up, opts), len, H[0], H[1], 0, ox, oy);
      }
      if (sp.pec) {
        const fp = pec.pivot || (pec.pts ? pec.pts[0] : pec.parts[0][0]);
        const steer = Math.sin(t * 0.83 + (anim.seed || 0) * 9) * 0.035 + hk * Math.sin(t * 7.7) * 0.09 - (anim.state === 'flee' ? 0.08 : 0);
        blitAbout(ctx, look(sp.pec, opts), len, fp[0], fp[1], steer);
      }
      if (S.postDraw) S.postDraw(ctx, len, anim, opts, open, pxs);
      ctx.restore();
    },
  };
  if (M.thrust && S.anchorRest) {
    // protrusible jaws: the hook point rides with the jaws (same eased opening the drawer used last frame)
    const MA = { x: 0, y: 0 };
    drawer.mouthAt = (a) => {
      const s = peekEase(S.id, a && a.uid);
      const open = s
        ? s.open
        : clamp(Math.max((a && a.mouth) || 0, a && (a.hooked || a.state === 'hooked') ? 0.72 : 0, a && a.state === 'bite' ? 0.5 : 0, M.min || 0), 0, 1);
      const push = Math.min(1, open * 1.6);
      MA.x = S.anchorRest.x + M.thrust * push;
      MA.y = S.anchorRest.y + (M.drop || 0) * push;
      return MA;
    };
  }
  return drawer;
}

/** A row of teeth along a mouth line (hinge → front). upper: point down; else point up. */
export function teethRow(g, res, pts, T, upper, key, C = {}, bared = false) {
  const r = rngFor(key + (upper ? 'tu' : 'tl'));
  const n = upper ? T.n : T.nLow || T.n;
  const from = T.from || 0;
  const jit = T.jitter !== undefined ? T.jitter : 0.3;
  // gum line first (behind the teeth), and only where it can show: inside an open mouth
  if (T.gum !== false && !bared) {
    g.strokeStyle = ca(C.gum || '#9a4a4e', upper ? 0.85 : 0.75);
    g.lineWidth = (T.size || 0.01) * 0.35;
    g.beginPath();
    spline(g, pts.map((p) => [p[0], p[1] + (upper ? -1 : 1) * T.size * 0.12]), true);
    g.stroke();
  }
  for (let i = 0; i < n; i++) {
    const u = 1 - ((i + 0.5) / n) * (1 - from); // front first
    if (T.gaps && i > 1 && r.next() < T.gaps) continue; // a lost tooth here and there
    const p = pointOn(pts, u), p2 = pointOn(pts, Math.max(0, u - 0.01));
    let tx = p[0] - p2[0], ty = p[1] - p2[1];
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl;
    ty /= tl; // tangent toward the front
    const nx = upper ? -ty : ty, ny = upper ? tx : -tx; // normal: down for upper teeth, up for lower
    const sz = (upper ? T.size : T.sizeLow || T.size) * (1 - (T.taper || 0.5) * (1 - u)) * (1 - jit / 2 + r.next() * jit);
    const wd = sz * (T.width || 0.6) * (0.9 + r.next() * 0.2);
    const rake = ((T.rake || 0.15) + (r.next() - 0.5) * jit * 0.4) * sz;
    const bx = p[0] - nx * sz * (bared ? 0.12 : 0.3), by = p[1] - ny * sz * (bared ? 0.12 : 0.3);
    const tipx = p[0] + nx * sz * 0.85 - tx * rake, tipy = p[1] + ny * sz * 0.85 - ty * rake;
    const yellow = r.next() * 0.25;
    const gr = g.createLinearGradient(bx, by, tipx, tipy);
    gr.addColorStop(0, T.root || '#d8c8b0');
    gr.addColorStop(0.5, mixc(T.color || '#f4efe4', '#c8b48a', yellow));
    gr.addColorStop(1, T.tipCol || '#fffdf6');
    g.fillStyle = gr;
    const outline = (q) => {
      q.beginPath();
      if (T.kind === 'awl' || T.kind === 'needle') {
        const cw = T.kind === 'needle' ? 0.25 : 0.35;
        q.moveTo(bx + tx * wd * 0.5, by + ty * wd * 0.5);
        q.quadraticCurveTo(p[0] + nx * sz * 0.4 + tx * wd * cw, p[1] + ny * sz * 0.4 + ty * wd * cw, tipx, tipy);
        q.quadraticCurveTo(p[0] + nx * sz * 0.4 - tx * wd * cw, p[1] + ny * sz * 0.4 - ty * wd * cw, bx - tx * wd * 0.5, by - ty * wd * 0.5);
      } else {
        q.moveTo(bx + tx * wd * 0.5, by + ty * wd * 0.5);
        q.quadraticCurveTo(p[0] + nx * sz * 0.45 + tx * wd * 0.22, p[1] + ny * sz * 0.45 + ty * wd * 0.22, tipx, tipy);
        q.quadraticCurveTo(p[0] + nx * sz * 0.45 - tx * wd * 0.22, p[1] + ny * sz * 0.45 - ty * wd * 0.22, bx - tx * wd * 0.5, by - ty * wd * 0.5);
      }
      q.closePath();
    };
    outline(g);
    g.fill();
    // the half turned away from the light is a little darker → each tooth reads as a blade, not a flat shape
    g.save();
    outline(g);
    g.clip();
    g.fillStyle = 'rgba(70,55,40,0.22)';
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx - tx * wd, by - ty * wd);
    g.lineTo(tipx - tx * wd * 0.5, tipy - ty * wd * 0.5);
    g.lineTo(tipx, tipy);
    g.closePath();
    g.fill();
    g.restore();
    g.strokeStyle = 'rgba(80,62,44,0.3)';
    g.lineWidth = Math.max(0.5 / res, sz * 0.04);
    outline(g);
    g.stroke();
  }
}

function finColors(C, far, which) {
  const base = (which === 'caudal' && C.caudal) || (which === 'pec' && C.pec) || (which === 'd1' && C.d1) || C.fin || C.back;
  if (far) return { base: shade(base, 0.74), mid: shade(base, 0.68), tip: shade(base, 0.6), edge: 'rgba(255,255,255,0.05)' };
  // fins are vertical surfaces, lit like the flank rather than the back: a touch darker toward the tip
  return { base: shade(base, 1.0), mid: shade(base, 0.9), tip: shade(base, 0.72), edge: 'rgba(235,245,255,0.2)' };
}

/** Point at parameter u (0..1) along a polyline of control points (linear between them; fine for short curves). */
export function pointOn(pts, u) {
  const n = pts.length - 1;
  const f = clamp(u, 0, 1) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const k = f - i;
  return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k];
}

export { SIL, mixc };
