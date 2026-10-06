// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — the interface. createUI(game) builds every screen inside game.uiRoot (#ui):
// title, HUD, fight console, catch card, shop, Fishdex, quests, pause/settings, toasts —
// plus world-anchored indicators drawn on the crisp overlay canvas (renderOverlay).
//
// Everything reads game state defensively: game.progression may be null and gameplay may be absent.
// Panels: openPanel('shop' | 'dex' | 'quests' | 'pause' | 'settings', arg?) — 'dex' takes an optional species id.
// ─────────────────────────────────────────────────────────────────────────────
import { h, createAnimator } from './dom.js';
import { mountIcons } from './icons.js';
import { createPortraits } from './portrait.js';
import { loadLureArt } from './lureart.js';
import { createTitle } from './title.js';
import { createHud } from './hud.js';
import { createGauges } from './gauge.js';
import { createFightHud } from './fight.js';
import { createOverlay } from './overlay.js';
import { createToasts } from './toasts.js';
import { createCatchCard } from './catchcard.js';
import { createShop } from './shop.js';
import { createDex } from './dex.js';
import { createQuests } from './quests.js';
import { createPause } from './pause.js';

const STORE_KEY = 'fishup.ui.v1';
const PANEL_KEYS = { shop: 'shop', dex: 'dex', quests: 'quests' };

/**
 * @param {object} game the kernel game object
 * @returns {{update(dt:number):void, renderOverlay(octx:CanvasRenderingContext2D):void, toast(text:string, kind?:string, icon?:string):void,
 *            openPanel(name:string, arg?:any):boolean, closePanel():void, isOpen():boolean}}
 */
export function createUI(game) {
  const root = game.uiRoot;
  root.classList.add('fu-root');
  mountIcons(root);
  loadFonts();

  const layers = {};
  for (const name of ['hud', 'title', 'fx', 'card', 'panel', 'toast', 'dialog']) {
    layers[name] = h(`div.fu-layer.fu-layer-${name}`);
    root.appendChild(layers[name]);
  }

  // ── shared context handed to every component ────────────────────────────
  let lastHover = 0;
  const ui = {
    game,
    root,
    layers,
    anim: createAnimator(),
    portraits: createPortraits(game),
    store: createStore(game),
    /** game.progression or null — never cache it, META may arrive late. */
    prog: () => game.progression || null,
    sfx(name, opts) {
      try {
        game.audio.play(name, opts);
      } catch { /* audio is optional */ }
      if (name === 'ui_click') game.events.emit('ui:click', {});
    },
    hoverSfx() {
      const now = performance.now();
      if (now - lastHover < 70) return;
      lastHover = now;
      try {
        game.audio.play('ui_hover');
      } catch { /* optional */ }
      game.events.emit('ui:hover', {});
    },
    /** Is the card (or another modal moment) holding the player's attention? */
    cardOpen: false,
    panelName: () => panelName,
    openPanel,
    closePanel,
    togglePanel,
    confirm,
    toast: (text, kind, icon) => toasts.push(text, kind, icon),
    toggleMute,
  };

  const toasts = createToasts(ui);
  const hud = createHud(ui);
  ui.hud = hud;
  const gauges = createGauges(ui);
  const fight = createFightHud(ui);
  const overlay = createOverlay(ui);
  const card = createCatchCard(ui);
  ui.card = card;
  const title = createTitle(ui);
  ui.title = title;
  const panels = {
    shop: createShop(ui),
    dex: createDex(ui),
    quests: createQuests(ui),
    pause: createPause(ui, 'pause'),
    settings: createPause(ui, 'settings'),
  };
  // shared scrim behind panels (dims + blurs the world)
  const scrim = h('div.fu-scrim', { on: { pointerdown: () => closePanel() } });
  layers.panel.prepend(scrim);

  // ── generic button sounds + no stray focus (Space must never re-click a button) ──
  root.addEventListener('pointerover', (e) => {
    const b = e.target.closest && e.target.closest('button, .fu-hoverable');
    if (!b || b.disabled || (e.relatedTarget && b.contains(e.relatedTarget))) return;
    ui.hoverSfx();
  });
  root.addEventListener('mousedown', (e) => {
    if (e.target.closest && e.target.closest('button')) e.preventDefault();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest && e.target.closest('button');
    if (!b) return;
    if (b.dataset.sfx !== 'none' && !b.classList.contains('is-disabled')) ui.sfx(b.dataset.sfx || 'ui_click');
    if (document.activeElement === b) b.blur();
  });

  // ── panels ──────────────────────────────────────────────────────────────
  let panel = null;
  let panelName = null;
  let pausedByUs = false;

  function openPanel(name, arg) {
    if (name === 'settings' && game.mode === 'play') name = 'pause';
    if (name === 'pause' && game.mode !== 'play') name = 'settings';
    const p = panels[name];
    if (!p) return false;
    if (game.mode !== 'play' && name !== 'settings') return false;
    if (ui.cardOpen && name !== 'pause') return false;
    if (panelName === name) {
      if (p.refresh) p.refresh(arg);
      return true;
    }
    const switching = !!panel;
    if (panel) hidePanel(true);
    panel = p;
    panelName = name;
    try {
      p.show(arg);
    } catch (e) {
      game.reportError('ui.panel.' + name, e);
    }
    root.classList.add('has-panel');
    game.lockInput('ui-panel', true);
    if (game.mode === 'play' && !game.paused) {
      game.setPaused(true);
      pausedByUs = true;
    }
    ui.sfx(switching ? 'ui_tab' : 'ui_open');
    game.events.emit('ui:open', { panel: name });
    return true;
  }
  function hidePanel(switching) {
    if (!panel) return;
    const name = panelName;
    try {
      panel.hide();
    } catch (e) {
      game.reportError('ui.panel.' + name, e);
    }
    panel = null;
    panelName = null;
    game.events.emit('ui:close', { panel: name });
    if (!switching) {
      root.classList.remove('has-panel');
      game.lockInput('ui-panel', false);
      if (pausedByUs) {
        pausedByUs = false;
        game.setPaused(false);
      }
    }
  }
  function closePanel() {
    if (!panel) return;
    hidePanel(false);
    ui.sfx('ui_close');
  }
  function togglePanel(name, arg) {
    if (panelName === name) closePanel();
    else openPanel(name, arg);
  }

  // ── confirm dialog ──────────────────────────────────────────────────────
  let dialog = null;
  function confirm({ title, text, ok = 'Confirm', cancel = 'Cancel', danger = false, icon = 'warn' }) {
    return new Promise((resolve) => {
      if (dialog) dialog.close(false);
      const okBtn = h(`button.fu-btn.${danger ? 'fu-btn-danger' : 'fu-btn-gold'}`, { text: ok });
      const noBtn = h('button.fu-btn.fu-btn-glass', { text: cancel });
      const el = h('div.fu-dialog', null,
        h('div.fu-dialog-card.fu-glass.fu-pop', null,
          h('div.fu-dialog-icon', { html: `<svg class="fu-ico" viewBox="0 0 24 24"><use href="#fu-i-${icon}"/></svg>`, class: danger ? 'is-danger' : '' }),
          h('h3.fu-dialog-title', { text: title }),
          h('p.fu-dialog-text', { text }),
          h('div.fu-dialog-btns', null, noBtn, okBtn)));
      const close = (v) => {
        if (!dialog || dialog.el !== el) return;
        dialog = null;
        el.classList.add('is-leaving');
        setTimeout(() => el.remove(), 220);
        game.lockInput('ui-dialog', false);
        resolve(v);
      };
      okBtn.addEventListener('click', () => close(true));
      noBtn.addEventListener('click', () => close(false));
      el.addEventListener('pointerdown', (e) => {
        if (e.target === el) close(false);
      });
      layers.dialog.appendChild(el);
      game.lockInput('ui-dialog', true);
      dialog = { el, close };
      ui.sfx('ui_open');
    });
  }

  // ── keyboard: Enter / Space for cards, title and dialogs; arrows for tabs ──
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (dialog) {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        dialog.close(true);
      }
      return;
    }
    if (ui.cardOpen && !panel) {
      if (!e.repeat && (e.code === 'Space' || e.code === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault();
        card.tryContinue();
      }
      return;
    }
    if (panel) {
      if (panel.onKey) panel.onKey(e);
      return;
    }
    if (game.mode === 'title' && !e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter' || e.code === 'Space')) {
      e.preventDefault();
      title.primary();
      return;
    }
    if (game.mode === 'play' && !e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter')) hud.dismissTip();
  });

  function toggleMute() {
    game.settings.muted = !game.settings.muted;
    game.saveSettings();
    toasts.push(game.settings.muted ? 'Sound off' : 'Sound on', 'info', game.settings.muted ? 'mute' : 'sound');
  }

  // ── mode tracking (title ↔ play) ────────────────────────────────────────
  let mode = null;
  function setMode(m) {
    const prev = mode;
    mode = m;
    root.classList.toggle('is-title', m === 'title');
    root.classList.toggle('is-play', m === 'play');
    if (m === 'title') title.show();
    else {
      title.hide(prev === 'title');
      hud.onPlay(prev === 'title');
      if (panelName === 'settings') closePanel();
    }
  }

  game.events.on('resize', () => {
    ui.portraits.resize();
    hud.resize && hud.resize();
    gauges.resize && gauges.resize();
  });
  game.events.on('catchDismissed', () => {
    // a played game: make sure a held SPACE (from the card) does not start a cast
    try {
      game.input.releaseAll();
    } catch { /* ignore */ }
  });

  loadLureArt(() => {
    hud.refreshLures && hud.refreshLures();
    panels.shop.refresh && panelName === 'shop' && panels.shop.refresh();
  });

  // ── frame update (real dt; runs while paused) ───────────────────────────
  function update(dt) {
    if (game.mode !== mode) setMode(game.mode);
    const input = game.input;
    const t = game.time.real;

    if (input.pressed('mute')) toggleMute();
    if (input.pressed('pause')) {
      if (dialog) dialog.close(false);
      else if (panel) closePanel();
      else if (game.mode === 'play') openPanel('pause');
    } else if (game.mode === 'play' && !dialog) {
      for (const a in PANEL_KEYS) {
        if (input.pressed(a)) {
          if (ui.cardOpen && !panel) break;
          togglePanel(PANEL_KEYS[a]);
          break;
        }
      }
    }

    ui.anim.tick(dt);
    try {
      if (mode === 'title') title.update(dt, t);
      if (mode === 'play') {
        hud.update(dt, t);
        gauges.update(dt, t);
        fight.update(dt, t);
      }
      card.update(dt, t);
      toasts.update(dt, t);
      if (panel && panel.update) panel.update(dt, t);
    } catch (e) {
      game.reportError('ui.update', e);
    }
    ui.portraits.tick(t);
  }

  function renderOverlay(octx) {
    if (mode !== 'play') return;
    overlay.render(octx);
  }

  return {
    update,
    renderOverlay,
    /** Show a small notification. kind: 'info' | 'good' | 'warn' | 'rare' */
    toast(text, kind = 'info', icon) {
      toasts.push(text, kind, icon);
    },
    openPanel,
    closePanel,
    /** true while a panel, dialog or the catch card is up. */
    isOpen: () => !!panel || !!dialog || ui.cardOpen,
  };
}

function loadFonts() {
  try {
    const fs = document.fonts;
    if (!fs || !fs.load) return;
    for (const f of ['500 20px "FishUp Display"', '600 20px "FishUp Display"', '700 20px "FishUp Display"', '600 20px "FishUp Text"',
      '800 20px "FishUp Text"', '20px "FishUp Logo"']) fs.load(f).catch(() => {});
  } catch { /* ignore */ }
}

/** Tiny persistent store for UI-only state (tips seen…). Honours ?nosave=1 (memory only). */
function createStore(game) {
  const persist = game.flags.nosave !== '1';
  let data = {};
  if (persist) {
    try {
      data = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch { data = {}; }
  }
  const save = () => {
    if (!persist) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
  };
  return {
    get: (k, d) => (data[k] !== undefined ? data[k] : d),
    set(k, v) {
      data[k] = v;
      save();
    },
    reset() {
      data = {};
      save();
    },
  };
}

