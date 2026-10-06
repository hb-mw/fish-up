// UI module — the play HUD: player stats (top-left), clock / weather / biome (top-centre) with banners,
// panel buttons (top-right), lure belt (bottom-left), contextual prompt + first-time tips (bottom-centre).
import { h, setText, setStyle, toggleClass, retrigger, fmtInt, fmtClock, uiCanvas, fitCanvas, E } from './dom.js';
import { icon, WEATHER_ICON } from './icons.js';
import { biomeAt, ZONES, BIOMES, WORLD } from '../core/config.js';
import { WEATHER_TYPES } from '../world/environment.js';
import { LURES_BY_ID } from '../data/lures.js';
import { drawLureIcon } from './lureart.js';

const BIOME_COPY = {
  shore: 'Home sweet home',
  reef: 'Warm, shallow and bursting with colour',
  kelp: 'Swaying forests hide bold hunters',
  slope: 'The seabed falls away into the blue',
  open: 'Endless blue. Giants roam here',
  trench: 'The deepest place on Earth',
};

/** Prompt templates per fishing state. [KEY] becomes a key-cap, ' · ' a separator. */
const PROMPTS = {
  idle: 'Hold [SPACE] to cast · [A] [D] to sail',
  charging: 'Release [SPACE] to cast',
  casting: '',
  waiting: 'Hold [SPACE] to reel · tap to jig · [S] to drop deeper · [R] retrieve',
  bite: '[SPACE] Strike now!',
  fight: 'Hold [SPACE] to reel · let go in the red',
  landing: 'Bringing it aboard…',
  caught: '',
  broken: '',
};

const TIPS = [
  { id: 'cast', state: 'idle', delay: 1.4, icon: 'rod', title: 'Cast your line',
    text: 'Hold [SPACE] to build power and release to cast. Clicking the sea works too.' },
  { id: 'sink', state: 'waiting', delay: 1.6, icon: 'depth', title: 'Find the right depth',
    text: 'The lure sinks on its own. Hold [SPACE] to reel and hold that depth, tap it to jig, hold [S] to let it sink again.' },
  { id: 'fight', state: 'fight', delay: 0.4, icon: 'hook', title: 'Fish on!',
    text: 'Hold [SPACE] to reel. Let go when the needle hits red — but keep some tension or the hook shakes loose.' },
  { id: 'shop', after: 1, delay: 1.2, icon: 'shop', title: 'Upgrade your gear',
    text: 'Press [B] for the shop: longer line and stronger rods open up deeper, wilder water.' },
  { id: 'dex', after: 2, delay: 1.2, icon: 'book', title: 'Your Fishdex',
    text: 'Press [F] to browse every species you have found — and clues to the ones still hiding.' },
  { id: 'sail', idleFor: 40, delay: 0, icon: 'compass', title: 'Explore the ocean',
    text: 'Sail right with [D]. The further out you go, the deeper and stranger the sea becomes.' },
];

/** "Hold [SPACE] to cast · [A] [D] to sail" → HTML with key-caps. */
export function promptHTML(tpl) {
  return tpl
    .split(' · ')
    .map((part) => `<span class="fu-pr-part">${part.replace(/\[([^\]]+)\]/g, (_, k) => keycap(k))}</span>`)
    .join('<i class="fu-pr-sep"></i>');
}
/** Plain rich text: [KEY] → key-cap, no layout wrappers (for tips and paragraphs). */
export function richText(tpl) {
  return tpl.replace(/\[([^\]]+)\]/g, (_, k) => keycap(k));
}
export function keycap(k) {
  const wide = k.length > 2 ? ' is-wide' : '';
  return `<kbd class="fu-key${wide}">${k}</kbd>`;
}

export function createHud(ui) {
  const { game, layers, anim } = ui;
  const root = h('div.fu-hud');
  layers.hud.appendChild(root);

  // ── top-left: level, XP, coins, score ─────────────────────────────────────
  const lvlNum = h('span.fu-lvl-num', { text: '1' });
  const lvlBadge = h('div.fu-lvl', null, h('span.fu-lvl-lab', { text: 'LV' }), lvlNum);
  const titleEl = h('div.fu-player-title', { text: 'Deckhand' });
  const xpFill = h('i.fu-xp-fill');
  const xpText = h('div.fu-xp-text');
  const xpBar = h('div.fu-xp', null, xpFill);
  const coinNum = h('span.fu-num', { text: '0' });
  const coinDelta = h('span.fu-delta');
  const coinPill = h('div.fu-pill.fu-coins', { html: icon('coin', 'fu-pill-ico') }, coinNum, coinDelta);
  const scoreNum = h('span.fu-num', { text: '0' });
  const scorePill = h('div.fu-pill.fu-score', { html: icon('trophy', 'fu-pill-ico') }, scoreNum, h('small', { text: 'pts' }));
  const tl = h('section.fu-hud-tl.fu-in-left', null,
    h('div.fu-player.fu-glass', null, lvlBadge, h('div.fu-player-info', null, titleEl, xpBar, xpText)),
    h('div.fu-wallet', null, coinPill, scorePill));
  root.appendChild(tl);

  // ── top-centre: clock pill + banner slot ──────────────────────────────────
  const dial = h('div.fu-dial', {
    html: `<svg viewBox="0 0 64 36" class="fu-dial-svg">
      <path class="fu-dial-arc" d="M7 31 A25 25 0 0 1 57 31"/>
      <path class="fu-dial-hz" d="M2 31.5 H62"/>
      <g class="fu-dial-body"><circle class="fu-dial-glow" r="9"/><circle class="fu-dial-sun" r="4.6"/>
        <path class="fu-dial-moon" d="M2.6 -3.6 A4.6 4.6 0 1 0 2.6 3.6 A3.6 3.6 0 1 1 2.6 -3.6z"/></g>
    </svg>`,
  });
  const dialBody = dial.querySelector('.fu-dial-body');
  const timeEl = h('div.fu-time', { text: '07:12' });
  const dayEl = h('div.fu-day');
  const weatherIco = h('span.fu-wx-ico');
  const weatherTxt = h('span');
  const biomeTxt = h('span');
  const clock = h('div.fu-clock.fu-glass', null,
    dial,
    h('div.fu-clock-main', null, timeEl, dayEl),
    h('i.fu-clock-sep'),
    h('div.fu-clock-item.fu-wx', null, weatherIco, weatherTxt),
    h('i.fu-clock-sep'),
    h('div.fu-clock-item.fu-biome', { html: icon('compass') }, biomeTxt));
  const bannerSlot = h('div.fu-banner-slot');
  const tc = h('section.fu-hud-tc.fu-in-top', null, clock, bannerSlot);
  root.appendChild(tc);

  // ── top-right: round panel buttons ────────────────────────────────────────
  const rbtn = (ico, key, label, onClick, extra) =>
    h('button.fu-rbtn', { attrs: { 'aria-label': label, title: `${label} (${key})` }, html: icon(ico) + `<kbd class="fu-rbtn-key">${key}</kbd>` + (extra || ''), on: { click: onClick }, data: { sfx: 'none' } });
  const questBtn = rbtn('scroll', 'Q', 'Quests', () => ui.togglePanel('quests'), '<i class="fu-dot"></i>');
  const muteBtn = rbtn('sound', 'M', 'Sound', () => ui.toggleMute());
  const tr = h('section.fu-hud-tr.fu-in-right', null,
    rbtn('shop', 'B', 'Shop', () => ui.togglePanel('shop')),
    rbtn('book', 'F', 'Fishdex', () => ui.togglePanel('dex')),
    questBtn,
    h('i.fu-rbtn-gap'),
    rbtn('pause', 'Esc', 'Pause', () => ui.openPanel('pause')),
    muteBtn);
  root.appendChild(tr);

  // ── bottom-left: lure belt ────────────────────────────────────────────────
  const beltName = h('span.fu-belt-name');
  const beltHint = h('span.fu-belt-hint');
  const lineChip = h('span.fu-belt-line', { html: icon('line') + '<b></b>' });
  const slotsEl = h('div.fu-belt-slots');
  const belt = h('section.fu-hud-bl.fu-in-left', null,
    h('div.fu-belt-head', null, beltName, beltHint, lineChip), slotsEl);
  root.appendChild(belt);

  // ── bottom-centre: tip + prompt (the fight console mounts into the same column) ──
  const tipSlot = h('div.fu-tip-slot');
  const prompt = h('div.fu-prompt');
  const bc = h('section.fu-hud-bc', null, tipSlot, prompt);
  root.appendChild(bc);

  // ── touch controls (coarse pointers only): ◀ ▶ sail, ▼ let line out ──────────
  let touchPad = null;
  try {
    if (window.matchMedia('(pointer: coarse)').matches) {
      const tb = (dir, act, label) => {
        const b = h(`button.fu-touch.is-${dir}`, { attrs: { 'aria-label': label }, html: icon(dir === 'l' ? 'back' : dir === 'r' ? 'next' : 'down'), data: { sfx: 'none' } });
        const on = (v) => (e) => {
          e.preventDefault();
          game.input.setVirtual(act, v);
          b.classList.toggle('is-down', v);
        };
        b.addEventListener('pointerdown', on(true));
        for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, on(false));
        return b;
      };
      touchPad = h('section.fu-touchpad', null, h('div', null, tb('l', 'left', 'Sail left'), tb('r', 'right', 'Sail right')), tb('d', 'down', 'Let line out'));
      root.appendChild(touchPad);
      root.classList.add('has-touch');
    }
  } catch { /* no matchMedia */ }

  // ── state ────────────────────────────────────────────────────────────────
  const shown = { coins: null, score: null, level: null, xpP: -1 };
  let levelInfo = null;
  let levelPoll = 0;
  let clockPoll = 0;
  let lastBiome = null;
  let lureKey = '';
  let slots = [];
  let promptKey = null;
  let promptOverride = null; // {html, until, kind}
  let catches = 0;
  let idleT = 0;
  let introDone = false;

  function readLevel() {
    const p = ui.prog();
    let info = null;
    if (p && p.getLevelInfo) {
      try {
        info = p.getLevelInfo();
      } catch (e) {
        game.reportError('ui.getLevelInfo', e);
      }
    }
    if (!info) {
      const pl = game.player;
      info = { level: pl.level || 1, title: null, xp: pl.xp || 0, xpIntoLevel: 0, xpForLevel: 0, progress: 0, maxLevel: 0 };
    }
    levelInfo = info;
  }

  function renderLevel(animate) {
    const L = levelInfo;
    if (!L) return;
    if (shown.level !== L.level) {
      if (shown.level !== null && animate) retrigger(lvlBadge, 'is-pop');
      shown.level = L.level;
      setText(lvlNum, L.level);
    }
    setText(titleEl, L.title || 'Angler');
    const p = Math.max(0, Math.min(1, L.progress || 0));
    if (Math.abs(p - shown.xpP) > 0.0005) {
      shown.xpP = p;
      setStyle(xpFill, 'transform', `scaleX(${p.toFixed(4)})`);
    }
    if (L.maxLevel && L.level >= L.maxLevel) setText(xpText, 'Max level');
    else if (L.xpForLevel) setText(xpText, `${fmtInt(L.xpIntoLevel)} / ${fmtInt(L.xpForLevel)} XP`);
    else setText(xpText, `${fmtInt(L.xp)} XP`);
  }

  function updateWallet(instant) {
    const pl = game.player;
    const c = Math.round(pl.coins || 0), s = Math.round(pl.score || 0);
    if (shown.coins === null || instant) {
      shown.coins = c;
      setText(coinNum, fmtInt(c));
    } else if (c !== shown.coins) {
      const d = c - shown.coins;
      anim.count(coinNum, shown.coins, c, Math.min(1.4, 0.45 + Math.abs(d) / 2500), fmtInt);
      shown.coins = c;
      retrigger(coinPill, d > 0 ? 'is-gain' : 'is-spend');
      coinDelta.textContent = (d > 0 ? '+' : '−') + fmtInt(Math.abs(d));
      coinDelta.classList.toggle('is-neg', d < 0);
      retrigger(coinDelta, 'is-show');
    }
    if (shown.score === null || instant) {
      shown.score = s;
      setText(scoreNum, fmtInt(s));
    } else if (s !== shown.score) {
      anim.count(scoreNum, shown.score, s, 1.1, fmtInt);
      shown.score = s;
      retrigger(scorePill, 'is-gain');
    }
  }

  // ── clock / weather / biome ───────────────────────────────────────────────
  function updateClock() {
    const env = game.env;
    setText(timeEl, fmtClock(env.hour));
    setText(dayEl, `Day ${env.day}`);
    const wt = env.weather.type;
    if (weatherIco.__w !== wt) {
      weatherIco.__w = wt;
      weatherIco.innerHTML = icon(WEATHER_ICON[wt] || 'w-clear');
    }
    setText(weatherTxt, (WEATHER_TYPES[wt] && WEATHER_TYPES[wt].name) || wt);
    setText(biomeTxt, biomeAt(game.boat.x).name);
    // dial: the sun rides the arc by day, the moon by night
    const day = env.sun.elev > -0.04;
    let p;
    if (day) p = (env.sun.x - 0.1) / 0.8;
    else p = (env.moon.x - 0.14) / 0.72;
    p = Math.max(0, Math.min(1, p));
    const a = Math.PI * (1 - p);
    const x = 32 + Math.cos(a) * 25, y = 31 - Math.sin(a) * 25;
    dialBody.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    toggleClass(dial, 'is-night', !day);
    toggleClass(clock, 'is-night', env.night > 0.5);
  }

  // ── banners ──────────────────────────────────────────────────────────────
  let banner = null;
  const bannerQueue = [];
  function showBanner(b) {
    if (banner) {
      // a newer banner replaces the old one quickly (don't queue a stale "Coral Reef")
      bannerQueue.length = 0;
      bannerQueue.push(b);
      hideBanner(true);
      return;
    }
    const el = h(`div.fu-banner.fu-banner-${b.theme || 'default'}`, null,
      b.kicker ? h('div.fu-banner-kicker', null, h('i'), h('span', { text: b.kicker }), h('i')) : null,
      h('div.fu-banner-title', { text: b.title }),
      b.sub ? h('div.fu-banner-sub', { text: b.sub }) : null);
    bannerSlot.appendChild(el);
    banner = { el, t: 0, dur: b.dur || 3.6 };
  }
  function hideBanner(fast) {
    if (!banner) return;
    const el = banner.el;
    banner = null;
    el.classList.add(fast ? 'is-out-fast' : 'is-out');
    setTimeout(() => {
      el.remove();
      if (bannerQueue.length) showBanner(bannerQueue.shift());
    }, fast ? 180 : 650);
  }
  function biomeBanner(id) {
    const b = BIOMES.find((x) => x.id === id);
    if (!b) return;
    showBanner({ kicker: 'Now sailing', title: b.name, sub: BIOME_COPY[id] || '', theme: id });
  }
  function zoneBanner(toId, fromId) {
    const z = ZONES.find((x) => x.id === toId);
    if (!z) return;
    const fromIdx = ZONES.findIndex((x) => x.id === fromId), toIdx = ZONES.indexOf(z);
    const deeper = toIdx > fromIdx;
    const m = Math.round(z.from / WORLD.pxPerM);
    const name = z.name.toUpperCase().startsWith('THE') ? z.name : 'The ' + z.name;
    showBanner({
      kicker: deeper ? (m ? `${m} m down` : 'Surface') : 'Rising into',
      title: name,
      sub: deeper ? z.blurb : z.blurb,
      theme: 'zone-' + z.id,
      dur: 3.8,
    });
  }

  game.events.on('biome', (e) => {
    if (game.mode !== 'play' || !e) return;
    lastBiome = e.to;
    biomeBanner(e.to);
  });
  game.events.on('zone', (e) => {
    if (game.mode !== 'play' || !e) return;
    zoneBanner(e.to, e.from);
  });
  // daily log → a short summary when the sun comes up on a new day
  const today = { n: 0, pts: 0, fresh: 0 };
  game.events.on('catchScored', (e) => {
    const r = e && e.record;
    if (!r) return;
    today.n++;
    today.pts += r.points || 0;
    if (r.isNew) today.fresh++;
  });
  game.events.on('newDay', (e) => {
    if (game.mode !== 'play') return;
    const d = (e && e.day) || game.env.day;
    const sub = today.n
      ? `Yesterday: ${today.n} catch${today.n > 1 ? 'es' : ''} · ${fmtInt(today.pts)} pts${today.fresh ? ` · ${today.fresh} new species` : ''}`
      : 'The sea has restocked overnight';
    today.n = today.pts = today.fresh = 0;
    showBanner({ kicker: 'A new day', title: `Day ${d}`, sub, theme: 'day', dur: 4 });
  });

  // ── lure belt ─────────────────────────────────────────────────────────────
  function buildBelt() {
    const lures = (game.player.lures || []).filter((id) => LURES_BY_ID[id]);
    slotsEl.innerHTML = '';
    slots = lures.map((id, i) => {
      const cv = uiCanvas(game, 52, 52, 'fu-slot-cv');
      const b = h('button.fu-slot', { attrs: { 'aria-label': LURES_BY_ID[id].name, title: LURES_BY_ID[id].name }, data: { sfx: 'none' } },
        cv, i < 9 ? h('kbd.fu-slot-key', { text: String(i + 1) }) : null);
      b.addEventListener('click', () => selectLure(id, true));
      slotsEl.appendChild(b);
      return { id, el: b, cv, drawnSel: null };
    });
    for (const s of slots) drawSlot(s, 0);
  }
  function drawSlot(s, t) {
    const k = fitCanvas(game, s.cv);
    const ctx = s.cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, s.cv.width, s.cv.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawLureIcon(ctx, s.id, 26, 27, 44, t);
  }
  function selectLure(id, fromClick) {
    const f = game.fishing;
    if (f.state !== 'idle') {
      if (fromClick) {
        ui.sfx('ui_error');
        retrigger(belt, 'is-denied');
        flashPrompt('Reel in first to switch lures', 'warn', 1.6);
      }
      return;
    }
    if (game.player.lureId === id) return;
    const p = ui.prog();
    let ok = false;
    if (p && p.selectLure) {
      try {
        ok = p.selectLure(id) !== false;
      } catch (e) {
        game.reportError('ui.selectLure', e);
      }
    } else {
      // no META yet: mirror the choice locally so the belt still works in demos
      game.player.lureId = id;
      game.fishing.lure.id = id;
      ok = true;
    }
    if (ok) ui.sfx('ui_equip');
  }
  function updateBelt(t) {
    const pl = game.player;
    const key = (pl.lures || []).join(',');
    if (key !== lureKey) {
      lureKey = key;
      buildBelt();
    }
    const sel = pl.lureId;
    const lure = LURES_BY_ID[sel];
    setText(beltName, lure ? lure.name : '—');
    setText(lineChip.lastChild, `${Math.round(pl.stats.lineLengthM || 0)} m`);
    const locked = game.fishing.state !== 'idle';
    toggleClass(belt, 'is-locked', locked);
    setText(beltHint, locked ? 'reel in to switch' : slots.length > 1 ? `${Math.min(9, slots.length) > 1 ? '1–' + Math.min(9, slots.length) : '1'} to switch` : '');
    for (const s of slots) {
      const on = s.id === sel;
      toggleClass(s.el, 'is-sel', on);
      if (on) drawSlot(s, t);
      else if (s.drawnSel !== false) {
        drawSlot(s, 0);
      }
      s.drawnSel = on;
    }
  }

  // ── prompt & tips ─────────────────────────────────────────────────────────
  function flashPrompt(text, kind = 'info', dur = 2.2) {
    promptOverride = { html: promptHTML(text), until: game.time.real + dur, kind };
    promptKey = null;
  }
  function updatePrompt() {
    const st = game.fishing.state;
    let html, kind = st;
    if (promptOverride && game.time.real < promptOverride.until) {
      html = promptOverride.html;
      kind = 'flash-' + promptOverride.kind;
    } else {
      promptOverride = null;
      const tpl = PROMPTS[st] !== undefined ? PROMPTS[st] : '';
      html = tpl ? promptHTML(tpl) : '';
    }
    const key = kind + '|' + html;
    if (key === promptKey) return;
    promptKey = key;
    if (!html) {
      prompt.classList.remove('is-on');
      return;
    }
    prompt.className = `fu-prompt is-on is-${kind}`;
    prompt.innerHTML = html;
    retrigger(prompt, 'is-swap');
  }

  let tip = null;
  let tipWait = 0;
  let tipCandidate = null;
  const tipsOff = game.flags.tips === '0';
  function tipSeen(id) {
    return !!(ui.store.get('tips', {})[id]);
  }
  function markTip(id) {
    const seen = { ...ui.store.get('tips', {}) };
    seen[id] = 1;
    ui.store.set('tips', seen);
  }
  function showTip(def) {
    const ok = h('button.fu-btn.fu-btn-small.fu-btn-glass', { html: 'Got it ' + keycap('Enter') });
    const el = h('div.fu-tip.fu-glass', null,
      h('div.fu-tip-ico', { html: icon(def.icon) }),
      h('div.fu-tip-body', null, h('div.fu-tip-title', { text: def.title }), h('div.fu-tip-text', { html: richText(def.text) })),
      ok);
    ok.addEventListener('click', () => dismissTip());
    tipSlot.appendChild(el);
    tip = { def, el, t: 0 };
    markTip(def.id);
  }
  function dismissTip() {
    if (!tip) return;
    const el = tip.el;
    tip = null;
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 260);
  }
  function updateTips(dt) {
    if (tipsOff) return;
    const st = game.fishing.state;
    if (tip) {
      tip.t += dt;
      const d = tip.def;
      // state tips leave with their state; the rest time out
      if ((d.state && st !== d.state && tip.t > 0.8) || tip.t > (d.state ? 14 : 9)) dismissTip();
      return;
    }
    if (ui.cardOpen || ui.panelName()) {
      tipCandidate = null;
      return;
    }
    let cand = null;
    for (const d of TIPS) {
      if (tipSeen(d.id)) continue;
      if (d.state && d.state === st) cand = d;
      else if (d.after && catches >= d.after && st === 'idle') cand = d;
      else if (d.idleFor && idleT > d.idleFor && st === 'idle') cand = d;
      if (cand) break;
    }
    if (cand !== tipCandidate) {
      tipCandidate = cand;
      tipWait = 0;
    }
    if (cand) {
      tipWait += dt;
      if (tipWait >= cand.delay) {
        showTip(cand);
        tipCandidate = null;
      }
    }
  }

  // ── events ───────────────────────────────────────────────────────────────
  const refreshLevel = () => {
    readLevel();
    renderLevel(true);
  };
  /** Quest dot: read getQuests() only when quest state can have changed (never per frame). */
  function refreshQuestDot() {
    const p = ui.prog();
    let claimable = false;
    if (p && p.getQuests) {
      try {
        claimable = p.getQuests().some((q) => q.done && !q.claimed);
      } catch { /* ignore */ }
    }
    toggleClass(questBtn, 'has-dot', claimable);
  }
  for (const ev of ['questProgress', 'questComplete', 'profileReset', 'gameStart', 'ready', 'ui:close']) game.events.on(ev, refreshQuestDot);
  game.events.on('xp', refreshLevel);
  game.events.on('levelUp', refreshLevel);
  game.events.on('catchDismissed', () => {
    catches++;
    refreshLevel();
  });
  game.events.on('profileReset', () => {
    ui.store.set('tips', {});
    catches = 0;
    readLevel();
    shown.level = null;
    renderLevel(false);
    updateWallet(true);
    lureKey = '';
  });
  game.events.on('hookMiss', () => flashPrompt('Missed it! Strike the moment the [!] appears', 'warn', 2.6));
  game.events.on('lineSnap', () => flashPrompt('SNAP! Let go of [SPACE] when the tension turns red', 'bad', 3.2));
  game.events.on('escape', (e) => {
    const r = e && e.reason;
    flashPrompt(r === 'slack' ? 'It shook loose — keep a little tension on the line' : r === 'jump' ? 'It threw the hook mid-air — ease off when it jumps' : 'It got away…', 'bad', 3.2);
  });
  game.events.on('retrieved', () => flashPrompt('Nothing this time — try another depth or lure', 'info', 2.2));
  game.events.on('castCharge', () => {
    idleT = 0;
    if (tip && tip.def.id === 'cast') dismissTip();
  });

  // ── API ──────────────────────────────────────────────────────────────────
  function onPlay(fromTitle) {
    refreshQuestDot();
    readLevel();
    renderLevel(false);
    updateWallet(true);
    updateClock();
    root.classList.remove('is-intro');
    void root.offsetWidth;
    root.classList.add('is-intro');
    if (!introDone) {
      introDone = true;
      lastBiome = biomeAt(game.boat.x).id;
      anim.after(fromTitle ? 0.9 : 0.5, () => biomeBanner(lastBiome));
    }
  }

  function update(dt, t) {
    if (game.fishing.state === 'idle' && !game.paused && Math.abs(game.boat.vx || 0) < 5) idleT += dt;
    else if (Math.abs(game.boat.vx || 0) >= 5) idleT = 0;

    // level is event-driven (xp / levelUp / reset); this slow poll is only a safety net
    levelPoll -= dt;
    if (levelPoll <= 0) {
      levelPoll = 2;
      readLevel();
      renderLevel(true);
    }
    if (!ui.cardOpen) updateWallet(false);

    clockPoll -= dt;
    if (clockPoll <= 0) {
      clockPoll = 0.25;
      updateClock();
    }
    toggleClass(muteBtn, 'is-muted', !!game.settings.muted);
    const want = game.settings.muted ? 'mute' : 'sound';
    if (muteBtn.__ico !== want) {
      muteBtn.__ico = want;
      muteBtn.querySelector('use').setAttribute('href', '#fu-i-' + want);
    }
    if (banner) {
      banner.t += dt;
      if (banner.t > banner.dur) hideBanner(false);
    }
    updateBelt(t);
    updatePrompt();
    updateTips(dt);
    const st = game.fishing.state;
    toggleClass(root, 'is-fighting', st === 'fight' || st === 'landing');
    toggleClass(root, 'is-carded', ui.cardOpen);
  }

  function resize() {
    for (const s of slots) drawSlot(s, 0);
    toggleClass(root, 'is-narrow', game.view.w < 1760);
  }
  resize();

  return {
    update,
    onPlay,
    resize,
    dismissTip,
    flashPrompt,
    showBanner,
    refreshLures() {
      for (const s of slots) drawSlot(s, 0);
    },
    /** The HUD root element (other HUD parts mount into it). */
    root,
    bottomColumn: bc,
    coinTarget: () => coinPill,
    xpTarget: () => lvlBadge,
  };
}
