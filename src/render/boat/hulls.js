// The three boat hulls, painted ONCE into cached sprites (per tier / layer / facing / resolution). BOAT ART module.
//
// Each tier is split into two layers so the angler can stand INSIDE the boat:
//   'back'  — the far side's inner face, deck gear, cabin/house parts behind the angler
//   'front' — the near topsides, rub rail, waterline, the submerged hull, the outboard — drawn over the angler's legs
// The view is very slightly elevated (we look down onto the far gunwale), which is why the far gunwale sits higher.
// All geometry is in boat-local space: origin = waterline centre, +x = bow, −y = up.
import { clamp, lerp } from '../../core/math.js';
import { createRng } from '../../core/rng.js';
import { makeCanvas, shade, vgrad, lgrad } from './util.js';
import { NS, makeHull, chip, paintBucket, paintCooler, paintTackleBox, paintCoil } from './hullkit.js';
import { CRUISER_TIER } from './hull1.js';
import { SPORT_TIER } from './hull2.js';

// ── TIER 0: the old wooden skiff ────────────────────────────────────────────
const SKIFF = makeHull({
  sheer: [-197, -47, -80, -36, 110, -35, 214, -63],
  bottom: [-189, 11, -90, 28, 100, 27, 176, 5],
  stem: [212, -36, 199, -6],
  reveal: 12,
  revealStern: 0.62,
});

function paintSkiffBack(g, f) {
  const H = SKIFF;
  const rng = createRng(77);
  const S = H.S;
  // ── the far side's inner face (between the far gunwale and the near gunwale) ──
  g.save();
  g.beginPath();
  H.farLine(g);
  H.nearLineRev(g);
  g.closePath();
  g.clip();
  g.fillStyle = vgrad(g, -78, -34, [[0, '#a9c0c6'], [0.55, '#86a2ab'], [1, '#56707a']]);
  g.fillRect(-210, -90, 430, 70);
  // planks on the inside (faint) + frames
  g.strokeStyle = 'rgba(40,60,70,0.25)';
  g.lineWidth = 0.6;
  g.beginPath();
  for (let i = 0; i <= NS; i += 3) {
    const u = i / NS, x = S[i * 2], y = S[i * 2 + 1] - H.reveal(u) * 0.55;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  for (let i = 4; i < NS - 6; i += 6) {
    const u = i / NS, x = S[i * 2], yT = S[i * 2 + 1] - H.reveal(u);
    g.fillStyle = 'rgba(45,62,70,0.35)';
    g.fillRect(x - 1.4, yT, 2.6, 30);
    g.fillStyle = 'rgba(220,235,238,0.35)';
    g.fillRect(x - 1.4, yT, 0.8, 30);
  }
  // foredeck (bow) seen from above: varnished planks
  const fx0 = 138;
  g.fillStyle = vgrad(g, -76, -50, [[0, '#d2a46a'], [1, '#a8763f']]);
  g.beginPath();
  g.moveTo(fx0, -80);
  g.lineTo(230, -80);
  g.lineTo(230, -30);
  g.lineTo(fx0, -30);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(90,55,25,0.5)';
  g.lineWidth = 0.6;
  g.beginPath();
  for (let k = 1; k < 4; k++) {
    for (let i = H.uAtX(fx0) * NS | 0; i <= NS; i++) {
      const u = i / NS, x = S[i * 2], y = S[i * 2 + 1] - H.reveal(u) * (k / 4);
      if (i === (H.uAtX(fx0) * NS | 0)) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
  }
  g.stroke();
  g.fillStyle = 'rgba(70,40,15,0.5)';
  g.fillRect(fx0 - 1, -80, 2, 50);
  g.restore();

  // ── far gunwale cap (varnished) ──
  g.lineCap = 'round';
  g.strokeStyle = '#6e4423';
  g.lineWidth = 3.2;
  g.beginPath();
  H.farLine(g);
  g.stroke();
  g.strokeStyle = '#c08a52';
  g.lineWidth = 1.3;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const u = i / NS;
    const x = S[i * 2], y = S[i * 2 + 1] - H.reveal(u) - 0.9;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // far oarlock
  const ox = -18, oy = H.sheerY(ox) - H.reveal(H.uAtX(ox));
  g.strokeStyle = '#a77a3c';
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(ox - 3.5, oy - 6);
  g.quadraticCurveTo(ox, oy - 1, ox + 3.5, oy - 6);
  g.moveTo(ox, oy - 2);
  g.lineTo(ox, oy + 1);
  g.stroke();

  // ── gear inside the boat (their bases are hidden behind the near side) ──
  // tackle box on the stern seat
  paintTackleBox(g, -176, -146, -36, 25);
  // galvanised bait bucket
  paintBucket(g, -104, -34, 22, 28);
  // cooler on the middle thwart
  paintCooler(g, -70, -26, -34, 28);
  // a rope coil + cleat on the foredeck
  const cy = H.sheerY(172) - H.reveal(H.uAtX(172)) * 0.5;
  paintCoil(g, 172, cy, 13, 3);
  g.fillStyle = '#b7bfc4';
  g.fillRect(193, H.sheerY(196) - 9, 9, 2.2);
  g.fillRect(196.5, H.sheerY(196) - 9, 2.2, 5);
  // rope tail from the coil to the stem ring
  g.strokeStyle = '#b8935c';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(184, cy - 2);
  g.quadraticCurveTo(196, cy - 4, 206, H.sheerY(206) - 3);
  g.stroke();
}

function paintSkiffFront(g, f, name) {
  const H = SKIFF;
  const rng = createRng(1234);
  const BLUE = '#2e6f9e', CREAM = '#efe5cf', RED = '#a8402b', WOOD = '#8a5428';
  const PLANKS = [0, 0.15, 0.3, 0.45, 0.6, 0.77, 1.0];
  const tp = { x: 0, y: 0 };

  // ── the outboard's leg sits behind the transom: paint it first ──
  paintOutboard(g, 'leg');

  g.save();
  g.beginPath();
  H.outline(g);
  g.clip();
  // planks, above the waterline (cream, the sheer strake blue)
  const WL = -0.5;
  g.save();
  g.beginPath();
  g.rect(-260, -120, 520, 120 + WL);
  g.clip();
  for (let p = 0; p < PLANKS.length - 1; p++) {
    const base = p === 0 ? BLUE : CREAM;
    const v0 = PLANKS[p], v1 = PLANKS[p + 1];
    const subs = [0.06, 0.02, -0.02, -0.06];
    for (let s = 0; s < subs.length; s++) {
      const a = lerp(v0, v1, s / subs.length), b = lerp(v0, v1, (s + 1) / subs.length);
      g.beginPath();
      H.band(g, a, b + 0.004);
      g.fillStyle = shade(base, subs[s] - 0.1 * v0);
      g.fill();
    }
  }
  g.restore();
  // below the waterline: antifouling red, darker toward the keel
  g.save();
  g.beginPath();
  g.rect(-260, WL, 520, 80);
  g.clip();
  for (let p = 0; p < PLANKS.length - 1; p++) {
    const v0 = PLANKS[p], v1 = PLANKS[p + 1];
    for (let s = 0; s < 4; s++) {
      const a = lerp(v0, v1, s / 4), b = lerp(v0, v1, (s + 1) / 4);
      g.beginPath();
      H.band(g, a, b + 0.004);
      g.fillStyle = shade(RED, [0.05, 0.01, -0.03, -0.07][s] - 0.28 * v0);
      g.fill();
    }
  }
  g.restore();

  // clinker lands: shadow under each plank edge + a crisp lit edge
  for (let p = 1; p < PLANKS.length - 1; p++) {
    const v = PLANKS[p];
    g.beginPath();
    H.band(g, v, v + 0.035);
    g.fillStyle = 'rgba(40,24,12,0.16)';
    g.fill();
    g.beginPath();
    H.vline(g, v);
    g.strokeStyle = 'rgba(48,30,16,0.55)';
    g.lineWidth = 0.9;
    g.stroke();
    g.beginPath();
    H.vline(g, v - 0.012);
    g.strokeStyle = 'rgba(255,250,235,0.35)';
    g.lineWidth = 0.6;
    g.stroke();
    // copper clench nails along the land
    g.fillStyle = 'rgba(120,150,120,0.75)';
    for (let u = 0.03; u < 0.98; u += 0.034) {
      H.pt(u, v - 0.02, tp);
      if (tp.y > -1 && tp.y < 3) continue;
      g.beginPath();
      g.arc(tp.x, tp.y, 0.55, 0, Math.PI * 2);
      g.fill();
    }
  }
  // overall form shading: the hull turns away at bow & stern and under at the bilge
  g.fillStyle = lgrad(g, -200, 0, 215, 0, [[0, 'rgba(30,20,10,0.28)'], [0.12, 'rgba(30,20,10,0)'], [0.8, 'rgba(30,20,10,0)'], [1, 'rgba(30,20,10,0.22)']]);
  g.fillRect(-260, -120, 520, 200);
  g.fillStyle = vgrad(g, -60, 30, [[0, 'rgba(255,250,235,0.10)'], [0.35, 'rgba(0,0,0,0)'], [1, 'rgba(10,6,4,0.35)']]);
  g.fillRect(-260, -120, 520, 200);

  // weathering: chipped paint showing wood / old green coat, rust & grime streaks
  for (let i = 0; i < 46; i++) {
    const u = 0.04 + rng.next() * 0.92;
    const v = PLANKS[1 + ((rng.next() * 3) | 0)] - 0.01 - rng.next() * 0.06;
    H.pt(u, i < 14 ? rng.next() * 0.05 : v, tp);
    if (tp.y > -5) continue;
    const old = rng.next() < 0.35;
    chip(g, rng, tp.x, tp.y, 0.7 + rng.next() * 1.6, old ? 'rgba(96,140,118,0.85)' : 'rgba(164,118,72,0.9)', 'rgba(60,35,18,0.35)');
  }
  for (let i = 0; i < 9; i++) {
    const x = -170 + rng.next() * 330;
    const y0 = H.sheerY(x) + 3;
    const len = 6 + rng.next() * 16;
    g.fillStyle = vgrad(g, y0, y0 + len, [[0, 'rgba(120,70,30,0.32)'], [1, 'rgba(120,70,30,0)']]);
    g.fillRect(x, y0, 1 + rng.next() * 1.4, len);
  }
  // grime + algae just above the waterline, slime below
  g.fillStyle = vgrad(g, -12, 2, [[0, 'rgba(90,100,60,0)'], [1, 'rgba(90,100,60,0.4)']]);
  g.fillRect(-260, -12, 520, 14);
  g.fillStyle = vgrad(g, 0, 12, [[0, 'rgba(60,90,50,0.55)'], [1, 'rgba(60,90,50,0)']]);
  g.fillRect(-260, 0, 520, 12);
  // boot stripe + the wet band
  g.fillStyle = '#26332f';
  g.fillRect(-260, -4.2, 520, 3.6);
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(-260, -4.2, 520, 0.7);
  g.fillStyle = vgrad(g, -9, 3, [[0, 'rgba(10,20,25,0)'], [0.5, 'rgba(10,20,25,0.12)'], [1, 'rgba(10,20,25,0.25)']]);
  g.fillRect(-260, -9, 520, 12);
  // a few barnacles near the keel & skeg
  g.fillStyle = 'rgba(225,220,200,0.8)';
  for (let i = 0; i < 26; i++) {
    const x = -180 + rng.next() * 340;
    const y = H.bottomY(x) - 1 - rng.next() * 6;
    g.beginPath();
    g.arc(x, y, 0.5 + rng.next() * 0.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore(); // end hull clip

  // keel strip + skeg
  g.strokeStyle = '#4a2a18';
  g.lineWidth = 2.6;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = H.B[i * 2], y = H.B[i * 2 + 1] + 0.6;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#5a3420';
  g.beginPath();
  g.moveTo(-120, H.bottomY(-120));
  g.lineTo(-178, H.bottomY(-178) + 9);
  g.lineTo(-186, H.bottomY(-186) + 8);
  g.lineTo(-186, H.bottomY(-186));
  g.closePath();
  g.fill();
  // stem post + bronze stem band
  const st = H.def.stem;
  g.strokeStyle = '#6d3f1f';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(H.S[NS * 2], H.S[NS * 2 + 1]);
  g.bezierCurveTo(st[0], st[1], st[2], st[3], H.B[NS * 2], H.B[NS * 2 + 1]);
  g.stroke();
  g.strokeStyle = '#c99a50';
  g.lineWidth = 1.1;
  g.beginPath();
  g.moveTo(H.S[NS * 2] - 0.6, H.S[NS * 2 + 1] + 1);
  g.bezierCurveTo(st[0] - 0.6, st[1], st[2] - 0.6, st[3], H.B[NS * 2], H.B[NS * 2 + 1]);
  g.stroke();
  // transom edge
  g.strokeStyle = '#6d3f1f';
  g.lineWidth = 2.6;
  g.beginPath();
  g.moveTo(H.S[0], H.S[1]);
  g.lineTo(H.B[0], H.B[1]);
  g.stroke();

  // rub rail / gunwale cap along the sheer
  g.lineCap = 'round';
  g.strokeStyle = shade(WOOD, -0.35);
  g.lineWidth = 4.6;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = H.S[i * 2], y = H.S[i * 2 + 1] + 1.6;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.strokeStyle = WOOD;
  g.lineWidth = 3;
  g.stroke();
  g.strokeStyle = 'rgba(255,215,160,0.65)';
  g.lineWidth = 0.9;
  g.beginPath();
  for (let i = 0; i <= NS; i++) {
    const x = H.S[i * 2], y = H.S[i * 2 + 1] + 0.6;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  // worn spots on the rail
  for (let i = 0; i < 10; i++) {
    const x = -180 + rng.next() * 370;
    g.fillStyle = 'rgba(205,165,115,0.55)';
    g.fillRect(x, H.sheerY(x) + 0.5, 2 + rng.next() * 5, 1.2);
  }
  // near oarlock (bronze) on the rail
  const ox = -18, oy = H.sheerY(ox);
  g.strokeStyle = '#b5873f';
  g.lineWidth = 1.8;
  g.beginPath();
  g.moveTo(ox - 4, oy - 7);
  g.quadraticCurveTo(ox, oy - 1, ox + 4, oy - 7);
  g.moveTo(ox, oy - 2);
  g.lineTo(ox, oy + 2);
  g.stroke();
  // bronze bow eye (towing ring)
  g.strokeStyle = '#b5873f';
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(203, -24, 2.4, 0, Math.PI * 2);
  g.stroke();

  // hand-painted name near the bow (never mirrored)
  if (name) {
    const nx = 120, ny = H.sheerY(120) + 14;
    g.save();
    g.translate(nx, ny);
    g.rotate(-0.07);
    if (f < 0) g.scale(-1, 1);
    g.font = 'italic bold 8.5px Georgia, "Times New Roman", serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.fillText(name, 0.4, 0.5);
    g.fillStyle = '#1f4466';
    g.fillText(name, 0, 0);
    g.restore();
  }

  // the outboard motor on the transom
  paintOutboard(g, 'head');
}

/** Vintage outboard. part 'leg' = shaft/gearcase (behind the transom), 'head' = cowling, tiller, clamp. */
function paintOutboard(g, part) {
  if (part === 'leg') {
    // shaft
    g.fillStyle = lgrad(g, -216, 0, -203, 0, [[0, '#5e676d'], [0.45, '#b4bec3'], [1, '#6b757b']]);
    g.beginPath();
    g.moveTo(-216, -48);
    g.lineTo(-204, -48);
    g.lineTo(-205, 16);
    g.lineTo(-214, 16);
    g.closePath();
    g.fill();
    // cavitation plate
    g.fillStyle = '#7d878d';
    g.fillRect(-226, 13, 30, 2.6);
    // gearcase torpedo
    g.fillStyle = lgrad(g, 0, 17, 0, 29, [[0, '#a9b3b8'], [0.5, '#7c868c'], [1, '#4c555b']]);
    g.beginPath();
    g.ellipse(-210, 22.5, 14, 4.8, 0, 0, Math.PI * 2);
    g.fill();
    // skeg fin
    g.fillStyle = '#69737a';
    g.beginPath();
    g.moveTo(-214, 26);
    g.lineTo(-208, 26);
    g.lineTo(-210, 37);
    g.lineTo(-215, 36);
    g.closePath();
    g.fill();
    // anode
    g.fillStyle = '#9a9a8a';
    g.fillRect(-206, 15.6, 5, 2);
    return;
  }
  // clamp bracket over the transom
  g.fillStyle = '#4b5359';
  g.beginPath();
  g.roundRect(-206, -52, 12, 16, 2);
  g.fill();
  g.fillStyle = '#2f3438';
  g.fillRect(-194, -46, 5, 3);
  g.fillRect(-190, -48.5, 1.6, 8); // clamp screw T-handle
  // lower cowl (exhaust housing)
  g.fillStyle = lgrad(g, -228, 0, -200, 0, [[0, '#3b4146'], [0.5, '#5d666c'], [1, '#353b40']]);
  g.beginPath();
  g.moveTo(-229, -52);
  g.lineTo(-201, -52);
  g.lineTo(-204, -44);
  g.lineTo(-226, -44);
  g.closePath();
  g.fill();
  // cowling: vintage red with a cream band
  const red = '#c0432f';
  g.fillStyle = lgrad(g, -238, 0, -198, 0, [[0, shade(red, -0.35)], [0.4, shade(red, 0.1)], [0.75, red], [1, shade(red, -0.25)]]);
  g.beginPath();
  g.moveTo(-232, -52);
  g.bezierCurveTo(-240, -62, -238, -84, -224, -88);
  g.bezierCurveTo(-214, -91, -204, -88, -200, -80);
  g.bezierCurveTo(-197, -72, -198, -58, -200, -52);
  g.closePath();
  g.fill();
  g.save();
  g.clip();
  g.fillStyle = '#efe2c4';
  g.fillRect(-242, -70, 46, 6);
  g.fillStyle = 'rgba(80,30,20,0.6)';
  g.fillRect(-242, -64, 46, 1);
  // badge
  g.fillStyle = '#d9dee1';
  g.beginPath();
  g.ellipse(-214, -67, 5, 2.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#2b5c86';
  g.beginPath();
  g.ellipse(-214, -67, 3.6, 1.3, 0, 0, Math.PI * 2);
  g.fill();
  // glossy highlight
  g.fillStyle = 'rgba(255,240,230,0.35)';
  g.beginPath();
  g.ellipse(-222, -80, 9, 4, -0.3, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = 'rgba(60,15,10,0.6)';
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(-232, -52);
  g.bezierCurveTo(-240, -62, -238, -84, -224, -88);
  g.bezierCurveTo(-214, -91, -204, -88, -200, -80);
  g.bezierCurveTo(-197, -72, -198, -58, -200, -52);
  g.stroke();
  // rewind starter grip on top
  g.strokeStyle = '#222';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-218, -89);
  g.lineTo(-218, -92);
  g.stroke();
  g.fillStyle = '#1d1d1d';
  g.fillRect(-223, -94, 10, 2.6);
  // tiller arm + twist grip
  g.strokeStyle = '#3d4449';
  g.lineWidth = 3.4;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-203, -60);
  g.lineTo(-174, -61);
  g.stroke();
  g.strokeStyle = '#191b1d';
  g.lineWidth = 4.4;
  g.beginPath();
  g.moveTo(-174, -61);
  g.lineTo(-160, -61.5);
  g.stroke();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(-173, -62.5);
  g.lineTo(-161, -63);
  g.stroke();
  // fuel hose into the boat
  g.strokeStyle = '#1a1a1a';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(-201, -56);
  g.bezierCurveTo(-192, -58, -186, -54, -182, -46);
  g.stroke();
}

// ── tier registry ────────────────────────────────────────────────────────────
export const TIERS = [
  {
    id: 0,
    name: 'MINNOW',
    hull: SKIFF,
    // sprite bounds in local px (must contain everything painted)
    bounds: { x0: -246, x1: 226, y0: -104, y1: 44 },
    floorY: -10,
    /** prop hub (live-drawn), wake source points */
    prop: { x: -225, y: 22.5, r: 9 },
    stern: -199,
    bow: 206,
    draft: 26,
    /** flag staff base & top */
    flag: { x: -192, y0: -47, y1: -104 },
    /** lamp pole foot (the lantern itself hangs at RIG.lamp) */
    lampPole: { x: -136, y0: -36, y1: -176 },
    /** where the ship's cat sits */
    perch: { x: -46, y: -62 },
    windows: [],
    nav: null,
    paintBack: paintSkiffBack,
    paintFront: paintSkiffFront,
  },
  CRUISER_TIER,
  SPORT_TIER,
];

// ── sprite cache ──────────────────────────────────────────────────────────────
const cache = new Map();
const RES_BUCKETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5];
export function resBucket(need) {
  for (const r of RES_BUCKETS) if (r >= need * 0.97) return r;
  return RES_BUCKETS[RES_BUCKETS.length - 1];
}

/**
 * Cached sprite of one layer of a tier. facing ±1 bakes the mirroring in (so painted text stays readable).
 * Returns { canvas, x, y, w, h } — draw it at local (x, y) with size (w, h) (local px) in a frame that is
 * ALREADY scaled by (visFacing / facing, 1).
 */
export function hullSprite(tier, layer, facing, res) {
  const T = TIERS[tier] || TIERS[0];
  const key = T.id + '|' + layer + '|' + facing + '|' + res;
  let e = cache.get(key);
  if (e) return e;
  const b = T.bounds;
  const pad = 2;
  const w = (b.x1 - b.x0) * res + pad * 2, h = (b.y1 - b.y0) * res + pad * 2;
  const canvas = makeCanvas(w, h);
  const g = canvas.getContext('2d');
  const minX = facing > 0 ? b.x0 : -b.x1;
  g.setTransform(res * facing, 0, 0, res, pad - minX * res, pad - b.y0 * res);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (layer === 'back') T.paintBack(g, facing);
  else T.paintFront(g, facing, T.name);
  e = { canvas, x: minX - pad / res, y: b.y0 - pad / res, w: canvas.width / res, h: canvas.height / res };
  cache.set(key, e);
  // keep memory bounded: drop other resolutions of the same tier/layer/facing
  for (const k of cache.keys()) {
    if (k !== key && k.startsWith(T.id + '|' + layer + '|' + facing + '|')) cache.delete(k);
  }
  return e;
}

