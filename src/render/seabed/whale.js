// Whale fall on the abyssal plain: skull with long jaw bones, an arched chain of vertebrae half sunk in the
// ooze, ribs (some fallen), a flipper; furred with white/yellow bacterial mats and red bone-eating worms.
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, rad, contactShadow } from './paint.js';

export const WHALE_X = 8800;
const BONE = H('#e6dcc4');

function bone(g, x0, y0, x1, y1, w) {
  g.strokeStyle = rgbk(BONE, 0.62);
  g.lineWidth = w + 2;
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.stroke();
  g.strokeStyle = rgbk(BONE);
  g.lineWidth = w;
  g.stroke();
  g.strokeStyle = lite(BONE, 0.5, 0.7);
  g.lineWidth = Math.max(0.8, w * 0.3);
  g.beginPath();
  g.moveTo(x0, y0 - w * 0.25);
  g.lineTo(x1, y1 - w * 0.25);
  g.stroke();
}

defType({
  id: 'whalefall', variants: 1, box: { x0: -190, y0: -110, x1: 230, y1: 20 }, foot: 180, noFade: true,
  paint(g, v, rng) {
    // organic stain in the sediment
    contactShadow(g, 10, 220, 16, 0.45);
    // vertebral column (head on the left), arching slightly, sinking toward the tail
    const verts = [];
    for (let i = 0; i < 30; i++) {
      const f = i / 29;
      const x = -96 + f * 316;
      const y = -18 - 16 * Math.sin(f * Math.PI * 0.9) + f * 12;
      verts.push([x, y, 11 * (1 - f * 0.7)]);
    }
    // ribs behind the spine
    for (let i = 0; i < 13; i++) {
      const [x, y] = verts[2 + i];
      const fallen = i % 5 === 3;
      const len = 84 - i * 4.2;
      g.strokeStyle = rgbk(BONE, 0.62);
      g.lineCap = 'round';
      for (const [w, col] of [[6.5, rgbk(BONE, 0.6)], [4.5, rgbk(BONE, 0.95)], [1.4, lite(BONE, 0.5, 0.7)]]) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        if (fallen) {
          g.moveTo(x + 6, 6);
          g.quadraticCurveTo(x + len * 0.5, -6, x + len, 4);
        } else {
          // arch up from the spine and back down to the sediment in front of it
          g.moveTo(x, y);
          g.bezierCurveTo(x - 6, y - len * 0.9, x + 26, y - len * 0.95, x + 30, 5);
        }
        g.stroke();
      }
    }
    // the vertebrae: spool-shaped bones with processes
    for (const [x, y, r] of verts) {
      g.fillStyle = rad(g, x - r * 0.3, y - r * 0.4, 0.5, x, y, r * 1.2, [[0, lite(BONE, 0.4)], [0.6, rgbk(BONE)], [1, rgbk(BONE, 0.55)]]);
      g.beginPath();
      g.ellipse(x, y, r * 0.75, r, 0, 0, TAU);
      g.fill();
      bone(g, x, y - r * 0.6, x - 2, y - r * 1.9, Math.max(1.5, r * 0.32));
    }
    // skull: broad cranium + long rostrum, two bowed mandibles
    g.fillStyle = rad(g, -130, -46, 2, -120, -30, 70, [[0, lite(BONE, 0.45)], [0.6, rgbk(BONE)], [1, rgbk(BONE, 0.55)]]);
    g.beginPath();
    g.moveTo(-88, -6);
    g.quadraticCurveTo(-96, -56, -134, -50);
    g.lineTo(-182, -30);
    g.quadraticCurveTo(-186, -24, -178, -22);
    g.lineTo(-120, -20);
    g.quadraticCurveTo(-100, -14, -92, 2);
    g.closePath();
    g.fill();
    g.fillStyle = '#2a2420';
    g.beginPath();
    g.ellipse(-112, -32, 7, 5, 0.2, 0, TAU); // eye socket
    g.fill();
    for (const [dy, k] of [[0, 1], [9, 0.85]]) {
      g.strokeStyle = rgbk(BONE, 0.55 * k);
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(-96, -2 + dy);
      g.quadraticCurveTo(-140, 10 + dy, -184, -8 + dy * 0.5);
      g.stroke();
      g.strokeStyle = rgbk(BONE, k);
      g.lineWidth = 5.5;
      g.stroke();
    }
    // flipper bones
    for (let i = 0; i < 4; i++) bone(g, -40 + i * 7, 4, -64 + i * 9, 12 + i, 3.4);
    // bacterial mats + bone-eating worms (Osedax: red plumes)
    for (let i = 0; i < 46; i++) {
      const [x, y, r] = verts[rng.int(0, verts.length - 1)];
      const px = x + rng.range(-r, r), py = y + rng.range(-r, r * 0.6);
      if (rng.chance(0.45)) {
        g.fillStyle = rng.pick(['rgba(250,248,236,0.7)', 'rgba(240,214,120,0.6)', 'rgba(232,150,70,0.5)']);
        g.beginPath();
        g.ellipse(px, py, rng.range(2, 5), rng.range(1.2, 3), 0, 0, TAU);
        g.fill();
      } else {
        g.strokeStyle = 'rgba(214,40,50,0.85)';
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(px, py);
        g.lineTo(px + rng.range(-2, 2), py - rng.range(3, 6));
        g.stroke();
      }
    }
    // white bacterial carpet on the ooze along the skeleton
    for (let i = 0; i < 60; i++) {
      const x = rng.range(-170, 220);
      g.fillStyle = `rgba(244,240,226,${rng.range(0.25, 0.6).toFixed(2)})`;
      g.beginPath();
      g.ellipse(x, rng.range(2, 8), rng.range(4, 12), rng.range(1, 2.4), 0, 0, TAU);
      g.fill();
    }
  },
});
