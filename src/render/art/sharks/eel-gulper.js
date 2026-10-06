// Gulper eel (Eurypharynx pelecanoides): a velvet-black whip with a tiny-eyed beak of a head whose loose lower
// jaw drops open into an enormous pelican pouch; the tail ends in a pink luminous bulb.
import { unitSprite, variantFor, paintEye } from '../common.js';
import { TAU, clamp, makeProfile, band, soft, softStroke, clipTo, texture, lod, variantOf, pxsOf, hookedness, liveColor, glowDot, haloDot, easeState } from './kit.js';
import { makeSpine, layoutSpine, drawSpine, enterHead, leaveHead, frameAt } from './eel-spine.js';

const TOP = [
  [0.5, -0.004], [0.485, -0.009], [0.45, -0.014], [0.4, -0.019], [0.34, -0.025], [0.28, -0.032], [0.22, -0.037], [0.15, -0.039],
  [0.08, -0.036], [0, -0.029], [-0.08, -0.02], [-0.18, -0.012], [-0.3, -0.007], [-0.42, -0.0035], [-0.49, -0.0015],
];
const BOT = [
  [0.5, -0.004], [0.49, -0.001], [0.45, 0.001], [0.4, 0.002], [0.34, 0.003], [0.28, 0.005], [0.25, 0.015], [0.22, 0.029], [0.15, 0.035],
  [0.08, 0.031], [0, 0.023], [-0.08, 0.015], [-0.18, 0.0095], [-0.3, 0.0055], [-0.42, 0.003], [-0.49, 0.0015],
];
const P = makeProfile(TOP, BOT);
const H = [0.268, 0.007]; // jaw hinge
const JAW_TIP = [0.493, 0.002];
const THROAT = [0.236, 0.031];
const BOX = { x0: -0.53, x1: 0.51, y0: -0.05, y1: 0.045 };
const JAWBOX = { x0: 0.25, x1: 0.51, y0: -0.01, y1: 0.02 };
const SWIM = { xh: 0.22, tail: -0.53, waves: 1.45, swing: 0.075, head: 0.04, power: 1.35, stripPx: 7, maxStrips: 48 };
const PAL = {
  base: { skin: '#16141c', sheen: '#56546f', rim: '#8a8eb0', belly: '#0c0b10', jaw: '#1f1d29', bulb: '#ff7fb6' },
  lift: { skin: '#6c6474', sheen: '#b8b4c8', rim: '#d8d8e6', belly: '#5a5462', jaw: '#7a7484', bulb: '#ffb0d0' },
};

function paintBody(g, res, pal) {
  const L = lod(res);
  // low fin fold along the back and belly of the tail
  for (const side of [-1, 1]) {
    g.beginPath();
    for (let i = 0; i <= 30; i++) {
      const x = (side < 0 ? 0.12 : 0.02) - (((side < 0 ? 0.12 : 0.02) + 0.49) * i) / 30;
      const y = (side < 0 ? P.top(x) : P.bot(x)) + side * 0.0045 * Math.min(1, (0.12 - x) / 0.1);
      if (i === 0) g.moveTo(x, side < 0 ? P.top(x) + 0.003 : P.bot(x) - 0.003);
      g.lineTo(x, y);
    }
    g.lineTo(-0.49, 0);
    g.closePath();
    g.fillStyle = pal.jaw;
    g.fill();
  }
  // tail-tip luminous organ (visible even without the glow pass): a little pink club with filaments
  softStroke(g, res, 0.0015, pal.bulb, 0.0012, (q) => {
    for (const a of [-0.5, 0, 0.45]) {
      q.moveTo(-0.508, 0);
      q.lineTo(-0.508 - Math.cos(a) * 0.016, Math.sin(a) * 0.012);
    }
  });
  const bg = g.createRadialGradient(-0.502, 0, 0, -0.502, 0, 0.007);
  bg.addColorStop(0, '#fff2f8');
  bg.addColorStop(0.45, pal.bulb);
  bg.addColorStop(1, 'rgba(160,40,90,0.9)');
  g.fillStyle = bg;
  g.beginPath();
  g.ellipse(-0.502, 0, 0.0075, 0.0045, 0, 0, TAU);
  g.fill();
  clipTo(g, (q) => P.outline(q), () => {
    g.fillStyle = pal.skin;
    g.fillRect(BOX.x0, BOX.y0, BOX.x1 - BOX.x0, BOX.y1 - BOX.y0);
    soft(g, res, 0.012, pal.belly, (q) => band(q, P, 0.52, -0.52, 0.6, 1.3));
    // velvet: a soft cool sheen along the upper flank + a faint rim on the back
    soft(g, res, 0.012, `${pal.sheen}88`, (q) => band(q, P, 0.48, -0.4, 0.12, 0.42));
    soft(g, res, 0.004, `${pal.rim}66`, (q) => band(q, P, 0.5, -0.48, -0.2, 0.06));
    texture(g, 'grain', 0.03, 0.25, BOX);
    // lateral-line papillae: a row of tiny pale bumps
    if (L >= 1) {
      g.fillStyle = `${pal.rim}55`;
      for (let x = 0.2; x > -0.4; x -= 0.018) {
        g.beginPath();
        g.arc(x, P.at(x, 0.45), 0.0012, 0, TAU);
        g.fill();
      }
    }
    // the beak: upper jaw edge a little lighter, tiny eye right behind the snout tip
    softStroke(g, res, 0.0015, `${pal.rim}88`, 0.002, (q) => {
      q.moveTo(0.498, -0.002);
      q.quadraticCurveTo(0.4, 0.004, 0.28, 0.006);
    });
    paintEye(g, 0.474, -0.008, 0.0042, { iris: '#6b6480', irisDark: '#1a1822', pupil: 0.55, ring: 'rgba(0,0,0,0.8)', look: { x: 0.5, y: 0 } });
  });
  // small pectoral fin behind the head
  g.fillStyle = `${pal.jaw}`;
  g.beginPath();
  g.moveTo(0.21, 0.004);
  g.quadraticCurveTo(0.19, -0.004, 0.176, 0.006);
  g.quadraticCurveTo(0.19, 0.018, 0.21, 0.012);
  g.closePath();
  g.fill();
}

function paintJaw(g, res, pal) {
  // the long thin lower jaw: a rod of bone under velvet skin, lit along its top edge
  g.beginPath();
  g.moveTo(H[0] - 0.004, H[1] - 0.002);
  g.quadraticCurveTo(0.38, 0.0, JAW_TIP[0], JAW_TIP[1] - 0.001);
  g.quadraticCurveTo(JAW_TIP[0] + 0.004, JAW_TIP[1] + 0.003, JAW_TIP[0] - 0.004, JAW_TIP[1] + 0.004);
  g.quadraticCurveTo(0.38, 0.01, H[0] - 0.004, H[1] + 0.008);
  g.closePath();
  g.fillStyle = pal.jaw;
  g.fill();
  softStroke(g, res, 0.0012, `${pal.rim}44`, 0.0012, (q) => {
    q.moveTo(H[0], H[1] - 0.001);
    q.quadraticCurveTo(0.38, 0.0015, JAW_TIP[0] - 0.003, JAW_TIP[1]);
  });
}

const spine = makeSpine();
const gspine = makeSpine();
const tmp = { x: 0, y: 0, a: 0 };

/** Pouch + gape for a jaw angle (head-frame, local px). */
function pouch(ctx, len, ang, open, opts) {
  const c = Math.cos(ang), s = Math.sin(ang);
  const hx = H[0] * len, hy = H[1] * len;
  const jx = (JAW_TIP[0] - H[0]) * len, jy = (JAW_TIP[1] - H[1]) * len;
  const lx = hx + jx * c - jy * s, ly = hy + jx * s + jy * c;
  const tx = THROAT[0] * len, ty = THROAT[1] * len;
  // inside of the mouth, seen through the gape
  if (ang > 0.03) {
    ctx.beginPath();
    ctx.moveTo(hx - 0.01 * len, hy);
    ctx.lineTo(0.498 * len, -0.002 * len);
    ctx.lineTo(lx, ly);
    ctx.closePath();
    if (opts.silhouette || opts.shiny) ctx.fillStyle = liveColor(opts, '', '#6a4a1a');
    else {
      const gi = ctx.createLinearGradient(lx, ly, hx, hy);
      gi.addColorStop(0, '#24121f');
      gi.addColorStop(0.35, '#120a12');
      gi.addColorStop(1, '#020102');
      ctx.fillStyle = gi;
    }
    ctx.fill();
  }
  // the pouch: loose skin from the lower jaw tip ballooning back to the throat
  const k = clamp(open, 0, 1);
  // the pouch hangs BELOW the lower jaw like a pelican's: built in the jaw's own frame (J along the jaw,
  // N perpendicular, away from the gape) — a loose sack when shut, a round balloon when open
  const Jx = lx - hx, Jy = ly - hy, Jl = Math.hypot(Jx, Jy) || 1;
  const Nx = -Jy / Jl, Ny = Jx / Jl;
  const bulge = (0.014 + 0.105 * k) * len;
  const c1x = hx + Jx * 0.92 + Nx * bulge * 1.45, c1y = hy + Jy * 0.92 + Ny * bulge * 1.45;
  const c2x = hx + Jx * 0.1 + Nx * bulge * 1.6 - 0.035 * len, c2y = hy + Jy * 0.1 + Ny * bulge * 1.6 + 0.012 * len;
  ctx.beginPath();
  ctx.moveTo(lx, ly);
  ctx.bezierCurveTo(c1x, c1y, c2x, c2y, tx, ty);
  ctx.lineTo(hx - 0.012 * len, hy + 0.01 * len);
  ctx.lineTo(hx, hy);
  ctx.closePath();
  if (opts.silhouette || opts.shiny) ctx.fillStyle = liveColor(opts, '', '#8a6420');
  else {
    const gp = ctx.createLinearGradient(hx, hy, hx + Nx * bulge * 1.3, hy + Ny * bulge * 1.3 + Jy * 0.5);
    gp.addColorStop(0, '#16141d');
    gp.addColorStop(0.6, '#100e15');
    gp.addColorStop(1, '#060508');
    ctx.fillStyle = gp;
  }
  ctx.fill();
  if (!opts.silhouette) {
    // the stretched skin catches a little light along the bulge
    ctx.strokeStyle = opts.shiny ? 'rgba(255,230,160,0.3)' : 'rgba(110,108,140,0.22)';
    ctx.lineWidth = Math.max(0.8, 0.004 * len);
    ctx.beginPath();
    ctx.moveTo(hx + Jx * 0.9 + Nx * bulge * 0.35, hy + Jy * 0.9 + Ny * bulge * 0.35);
    ctx.bezierCurveTo(c1x - Nx * bulge * 0.3, c1y - Ny * bulge * 0.3, c2x - Nx * bulge * 0.3, c2y - Ny * bulge * 0.3, tx + 0.015 * len, ty + 0.006 * len);
    ctx.stroke();
  }
}

// eased per individual (shared by draw + glow): losing the hook or ending a bite never snaps the pouch shut
const motion = (anim) => easeState(anim, 'gulper', hookedness(anim), openness(anim));
function openness(anim) {
  const t = anim.t || 0, seed = anim.seed || 0;
  const hk = hookedness(anim);
  // slow, lazy gulps; wide and pumping when hooked
  let open = Math.max(anim.mouth || 0, 0.04 + 0.55 * Math.pow(0.5 - 0.5 * Math.cos(t * 0.7 + seed * 6), 3));
  if (hk >= 1) open = Math.max(open, 0.7 + 0.3 * Math.sin(t * 5.5 + (anim.uid || 0)));
  if (anim.state === 'bite') open = Math.max(open, 0.8);
  if (anim.state === 'icon') open = 0.35;
  return clamp(open, 0, 1);
}
function layout(sp, len, anim, pxs, hk) {
  let amp = clamp((anim.amp || 0.5) * 0.8 + 0.3 + hk * 0.6, 0, 1.8);
  if (anim.state === 'icon') amp = 0.4;
  SWIM.harm = hk * 0.35;
  return layoutSpine(sp, len, (anim.phase || 0) * 0.85, amp, SWIM, pxs);
}

export const gulper_eel = {
  bounds: { x0: -0.535, x1: 0.505, y0: -0.15, y1: 0.21 },
  mouth: { x: 0.45, y: 0.006 },
  draw(ctx, len, anim, opts) {
    ctx.save();
    try {
      gulper_eel.drawImpl(ctx, len, anim, opts);
    } finally {
      ctx.restore();
    }
  },
  drawImpl(ctx, len, anim, opts) {
    const pxs = pxsOf(anim, opts);
    const lenPx = Math.min(len * (opts.pxScale || 1), opts.detail === 'card' ? 2400 : 1400);
    const pal = opts.shiny ? PAL.lift : PAL.base;
    const key = opts.shiny ? 'L' : '';
    const body = unitSprite('gulper:body' + key, BOX, lenPx, (g, res) => paintBody(g, res, pal));
    const jaw = unitSprite('gulper:jaw' + key, JAWBOX, lenPx, (g, res) => paintJaw(g, res, pal));
    const E = motion(anim);
    const open = E.open;
    const ang = open * 0.92;
    layout(spine, len, anim, pxs, E.hk);
    if (E.hk > 0) ctx.rotate(Math.sin((anim.t || 0) * 10.7) * 0.04 * E.hk);
    enterHead(ctx, spine);
    pouch(ctx, len, ang, open, opts);
    leaveHead(ctx);
    drawSpine(ctx, variantFor(body, opts), spine, pxs);
    enterHead(ctx, spine);
    ctx.translate(H[0] * len, H[1] * len);
    ctx.rotate(ang);
    ctx.translate(-H[0] * len, -H[1] * len);
    const b = jaw.box, s = len / jaw.res, jv = variantFor(jaw, opts);
    ctx.drawImage(jv.canvas, b.x0 * len - jaw.pad * s, b.y0 * len - jaw.pad * s, jv.canvas.width * s, jv.canvas.height * s);
    leaveHead(ctx);
  },
  drawGlow(ctx, len, anim, opts) {
    ctx.save();
    try {
      gulper_eel.glowImpl(ctx, len, anim, opts);
    } finally {
      ctx.restore();
    }
  },
  glowImpl(ctx, len, anim, opts) {
    // the tail-tip lure: hot pink core + soft halo, breathing and flickering
    const E = motion(anim);
    layout(gspine, len, anim, pxsOf(anim, opts), E.hk);
    if (E.hk > 0) ctx.rotate(Math.sin((anim.t || 0) * 10.7) * 0.04 * E.hk); // same thrash as the body
    frameAt(gspine, -0.502, tmp);
    const t = anim.t || 0, u = anim.uid || 0;
    // slow breathing swell + a faint nervous flicker; now and then a brighter pulse to lure prey
    const pulse = Math.pow(Math.max(0, Math.sin(t * 0.9 + u * 1.7)), 12);
    const fl = 0.72 + 0.16 * Math.sin(t * 2.3 + u) + 0.06 * Math.sin(t * 13.1 + u * 3) + 0.3 * pulse;
    const r = len < 200 ? Math.max(5, len * 0.065) : 13 + (len - 200) * 0.03; // grows slower on big card renders
    const a0 = ctx.globalAlpha;
    // light is not skin: keep the halo round while the registry squashes x during a turn
    const sx = Math.max(0.14, Math.abs(anim.turn === undefined ? 1 : anim.turn));
    ctx.translate(tmp.x, tmp.y);
    ctx.scale(1 / sx, 1);
    ctx.translate(-tmp.x, -tmp.y);
    const h = haloDot('#ff6fae');
    // wide, faint bloom lighting the water around the lure
    ctx.globalAlpha = a0 * fl * 0.35;
    ctx.drawImage(h, tmp.x - r * 6, tmp.y - r * 6, r * 12, r * 12);
    ctx.globalAlpha = a0 * fl;
    ctx.drawImage(h, tmp.x - r * 2.8, tmp.y - r * 2.8, r * 5.6, r * 5.6);
    const c = glowDot('#ff6fae', 0.22);
    const cr = r * (0.8 + 0.15 * pulse);
    ctx.drawImage(c, tmp.x - cr, tmp.y - cr, cr * 2, cr * 2);
    ctx.globalAlpha = a0;
  },
};
