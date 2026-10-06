// Keyboard / pointer / touch → abstract actions. KERNEL FILE.
//
// Gameplay actions (blocked while input.locked is true, e.g. when a UI panel is open):
//   'action'  Space · left mouse / touch on the game canvas   (cast · reel · set hook)
//   'left' 'right'  A/D or ←/→ (sail)      'up' 'down'  W/S or ↑/↓ (down = let line out, up = reel slowly)
//   'retrieve' R (crank the line all the way in)      'lureNext' E      'lure1'…'lure9' digit keys
// UI actions (never blocked):
//   'pause' Esc/P · 'shop' B · 'dex' F · 'quests' Q · 'mute' M · 'debug' ` (backquote)

const KEYMAP = {
  Space: 'action',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyR: 'retrieve',
  KeyE: 'lureNext',
  Escape: 'pause', KeyP: 'pause',
  KeyB: 'shop',
  KeyF: 'dex',
  KeyQ: 'quests',
  KeyM: 'mute',
  Backquote: 'debug',
};
for (let i = 1; i <= 9; i++) KEYMAP['Digit' + i] = 'lure' + i;

const UI_ACTIONS = new Set(['pause', 'shop', 'dex', 'quests', 'mute', 'debug']);
const PREVENT = new Set(['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Tab']);

export function createInput(game, pointerTarget) {
  const held = new Map();      // action → number of physical sources holding it
  const virtual = new Set();   // actions held by bots / on-screen buttons
  const pressed = new Set();   // edges this frame
  const released = new Set();
  const heldCodes = new Set();
  let pointerHeld = false;

  const isBlocked = (a) => input.locked && !UI_ACTIONS.has(a);
  const isDown = (a) => (held.get(a) || 0) > 0 || virtual.has(a);

  function press(a) {
    const was = isDown(a);
    held.set(a, (held.get(a) || 0) + 1);
    if (!was) {
      pressed.add(a);
      input.any = true;
    }
  }
  function release(a) {
    const n = (held.get(a) || 0) - 1;
    held.set(a, Math.max(0, n));
    if (!isDown(a)) released.add(a);
  }

  const input = {
    /** When true, gameplay actions read as not-held (UI panels open, title screen, …). */
    locked: false,
    /** true during a frame in which any key/pointer went down (for "press any key"). */
    any: false,
    /** Pointer position in logical view coordinates + whether the primary button/touch is down on the canvas. */
    pointer: { x: 0, y: 0, down: false, inside: false },

    down: (a) => !isBlocked(a) && isDown(a),
    pressed: (a) => !isBlocked(a) && pressed.has(a),
    released: (a) => !isBlocked(a) && released.has(a),
    /** -1..1 from left/right */
    axisX: () => (input.down('right') ? 1 : 0) - (input.down('left') ? 1 : 0),
    axisY: () => (input.down('down') ? 1 : 0) - (input.down('up') ? 1 : 0),

    /** Hold/release an action programmatically (bots, tests, on-screen touch buttons). */
    setVirtual(a, on) {
      const was = isDown(a);
      if (on) virtual.add(a);
      else virtual.delete(a);
      const now = isDown(a);
      if (!was && now) pressed.add(a);
      if (was && !now) released.add(a);
    },
    /** One-frame tap of an action. */
    tap(a) {
      pressed.add(a);
      released.add(a);
    },
    /** Called by the kernel at the end of every frame. */
    endFrame() {
      pressed.clear();
      released.clear();
      input.any = false;
    },
    releaseAll() {
      for (const [a, n] of held) {
        if (n > 0) {
          held.set(a, 0);
          if (!virtual.has(a)) released.add(a);
        }
      }
      heldCodes.clear();
      pointerHeld = false;
      input.pointer.down = false;
    },
  };

  const isTyping = (e) => {
    const t = e.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };

  window.addEventListener('keydown', (e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (PREVENT.has(e.code)) e.preventDefault();
    const a = KEYMAP[e.code];
    if (!a || e.repeat || heldCodes.has(e.code)) return;
    heldCodes.add(e.code);
    press(a);
  });
  window.addEventListener('keyup', (e) => {
    const a = KEYMAP[e.code];
    if (!a || !heldCodes.has(e.code)) return;
    heldCodes.delete(e.code);
    release(a);
  });
  window.addEventListener('blur', () => input.releaseAll());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) input.releaseAll();
  });

  if (pointerTarget) {
    const toLogical = (e) => {
      const r = pointerTarget.getBoundingClientRect();
      const v = game.view;
      input.pointer.x = ((e.clientX - r.left) / r.width) * v.w;
      input.pointer.y = ((e.clientY - r.top) / r.height) * v.h;
    };
    pointerTarget.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      toLogical(e);
      input.pointer.down = true;
      if (!pointerHeld) {
        pointerHeld = true;
        press('action');
      }
      try { pointerTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      e.preventDefault();
    });
    const up = (e) => {
      toLogical(e);
      input.pointer.down = false;
      if (pointerHeld) {
        pointerHeld = false;
        release('action');
      }
    };
    pointerTarget.addEventListener('pointerup', up);
    pointerTarget.addEventListener('pointercancel', up);
    pointerTarget.addEventListener('pointermove', (e) => {
      toLogical(e);
      input.pointer.inside = true;
    });
    pointerTarget.addEventListener('pointerleave', () => (input.pointer.inside = false));
    pointerTarget.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  return input;
}
