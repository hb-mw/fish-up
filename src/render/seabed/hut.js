// The fisherman's hut on the island slope: stilts sized to the real ground, plank walls, shuttered window,
// thatched gable roof, porch with a drying net, life ring and a lantern. Local px, base = (HUT_X, ground).
import { heightAt } from '../../world/terrain.js';
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad } from './paint.js';

export const HUT_X = 110;
/** glow anchors (local px): window centre, lantern */
export const HUT_GLOW = { window: [-27, -76], lantern: [50, -93] };

defType({
  id: 'hut', variants: 1, box: { x0: -84, y0: -168, x1: 96, y1: 30 }, noFade: true,
  paint(g, v, rng) {
    const gy = (lx) => heightAt(HUT_X + lx) - heightAt(HUT_X); // ground under local x
    const FLOOR = -30;
    const wood = H('#7c6a55'), dark = H('#4a3c2e');
    // stilts + braces
    for (const sx of [-56, -18, 22, 60, 84]) {
      const yb = gy(sx) + 8;
      g.fillStyle = lin(g, sx - 4, 0, sx + 4, 0, [[0, lite(dark, 0.25)], [1, rgbk(dark, 0.7)]]);
      g.fillRect(sx - 3.5, FLOOR, 7, yb - FLOOR);
    }
    g.strokeStyle = rgbk(dark, 0.9);
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-56, FLOOR + 6);
    g.lineTo(-18, gy(-18) - 2);
    g.moveTo(22, FLOOR + 6);
    g.lineTo(60, gy(60) - 2);
    g.stroke();
    // floor beam (+ porch)
    g.fillStyle = lin(g, 0, FLOOR, 0, FLOOR + 7, [[0, lite(wood, 0.25)], [1, rgbk(wood, 0.6)]]);
    g.fillRect(-66, FLOOR, 156, 7);
    // walls: vertical weathered planks
    const WX0 = -60, WX1 = 44, WY = -112;
    for (let x = WX0; x < WX1; x += 8) {
      const k = rng.range(0.82, 1.12);
      g.fillStyle = lin(g, x, 0, x + 8, 0, [[0, rgbk(wood, 1.12 * k)], [0.7, rgbk(wood, k)], [1, rgbk(wood, 0.72 * k)]]);
      g.fillRect(x, WY, 8, FLOOR - WY);
      g.fillStyle = rgbk(dark, 1, 0.5);
      g.fillRect(x + 7.2, WY, 0.9, FLOOR - WY);
      g.fillStyle = 'rgba(30,22,16,0.5)';
      g.fillRect(x + 3.5, WY + 6, 1.1, 1.1);
      g.fillRect(x + 3.5, FLOOR - 8, 1.1, 1.1);
    }
    // eave shadow on the wall
    g.fillStyle = lin(g, 0, WY, 0, WY + 22, [[0, 'rgba(20,14,10,0.55)'], [1, 'rgba(20,14,10,0)']]);
    g.fillRect(WX0, WY, WX1 - WX0, 22);
    // window with open blue shutters
    const [wx, wy] = HUT_GLOW.window;
    g.fillStyle = rgbk(H('#3f7f96'));
    g.fillRect(wx - 30, wy - 14, 12, 28);
    g.fillRect(wx + 18, wy - 14, 12, 28);
    g.strokeStyle = rgbk(H('#2a5a6a'));
    g.lineWidth = 1;
    for (const sx of [wx - 30, wx + 18]) for (let y = wy - 11; y < wy + 13; y += 4) {
      g.beginPath();
      g.moveTo(sx + 1, y);
      g.lineTo(sx + 11, y);
      g.stroke();
    }
    g.fillStyle = lin(g, 0, wy - 13, 0, wy + 13, [[0, '#8fb8c8'], [0.5, '#3a5a6c'], [1, '#22343e']]);
    g.fillRect(wx - 16, wy - 13, 32, 26);
    g.strokeStyle = lite(wood, 0.45);
    g.lineWidth = 2.4;
    g.strokeRect(wx - 16, wy - 13, 32, 26);
    g.beginPath();
    g.moveTo(wx, wy - 13);
    g.lineTo(wx, wy + 13);
    g.moveTo(wx - 16, wy);
    g.lineTo(wx + 16, wy);
    g.stroke();
    // door (ajar) + doorway dark
    g.fillStyle = '#1e1712';
    g.fillRect(10, -88, 24, 58);
    g.fillStyle = lin(g, 10, 0, 22, 0, [[0, rgbk(wood, 0.95)], [1, rgbk(wood, 0.6)]]);
    g.beginPath();
    g.moveTo(10, -88);
    g.lineTo(21, -85);
    g.lineTo(21, -33);
    g.lineTo(10, -30);
    g.closePath();
    g.fill();
    // life ring
    g.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      g.strokeStyle = i % 2 ? '#f2efe6' : '#d8402e';
      g.beginPath();
      g.arc(-46, -50, 8, (i / 8) * TAU, ((i + 1) / 8) * TAU);
      g.stroke();
    }
    // porch rail + drying net
    g.fillStyle = rgbk(dark, 1.2);
    for (const px of [58, 86]) g.fillRect(px - 2, FLOOR - 26, 4, 26);
    g.fillRect(44, FLOOR - 28, 46, 3.5);
    g.strokeStyle = 'rgba(214,206,180,0.75)';
    g.lineWidth = 0.8;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(46 + i * 5.4, FLOOR - 25);
      g.quadraticCurveTo(48 + i * 5.4, FLOOR - 8, 44 + i * 5.6, FLOOR + 2);
      g.stroke();
    }
    for (let j = 1; j < 5; j++) {
      g.beginPath();
      g.moveTo(46, FLOOR - 25 + j * 5.5);
      g.quadraticCurveTo(66, FLOOR - 20 + j * 6, 90, FLOOR - 25 + j * 5.5);
      g.stroke();
    }
    // lantern bracket + lantern
    const [lx, ly] = HUT_GLOW.lantern;
    g.strokeStyle = '#2a2420';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(44, ly - 12);
    g.lineTo(lx, ly - 12);
    g.lineTo(lx, ly - 7);
    g.stroke();
    g.fillStyle = '#3a3028';
    g.fillRect(lx - 4.5, ly - 7, 9, 3);
    g.fillRect(lx - 4.5, ly + 6, 9, 2.5);
    g.fillStyle = rad(g, lx, ly, 0.5, lx, ly, 6, [[0, '#fff2c0'], [1, '#c89a50']]);
    g.fillRect(lx - 3.5, ly - 4, 7, 10);
    // thatched gable roof
    const roof = () => {
      g.beginPath();
      g.moveTo(-80, -100);
      g.quadraticCurveTo(-44, -132, -8, -162);
      g.quadraticCurveTo(28, -132, 64, -100);
      g.lineTo(58, -95);
      g.quadraticCurveTo(-8, -110, -74, -95);
      g.closePath();
    };
    roof();
    g.fillStyle = lin(g, 0, -162, 0, -95, [[0, '#c8a868'], [0.6, '#a88a50'], [1, '#6e5634']]);
    g.fill();
    g.save();
    roof();
    g.clip();
    for (let row = 0; row < 7; row++) {
      const y0 = -158 + row * 10;
      for (let x = -84; x < 70; x += 2.2) {
        const len = rng.range(10, 17);
        g.strokeStyle = rng.chance(0.5) ? 'rgba(232,206,140,0.55)' : 'rgba(110,84,46,0.55)';
        g.lineWidth = 0.9;
        g.beginPath();
        g.moveTo(x, y0 + rng.range(-2, 2) + Math.abs(x + 8) * 0.05);
        g.lineTo(x + rng.range(-2, 2) + (x + 8) * 0.06, y0 + len + Math.abs(x + 8) * 0.05);
        g.stroke();
      }
    }
    g.restore();
    // ragged eave fringe
    g.strokeStyle = 'rgba(120,92,52,0.9)';
    g.lineWidth = 1;
    for (let x = -78; x < 62; x += 2.5) {
      const t = (x + 8) / 70;
      const y = -98 - (1 - Math.abs(t)) * 12 + Math.abs(t) * 2;
      g.beginPath();
      g.moveTo(x, y - 2);
      g.lineTo(x + rng.range(-1, 1), y + rng.range(3, 8));
      g.stroke();
    }
  },
});
