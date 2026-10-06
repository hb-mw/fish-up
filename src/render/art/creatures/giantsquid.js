// Giant squid (Architeuthis dux) — side view, mantle tip first (+X). len = mantle tip to arm tips; the two feeding
// tentacles trail far beyond (bounds x0 ≈ −1.08). Slender deep-red mantle with small terminal fins, a dinner-plate
// eye, eight thick sucker-lined arms slowly undulating and two very long clubbed tentacles snaking behind.
import { clamp, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, drawUnitSpriteScaled } from './kit.js';
import { paintSquidBody, paintSquidFin, squidArms, squidTentacle } from './squidkit.js';

const SPEC = {
  tip: 0.5, neck: 0.02, H: 0.07, headX: -0.088, headH: 0.062, eye: [-0.036, -0.012, 0.036],
  finX0: 0.39, finH: 0.07, seed: 1300, chroma: '78,14,12', iris: '#bfbcae',
  skin: ['#c4705c', '#9c3a30', '#4a1212', '#dca08c'],
  paleSkin: ['#c4705c', '#9c3a30', '#4a1212', '#dca08c'],
};
const BODY = { x0: -0.11, x1: 0.52, y0: -0.09, y1: 0.09 };
const FIN = { x0: 0.37, x1: 0.53, y0: -0.08, y1: 0.08 };
const PAL = palette({
  arm: '#a3463a', armFar: '#6a2620', armHi: ['#f2b4a0', 0.4], sucker: ['#f0c4b0', 0.6], tent: '#8e3830',
  shade: ['#4a1210', 0.4],
});
const ARMS = { x0: -0.055, y0: 0.004, crownH: 0.034, L: 0.5, w0: 0.058, spread: 0.3, wave: 0.11, wave2: 0.3, hooked: 0, n: 14 };
const TENT = { x0: -0.055, y0: 0.0, crownH: 0.03, TL: 0.99, tw: 0.009, cw: 0.026, twave: 0.32, hooked: 0 };

export const DRAWERS = {
  giant_squid: {
    bounds: { x0: -1.1, x1: 0.54, y0: -0.24, y1: 0.24 },
    mouth: { x: -0.12, y: 0.0 },
    draw(ctx, len, anim, opts) {
      const P = PAL[modeOf(opts)];
      const lenPx = len * (opts.pxScale || 1);
      const card = opts.detail === 'card';
      const body = variant(unitSprite('gs_body', BODY, lenPx, (g, r) => paintSquidBody(g, r, SPEC, 0)), opts);
      const fin = variant(unitSprite('gs_fin', FIN, lenPx, (g, r) => paintSquidFin(g, r, SPEC, 0)), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const h = easePose(anim, 0, hooked ? 1 : 0, 3);
      const c = Math.pow(0.5 + 0.5 * Math.sin(anim.phase), 2);
      ARMS.hooked = h * 0.8;
      TENT.hooked = h;
      ARMS.fill = P.arm;
      ARMS.fillFar = P.armFar;
      ARMS.hi = P.armHi;
      ARMS.shade = P.shade;
      ARMS.sucker = lenPx > 140 || card ? P.sucker : null;
      TENT.tfill = P.tent;
      TENT.sucker = P.sucker;
      // the crown slowly opens and closes as the mantle pulses
      ARMS.spread = 0.26 + 0.08 * (1 - c) + 0.05 * Math.sin(anim.t * 0.4) + h * 0.25;
      ARMS.wave = 0.1 + 0.05 * clamp(anim.amp, 0, 1.5);
      ctx.save();
      squidTentacle(ctx, len, anim, TENT, -1);
      squidArms(ctx, len, anim, ARMS, 0, 8, true);
      squidTentacle(ctx, len, anim, TENT, 1);
      squidArms(ctx, len, anim, ARMS, 1, 6, false);
      ctx.save();
      ctx.scale(1, 0.7 + 0.3 * Math.sin(anim.phase * 1.1 + 0.4));
      drawUnitSprite(ctx, fin, len);
      ctx.restore();
      drawUnitSpriteScaled(ctx, body, len, 1, 1 - 0.05 * c, 0, 0);
      ctx.restore();
    },
  },
};
