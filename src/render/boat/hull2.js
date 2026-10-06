// TIER 2 — "Reel Deal": a gleaming sport-fisher with flybridge, hardtop and outriggers. BOAT ART module.
import { vgrad, lgrad } from './util.js';
import { makeHull, paintGelcoat, paintRail, paintBowRail, paintGlass } from './hullkit.js';

export const SPORT = makeHull({
  sheer: [-246, -59, -100, -61, 130, -60, 266, -97],
  bottom: [-236, 14, -110, 37, 120, 37, 218, 0],
  stem: [260, -54, 240, -14],
  reveal: 14,
  revealStern: 0.8,
});
const H = SPORT;
const NAVY = '#16284a', GOLD = '#d9b45c', WHITE = '#f5f5f1', STEEL = '#dde3e7';
const ROOF = -126, BRIDGE = -152, TOP = -205;

function housePath(g) {
  g.beginPath();
  g.moveTo(-206, H.sheerY(-206) - 7);
  g.lineTo(-206, ROOF);
  g.lineTo(-72, ROOF);
  g.lineTo(-36, -94);
  g.lineTo(-30, H.sheerY(-30) - 7);
  g.closePath();
}

function pole(g, x0, y0, x1, y1, w, col, hi) {
  g.strokeStyle = col;
  g.lineWidth = w;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  if (hi) {
    g.strokeStyle = hi;
    g.lineWidth = w * 0.35;
    g.beginPath();
    g.moveTo(x0 - 0.4, y0 - 0.4);
    g.lineTo(x1 - 0.4, y1 - 0.4);
    g.stroke();
  }
}

export function paintSportBack(g) {
  const S = H.S;
  g.lineCap = 'round';
  // outriggers (far one first, fainter), with spreaders & halyards
  pole(g, -140, TOP - 2, -300, -352, 2, '#a9b2b8', null);
  pole(g, -150, TOP - 2, -322, -338, 2.6, '#cfd6db', 'rgba(255,255,255,0.9)');
  g.strokeStyle = 'rgba(230,236,240,0.7)';
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(-322, -338);
  g.lineTo(-196, TOP - 2);
  g.moveTo(-262, -287);
  g.lineTo(-196, TOP - 2);
  g.stroke();
  // rocket-launcher rods on the hardtop, gold reels
  for (let i = 0; i < 4; i++) {
    const bx = -196 + i * 9, by = TOP - 4;
    pole(g, bx, by, bx - 44 + i * 3, by - 70 + i * 4, 1.4, '#20242a', null);
    g.fillStyle = GOLD;
    g.beginPath();
    g.ellipse(bx - 5, by - 7, 2.6, 2.2, 0, 0, Math.PI * 2);
    g.fill();
  }
  // antennas
  pole(g, -88, TOP - 4, -106, -292, 1.5, '#f1f1ec', null);
  pole(g, -80, TOP - 4, -94, -268, 1.2, '#e6e6e0', null);

  // far bulwark + far gunwale
  g.save();
  g.beginPath();
  H.farLine(g);
  H.nearLineRev(g);
  g.closePath();
  g.clip();
  g.fillStyle = vgrad(g, -110, -50, [[0, '#eceff0'], [0.6, '#cfd5d8'], [1, '#9ea8ae']]);
  g.fillRect(-260, -120, 540, 80);
  g.fillStyle = vgrad(g, -110, -70, [[0, '#f6f6f2'], [1, '#d9dcd9']]);
  g.fillRect(100, -120, 180, 80);
  g.restore();
  g.strokeStyle = '#b5bdc2';
  g.lineWidth = 2.6;
  g.beginPath();
  H.farLine(g);
  g.stroke();
  paintBowRail(g, H, 120, 256, 17, true);

  // ── house ──
  housePath(g);
  g.fillStyle = lgrad(g, -206, 0, -30, 0, [[0, '#d8dbd8'], [0.2, WHITE], [0.85, '#fbfbf8'], [1, '#d2d6d5']]);
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = vgrad(g, ROOF, -60, [[0, 'rgba(0,0,0,0.06)'], [0.75, 'rgba(0,0,0,0)'], [1, 'rgba(0,20,40,0.16)']]);
  g.fillRect(-220, ROOF, 200, 70);
  g.restore();
  // long smoked wraparound windows
  g.beginPath();
  g.moveTo(-194, -117);
  g.lineTo(-74, -117);
  g.lineTo(-48, -97);
  g.lineTo(-194, -97);
  g.closePath();
  paintGlass(g, -194, -117, 146, 20, '#0f1b26', 1.1);
  g.strokeStyle = 'rgba(30,40,50,0.6)';
  g.lineWidth = 0.7;
  g.stroke();
  // mullions
  g.fillStyle = '#1a232b';
  g.fillRect(-150, -117, 2, 20);
  g.fillRect(-104, -117, 2, 20);
  // gold pinstripe along the house
  g.fillStyle = GOLD;
  g.fillRect(-206, -90, 172, 1.2);

  // ── flybridge ──
  g.fillStyle = lgrad(g, -192, 0, -62, 0, [[0, '#dadcd8'], [0.3, WHITE], [1, '#e3e5e2']]);
  g.beginPath();
  g.moveTo(-194, ROOF);
  g.lineTo(-194, BRIDGE);
  g.lineTo(-92, BRIDGE);
  g.lineTo(-64, ROOF);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(60,70,80,0.35)';
  g.lineWidth = 0.7;
  g.stroke();
  g.fillStyle = NAVY;
  g.fillRect(-194, BRIDGE + 4, 98, 2.4);
  // bridge rails
  g.strokeStyle = STEEL;
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-194, BRIDGE - 10);
  g.lineTo(-94, BRIDGE - 10);
  for (const x of [-190, -160, -130, -100]) {
    g.moveTo(x, BRIDGE);
    g.lineTo(x, BRIDGE - 10);
  }
  g.stroke();
  // hardtop frame & top
  g.strokeStyle = '#c9d1d6';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(-186, BRIDGE);
  g.lineTo(-180, TOP);
  g.moveTo(-98, BRIDGE);
  g.lineTo(-86, TOP);
  g.stroke();
  g.fillStyle = vgrad(g, TOP - 8, TOP, [[0, '#ffffff'], [1, '#d4d8da']]);
  g.beginPath();
  g.moveTo(-204, TOP);
  g.lineTo(-202, TOP - 6);
  g.quadraticCurveTo(-140, TOP - 10, -70, TOP - 6);
  g.lineTo(-64, TOP);
  g.closePath();
  g.fill();
  g.fillStyle = NAVY;
  g.fillRect(-204, TOP - 2, 140, 2.2);
  // helm: wheel peeking over the coaming
  g.strokeStyle = '#2a2f35';
  g.lineWidth = 1.4;
  g.beginPath();
  g.ellipse(-112, BRIDGE - 5, 2.5, 6, 0.2, 0, Math.PI * 2);
  g.stroke();
  // nav light housing
  g.fillStyle = '#2b3036';
  g.fillRect(-36, -76, 7, 6);
  g.fillStyle = '#f4f2e8';
  g.fillRect(-103, TOP - 12, 6, 6);
}

export function paintSportFront(g, f, name) {
  // running gear under the hull: strut, shaft, rudder (prop is live)
  g.strokeStyle = '#8f969c';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(-120, H.bottomY(-120) - 2);
  g.lineTo(-196, 31);
  g.moveTo(-170, H.bottomY(-170) - 1);
  g.lineTo(-176, 30);
  g.stroke();
  g.fillStyle = '#7d858b';
  g.beginPath();
  g.moveTo(-210, H.bottomY(-210) - 2);
  g.lineTo(-204, H.bottomY(-204) - 2);
  g.lineTo(-206, 46);
  g.lineTo(-216, 44);
  g.closePath();
  g.fill();

  paintGelcoat(g, H, { top: NAVY, bottom: '#8f2a25', boot: '#f2f0ea', stripe: GOLD, stripeV: [0.115, 0.135], gloss: 1.15 });
  g.save();
  g.beginPath();
  H.outline(g);
  g.clip();
  // the gleam: a crisp sun streak + sky band on the dark paint
  g.beginPath();
  H.band(g, 0.17, 0.19);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fill();
  g.beginPath();
  H.band(g, 0.28, 0.45);
  g.fillStyle = 'rgba(140,190,230,0.12)';
  g.fill();
  // long tinted hull windows forward
  g.beginPath();
  const wy = (x) => H.sheerY(x) + 16;
  g.moveTo(110, wy(110));
  g.lineTo(196, wy(196) - 1);
  g.lineTo(194, wy(194) + 5);
  g.lineTo(112, wy(112) + 6);
  g.closePath();
  paintGlass(g, 110, wy(196) - 2, 88, 12, '#0b1219', 0.9);
  // exhaust ports at the transom
  g.fillStyle = '#0b1016';
  for (const x of [-232, -214]) {
    g.beginPath();
    g.ellipse(x, -9, 4, 2.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // swim platform
  g.fillStyle = lgrad(g, 0, -10, 0, -4, [[0, '#d4a066'], [1, '#8d5c2c']]);
  g.fillRect(-262, -10, 20, 5);
  g.strokeStyle = 'rgba(80,45,15,0.6)';
  g.lineWidth = 0.6;
  g.beginPath();
  for (let x = -260; x < -244; x += 3) {
    g.moveTo(x, -10);
    g.lineTo(x, -5);
  }
  g.stroke();
  paintRail(g, H, '#eef2f4', '#9aa3aa');
  paintBowRail(g, H, 120, 256, 17, false);
  // stainless anchor in the pulpit
  const ax = 262, ay = H.sheerY(258) + 2;
  g.fillStyle = lgrad(g, ax - 6, 0, ax + 6, 0, [[0, '#9aa3a9'], [0.5, '#ffffff'], [1, '#8a939a']]);
  g.beginPath();
  g.moveTo(ax - 7, ay - 2);
  g.lineTo(ax + 6, ay + 3);
  g.lineTo(ax + 2, ay + 11);
  g.lineTo(ax - 3, ay + 4);
  g.closePath();
  g.fill();
  // sparkle glints — it gleams
  for (const [x, y, s] of [[60, H.sheerY(60) + 9, 4], [-150, H.sheerY(-150) + 10, 3], [200, H.sheerY(200) + 8, 3.4]]) {
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath();
    g.moveTo(x - s * 2, y);
    g.quadraticCurveTo(x, y, x, y - s);
    g.quadraticCurveTo(x, y, x + s * 2, y);
    g.quadraticCurveTo(x, y, x, y + s);
    g.quadraticCurveTo(x, y, x - s * 2, y);
    g.fill();
  }
  if (name) {
    g.save();
    g.translate(30, H.sheerY(30) + 27);
    g.rotate(-0.02);
    if (f < 0) g.scale(-1, 1);
    g.font = 'italic bold 11px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.fillText(name, 0.6, 0.8);
    g.fillStyle = GOLD;
    g.fillText(name, 0, 0);
    g.restore();
  }
}

export const SPORT_TIER = {
  id: 2,
  name: 'REEL DEAL',
  hull: H,
  bounds: { x0: -340, x1: 276, y0: -362, y1: 54 },
  floorY: -10,
  prop: { x: -197, y: 31, r: 10 },
  stern: -246,
  bow: 262,
  draft: 37,
  flag: { x: -238, y0: -60, y1: -120 },
  lampPole: null,
  lampHook: { x: -120, y: BRIDGE - 10 },
  perch: { x: -150, y: BRIDGE },
  windows: [{ x: -194, y: -117, w: 140, h: 20 }],
  nav: { side: { x: -32.5, y: -73 }, mast: { x: -100, y: TOP - 9 } },
  paintBack: paintSportBack,
  paintFront: paintSportFront,
};
