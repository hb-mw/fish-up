// The wooden dock at LANDMARKS.dock: pilings sized to the real seabed (barnacle band at the waterline),
// braces, deck, bollards, ladder, lamp post; plus a beached rowboat and stacked lobster pots.
import { heightAt, slopeAt } from '../../world/terrain.js';
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad } from './paint.js';

export const DOCK_X = 330; // land end (world x); local x = world x − DOCK_X, local y = world y
export const DOCK_DECK = -40;
export const DOCK_LAMP = [DOCK_X + 304, -86]; // world position of the lantern
const PILES = [30, 88, 146, 204, 262, 318];

function pile(g, x, yTop, yBot, w) {
  const wood = H('#6a5641');
  g.fillStyle = lin(g, x - w, 0, x + w, 0, [[0, lite(wood, 0.3)], [0.4, rgbk(wood)], [1, rgbk(wood, 0.5)]]);
  g.fillRect(x - w, yTop, w * 2, yBot - yTop);
  // intertidal band: dark wet wood, barnacles, weed
  g.fillStyle = lin(g, 0, -14, 0, 30, [[0, 'rgba(40,46,30,0)'], [0.3, 'rgba(40,50,30,0.75)'], [1, 'rgba(46,70,44,0.55)']]);
  g.fillRect(x - w, Math.max(yTop, -14), w * 2, Math.min(yBot, 30) - Math.max(yTop, -14));
  for (let i = 0; i < 14; i++) {
    const by = -8 + ((i * 37) % 30), bx = x - w + ((i * 13) % (w * 2));
    g.fillStyle = 'rgba(214,206,186,0.85)';
    g.beginPath();
    g.arc(bx, by, 1.3, 0, TAU);
    g.fill();
  }
  // growth below the water: green-brown algae streaks
  if (yBot > 30) {
    g.fillStyle = 'rgba(60,96,52,0.35)';
    g.fillRect(x - w, 30, w * 2, yBot - 30);
  }
}

defType({
  id: 'dock', variants: 1, box: { x0: -10, y0: -100, x1: 336, y1: 200 }, noFade: true,
  paint(g) {
    const wood = H('#8a7458'), dark = H('#4e3e2e');
    // pilings down into the real seabed
    for (const px of PILES) pile(g, px, DOCK_DECK - 4, heightAt(DOCK_X + px) + 14, 4.6);
    // X braces between pilings (above the water)
    g.strokeStyle = rgbk(dark, 1.1);
    g.lineWidth = 3;
    for (let i = 0; i < PILES.length - 1; i++) {
      const a = PILES[i], b = PILES[i + 1];
      g.beginPath();
      g.moveTo(a, DOCK_DECK + 4);
      g.lineTo(b, -6);
      g.moveTo(b, DOCK_DECK + 4);
      g.lineTo(a, -6);
      g.stroke();
    }
    // deck: fascia beam + plank ends on top
    g.fillStyle = lin(g, 0, DOCK_DECK - 1, 0, DOCK_DECK + 7, [[0, rgbk(wood, 0.95)], [1, rgbk(wood, 0.55)]]);
    g.fillRect(-6, DOCK_DECK - 1, 334, 8);
    for (let x = -6; x < 328; x += 6.5) {
      const k = 0.85 + ((x * 7) % 13) / 50;
      g.fillStyle = lin(g, 0, DOCK_DECK - 7, 0, DOCK_DECK - 1, [[0, lite(wood, 0.35 * k)], [1, rgbk(wood, k)]]);
      g.fillRect(x, DOCK_DECK - 7, 5.8, 6);
    }
    // bollards at the sea end, rope wound round one
    for (const bx of [262, 318]) {
      g.fillStyle = lin(g, bx - 5, 0, bx + 5, 0, [[0, lite(wood, 0.25)], [1, rgbk(wood, 0.5)]]);
      g.fillRect(bx - 5, DOCK_DECK - 26, 10, 20);
      g.fillStyle = rgbk(wood, 0.7);
      g.beginPath();
      g.ellipse(bx, DOCK_DECK - 26, 5, 2, 0, 0, TAU);
      g.fill();
    }
    g.strokeStyle = '#c8b48a';
    g.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      g.beginPath();
      g.ellipse(318, DOCK_DECK - 14 - i * 3, 6, 1.6, 0, 0, TAU);
      g.stroke();
    }
    // ladder down into the water
    g.strokeStyle = rgbk(dark, 1.2);
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(296, DOCK_DECK);
    g.lineTo(296, 46);
    g.moveTo(308, DOCK_DECK);
    g.lineTo(308, 46);
    for (let y = DOCK_DECK + 10; y < 46; y += 11) {
      g.moveTo(296, y);
      g.lineTo(308, y);
    }
    g.stroke();
    // lamp post with a hanging lantern
    const [lx, ly] = [DOCK_LAMP[0] - DOCK_X, DOCK_LAMP[1]];
    g.fillStyle = rgbk(dark, 1.1);
    g.fillRect(288, -100, 4, 60 + DOCK_DECK + 100 - 60);
    g.fillRect(288, -100, 20, 3);
    g.strokeStyle = '#2a2420';
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(lx, -97);
    g.lineTo(lx, ly - 8);
    g.stroke();
    g.fillStyle = '#2e2620';
    g.fillRect(lx - 5, ly - 8, 10, 3);
    g.fillRect(lx - 5, ly + 7, 10, 2.5);
    g.fillStyle = rad(g, lx, ly, 0.5, lx, ly, 7, [[0, '#fff0bc'], [1, '#b88a48']]);
    g.fillRect(lx - 4, ly - 5, 8, 12);
    // lobster pots + buoys on the deck
    const pot = (x, y, w, h) => {
      g.fillStyle = 'rgba(70,52,36,0.35)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = '#8a6a48';
      g.lineWidth = 2;
      g.strokeRect(x, y, w, h);
      g.lineWidth = 1.2;
      for (let sx = x + 5; sx < x + w; sx += 5) {
        g.beginPath();
        g.moveTo(sx, y);
        g.lineTo(sx, y + h);
        g.stroke();
      }
    };
    pot(112, DOCK_DECK - 25, 30, 18);
    pot(144, DOCK_DECK - 25, 30, 18);
    pot(126, DOCK_DECK - 44, 30, 18);
    for (const [bx, by, c] of [[182, DOCK_DECK - 13, '#e8642a'], [194, DOCK_DECK - 11, '#f2c23a']]) {
      g.fillStyle = rad(g, bx - 2, by - 3, 0.5, bx, by, 7, [[0, lite(H(c), 0.4)], [1, rgbk(H(c), 0.7)]]);
      g.beginPath();
      g.ellipse(bx, by, 5, 7, 0.2, 0, TAU);
      g.fill();
    }
  },
});

// rowboat pulled up on the beach (painted already tilted to the slope at its spot)
export const ROWBOAT_X = 262;
defType({
  id: 'rowboat', variants: 1, box: { x0: -70, y0: -50, x1: 70, y1: 22 }, noFade: true,
  paint(g) {
    g.rotate(Math.atan(slopeAt(ROWBOAT_X)) * 0.9);
    const hull = H('#e8e2d2'), stripe = H('#2f6a94'), inside = H('#9a7a56');
    g.beginPath();
    g.moveTo(-58, -20);
    g.quadraticCurveTo(-50, 6, -10, 8);
    g.lineTo(30, 8);
    g.quadraticCurveTo(56, 4, 62, -24);
    g.lineTo(-58, -20);
    g.closePath();
    g.fillStyle = lin(g, 0, -24, 0, 8, [[0, lite(hull, 0.3)], [0.6, rgbk(hull)], [1, rgbk(hull, 0.6)]]);
    g.fill();
    g.fillStyle = rgbk(stripe);
    g.beginPath();
    g.moveTo(-57, -16);
    g.lineTo(61, -20);
    g.lineTo(60, -14);
    g.lineTo(-55, -11);
    g.closePath();
    g.fill();
    g.fillStyle = rgbk(inside, 0.8);
    g.beginPath();
    g.moveTo(-58, -20);
    g.lineTo(62, -24);
    g.lineTo(58, -27);
    g.lineTo(-54, -23);
    g.closePath();
    g.fill();
    // oar resting across
    g.strokeStyle = '#b89a6a';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(-40, -30);
    g.lineTo(40, -40);
    g.stroke();
    g.fillStyle = '#b89a6a';
    g.beginPath();
    g.ellipse(46, -41, 9, 3, -0.12, 0, TAU);
    g.fill();
  },
});
