// Green moray (Gymnothorax funebris): a thick, muscular, mucus-sheened green-yellow ribbon with a continuous
// dorsal fin, a small pale eye and a mouth that gapes rhythmically to pump water over the gills.
import { unitSprite, variantFor, paintEye } from '../common.js';
import { TAU, clamp, spline, makeProfile, band, soft, softStroke, clipTo, texture, lod, variantOf, pxsOf, hookedness, liveColor, ca, rngFor, easeState } from './kit.js';
import { teethRow, pointOn } from './shark.js';
import { makeSpine, layoutSpine, drawSpine, enterHead, leaveHead } from './eel-spine.js';

const TOP = [
  [0.5, 0.004], [0.494, -0.013], [0.48, -0.026], [0.455, -0.037], [0.42, -0.045], [0.37, -0.048], [0.3, -0.047], [0.2, -0.045],
  [0.1, -0.042], [0, -0.038], [-0.1, -0.033], [-0.2, -0.027], [-0.3, -0.02], [-0.38, -0.013], [-0.44, -0.007], [-0.475, -0.002],
];
const BOT = [
  [0.5, 0.004], [0.496, 0.017], [0.484, 0.03], [0.46, 0.04], [0.42, 0.047], [0.37, 0.051], [0.3, 0.05], [0.2, 0.047],
  [0.1, 0.043], [0, 0.038], [-0.1, 0.032], [-0.2, 0.025], [-0.3, 0.018], [-0.38, 0.011], [-0.44, 0.006], [-0.475, 0.002],
];
const P = makeProfile(TOP, BOT);
const C = { back: '#3b5418', top: '#5d7d24', side: '#6f8f2a', belly: '#b6c24f', fin: '#47621c', anal: '#7f9a34', gum: '#a35a62', mouth: '#4a1c22', throat: '#120607' };
const H = [0.405, 0.022], F = [0.497, 0.011];
const MOUTH = [[0.405, 0.022], [0.43, 0.0205], [0.458, 0.0175], [0.482, 0.0145], [0.497, 0.011]];
const THROAT = 0.4065; // rear edge of the jaw piece at the hinge: rotating only swings it back over the body
const BOX = { x0: -0.51, x1: 0.51, y0: -0.07, y1: 0.06 };
const JAWBOX = { x0: 0.36, x1: 0.52, y0: -0.01, y1: 0.06 };
const TEETHBOX = { x0: 0.37, x1: 0.52, y0: -0.02, y1: 0.05 };
const TEETH = { kind: 'needle', n: 13, size: 0.0085, width: 0.38, taper: 0.45, rake: 0.35, nLow: 11, sizeLow: 0.0075, color: '#f2efe4', root: '#cbbfa8', gum: false };
const SWIM = { xh: 0.32, tail: -0.515, waves: 1.25, swing: 0.055, head: 0.1, power: 1.15, stripPx: 7, maxStrips: 44 };

// one continuous fin fold: dorsal fin from just behind the head, round the tail tip, anal fin back to mid-body
const ramp = (x, a, b) => { const k = clamp((a - x) / (a - b), 0, 1); return k * k * (3 - 2 * k); };
const finH = (x) => ramp(x, 0.335, 0.27) * (0.0095 + 0.005 * Math.sin(clamp((0.33 - x) / 0.8, 0, 1) * Math.PI * 0.85));
const analH = (x) => ramp(x, -0.02, -0.08) * (0.0085 + 0.004 * Math.sin(clamp((-0.02 - x) / 0.45, 0, 1) * Math.PI * 0.85));
function finFold(q, inset = 0) {
  const n = 44;
  for (let i = 0; i <= n; i++) {
    const x = 0.335 + ((-0.47 - 0.335) * i) / n;
    q[i ? 'lineTo' : 'moveTo'](x, P.top(x) - finH(x) * (1 - inset) + (i === 0 ? 0.006 : 0));
  }
  q.bezierCurveTo(-0.488, -0.01 * (1 - inset), -0.505, -0.002, -0.508, 0.002);
  q.bezierCurveTo(-0.505, 0.006, -0.488, 0.011 * (1 - inset), -0.47, P.bot(-0.47) + analH(-0.47) * (1 - inset));
  for (let i = 0; i <= n; i++) {
    const x = -0.47 + ((-0.02 + 0.47) * i) / n;
    q.lineTo(x, P.bot(x) + analH(x) * (1 - inset) - (i === n ? 0.006 : 0));
  }
  q.lineTo(-0.02, 0);
  q.lineTo(0.335, 0);
  q.closePath();
}
function jawRegion(q, grow) {
  spline(q, MOUTH.slice().reverse().map((p) => [p[0], p[1] - grow]), true);
  q.lineTo(THROAT - grow, H[1] - grow);
  for (let i = 0; i <= 12; i++) {
    const x = THROAT - grow + ((F[0] + 0.01 - THROAT + grow) * i) / 12;
    q.lineTo(x, P.bot(x) + 0.01);
  }
  q.closePath();
}

function paintSkin(g, res, v) {
  const L = lod(res);
  const xa = 0.52, xb = -0.52;
  g.fillStyle = C.belly;
  g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
  // olive back → green flank → yellow belly; lit from above, mucus-glossy
  soft(g, res, 0.02, C.side, (q) => band(q, P, xa, xb, -0.5, 0.72));
  soft(g, res, 0.022, C.back, (q) => band(q, P, xa, xb, -0.5, 0.36));
  soft(g, res, 0.015, ca(C.top, 0.55), (q) => band(q, P, xa, xb, -0.5, 0.12));
  soft(g, res, 0.02, 'rgba(60,70,20,0.35)', (q) => band(q, P, xa, xb, 0.86, 1.3));
  // a little warmer and yellower around the head (the mucus is thickest there)
  soft(g, res, 0.04, 'rgba(196,196,70,0.22)', (q) => q.ellipse(0.43, 0.01, 0.08, 0.035, 0, 0, TAU));
  const r = rngFor('moray' + v);
  // faint darker speckling and blotches (low contrast: the green moray is near-uniform)
  if (L >= 1) {
    g.fillStyle = 'rgba(34,46,12,0.09)';
    for (let i = 0; i < 40; i++) {
      const x = 0.4 - r.next() * 0.86, f = r.next();
      g.beginPath();
      g.ellipse(x, P.at(x, f * 0.8 + 0.05), 0.002 + r.next() * 0.003, 0.0015 + r.next() * 0.002, 0, 0, TAU);
      g.fill();
    }
  }
  texture(g, 'mottle', 0.3, 0.22, BOX);
  if (L >= 2) texture(g, 'grain', 0.03, 0.12, BOX);
  // mucus sheen: broad soft band + crisp specular streak along the upper flank
  soft(g, res, 0.012, 'rgba(240,250,190,0.28)', (q) => band(q, P, 0.46, -0.42, 0.14, 0.34));
  soft(g, res, 0.004, 'rgba(255,255,235,0.55)', (q) => band(q, P, 0.44, -0.3, 0.2, 0.245));
  soft(g, res, 0.003, 'rgba(255,255,230,0.35)', (q) => band(q, P, 0.47, 0.36, 0.08, 0.13));
  // gentle muscle bands (myomeres) catching the light
  if (L >= 1) {
    for (let x = 0.28; x > -0.4; x -= 0.034) {
      softStroke(g, res, 0.006, 'rgba(30,44,10,0.08)', 0.004, (q) => {
        q.moveTo(x, P.at(x, 0.1));
        q.quadraticCurveTo(x - 0.012, P.at(x, 0.5), x, P.at(x, 0.9));
      });
    }
  }
}

function paintBody(g, res, v) {
  // the fin fold: thick-skinned, body-coloured, darkening toward a translucent margin
  g.save();
  g.beginPath();
  finFold(g);
  const fg = g.createLinearGradient(0, -0.06, 0, 0.06);
  fg.addColorStop(0, C.fin);
  fg.addColorStop(0.45, C.back);
  fg.addColorStop(0.55, C.anal);
  fg.addColorStop(1, C.anal);
  g.fillStyle = fg;
  g.fill();
  g.clip();
  softStroke(g, res, 0.003, 'rgba(24,34,8,0.55)', 0.004, (q) => finFold(q));
  texture(g, 'mottle', 0.3, 0.18, BOX);
  g.restore();
  clipTo(g, (q) => P.outline(q), () => {
    paintSkin(g, res, v);
    // gill opening: a small dark round hole behind the head
    soft(g, res, 0.0025, 'rgba(14,20,6,0.62)', (q) => q.ellipse(0.345, 0.012, 0.0038, 0.003, 0.5, 0, TAU));
    soft(g, res, 0.002, 'rgba(240,250,180,0.3)', (q) => q.ellipse(0.341, 0.0155, 0.003, 0.0014, 0.5, 0, TAU));
    // neck folds
    for (let i = 0; i < 3; i++) {
      softStroke(g, res, 0.004, 'rgba(26,36,8,0.16)', 0.0025, (q) => {
        const x = 0.385 - i * 0.012;
        q.moveTo(x, P.at(x, 0.05));
        q.quadraticCurveTo(x - 0.008, P.at(x, 0.35), x - 0.002, P.at(x, 0.62));
      });
    }
    // upper lip edge, nostrils (front tube + rear pore), the eye
    softStroke(g, res, 0.0018, 'rgba(24,30,8,0.45)', 0.0026, (q) => spline(q, MOUTH.map((p) => [p[0], p[1] - 0.0016]), true));
    softStroke(g, res, 0.0012, 'rgba(26,34,10,0.7)', 0.0034, (q) => {
      q.moveTo(0.489, -0.006);
      q.lineTo(0.499, -0.012);
    });
    soft(g, res, 0.001, 'rgba(20,26,8,0.6)', (q) => q.ellipse(0.468, -0.025, 0.002, 0.0015, 0, 0, TAU));
    soft(g, res, 0.005, 'rgba(30,40,10,0.45)', (q) => q.ellipse(0.455, -0.013, 0.0085, 0.007, 0, 0, TAU));
    paintEye(g, 0.455, -0.013, 0.0046, { iris: '#c9c78a', irisDark: '#6d6c3c', pupil: 0.56, ring: 'rgba(26,30,10,0.7)', look: { x: 0.45, y: 0.15 } });
    // sensory pores along the jaws (big renders)
    if (lod(res) >= 2) {
      g.fillStyle = 'rgba(250,250,220,0.45)';
      for (let i = 0; i < 6; i++) {
        const p = pointOn(MOUTH, 0.15 + i * 0.15);
        g.beginPath();
        g.arc(p[0], p[1] - 0.006, 0.0011, 0, TAU);
        g.fill();
      }
    }
    softStroke(g, res, 0.005, 'rgba(20,30,8,0.25)', 0.005, (q) => P.outline(q));
  });
  g.save();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath();
  jawRegion(g, 0);
  g.fill();
  g.restore();
}

function paintJaw(g, res, v) {
  clipTo(g, (q) => jawRegion(q, 0.004), () => {
    clipTo(g, (q) => P.outline(q), () => {
      paintSkin(g, res, v);
      if (lod(res) >= 2) {
        g.fillStyle = 'rgba(250,250,220,0.45)';
        for (let i = 0; i < 5; i++) {
          const p = pointOn(MOUTH, 0.2 + i * 0.16);
          g.beginPath();
          g.arc(p[0], p[1] + 0.008, 0.0011, 0, TAU);
          g.fill();
        }
      }
      softStroke(g, res, 0.005, 'rgba(20,30,8,0.25)', 0.005, (q) => P.outline(q));
    });
    softStroke(g, res, 0.0015, 'rgba(20,24,6,0.55)', 0.003, (q) => spline(q, MOUTH, true));
  });
}

const spine = makeSpine();
const ML = [];
for (let i = 0; i <= 10; i++) ML.push(pointOn(MOUTH, i / 10));

let innerGrad = null;
function interior(ctx, len, ang, opts) {
  // built in unit space so the gradient is created once and reused every frame
  const c = Math.cos(ang), s = Math.sin(ang), hx = H[0], hy = H[1];
  ctx.save();
  ctx.scale(len, len);
  ctx.beginPath();
  ctx.moveTo(hx - 0.012, hy);
  for (const p of ML) ctx.lineTo(p[0], p[1] - 0.003);
  for (let i = ML.length - 1; i >= 0; i--) {
    const dx = ML[i][0] - hx, dy = ML[i][1] - hy + 0.004;
    ctx.lineTo(hx + dx * c - dy * s, hy + dx * s + dy * c);
  }
  ctx.closePath();
  if (opts.silhouette || opts.shiny) ctx.fillStyle = liveColor(opts, '', '#5a3a12');
  else {
    if (!innerGrad) {
      innerGrad = ctx.createLinearGradient(F[0], 0, hx - 0.02, 0);
      innerGrad.addColorStop(0, C.gum);
      innerGrad.addColorStop(0.4, C.mouth);
      innerGrad.addColorStop(1, C.throat);
    }
    ctx.fillStyle = innerGrad;
  }
  ctx.fill();
  ctx.restore();
}

export const moray_eel = {
  bounds: { x0: -0.515, x1: 0.505, y0: -0.16, y1: 0.16 },
  mouth: { x: 0.47, y: 0.02 },
  draw(ctx, len, anim, opts) {
    ctx.save();
    try {
      moray_eel.drawImpl(ctx, len, anim, opts);
    } finally {
      ctx.restore();
    }
  },
  drawImpl(ctx, len, anim, opts) {
    const pxs = pxsOf(anim, opts);
    const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2400 : 1400);
    const v = variantOf(anim.seed, 2);
    const body = unitSprite('moray:body' + v, BOX, lenPx, (g, res) => paintBody(g, res, v));
    const jaw = unitSprite('moray:jaw' + v, JAWBOX, lenPx, (g, res) => paintJaw(g, res, v));
    const hkT = hookedness(anim);
    const t = anim.t || 0, seed = anim.seed || 0;
    const icon = anim.state === 'icon';
    // breathing: the jaw pumps open and shut every couple of seconds; snapping when hooked
    const br = Math.pow(0.5 - 0.5 * Math.cos(t * 2.4 + seed * 6), 1.4);
    let openT = Math.max(anim.mouth || 0, 0.06 + 0.42 * br);
    if (hkT >= 1) openT = Math.max(openT, 0.55 + 0.45 * Math.sin(t * 9.5 + (anim.uid || 0)));
    if (anim.state === 'bite') openT = Math.max(openT, 0.7);
    // eased per individual so escaping the hook / ending a bite never snaps the jaw or the coil
    const E = easeState(anim, 'moray', hkT, clamp(openT, 0, 1));
    const hk = E.hk;
    const jawAng = E.open * 0.46;
    let amp = clamp((anim.amp || 0.5) * 0.85 + 0.25 + hk * 0.6, 0, 1.6);
    if (icon) amp = 0.35;
    SWIM.harm = hk * 0.3;
    SWIM.swing = 0.055 + hk * 0.028;
    SWIM.stripPx = hk > 0.05 ? 6 : 9;
    SWIM.maxStrips = hk > 0.05 ? 60 : 44;
    layoutSpine(spine, len, (anim.phase || 0) * 0.8, amp, SWIM, pxs);
    if (hk > 0) ctx.rotate(Math.sin(t * 11.3) * 0.05 * hk);
    if (jawAng > 0.01) {
      const tu = unitSprite('moray:tu', TEETHBOX, lenPx, (g, res) => teethRow(g, res, MOUTH, TEETH, true, 'moray'));
      const tl = unitSprite('moray:tl', TEETHBOX, lenPx, (g, res) => teethRow(g, res, MOUTH, TEETH, false, 'moray'));
      enterHead(ctx, spine);
      interior(ctx, len, jawAng, opts);
      blitRot(ctx, variantFor(tl, opts), len, jawAng);
      blitRot(ctx, variantFor(tu, opts), len, 0);
      leaveHead(ctx);
    }
    drawSpine(ctx, variantFor(body, opts), spine, pxs);
    enterHead(ctx, spine);
    blitRot(ctx, variantFor(jaw, opts), len, jawAng);
    leaveHead(ctx);
  },
};

function blitRot(ctx, spr, len, ang) {
  ctx.save();
  ctx.translate(H[0] * len, H[1] * len);
  if (ang) ctx.rotate(ang);
  ctx.translate(-H[0] * len, -H[1] * len);
  const b = spr.box, s = len / spr.res;
  ctx.drawImage(spr.canvas, b.x0 * len - spr.pad * s, b.y0 * len - spr.pad * s, spr.canvas.width * s, spr.canvas.height * s);
  ctx.restore();
}
