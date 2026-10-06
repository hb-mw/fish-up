// UI module — the title screen: the live sea behind, a bobbing "FISH UP!" logo (layered lettering; the "!" is a
// fishing hook with a bobber), tagline, Play / Continue / New Game / Settings and a controls hint.
import { h, letteringHTML } from './dom.js';
import { icon } from './icons.js';
import { keycap } from './hud.js';

/** Logo markup (also reused by the catch card / level-up via CSS classes). */
export function logoHTML() {
  const word = (text, start) => letteringHTML(text, 'fu-lg-ch', start);
  // the "!": a hook (stem + barbed curl) with a red-and-white bobber for the dot
  const bang = `<span class="fu-lg-ch fu-lg-bang" style="--i:7">
    <svg viewBox="0 0 120 300" class="fu-lg-hook" aria-hidden="true">
      <defs>
        <linearGradient id="fu-lg-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#fff7d1"/><stop offset=".38" stop-color="#ffd447"/><stop offset=".72" stop-color="#ffa62b"/><stop offset="1" stop-color="#f0702a"/>
        </linearGradient>
        <radialGradient id="fu-lg-bob-r" cx=".38" cy=".3" r=".75"><stop offset="0" stop-color="#ff9a8a"/><stop offset=".5" stop-color="#ec2f2f"/><stop offset="1" stop-color="#9d1220"/></radialGradient>
        <radialGradient id="fu-lg-bob-w" cx=".38" cy=".2" r=".9"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfdbe6"/></radialGradient>
      </defs>
      <g class="fu-lg-hook-line"><path d="M58 -60 V24" /></g>
      <g class="fu-lg-hook-shape">
        <path class="o" d="M58 44 V176 a15 15 0 0 1 -30 0 v-6 l11 8"/>
        <path class="r" d="M58 44 V176 a15 15 0 0 1 -30 0 v-6 l11 8"/>
        <path class="f" d="M58 44 V176 a15 15 0 0 1 -30 0 v-6 l11 8"/>
        <circle class="eye" cx="58" cy="34" r="10"/>
      </g>
      <g class="fu-lg-bobber">
        <path d="M60 222 v-14" class="stick"/>
        <circle cx="60" cy="252" r="30" class="ring"/>
        <path d="M30 252 a30 30 0 0 1 60 0 z" fill="url(#fu-lg-bob-r)"/>
        <path d="M30 252 a30 30 0 0 0 60 0 z" fill="url(#fu-lg-bob-w)"/>
        <path d="M30 252 h60" class="band"/>
        <ellipse cx="49" cy="238" rx="9" ry="5" fill="#fff" opacity=".75" transform="rotate(-25 49 238)"/>
      </g>
    </svg>
  </span>`;
  const fish = `<svg class="fu-lg-fish" viewBox="0 0 120 64" aria-hidden="true">
      <path class="o" d="M8 32c18-26 58-30 84-10l20-14v48L92 42C66 62 26 58 8 32z"/>
      <path class="f" d="M8 32c18-26 58-30 84-10l20-14v48L92 42C66 62 26 58 8 32z"/>
      <path class="fin" d="M46 12c8-8 22-10 30-6l-6 12z"/>
      <circle cx="28" cy="29" r="5.5" fill="#0a2240"/><circle cx="26.5" cy="27.5" r="2" fill="#fff"/>
      <path class="gill" d="M40 22c4 6 4 14 0 20"/>
    </svg>`;
  return `<div class="fu-logo">
    <div class="fu-lg-row">${word('FISH', 0)}<span class="fu-lg-gap"></span>${word('UP', 5)}${bang}</div>
    ${fish}
    <svg class="fu-lg-wave" viewBox="0 0 900 70" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="fu-lg-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#3fd6f0"/><stop offset=".5" stop-color="#1696cf"/><stop offset="1" stop-color="#0a5c99" stop-opacity=".0"/>
      </linearGradient></defs>
      <path class="w1" d="M0 38 C 75 8 150 8 225 38 S 375 68 450 38 S 600 8 675 38 S 825 68 900 38 V70 H0z"/>
      <path class="w2" d="M0 44 C 75 20 150 20 225 44 S 375 68 450 44 S 600 20 675 44 S 825 68 900 44"/>
    </svg>
  </div>`;
}

export function createTitle(ui) {
  const { game, layers } = ui;
  const primaryBtn = h('button.fu-btn.fu-btn-gold.fu-btn-xl', { data: { sfx: 'none' } });
  const newBtn = h('button.fu-btn.fu-btn-glass.fu-btn-lg', { html: icon('anchor') + '<span>New game</span>' });
  const setBtn = h('button.fu-btn.fu-btn-glass.fu-btn-lg', { html: icon('cog') + '<span>Settings</span>' });
  const hint = h('div.fu-title-hint', {
    html: [
      `${keycap('SPACE')} cast &amp; reel`,
      `${keycap('A')}${keycap('D')} sail`,
      `${keycap('B')} shop`,
      `${keycap('F')} Fishdex`,
      `${keycap('Q')} quests`,
      `${keycap('M')} mute`,
    ].map((s) => `<span>${s}</span>`).join('<i></i>'),
  });
  const el = h('div.fu-title', null,
    h('div.fu-title-vignette'),
    h('div.fu-title-logo', { html: logoHTML() }),
    h('div.fu-title-tag', { html: '<i></i><span>Fifty species. One ocean. How deep will you go?</span><i></i>' }),
    h('div.fu-title-menu', null, primaryBtn, h('div.fu-title-row', null, newBtn, setBtn)),
    hint,
  );
  layers.title.appendChild(el);

  let hasSave = false;
  let leaving = false;
  let recheck = 1;

  function refresh() {
    const p = ui.prog();
    hasSave = false;
    try {
      hasSave = !!(p && p.hasSave && p.hasSave());
    } catch { /* ignore */ }
    primaryBtn.innerHTML = icon('play') + `<span>${hasSave ? 'Continue' : 'Play'}</span>`;
    newBtn.style.display = hasSave ? '' : 'none';
    el.classList.toggle('has-save', hasSave);
  }

  function start() {
    if (leaving || game.mode !== 'title') return;
    leaving = true;
    ui.sfx('ui_claim');
    el.classList.add('is-leaving');
    try {
      game.audio.unlock && game.audio.unlock();
    } catch { /* ignore */ }
    setTimeout(() => {
      game.start();
      try {
        game.input.releaseAll();
      } catch { /* ignore */ }
    }, 380);
  }

  primaryBtn.addEventListener('click', start);
  setBtn.addEventListener('click', () => ui.openPanel('settings'));
  newBtn.addEventListener('click', async () => {
    const ok = await ui.confirm({
      title: 'Start a new game?',
      text: 'Your catches, coins, gear and Fishdex will be wiped. This cannot be undone.',
      ok: 'Start over',
      danger: true,
      icon: 'trash',
    });
    if (!ok) return;
    const p = ui.prog();
    try {
      if (p && p.reset) p.reset();
    } catch (e) {
      game.reportError('ui.reset', e);
    }
    ui.store.set('tips', {});
    start();
  });

  return {
    show() {
      leaving = false;
      refresh();
      el.classList.remove('is-leaving', 'is-gone');
      el.classList.add('is-on');
    },
    hide(animated) {
      el.classList.remove('is-on');
      if (!animated) el.classList.add('is-gone');
      else setTimeout(() => el.classList.add('is-gone'), 700);
    },
    primary() {
      if (ui.panelName()) return;
      start();
    },
    update(dt) {
      // re-check the save now and then (META may finish loading, or a save may appear late)
      recheck -= dt;
      if (recheck <= 0 && !leaving) {
        recheck = 1;
        const before = hasSave;
        refresh();
        if (before !== hasSave) primaryBtn.classList.add('is-swap');
      }
    },
  };
}
