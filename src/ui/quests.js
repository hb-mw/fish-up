// UI module — quests & achievements (Q): the three active quests with progress and Claim buttons,
// a summary of your career, and the achievements wall (hidden ones masked until earned).
import { h, fmtInt, fmtDuration, retrigger, setText } from './dom.js';
import { icon } from './icons.js';
import { panelShell } from './panel.js';
import { SPECIES_BY_ID, formatWeight } from '../data/species.js';

export function createQuests(ui) {
  const { game } = ui;
  const shell = panelShell(ui, { name: 'quests', icon: 'scroll', title: 'Quests & Achievements', sub: '', coins: true, wide: 1500, tall: 900 });
  const questList = h('div.fu-q-list');
  const summary = h('div.fu-q-sum');
  const achGrid = h('div.fu-ach-grid');
  const achCount = h('span.fu-q-count');
  const left = h('div.fu-q-left.fu-scroll', null,
    h('h3.fu-q-h', { html: icon('target') + '<span>Active quests</span><small>New ones arrive as you claim</small>' }), questList,
    h('h3.fu-q-h', { html: icon('anchor') + '<span>Your career</span>' }), summary);
  const right = h('div.fu-q-right.fu-scroll', null, h('h3.fu-q-h', { html: icon('medal') + '<span>Achievements</span>' }, achCount), achGrid);
  shell.body.classList.add('fu-q-body');
  shell.body.append(left, right);
  shell.setTabs([], null, null);
  let claimedId = null;

  const call = (fn, d) => {
    const p = ui.prog();
    if (!p || !p[fn]) return d;
    try {
      return p[fn]();
    } catch (e) {
      game.reportError('ui.' + fn, e);
      return d;
    }
  };

  function questCard(q, i) {
    const k = q.goal > 0 ? Math.max(0, Math.min(1, q.progress / q.goal)) : 0;
    const state = q.claimed ? 'claimed' : q.done ? 'done' : 'open';
    const btn = state === 'done'
      ? h('button.fu-btn.fu-btn-gold.fu-q-claim', { html: icon('sparkle') + 'Claim', data: { sfx: 'none' } })
      : state === 'claimed' ? h('span.fu-q-tag.is-claimed', { html: icon('check') + 'Claimed' })
        : h('span.fu-q-tag', { text: `${Math.round(k * 100)}%` });
    const fmt = (v) => (q.type === 'weight' ? formatWeight(v) : fmtInt(v));
    const card = h(`div.fu-q.is-${state}`, { style: { '--i': String(i) } },
      h('div.fu-q-ico', { html: icon(state === 'done' ? 'sparkle' : 'scroll') }),
      h('div.fu-q-main', null,
        h('div.fu-q-title', { text: q.title }),
        h('div.fu-q-desc', { text: q.desc }),
        h('div.fu-q-prog', null,
          h('div.fu-bar', null, h('i.fu-bar-fill', { style: { transform: `scaleX(${k.toFixed(4)})` } })),
          h('span', { text: `${fmt(Math.min(q.progress, q.goal))} / ${fmt(q.goal)}` }))),
      h('div.fu-q-side', null,
        h('div.fu-q-reward', { html: `<span>${icon('coin')}${fmtInt(q.reward.coins)}</span><span>${icon('xp')}${fmtInt(q.reward.xp)} XP</span>` }),
        btn));
    if (state === 'done') btn.addEventListener('click', () => claim(q, card, btn));
    if (claimedId === q.id) card.classList.add('is-new');
    return card;
  }

  function claim(q, card, btn) {
    const p = ui.prog();
    if (!p || !p.claimQuest) return;
    let r = { ok: false };
    try {
      r = p.claimQuest(q.id) || r;
    } catch (e) {
      game.reportError('ui.claimQuest', e);
    }
    if (!r.ok) {
      ui.sfx('ui_error');
      retrigger(btn, 'is-shake');
      return;
    }
    ui.sfx('ui_claim');
    card.classList.add('is-claiming');
    const fx = h('div.fu-burst.is-gold');
    for (let i = 0; i < 16; i++) fx.appendChild(h('i', { style: { '--a': `${(i / 16) * 360}deg`, '--d': `${80 + (i % 3) * 30}`, '--s': `${0.8 + (i % 4) * 0.15}` } }));
    card.appendChild(fx);
    shell.syncCoins(true);
    claimedId = r.quest ? r.quest.id : null;
    setTimeout(() => {
      render();
      claimedId = null;
    }, 650);
  }

  function stat(ico, label, value) {
    return h('div.fu-q-stat', { html: `${icon(ico)}<div><label>${label}</label><b></b></div>` }, null);
  }

  function render() {
    const quests = call('getQuests', null);
    questList.innerHTML = '';
    if (!quests) questList.appendChild(h('div.fu-empty', { html: icon('scroll') + '<b>No quests yet</b><span>The harbour notice board is empty.</span>' }));
    else quests.forEach((q, i) => questList.appendChild(questCard(q, i)));

    const s = call('getSummary', null);
    summary.innerHTML = '';
    if (s) {
      const big = s.biggestCatch && SPECIES_BY_ID[s.biggestCatch.speciesId];
      const best = s.bestCatch && SPECIES_BY_ID[s.bestCatch.speciesId];
      const rows = [
        ['fish', 'Fish caught', fmtInt(s.totalCaught)],
        ['book', 'Species found', `${s.speciesFound} / ${s.speciesTotal}`],
        ['trophy', 'Total score', fmtInt(s.totalPoints)],
        ['coin', 'Coins earned', fmtInt(s.totalCoinsEarned)],
        ['weight', 'Biggest catch', big ? `${big.name} · ${formatWeight(s.biggestCatch.weightKg)}` : '—'],
        ['star', 'Best catch', best ? `${best.name} · ${fmtInt(s.bestCatch.points)} pts` : '—'],
        ['flame', 'Longest streak', fmtInt(s.longestStreak)],
        ['calendar', 'Days at sea', fmtInt(s.daysAtSea)],
        ['timer', 'Time played', fmtDuration(s.playTimeS)],
        ['warn', 'Got away', fmtInt(s.fishLost)],
      ];
      for (const [ico, label, val] of rows) {
        const d = stat(ico, label, val);
        d.querySelector('b').textContent = val;
        summary.appendChild(d);
      }
    }

    const achs = call('getAchievements', null) || [];
    achGrid.innerHTML = '';
    const got = achs.filter((a) => a.unlocked).length;
    setText(achCount, achs.length ? `${got} / ${achs.length}` : '');
    if (!achs.length) achGrid.appendChild(h('div.fu-empty', { html: icon('medal') + '<b>No achievements yet</b><span>Go catch something remarkable.</span>' }));
    achs.forEach((a, i) => {
      const masked = a.hidden && !a.unlocked;
      const k = a.goal > 1 ? Math.max(0, Math.min(1, a.progress / a.goal)) : 0;
      achGrid.appendChild(h(`div.fu-ach${a.unlocked ? '.is-on' : ''}${masked ? '.is-masked' : ''}`, { style: { '--i': String(i % 16) } },
        h('div.fu-ach-ico', { html: icon(masked ? 'lock' : a.unlocked ? 'medal' : 'star') }),
        h('div.fu-ach-main', null,
          h('div.fu-ach-title', { text: a.title }),
          h('div.fu-ach-desc', { text: a.desc }),
          !a.unlocked && a.goal > 1 && !masked
            ? h('div.fu-ach-prog', null, h('div.fu-bar', null, h('i.fu-bar-fill', { style: { transform: `scaleX(${k.toFixed(4)})` } })), h('span', { text: `${fmtInt(a.progress)}/${fmtInt(a.goal)}` }))
            : null)));
    });
    const open = quests ? quests.filter((q) => q.done && !q.claimed).length : 0;
    shell.setSub(open ? `${open} reward${open > 1 ? 's' : ''} ready to claim!` : 'Complete quests for coins and XP');
  }

  for (const ev of ['questProgress', 'questComplete', 'achievement', 'profileReset']) {
    game.events.on(ev, () => ui.panelName() === 'quests' && !claimedId && render());
  }

  return {
    show() {
      render();
      shell.show();
      retrigger(questList, 'is-swap');
    },
    hide: shell.hide,
    refresh: render,
    onKey: shell.onKey,
  };
}
