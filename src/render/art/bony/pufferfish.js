// Porcupine pufferfish (Diodon holocanthus) — hand-rolled drawer: the body is cached at 6 inflation levels and the
// two neighbouring levels are cross-faded, so it balloons smoothly into a spiky ball when hooked or fleeing.
import { TAU, clamp } from '../../../core/math.js';
import { unitSprite, drawUnitSprite, variantFor } from '../common.js';
import { makeStore, ease, blitSwim, WAVE, waveX, waveY, variantOf } from './rig.js';
import { paintPuffer, paintPec, boxAt } from './pufferfish-paint.js';

const LEVELS = 6, NVAR = 2;
const BOXES = [], KEYS = [], PAINTS = [];
for (let i = 0; i < LEVELS; i++) {
  const f = i / (LEVELS - 1);
  BOXES.push(boxAt(f));
  for (let v = 0; v < NVAR; v++) {
    KEYS.push(`pufferfish/L${i}v${v}`);
    PAINTS.push((g, res) => paintPuffer(g, res, f, v));
  }
}
const PEC = [0.215, 0.04];
const PEC_BOX = { x0: 0.06, x1: 0.24, y0: -0.02, y1: 0.13 };
const store = makeStore(() => ({ t: 0, dt: 0, fresh: true, hook: 0, f: 0 }));

function draw(ctx, len, anim, opts) {
  const pxs = opts.pxScale || 1, lenPx = len * pxs;
  const st = store(anim);
  const hooked = anim.hooked || anim.state === 'hooked';
  const puff = hooked || anim.state === 'flee' ? 1 : 0;
  const f = ease(st, 'f', puff, puff ? 6.5 : 1.7);
  const hk = ease(st, 'hook', hooked ? 1 : 0, hooked ? 8 : 3);
  const v = variantOf(anim.seed, NVAR);
  const fl = f * (LEVELS - 1);
  let i = Math.floor(fl);
  let frac = fl - i;
  if (i >= LEVELS - 1) {
    i = LEVELS - 1;
    frac = 0;
  }
  const amp = clamp(anim.amp, 0, 1.6);
  const turn = Math.abs(anim.turn), tk = 0.3 + 0.7 * (turn > 1 ? 1 : turn);
  const w = WAVE;
  w.phase = anim.phase * 0.9;
  w.k = 1.0 * TAU;
  w.head = 0.1;
  w.power = 1.8;
  w.swing = 0.042 * len * (amp * (1 + 0.4 * hk) + 0.06) * tk * (1 - 0.85 * f);
  w.sq = 0.015 * len * (amp > 1.2 ? 1.2 : amp) * tk * (1 - f);
  if (hk > 0.01) {
    w.swing2 = 0.02 * len * hk * tk;
    w.phase2 = anim.t * 21 + anim.uid;
    w.k2 = w.k * 0.7;
  } else w.swing2 = 0;
  const card = opts.detail === 'card';
  const n = card ? 14 : lenPx > 300 ? 10 : 7;
  const ov = 0.9 / (pxs * (turn < 0.25 ? 0.25 : turn > 1 ? 1 : turn));

  ctx.save();
  if (hk > 0.01) ctx.rotate(Math.sin(anim.t * 11 + anim.uid) * 0.05 * hk);
  // the body: level i, then level i+1 faded in
  const a = variantFor(unitSprite(KEYS[i * NVAR + v], BOXES[i], lenPx, PAINTS[i * NVAR + v]), opts);
  blitSwim(ctx, a, len, w, n, ov);
  if (frac > 0.015) {
    const b = variantFor(unitSprite(KEYS[(i + 1) * NVAR + v], BOXES[i + 1], lenPx, PAINTS[(i + 1) * NVAR + v]), opts);
    const ga = ctx.globalAlpha;
    ctx.globalAlpha = ga * frac;
    blitSwim(ctx, b, len, w, n, ov);
    ctx.globalAlpha = ga;
  }
  // pectoral fan: quick fluttering sculls, faster when puffed up or hooked
  const pec = variantFor(unitSprite('pufferfish/pec', PEC_BOX, lenPx, paintPec), opts);
  const rate = 5.5 + 4 * f + 6 * hk;
  const ph = anim.t * rate + anim.uid * 1.3;
  const rot = 0.12 + 0.28 * Math.sin(ph) * (0.6 + 0.4 * amp);
  const sx = 1 - 0.3 * (0.5 + 0.5 * Math.cos(ph + 0.9));
  const px = PEC[0] * len + waveX(w, PEC[0]), py = (PEC[1] + 0.03 * f) * len + waveY(w, PEC[0]);
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(rot);
  ctx.scale(sx, 1);
  ctx.translate(-PEC[0] * len, -PEC[1] * len);
  drawUnitSprite(ctx, pec, len);
  ctx.restore();
  ctx.restore();
}

export const def = {
  id: 'pufferfish',
  draw,
  bounds: { x0: -0.5, x1: 0.56, y0: -0.44, y1: 0.47 },
  mouth: { x: 0.49, y: 0.02 },
};
