// UI module — the fight console (bottom-centre while a fish is on): an arc tension gauge with a sprung needle,
// snap/slack danger rings, fish identity + stamina, line out vs spool, landing progress and mode call-outs.
import { h, setText, setStyle, toggleClass, retrigger } from './dom.js';
import { icon } from './icons.js';
import { rarityOf, WORLD } from '../core/config.js';

const VMAX = 1.2;
const A0 = 200, A1 = 340; // gauge sweep in SVG degrees (y down): 270 = straight up
const R = 128;
const ang = (v) => A0 + ((A1 - A0) * Math.max(0, Math.min(VMAX, v))) / VMAX;
const pt = (deg, r) => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a) * r, Math.sin(a) * r];
};
function arcD(d0, d1, r) {
  const [x0, y0] = pt(d0, r), [x1, y1] = pt(d1, r);
  const large = d1 - d0 > 180 ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const CALLOUTS = {
  run: { text: 'RUN!', sub: 'Let it take line — don\'t fight the drag', kind: 'warn' },
  dive: { text: 'IT\'S DIVING!', sub: 'Hold steady, keep the needle green', kind: 'info' },
  jump: { text: 'JUMP!', sub: 'Ease off — slack line beats a thrown hook', kind: 'cyan' },
  thrash: { text: 'THRASHING!', sub: 'Short pumps, keep it out of the red', kind: 'warn' },
  tired: { text: 'IT\'S TIRING!', sub: 'Reel, reel, reel!', kind: 'good' },
  strike: { text: 'PREDATOR!', sub: 'Something bigger just hit your fish!', kind: 'bad' },
  red: { text: 'EASE OFF!', sub: 'The line can\'t take much more', kind: 'bad' },
};

export function createFightHud(ui) {
  const { game } = ui;

  // ── gauge SVG ────────────────────────────────────────────────────────────
  let ticks = '';
  for (let v = 0; v <= VMAX + 1e-6; v += 0.05) {
    const major = Math.abs((v * 4) - Math.round(v * 4)) < 1e-6;
    const a = ang(v);
    const [x0, y0] = pt(a, R - 19), [x1, y1] = pt(a, R - (major ? 31 : 25));
    ticks += `<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" class="${major ? 'mj' : 'mn'}"/>`;
  }
  const svg = `<svg class="fu-tg-svg" viewBox="-172 -166 344 190">
    <defs>
      <radialGradient id="fu-tg-face" cx="0" cy="0" r="160" gradientUnits="userSpaceOnUse">
        <stop offset="0" stop-color="#16325a" stop-opacity=".95"/><stop offset=".75" stop-color="#0b1c34" stop-opacity=".92"/><stop offset="1" stop-color="#06111f" stop-opacity=".9"/>
      </radialGradient>
      <linearGradient id="fu-tg-brass" x1="0" y1="-1" x2="0" y2="1">
        <stop offset="0" stop-color="#fff0c0"/><stop offset=".5" stop-color="#e2ab4a"/><stop offset="1" stop-color="#8a5a18"/>
      </linearGradient>
      <linearGradient id="fu-tg-needle" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff"/>
      </linearGradient>
    </defs>
    <path class="fu-tg-face" d="${arcD(A0 - 8, A1 + 8, 162)}L${pt(A1 + 8, 40).map((n) => n.toFixed(1)).join(' ')}A40 40 0 0 0 ${pt(A0 - 8, 40).map((n) => n.toFixed(1)).join(' ')}Z"/>
    <path class="fu-tg-rim" d="${arcD(A0 - 8, A1 + 8, 162)}"/>
    <path class="fu-tg-danger-bg" d="${arcD(A0, 270 - 3, 148)}"/>
    <path class="fu-tg-danger-bg" d="${arcD(270 + 3, A1, 148)}"/>
    <path class="fu-tg-slackm" d="${arcD(A0, 270 - 3, 148)}" pathLength="100"/>
    <path class="fu-tg-snapm" d="M${pt(A1, 148).map((n) => n.toFixed(2)).join(' ')}A148 148 0 0 0 ${pt(273, 148).map((n) => n.toFixed(2)).join(' ')}" pathLength="100"/>
    <g class="fu-tg-zones">
      <path class="z-slack"/><path class="z-good"/><path class="z-warn"/><path class="z-red"/>
    </g>
    <path class="fu-tg-hilite"/>
    <g class="fu-tg-ticks">${ticks}</g>
    <text class="fu-tg-end" x="${pt(A0, 158)[0] - 4}" y="${pt(A0, 158)[1] + 22}" text-anchor="middle">SLACK</text>
    <text class="fu-tg-end is-r" x="${pt(A1, 158)[0] + 4}" y="${pt(A1, 158)[1] + 22}" text-anchor="middle">SNAP</text>
    <g class="fu-tg-needle">
      <path class="fu-tg-needle-glow" d="M-6 0 L${R - 16} -2.2 L${R - 6} 0 L${R - 16} 2.2 Z"/>
      <path class="fu-tg-needle-body" d="M-14 -5 L${R - 16} -2.4 L${R - 4} 0 L${R - 16} 2.4 L-14 5 Z"/>
    </g>
    <circle class="fu-tg-cap" r="15"/><circle class="fu-tg-cap-in" r="6.5"/>
  </svg>`;

  const gaugeWrap = h('div.fu-tg', { html: svg });
  const svgEl = gaugeWrap.querySelector('svg');
  const zoneEls = [...svgEl.querySelectorAll('.fu-tg-zones path')];
  const hilite = svgEl.querySelector('.fu-tg-hilite');
  const needleEl = svgEl.querySelector('.fu-tg-needle');
  const snapEl = svgEl.querySelector('.fu-tg-snapm');
  const slackEl = svgEl.querySelector('.fu-tg-slackm');
  const status = h('div.fu-tg-status', { text: 'GOOD' });
  gaugeWrap.appendChild(status);

  // ── identity (left) ──────────────────────────────────────────────────────
  const portrait = ui.portraits.live(150, 84, {
    cls: 'fu-fc-portrait', fill: 0.92, active: false, silColor: 'rgba(3, 10, 22, 0.94)', amp: 0.9, speed: 1.6,
  });
  const nameEl = h('div.fu-fc-name');
  const metaEl = h('div.fu-fc-meta');
  const stamFill = h('i.fu-bar-fill');
  const stamTxt = h('span.fu-fc-val');
  const ident = h('div.fu-fc-ident', null,
    h('div.fu-fc-pic', null, portrait.canvas, h('span.fu-fc-q', { text: '?' })),
    h('div.fu-fc-who', null, nameEl, metaEl,
      h('div.fu-fc-stat', null, h('div.fu-fc-lab', { html: icon('heart') + '<span>Stamina</span>' }, stamTxt), h('div.fu-bar.fu-bar-stam', null, stamFill))));

  // ── line & landing (right) ───────────────────────────────────────────────
  const lineFill = h('i.fu-bar-fill');
  const lineTxt = h('span.fu-fc-val');
  const landFish = h('i.fu-land-fish', { html: icon('fish') });
  const landFill = h('i.fu-land-fill');
  const landTxt = h('span.fu-fc-val');
  const right = h('div.fu-fc-right', null,
    h('div.fu-fc-stat', null, h('div.fu-fc-lab', { html: icon('line') + '<span>Line out</span>' }, lineTxt), h('div.fu-bar.fu-bar-line', null, lineFill, h('i.fu-bar-mark'))),
    h('div.fu-fc-stat', null, h('div.fu-fc-lab', { html: icon('boat') + '<span>Landing</span>' }, landTxt),
      h('div.fu-land', null, landFill, landFish, h('i.fu-land-boat', { html: icon('boat') }))));

  const callout = h('div.fu-callout');
  const console_ = h('div.fu-fight', null, callout, h('div.fu-fight-body.fu-glass', null, ident, gaugeWrap, right));
  ui.hud.root.appendChild(console_);

  // ── state ────────────────────────────────────────────────────────────────
  let on = false;
  let needle = 0, needleV = 0;
  let zoneKey = '';
  let lastMode = '';
  let fishId = null;
  let known = false;
  const lastCall = {};
  let callT = 0;
  let tiredShown = false;
  let redT = 0;

  function setZones(slack, warn) {
    const key = slack + '|' + warn;
    if (key === zoneKey) return;
    zoneKey = key;
    const g = 1.2; // degrees gap between zones
    const segs = [[0, slack], [slack, warn], [warn, 1], [1, VMAX]];
    segs.forEach(([a, b], i) => zoneEls[i].setAttribute('d', arcD(ang(a) + (i ? g / 2 : 0), ang(b) - (i < 3 ? g / 2 : 0), R)));
    hilite.setAttribute('d', arcD(ang(slack), ang(warn), R + 13));
  }

  function call(id) {
    const c = CALLOUTS[id];
    if (!c) return;
    const now = game.time.real;
    if (lastCall[id] && now - lastCall[id] < 4.5) return;
    lastCall[id] = now;
    callout.className = `fu-callout is-${c.kind}`;
    callout.innerHTML = `<b>${c.text}</b><span>${c.sub}</span>`;
    retrigger(callout, 'is-show');
    callT = 2.2;
  }

  function setFish(fish) {
    fishId = fish ? fish.speciesId : null;
    if (!fish) return;
    const dex = game.player.dex || {};
    known = !!(dex[fishId] && dex[fishId].count > 0);
    const sp = fish.species;
    portrait.set(fishId, { silhouette: !known, shiny: known && !!fish.shiny, flip: false });
    toggleClass(ident, 'is-unknown', !known);
    if (known) {
      const r = rarityOf(sp.level);
      setText(nameEl, sp.name);
      metaEl.innerHTML = `<span class="fu-rar" style="--rc:${r.color}">${r.name}</span><span class="fu-fc-lv">Lv ${sp.level}</span>${fish.shiny ? '<span class="fu-fc-shiny">' + icon('sparkle') + 'Shiny</span>' : ''}`;
      setStyle(ident, '--rc', r.color);
    } else {
      setText(nameEl, '???');
      const kg = fish.weightKg || 0;
      const msg = kg > 600 ? 'Something ENORMOUS is on the line!' : kg > 60 ? 'Something BIG is on the line!' : kg > 6 ? 'Something strong is on…' : 'Something\'s on the line…';
      metaEl.innerHTML = `<span class="fu-fc-mystery">${msg}</span>`;
      setStyle(ident, '--rc', '#7fa6c9');
    }
  }

  game.events.on('run', () => on && call('run'));
  game.events.on('jump', () => on && call('jump'));
  game.events.on('tensionWarn', () => on && call('red'));
  game.events.on('predatorStrike', (e) => {
    if (!on) return;
    call('strike');
    if (e && e.took && e.predator) setFish(e.predator);
  });
  game.events.on('fightStart', (e) => {
    tiredShown = false;
    if (e && e.fish) setFish(e.fish);
  });

  function update(dt) {
    const f = game.fishing;
    const show = (f.state === 'fight' || f.state === 'landing') && !!f.hooked;
    if (show !== on) {
      on = show;
      toggleClass(console_, 'is-on', on);
      portrait.active = on;
      if (on) {
        needle = Math.max(0, f.tension || 0);
        needleV = 0;
        lastMode = '';
        tiredShown = false;
        setFish(f.hooked);
      }
    }
    if (!on) return;
    if (f.hooked && f.hooked.speciesId !== fishId) setFish(f.hooked);
    const fight = f.fight;
    const slack = typeof fight.slackBelow === 'number' ? fight.slackBelow : 0.15;
    const warn = typeof fight.warnAbove === 'number' ? fight.warnAbove : 0.75;
    setZones(slack, warn);

    // sprung needle with a little life in it
    const tension = Math.max(0, f.tension || 0);
    const t = game.time.real;
    const wild = fight.mode === 'thrash' ? 0.05 : fight.mode === 'run' ? 0.025 : 0.008;
    const target = Math.min(VMAX + 0.03, tension + Math.sin(t * 37) * wild * (0.4 + tension) + Math.sin(t * 13.3) * wild * 0.6);
    const sdt = Math.min(dt, 1 / 30);
    needleV += ((target - needle) * 260 - needleV * 20) * sdt;
    needle += needleV * sdt;
    const na = ang(Math.max(-0.02, Math.min(VMAX + 0.02, needle)));
    needleEl.setAttribute('transform', `rotate(${na.toFixed(2)})`);

    const red = tension >= 1;
    const amber = !red && tension >= warn;
    const slackNow = tension < slack;
    redT = red ? redT + dt : 0;
    toggleClass(gaugeWrap, 'is-red', red);
    toggleClass(gaugeWrap, 'is-amber', amber);
    toggleClass(gaugeWrap, 'is-slack', slackNow);
    setText(status, red ? 'EASE OFF!' : amber ? 'CAREFUL' : slackNow ? 'SLACK' : 'GOOD');
    if (red || (fight.snapMeter || 0) > 0.35) {
      const s = 1.2 + 3.2 * Math.min(1, (fight.snapMeter || 0) + redT * 0.6);
      setStyle(gaugeWrap, 'transform', `translate(calc(var(--u) * ${((Math.random() - 0.5) * s).toFixed(2)}), calc(var(--u) * ${((Math.random() - 0.5) * s).toFixed(2)}))`);
    } else setStyle(gaugeWrap, 'transform', '');
    setStyle(snapEl, 'strokeDasharray', `${(Math.max(0, Math.min(1, fight.snapMeter || 0)) * 100).toFixed(1)} 100`);
    setStyle(slackEl, 'strokeDasharray', `${(Math.max(0, Math.min(1, fight.slackMeter || 0)) * 100).toFixed(1)} 100`);
    toggleClass(gaugeWrap, 'has-snap', (fight.snapMeter || 0) > 0.02);
    toggleClass(gaugeWrap, 'has-slack', (fight.slackMeter || 0) > 0.02);

    // stamina, line, landing
    const st = Math.max(0, Math.min(1, fight.stamina));
    setStyle(stamFill, 'transform', `scaleX(${st.toFixed(3)})`);
    setText(stamTxt, st < 0.2 ? 'Exhausted' : `${Math.round(st * 100)}%`);
    toggleClass(ident, 'is-tired', st < 0.2);
    const lm = f.line.limit || f.line.max || 1;
    const lk = Math.max(0, Math.min(1, f.line.out / lm));
    setStyle(lineFill, 'transform', `scaleX(${lk.toFixed(3)})`);
    const leftM = Math.max(0, Math.round((lm - f.line.out) / WORLD.pxPerM));
    setText(lineTxt, lk > 0.85 ? `${leftM} m left!` : `${Math.round(f.line.out / WORLD.pxPerM)} m · ${leftM} m left`);
    toggleClass(right, 'is-spooling', lk > 0.85);
    const pr = Math.max(0, Math.min(1, fight.progress || 0));
    setStyle(landFill, 'transform', `scaleX(${pr.toFixed(3)})`);
    setStyle(landFish, '--p', pr.toFixed(3));
    setText(landTxt, `${Math.round(pr * 100)}%`);

    // mode call-outs (state-driven, so they work with or without events)
    if (fight.mode !== lastMode) {
      const m = fight.mode;
      lastMode = m;
      if (m === 'run' || m === 'dive' || m === 'jump' || m === 'thrash') call(m);
    }
    if (!tiredShown && st < 0.18 && fight.time > 2) {
      tiredShown = true;
      call('tired');
    }
    if (callT > 0) {
      callT -= dt;
      if (callT <= 0) callout.classList.remove('is-show');
    }
  }

  return { update };
}
