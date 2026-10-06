// UI module — the catch card ("FISH UP!"), shown on 'catchScored' {record}. Staged reveal: portrait → name →
// rarity → measurements count up → size stamp slams → ribbons → points breakdown line by line → total → rewards.
// Space / Enter / click: first skips the reveal, then continues (input ignored for the first 0.6 s).
// Closing emits 'catchDismissed'.
import { h, fmtInt, retrigger, E, reducedMotion, letteringHTML } from './dom.js';
import { icon } from './icons.js';
import { SPECIES_BY_ID, formatWeight, formatLength } from '../data/species.js';
import { rarityOf, sizeClassOf, WORLD, biomeAt } from '../core/config.js';

const SIZE_LABEL = { length: 'Length', wingspan: 'Wingspan', bell: 'Bell', shell: 'Shell', width: 'Width', height: 'Height' };
const GUARD = 0.6;

function titleFor(r) {
  if (r.isItem) {
    if (r.itemKind === 'treasure') return 'TREASURE!';
    if (r.itemKind === 'bottle') return 'A MESSAGE!';
    return 'CLEAN SEAS!';
  }
  return 'FISH UP!';
}

const lettersHTML = (text) => letteringHTML(text);

export function createCatchCard(ui) {
  const { game, layers, anim } = ui;
  const queue = [];
  let cur = null;

  function rgb(arr, a = 1) {
    return `rgba(${arr[0] | 0},${arr[1] | 0},${arr[2] | 0},${a})`;
  }

  /** Water-toned backdrop for the portrait: matches where the fish was caught. */
  function makeBackdrop(r) {
    const depthPx = Math.max(0, (r.depthM || 20) * WORLD.pxPerM);
    const x = game.boat.x;
    const top = game.env.waterColorAt(Math.max(0, depthPx - 500), x).slice();
    const bot = game.env.waterColorAt(depthPx + 900, x).slice();
    const lift = (c, k) => [c[0] + (255 - c[0]) * k, c[1] + (255 - c[1]) * k, c[2] + (255 - c[2]) * k];
    // keep the stage readable even at night / in the abyss
    const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
    const t0 = lum(top) < 60 ? lift(top, 0.12) : top;
    const deep = depthPx > 3000;
    const spot = r.shiny ? [255, 214, 120] : r.rarity && (r.rarity.id === 'legendary') ? [255, 200, 110] : r.rarity && r.rarity.id === 'mythic' ? [255, 90, 120] : lift(t0, 0.5);
    const rays = depthPx < 1800 && !deep;
    let grad = null, spotG = null, vig = null;
    return (ctx, w, hh, t) => {
      if (!grad) {
        grad = ctx.createLinearGradient(0, 0, 0, hh);
        grad.addColorStop(0, rgb(t0));
        grad.addColorStop(1, rgb(bot));
        spotG = ctx.createRadialGradient(w / 2, hh * 0.52, 10, w / 2, hh * 0.52, w * 0.46);
        spotG.addColorStop(0, rgb(spot, deep ? 0.38 : 0.42));
        spotG.addColorStop(1, rgb(spot, 0));
        vig = ctx.createRadialGradient(w / 2, hh / 2, hh * 0.35, w / 2, hh / 2, w * 0.62);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(2,8,18,0.55)');
      }
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, hh);
      if (rays) {
        ctx.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 5; i++) {
          const cx = w * (0.12 + i * 0.2) + Math.sin(t * 0.3 + i * 1.7) * 26;
          const a = 0.05 + 0.035 * Math.sin(t * 0.7 + i * 2.1);
          ctx.fillStyle = `rgba(255,255,240,${a.toFixed(3)})`;
          ctx.beginPath();
          ctx.moveTo(cx - 14, 0);
          ctx.lineTo(cx + 22, 0);
          ctx.lineTo(cx + 90, hh);
          ctx.lineTo(cx + 10, hh);
          ctx.closePath();
          ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.fillStyle = spotG;
      ctx.fillRect(0, 0, w, hh);
      // bubbles / marine snow
      for (let i = 0; i < 18; i++) {
        const sp = 18 + (i * 37) % 30;
        const px = (i * 97.3) % w + Math.sin(t * 1.3 + i) * 6;
        const py = deep ? ((i * 53.7 + t * 6) % hh) : hh - ((i * 61.1 + t * sp) % (hh + 20));
        const rr = deep ? 1 + (i % 3) * 0.5 : 1.5 + (i % 4);
        ctx.fillStyle = deep ? 'rgba(200,230,255,0.35)' : 'rgba(220,250,255,0.28)';
        ctx.beginPath();
        ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fill();
        if (!deep) {
          ctx.fillStyle = 'rgba(255,255,255,0.5)';
          ctx.beginPath();
          ctx.arc(px - rr * 0.35, py - rr * 0.35, rr * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, hh);
    };
  }

  function stampFor(r) {
    const id = (r.sizeClass && r.sizeClass.id) || sizeClassOf(r.sizeQ || 0.5).id;
    const name = (r.sizeClass && r.sizeClass.name) || id;
    return { id, name: name.toUpperCase() };
  }

  function open(r) {
    const sp = r.species || SPECIES_BY_ID[r.speciesId] || {};
    const rar = r.rarity || rarityOf(r.level != null ? r.level : sp.level || 0);
    const rid = r.isItem ? 'item' : rar.id;
    const stamp = stampFor(r);
    const label = SIZE_LABEL[r.sizeLabel || sp.sizeLabel || 'length'] || 'Length';
    const rich = !r.isItem && (rid === 'rare' || rid === 'epic' || rid === 'legendary' || rid === 'mythic');
    const epic = rid === 'legendary' || rid === 'mythic';

    // ── portrait ──
    const portrait = ui.portraits.live(600, 330, {
      cls: 'fu-cc-portrait', fill: r.isItem ? 0.62 : 0.8, offY: 6, shiny: !!r.shiny, amp: 0.55, speed: 1, t0: 0,
      backdrop: makeBackdrop(r),
    });
    portrait.set(r.speciesId);

    const ribbons = h('div.fu-cc-ribbons');
    if (r.isNew) ribbons.appendChild(h('span.fu-ribbon.is-new', { html: icon('sparkle') + (r.isItem ? 'New find' : 'New species') }));
    if (r.isRecord && !r.isNew) ribbons.appendChild(h('span.fu-ribbon.is-record', { html: icon('trophy') + 'New record' }));
    if (r.shiny) ribbons.appendChild(h('span.fu-ribbon.is-shiny', { html: icon('sparkle') + 'Shiny' }));
    const stampEl = r.isItem || stamp.id === 'average' ? null : h(`div.fu-stamp.is-${stamp.id}`, null, h('span', { text: stamp.name }));
    const where = biomeAt(game.boat.x).name;
    const stage = h('div.fu-cc-stage', null, portrait.canvas, h('div.fu-cc-frame'), ribbons, stampEl,
      h('div.fu-cc-where', { html: `${icon('depth')}<span>${Math.round(r.depthM || 0)} m · ${where}</span>` }));

    // ── notes under the portrait ──
    const notes = h('div.fu-cc-notes');
    if (r.released || r.protected) {
      notes.appendChild(h('div.fu-cc-note.is-release', { html: `${icon('leaf')}<div><b>Protected species — released</b><span>Conservation bonus. It swims off to grow even bigger.</span></div>` }));
    }
    if (r.note) {
      notes.appendChild(h('div.fu-parchment', null, h('div.fu-parch-text', { text: r.note }), h('i.fu-parch-seal')));
    } else if (r.isNew && sp.fact) {
      notes.appendChild(h('div.fu-cc-note.is-fact', { html: `${icon('info')}<div><b>Did you know?</b><span></span></div>` }));
      notes.lastChild.querySelector('span').textContent = sp.fact;
    }

    // ── right column ──
    const chips = h('div.fu-cc-chips', null,
      r.isItem
        ? h('span.fu-rar', { style: { '--rc': '#d9c7a0' }, text: r.itemKind === 'treasure' ? 'Treasure' : r.itemKind === 'bottle' ? 'Curiosity' : 'Junk' })
        : h('span.fu-rar', { style: { '--rc': rar.color }, html: icon('gem') + rar.name }),
      !r.isItem ? h('span.fu-cc-lv', { text: `Lv ${r.level != null ? r.level : sp.level}` }) : null,
      r.protected ? h('span.fu-cc-prot', { html: icon('leaf') + 'Protected' }) : null);
    const nameEl = h('h2.fu-cc-name', { text: r.name || sp.name || r.speciesId });
    const sciEl = h('div.fu-cc-sci', { text: sp.sci || '' });
    const wEl = h('b', { text: formatWeight(0.001) });
    const lEl = h('b', { text: formatLength(0) });
    const measures = h('div.fu-cc-meas', null,
      h('div.fu-meas', null, h('label', { html: icon('weight') + 'Weight' }), wEl),
      h('div.fu-meas', null, h('label', { html: icon('ruler') + label }), lEl),
      r.isItem ? null : h('div.fu-meas.is-size', null, h('label', { html: icon('fish') + 'Size' }), h('b', { text: (r.sizeClass && r.sizeClass.name) || stamp.name })));
    const lines = (r.breakdown && r.breakdown.length ? r.breakdown : [{ label: 'Catch', value: r.points || 0 }]).map((b) =>
      h('div.fu-bd-line', null, h('span', { text: b.label }), h('b', { text: typeof b.value === 'number' ? (b.value >= 0 ? '+' : '−') + fmtInt(Math.abs(b.value)) : String(b.value) })));
    const breakdown = h('div.fu-cc-break', null, lines);
    const totalNum = h('b.fu-cc-total-num', { text: '0' });
    const total = h('div.fu-cc-total', null, h('label', { text: 'Total' }), h('div', null, totalNum, h('small', { text: 'pts' })));
    const coinsNum = h('b', { text: '+0' });
    const xpNum = h('b', { text: '+0' });
    const rewards = h('div.fu-cc-rewards', null,
      h('div.fu-rw.is-coins', { html: icon('coin') }, coinsNum),
      h('div.fu-rw.is-xp', { html: icon('xp') }, xpNum, h('small', { text: 'XP' })));
    const right = h('div.fu-cc-right', null, chips, nameEl, sciEl, measures, breakdown, total, rewards);

    const lvl = r.levelUp
      ? h('div.fu-cc-levelup', { html: `${icon('xp')}<b>Level up!</b><span>You are now <em>Lv ${r.levelUp.level}</em>${r.levelUp.title ? ' · ' + r.levelUp.title : ''}</span>` })
      : null;
    const contBtn = h('button.fu-btn.fu-btn-gold.fu-btn-lg.fu-cc-cont', { html: 'Continue <kbd class="fu-key is-wide">SPACE</kbd>', data: { sfx: 'none' } });
    const hk = { perfect: 'Perfect', good: 'Good', late: 'Late' }[r.hookQuality] || '—';
    const hh = Math.floor(r.hour || 0), mm = Math.floor(((r.hour || 0) % 1) * 60);
    const facts = [
      ['timer', 'Fight', r.fightTime ? `${Math.round(r.fightTime)} s` : '—'],
      ['hook', 'Hook-set', hk],
      ['flame', 'Streak', r.streak > 1 ? `×${r.streak}` : '—'],
      ['clock', `Day ${r.day || game.env.day}`, `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`],
    ];
    const meta = h('div.fu-cc-facts', null, facts.map(([ic, lab, val]) =>
      h('div.fu-cc-fact', { html: `${icon(ic)}<div><label>${lab}</label><b>${val}</b></div>`, class: ic === 'hook' && r.hookQuality === 'perfect' ? 'is-gold' : '' })));

    const titleEl = h('div.fu-cc-title', { html: lettersHTML(titleFor(r)) });
    const kicker = epic ? h('div.fu-cc-kicker', { text: rid === 'mythic' ? 'Mythic catch' : 'Legendary catch' })
      : r.shiny ? h('div.fu-cc-kicker.is-shiny', { text: 'Shiny variant' }) : null;
    const card = h('div.fu-cc-card', null, h('div.fu-cc-left', null, stage, meta, notes), right);
    const el = h(`div.fu-cc.is-${rid}${r.shiny ? '.is-shiny' : ''}${r.isItem ? '.is-item' : ''}${rich ? '.is-rich' : ''}`, { style: { '--rc': r.isItem ? '#e8c87a' : rar.color } },
      h('div.fu-cc-scrim'),
      rich || r.shiny || (r.isItem && r.itemKind === 'treasure') ? h('div.fu-cc-rays') : null,
      h('div.fu-cc-wrap', null,
        h('div.fu-cc-head', null, kicker, titleEl),
        card,
        lvl,
        h('div.fu-cc-foot', null, contBtn)));
    el.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button') && e.target.closest('button') !== contBtn) return;
      tryContinue();
    });
    layers.card.appendChild(el);
    void el.offsetWidth;
    el.classList.add('is-in');

    cur = { r, el, t: 0, portrait, steps: [], done: false, contBtn };
    ui.cardOpen = true;
    game.lockInput('catch', true);
    ui.root.classList.add('has-card');

    // ── staged reveal ──
    const fast = reducedMotion();
    const at = (time, fn) => cur.steps.push({ time: fast ? Math.min(time, 0.2) : time, fn, fired: false });
    at(0.35, () => {
      nameEl.classList.add('is-in');
      sciEl.classList.add('is-in');
    });
    at(0.55, () => {
      chips.classList.add('is-in');
      meta.classList.add('is-in');
    });
    at(0.7, () => {
      measures.classList.add('is-in');
      anim.count(wEl, 0, r.weightKg || 0, 0.9, (v) => formatWeight(Math.max(0.001, v)), { ease: E.outQuart });
      anim.count(lEl, 0, r.lengthCm || 0, 0.9, (v) => formatLength(v), { ease: E.outQuart });
    });
    if (stampEl) at(1.15, () => {
      stampEl.classList.add('is-in');
      if (stamp.id === 'trophy' || stamp.id === 'huge') retrigger(card, 'is-thump');
    });
    at(1.3, () => ribbons.classList.add('is-in'));
    let tt = 1.45;
    lines.forEach((ln) => {
      at(tt, () => ln.classList.add('is-in'));
      tt += 0.16;
    });
    at(tt + 0.05, () => {
      total.classList.add('is-in');
      anim.count(totalNum, 0, r.points || 0, Math.min(1.1, 0.5 + (r.points || 0) / 4000), fmtInt, { ease: E.outCubic });
    });
    at(tt + 0.55, () => {
      rewards.classList.add('is-in');
      anim.count(coinsNum, 0, r.coins || 0, 0.6, (v) => '+' + fmtInt(v));
      anim.count(xpNum, 0, r.xp || 0, 0.6, (v) => '+' + fmtInt(v));
    });
    at(tt + 0.8, () => {
      notes.classList.add('is-in');
      if (lvl) lvl.classList.add('is-in');
      meta.classList.add('is-in');
      cur.done = true;
    });
    cur.finishAt = tt + 0.8;
  }

  function skipReveal() {
    if (!cur) return;
    for (const s of cur.steps) {
      if (!s.fired) {
        s.fired = true;
        s.fn();
      }
    }
    // land the count-ups on their final values
    cur.el.querySelectorAll('.fu-cc-meas b, .fu-cc-total-num, .fu-cc-rewards b').forEach((b) => {
      if (b.__count) {
        b.__count.t = b.__count.dur;
      }
    });
    cur.done = true;
  }

  function close() {
    if (!cur) return;
    const c = cur;
    cur = null;
    c.el.classList.add('is-out');
    c.portrait.active = false;
    setTimeout(() => {
      c.el.remove();
      c.portrait.dispose();
    }, 420);
    ui.cardOpen = false;
    ui.root.classList.remove('has-card');
    game.lockInput('catch', false);
    try {
      game.input.releaseAll();
    } catch { /* ignore */ }
    ui.sfx('ui_close');
    game.events.emit('catchDismissed', {});
    if (queue.length) setTimeout(() => !cur && queue.length && open(queue.shift()), 450);
  }

  function tryContinue() {
    if (!cur || cur.t < GUARD) return;
    if (!cur.done) {
      skipReveal();
      return;
    }
    ui.sfx('ui_click');
    close();
  }

  game.events.on('catchScored', (e) => {
    const r = e && e.record;
    if (!r) return;
    if (ui.panelName()) ui.closePanel();
    if (cur) queue.push(r);
    else open(r);
  });
  game.events.on('profileReset', () => {
    queue.length = 0;
  });

  return {
    tryContinue,
    isOpen: () => !!cur,
    update(dt) {
      if (!cur) return;
      cur.t += dt;
      for (const s of cur.steps) {
        if (!s.fired && cur.t >= s.time) {
          s.fired = true;
          s.fn();
        }
      }
      const ready = cur.t >= GUARD;
      cur.contBtn.classList.toggle('is-ready', ready);
    },
  };
}

