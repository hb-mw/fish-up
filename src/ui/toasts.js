// UI module — the notification feed (left edge, under the player panel) and the big centre celebrations
// (level up). Reacts to progression / world events; anything arriving while the catch card is up is held back
// (or dropped when the card already says it) so the reward moment stays clean.
import { h } from './dom.js';
import { icon, WEATHER_ICON } from './icons.js';
import { SPECIES_BY_ID, formatWeight, formatLength } from '../data/species.js';
import { LURES_BY_ID } from '../data/lures.js';
import { WEATHER_TYPES } from '../world/environment.js';

const KIND_ICON = { info: 'info', good: 'check', warn: 'warn', rare: 'sparkle', bad: 'warn' };
const STREAKS = new Set([3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100]);
const WEATHER_MSG = {
  clear: 'The skies clear up',
  fair: 'Fair weather rolls in',
  cloudy: 'Clouds gather overhead',
  rain: 'Rain begins to fall — fish feed boldly',
  storm: 'A storm is brewing! Hold on to your rod',
  fog: 'A thick fog settles on the water',
};
const PHASE_MSG = {
  night: { text: 'Night falls — deep-sea creatures rise toward the surface', icon: 'moon' },
  dawn: { text: 'Dawn breaks over the sea', icon: 'sun' },
  dusk: { text: 'Dusk — predators are on the hunt', icon: 'sun' },
};

export function createToasts(ui) {
  const { game, layers } = ui;
  const feed = h('div.fu-toasts');
  layers.toast.appendChild(feed);
  const items = [];
  const held = [];

  function push(text, kind = 'info', ico, opts = {}) {
    if (!text) return;
    if ((ui.cardOpen || ui.panelName()) && !opts.force) {
      if (held.length < 8) held.push([text, kind, ico, opts]);
      return;
    }
    const el = h(`div.fu-toast.is-${kind}`, null,
      h('div.fu-toast-ico', { html: icon(ico || KIND_ICON[kind] || 'info') }),
      h('div.fu-toast-body', null,
        opts.title ? h('div.fu-toast-title', { text: opts.title }) : null,
        h('div.fu-toast-text', { text })));
    feed.prepend(el);
    const it = { el, t: 0, life: opts.life || (kind === 'rare' ? 5.2 : 3.8) };
    items.push(it);
    while (items.length > 5) kill(items[0]);
  }
  function kill(it) {
    const i = items.indexOf(it);
    if (i >= 0) items.splice(i, 1);
    it.el.classList.add('is-out');
    setTimeout(() => it.el.remove(), 380);
  }

  // ── level-up celebration ──────────────────────────────────────────────────
  let celebration = null;
  const celebQueue = [];
  function itemName(id) {
    const p = ui.prog();
    if (p && p.getCatalog) {
      try {
        const it = p.getCatalog().find((x) => x.id === id);
        if (it) return it.name;
      } catch { /* ignore */ }
    }
    if (LURES_BY_ID[id]) return LURES_BY_ID[id].name;
    return String(id).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  function levelUp(e) {
    if (ui.cardOpen || celebration) {
      celebQueue.push(e);
      return;
    }
    const unlocked = (e.unlocked || []).slice(0, 4).map(itemName);
    const el = h('div.fu-lu', null,
      h('div.fu-lu-rays'),
      h('div.fu-lu-inner', null,
        h('div.fu-lu-kicker', { text: 'Level up!' }),
        h('div.fu-lu-badge', null, h('span', { text: 'LV' }), h('b', { text: String(e.level || '') })),
        e.title ? h('div.fu-lu-title', { text: e.title }) : null,
        unlocked.length
          ? h('div.fu-lu-unlocks', null, h('span.fu-lu-new', { html: icon('shop') + 'New in the shop' }),
            h('div.fu-lu-chips', null, unlocked.map((n) => h('span.fu-chip', { text: n }))))
          : null));
    layers.fx.appendChild(el);
    celebration = { el, t: 0, life: unlocked.length ? 4.6 : 3.4 };
    // (no ui sound here: the audio module plays the level-up stinger itself)
  }
  function endCelebration() {
    if (!celebration) return;
    const el = celebration.el;
    celebration = null;
    el.classList.add('is-out');
    setTimeout(() => el.remove(), 450);
  }

  // ── events ───────────────────────────────────────────────────────────────
  const ev = game.events;
  ev.on('toast', (e) => e && push(e.text, e.kind || 'info', e.icon));
  ev.on('questComplete', (e) => {
    const q = (e && e.quest) || {};
    push(q.title || 'Quest complete', 'good', 'scroll', { title: 'Quest complete!  Claim it in Quests (Q)' });
  });
  ev.on('achievement', (e) => {
    const a = (e && e.achievement) || {};
    push(a.title || 'Achievement', 'rare', 'medal', { title: 'Achievement unlocked', life: 5.5 });
  });
  ev.on('dexNew', (e) => {
    if (ui.cardOpen || !e) return; // the card's NEW SPECIES ribbon says it
    const sp = SPECIES_BY_ID[e.speciesId];
    push(sp ? sp.name : e.speciesId, 'rare', 'book', { title: 'New species!' });
  });
  ev.on('record', (e) => {
    if (ui.cardOpen || !e) return;
    const sp = SPECIES_BY_ID[e.speciesId];
    const v = e.weightKg ? formatWeight(e.weightKg) : e.lengthCm ? formatLength(e.lengthCm) : '';
    push(`${sp ? sp.name : e.speciesId}${v ? ' — ' + v : ''}`, 'good', 'trophy', { title: 'New personal best' });
  });
  ev.on('purchase', (e) => {
    if (ui.panelName() === 'shop') return; // the shop card already celebrates it
    const it = (e && e.item) || {};
    push(it.name || 'Item', 'good', 'shop', { title: 'Purchased' });
  });
  ev.on('weatherChange', (e) => {
    if (game.mode !== 'play' || !e) return;
    const name = (WEATHER_TYPES[e.to] && WEATHER_TYPES[e.to].name) || e.to;
    push(WEATHER_MSG[e.to] || name, e.to === 'storm' ? 'warn' : 'info', WEATHER_ICON[e.to] || 'w-clear');
  });
  ev.on('phase', (e) => {
    if (game.mode !== 'play' || !e || !PHASE_MSG[e.to]) return;
    push(PHASE_MSG[e.to].text, 'info', PHASE_MSG[e.to].icon);
  });
  ev.on('levelUp', (e) => e && levelUp(e));
  ev.on('catchScored', (e) => {
    const r = e && e.record;
    // hold it back: the card opens right after this event and owns the moment
    if (r && STREAKS.has(r.streak)) held.push([`${r.streak} catches in a row!`, 'rare', 'flame', { title: 'Streak' }]);
  });
  ev.on('profileReset', () => {
    held.length = 0;
    celebQueue.length = 0;
  });

  return {
    push,
    update(dt) {
      for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        it.t += dt;
        if (it.t > it.life) kill(it);
      }
      if (!ui.cardOpen && !ui.panelName() && held.length) {
        const [text, kind, ico, opts] = held.shift();
        push(text, kind, ico, opts);
      }
      // the fish always wins: a bite or a fight clears the celebration at once
      const st = game.fishing.state;
      const busy = st === 'bite' || st === 'fight' || st === 'landing';
      if (celebration) {
        celebration.t += dt;
        if (celebration.t > celebration.life || busy) endCelebration();
      } else if (!ui.cardOpen && !ui.panelName() && !busy && celebQueue.length) levelUp(celebQueue.shift());
    },
  };
}

