// UI module — shared panel shell (header, coins, close, tabs) and small form widgets used by the
// shop, Fishdex, quests and pause/settings panels.
import { h, setText, fmtInt, retrigger } from './dom.js';
import { icon } from './icons.js';

/**
 * A centred modal panel. Returns { el, card, body, head, tabs, setSub, setTabs, show, hide, onShow, coins }.
 * opts: { name, icon, title, sub, coins (bool), wide (px), tall (px) }
 */
export function panelShell(ui, opts) {
  const { game } = ui;
  const sub = h('p.fu-pn-sub', { text: opts.sub || '' });
  const coinNum = h('span.fu-num', { text: '0' });
  const coins = opts.coins ? h('div.fu-pill.fu-coins.fu-pn-coins', { html: icon('coin', 'fu-pill-ico') }, coinNum) : null;
  const close = h('button.fu-pn-close', { attrs: { 'aria-label': 'Close', title: 'Close (Esc)' }, html: icon('close') + '<kbd class="fu-rbtn-key">Esc</kbd>', data: { sfx: 'none' } });
  close.addEventListener('click', () => ui.closePanel());
  const head = h('header.fu-pn-head', null,
    h('div.fu-pn-badge', { html: icon(opts.icon || 'info') }),
    h('div.fu-pn-titles', null, h('h2.fu-pn-title', { text: opts.title }), sub),
    h('div.fu-pn-head-right', null, coins, close));
  const tabs = h('nav.fu-tabs');
  const body = h('div.fu-pn-body');
  const card = h('div.fu-pn.fu-glass', null, head, tabs, body);
  const el = h(`div.fu-panel.fu-panel-${opts.name}`, { style: { '--pw': String(opts.wide || 1480), '--ph': String(opts.tall || 900) } }, card);
  ui.layers.panel.appendChild(el);

  let shownCoins = null;
  function syncCoins(animate) {
    if (!coins) return;
    const c = Math.round(game.player.coins || 0);
    if (shownCoins === null || !animate) setText(coinNum, fmtInt(c));
    else if (c !== shownCoins) {
      ui.anim.count(coinNum, shownCoins, c, 0.6, fmtInt);
      retrigger(coins, c < shownCoins ? 'is-spend' : 'is-gain');
    }
    shownCoins = c;
  }

  let tabList = [];
  let tabCur = null;
  let onTab = null;
  function setTabs(list, cur, cb) {
    tabList = list;
    onTab = cb;
    tabs.innerHTML = '';
    tabs.style.display = list.length ? '' : 'none';
    for (const t of list) {
      const b = h('button.fu-tab', { html: (t.icon ? icon(t.icon) : '') + `<span>${t.label}</span>` + (t.count != null ? `<em>${t.count}</em>` : '') + '<i class="fu-tab-dot"></i>', data: { sfx: 'none', id: t.id } });
      b.addEventListener('click', () => selectTab(t.id, true));
      tabs.appendChild(b);
    }
    selectTab(cur || (list[0] && list[0].id), false);
  }
  function selectTab(id, user) {
    if (user && id === tabCur) return;
    tabCur = id;
    for (const b of tabs.children) b.classList.toggle('is-on', b.dataset.id === id);
    if (user) ui.sfx('ui_tab');
    if (onTab) onTab(id, user);
  }
  function stepTab(dir) {
    if (!tabList.length) return;
    const i = Math.max(0, tabList.findIndex((t) => t.id === tabCur));
    selectTab(tabList[(i + dir + tabList.length) % tabList.length].id, true);
  }
  function markTab(id, on) {
    for (const b of tabs.children) if (b.dataset.id === id) b.classList.toggle('has-dot', !!on);
  }

  return {
    el, card, body, head, tabs,
    setSub: (t) => setText(sub, t),
    setTabs, selectTab, stepTab, markTab,
    tab: () => tabCur,
    syncCoins,
    show() {
      syncCoins(false);
      el.classList.add('is-open');
    },
    hide() {
      el.classList.remove('is-open');
    },
    /** ←/→ switch tabs while the panel is open. */
    onKey(e) {
      if (e.code === 'ArrowRight' || (e.code === 'Tab' && !e.shiftKey)) {
        e.preventDefault();
        stepTab(1);
      } else if (e.code === 'ArrowLeft' || (e.code === 'Tab' && e.shiftKey)) {
        e.preventDefault();
        stepTab(-1);
      }
    },
  };
}

/** Tier pips: ●●●○○ */
export function pips(n, max, cls = '') {
  let s = `<span class="fu-pips ${cls}">`;
  for (let i = 1; i <= max; i++) s += `<i class="${i <= n ? 'on' : ''}"></i>`;
  return s + '</span>';
}

/** Labelled progress bar (DOM). */
export function progressBar(value, goal, cls = '') {
  const k = goal > 0 ? Math.max(0, Math.min(1, value / goal)) : 0;
  return h(`div.fu-prog${cls ? '.' + cls : ''}`, null,
    h('div.fu-bar', null, h('i.fu-bar-fill', { style: { transform: `scaleX(${k.toFixed(4)})` } })),
    h('span.fu-prog-num', { text: `${fmtInt(value)} / ${fmtInt(goal)}` }));
}

/** Range slider 0..1 with a filled track. onInput(v) fires live; onChange(v) on release. */
export function slider(label, ico, value, onInput, onChange) {
  const input = h('input.fu-range', { type: 'range', min: '0', max: '100', step: '1', value: String(Math.round(value * 100)) });
  const num = h('b.fu-set-val', { text: `${Math.round(value * 100)}%` });
  const paint = () => {
    input.style.setProperty('--k', input.value + '%');
    setText(num, `${input.value}%`);
  };
  paint();
  input.addEventListener('input', () => {
    paint();
    onInput && onInput(Number(input.value) / 100);
  });
  input.addEventListener('change', () => onChange && onChange(Number(input.value) / 100));
  const row = h('label.fu-set-row', null, h('span.fu-set-lab', { html: icon(ico) + `<span>${label}</span>` }), input, num);
  row.set = (v) => {
    input.value = String(Math.round(v * 100));
    paint();
  };
  return row;
}

/** On/off switch. */
export function toggle(label, ico, on, onSet) {
  const b = h('button.fu-switch', { attrs: { role: 'switch', 'aria-checked': String(!!on) } }, h('i'));
  let state = !!on;
  const paint = () => {
    b.classList.toggle('is-on', state);
    b.setAttribute('aria-checked', String(state));
  };
  paint();
  const row = h('div.fu-set-row', null, h('span.fu-set-lab', { html: icon(ico) + `<span>${label}</span>` }), b);
  b.addEventListener('click', () => {
    state = !state;
    paint();
    onSet(state);
  });
  row.set = (v) => {
    state = !!v;
    paint();
  };
  return row;
}

/** Segmented choice. options: [{id, label}] */
export function segmented(label, ico, options, cur, onSet) {
  const seg = h('div.fu-seg');
  const btns = options.map((o) => {
    const b = h('button.fu-seg-btn', { text: o.label, data: { id: o.id } });
    b.addEventListener('click', () => {
      set(o.id);
      onSet(o.id);
    });
    seg.appendChild(b);
    return b;
  });
  const set = (id) => btns.forEach((b) => b.classList.toggle('is-on', b.dataset.id === id));
  set(cur);
  const row = h('div.fu-set-row', null, h('span.fu-set-lab', { html: icon(ico) + `<span>${label}</span>` }), seg);
  row.set = set;
  return row;
}
