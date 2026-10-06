// Crustaceans: blue crab (Callinectes sapidus), Caribbean spiny lobster (Panulirus argus), giant isopod
// (Bathynomus giganteus). Benthic: feet at y ≈ +0.05·len. anim.phase drives the leg cycle; rigid shells are cached
// sprites, legs / antennae / claw arms are live strokes solved with a tiny 2-bone IK.
import {
  TAU, clamp, createRng, unitSprite, drawUnitSprite, palette, modeOf, variant, easePose, blurred, speckle,
  limbPath, smoothLine,
} from './kit.js';

// ── shared helpers ──────────────────────────────────────────────────────────
const K = { x: 0, y: 0 };
/** 2-bone IK: knee position for hip (hx,hy) → foot (fx,fy) with bone lengths a, b. side = +1 bends the knee up. */
function knee(hx, hy, fx, fy, a, b, side) {
  let dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy) || 1e-6;
  const dc = clamp(d, Math.abs(a - b) + 1e-4, a + b - 1e-4);
  dx /= d;
  dy /= d;
  const ca = clamp((a * a + dc * dc - b * b) / (2 * a * dc), -1, 1);
  const sa = Math.sqrt(1 - ca * ca) * side;
  // rotate (dx,dy) by ±acos(ca)
  K.x = hx + (dx * ca - dy * sa) * a;
  K.y = hy + (dx * sa + dy * ca) * a;
  return K;
}
/** Knee on the side of the preferred bend direction (ux, uy). */
function kneeBend(hx, hy, fx, fy, a, b, ux, uy) {
  knee(hx, hy, fx, fy, a, b, 1);
  const x1 = K.x, y1 = K.y;
  knee(hx, hy, fx, fy, a, b, -1);
  if ((x1 - K.x) * ux + (y1 - K.y) * uy > 0) {
    K.x = x1;
    K.y = y1;
  }
  return K;
}
/** Knee that bends toward −Y (up on screen). */
const kneeUp = (hx, hy, fx, fy, a, b) => kneeBend(hx, hy, fx, fy, a, b, 0, -1);
const DASH_NONE = [];

// ════════════════════════════════════════════════════════════════════════════
// BLUE CRAB — front ¾ view from above; len = carapace width (spine tip to spine tip)
// ════════════════════════════════════════════════════════════════════════════
const BC_BODY = { x0: -0.53, x1: 0.53, y0: -0.36, y1: -0.02 };
const BC_CLAW = { x0: -0.03, x1: 0.3, y0: -0.06, y1: 0.05 };
const BC_DACT = { x0: -0.01, x1: 0.15, y0: -0.035, y1: 0.03 };
const BC_PAL = palette({
  leg: '#557d9c',
  legHi: '#a9cbe2',
  legDark: '#2f4d66',
  legFar: '#3f6380',
  arm: '#3c7bd6',
  armHi: '#9fd0ff',
  armDark: '#24508f',
  paddle: '#4d78b8',
  paddleHi: '#a8c8f0',
  paddleRim: '#2a4778',
  spine: '#2a3f52',
});

function crabShellPath(g) {
  // front (anterolateral) margin with teeth = lower outline, rear margin = upper outline
  g.beginPath();
  g.moveTo(0.53, -0.212);
  g.lineTo(0.405, -0.18);
  const teeth = 8;
  for (let k = 0; k < teeth; k++) {
    const u0 = k / teeth, u1 = (k + 1) / teeth, um = (k + 0.62) / teeth;
    const bx = (u) => 0.4 - u * 0.29, by = (u) => -0.176 + u * 0.085 - Math.sin(u * Math.PI) * 0.01;
    // tooth tip pushed outward/forward (down-right in view)
    g.lineTo(bx(um) + 0.012, by(um) + 0.018);
    g.lineTo(bx(u1), by(u1));
    void u0;
  }
  // orbit + frontal teeth
  g.quadraticCurveTo(0.1, -0.075, 0.078, -0.092);
  for (let k = 0; k < 4; k++) {
    const x = 0.06 - k * 0.04;
    g.lineTo(x - 0.008, -0.074);
    g.lineTo(x - 0.02, -0.088);
  }
  g.quadraticCurveTo(-0.1, -0.075, -0.11, -0.091);
  for (let k = teeth - 1; k >= 0; k--) {
    const um = (k + 0.38) / teeth, u0 = k / teeth;
    const bx = (u) => -(0.4 - u * 0.29), by = (u) => -0.176 + u * 0.085 - Math.sin(u * Math.PI) * 0.01;
    g.lineTo(bx(um) - 0.012, by(um) + 0.018);
    g.lineTo(bx(u0), by(u0));
  }
  g.lineTo(-0.53, -0.212);
  g.lineTo(-0.41, -0.226);
  g.bezierCurveTo(-0.36, -0.29, -0.2, -0.335, 0, -0.338);
  g.bezierCurveTo(0.2, -0.335, 0.36, -0.29, 0.41, -0.222);
  g.closePath();
}

function paintCrabBody(g, res) {
  const rng = createRng(31);
  // underside / sternum peeking out below the front margin (white-cream)
  const und = g.createLinearGradient(0, -0.12, 0, -0.03);
  und.addColorStop(0, '#c9cfc9');
  und.addColorStop(1, '#f2efe4');
  g.fillStyle = und;
  g.beginPath();
  g.ellipse(0, -0.085, 0.27, 0.06, 0, 0, TAU);
  g.fill();
  // mouthparts (3rd maxillipeds): two cream plates under the face
  g.fillStyle = '#e8e1cf';
  g.strokeStyle = 'rgba(80,90,90,0.45)';
  g.lineWidth = 0.004;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(0, -0.088);
    g.quadraticCurveTo(s * 0.045, -0.09, s * 0.04, -0.05);
    g.quadraticCurveTo(s * 0.02, -0.04, 0, -0.045);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // carapace
  crabShellPath(g);
  const sh = g.createLinearGradient(0, -0.34, 0, -0.07);
  sh.addColorStop(0, '#8a9a6c');
  sh.addColorStop(0.35, '#6e8463');
  sh.addColorStop(0.7, '#56716a');
  sh.addColorStop(1, '#3f5f6e');
  g.fillStyle = sh;
  g.fill();
  g.save();
  crabShellPath(g);
  g.clip();
  // blue tint toward the toothed front margin and spines
  blurred(g, res, 0.02, () => {
    g.strokeStyle = 'rgba(74,128,170,0.55)';
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(-0.5, -0.2);
    g.quadraticCurveTo(-0.25, -0.1, 0, -0.085);
    g.quadraticCurveTo(0.25, -0.1, 0.5, -0.2);
    g.stroke();
  });
  // regions: H-shaped grooves of the gastric / cardiac areas
  g.strokeStyle = 'rgba(40,58,46,0.35)';
  g.lineWidth = 0.006;
  g.beginPath();
  g.moveTo(-0.1, -0.29);
  g.quadraticCurveTo(-0.05, -0.22, -0.11, -0.15);
  g.moveTo(0.1, -0.29);
  g.quadraticCurveTo(0.05, -0.22, 0.11, -0.15);
  g.moveTo(-0.07, -0.215);
  g.lineTo(0.07, -0.215);
  g.moveTo(-0.2, -0.3);
  g.quadraticCurveTo(-0.24, -0.22, -0.32, -0.19);
  g.moveTo(0.2, -0.3);
  g.quadraticCurveTo(0.24, -0.22, 0.32, -0.19);
  g.stroke();
  // granules
  speckle(g, rng, -0.48, -0.34, 0.48, -0.08, 340, 0.002, 0.007, ['rgba(220,226,180,0.18)', 'rgba(30,44,36,0.16)', 'rgba(160,190,200,0.14)']);
  // dome light from above + specular
  const dome = g.createRadialGradient(-0.08, -0.32, 0.01, 0, -0.24, 0.42);
  dome.addColorStop(0, 'rgba(255,255,230,0.32)');
  dome.addColorStop(0.5, 'rgba(255,255,230,0.08)');
  dome.addColorStop(1, 'rgba(0,20,30,0.12)');
  g.fillStyle = dome;
  g.fillRect(-0.55, -0.4, 1.1, 0.4);
  blurred(g, res, 0.008, () => {
    g.fillStyle = 'rgba(255,255,245,0.38)';
    g.beginPath();
    g.ellipse(-0.12, -0.3, 0.12, 0.018, -0.08, 0, TAU);
    g.fill();
  });
  g.restore();
  // rim light along the rear outline + dark rim along the front
  g.strokeStyle = 'rgba(214,226,190,0.5)';
  g.lineWidth = 0.006;
  g.beginPath();
  g.moveTo(-0.41, -0.222);
  g.bezierCurveTo(-0.36, -0.29, -0.2, -0.335, 0, -0.338);
  g.bezierCurveTo(0.2, -0.335, 0.36, -0.29, 0.41, -0.222);
  g.stroke();
  // the long lateral spines: darker, with a sharp pale-tipped point
  for (const s of [-1, 1]) {
    g.fillStyle = '#24394a';
    g.beginPath();
    g.moveTo(s * 0.53, -0.212);
    g.lineTo(s * 0.44, -0.196);
    g.lineTo(s * 0.445, -0.222);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,190,150,0.8)';
    g.beginPath();
    g.moveTo(s * 0.53, -0.212);
    g.lineTo(s * 0.505, -0.206);
    g.lineTo(s * 0.506, -0.215);
    g.closePath();
    g.fill();
  }
  // eyes on short stalks
  for (const s of [-1, 1]) {
    g.fillStyle = '#6c7f78';
    g.beginPath();
    g.ellipse(s * 0.088, -0.094, 0.011, 0.008, 0, 0, TAU);
    g.fill();
    const eg = g.createRadialGradient(s * 0.086 - 0.003, -0.104, 0.001, s * 0.088, -0.1, 0.012);
    eg.addColorStop(0, '#5a3a34');
    eg.addColorStop(1, '#100c0c');
    g.fillStyle = eg;
    g.beginPath();
    g.arc(s * 0.088, -0.101, 0.0115, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)';
    g.beginPath();
    g.arc(s * 0.085, -0.105, 0.0035, 0, TAU);
    g.fill();
  }
}

function paintCrabClaw(g, res) {
  // propodus (palm + fixed finger) pointing +x from the wrist at the origin; dactyl is a separate sprite
  const path = () => {
    g.beginPath();
    g.moveTo(0, -0.03);
    g.bezierCurveTo(0.05, -0.05, 0.13, -0.045, 0.16, -0.026);
    g.lineTo(0.165, -0.01);
    g.bezierCurveTo(0.2, -0.008, 0.25, -0.004, 0.285, 0.006);
    g.bezierCurveTo(0.25, 0.018, 0.19, 0.03, 0.15, 0.036);
    g.bezierCurveTo(0.09, 0.044, 0.03, 0.04, 0, 0.026);
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, -0.05, 0, 0.045);
  gr.addColorStop(0, '#79b5ff');
  gr.addColorStop(0.35, '#3d7fe0');
  gr.addColorStop(0.75, '#2a5fb4');
  gr.addColorStop(1, '#dfe6f0');
  g.fillStyle = gr;
  g.fill();
  g.save();
  path();
  g.clip();
  // red-orange finger tip
  const tip = g.createLinearGradient(0.17, 0, 0.29, 0);
  tip.addColorStop(0, 'rgba(229,73,43,0)');
  tip.addColorStop(0.35, 'rgba(229,73,43,0.9)');
  tip.addColorStop(1, 'rgba(250,120,70,1)');
  g.fillStyle = tip;
  g.fillRect(0.15, -0.06, 0.15, 0.12);
  // ridges + highlight
  g.strokeStyle = 'rgba(20,40,90,0.4)';
  g.lineWidth = 0.004;
  g.beginPath();
  g.moveTo(0.01, -0.012);
  g.quadraticCurveTo(0.08, -0.022, 0.15, -0.012);
  g.stroke();
  blurred(g, res, 0.004, () => {
    g.fillStyle = 'rgba(230,245,255,0.7)';
    g.beginPath();
    g.ellipse(0.07, -0.03, 0.055, 0.008, -0.05, 0, TAU);
    g.fill();
  });
  // teeth on the cutting edge
  g.fillStyle = 'rgba(255,240,220,0.8)';
  for (let k = 0; k < 6; k++) {
    g.beginPath();
    g.arc(0.175 + k * 0.017, -0.007 + k * 0.002, 0.003, 0, TAU);
    g.fill();
  }
  g.restore();
}

function paintCrabDactyl(g, res) {
  const path = () => {
    g.beginPath();
    g.moveTo(0, -0.012);
    g.bezierCurveTo(0.05, -0.03, 0.11, -0.022, 0.145, 0.012);
    g.bezierCurveTo(0.1, 0.0, 0.05, 0.008, 0, 0.012);
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, 0, 0.145, 0);
  gr.addColorStop(0, '#3f82e4');
  gr.addColorStop(0.45, '#4a86dc');
  gr.addColorStop(0.75, '#e5492b');
  gr.addColorStop(1, '#ff8a5a');
  g.fillStyle = gr;
  g.fill();
  g.fillStyle = 'rgba(230,245,255,0.55)';
  g.beginPath();
  g.ellipse(0.05, -0.013, 0.035, 0.005, -0.15, 0, TAU);
  g.fill();
}

const CL = { wx: 0, wy: 0, ang: 0, ex: 0, ey: 0 };
/** Cheliped pose for side s (+1 = leading/+X claw): r 0 relaxed … 1 raised; grip 0..1 = reaching up to the hook point. */
function crabArmPose(s, r, grip, t) {
  // relaxed: elbows out to the sides, claws held in front of the face pointing inward
  const pick = Math.sin(t * 1.3 + s) * 0.012 * (1 - r);
  let ex = s * 0.36, ey = -0.07 + pick;
  let wx = s * 0.33, wy = 0.0 + pick;
  let ang = s > 0 ? Math.PI - 0.22 : 0.22; // claws angled down-inward so both fingers show below the face
  // raised threat display: claws high, spread and open
  const rx = s * 0.42, ry = -0.27, rwx = s * 0.38, rwy = -0.46;
  const rang = s > 0 ? -Math.PI / 2 + 0.38 : -Math.PI / 2 - 0.38;
  ex += (rx - ex) * r;
  ey += (ry - ey) * r;
  wx += (rwx - wx) * r;
  wy += (rwy - wy) * r;
  ang += (rang - ang) * r;
  if (grip > 0 && s > 0) {
    // the leading claw reaches up to grip the bait at the hook point
    const gx = 0.4, gy = -0.2, gwx = 0.36, gwy = -0.3, gang = -1.3;
    ex += (gx - ex) * grip;
    ey += (gy - ey) * grip;
    wx += (gwx - wx) * grip;
    wy += (gwy - wy) * grip;
    ang += (gang - ang) * grip;
  }
  CL.ex = ex;
  CL.ey = ey;
  CL.wx = wx;
  CL.wy = wy;
  CL.ang = ang;
}

const LEGS = [
  // hip x, hip y, rest foot x, rest foot y, merus, lower leg
  [0.26, -0.13, 0.54, 0.05, 0.25, 0.3],
  [0.29, -0.165, 0.65, 0.05, 0.27, 0.33],
  [0.3, -0.2, 0.73, 0.035, 0.27, 0.33],
];
const LG = new Float32Array(6 * 6); // per leg: hip x,y · knee x,y · foot x,y

function solveCrabLegs(anim, h) {
  const ph = anim.phase, amp = clamp(anim.amp, 0, 1.5), t = anim.t;
  const stride = (0.03 + 0.05 * Math.min(1, amp)) * (1 - h);
  const lift = (0.03 + 0.035 * Math.min(1, amp)) * (1 - h);
  let o = 0;
  for (let s = -1; s <= 1; s += 2) {
    for (let k = 0; k < LEGS.length; k++) {
      const L = LEGS[k];
      // alternating tetrapod-ish gait: neighbours and opposite sides out of phase
      const p = ph + (k % 2 ? Math.PI : 0) + (s > 0 ? 0 : Math.PI * 0.5);
      let fx = s * L[2] - stride * Math.cos(p), fy = L[3] - lift * Math.max(0, Math.sin(p));
      if (h > 0) {
        // dangling: legs splay and paddle in the air
        const fl = Math.sin(t * 7 + k * 1.9 + s) * 0.07;
        fx += (s * (L[2] - 0.02) - fx) * h;
        fy += (L[3] - 0.1 - k * 0.07 + fl - fy) * h;
      }
      const hx = s * L[0], hy = L[1];
      kneeBend(hx, hy, fx, fy, L[4], L[5], s * 0.5, -0.86);
      LG[o] = hx;
      LG[o + 1] = hy;
      LG[o + 2] = K.x;
      LG[o + 3] = K.y;
      LG[o + 4] = fx;
      LG[o + 5] = fy;
      o += 6;
    }
  }
}

function drawCrabLegs(ctx, len, P) {
  const w1 = 0.046 * len, w2 = 0.032 * len;
  for (let bone = 0; bone < 2; bone++) {
    ctx.beginPath();
    for (let o = 0; o < LG.length; o += 6) {
      const b = o + bone * 2;
      ctx.moveTo(LG[b] * len, LG[b + 1] * len);
      if (bone) {
        // lower leg tapers into the pointed dactyl
        const mx = LG[b] + (LG[b + 2] - LG[b]) * 0.72, my = LG[b + 1] + (LG[b + 3] - LG[b + 1]) * 0.72;
        ctx.lineTo(mx * len, my * len);
      } else ctx.lineTo(LG[b + 2] * len, LG[b + 3] * len);
    }
    ctx.strokeStyle = P.leg;
    ctx.lineWidth = bone ? w2 : w1;
    ctx.stroke();
  }
  // dactyls (thin, darker) + joints
  ctx.beginPath();
  for (let o = 0; o < LG.length; o += 6) {
    const kx = LG[o + 2], ky = LG[o + 3], fx = LG[o + 4], fy = LG[o + 5];
    ctx.moveTo((kx + (fx - kx) * 0.7) * len, (ky + (fy - ky) * 0.7) * len);
    ctx.lineTo(fx * len, fy * len);
  }
  ctx.strokeStyle = P.legDark;
  ctx.lineWidth = w2 * 0.6;
  ctx.stroke();
  // highlight along the top of each merus
  ctx.beginPath();
  for (let o = 0; o < LG.length; o += 6) {
    const hx = LG[o], hy = LG[o + 1], kx = LG[o + 2], ky = LG[o + 3];
    ctx.moveTo((hx + (kx - hx) * 0.15) * len, (hy + (ky - hy) * 0.15) * len - w1 * 0.25);
    ctx.lineTo((hx + (kx - hx) * 0.85) * len, (hy + (ky - hy) * 0.85) * len - w1 * 0.25);
  }
  ctx.strokeStyle = P.legHi;
  ctx.lineWidth = w1 * 0.3;
  ctx.stroke();
  ctx.fillStyle = P.legDark;
  ctx.beginPath();
  for (let o = 0; o < LG.length; o += 6) {
    const kx = LG[o + 2] * len, ky = LG[o + 3] * len;
    ctx.moveTo(kx + w2 * 0.5, ky);
    ctx.arc(kx, ky, w2 * 0.5, 0, TAU);
  }
  ctx.fill();
}

function drawCrabPaddles(ctx, len, anim, P, h) {
  const t = anim.t, ph = anim.phase;
  for (let s = -1; s <= 1; s += 2) {
    const scull = Math.sin(ph * 0.5 + (s > 0 ? 0 : 1.3) + t * 0.8) * 0.12 + h * Math.sin(t * 9 + s) * 0.3;
    const hx = s * 0.3, hy = -0.225;
    const kx = s * 0.43, ky = -0.34 - h * 0.05;
    const ang = (s > 0 ? -0.55 : -Math.PI + 0.55) + scull * s;
    const px = kx + Math.cos(ang) * 0.07, py = ky + Math.sin(ang) * 0.07;
    ctx.strokeStyle = P.leg;
    ctx.lineWidth = 0.036 * len;
    ctx.beginPath();
    ctx.moveTo(hx * len, hy * len);
    ctx.lineTo(kx * len, ky * len);
    ctx.lineTo(px * len, py * len);
    ctx.stroke();
    // the paddle (flattened dactyl)
    ctx.save();
    ctx.translate(px * len, py * len);
    ctx.rotate(ang);
    ctx.fillStyle = P.paddle;
    ctx.beginPath();
    ctx.ellipse(0.055 * len, 0, 0.065 * len, (0.03 + 0.008 * Math.sin(ph + s)) * len, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = P.paddleRim;
    ctx.lineWidth = 0.008 * len;
    ctx.stroke();
    ctx.fillStyle = P.paddleHi;
    ctx.beginPath();
    ctx.ellipse(0.05 * len, -0.008 * len, 0.035 * len, 0.008 * len, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
}

function drawCrabArm(ctx, len, s, P, claw, dact, open) {
  const sh = s * 0.17, shy = -0.11;
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.arm;
  ctx.lineWidth = 0.046 * len;
  ctx.beginPath();
  ctx.moveTo(sh * len, shy * len);
  ctx.lineTo(CL.ex * len, CL.ey * len);
  ctx.stroke();
  ctx.lineWidth = 0.038 * len;
  ctx.beginPath();
  ctx.moveTo(CL.ex * len, CL.ey * len);
  ctx.lineTo(CL.wx * len, CL.wy * len);
  ctx.stroke();
  // spines on the merus + highlight
  ctx.strokeStyle = P.armHi;
  ctx.lineWidth = 0.014 * len;
  ctx.beginPath();
  ctx.moveTo(sh * len, (shy - 0.014) * len);
  ctx.lineTo((sh + (CL.ex - sh) * 0.85) * len, (shy + (CL.ey - shy) * 0.85 - 0.014) * len);
  ctx.stroke();
  ctx.fillStyle = P.armDark;
  ctx.beginPath();
  for (let k = 1; k <= 3; k++) {
    const u = k / 4;
    const x = (sh + (CL.ex - sh) * u) * len, y = (shy + (CL.ey - shy) * u) * len;
    ctx.moveTo(x - 0.008 * len, y - 0.022 * len);
    ctx.lineTo(x + 0.006 * len, y - 0.042 * len);
    ctx.lineTo(x + 0.01 * len, y - 0.02 * len);
  }
  ctx.fill();
  // claw (movable finger kept on the upper / inner side)
  const cl = len * 1.0;
  ctx.save();
  ctx.translate(CL.wx * len, CL.wy * len);
  ctx.rotate(CL.ang);
  if (Math.cos(CL.ang) < 0) ctx.scale(1, -1);
  drawUnitSprite(ctx, claw, cl);
  ctx.translate(0.155 * cl, -0.024 * cl);
  ctx.rotate(-0.08 - open * 0.5);
  drawUnitSprite(ctx, dact, cl);
  ctx.restore();
}

const blueCrab = {
  bounds: { x0: -0.82, x1: 0.82, y0: -0.72, y1: 0.09 },
  mouth: { x: 0.41, y: -0.47 },
  draw(ctx, len, anim, opts) {
    const mode = modeOf(opts);
    const P = BC_PAL[mode];
    const lenPx = len * (opts.pxScale || 1);
    const body = variant(unitSprite('bc_body', BC_BODY, lenPx, paintCrabBody), opts);
    const claw = variant(unitSprite('bc_claw', BC_CLAW, lenPx, paintCrabClaw), opts);
    const dact = variant(unitSprite('bc_dact', BC_DACT, lenPx, paintCrabDactyl), opts);
    const st = anim.state;
    const hooked = st === 'hooked' || st === 'landed';
    const threat = hooked || st === 'flee';
    const gripT = st === 'bite' || st === 'nibble' || hooked ? 1 : 0;
    const h = easePose(anim, 0, hooked ? 1 : 0, 5);
    const r = easePose(anim, 1, threat ? 1 : 0, 6);
    const grip = easePose(anim, 2, gripT, 7);
    const t = anim.t;
    const amp = clamp(anim.amp, 0, 1.5);
    const bob = -Math.abs(Math.sin(anim.phase)) * 0.012 * Math.min(1, amp) * (1 - h);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    drawCrabPaddles(ctx, len, anim, P, h);
    solveCrabLegs(anim, h);
    drawCrabLegs(ctx, len, P);
    ctx.translate(0, bob * len);
    drawUnitSprite(ctx, body, len);
    const open = 0.2 + 0.7 * r + 0.15 * Math.sin(t * 2.2) * (1 - r) + (r > 0.5 ? Math.sin(t * 6) * 0.2 * r : 0);
    for (let s = -1; s <= 1; s += 2) {
      crabArmPose(s, s > 0 ? r * (1 - grip) : r, grip, t);
      drawCrabArm(ctx, len, s, P, claw, dact, s > 0 ? clamp(open * (1 - grip) + 0.1 * grip, 0, 1) : clamp(open, 0, 1));
    }
    ctx.restore();
  },
};

// ════════════════════════════════════════════════════════════════════════════
// SPINY LOBSTER — side view facing +X; len = body length (horns to tail fan)
// ════════════════════════════════════════════════════════════════════════════
const SL_HEAD = { x0: -0.06, x1: 0.5, y0: -0.4, y1: -0.04 };
const SL_TAIL = { x0: -0.56, x1: 0.04, y0: -0.34, y1: -0.02 };
const SL_PIVOT = { x: 0.0, y: -0.2 };
const SL_PAL = palette({
  leg: '#d9a45a',
  legBand: '#6e2f2c',
  legFar: '#8d5a3a',
  legBandFar: '#4a2422',
  ant: '#8a3a26',
  antHi: '#e0a070',
  antSpine: '#3d1a14',
  antennule: '#c98a5a',
});

function paintLobsterHead(g, res) {
  const rng = createRng(55);
  // cephalothorax: a spiny cylinder, horns over the eyes
  const path = () => {
    g.beginPath();
    g.moveTo(-0.03, -0.29);
    g.bezierCurveTo(0.08, -0.33, 0.3, -0.33, 0.4, -0.28);
    g.lineTo(0.43, -0.25);
    g.bezierCurveTo(0.46, -0.2, 0.45, -0.14, 0.42, -0.1);
    g.bezierCurveTo(0.34, -0.07, 0.12, -0.07, -0.03, -0.1);
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, -0.33, 0, -0.07);
  gr.addColorStop(0, '#c9693e');
  gr.addColorStop(0.3, '#a5482e');
  gr.addColorStop(0.75, '#7a2f26');
  gr.addColorStop(1, '#5a2220');
  g.fillStyle = gr;
  g.fill();
  g.save();
  path();
  g.clip();
  // cervical groove + mottling + cream spots
  g.strokeStyle = 'rgba(60,20,16,0.5)';
  g.lineWidth = 0.008;
  g.beginPath();
  g.moveTo(0.2, -0.32);
  g.quadraticCurveTo(0.17, -0.2, 0.22, -0.08);
  g.stroke();
  speckle(g, rng, -0.03, -0.33, 0.45, -0.07, 120, 0.004, 0.012, ['rgba(255,214,150,0.25)', 'rgba(60,18,12,0.25)']);
  g.fillStyle = 'rgba(246,222,170,0.8)';
  for (const [x, y, r] of [[0.08, -0.2, 0.012], [0.3, -0.18, 0.01], [0.14, -0.13, 0.008], [0.36, -0.12, 0.007]]) {
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
  blurred(g, res, 0.01, () => {
    g.fillStyle = 'rgba(255,220,180,0.4)';
    g.beginPath();
    g.ellipse(0.18, -0.29, 0.18, 0.02, 0, 0, TAU);
    g.fill();
  });
  g.restore();
  // forward-pointing spines along the top
  g.fillStyle = '#5a2018';
  for (let k = 0; k < 9; k++) {
    const x = 0.0 + k * 0.045, y = -0.3 - Math.sin((k / 8) * Math.PI) * 0.025;
    g.beginPath();
    g.moveTo(x, y + 0.012);
    g.lineTo(x + 0.03, y - 0.022);
    g.lineTo(x + 0.014, y + 0.012);
    g.closePath();
    g.fill();
  }
  g.fillStyle = 'rgba(255,220,170,0.7)';
  for (let k = 0; k < 9; k++) {
    const x = 0.0 + k * 0.045, y = -0.3 - Math.sin((k / 8) * Math.PI) * 0.025;
    g.beginPath();
    g.arc(x + 0.025, y - 0.017, 0.003, 0, TAU);
    g.fill();
  }
  // big frontal horns over the eyes
  for (const [dx, a] of [[0, 1], [-0.015, 0.6]]) {
    g.fillStyle = a === 1 ? '#8e3524' : '#6a2a1e';
    g.beginPath();
    g.moveTo(0.37 + dx, -0.28);
    g.quadraticCurveTo(0.45 + dx, -0.33, 0.49 + dx, -0.37);
    g.quadraticCurveTo(0.45 + dx, -0.3, 0.43 + dx, -0.25);
    g.closePath();
    g.fill();
  }
  // eye on its stalk
  g.fillStyle = '#7a3a2a';
  g.beginPath();
  g.ellipse(0.43, -0.235, 0.022, 0.015, -0.3, 0, TAU);
  g.fill();
  const eg = g.createRadialGradient(0.445, -0.245, 0.002, 0.448, -0.24, 0.016);
  eg.addColorStop(0, '#3a3a40');
  eg.addColorStop(1, '#050507');
  g.fillStyle = eg;
  g.beginPath();
  g.arc(0.448, -0.24, 0.016, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  g.beginPath();
  g.arc(0.443, -0.246, 0.005, 0, TAU);
  g.fill();
  // antenna bases (thick spiny peduncles)
  g.fillStyle = '#9c4128';
  g.beginPath();
  g.ellipse(0.43, -0.17, 0.05, 0.03, -0.35, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255,200,150,0.5)';
  g.beginPath();
  g.ellipse(0.425, -0.18, 0.03, 0.008, -0.35, 0, TAU);
  g.fill();
}

function paintLobsterTail(g, res) {
  // abdomen: six overlapping segments with the famous cream spots, ending in the tail fan
  const segs = 6;
  for (let i = segs - 1; i >= 0; i--) {
    const x1 = 0.02 - i * 0.068, x0 = x1 - 0.085;
    const top = -0.29 + i * 0.012, bot = -0.11 + i * 0.006;
    const path = () => {
      g.beginPath();
      g.moveTo(x0, top + 0.012);
      g.quadraticCurveTo((x0 + x1) / 2, top - 0.012, x1, top);
      g.lineTo(x1 + 0.004, bot);
      g.quadraticCurveTo((x0 + x1) / 2, bot + 0.03, x0, bot + 0.01);
      g.closePath();
    };
    path();
    const gr = g.createLinearGradient(0, top, 0, bot + 0.03);
    gr.addColorStop(0, '#b0603a');
    gr.addColorStop(0.4, '#8e4a30');
    gr.addColorStop(0.8, '#6a2c26');
    gr.addColorStop(1, '#4e1e1e');
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = 'rgba(40,10,10,0.55)';
    g.lineWidth = 0.006;
    g.stroke();
    // pleuron: the rounded side flap with a small rear-pointing spine
    g.fillStyle = '#6a2a24';
    g.beginPath();
    g.moveTo(x1, bot - 0.004);
    g.quadraticCurveTo(x1 - 0.01, bot + 0.035, x0 - 0.004, bot + 0.03);
    g.lineTo(x0 + 0.012, bot + 0.004);
    g.closePath();
    g.fill();
    // cream-yellow spots: big pair on segments 2 and 6, small elsewhere
    const big = i === 1 || i === 5;
    g.fillStyle = 'rgba(248,222,150,0.92)';
    g.beginPath();
    g.ellipse((x0 + x1) / 2, (top + bot) / 2 + 0.01, big ? 0.022 : 0.009, big ? 0.018 : 0.008, 0, 0, TAU);
    g.fill();
    // groove + highlight
    g.strokeStyle = 'rgba(255,220,180,0.35)';
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(x0 + 0.01, top + 0.012);
    g.quadraticCurveTo((x0 + x1) / 2, top - 0.004, x1 - 0.004, top + 0.004);
    g.stroke();
  }
  // tail fan: telson + two pairs of uropods spread like a fan behind the last segment
  const fx = 0.02 - 6 * 0.068 + 0.012;
  for (const [a, l, w, c] of [[-0.62, 0.12, 0.05, '#5e2620'], [0.58, 0.12, 0.05, '#5e2620'], [-0.3, 0.135, 0.055, '#7e3a26'], [0.28, 0.135, 0.055, '#7e3a26'], [0, 0.13, 0.05, '#9a4a2c']]) {
    g.save();
    g.translate(fx, -0.19);
    g.rotate(Math.PI + a);
    g.beginPath();
    g.moveTo(0, -w * 0.3);
    g.bezierCurveTo(l * 0.4, -w * 0.75, l * 0.9, -w * 0.7, l, -w * 0.15);
    g.quadraticCurveTo(l * 1.04, w * 0.2, l * 0.9, w * 0.5);
    g.bezierCurveTo(l * 0.6, w * 0.7, l * 0.3, w * 0.6, 0, w * 0.3);
    g.closePath();
    const fg = g.createLinearGradient(0, 0, l, 0);
    fg.addColorStop(0, c);
    fg.addColorStop(0.75, c);
    fg.addColorStop(1, '#d88a52');
    g.fillStyle = fg;
    g.fill();
    g.strokeStyle = 'rgba(40,10,10,0.35)';
    g.lineWidth = 0.004;
    g.beginPath();
    g.moveTo(0.01, 0);
    g.quadraticCurveTo(l * 0.5, -w * 0.05, l * 0.92, 0.0);
    g.stroke();
    g.restore();
  }
}

const SL_LEGS = [0.34, 0.28, 0.22, 0.15, 0.08];
function drawLobsterLegs(ctx, len, anim, P, far, h) {
  const ph = anim.phase, amp = clamp(anim.amp, 0, 1.5), t = anim.t;
  const stride = (0.02 + 0.035 * Math.min(1, amp)) * (1 - h);
  const lift = (0.015 + 0.02 * Math.min(1, amp)) * (1 - h);
  const w1 = 0.024 * len, w2 = 0.017 * len;
  for (let bone = 0; bone < 2; bone++) {
    ctx.beginPath();
    for (let k = 0; k < SL_LEGS.length; k++) {
      const p = ph + k * 1.4 + (far ? Math.PI : 0);
      const hx = SL_LEGS[k] - (far ? 0.015 : 0), hy = -0.1 - (far ? 0.01 : 0);
      let fx = hx + 0.07 - k * 0.045 - stride * Math.cos(p), fy = 0.05 - (far ? 0.012 : 0) - lift * Math.max(0, Math.sin(p));
      if (h > 0) {
        fx += (hx + 0.03 - k * 0.02 - fx) * h;
        fy += (0.0 + Math.sin(t * 8 + k * 1.7) * 0.04 - fy) * h;
      }
      kneeUp(hx, hy, fx, fy, 0.1, 0.12);
      if (bone === 0) {
        ctx.moveTo(hx * len, hy * len);
        ctx.lineTo(K.x * len, K.y * len);
      } else {
        ctx.moveTo(K.x * len, K.y * len);
        ctx.lineTo(fx * len, fy * len);
      }
    }
    ctx.lineWidth = bone ? w2 : w1;
    ctx.strokeStyle = far ? P.legFar : P.leg;
    ctx.setLineDash(DASH_NONE);
    ctx.stroke();
    // bands
    ctx.strokeStyle = far ? P.legBandFar : P.legBand;
    ctx.setLineDash(bone ? DASH_B : DASH_A);
    ctx.stroke();
    ctx.setLineDash(DASH_NONE);
  }
}
let DASH_A = [3, 3], DASH_B = [2, 2.5];

const AX = new Float32Array(24), AY = new Float32Array(24);
function lobsterAntenna(ctx, len, anim, P, far, h) {
  const t = anim.t;
  const n = 14;
  let x = 0.43, y = far ? -0.185 : -0.165;
  let a = -0.62 + (far ? -0.12 : 0.05) + Math.sin(t * 0.9 + (far ? 1.4 : 0)) * 0.05 + h * Math.sin(t * 5 + (far ? 1 : 0)) * 0.25;
  const seg = 0.075;
  for (let i = 0; i < n; i++) {
    AX[i] = x * len;
    AY[i] = y * len;
    const u = i / (n - 1);
    a += 0.06 + 0.035 * Math.sin(t * 1.6 - u * 3 + (far ? 2 : 0)) * u;
    x += Math.cos(a) * seg * (1 - u * 0.35);
    y += Math.sin(a) * seg * (1 - u * 0.35);
  }
  ctx.beginPath();
  limbPath(ctx, AX, AY, n, 0.038 * len, 0.004 * len, 0.7);
  ctx.fillStyle = far ? P.antSpine : P.ant;
  ctx.fill();
  if (!far) {
    ctx.strokeStyle = P.antHi;
    ctx.lineWidth = 0.007 * len;
    ctx.beginPath();
    smoothLine(ctx, AX, AY, 7);
    ctx.stroke();
  }
}

const spinyLobster = {
  bounds: { x0: -0.6, x1: 1.12, y0: -0.78, y1: 0.08 },
  mouth: { x: 0.44, y: -0.08 },
  draw(ctx, len, anim, opts) {
    const mode = modeOf(opts);
    const P = SL_PAL[mode];
    const lenPx = len * (opts.pxScale || 1);
    const head = variant(unitSprite('sl_head', SL_HEAD, lenPx, paintLobsterHead), opts);
    const tail = variant(unitSprite('sl_tail', SL_TAIL, lenPx, paintLobsterTail), opts);
    const hooked = anim.state === 'hooked' || anim.state === 'landed';
    const h = easePose(anim, 0, hooked ? 1 : 0, 5);
    const t = anim.t;
    const lw = Math.max(1, len * 0.01);
    DASH_A[0] = DASH_A[1] = 0.03 * len;
    DASH_B[0] = 0.022 * len;
    DASH_B[1] = 0.026 * len;
    // tail flips in bursts when hooked (curling under = positive rotation)
    const burst = Math.max(0, Math.sin(t * 2.3)) ** 6;
    const flip = h * (0.15 + 0.85 * burst) * 0.9 + Math.sin(t * 0.7 + anim.seed * 5) * 0.03;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    lobsterAntenna(ctx, len, anim, P, true, h);
    drawLobsterLegs(ctx, len, anim, P, true, h);
    // abdomen pivots at the carapace joint
    ctx.save();
    ctx.translate(SL_PIVOT.x * len, SL_PIVOT.y * len);
    ctx.rotate(flip);
    ctx.translate(-SL_PIVOT.x * len, -SL_PIVOT.y * len);
    drawUnitSprite(ctx, tail, len);
    ctx.restore();
    drawUnitSprite(ctx, head, len);
    // antennules (thin, forked)
    ctx.strokeStyle = P.antennule;
    ctx.lineWidth = lw * 0.7;
    ctx.beginPath();
    for (let k = 0; k < 2; k++) {
      const wv = Math.sin(t * 2.4 + k * 1.3) * 0.02;
      ctx.moveTo(0.44 * len, -0.15 * len);
      ctx.quadraticCurveTo(0.53 * len, (-0.17 + wv) * len, (0.6 + k * 0.03) * len, (-0.22 - k * 0.04 + wv) * len);
    }
    ctx.stroke();
    drawLobsterLegs(ctx, len, anim, P, false, h);
    lobsterAntenna(ctx, len, anim, P, false, h);
    ctx.restore();
  },
};

// ════════════════════════════════════════════════════════════════════════════
// GIANT ISOPOD — side view slightly from above, facing +X; len = body length
// ════════════════════════════════════════════════════════════════════════════
const GI_BODY = { x0: -0.55, x1: 0.53, y0: -0.36, y1: 0.0 };
const GI_PAL = palette({
  leg: '#c8b6c6',
  legHi: '#efe4ee',
  legFar: '#8f7d92',
  ant: '#bba8bb',
  antFar: '#8a788c',
});

// dorsal profile of the arched "pill bug" (unit space), and its lower flange
const giTop = (x) => {
  const u = clamp((x + 0.53) / 1.02, 0, 1);
  return -0.07 - 0.265 * Math.pow(Math.sin(Math.pow(u, 0.85) * Math.PI), 0.75);
};
const GI_BOUND = [-0.53, -0.36, -0.315, -0.27, -0.225, -0.18, -0.09, 0.0, 0.09, 0.18, 0.27, 0.36];

function giShell(g) {
  g.beginPath();
  g.moveTo(-0.535, -0.075);
  for (let i = 1; i <= 60; i++) {
    const x = -0.535 + (i / 60) * 1.0;
    g.lineTo(x, giTop(x));
  }
  g.quadraticCurveTo(0.5, -0.05, 0.42, -0.045);
  // scalloped coxal flange along the bottom (pereon), smoother on the tail
  for (let k = GI_BOUND.length - 1; k > 0; k--) {
    const x1 = GI_BOUND[k], x0 = GI_BOUND[k - 1];
    const lobe = x0 >= -0.2 ? 0.03 : 0.012;
    g.quadraticCurveTo((x0 + x1) / 2 + 0.01, -0.045 + lobe, x0, -0.05);
  }
  g.closePath();
}

function paintIsopod(g, res) {
  const rng = createRng(808);
  // pleotelson spines + uropods peeking below the tail
  g.fillStyle = '#9d899f';
  g.beginPath();
  g.ellipse(-0.43, -0.045, 0.1, 0.02, 0.12, 0, TAU);
  g.fill();
  g.fillStyle = '#e9dfe8';
  for (let k = 0; k < 6; k++) {
    const x = -0.53 + k * 0.03, y = -0.075 + k * 0.006;
    g.beginPath();
    g.moveTo(x + 0.004, y - 0.006);
    g.lineTo(x - 0.016, y + 0.012);
    g.lineTo(x + 0.012, y + 0.002);
    g.closePath();
    g.fill();
  }
  // the shell
  giShell(g);
  const sh = g.createLinearGradient(0, -0.34, 0, -0.03);
  sh.addColorStop(0, '#f1e6ee');
  sh.addColorStop(0.25, '#d9c8d6');
  sh.addColorStop(0.6, '#b49fb6');
  sh.addColorStop(0.85, '#8d7891');
  sh.addColorStop(1, '#6e5a74');
  g.fillStyle = sh;
  g.fill();
  g.save();
  giShell(g);
  g.clip();
  // overlapping tergites: each plate's rear edge casts a thin shadow, its front edge catches light
  for (let k = 1; k < GI_BOUND.length; k++) {
    const x = GI_BOUND[k];
    const top = giTop(x);
    const bend = 0.025;
    g.strokeStyle = 'rgba(78,56,84,0.55)';
    g.lineWidth = k < 6 ? 0.006 : 0.008;
    g.beginPath();
    g.moveTo(x, top - 0.01);
    g.quadraticCurveTo(x - bend, (top - 0.05) / 2, x - 0.004, -0.03);
    g.stroke();
    g.strokeStyle = 'rgba(255,250,255,0.45)';
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(x + 0.008, top - 0.008);
    g.quadraticCurveTo(x - bend + 0.008, (top - 0.05) / 2, x + 0.004, -0.03);
    g.stroke();
  }
  // texture + soft dorsal sheen
  speckle(g, rng, -0.53, -0.34, 0.47, -0.03, 320, 0.002, 0.006, ['rgba(255,255,255,0.14)', 'rgba(80,58,90,0.12)', 'rgba(200,170,190,0.12)']);
  blurred(g, res, 0.012, () => {
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 0.025;
    g.beginPath();
    for (let i = 0; i <= 30; i++) {
      const x = -0.4 + (i / 30) * 0.78;
      if (i === 0) g.moveTo(x, giTop(x) + 0.03);
      else g.lineTo(x, giTop(x) + 0.03);
    }
    g.stroke();
  });
  // underside shading
  const us = g.createLinearGradient(0, -0.12, 0, -0.02);
  us.addColorStop(0, 'rgba(60,40,70,0)');
  us.addColorStop(1, 'rgba(60,40,70,0.35)');
  g.fillStyle = us;
  g.fillRect(-0.6, -0.12, 1.2, 0.12);
  g.restore();
  // big compound eye on the side of the head: dark, faceted, with a reflective sheen
  const eye = () => {
    g.beginPath();
    g.moveTo(0.372, -0.142);
    g.quadraticCurveTo(0.42, -0.163, 0.462, -0.13);
    g.quadraticCurveTo(0.468, -0.09, 0.435, -0.07);
    g.quadraticCurveTo(0.39, -0.09, 0.372, -0.142);
    g.closePath();
  };
  eye();
  const eg = g.createLinearGradient(0.38, -0.16, 0.46, -0.07);
  eg.addColorStop(0, '#3c3a48');
  eg.addColorStop(0.55, '#24232c');
  eg.addColorStop(1, '#121117');
  g.fillStyle = eg;
  g.fill();
  g.save();
  eye();
  g.clip();
  g.strokeStyle = 'rgba(170,200,210,0.22)';
  g.lineWidth = 0.0025;
  for (let k = 0; k < 14; k++) {
    g.beginPath();
    g.moveTo(0.37 + k * 0.008, -0.17);
    g.lineTo(0.35 + k * 0.008, -0.06);
    g.moveTo(0.37, -0.17 + k * 0.008);
    g.lineTo(0.48, -0.155 + k * 0.008);
    g.stroke();
  }
  blurred(g, res, 0.006, () => {
    g.fillStyle = 'rgba(170,235,215,0.5)';
    g.beginPath();
    g.ellipse(0.425, -0.128, 0.03, 0.01, -0.5, 0, TAU);
    g.fill();
  });
  g.restore();
  g.strokeStyle = 'rgba(70,50,76,0.5)';
  g.lineWidth = 0.004;
  eye();
  g.stroke();
  // mouthparts
  g.fillStyle = '#a08aa4';
  g.beginPath();
  g.ellipse(0.47, -0.065, 0.022, 0.014, 0.4, 0, TAU);
  g.fill();
}

const GI_LEGS = [0.26, 0.17, 0.08, -0.01, -0.1, -0.19, -0.27];
function drawIsopodLegs(ctx, len, anim, P, far, h) {
  const ph = anim.phase, amp = clamp(anim.amp, 0, 1.5), t = anim.t;
  const stride = (0.02 + 0.03 * Math.min(1, amp)) * (1 - h);
  const lift = (0.012 + 0.015 * Math.min(1, amp)) * (1 - h);
  for (let bone = 0; bone < 2; bone++) {
    ctx.beginPath();
    for (let k = 0; k < GI_LEGS.length; k++) {
      const p = ph - k * 0.9 + (far ? Math.PI : 0); // metachronal wave
      const hx = GI_LEGS[k] - (far ? 0.012 : 0), hy = -0.06 - (far ? 0.012 : 0);
      let fx = hx + (k < 3 ? 0.04 : -0.03) - stride * Math.cos(p), fy = 0.05 - (far ? 0.012 : 0) - lift * Math.max(0, Math.sin(p));
      if (h > 0) {
        fx += (hx + Math.sin(t * 6 + k) * 0.04 - fx) * h;
        fy += (-0.01 + Math.cos(t * 6 + k * 1.3) * 0.03 - fy) * h;
      }
      kneeUp(hx, hy, fx, fy, 0.06, 0.08);
      if (bone === 0) {
        ctx.moveTo(hx * len, hy * len);
        ctx.lineTo(K.x * len, K.y * len);
      } else {
        ctx.moveTo(K.x * len, K.y * len);
        ctx.lineTo(fx * len, fy * len);
      }
    }
    ctx.lineWidth = (bone ? 0.014 : 0.02) * len;
    ctx.strokeStyle = far ? P.legFar : P.leg;
    ctx.stroke();
    if (!far) {
      ctx.lineWidth = (bone ? 0.004 : 0.006) * len;
      ctx.strokeStyle = P.legHi;
      ctx.stroke();
    }
  }
}

function isopodAntennae(ctx, len, anim, P, far) {
  const t = anim.t;
  const n = 10;
  // long second antenna reaching forward and drooping toward the ground
  let x = 0.47, y = -0.1 - (far ? 0.012 : 0);
  let a = -0.25 + (far ? -0.12 : 0) + Math.sin(t * 0.8 + (far ? 1 : 0)) * 0.06;
  for (let i = 0; i < n; i++) {
    AX[i] = x * len;
    AY[i] = y * len;
    a += 0.075 + Math.sin(t * 1.2 - i * 0.5 + (far ? 2 : 0)) * 0.025;
    x += Math.cos(a) * 0.04;
    y += Math.sin(a) * 0.04;
  }
  ctx.beginPath();
  limbPath(ctx, AX, AY, n, 0.016 * len, 0.004 * len);
  ctx.fillStyle = far ? P.antFar : P.ant;
  ctx.fill();
  // short first antenna forward
  ctx.strokeStyle = far ? P.antFar : P.ant;
  ctx.lineWidth = 0.008 * len;
  ctx.beginPath();
  ctx.moveTo(0.47 * len, -0.13 * len);
  ctx.quadraticCurveTo(0.53 * len, (-0.16 + Math.sin(t * 2) * 0.01) * len, 0.57 * len, (-0.14 + Math.sin(t * 2 + 1) * 0.01) * len);
  ctx.stroke();
}

const giantIsopod = {
  bounds: { x0: -0.58, x1: 0.86, y0: -0.37, y1: 0.08 },
  mouth: { x: 0.52, y: -0.06 },
  draw(ctx, len, anim, opts) {
    const mode = modeOf(opts);
    const P = GI_PAL[mode];
    const lenPx = len * (opts.pxScale || 1);
    const body = variant(unitSprite('gi_body', GI_BODY, lenPx, paintIsopod), opts);
    const hooked = anim.state === 'hooked' || anim.state === 'landed';
    const h = easePose(anim, 0, hooked ? 1 : 0, 4);
    ctx.save();
    ctx.lineCap = 'round';
    isopodAntennae(ctx, len, anim, P, true);
    drawIsopodLegs(ctx, len, anim, P, true, h);
    // body arches a little when distressed
    const arch = h * (0.06 + 0.03 * Math.sin(anim.t * 4));
    if (arch) {
      ctx.translate(0, -0.05 * len);
      ctx.rotate(-arch * 0.3);
      ctx.translate(0, 0.05 * len);
    }
    drawUnitSprite(ctx, body, len);
    drawIsopodLegs(ctx, len, anim, P, false, h);
    isopodAntennae(ctx, len, anim, P, false);
    ctx.restore();
  },
};

export const DRAWERS = {
  blue_crab: blueCrab,
  spiny_lobster: spinyLobster,
  giant_isopod: giantIsopod,
};
