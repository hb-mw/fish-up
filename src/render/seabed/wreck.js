// The shipwreck on the drop-off ledge (LANDMARKS.wreck): a broken wooden sailing ship lying on its keel, tilted
// to the real slope — planked hull with wales and gun ports, a breach with exposed ribs, a stern castle with
// gallery windows, a snapped mast stump, encrusted with sponges, barnacles and weed.
import { heightAt } from '../../world/terrain.js';
import { defType } from './deco.js';
import { TAU, H, rgbk, lite, lin, rad, blobPath } from './paint.js';

export const WRECK_X = 6330;
/** hull tilt: follow the ground under the keel */
export const WRECK_TILT = Math.atan2(heightAt(WRECK_X + 240) - heightAt(WRECK_X - 240), 480) * 0.85;

// hull outline in local px (unrotated): keel on y = 0, bow to the left, stern castle to the right
function hullPath(g) {
  g.beginPath();
  g.moveTo(-250, 2);
  g.bezierCurveTo(-292, -10, -318, -70, -332, -150); // bow stem
  g.lineTo(-300, -148);
  g.quadraticCurveTo(-200, -118, -120, -116); // waist gunwale
  g.lineTo(-110, -60); // breach (left edge)
  g.lineTo(-84, -78);
  g.lineTo(-62, -34);
  g.lineTo(-30, -58);
  g.lineTo(-6, -26);
  g.lineTo(22, -66);
  g.lineTo(44, -40);
  g.lineTo(58, -118); // breach (right edge)
  g.quadraticCurveTo(120, -122, 176, -136);
  g.lineTo(178, -206); // stern castle
  g.lineTo(296, -214);
  g.lineTo(300, -150);
  g.bezierCurveTo(292, -80, 278, -20, 246, 2);
  g.closePath();
}

defType({
  id: 'wreckhull', variants: 1, box: { x0: -350, y0: -300, x1: 330, y1: 40 }, foot: 260,
  paint(g, v, rng) {
    g.rotate(WRECK_TILT);
    const wood = H('#a8865a'), dark = H('#4a3626'), weed = H('#6a7a44');
    // the dark interior seen through the breach (behind the hull skin)
    g.fillStyle = lin(g, 0, -120, 0, 0, [[0, '#2a221a'], [1, '#0e0b08']]);
    g.beginPath();
    g.moveTo(-120, -116);
    g.quadraticCurveTo(-30, -112, 58, -118);
    g.lineTo(58, -10);
    g.lineTo(-120, -10);
    g.closePath();
    g.fill();
    // exposed ribs inside the breach
    for (let x = -112; x <= 52; x += 13) {
      g.strokeStyle = rgbk(wood, 0.62);
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(x, -6);
      g.quadraticCurveTo(x - 6, -60, x + 2, -122 + rng.range(-6, 6));
      g.stroke();
      g.strokeStyle = lite(wood, 0.2, 0.5);
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(x - 2, -8);
      g.quadraticCurveTo(x - 8, -60, x, -118);
      g.stroke();
    }
    // hull skin
    hullPath(g);
    g.fillStyle = lin(g, 0, -214, 0, 4, [[0, lite(wood, 0.18)], [0.45, rgbk(wood)], [1, rgbk(wood, 0.45)]]);
    g.fill();
    g.save();
    hullPath(g);
    g.clip();
    // strakes (planks following the sheer) with butt joints
    for (let y = -206; y < 6; y += 10) {
      const k = (y + 206) / 212;
      g.strokeStyle = rgbk(dark, 1, 0.55);
      g.lineWidth = 1.4;
      g.beginPath();
      for (let x = -340; x <= 310; x += 20) {
        const sheer = 18 * Math.cos((x / 330) * Math.PI * 0.5) * (1 - k);
        g.lineTo(x, y + sheer - (x < -250 ? (x + 250) * -0.3 * (1 - k) : 0));
      }
      g.stroke();
      for (let x = -330 + rng.range(0, 40); x < 300; x += rng.range(50, 90)) {
        const sheer = 18 * Math.cos((x / 330) * Math.PI * 0.5) * (1 - k);
        g.fillStyle = rgbk(dark, 1, 0.5);
        g.fillRect(x, y + sheer, 1.4, 10);
      }
    }
    // wales: heavy dark bands
    for (const [y, w] of [[-62, 7], [-104, 6]]) {
      g.strokeStyle = rgbk(dark, 0.9);
      g.lineWidth = w;
      g.beginPath();
      for (let x = -340; x <= 310; x += 20) g.lineTo(x, y + 14 * Math.cos((x / 330) * Math.PI * 0.5));
      g.stroke();
    }
    // gun ports (one lid hanging)
    for (let x = -260; x < 160; x += 54) {
      if (x > -130 && x < 70) continue;
      const y = -92 + 14 * Math.cos((x / 330) * Math.PI * 0.5);
      g.fillStyle = '#120e0a';
      g.fillRect(x, y, 16, 14);
      g.strokeStyle = lite(wood, 0.25);
      g.lineWidth = 1.6;
      g.strokeRect(x, y, 16, 14);
    }
    // stern castle gallery windows + faded gilt trim
    for (let i = 0; i < 4; i++) {
      const x = 192 + i * 24;
      g.fillStyle = lin(g, 0, -190, 0, -168, [[0, '#2a3a3e'], [1, '#0c1214']]);
      g.fillRect(x, -192, 16, 22);
      g.strokeStyle = 'rgba(200,170,90,0.7)';
      g.lineWidth = 1.6;
      g.strokeRect(x, -192, 16, 22);
    }
    g.strokeStyle = 'rgba(196,162,80,0.6)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(180, -160);
    g.lineTo(298, -166);
    g.moveTo(180, -200);
    g.lineTo(296, -208);
    g.stroke();
    // growth: algae haze, barnacles, sponges, coralline crust
    g.fillStyle = lin(g, 0, -214, 0, 0, [[0, rgbk(weed, 1, 0.22)], [0.5, rgbk(weed, 1, 0.06)], [1, rgbk(weed, 0.6, 0.22)]]);
    g.fillRect(-340, -220, 660, 230);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = 'rgba(222,214,196,0.7)';
      g.beginPath();
      g.arc(rng.range(-330, 300), rng.range(-200, 0), rng.range(0.7, 1.8), 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 24; i++) {
      const x = rng.range(-320, 290), y = rng.range(-180, -6);
      if (x > -125 && x < 60 && y < -20) continue;
      blobPath(g, x, y, rng.range(4, 12), rng.range(3, 7), 7, 0.35, rng);
      g.fillStyle = rng.pick(['rgba(232,150,60,0.85)', 'rgba(226,196,70,0.8)', 'rgba(210,120,150,0.75)', 'rgba(170,90,60,0.8)']);
      g.fill();
    }
    g.restore();
    // rim light: the sheer line, the stem and the castle catch what light reaches this deep
    g.strokeStyle = 'rgba(255,226,170,0.75)';
    g.lineWidth = 2.6;
    g.beginPath();
    g.moveTo(-331, -148);
    g.lineTo(-300, -146);
    g.quadraticCurveTo(-200, -116, -120, -114);
    g.moveTo(58, -116);
    g.quadraticCurveTo(120, -120, 176, -134);
    g.moveTo(178, -205);
    g.lineTo(296, -213);
    g.moveTo(-250, 1);
    g.bezierCurveTo(-292, -11, -318, -71, -331, -148);
    g.stroke();
    g.strokeStyle = 'rgba(255,236,196,0.35)';
    g.lineWidth = 6;
    g.stroke();
    // jagged broken plank ends around the breach
    g.strokeStyle = rgbk(wood, 0.9);
    g.lineWidth = 4;
    for (const [x, y, a] of [[-112, -64, -0.6], [-80, -80, -1.2], [-58, -38, -0.5], [-28, -60, -1.6], [-4, -30, -0.8], [24, -68, -1.9], [46, -44, -1.1], [56, -112, -2.6]]) {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * rng.range(8, 16), y + Math.sin(a) * rng.range(8, 16));
      g.stroke();
    }
    // snapped mast stump + broken bowsprit
    g.fillStyle = lin(g, 76, 0, 92, 0, [[0, lite(wood, 0.2)], [1, rgbk(wood, 0.5)]]);
    g.beginPath();
    g.moveTo(74, -118);
    g.lineTo(74, -230);
    g.lineTo(80, -244);
    g.lineTo(84, -232);
    g.lineTo(90, -248);
    g.lineTo(92, -118);
    g.closePath();
    g.fill();
    g.strokeStyle = rgbk(wood, 0.85);
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(-326, -146);
    g.lineTo(-348, -186);
    g.stroke();
    // weed streamers hanging from the gunwale
    for (let i = 0; i < 16; i++) {
      const x = rng.range(-300, 290);
      if (x > -125 && x < 60) continue;
      const y0 = x > 176 ? -208 : -118 - 14 * Math.cos((x / 330) * Math.PI * 0.5);
      g.strokeStyle = rng.pick(['rgba(90,120,60,0.8)', 'rgba(120,110,50,0.8)']);
      g.lineWidth = rng.range(1.5, 3);
      g.beginPath();
      g.moveTo(x, y0);
      g.bezierCurveTo(x + 6, y0 + 14, x - 6, y0 + 28, x + rng.range(-4, 4), y0 + rng.range(30, 60));
      g.stroke();
    }
  },
});
