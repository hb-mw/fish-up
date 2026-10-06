// UI module — the tackle shop (B). Tabs per slot from game.progression.getCatalog(); item cards with icon,
// tier pips, description, stat lines with deltas, price and state; Buy / Equip with juicy feedback.
import { h, fmtInt, retrigger, uiCanvas, fitCanvas } from './dom.js';
import { icon, gearIcon } from './icons.js';
import { panelShell, pips } from './panel.js';
import { drawLureIcon } from './lureart.js';

const TABS = [
  { id: 'rod', label: 'Rods', icon: 'rod' },
  { id: 'reel', label: 'Reels', icon: 'reel' },
  { id: 'line', label: 'Lines', icon: 'line' },
  { id: 'lure', label: 'Lures', icon: 'hook' },
  { id: 'boat', label: 'Boats', icon: 'boat' },
  { id: 'gadget', label: 'Gadgets', icon: 'gadget' },
];
const SUBS = {
  rod: 'Tackle strength and casting power — stronger rods land bigger fish',
  reel: 'Faster cranking and a smoother drag when a fish runs',
  line: 'More line on the spool means deeper water — and stranger fish',
  lure: 'Every species has its favourite bait. Match the lure to the fish',
  boat: 'Sail faster and further out to sea',
  gadget: 'Clever extras. Every gadget you own is always active',
};
const FAIL = { coins: 'Not enough coins', level: 'Reach a higher level first', owned: 'Already yours', unknown: 'Not available' };

export function createShop(ui) {
  const { game } = ui;
  const shell = panelShell(ui, { name: 'shop', icon: 'shop', title: 'Tackle Shop', sub: '', coins: true, wide: 1500, tall: 900 });
  const grid = h('div.fu-shop-grid');
  const empty = h('div.fu-empty', { html: icon('shop') + '<b>The shop is closed</b><span>The harbour master hasn’t opened up yet.</span>' });
  shell.body.append(grid, empty);
  shell.body.classList.add('fu-scroll');
  let tab = 'rod';
  let flashId = null;
  let cards = [];

  function catalog() {
    const p = ui.prog();
    if (!p || !p.getCatalog) return null;
    try {
      return p.getCatalog();
    } catch (e) {
      game.reportError('ui.getCatalog', e);
      return null;
    }
  }

  function render(keepScroll) {
    const cat = catalog();
    const scroll = shell.body.scrollTop;
    grid.innerHTML = '';
    cards = [];
    empty.style.display = cat ? 'none' : '';
    if (!cat) return;
    // tab dots: something new you can afford
    for (const t of TABS) shell.markTab(t.id, cat.some((it) => it.slot === t.id && !it.owned && !it.locked && it.affordable));
    const items = cat.filter((it) => it.slot === tab);
    const maxTier = items.reduce((m, it) => Math.max(m, it.tier || 1), 1);
    items.forEach((it, i) => {
      const c = itemCard(it, maxTier, i);
      grid.appendChild(c);
      cards.push(c);
    });
    shell.setSub(SUBS[tab] || '');
    if (keepScroll) shell.body.scrollTop = scroll;
  }

  function stateOf(it) {
    if (it.equipped) return it.slot === 'gadget' ? 'active' : 'equipped';
    if (it.owned) return it.slot === 'gadget' ? 'active' : 'owned';
    if (it.locked) return 'locked';
    return it.affordable ? 'buy' : 'poor';
  }

  function itemCard(it, maxTier, i) {
    const st = stateOf(it);
    const accent = it.accent || '#7cc8ff';
    let art;
    if (it.slot === 'lure' && it.lureId) {
      art = uiCanvas(game, 120, 120, 'fu-item-cv');
      const k = fitCanvas(game, art);
      const ctx = art.getContext('2d');
      ctx.setTransform(k, 0, 0, k, 0, 0);
      drawLureIcon(ctx, it.lureId, 60, 62, 96, 0.4);
    } else {
      art = h('div.fu-item-ico', { html: icon(gearIcon(it)) });
    }
    const stats = h('ul.fu-item-stats', null, (it.stats || []).map((s) =>
      h('li', null, h('span', { text: s.label }), h('b', { text: String(s.value) }),
        s.delta ? h(`em.${s.better === true ? 'is-up' : s.better === false ? 'is-down' : 'is-same'}`, { text: s.delta }) : null)));
    let btn;
    if (st === 'equipped') btn = h('button.fu-btn.fu-btn-small.fu-item-state.is-equipped', { html: icon('check') + 'Equipped', disabled: true });
    else if (st === 'active') btn = h('button.fu-btn.fu-btn-small.fu-item-state.is-equipped', { html: icon('check') + (it.slot === 'lure' ? 'Selected' : 'Active'), disabled: true });
    else if (st === 'owned') btn = h('button.fu-btn.fu-btn-small.fu-btn-glass', { html: icon(it.slot === 'lure' ? 'hook' : 'check') + (it.slot === 'lure' ? 'Select' : 'Equip'), data: { sfx: 'none' } });
    else if (st === 'locked') btn = h('button.fu-btn.fu-btn-small.fu-item-state.is-locked', { html: icon('lock') + `Reach Lv ${it.unlockLevel}`, data: { sfx: 'none' } });
    else btn = h(`button.fu-btn.fu-btn-small.${st === 'buy' ? 'fu-btn-gold' : 'fu-btn-glass.is-poor'}`, { html: `<span>Buy</span><span class="fu-price">${icon('coin')}${fmtInt(it.price)}</span>`, data: { sfx: 'none' } });
    const owned = it.owned || it.equipped;
    const card = h(`div.fu-item.is-${st}`, { style: { '--ac': accent, '--i': String(i) }, data: { id: it.id } },
      h('div.fu-item-stage', null, art, h('div.fu-item-tier', { html: pips(it.tier || 1, maxTier) }),
        owned ? h('span.fu-item-badge', { html: icon('check') + (st === 'equipped' ? 'Equipped' : st === 'active' ? (it.slot === 'lure' ? 'Selected' : 'Active') : 'Owned') }) : null,
        st === 'locked' ? h('span.fu-item-badge.is-lock', { html: icon('lock') + `Lv ${it.unlockLevel}` }) : null),
      h('div.fu-item-body', null, h('h3.fu-item-name', { text: it.name }), h('p.fu-item-desc', { text: it.desc || '' }), stats),
      h('div.fu-item-foot', null, owned || st === 'locked' ? null : h('span.fu-item-tag', { text: st === 'poor' ? `Need ${fmtInt(it.price - (game.player.coins || 0))} more` : 'Tap to buy' }), btn));
    btn.addEventListener('click', () => act(it, st, card, btn));
    if (flashId === it.id) {
      card.classList.add('is-bought');
      card.appendChild(burst());
    }
    return card;
  }

  function burst() {
    const b = h('div.fu-burst');
    for (let i = 0; i < 14; i++) b.appendChild(h('i', { style: { '--a': `${(i / 14) * 360}deg`, '--d': `${70 + (i % 3) * 26}`, '--s': `${0.7 + (i % 4) * 0.15}` } }));
    setTimeout(() => b.remove(), 900);
    return b;
  }

  function fail(card, btn, reason) {
    ui.sfx('ui_error');
    retrigger(btn, 'is-shake');
    retrigger(card, 'is-denied');
    ui.hud.flashPrompt(FAIL[reason] || 'Can’t do that', 'warn', 1.8);
    const tag = card.querySelector('.fu-item-tag');
    if (tag) {
      tag.textContent = FAIL[reason] || 'Can’t do that';
      retrigger(tag, 'is-warn');
    }
  }

  function act(it, st, card, btn) {
    const p = ui.prog();
    if (!p) return;
    if (st === 'buy' || st === 'poor' || st === 'locked') {
      let r = { ok: false, reason: st === 'locked' ? 'level' : 'coins' };
      if (st !== 'locked') {
        try {
          r = p.buy(it.id) || r;
        } catch (e) {
          game.reportError('ui.buy', e);
        }
      }
      if (!r.ok) return fail(card, btn, r.reason);
      ui.sfx('ui_buy');
      flashId = it.id;
      shell.syncCoins(true);
      render(true);
      setTimeout(() => (flashId = null), 50);
    } else if (st === 'owned') {
      let r = { ok: false };
      try {
        r = p.equip(it.id) || r;
      } catch (e) {
        game.reportError('ui.equip', e);
      }
      if (!r.ok) return fail(card, btn, 'unknown');
      ui.sfx('ui_equip');
      flashId = it.id;
      render(true);
      setTimeout(() => (flashId = null), 50);
    }
  }

  shell.setTabs(TABS, tab, (id, user) => {
    tab = id;
    render(false);
    shell.body.scrollTop = 0;
    if (user) retrigger(grid, 'is-swap');
  });

  // stay in sync with purchases / level-ups made elsewhere while open
  for (const ev of ['coins', 'levelUp', 'equip', 'purchase', 'profileReset']) {
    game.events.on(ev, () => {
      if (ui.panelName() === 'shop') {
        shell.syncCoins(true);
        if (ev !== 'coins' && !flashId) render(true);
      }
    });
  }

  return {
    show(arg) {
      if (arg && TABS.some((t) => t.id === arg)) tab = arg;
      shell.selectTab(tab, false);
      shell.show();
      retrigger(grid, 'is-swap');
    },
    hide: shell.hide,
    refresh(arg) {
      if (arg && TABS.some((t) => t.id === arg)) shell.selectTab(arg, false);
      else render(true);
    },
    onKey: shell.onKey,
    update() {},
  };
}
