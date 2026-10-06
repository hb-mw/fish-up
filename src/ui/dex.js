// UI module — the Fishdex (F): a collector's book of every getDex() entry. Biome / depth-zone filters,
// completion, a grid of portraits (silhouettes + "???" until caught; secret species stay hidden) and a
// detail page (dexdetail.js). openPanel('dex', speciesId) jumps straight to a species.
import { h, setText, fmtInt, retrigger } from './dom.js';
import { icon } from './icons.js';
import { panelShell } from './panel.js';
import { createDexDetail } from './dexdetail.js';
import { SPECIES, ANIMALS } from '../data/species.js';
import { rarityOf, ZONES, WORLD } from '../core/config.js';

const BIOME_TABS = [
  { id: 'all', label: 'All', icon: 'book' },
  { id: 'reef', label: 'Reef', icon: 'fish' },
  { id: 'kelp', label: 'Kelp', icon: 'leaf' },
  { id: 'slope', label: 'Drop-off', icon: 'down' },
  { id: 'open', label: 'Open Ocean', icon: 'wave' },
  { id: 'trench', label: 'Trench', icon: 'depth' },
  { id: 'items', label: 'Treasures', icon: 'chest' },
];
const ZONE_CHIPS = [{ id: 'any', label: 'Any depth' }, ...ZONES.map((z) => ({ id: z.id, label: z.name.replace(' Zone', '').replace('The ', '') }))];

function inZone(sp, zid) {
  if (zid === 'any') return true;
  const z = ZONES.find((x) => x.id === zid);
  const a = z.from / WORLD.pxPerM, b = z.to / WORLD.pxPerM;
  const ranges = [sp.depthM, sp.nightDepthM].filter(Boolean);
  return ranges.some((r) => r[0] < b && r[1] >= a);
}

export function createDex(ui) {
  const { game } = ui;
  const shell = panelShell(ui, { name: 'dex', icon: 'book', title: 'Fishdex', sub: '', coins: false, wide: 1560, tall: 920 });
  const ringFill = h('i.fu-ring-fill');
  const ringTxt = h('b');
  const ring = h('div.fu-dx-ring', null, h('div.fu-ring', null, ringFill, h('div.fu-ring-in', null, ringTxt, h('span', { text: 'complete' }))));
  shell.head.querySelector('.fu-pn-head-right').prepend(ring);

  const zoneRow = h('div.fu-dx-zones');
  const grid = h('div.fu-dx-grid');
  const itemsHead = h('div.fu-dx-sec', { html: icon('chest') + '<span>Treasures &amp; oddities</span>' });
  const itemsGrid = h('div.fu-dx-grid');
  const empty = h('div.fu-empty.fu-dx-empty', { html: icon('fish') + '<b>Nothing here yet</b><span>No known species match this filter.</span>' });
  const left = h('div.fu-dx-left.fu-scroll', null, zoneRow, grid, itemsHead, itemsGrid, empty);
  const detail = createDexDetail(ui);
  shell.body.classList.add('fu-dx-body');
  shell.body.append(left, detail.el);

  let biome = 'all';
  let zone = 'any';
  let sel = null;
  let tiles = null; // id → {el, p, entry}
  let entries = [];

  const zoneBtns = ZONE_CHIPS.map((z) => {
    const b = h('button.fu-fchip', { text: z.label, data: { id: z.id } });
    b.addEventListener('click', () => {
      zone = z.id;
      zoneBtns.forEach((x) => x.classList.toggle('is-on', x === b));
      applyFilter();
    });
    zoneRow.appendChild(b);
    return b;
  });
  zoneBtns[0].classList.add('is-on');

  function readDex() {
    const p = ui.prog();
    if (p && p.getDex) {
      try {
        return p.getDex();
      } catch (e) {
        game.reportError('ui.getDex', e);
      }
    }
    // no META: derive from game.player.dex so the book still opens
    const dex = game.player.dex || {};
    return SPECIES.map((s) => {
      const d = dex[s.id];
      const found = !!(d && d.count > 0);
      return { species: s, discovered: found, count: found ? d.count : 0, bestLengthCm: found ? d.bestLengthCm : 0, bestWeightKg: found ? d.bestWeightKg : 0, bestPoints: found ? d.bestPoints : 0, shinyCount: found ? d.shinyCount || 0 : 0, firstDay: found ? d.firstDay : null };
    });
  }

  function buildTiles() {
    tiles = new Map();
    SPECIES.forEach((s, i) => {
      const isItem = s.group === 'item';
      const p = ui.portraits.thumb(150, 92, { fill: isItem ? 0.7 : 0.9, silColor: 'rgba(4, 12, 26, 0.92)', glow: true });
      const no = h('span.fu-dx-no', { text: isItem ? '' : '#' + String(ANIMALS.indexOf(s) + 1).padStart(2, '0') });
      const name = h('b.fu-dx-name');
      const count = h('span.fu-dx-count');
      const el = h('button.fu-dx-tile', { style: { '--rc': rarityOf(s.level).color, '--i': String(i % 12) }, data: { sfx: 'none', id: s.id } },
        h('div.fu-dx-pic', null, p.canvas, h('span.fu-dx-q', { text: '?' })), no, name, count, h('i.fu-dx-shiny', { html: icon('sparkle') }));
      el.addEventListener('click', () => select(s.id, true));
      (isItem ? itemsGrid : grid).appendChild(el);
      tiles.set(s.id, { el, p, name, count, entry: null });
    });
  }

  function refreshTiles() {
    entries = readDex();
    let found = 0, total = 0;
    for (const e of entries) {
      const s = e.species, t = tiles.get(s.id);
      if (!t) continue;
      t.entry = e;
      const isItem = s.group === 'item';
      if (!isItem && (!s.secret || e.discovered)) {
        total++;
        if (e.discovered) found++;
      }
      const wasFound = t.el.classList.contains('is-found');
      t.el.classList.toggle('is-found', e.discovered);
      t.el.classList.toggle('is-unknown', !e.discovered);
      t.el.classList.toggle('is-secret', !!s.secret && !e.discovered);
      t.el.classList.toggle('has-shiny', e.shinyCount > 0);
      setText(t.name, e.discovered ? s.name : '???');
      setText(t.count, e.discovered ? `×${fmtInt(e.count)}` : '');
      if (!t.p.speciesId || wasFound !== e.discovered) t.p.set(s.id, { silhouette: !e.discovered, shiny: false });
    }
    const p = ui.prog();
    let sum = null;
    try {
      sum = p && p.getSummary ? p.getSummary() : null;
    } catch { /* ignore */ }
    const tot = sum && sum.speciesTotal ? sum.speciesTotal : total;
    const fnd = sum && sum.speciesFound != null ? sum.speciesFound : found;
    const pct = tot ? Math.floor((fnd / tot) * 100) : 0;
    setText(ringTxt, `${pct}%`);
    ringFill.style.setProperty('--k', String(pct / 100));
    shell.setSub(`${fnd} of ${tot} species discovered`);
  }

  function applyFilter() {
    let shown = 0;
    for (const e of entries) {
      const s = e.species, t = tiles.get(s.id);
      const isItem = s.group === 'item';
      let ok = !(s.secret && !e.discovered);
      if (biome === 'items') ok = ok && isItem;
      else if (biome !== 'all') ok = ok && !isItem && s.biomes.includes(biome);
      if (zone !== 'any') ok = ok && !isItem && inZone(s, zone);
      t.el.style.display = ok ? '' : 'none';
      if (ok) shown++;
    }
    const anyItems = [...itemsGrid.children].some((c) => c.style.display !== 'none');
    itemsHead.style.display = anyItems && biome !== 'items' ? '' : 'none';
    grid.style.display = biome === 'items' ? 'none' : '';
    empty.style.display = shown ? 'none' : '';
    retrigger(left, 'is-swap');
  }

  function select(id, user) {
    const t = tiles.get(id);
    if (!t || !t.entry) return;
    if (sel && tiles.get(sel)) tiles.get(sel).el.classList.remove('is-sel');
    sel = id;
    t.el.classList.add('is-sel');
    detail.show(t.entry);
    if (user) ui.sfx('ui_tab');
  }

  shell.setTabs(BIOME_TABS, biome, (id) => {
    biome = id;
    if (tiles) applyFilter();
  });

  game.events.on('dexNew', () => {
    if (ui.panelName() === 'dex') refreshTiles();
  });

  return {
    show(arg) {
      if (!tiles) buildTiles();
      refreshTiles();
      applyFilter();
      const pick = (arg && tiles.has(arg) && arg) || sel || (entries.find((e) => e.discovered) || entries[0]).species.id;
      select(pick, false);
      if (arg && tiles.get(arg)) tiles.get(arg).el.scrollIntoView({ block: 'center' });
      shell.show();
      detail.setActive(true);
    },
    hide() {
      shell.hide();
      detail.setActive(false);
    },
    refresh(arg) {
      refreshTiles();
      if (arg && tiles.has(arg)) select(arg, false);
    },
    onKey: shell.onKey,
  };
}
