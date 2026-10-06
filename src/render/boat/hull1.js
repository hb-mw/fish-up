// TIER 1 — "Bay Breeze": a tidy bay cruiser with a small wheelhouse & hardtop. BOAT ART module (boat-local).
import { createRng } from '../../core/rng.js';
import { vgrad, lgrad } from './util.js';
import { NS, makeHull, paintCooler, paintGelcoat, paintRail, paintBowRail, paintGlass, paintModernOutboard } from './hullkit.js';

export const CRUISER = makeHull({
  sheer: [-206, -53, -80, -46, 120, -45, 230, -78],
  bottom: [-198, 12, -90, 31, 110, 31, 194, 2],
  stem: [225, -42, 210, -8],
  reveal: 13,
  revealStern: 0.72,
});
const H = CRUISER;
const WHITE = '#f3f2ec', NAVY = '#1f3a5f', TEAK = '#a8713c';
const ROOF_Y = -165; // hardtop underside (the lantern hangs from it at x = −120)
const CAB_X0 = -100, CAB_X1 = -22;

function cabinPath(g) {
  const d = H.sheerY(CAB_X1) - 6;
  g.beginPath();
  g.moveTo(CAB_X0, H.sheerY(CAB_X0) - 6);
  g.lineTo(CAB_X0, ROOF_Y);
  g.lineTo(-52, ROOF_Y);
  g.lineTo(-27, -118);
  g.lineTo(CAB_X1, d);
  g.closePath();
}

export function paintCruiserBack(g) {
  const S = H.S;
  // ── far bulwark inner face + far gunwale ──
  g.save();
  g.beginPath();
  H.farLine(g);
  H.nearLineRev(g);
  g.closePath();
  g.clip();
  g.fillStyle = vgrad(g, -95, -40, [[0, '#e6eaec'], [0.6, '#c9d0d4'], [1, '#9aa5ab']]);
  g.fillRect(-230, -100, 480, 70);
  // foredeck non-skid + hatch
  g.fillStyle = vgrad(g, -95, -55, [[0, '#f4f4f0'], [1, '#d6d9d6']]);
  g.fillRect(118, -100, 130, 70);
  g.fillStyle = 'rgba(80,90,100,0.35)';
  g.fillRect(150, H.sheerY(160) - 9, 22, 1.2);
  g.restore();
  g.strokeStyle = TEAK;
  g.lineWidth = 2.6;
  g.beginPath();
  H.farLine(g);
  g.stroke();
  g.strokeStyle = 'rgba(255,225,180,0.6)';
  g.lineWidth = 0.8;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = S[i * 2], y = S[i * 2 + 1] - H.reveal(i / NS) - 0.9;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  paintBowRail(g, H, 112, 222, 15, true);

  // ── aft posts holding the hardtop ──
  for (const [x, c] of [[-196, '#9aa4ab'], [-192, '#dfe5e9']]) {
    g.strokeStyle = c;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(x, H.sheerY(x) - 4);
    g.lineTo(x, ROOF_Y);
    g.stroke();
  }
  // a cooler-seat on the aft deck
  paintCooler(g, -176, -136, -42, 26, '#2f6f9e');

  // ── the wheelhouse ──
  cabinPath(g);
  g.fillStyle = lgrad(g, CAB_X0, 0, CAB_X1, 0, [[0, '#d9dcd8'], [0.25, WHITE], [0.85, '#f8f8f4'], [1, '#d4d8d6']]);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = vgrad(g, ROOF_Y, -45, [[0, 'rgba(0,0,0,0.1)'], [0.15, 'rgba(0,0,0,0)'], [0.8, 'rgba(0,0,0,0)'], [1, 'rgba(0,20,40,0.18)']]);
  g.fillRect(-110, -180, 100, 140);
  g.fillStyle = NAVY;
  g.fillRect(-110, H.sheerY(-60) - 14, 100, 3);
  g.restore();
  g.strokeStyle = 'rgba(60,70,80,0.45)';
  g.lineWidth = 0.8;
  cabinPath(g);
  g.stroke();
  // side window + windshield
  g.beginPath();
  g.roundRect(-94, -142, 46, 34, 4);
  paintGlass(g, -94, -142, 46, 34, '#24425c', 0.8);
  g.beginPath();
  g.roundRect(-94, -142, 46, 34, 4);
  g.strokeStyle = '#c2c9ce';
  g.lineWidth = 1.4;
  g.stroke();
  g.beginPath();
  g.moveTo(-50, ROOF_Y + 5);
  g.lineTo(-31, -121);
  g.lineTo(-38, -121);
  g.lineTo(-56, ROOF_Y + 5);
  g.closePath();
  paintGlass(g, -56, ROOF_Y + 5, 25, 40, '#24425c', 1);
  // teak grab rail under the window
  g.strokeStyle = TEAK;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(-92, -100);
  g.lineTo(-50, -100);
  g.stroke();
  // nav side-light housing on the cabin front corner
  g.fillStyle = '#2b3036';
  g.fillRect(-28, -66, 7, 6);

  // ── hardtop + roof furniture ──
  g.fillStyle = vgrad(g, ROOF_Y - 8, ROOF_Y, [[0, '#ffffff'], [1, '#d7dbdc']]);
  g.beginPath();
  g.moveTo(-210, ROOF_Y);
  g.lineTo(-210, ROOF_Y - 6);
  g.quadraticCurveTo(-120, ROOF_Y - 10, -44, ROOF_Y - 7);
  g.lineTo(-40, ROOF_Y);
  g.closePath();
  g.fill();
  g.fillStyle = NAVY;
  g.fillRect(-210, ROOF_Y - 2.2, 170, 2.2);
  // radar dome
  g.fillStyle = vgrad(g, ROOF_Y - 24, ROOF_Y - 8, [[0, '#ffffff'], [1, '#c9cfd2']]);
  g.beginPath();
  g.ellipse(-76, ROOF_Y - 14, 13, 6.5, 0, Math.PI, 0);
  g.lineTo(-63, ROOF_Y - 10);
  g.lineTo(-89, ROOF_Y - 10);
  g.closePath();
  g.fill();
  g.fillStyle = '#8a9399';
  g.fillRect(-82, ROOF_Y - 10, 12, 2);
  // VHF whip antenna & all-round light mast
  g.strokeStyle = '#f2f2ee';
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(-200, ROOF_Y - 8);
  g.lineTo(-214, ROOF_Y - 58);
  g.stroke();
  g.strokeStyle = '#c3cacf';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-186, ROOF_Y - 8);
  g.lineTo(-186, ROOF_Y - 22);
  g.stroke();
  g.fillStyle = '#f4f2e8';
  g.fillRect(-189, ROOF_Y - 26, 6, 4);
}

export function paintCruiserFront(g, f, name) {
  const rng = createRng(4321);
  paintModernOutboard(g, -206, -52, 'leg');
  paintGelcoat(g, H, { top: WHITE, bottom: '#a3352c', boot: NAVY, stripe: NAVY, stripe2: '#c9a24a', stripeV: [0.1, 0.19], gloss: 0.6 });
  // portholes into the cuddy cabin
  for (const x of [166, 193]) {
    const y = H.sheerY(x) + 21;
    g.fillStyle = '#c9d0d5';
    g.beginPath();
    g.ellipse(x, y, 6.4, 5.6, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(x, y, 4.6, 3.9, 0, 0, Math.PI * 2);
    paintGlass(g, x - 5, y - 4, 10, 8, '#1d3346', 1);
    g.strokeStyle = 'rgba(70,80,90,0.6)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.ellipse(x, y, 6.4, 5.6, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // faint water stains near the waterline aft (it's a working boat, just a tidy one)
  g.save();
  g.beginPath();
  H.outline(g);
  g.clip();
  for (let i = 0; i < 6; i++) {
    const x = -180 + rng.next() * 120;
    g.fillStyle = vgrad(g, -20, -6, [[0, 'rgba(120,110,80,0)'], [1, 'rgba(120,110,80,0.18)']]);
    g.fillRect(x, -20, 2 + rng.next() * 3, 14);
  }
  g.restore();
  // transom edge & stem
  g.strokeStyle = '#c7ccd0';
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(H.S[0], H.S[1]);
  g.lineTo(H.B[0], H.B[1]);
  g.stroke();
  paintRail(g, H);
  paintBowRail(g, H, 112, 222, 15, false);
  // anchor on the bow roller
  const ax = 226, ay = H.sheerY(222) + 1;
  g.fillStyle = '#c4ccd1';
  g.beginPath();
  g.moveTo(ax - 6, ay - 2);
  g.lineTo(ax + 5, ay + 2);
  g.lineTo(ax + 2, ay + 9);
  g.lineTo(ax - 3, ay + 3);
  g.closePath();
  g.fill();
  // a fender hanging over the side
  const fx = -150, fy = H.sheerY(fx);
  g.strokeStyle = '#e8e2d0';
  g.lineWidth = 0.9;
  g.beginPath();
  g.moveTo(fx, fy + 1);
  g.lineTo(fx, fy + 10);
  g.stroke();
  g.fillStyle = lgrad(g, fx - 5, 0, fx + 5, 0, [[0, '#c9ced2'], [0.4, '#ffffff'], [1, '#aab2b8']]);
  g.beginPath();
  g.roundRect(fx - 4.5, fy + 9, 9, 24, 4.5);
  g.fill();
  g.fillStyle = '#1f3a5f';
  g.fillRect(fx - 4.5, fy + 12, 9, 1.6);
  g.fillRect(fx - 4.5, fy + 28, 9, 1.6);
  if (name) {
    g.save();
    g.translate(88, H.sheerY(88) + 23);
    g.rotate(-0.045);
    if (f < 0) g.scale(-1, 1);
    g.font = 'italic bold 9px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(name, 0.4, 0.5);
    g.fillStyle = NAVY;
    g.fillText(name, 0, 0);
    g.restore();
  }
  paintModernOutboard(g, -206, -52, 'head', '#eef1f3', NAVY);
}

export const CRUISER_TIER = {
  id: 1,
  name: 'BAY BREEZE',
  hull: H,
  bounds: { x0: -262, x1: 240, y0: -228, y1: 48 },
  floorY: -10,
  prop: { x: -239, y: 16, r: 9 },
  stern: -206,
  bow: 228,
  draft: 31,
  flag: { x: -200, y0: -54, y1: -112 },
  lampPole: null,
  lampHook: { x: -120, y: ROOF_Y },
  perch: { x: -140, y: ROOF_Y - 8 },
  windows: [{ x: -94, y: -142, w: 46, h: 34 }, { x: -54, y: ROOF_Y + 6, w: 20, h: 38 }],
  nav: { side: { x: -24.5, y: -63 }, mast: { x: -186, y: ROOF_Y - 24 } },
  paintBack: paintCruiserBack,
  paintFront: paintCruiserFront,
};
