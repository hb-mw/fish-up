// UI module — Fishdex detail page: big animated portrait, rarity, your records, habitat (biomes, depth,
// active times, layer), favourite baits (after the first catch), fight style with power pips, the fun fact.
import { h, fmtInt, setText } from './dom.js';
import { icon } from './icons.js';
import { pips } from './panel.js';
import { formatWeight, formatLength } from '../data/species.js';
import { LURES, lureAffinity } from '../data/lures.js';
import { rarityOf, BIOMES, WORLD } from '../core/config.js';

const LAYER = { surface: 'Near the surface', pelagic: 'Open water', demersal: 'Just above the seabed', benthic: 'On the seabed' };
const STYLE = {
  darter: ['Darter', 'Quick zig-zag bursts'],
  runner: ['Runner', 'Long, screaming runs'],
  diver: ['Diver', 'Bores for the bottom'],
  jumper: ['Jumper', 'Leaps and head-shakes'],
  thrasher: ['Thrasher', 'Rolls, twists and shakes'],
  bulldog: ['Bulldog', 'Stubborn short tugs'],
  deadweight: ['Dead weight', 'Slow and very heavy'],
  floater: ['Floater', 'Drifts, barely fights'],
};
const SIZE_WORD = { length: 'length', wingspan: 'wingspan', bell: 'bell', shell: 'shell', width: 'width', height: 'height' };
const KIND = { junk: 'Ocean junk — cleanup bonus', treasure: 'Treasure — worth a fortune', bottle: 'Drifting curiosity — read the note' };

export function createDexDetail(ui) {
  const { game } = ui;
  let depthPx = 400;
  let grad = null, gradKey = '';
  const portrait = ui.portraits.live(560, 250, {
    cls: 'fu-dd-portrait', fill: 0.82, active: false, silColor: 'rgba(3, 10, 22, 0.9)', amp: 0.45, speed: 0.9,
    backdrop: (ctx, w, hh, t, p) => {
      const key = depthPx + '|' + (p.silhouette ? 1 : 0);
      if (key !== gradKey) {
        gradKey = key;
        const top = game.env.waterColorAt(Math.max(0, depthPx - 600), 2000);
        const bot = game.env.waterColorAt(depthPx + 800, 2000);
        const lift = (c, k) => c.map((v) => v + (255 - v) * k);
        const a = lift(top, 0.18), b = lift(bot, 0.06);
        grad = ctx.createLinearGradient(0, 0, 0, hh);
        grad.addColorStop(0, `rgb(${a.map((v) => v | 0).join(',')})`);
        grad.addColorStop(1, `rgb(${b.map((v) => v | 0).join(',')})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, hh);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const cx = w * (0.15 + i * 0.24) + Math.sin(t * 0.25 + i * 2) * 20;
        ctx.fillStyle = `rgba(255,255,240,${(0.035 + 0.025 * Math.sin(t * 0.6 + i)).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(cx - 10, 0);
        ctx.lineTo(cx + 18, 0);
        ctx.lineTo(cx + 70, hh);
        ctx.lineTo(cx + 6, hh);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 12; i++) {
        const px = (i * 83.7) % w, py = hh - ((i * 47.3 + t * (14 + (i % 5) * 4)) % (hh + 10));
        ctx.fillStyle = 'rgba(225,248,255,0.3)';
        ctx.beginPath();
        ctx.arc(px, py, 1.2 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  });

  const stage = h('div.fu-dd-stage', null, portrait.canvas, h('span.fu-dd-q', { text: '?' }));
  const chips = h('div.fu-dd-chips');
  const name = h('h3.fu-dd-name');
  const sci = h('div.fu-dd-sci');
  const sections = h('div.fu-dd-secs');
  const el = h('aside.fu-dd.fu-scroll', null, stage, h('div.fu-dd-head', null, chips, name, sci), sections);

  function sec(title, ico, ...kids) {
    return h('section.fu-dd-sec', null, h('h4', { html: icon(ico) + `<span>${title}</span>` }), ...kids);
  }
  function tile(ico, label, value, cls = '') {
    return h(`div.fu-dd-tile${cls}`, { html: `${icon(ico)}<div><label>${label}</label><b></b></div>` }, null);
  }

  function show(e) {
    const s = e.species;
    const found = e.discovered;
    const isItem = s.group === 'item';
    const r = rarityOf(s.level);
    depthPx = ((s.depthM[0] + s.depthM[1]) / 2) * WORLD.pxPerM;
    portrait.set(s.id, { silhouette: !found, shiny: found && e.shinyCount > 0, fill: isItem ? 0.62 : 0.82 });
    el.classList.toggle('is-unknown', !found);
    el.style.setProperty('--rc', isItem ? '#e8c87a' : r.color);
    chips.innerHTML = (isItem ? `<span class="fu-rar" style="--rc:#e8c87a">${icon('chest')}Item</span>`
      : `<span class="fu-rar" style="--rc:${r.color}">${icon('gem')}${r.name}</span><span class="fu-dd-lv">Lv ${s.level}</span>`)
      + (s.protected ? `<span class="fu-dd-prot">${icon('leaf')}Protected</span>` : '')
      + (found && e.shinyCount > 0 ? `<span class="fu-dd-shiny">${icon('sparkle')}Shiny ×${e.shinyCount}</span>` : '');
    setText(name, found ? s.name : '???');
    setText(sci, found ? s.sci : 'Not yet discovered');
    sections.innerHTML = '';

    if (found) {
      const t = (ico, label, val, gold) => {
        const d = tile(ico, label, val, gold ? '.is-gold' : '');
        d.querySelector('b').textContent = val;
        return d;
      };
      const best = SIZE_WORD[s.sizeLabel] || 'length';
      sections.appendChild(sec('Your records', 'trophy', h('div.fu-dd-tiles', null,
        t('fish', 'Caught', `×${fmtInt(e.count)}`),
        t('weight', 'Heaviest', e.bestWeightKg ? formatWeight(e.bestWeightKg) : '—'),
        t('ruler', `Best ${best}`, e.bestLengthCm ? formatLength(e.bestLengthCm) : '—'),
        t('star', 'Best score', e.bestPoints ? `${fmtInt(e.bestPoints)} pts` : '—', true),
        t('calendar', 'First caught', e.firstDay ? `Day ${e.firstDay}` : '—'),
        t('sparkle', 'Shiny', e.shinyCount ? `×${e.shinyCount}` : '—', e.shinyCount > 0))));
    }

    // habitat — shown as clues even before the first catch
    const biomes = s.biomes.map((b) => (BIOMES.find((x) => x.id === b) || { name: b }).name);
    const depth = `${s.depthM[0]}–${s.depthM[1]} m` + (s.nightDepthM ? ` · ${s.nightDepthM[0]}–${s.nightDepthM[1]} m at night` : '');
    const act = ['dawn', 'day', 'dusk', 'night'].map((k) => {
      const v = Math.max(0, Math.min(1, (s.active && s.active[k]) || 0));
      return `<span class="fu-dd-act" style="--a:${(0.18 + 0.82 * Math.min(1, v)).toFixed(2)}" title="${k}">${icon(k === 'night' ? 'moon' : 'sun')}<em>${k}</em></span>`;
    }).join('');
    sections.appendChild(sec(found ? 'Habitat' : 'Clues', found ? 'map' : 'eye',
      h('div.fu-dd-habitat', null,
        h('div.fu-dd-row', { html: `${icon('compass')}<span>${biomes.join(' · ')}</span>` }),
        h('div.fu-dd-row', { html: `${icon('depth')}<span>${depth}</span>` }),
        isItem ? h('div.fu-dd-row', { html: `${icon('info')}<span>${KIND[s.item.kind] || ''}</span>` })
          : h('div.fu-dd-row', { html: `${icon('wave')}<span>${LAYER[s.layer] || s.layer}</span>` }),
        isItem ? null : h('div.fu-dd-acts', { html: act }))));

    if (!isItem) {
      if (found) {
        const baits = LURES.map((l) => ({ l, a: lureAffinity(l, s) })).filter((o) => o.a >= 0.35).sort((a, b) => b.a - a.a).slice(0, 4);
        sections.appendChild(sec('Favourite baits', 'hook', baits.length
          ? h('div.fu-dd-baits', { html: baits.map((o) => `<span class="fu-dd-bait" style="--lc:${o.l.color}"><i></i>${o.l.name}</span>`).join('') })
          : h('p.fu-dd-note', { text: 'None of your lures suit it — it must eat something else.' })));
        const st = STYLE[s.fight.style] || [s.fight.style, ''];
        sections.appendChild(sec('Fight', 'flame', h('div.fu-dd-fight', {
          html: `<div class="fu-dd-style"><b>${st[0]}</b><span>${st[1]}</span></div>
            <div class="fu-dd-pip"><label>Power</label>${pips(s.fight.power, 10, 'is-red')}</div>
            <div class="fu-dd-pip"><label>Stamina</label>${pips(s.fight.stamina, 10, 'is-amber')}</div>`,
        })));
      } else {
        sections.appendChild(sec('Favourite baits', 'lock', h('p.fu-dd-note', { text: 'Catch one to learn what it bites.' })));
      }
    }
    if (found && s.fact) sections.appendChild(sec('Did you know?', 'info', h('p.fu-dd-fact', { text: s.fact })));
    el.scrollTop = 0;
  }

  return {
    el,
    show,
    setActive(on) {
      portrait.active = on;
    },
  };
}
