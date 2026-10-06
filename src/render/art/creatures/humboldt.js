// Humboldt squid (Dosidicus gigas), the "red devil" — side view, mantle tip first (+X); len = mantle tip to arm tips.
// Muscular torpedo mantle with big rhomboid fins at the tip, eight stout arms and two clubbed tentacles trailing.
// It talks by flashing: a pale copy of the body sprite is cross-faded in bursts (rapid when hooked); the glow pass
// pulses red/white with it.
import { clamp, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, drawUnitSpriteScaled, glowK, glowDot, glow } from './kit.js';
import { paintSquidBody, paintSquidFin, squidArms, squidTentacle } from './squidkit.js';

const SPEC = {
  tip: 0.5, neck: 0.0, H: 0.085, headX: -0.105, headH: 0.07, eye: [-0.048, -0.016, 0.03],
  finX0: 0.27, finH: 0.155, seed: 77, chroma: '96,14,14', iris: '#d8c48a',
  skin: ['#cf4c3c', '#a22e28', '#5a1212', '#de8070'],
  paleSkin: ['#fff4ee', '#f4d2c8', '#d8a096', '#fffaf6'],
};
const BODY = { x0: -0.13, x1: 0.52, y0: -0.11, y1: 0.11 };
const FIN = { x0: 0.25, x1: 0.53, y0: -0.17, y1: 0.17 };
const PAL = palette({ arm: '#a8322c', armFar: '#74201c', armHi: ['#f0a090', 0.45], sucker: ['#f2c8b8', 0.8], tent: '#962a26' });
const ARMS = { x0: -0.075, y0: 0.004, crownH: 0.03, L: 0.4, w0: 0.045, spread: 0.3, wave: 0.12, wave2: 0.12, hooked: 0, n: 11 };
const TENT = { x0: -0.075, y0: 0.0, crownH: 0.03, TL: 0.55, tw: 0.009, cw: 0.02, twave: 0.16, hooked: 0 };

/** 0..1 chromatophore flash: bursts of signalling, frantic strobing when hooked. */
function flashOf(anim, h) {
  const s = anim.seed * 9;
  const calm = Math.pow(Math.max(0, Math.sin(anim.t * 1.7 + s)), 7) + 0.6 * Math.pow(Math.max(0, Math.sin(anim.t * 4.1 + s * 0.7)), 14);
  const strobe = 0.5 + 0.5 * Math.sin(anim.t * 13 + s);
  return clamp(calm * (1 - h) + strobe * h, 0, 1);
}

export const DRAWERS = {
  humboldt_squid: {
    bounds: { x0: -0.74, x1: 0.54, y0: -0.2, y1: 0.2 },
    mouth: { x: -0.16, y: 0.0 },
    draw(ctx, len, anim, opts) {
      const mode = modeOf(opts);
      const P = PAL[mode];
      const lenPx = len * (opts.pxScale || 1);
      const card = opts.detail === 'card';
      const body = variant(unitSprite('hs_body', BODY, lenPx, (g, r) => paintSquidBody(g, r, SPEC, 0)), opts);
      const fin = variant(unitSprite('hs_fin', FIN, lenPx, (g, r) => paintSquidFin(g, r, SPEC, 0)), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const h = easePose(anim, 0, hooked ? 1 : 0, 4);
      const f = mode === 0 ? flashOf(anim, h) : 0;
      const c = Math.pow(0.5 + 0.5 * Math.sin(anim.phase), 2); // mantle contraction (jet)
      ARMS.hooked = TENT.hooked = h;
      ARMS.fill = P.arm;
      ARMS.fillFar = P.armFar;
      ARMS.hi = P.armHi;
      ARMS.sucker = card || lenPx > 150 ? P.sucker : null;
      TENT.tfill = P.tent;
      TENT.sucker = card ? P.sucker : null;
      ARMS.spread = 0.3 + 0.12 * (1 - c) + h * 0.2;
      ctx.save();
      squidTentacle(ctx, len, anim, TENT, -1);
      squidArms(ctx, len, anim, ARMS, 0, 8, true);
      squidTentacle(ctx, len, anim, TENT, 1);
      squidArms(ctx, len, anim, ARMS, 2, 4, false);
      // fins undulate: their apparent height swings as they beat
      ctx.save();
      ctx.scale(1, 0.72 + 0.28 * Math.sin(anim.phase * 1.3 + 0.5));
      drawUnitSprite(ctx, fin, len);
      if (f > 0.02) {
        ctx.globalAlpha *= f;
        drawUnitSprite(ctx, unitSprite('hs_finP', FIN, lenPx, (g, r) => paintSquidFin(g, r, SPEC, 1)), len);
      }
      ctx.restore();
      const sy = 1 - 0.07 * c;
      drawUnitSpriteScaled(ctx, body, len, 1, sy, 0, 0);
      if (f > 0.02) {
        ctx.globalAlpha *= f;
        drawUnitSpriteScaled(ctx, unitSprite('hs_bodyP', BODY, lenPx, (g, r) => paintSquidBody(g, r, SPEC, 1)), len, 1, sy, 0, 0);
      }
      ctx.restore();
    },
    drawGlow(ctx, len, anim, opts) {
      const k = glowK(opts);
      const h = easePose(anim, 0, anim.state === 'hooked' || anim.state === 'landed' ? 1 : 0, 4);
      const f = flashOf(anim, h);
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * k * (0.18 + 0.12 * Math.sin(anim.t * 2 + anim.seed * 5));
      glow(ctx, glowDot('#ff5a5a'), 0.2 * len, 0, 0.45 * len, 0.16 * len);
      ctx.globalAlpha = a0 * k * 0.55 * f;
      glow(ctx, glowDot('#ffe4e0'), 0.22 * len, 0, 0.4 * len, 0.13 * len);
      ctx.globalAlpha = a0;
    },
  },
};
