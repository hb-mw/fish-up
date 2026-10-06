// Giant manta — the wing-beat showpiece. Each wing is a planform sprite cut into span strips; every frame the
// strips are placed by a 3D bending model (dihedral grows toward the tip, tip lags the root) and projected for a
// camera ELEV above the horizon. A strip whose projected height flips sign shows the wing's white underside.
// Draw order: far wing → rigid body (head, lobes, tail with a gentle sway) → near wing.
import { unitSprite, variantFor } from '../common.js';
import { clamp, variantOf, pxsOf, swimBlit, liveColor } from './kit.js';
import { rayMotion } from './ray-motion.js';
import { SIN_E, COS_E, ROOT, HALF, WING_BOX, BODY_BOX, paintWingTop, paintWingBottom, paintWingSheen, paintBody } from './ray-manta-paint.js';

const NS = 14; // strips per half: one rigid strip over the body, then the bending wing
const YAW = 0.2; // the near wing swings slightly forward → the span reads wider on screen
const SIN_Y = Math.sin(YAW);
const ZB = new Float32Array(NS + 1); // planform z of the strip boundaries (denser toward the tip, where it bends most)
ZB[0] = ROOT;
for (let i = 1; i <= NS; i++) ZB[i] = HALF + (0.5 - HALF) * (1 - Math.pow(1 - (i - 1) / (NS - 1), 1.25));
const SX = new Float32Array(NS + 1), SY = new Float32Array(NS + 1), TH = new Float32Array(NS + 1);
// half-vector between the light (straight down from the surface) and the camera, as an angle: a dorsal strip
// glints when its tilt brings its normal onto it
const SPEC = Math.atan2(COS_E, 1 + SIN_E);
const TAIL_SWIM = { rigid: -0.17, tail: -0.5, swing: 0.045, waves: 0.55, power: 1.5, squash: 0, strips: 8, stripPx: 20 };

/** Place one wing's strip boundaries (unit space) for this frame. sigma: +1 near wing, −1 far wing. */
function pose(phase, A0, A1, lag, bias, sigma) {
  let y = 0, z = ROOT;
  SX[0] = sigma * z * SIN_Y;
  SY[0] = sigma * z * SIN_E;
  for (let i = 1; i <= NS; i++) {
    const s = Math.max(0, ((ZB[i - 1] + ZB[i]) * 0.5 - HALF) / (0.5 - HALF));
    const th = i === 1 ? 0 : bias + (A0 + (A1 - A0) * Math.pow(s, 1.05)) * Math.sin(phase - lag * s);
    TH[i] = th;
    const dz = ZB[i] - ZB[i - 1];
    y += Math.sin(th) * dz;
    z += Math.cos(th) * dz;
    SX[i] = sigma * z * SIN_Y;
    SY[i] = sigma * z * SIN_E - y * COS_E;
  }
}

/** Draw the posed wing: each strip of the planform sprite gets its own shear/scale (flipping → underside). */
function drawWing(ctx, top, bot, sheen, len, sigma) {
  const b = WING_BOX, res = top.res, pad = top.pad;
  const cw = top.canvas.width;
  const a = len / res;
  const ex0 = (b.x0 - pad / res) * len;
  for (let i = 0; i < NS; i++) {
    const r0 = (ZB[i] - b.y0) * res + pad, r1 = (ZB[i + 1] - b.y0) * res + pad;
    const dr = r1 - r0;
    const dsy = (SY[i + 1] - SY[i]) * len, dsx = (SX[i + 1] - SX[i]) * len;
    const under = dsy * sigma < 0;
    const spr = under ? bot : top;
    const c = dsx / dr, d = dsy / dr;
    ctx.save();
    ctx.transform(a, 0, c, d, ex0 + SX[i] * len - c * r0, SY[i] * len - d * r0);
    const ext = i < NS - 1 ? 1.5 : 0;
    ctx.drawImage(spr.canvas, 0, r0, cw, dr + ext, 0, r0, cw, dr + ext);
    if (sheen && !under) {
      // near wing glints on the downstroke, far wing on the upstroke
      const k = Math.cos(TH[i + 1] * sigma + SPEC);
      const al = k > 0.8 ? Math.pow((k - 0.8) / 0.2, 1.6) * 0.4 : 0;
      if (al > 0.03) {
        ctx.globalAlpha *= al;
        ctx.drawImage(sheen.canvas, 0, r0, cw, dr + ext, 0, r0, cw, dr + ext);
      }
    }
    ctx.restore();
  }
}

function mouthOpen(ctx, len, open, opts) {
  // feeding gape: a dark rectangular mouth opening across the front of the head
  const ny = HALF * SIN_E;
  ctx.beginPath();
  ctx.moveTo(0.204 * len, (-ny + 0.006) * len);
  ctx.quadraticCurveTo((0.226 + open * 0.012) * len, 0.004 * len, 0.206 * len, (ny + 0.016 + open * 0.016) * len);
  ctx.lineTo((0.192 - open * 0.004) * len, (ny + 0.01 + open * 0.012) * len);
  ctx.quadraticCurveTo((0.208 + open * 0.01) * len, 0.004 * len, 0.193 * len, (-ny + 0.008) * len);
  ctx.closePath();
  ctx.fillStyle = liveColor(opts, '#08090b', '#3a2a10');
  ctx.fill();
}

export const manta_ray = {
  // wing extents over a full beat (computed from the bending model): cruise ±0.44, hooked ±0.46
  bounds: { x0: -0.515, x1: 0.31, y0: -0.47, y1: 0.46 },
  mouth: { x: 0.212, y: 0.012 },
  // portrait fit: extent of the gentler icon-pose beat (the 3/4 view keeps the span tall even at rest)
  iconBounds: { x0: -0.505, x1: 0.285, y0: -0.42, y1: 0.38 },
  draw(ctx, len, anim, opts) {
    const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2000 : 1100);
    const v = variantOf(anim.seed, 3);
    const lift = opts.shiny && !opts.silhouette ? 1 : 0; // shiny gold needs a paler base than black skin
    const k = 'manta:' + v + (lift ? 'L' : '');
    const top = variantFor(unitSprite(k + 'top', WING_BOX, lenPx, (g, res) => paintWingTop(g, res, v, lift)), opts);
    const bot = variantFor(unitSprite(k + 'bot', WING_BOX, lenPx, (g, res) => paintWingBottom(g, res, v, lift)), opts);
    const body = variantFor(unitSprite(k + 'body', BODY_BOX, lenPx, (g, res) => paintBody(g, res, v, lift)), opts);
    const sheen = opts.silhouette ? null : unitSprite('manta:sheen', WING_BOX, lenPx, (g, res) => paintWingSheen(g, res));
    const t = anim.t || 0;
    const amp = clamp(anim.amp === undefined ? 0.5 : anim.amp, 0, 1.6);
    const icon = anim.state === 'icon';
    // slow, majestic strokes; frantic when hooked (phase + hookedness integrated per individual: no pops)
    const m = rayMotion(anim, 0.5, 3.2);
    const hk = m.hk, phase = m.ph;
    let A1 = icon ? 0.38 : 0.56 + 0.3 * Math.min(amp, 1.2);
    A1 += hk * 0.3;
    const A0 = (icon ? 0.1 : 0.16) + hk * 0.08;
    const lag = 1.15, bias = 0.07;
    const bob = Math.sin(phase - 1.4) * (0.006 + hk * 0.01) * len;
    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(Math.cos(phase - 0.6) * 0.025 + hk * Math.sin(t * 7.1) * 0.05);
    pose(phase, A0, A1, lag, bias, -1);
    drawWing(ctx, top, bot, sheen, len, -1);
    swimBlit(ctx, body, len, t * 2.1 + (anim.uid || 0), 0.35 + amp * 0.3 + hk * 0.6, TAIL_SWIM, pxsOf(anim, opts));
    const open = Math.max(anim.mouth || 0, hk * 0.8, anim.state === 'bite' ? 0.7 : 0);
    if (open > 0.05) mouthOpen(ctx, len, open, opts);
    pose(phase, A0, A1, lag, bias, 1);
    drawWing(ctx, top, bot, sheen, len, 1);
    ctx.restore();
  },
};

