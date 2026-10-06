// UI module — pause menu (Esc / P) and settings. variant 'pause' (in game: Resume, quick links, quit, reset)
// or 'settings' (from the title screen). Settings write game.settings.* then game.saveSettings().
import { h } from './dom.js';
import { icon } from './icons.js';
import { panelShell, slider, toggle, segmented } from './panel.js';
import { keycap } from './hud.js';

const CONTROLS = [
  ['Sail', '[A] [D]  or  [←] [→]'],
  ['Cast', 'Hold [SPACE], release to cast — or click the sea'],
  ['Reel in · hold depth', 'Hold [SPACE]'],
  ['Jig the lure', 'Tap [SPACE]'],
  ['Let the lure sink', 'Hold [S]  or  [↓]'],
  ['Retrieve all the way', '[R]'],
  ['Set the hook', '[SPACE] the moment the ! appears'],
  ['Fight', 'Hold [SPACE] to reel, let go in the red'],
  ['Pick a lure', '[1] – [9] · [E] next lure'],
  ['Shop · Fishdex · Quests', '[B] · [F] · [Q]'],
  ['Pause · Mute', '[ESC] / [P] · [M]'],
];

export function createPause(ui, variant) {
  const { game } = ui;
  const isPause = variant === 'pause';
  const shell = panelShell(ui, {
    name: variant, icon: isPause ? 'pause' : 'cog', title: isPause ? 'Paused' : 'Settings',
    sub: isPause ? 'The sea will wait for you' : 'Sound, graphics and controls', coins: false, wide: isPause ? 1180 : 980, tall: isPause ? 820 : 940,
  });
  const S = game.settings;
  let saveT = 0;
  const saveSoon = () => {
    clearTimeout(saveT);
    saveT = setTimeout(() => game.saveSettings(), 120);
  };

  // ── settings column ──────────────────────────────────────────────────────
  const rows = {
    master: slider('Master volume', 'sound', S.master ?? 0.8, (v) => ((S.master = v), saveSoon()), () => game.saveSettings()),
    music: slider('Music', 'music', S.music ?? 0.55, (v) => ((S.music = v), saveSoon()), () => game.saveSettings()),
    sfx: slider('Sound effects', 'sfx', S.sfx ?? 0.9, (v) => ((S.sfx = v), saveSoon()), () => game.saveSettings()),
    muted: toggle('Mute everything', 'mute', !!S.muted, (v) => ((S.muted = v), game.saveSettings())),
    quality: segmented('Render quality', 'monitor', [
      { id: 'low', label: 'Low' }, { id: 'medium', label: 'Medium' }, { id: 'high', label: 'High' }, { id: 'ultra', label: 'Ultra' },
    ], S.quality || 'high', (v) => ((S.quality = v), game.saveSettings())),
    postfx: toggle('Post-processing (bloom, colour grade)', 'sparkle', S.postfx !== false, (v) => ((S.postfx = v), game.saveSettings())),
    shake: toggle('Screen shake', 'wave', S.shake !== false, (v) => ((S.shake = v), game.saveSettings())),
    tips: toggle('Show tips again', 'info', false, (v) => {
      if (v) ui.store.set('tips', {});
    }),
  };
  const settingsPane = h('div.fu-set', null,
    h('h4.fu-set-h', { html: icon('sound') + '<span>Audio</span>' }), rows.master, rows.music, rows.sfx, rows.muted,
    h('h4.fu-set-h', { html: icon('monitor') + '<span>Graphics</span>' }), rows.quality, rows.postfx, rows.shake,
    h('h4.fu-set-h', { html: icon('info') + '<span>Help</span>' }), rows.tips);
  const controlsPane = h('div.fu-ctl', null, CONTROLS.map(([a, b]) =>
    h('div.fu-ctl-row', null, h('span.fu-ctl-a', { text: a }), h('span.fu-ctl-b', { html: b.replace(/\[([^\]]+)\]/g, (_, k) => keycap(k)) }))));
  const right = h('div.fu-pause-right.fu-scroll', null, settingsPane, controlsPane);

  // ── action column (pause only) ───────────────────────────────────────────
  let left = null;
  if (isPause) {
    const resume = h('button.fu-btn.fu-btn-gold.fu-btn-lg', { html: icon('play') + '<span>Resume</span>' });
    resume.addEventListener('click', () => ui.closePanel());
    const quick = (ico, label, key, panel) => {
      const b = h('button.fu-btn.fu-btn-glass.fu-pause-link', { html: `${icon(ico)}<span>${label}</span>${keycap(key)}`, data: { sfx: 'none' } });
      b.addEventListener('click', () => ui.openPanel(panel));
      return b;
    };
    const quit = h('button.fu-btn.fu-btn-glass.fu-pause-link', { html: icon('exit') + '<span>Save &amp; quit to title</span>' });
    quit.addEventListener('click', async () => {
      const ok = await ui.confirm({ title: 'Back to the title screen?', text: 'Your progress is saved automatically.', ok: 'Quit to title', icon: 'exit' });
      if (!ok) return;
      try {
        ui.prog() && ui.prog().save && ui.prog().save();
      } catch { /* ignore */ }
      location.reload();
    });
    const reset = h('button.fu-btn.fu-btn-small.fu-pause-reset', { html: icon('trash') + '<span>Reset save…</span>' });
    reset.addEventListener('click', async () => {
      const ok = await ui.confirm({
        title: 'Erase your save?', text: 'Coins, gear, Fishdex, quests and achievements will all be wiped. This cannot be undone.',
        ok: 'Erase everything', danger: true, icon: 'trash',
      });
      if (!ok) return;
      try {
        ui.prog() && ui.prog().reset && ui.prog().reset();
      } catch (e) {
        game.reportError('ui.reset', e);
      }
      ui.store.set('tips', {});
      ui.closePanel();
      ui.toast('A fresh start. Good luck out there!', 'info', 'anchor');
    });
    left = h('div.fu-pause-left', null,
      h('div.fu-pause-logo', { html: '<span>Paused</span>' }),
      resume,
      h('div.fu-pause-links', null, quick('shop', 'Tackle shop', 'B', 'shop'), quick('book', 'Fishdex', 'F', 'dex'), quick('scroll', 'Quests', 'Q', 'quests')),
      h('div.fu-pause-grow'),
      quit, reset);
  } else {
    const back = h('button.fu-btn.fu-btn-gold.fu-btn-lg.fu-set-back', { html: icon('back') + '<span>Back</span>' });
    back.addEventListener('click', () => ui.closePanel());
    right.appendChild(back);
  }
  shell.body.classList.add(isPause ? 'fu-pause-body' : 'fu-settings-body');
  if (left) shell.body.appendChild(left);
  shell.body.appendChild(right);

  let pane = 'settings';
  shell.setTabs([
    { id: 'settings', label: 'Settings', icon: 'cog' },
    { id: 'controls', label: 'Controls', icon: 'keyboard' },
  ], pane, (id) => {
    pane = id;
    settingsPane.style.display = id === 'settings' ? '' : 'none';
    controlsPane.style.display = id === 'controls' ? '' : 'none';
  });

  function sync() {
    rows.master.set(S.master ?? 0.8);
    rows.music.set(S.music ?? 0.55);
    rows.sfx.set(S.sfx ?? 0.9);
    rows.muted.set(!!S.muted);
    rows.quality.set(S.quality || 'high');
    rows.postfx.set(S.postfx !== false);
    rows.shake.set(S.shake !== false);
    rows.tips.set(false);
  }
  game.events.on('settings', () => {
    if (ui.panelName() === variant) rows.muted.set(!!S.muted);
  });

  return {
    show() {
      sync();
      shell.show();
    },
    hide: shell.hide,
    refresh: sync,
    onKey: shell.onKey,
  };
}
