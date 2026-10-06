// UI module — right-edge depth gauge (surface → max line depth, zones, seabed, lure/fish marker)
// and the sonar screen (bottom-right) when the player owns a fish finder.
import { h, setText, setStyle, toggleClass, uiCanvas, fitCanvas } from './dom.js';
import { icon } from './icons.js';
import { ZONES, WORLD, rarityOf } from '../core/config.js';

const TRACK_H = 420;
const ZONE_COLORS = {
  sunlit: ['#35c4d2', '#1985b6'],
  twilight: ['#1a5aa6', '#173a82'],
  midnight: ['#16245a', '#0d1438'],
  abyss: ['#1d0d2c', '#08040f'],
};
const SHOW_STATES = new Set(['casting', 'waiting', 'bite', 'fight', 'landing']);

function niceStep(max) {
  const steps = [5, 10, 20, 25, 50, 100, 150, 200, 250];
  for (const s of steps) if (max / s <= 6) return s;
  return 300;
}

export function createGauges(ui) {
  const { game, layers } = ui;
  const pxPerM = WORLD.pxPerM;

  // ── depth gauge ──────────────────────────────────────────────────────────
  const zonesEl = h('div.fu-gg-zones');
  const ticksEl = h('div.fu-gg-ticks');
  const bedEl = h('div.fu-gg-bed', null, h('span.fu-gg-bed-lab'));
  const lineEl = h('div.fu-gg-line');
  const markVal = h('b.fu-gg-val');
  const markZone = h('span.fu-gg-zone');
  const marker = h('div.fu-gg-mark', null, h('div.fu-gg-flag', null, markVal, markZone), h('i.fu-gg-pin'));
  const footEl = h('div.fu-gg-foot');
  const track = h('div.fu-gg-track', null, zonesEl, bedEl, lineEl, h('div.fu-gg-gloss'));
  const gauge = h('section.fu-gauge', null,
    h('div.fu-gg-head', { html: icon('depth') + '<span>Depth</span>' }),
    h('div.fu-gg-body', null, ticksEl, track, marker),
    footEl);
  layers.hud.querySelector('.fu-hud').appendChild(gauge);

  let scaleKey = '';
  let maxM = 60;
  let shownDepth = 0;

  function buildScale(m) {
    maxM = m;
    zonesEl.innerHTML = '';
    ticksEl.innerHTML = '';
    for (const z of ZONES) {
      const a = z.from / pxPerM, b = z.to / pxPerM;
      if (a >= m) continue;
      const top = (a / m) * 100, bot = (Math.min(b, m) / m) * 100;
      const c = ZONE_COLORS[z.id];
      const seg = h('div.fu-gg-seg', { style: { top: top + '%', height: bot - top + '%', background: `linear-gradient(180deg, ${c[0]}, ${c[1]})` } });
      if (a > 0) seg.appendChild(h('span.fu-gg-seg-lab', { text: z.name.replace(' Zone', '').replace('The ', '') }));
      zonesEl.appendChild(seg);
    }
    const step = niceStep(m);
    for (let v = 0; v <= m + 0.001; v += step) {
      const y = (v / m) * TRACK_H;
      ticksEl.appendChild(h('div.fu-gg-tick', { style: { '--y': y.toFixed(1) } }, h('span', { text: `${v}` })));
    }
    if (Math.abs((Math.floor(m / step) * step) - m) > step * 0.3) {
      ticksEl.appendChild(h('div.fu-gg-tick.is-max', { style: { '--y': String(TRACK_H) } }, h('span', { text: `${Math.round(m)}` })));
    }
  }

  function updateGauge(dt) {
    const f = game.fishing, pl = game.player;
    const show = SHOW_STATES.has(f.state) && (f.lure.inWater || f.hooked);
    toggleClass(gauge, 'is-on', show);
    if (!show) return;
    const m = Math.max(10, Math.round(pl.stats.lineLengthM || 60));
    const key = String(m);
    if (key !== scaleKey) {
      scaleKey = key;
      buildScale(m);
    }
    const hooked = f.hooked && (f.state === 'fight' || f.state === 'landing' || f.state === 'bite') ? f.hooked : null;
    const x = hooked ? hooked.x : f.lure.x;
    const yWorld = hooked && f.state !== 'bite' ? hooked.y : f.lure.y;
    const depth = Math.max(0, yWorld / pxPerM);
    shownDepth += (depth - shownDepth) * Math.min(1, dt * 12);
    const bed = Math.max(0, game.world.terrain.heightAt(x) / pxPerM);
    // seabed band
    if (bed < maxM) {
      toggleClass(bedEl, 'is-on', true);
      setStyle(bedEl, 'top', ((bed / maxM) * 100).toFixed(2) + '%');
      setText(bedEl.firstChild, `Seabed ${Math.round(bed)} m`);
      setText(footEl, `Line ${maxM} m`);
      toggleClass(footEl, 'is-deep', false);
    } else {
      toggleClass(bedEl, 'is-on', false);
      setText(footEl, `Seabed ${Math.round(bed)} m ↓`);
      toggleClass(footEl, 'is-deep', true);
    }
    // line-out fill + marker
    const k = Math.max(0, Math.min(1, shownDepth / maxM));
    setStyle(lineEl, 'transform', `scaleY(${k.toFixed(4)})`);
    setStyle(marker, '--y', (k * TRACK_H).toFixed(1));
    setText(markVal, `${Math.round(shownDepth)} m`);
    let zoneName = '';
    for (let i = ZONES.length - 1; i >= 0; i--) {
      if (yWorld >= ZONES[i].from) {
        zoneName = ZONES[i].name.replace(' Zone', '').replace('The ', '');
        break;
      }
    }
    setText(markZone, zoneName);
    toggleClass(marker, 'is-bite', f.state === 'bite');
    toggleClass(marker, 'is-fish', !!hooked && f.state !== 'bite');
    toggleClass(marker, 'is-over', depth > maxM + 0.5);
    if (hooked && f.state !== 'bite') {
      const known = !!(game.player.dex && game.player.dex[hooked.speciesId] && game.player.dex[hooked.speciesId].count > 0);
      setStyle(marker, '--mc', known ? rarityOf(hooked.species.level).color : '#e8f4ff');
    } else setStyle(marker, '--mc', '#e8f4ff');
  }

  // ── sonar ────────────────────────────────────────────────────────────────
  const SW = 320, SH = 178;
  const sonarCv = uiCanvas(game, SW, SH, 'fu-sonar-cv');
  const sonarLvl = h('span.fu-sonar-lvl');
  const sonar = h('section.fu-sonar.fu-glass', null,
    h('div.fu-sonar-head', { html: icon('sonar') + '<span>Sonar</span>' }, sonarLvl),
    h('div.fu-sonar-screen', null, sonarCv));
  layers.hud.querySelector('.fu-hud').appendChild(sonar);
  const RANGE = 900;
  const bedPts = new Float32Array(48);
  let sweep = 0;
  let bedGrad = null, sweepGrad = null;

  function scanFish(bx) {
    const fs = game.fish;
    if (fs && typeof fs.scan === 'function') {
      try {
        return fs.scan(bx, RANGE) || [];
      } catch (e) {
        game.reportError('ui.sonar.scan', e);
      }
    }
    const out = [];
    const list = (fs && fs.list) || [];
    for (let i = 0; i < list.length; i++) {
      const fi = list[i];
      if (Math.abs(fi.x - bx) <= RANGE && fi.y > 0) out.push(fi);
    }
    return out;
  }

  function drawSonar(dt, t) {
    const lvl = game.player.stats.sonar || 0;
    const on = lvl > 0 && game.mode === 'play';
    toggleClass(sonar, 'is-on', on);
    if (!on) return;
    setText(sonarLvl, lvl >= 2 ? 'Mk II' : 'Mk I');
    const k = fitCanvas(game, sonarCv);
    const ctx = sonarCv.getContext('2d');
    const boat = game.boat, terr = game.world.terrain;
    const bx = boat.x;
    // vertical scale: surface → deepest seabed in range (≥ 40 m)
    let deep = 0;
    for (let i = 0; i < bedPts.length; i++) {
      const wx = bx - RANGE + (i / (bedPts.length - 1)) * RANGE * 2;
      const d = terr.heightAt(wx);
      bedPts[i] = d;
      if (d > deep) deep = d;
    }
    const maxY = Math.max(320, deep * 1.06);
    const X = (wx) => ((wx - (bx - RANGE)) / (RANGE * 2)) * SW;
    const Y = (wy) => 10 + (Math.max(0, wy) / maxY) * (SH - 14);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, sonarCv.width, sonarCv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    // grid
    ctx.strokeStyle = 'rgba(90, 255, 214, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = 0; gx <= SW; gx += SW / 8) {
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, SH);
    }
    for (let gy = 10; gy <= SH; gy += (SH - 10) / 4) {
      ctx.moveTo(0, gy);
      ctx.lineTo(SW, gy);
    }
    ctx.stroke();
    // seabed
    ctx.beginPath();
    ctx.moveTo(0, SH);
    for (let i = 0; i < bedPts.length; i++) ctx.lineTo((i / (bedPts.length - 1)) * SW, Y(bedPts[i]));
    ctx.lineTo(SW, SH);
    ctx.closePath();
    if (!bedGrad) {
      bedGrad = ctx.createLinearGradient(0, 0, 0, SH);
      bedGrad.addColorStop(0, 'rgba(255, 196, 92, 0.42)');
      bedGrad.addColorStop(1, 'rgba(255, 150, 60, 0.12)');
      sweepGrad = ctx.createLinearGradient(-60, 0, 0, 0);
      sweepGrad.addColorStop(0, 'rgba(80, 255, 210, 0)');
      sweepGrad.addColorStop(1, 'rgba(80, 255, 210, 0.22)');
    }
    ctx.fillStyle = bedGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 214, 130, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < bedPts.length; i++) {
      const px = (i / (bedPts.length - 1)) * SW, py = Y(bedPts[i]);
      if (i) ctx.lineTo(px, py);
      else ctx.moveTo(px, py);
    }
    ctx.stroke();
    // sweep
    sweep = (sweep + dt * 0.55) % 1;
    const sx = sweep * SW;
    ctx.save();
    ctx.translate(sx, 0);
    ctx.fillStyle = sweepGrad;
    ctx.fillRect(-60, 0, 60, SH);
    ctx.restore();
    ctx.fillStyle = 'rgba(160, 255, 230, 0.75)';
    ctx.fillRect(sx - 1, 0, 1.5, SH);
    // boat & line
    const bxs = X(bx);
    ctx.fillStyle = '#e9fff8';
    ctx.beginPath();
    ctx.moveTo(bxs - 9, 4);
    ctx.lineTo(bxs + 9, 4);
    ctx.lineTo(bxs + 6, 9);
    ctx.lineTo(bxs - 6, 9);
    ctx.closePath();
    ctx.fill();
    const f = game.fishing;
    if (f.lure.visible && f.lure.inWater) {
      const lx = X(f.lure.x), ly = Y(f.lure.y);
      ctx.strokeStyle = 'rgba(233,255,248,0.35)';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(bxs, 8);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx, ly, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // blips
    const fish = scanFish(bx);
    for (let i = 0; i < fish.length; i++) {
      const fi = fish[i];
      const wx = fi.x, wy = fi.y;
      if (wx === undefined || wy === undefined) continue;
      const px = X(wx), py = Y(wy);
      if (px < -4 || px > SW + 4) continue;
      const len = fi.visualLen || 60;
      const r = Math.max(1.8, Math.min(6.5, len / 40));
      // brightness: fresh after the sweep passes, fading until the next pass
      let since = (sweep - px / SW);
      if (since < 0) since += 1;
      const a = 0.35 + 0.65 * Math.max(0, 1 - since * 1.6);
      const lvlS = fi.species ? fi.species.level : fi.level || 1;
      const col = lvl >= 2 ? rarityOf(lvlS).color : '#6bffd9';
      ctx.globalAlpha = a;
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.5, r, 0, 0, Math.PI * 2);
      ctx.fill();
      if (lvl >= 2 && lvlS >= 7) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(px, py, r * 2.6 + Math.sin(t * 5 + i) * 1.2, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  return {
    update(dt, t) {
      updateGauge(dt);
      drawSonar(dt, t);
    },
    resize() {
      fitCanvas(game, sonarCv);
    },
  };
}
