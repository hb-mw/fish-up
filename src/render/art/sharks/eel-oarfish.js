// Giant oarfish (Regalecus glesne): an immensely long silver ribbon held nearly straight while the scarlet dorsal
// fin ripples its whole length (amiiform swimming), a red crest of plumes on the head, red oar-tipped pelvic rays.
import { unitSprite, variantFor, paintEye } from '../common.js';
import { TAU, clamp, makeProfile, band, soft, softStroke, clipTo, texture, lod, variantOf, pxsOf, hookedness, liveColor, rngFor, easeState } from './kit.js';
import { makeSpine, layoutSpine, drawSpine, pointAt, frameAt } from './eel-spine.js';

const TOP = [[0.5, 0], [0.497, -0.012], [0.49, -0.02], [0.475, -0.026], [0.45, -0.028], [0.3, -0.027], [0.1, -0.024], [-0.1, -0.02], [-0.3, -0.014], [-0.42, -0.008], [-0.5, -0.002]];
const BOT = [[0.5, 0], [0.497, 0.01], [0.488, 0.018], [0.47, 0.023], [0.44, 0.025], [0.3, 0.025], [0.1, 0.022], [-0.1, 0.018], [-0.3, 0.012], [-0.42, 0.007], [-0.5, 0.002]];
const P = makeProfile(TOP, BOT);
const BOX = { x0: -0.51, x1: 0.51, y0: -0.035, y1: 0.032 };
const SWIM = { xh: 0.42, tail: -0.515, waves: 0.9, swing: 0.012, head: 0.25, power: 1, stripPx: 10, maxStrips: 40 };
const RED = '#e2283f', RED_D = '#a8142a', RED_L = '#ff6a76';

function paintBody(g, res, v) {
  const L = lod(res);
  clipTo(g, (q) => P.outline(q), () => {
    // polished silver: blue-grey back, mirror-bright upper flank, soft grey belly
    g.fillStyle = '#c9d1db';
    g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
    soft(g, res, 0.007, '#5f6c80', (q) => band(q, P, 0.52, -0.52, -0.5, 0.2));
    soft(g, res, 0.006, '#8793a3', (q) => band(q, P, 0.52, -0.52, 0.82, 1.4));
    soft(g, res, 0.005, 'rgba(240,246,252,0.95)', (q) => band(q, P, 0.47, -0.46, 0.28, 0.46));
    soft(g, res, 0.0018, 'rgba(255,255,255,0.95)', (q) => band(q, P, 0.45, -0.4, 0.33, 0.37));
    soft(g, res, 0.008, 'rgba(160,190,255,0.25)', (q) => band(q, P, 0.45, -0.45, 0.5, 0.66));
    // bluish-black streaks and spots, oblique and wavy (each animal its own)
    const r = rngFor('oar' + v);
    const n = L >= 1 ? 46 : 26;
    for (let i = 0; i < n; i++) {
      const x = 0.42 - r.next() * 0.88, f = 0.08 + r.next() * 0.6;
      const y = P.at(x, f);
      if (r.next() < 0.6) {
        // oblique wavy streak, raked back like the rays
        const l = (0.01 + r.next() * 0.018) * (x < -0.25 ? 0.6 : 1), w = 0.0012 + r.next() * 0.0014;
        softStroke(g, res, 0.0012, 'rgba(30,40,58,0.42)', w, (q) => {
          q.moveTo(x + l * 0.35, y - l * 0.55);
          q.bezierCurveTo(x + l * 0.05, y - l * 0.2, x + l * 0.15, y + l * 0.15, x - l * 0.2, y + l * 0.55);
        });
      } else {
        const rr = 0.0018 + r.next() * 0.003;
        soft(g, res, 0.0012, 'rgba(30,40,58,0.42)', (q) => q.ellipse(x, y, rr * 1.4, rr, -0.4, 0, TAU));
      }
    }
    texture(g, 'grain', 0.025, 0.12, BOX, 'soft-light', 4);
    // lateral line low on the flank, gill-cover edge, rim darkening
    softStroke(g, res, 0.0008, 'rgba(60,72,90,0.35)', 0.001, (q) => {
      for (let i = 0; i <= 30; i++) {
        const x = 0.43 - (0.9 * i) / 30;
        q[i ? 'lineTo' : 'moveTo'](x, P.at(x, 0.66));
      }
    });
    softStroke(g, res, 0.0015, 'rgba(70,80,100,0.5)', 0.0018, (q) => {
      q.moveTo(0.452, P.at(0.452, 0.05));
      q.quadraticCurveTo(0.44, 0.0, 0.452, P.at(0.452, 0.92));
    });
    softStroke(g, res, 0.003, 'rgba(40,50,70,0.3)', 0.003, (q) => P.outline(q));
    // head: big silver eye, small oblique mouth
    paintEye(g, 0.474, -0.004, 0.0085, { iris: '#c3ccd8', irisDark: '#55606f', pupil: 0.58, ring: 'rgba(40,50,64,0.7)', look: { x: 0.3, y: 0.1 } });
    softStroke(g, res, 0.0008, 'rgba(40,40,52,0.7)', 0.0016, (q) => {
      q.moveTo(0.5, 0.004);
      q.lineTo(0.489, 0.012);
    });
  });
  // small translucent pectoral fin
  g.fillStyle = 'rgba(214,92,104,0.5)';
  g.beginPath();
  g.moveTo(0.445, 0.011);
  g.lineTo(0.428, 0.004);
  g.quadraticCurveTo(0.424, 0.011, 0.429, 0.018);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(170,40,60,0.55)';
  g.lineWidth = 0.0007;
  g.beginPath();
  for (let i = 0; i < 4; i++) {
    g.moveTo(0.445, 0.011);
    g.lineTo(0.428 - i * 0.0005, 0.005 + i * 0.0042);
  }
  g.stroke();
}

const spine = makeSpine();
const pt = { x: 0, y: 0, a: 0 }, pt2 = { x: 0, y: 0, a: 0 };
const NF = 64;
const fb = new Float32Array((NF + 1) * 2), fe = new Float32Array((NF + 1) * 2);

/** Ripple of the dorsal fin at unit x: a wave running head → tail. */
const finH = (u) => (u > 0.43 ? 0 : 0.017 * Math.min(1, (0.43 - u) / 0.03) * (u < -0.42 ? Math.max(0.3, (u + 0.5) / 0.08) : 1));

function dorsalFin(ctx, len, t, wv, opts) {
  for (let i = 0; i <= NF; i++) {
    const u = 0.43 - (0.92 * i) / NF;
    const ph = u * 34 + t * wv;
    const h = finH(u) * (1 + 0.28 * Math.sin(ph));
    pointAt(spine, u, P.top(u) + 0.002, pt);
    const a = pt.a, c = Math.cos(a), s = Math.sin(a);
    const lean = 0.45 * h * Math.cos(ph); // rays sway fore and aft as the wave passes
    fb[i * 2] = pt.x;
    fb[i * 2 + 1] = pt.y;
    // outer edge = base + dorsal normal (s, −c) × h − body axis (c, s) × lean
    fe[i * 2] = pt.x + (s * h - c * lean) * len;
    fe[i * 2 + 1] = pt.y + (s * -lean - c * h) * len;
  }
  ctx.beginPath();
  ctx.moveTo(fb[0], fb[1]);
  for (let i = 0; i <= NF; i++) ctx.lineTo(fe[i * 2], fe[i * 2 + 1]);
  for (let i = NF; i >= 0; i--) ctx.lineTo(fb[i * 2], fb[i * 2 + 1]);
  ctx.closePath();
  ctx.fillStyle = liveColor(opts, 'rgba(226,40,63,0.82)', '#e0a030');
  ctx.fill();
  if (opts.silhouette) return;
  // rays + a brighter rim where the membrane catches the light
  ctx.strokeStyle = opts.shiny ? 'rgba(150,90,10,0.7)' : 'rgba(150,12,32,0.75)';
  ctx.lineWidth = Math.max(0.6, len * 0.0012);
  ctx.beginPath();
  for (let i = 0; i <= NF; i += 1) {
    ctx.moveTo(fb[i * 2], fb[i * 2 + 1]);
    ctx.lineTo(fe[i * 2], fe[i * 2 + 1]);
  }
  ctx.stroke();
  ctx.strokeStyle = opts.shiny ? 'rgba(255,230,150,0.6)' : 'rgba(255,120,130,0.6)';
  ctx.beginPath();
  for (let i = 0; i <= NF; i++) ctx[i ? 'lineTo' : 'moveTo'](fe[i * 2], fe[i * 2 + 1]);
  ctx.stroke();
}

function crest(ctx, len, t, hk, opts) {
  // the elongated first dorsal rays: a swaying red crown of plumes with membrane between them
  frameAt(spine, 0.47, pt);
  const n = 7;
  const tips = [];
  for (let i = 0; i < n; i++) {
    const u = 0.48 - i * 0.0055;
    pointAt(spine, u, P.top(u) + 0.002, pt2);
    const l = (0.075 - i * 0.006) * len;
    const ang = pt.a - 1.95 - i * 0.07 + Math.sin(t * 1.6 + i * 0.5) * (0.07 + hk * 0.15);
    tips.push([pt2.x, pt2.y, pt2.x + Math.cos(ang) * l, pt2.y + Math.sin(ang) * l, ang]);
  }
  ctx.beginPath();
  ctx.moveTo(tips[0][0], tips[0][1]);
  for (const tp of tips) ctx.lineTo(tp[2] + Math.cos(tp[4] + 1.2) * len * 0.004, tp[3] + Math.sin(tp[4] + 1.2) * len * 0.004);
  ctx.lineTo(tips[n - 1][0], tips[n - 1][1]);
  ctx.closePath();
  ctx.fillStyle = liveColor(opts, 'rgba(232,48,68,0.86)', 'rgba(224,160,48,0.8)');
  ctx.fill();
  ctx.strokeStyle = liveColor(opts, RED, '#e0a030');
  ctx.lineWidth = Math.max(0.7, len * 0.0022);
  ctx.beginPath();
  for (const tp of tips) {
    ctx.moveTo(tp[0], tp[1]);
    ctx.quadraticCurveTo((tp[0] + tp[2]) / 2 + Math.cos(tp[4] + 1.57) * len * 0.004, (tp[1] + tp[3]) / 2 + Math.sin(tp[4] + 1.57) * len * 0.004, tp[2], tp[3]);
  }
  ctx.stroke();
  // little feathery tufts at the ray tips
  ctx.fillStyle = liveColor(opts, RED_L, '#ffd070');
  for (const tp of tips) {
    ctx.beginPath();
    ctx.ellipse(tp[2], tp[3], len * 0.0045, len * 0.0022, tp[4], 0, TAU);
    ctx.fill();
  }
}

function oars(ctx, len, t, hk, opts) {
  // the pelvic fins: single long rays trailing down and back, each ending in a little red oar blade
  for (let k = 0; k < 2; k++) {
    pointAt(spine, 0.432 - k * 0.006, P.bot(0.432) - 0.002, pt);
    const l = (0.105 - k * 0.012) * len;
    const ang = pt.a + Math.PI - 0.62 - k * 0.12 + Math.sin(t * 1.1 + k * 1.7) * (0.05 + hk * 0.2);
    const ex = pt.x + Math.cos(ang) * l, ey = pt.y + Math.sin(ang) * l;
    ctx.strokeStyle = liveColor(opts, k ? RED_D : RED, '#d09028');
    ctx.lineWidth = Math.max(0.6, len * 0.0016);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.quadraticCurveTo((pt.x + ex) / 2 - Math.sin(ang) * l * 0.08, (pt.y + ey) / 2 + Math.cos(ang) * l * 0.08, ex, ey);
    ctx.stroke();
    ctx.fillStyle = liveColor(opts, k ? RED_D : RED, '#e0a030');
    ctx.beginPath();
    ctx.ellipse(ex + Math.cos(ang) * len * 0.008, ey + Math.sin(ang) * len * 0.008, len * 0.011, len * 0.0035, ang, 0, TAU);
    ctx.fill();
  }
}

export const oarfish = {
  bounds: { x0: -0.505, x1: 0.505, y0: -0.12, y1: 0.115 },
  mouth: { x: 0.497, y: 0.006 },
  draw(ctx, len, anim, opts) {
    ctx.save();
    try {
      oarfish.drawImpl(ctx, len, anim, opts);
    } finally {
      ctx.restore();
    }
  },
  drawImpl(ctx, len, anim, opts) {
    const pxs = pxsOf(anim, opts);
    const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2400 : 1600);
    const v = variantOf(anim.seed, 3);
    const body = unitSprite('oarfish:body' + v, BOX, lenPx, (g, res) => paintBody(g, res, v));
    const hkT = hookedness(anim);
    const t = anim.t || 0;
    // the fin wave is the engine (faster when it hurries): its phase integrates that speed per individual,
    // and hookedness is eased, so effort changes never make the fin or the body jump
    const E = easeState(anim, 'oarfish', hkT, 0, 3.2 + (anim.amp || 0.5) * 3 + hkT * 6);
    const hk = E.hk;
    let amp = clamp((anim.amp || 0.5) * 0.6 + 0.4 + hk * 1.4, 0, 1.8);
    if (anim.state === 'icon') amp = 0.5;
    SWIM.harm = hk * 0.4;
    SWIM.swing = 0.012 + hk * 0.026;
    SWIM.waves = 0.9 + hk * 0.45;
    SWIM.stripPx = hk > 0.05 ? 7 : 10;
    layoutSpine(spine, len, (anim.phase || 0) * 0.35, amp, SWIM, pxs);
    oars(ctx, len, t, hk, opts);
    drawSpine(ctx, variantFor(body, opts), spine, pxs);
    dorsalFin(ctx, len, E.ph, 1, opts);
    crest(ctx, len, t, hk, opts);
  },
};
