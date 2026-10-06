// UI module — tiny DOM, formatting and animation helpers (no framework).
import { SPECIES_BY_ID } from '../data/species.js';

/**
 * Create an element. `tag` may carry classes: h('div.fu-glass.big').
 * props: { class, style (object|string), text, html, attrs, data, on: {event: fn}, ...plain props }
 */
export function h(tag, props, ...kids) {
  const parts = tag.split('.');
  const el = document.createElement(parts[0] || 'div');
  if (parts.length > 1) el.className = parts.slice(1).join(' ');
  if (props) applyProps(el, props);
  appendKids(el, kids);
  return el;
}

function applyProps(el, props) {
  for (const k in props) {
    const v = props[k];
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = (el.className ? el.className + ' ' : '') + v;
    else if (k === 'style') {
      if (typeof v === 'string') el.style.cssText += v;
      else for (const s in v) s.startsWith('--') ? el.style.setProperty(s, v[s]) : (el.style[s] = v[s]);
    } else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'attrs') for (const a in v) el.setAttribute(a, v[a]);
    else if (k === 'data') for (const d in v) el.dataset[d] = v[d];
    else if (k === 'on') for (const ev in v) el.addEventListener(ev, v[ev]);
    else el[k] = v;
  }
}

function appendKids(el, kids) {
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) appendKids(el, c);
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

/** Element from an HTML string (first element). */
export function fromHTML(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

/** Set textContent only when it changed (avoids layout work every frame). */
export function setText(el, text) {
  text = String(text);
  if (el.__t !== text) {
    el.__t = text;
    el.textContent = text;
  }
}
/** Set innerHTML only when it changed. */
export function setHTML(el, html) {
  if (el.__h !== html) {
    el.__h = html;
    el.innerHTML = html;
  }
}
/** Set a style property / custom property only when it changed. */
export function setStyle(el, prop, value) {
  const c = el.__s || (el.__s = {});
  if (c[prop] === value) return;
  c[prop] = value;
  if (prop.startsWith('--')) el.style.setProperty(prop, value);
  else el.style[prop] = value;
}
/** classList.toggle, cached. */
export function toggleClass(el, cls, on) {
  on = !!on;
  const c = el.__c || (el.__c = {});
  if (c[cls] === on) return;
  c[cls] = on;
  el.classList.toggle(cls, on);
}
/** Restart a CSS animation class (e.g. a pulse) even if it is already applied. */
export function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  if (el.__c) el.__c[cls] = true;
}
export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// ── formatting ────────────────────────────────────────────────────────────────
const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const fmtInt = (n) => nf.format(Math.round(n || 0));
/** 1234 → "1.2k" for tight spots */
export function fmtShort(n) {
  n = Math.round(n || 0);
  if (Math.abs(n) < 10000) return fmtInt(n);
  if (Math.abs(n) < 1e6) return (n / 1000).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + 'k';
  return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
}
export function fmtClock(hour) {
  const hh = Math.floor(hour) % 24;
  const mm = Math.floor((hour - Math.floor(hour)) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  if (sec < 3600) return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  const hrs = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return `${hrs}h ${String(m).padStart(2, '0')}m`;
}
export const fmtSigned = (n) => (n >= 0 ? '+' : '−') + fmtInt(Math.abs(n));
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const speciesName = (id) => (SPECIES_BY_ID[id] ? SPECIES_BY_ID[id].name : id);

/**
 * Sticker-style display lettering: every glyph is three stacked spans (o = dark outline + extrusion,
 * r = light rim, f = gradient fill), so each letter can bounce on its own. Styled by .fu-lt-ch in ui.css.
 */
export function letteringHTML(text, cls = 'fu-lt-ch', start = 0) {
  let i = start;
  return [...text]
    .map((ch) => {
      if (ch === ' ') return '<span class="fu-lt-sp"></span>';
      const c = esc(ch);
      return `<span class="${cls}" style="--i:${i++}"><span class="o">${c}</span><span class="r">${c}</span><span class="f">${c}</span></span>`;
    })
    .join('');
}

// ── easing ────────────────────────────────────────────────────────────────────
export const E = {
  linear: (t) => t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outBack: (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
};

export const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/**
 * Frame-driven tween scheduler. Ticked from ui.update(realDt), so it keeps running while the game is paused
 * and stays in lock-step with everything else the UI animates.
 */
export function createAnimator() {
  const list = [];
  const api = {
    /** Run fn(k) for k 0→1 over `dur` seconds after `delay`. Returns a handle (cancel with api.cancel). */
    tween(dur, fn, { delay = 0, ease = E.linear, done } = {}) {
      const a = { t: -delay, dur: Math.max(0.0001, dur), fn, ease, done, dead: false };
      list.push(a);
      return a;
    },
    /** Call fn once after `delay` seconds. */
    after(delay, fn) {
      return api.tween(0.0001, () => {}, { delay, done: fn });
    },
    cancel(a) {
      if (a) a.dead = true;
    },
    /** Count a number up inside an element. fmt(n) → string. */
    count(el, from, to, dur, fmt = fmtInt, opts = {}) {
      if (el.__count) el.__count.dead = true;
      if (reducedMotion() || dur <= 0) {
        setText(el, fmt(to));
        if (opts.done) opts.done();
        return null;
      }
      const h = api.tween(dur, (k) => setText(el, fmt(from + (to - from) * k)), { ease: opts.ease || E.outCubic, delay: opts.delay || 0, done: opts.done });
      el.__count = h;
      return h;
    },
    tick(dt) {
      for (let i = 0; i < list.length; i++) {
        const a = list[i];
        if (a.dead) continue;
        a.t += dt;
        if (a.t < 0) continue;
        const k = Math.min(1, a.t / a.dur);
        try {
          a.fn(a.ease(k));
        } catch (e) {
          console.error('[ui] tween threw', e);
          a.dead = true;
        }
        if (k >= 1) {
          a.dead = true;
          if (a.done) {
            try {
              a.done();
            } catch (e) {
              console.error('[ui] tween done threw', e);
            }
          }
        }
      }
      // compact
      let j = 0;
      for (let i = 0; i < list.length; i++) if (!list[i].dead) list[j++] = list[i];
      list.length = j;
    },
    clear() {
      list.length = 0;
    },
  };
  return api;
}

/** Device px per logical px for crisp UI canvases (independent of the 3D-ish quality setting). */
export function uiPixelScale(game) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssH = game.view.cssH || window.innerHeight;
  return Math.max(0.5, Math.min(3, (cssH / 1080) * dpr));
}

/** A <canvas> sized in logical px (CSS via --u) with a crisp backing store. */
export function uiCanvas(game, w, h, cls = '') {
  const c = document.createElement('canvas');
  if (cls) c.className = cls;
  c.style.width = `calc(var(--u) * ${w})`;
  c.style.height = `calc(var(--u) * ${h})`;
  c.__lw = w;
  c.__lh = h;
  fitCanvas(game, c);
  return c;
}
/** Re-fit a uiCanvas' backing store to the current pixel scale. Returns the scale. */
export function fitCanvas(game, c) {
  const k = uiPixelScale(game);
  const bw = Math.max(1, Math.round(c.__lw * k)), bh = Math.max(1, Math.round(c.__lh * k));
  if (c.width !== bw || c.height !== bh) {
    c.width = bw;
    c.height = bh;
  }
  c.__k = k;
  return k;
}
