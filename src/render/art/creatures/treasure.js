// Treasure items: giant pearl oyster (gaping slowly over a lustrous pearl) and a sunken treasure chest (iron-banded,
// encrusted, lid ajar on glowing gold). Both rest on the seabed (y ≈ +0.05·len). Their light lives in drawGlow;
// a faint warm spill is also painted in draw() so they still read if the additive pass is skipped.
import { TAU, createRng, unitSprite, drawUnitSprite, modeOf, variant, blurred, speckle, glowK, glowDot, glow } from './kit.js';

// ── PEARL OYSTER (len = shell length; hinge at the back, gaping toward +X) ──────
const OY_BASE = { x0: -0.52, x1: 0.52, y0: -0.2, y1: 0.08 };
const OY_LID = { x0: -0.06, x1: 1.0, y0: -0.2, y1: 0.06 }; // drawn from the hinge
const HINGE = [-0.46, -0.04];

function valve(g, rng, upper) {
  const path = () => {
    g.beginPath();
    if (upper) {
      g.moveTo(0, 0);
      g.bezierCurveTo(0.2, -0.13, 0.75, -0.14, 0.93, -0.02);
      g.quadraticCurveTo(0.96, 0.02, 0.9, 0.03);
      g.bezierCurveTo(0.6, 0.02, 0.25, 0.03, 0, 0.02);
    } else {
      g.moveTo(-0.47, -0.03);
      g.bezierCurveTo(-0.3, 0.07, 0.3, 0.08, 0.47, -0.01);
      g.quadraticCurveTo(0.5, -0.04, 0.44, -0.05);
      g.bezierCurveTo(0.2, -0.04, -0.2, -0.05, -0.47, -0.03);
    }
    g.closePath();
  };
  path();
  const gr = g.createLinearGradient(0, upper ? -0.14 : -0.05, 0, upper ? 0.03 : 0.07);
  gr.addColorStop(0, upper ? '#a89a72' : '#6e6248');
  gr.addColorStop(0.5, upper ? '#7c6e4c' : '#544a36');
  gr.addColorStop(1, upper ? '#4e4430' : '#2e281e');
  g.fillStyle = gr;
  g.fill();
  g.save();
  path();
  g.clip();
  // concentric growth lamellae + mottling
  const cx = upper ? 0 : -0.47, cy = upper ? 0.0 : -0.03;
  for (let k = 1; k < 14; k++) {
    g.strokeStyle = k % 2 ? 'rgba(230,214,170,0.35)' : 'rgba(30,24,14,0.35)';
    g.lineWidth = 0.006;
    g.beginPath();
    g.ellipse(cx, cy, k * 0.075, k * 0.012 + 0.01, 0, 0, TAU);
    g.stroke();
  }
  speckle(g, rng, -0.5, -0.15, 1.0, 0.08, 90, 0.004, 0.012, ['rgba(120,140,100,0.3)', 'rgba(40,30,20,0.25)', 'rgba(220,200,150,0.2)']);
  g.restore();
}

function paintOysterBase(g, res) {
  const rng = createRng(31);
  // the open interior: nacre (silver with a gold lip) behind the dark mantle fringe
  const nac = g.createLinearGradient(-0.4, -0.12, 0.45, -0.02);
  nac.addColorStop(0, '#cfd6dc');
  nac.addColorStop(0.4, '#f4f2ee');
  nac.addColorStop(0.7, '#e6dcf0');
  nac.addColorStop(1, '#e8c87a');
  g.fillStyle = nac;
  g.beginPath();
  g.moveTo(-0.44, -0.04);
  g.bezierCurveTo(-0.2, -0.17, 0.3, -0.17, 0.46, -0.05);
  g.bezierCurveTo(0.2, -0.04, -0.2, -0.04, -0.44, -0.04);
  g.fill();
  g.strokeStyle = 'rgba(40,30,30,0.6)';
  g.lineWidth = 0.012;
  g.beginPath();
  g.moveTo(-0.3, -0.06);
  g.bezierCurveTo(-0.1, -0.075, 0.25, -0.075, 0.44, -0.05);
  g.stroke();
  // the pearl: lustrous, with a soft pink-green orient and a crisp highlight
  const px = 0.16, py = -0.085, pr = 0.055;
  const pg = g.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.05, px, py, pr);
  pg.addColorStop(0, '#ffffff');
  pg.addColorStop(0.45, '#f6eef0');
  pg.addColorStop(0.8, '#d8cbd8');
  pg.addColorStop(1, '#a89cb0');
  g.fillStyle = pg;
  g.beginPath();
  g.arc(px, py, pr, 0, TAU);
  g.fill();
  blurred(g, res, 0.006, () => {
    g.strokeStyle = 'rgba(160,230,200,0.35)';
    g.lineWidth = 0.008;
    g.beginPath();
    g.arc(px, py, pr * 0.8, 0.5, 2.2);
    g.stroke();
  });
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.beginPath();
  g.ellipse(px - pr * 0.35, py - pr * 0.42, pr * 0.22, pr * 0.14, -0.5, 0, TAU);
  g.fill();
  valve(g, rng, false);
}

function paintOysterLid(g, res) {
  valve(g, createRng(77), true);
}

// ── TREASURE CHEST (front view, lid hinged at the back and ajar; len = chest width) ─
const CH_BODY = { x0: -0.54, x1: 0.54, y0: -0.4, y1: 0.08 };
const CH_LID = { x0: -0.52, x1: 0.52, y0: -0.26, y1: 0.03 };

function planks(g, x0, y0, x1, y1, n, rng) {
  for (let k = 0; k < n; k++) {
    const ya = y0 + ((y1 - y0) * k) / n, yb = ya + (y1 - y0) / n;
    const gr = g.createLinearGradient(0, ya, 0, yb);
    const base = 70 + rng.next() * 20;
    gr.addColorStop(0, `rgb(${base + 30},${base},${base * 0.55})`);
    gr.addColorStop(1, `rgb(${base * 0.6},${base * 0.42},${base * 0.25})`);
    g.fillStyle = gr;
    g.fillRect(x0, ya, x1 - x0, yb - ya);
    g.strokeStyle = 'rgba(20,12,6,0.6)';
    g.lineWidth = 0.006;
    g.beginPath();
    g.moveTo(x0, yb);
    g.lineTo(x1, yb);
    g.stroke();
    g.strokeStyle = 'rgba(30,18,8,0.3)';
    g.lineWidth = 0.003;
    for (let j = 0; j < 4; j++) {
      const yy = ya + (yb - ya) * (0.2 + rng.next() * 0.6);
      g.beginPath();
      g.moveTo(x0, yy);
      g.bezierCurveTo(x0 + 0.3, yy + (rng.next() - 0.5) * 0.02, x1 - 0.3, yy + (rng.next() - 0.5) * 0.02, x1, yy);
      g.stroke();
    }
  }
}
function band(g, x, y0, y1, w) {
  const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
  gr.addColorStop(0, '#3a3e3a');
  gr.addColorStop(0.5, '#6a6e64');
  gr.addColorStop(1, '#2a2c28');
  g.fillStyle = gr;
  g.fillRect(x - w / 2, y0, w, y1 - y0);
  g.fillStyle = '#9a9a8a';
  for (let y = y0 + 0.03; y < y1; y += 0.07) {
    g.beginPath();
    g.arc(x, y, w * 0.14, 0, TAU);
    g.fill();
  }
}
function barnacles(g, rng, n, x0, y0, x1, y1) {
  for (let k = 0; k < n; k++) {
    const bx = x0 + rng.next() * (x1 - x0), by = y0 + rng.next() * (y1 - y0), r = 0.008 + rng.next() * 0.012;
    // a little volcano cone, lit from above, with a dark slit on top
    g.fillStyle = '#7e786a';
    g.beginPath();
    g.moveTo(bx - r, by + r * 0.5);
    g.lineTo(bx - r * 0.45, by - r * 0.5);
    g.lineTo(bx + r * 0.45, by - r * 0.5);
    g.lineTo(bx + r, by + r * 0.5);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(226,220,204,0.75)';
    g.beginPath();
    g.moveTo(bx - r * 0.8, by + r * 0.35);
    g.lineTo(bx - r * 0.4, by - r * 0.45);
    g.lineTo(bx, by - r * 0.45);
    g.lineTo(bx - r * 0.25, by + r * 0.4);
    g.closePath();
    g.fill();
    g.fillStyle = '#2e2a24';
    g.beginPath();
    g.ellipse(bx, by - r * 0.48, r * 0.4, r * 0.12, 0, 0, TAU);
    g.fill();
  }
}

function paintChestBody(g, res) {
  const rng = createRng(1717);
  // gold heaped inside, visible above the front wall (the lid is ajar)
  g.fillStyle = '#2a1a08';
  g.fillRect(-0.44, -0.4, 0.88, 0.14);
  for (let k = 0; k < 60; k++) {
    const x = -0.42 + rng.next() * 0.84, y = -0.36 + rng.next() * 0.1 - Math.sin(((x + 0.42) / 0.84) * Math.PI) * 0.04;
    const r = 0.022 + rng.next() * 0.012;
    g.fillStyle = rng.next() < 0.5 ? '#f2c640' : '#d89a1c';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.55, rng.next() - 0.5, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255,250,200,0.8)';
    g.beginPath();
    g.ellipse(x - r * 0.3, y - r * 0.2, r * 0.35, r * 0.15, 0, 0, TAU);
    g.fill();
  }
  for (const [x, y, c] of [[-0.12, -0.35, '#d0304a'], [0.2, -0.33, '#30c070'], [0.02, -0.37, '#4a7ae8']]) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y - 0.025);
    g.lineTo(x + 0.022, y);
    g.lineTo(x, y + 0.02);
    g.lineTo(x - 0.022, y);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(x - 0.006, y - 0.014, 0.008, 0.008);
  }
  // the box: planks, iron bands, lock plate, sand drift and encrustations
  planks(g, -0.46, -0.28, 0.46, 0.04, 4, rng);
  for (const x of [-0.43, -0.22, 0.22, 0.43]) band(g, x, -0.29, 0.045, 0.05);
  g.fillStyle = '#4a4c46';
  g.fillRect(-0.47, -0.3, 0.94, 0.03);
  g.fillStyle = '#5a5a50';
  g.fillRect(-0.06, -0.27, 0.12, 0.12);
  g.fillStyle = '#141210';
  g.beginPath();
  g.arc(0, -0.225, 0.016, 0, TAU);
  g.moveTo(-0.006, -0.22);
  g.lineTo(0.006, -0.22);
  g.lineTo(0.01, -0.18);
  g.lineTo(-0.01, -0.18);
  g.fill();
  speckle(g, rng, -0.47, -0.3, 0.47, 0.04, 140, 0.004, 0.014, ['rgba(140,90,40,0.35)', 'rgba(60,90,70,0.3)', 'rgba(230,220,190,0.18)']);
  barnacles(g, rng, 16, -0.46, -0.05, 0.46, 0.03);
  barnacles(g, rng, 6, 0.36, -0.29, 0.47, -0.1);
  const sand = g.createLinearGradient(0, -0.02, 0, 0.07);
  sand.addColorStop(0, 'rgba(200,180,130,0)');
  sand.addColorStop(1, 'rgba(200,180,130,0.9)');
  g.fillStyle = sand;
  g.beginPath();
  g.moveTo(-0.54, 0.07);
  g.quadraticCurveTo(-0.3, -0.04, 0.0, 0.02);
  g.quadraticCurveTo(0.3, 0.06, 0.54, 0.0);
  g.lineTo(0.54, 0.08);
  g.lineTo(-0.54, 0.08);
  g.fill();
}

function paintChestLid(g, res) {
  const rng = createRng(2929);
  // barrel-top lid seen from the front, hinge line at y = 0 (its bottom edge)
  g.save();
  g.beginPath();
  g.moveTo(-0.48, 0.02);
  g.lineTo(-0.48, -0.1);
  g.quadraticCurveTo(0, -0.3, 0.48, -0.1);
  g.lineTo(0.48, 0.02);
  g.closePath();
  g.clip();
  planks(g, -0.5, -0.25, 0.5, 0.03, 3, rng);
  for (const x of [-0.43, -0.22, 0.22, 0.43]) band(g, x, -0.3, 0.03, 0.05);
  const sh = g.createLinearGradient(0, -0.25, 0, 0.03);
  sh.addColorStop(0, 'rgba(255,240,200,0.18)');
  sh.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = sh;
  g.fillRect(-0.5, -0.3, 1, 0.35);
  barnacles(g, rng, 10, -0.45, -0.2, 0.45, -0.05);
  g.restore();
  // a sprig of pink coral grown on the corner
  g.strokeStyle = '#e07890';
  g.lineWidth = 0.014;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-0.36, -0.13);
  g.lineTo(-0.38, -0.22);
  g.moveTo(-0.37, -0.18);
  g.lineTo(-0.33, -0.24);
  g.moveTo(-0.38, -0.2);
  g.lineTo(-0.43, -0.25);
  g.stroke();
}

export const DRAWERS = {
  pearl_oyster: {
    bounds: { x0: -0.55, x1: 0.55, y0: -0.38, y1: 0.09 },
    mouth: { x: 0.44, y: -0.06 },
    draw(ctx, len, anim, opts) {
      const lenPx = len * (opts.pxScale || 1);
      const base = variant(unitSprite('oy_base', OY_BASE, lenPx, paintOysterBase), opts);
      const lid = variant(unitSprite('oy_lid', OY_LID, lenPx, paintOysterLid), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const gape = hooked ? 0.1 + 0.03 * Math.sin(anim.t * 5) : 0.2 + 0.07 * Math.sin(anim.t * 0.45 + anim.seed * 6);
      drawUnitSprite(ctx, base, len);
      ctx.save();
      ctx.translate(HINGE[0] * len, HINGE[1] * len);
      ctx.rotate(-gape);
      drawUnitSprite(ctx, lid, len);
      ctx.restore();
    },
    drawGlow(ctx, len, anim, opts) {
      const k = glowK(opts);
      const tw = Math.pow(Math.max(0, Math.sin(anim.t * 1.6 + anim.seed * 5)), 3);
      const a0 = ctx.globalAlpha;
      ctx.globalAlpha = a0 * k * 0.35;
      glow(ctx, glowDot('#fff0f4'), 0.16 * len, -0.085 * len, 0.16 * len);
      ctx.globalAlpha = a0 * (0.3 + 0.7 * tw);
      sparkle(ctx, 0.14 * len, -0.11 * len, (0.03 + 0.05 * tw) * len);
      ctx.globalAlpha = a0;
    },
  },
  treasure_chest: {
    bounds: { x0: -0.56, x1: 0.56, y0: -0.62, y1: 0.09 },
    mouth: { x: 0.0, y: -0.3 },
    draw(ctx, len, anim, opts) {
      const lenPx = len * (opts.pxScale || 1);
      const body = variant(unitSprite('ch_body', CH_BODY, lenPx, paintChestBody), opts);
      const lid = variant(unitSprite('ch_lid', CH_LID, lenPx, paintChestLid), opts);
      const hooked = anim.state === 'hooked' || anim.state === 'landed';
      const ajar = 0.12 + (hooked ? 0.03 * Math.sin(anim.t * 4) : 0);
      drawUnitSprite(ctx, body, len);
      if (modeOf(opts) === 0) {
        // faint warm spill so the gold reads even without the glow pass
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha *= 0.25 + 0.05 * Math.sin(anim.t * 2);
        glow(ctx, glowDot('#ffcf4a'), 0, -0.34 * len, 0.5 * len, 0.12 * len);
        ctx.restore();
      }
      // lid: hinged at the back, its front edge lifted (seen from the front: raised and foreshortened)
      ctx.save();
      ctx.translate(0, (-0.3 - ajar * 0.9) * len);
      ctx.scale(1, 1 - ajar * 1.2);
      drawUnitSprite(ctx, lid, len);
      ctx.restore();
    },
    drawGlow(ctx, len, anim, opts) {
      const k = glowK(opts);
      const fl = 0.85 + 0.15 * Math.sin(anim.t * 2.3) * Math.sin(anim.t * 1.3 + 1);
      const a0 = ctx.globalAlpha;
      const gold = glowDot('#ffcf4a');
      ctx.globalAlpha = a0 * k * 0.55 * fl;
      glow(ctx, gold, 0, -0.36 * len, 0.62 * len, 0.2 * len);
      // god-rays of gold light fanning up out of the gap
      ctx.globalAlpha = a0 * k * 0.22 * fl;
      for (let i = -2; i <= 2; i++) {
        ctx.save();
        ctx.translate(i * 0.12 * len, -0.38 * len);
        ctx.rotate(i * 0.22);
        glow(ctx, gold, 0, -0.26 * len, 0.05 * len, 0.3 * len);
        ctx.restore();
      }
      for (let i = 0; i < 4; i++) {
        const tw = Math.pow(Math.max(0, Math.sin(anim.t * 1.9 + i * 1.7)), 4);
        ctx.globalAlpha = a0 * tw;
        sparkle(ctx, (-0.3 + i * 0.2) * len, (-0.36 + (i % 2) * 0.03) * len, 0.05 * len);
      }
      ctx.globalAlpha = a0;
    },
  },
};

/** Four-point star twinkle (additive pass). */
function sparkle(ctx, x, y, s) {
  ctx.fillStyle = '#fff8e0';
  ctx.beginPath();
  ctx.moveTo(x - s, y);
  ctx.quadraticCurveTo(x, y, x, y - s);
  ctx.quadraticCurveTo(x, y, x + s, y);
  ctx.quadraticCurveTo(x, y, x, y + s);
  ctx.quadraticCurveTo(x, y, x - s, y);
  ctx.fill();
}
