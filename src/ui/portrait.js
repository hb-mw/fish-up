// UI module — species portraits on small canvases (catch card, Fishdex, fight HUD, toasts).
// Live portraits animate every frame while `active`; thumbnails render once, a few per frame (time-budgeted),
// so a 55-entry Fishdex never stalls a frame.
import { drawSpeciesIcon } from '../render/bestiary.js';
import { uiCanvas, fitCanvas } from './dom.js';

export function createPortraits(game) {
  const live = new Set();
  const jobs = [];
  const thumbs = new Set();

  function paint(p, t) {
    const c = p.canvas;
    const k = fitCanvas(game, c);
    const ctx = c.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, c.width, c.height);
    if (!p.speciesId) return;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (p.backdrop) {
      ctx.save();
      p.backdrop(ctx, p.w, p.h, t, p);
      ctx.restore();
    }
    const sil = !!p.silhouette;
    if (sil && p.silColor) {
      // draw the fish into a scratch layer, recolour it, then composite (keeps any backdrop intact)
      const s = scratch(c.width, c.height);
      const g = s.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, s.width, s.height);
      g.setTransform(k, 0, 0, k, 0, 0);
      drawSpeciesIcon(g, p.speciesId, p.w / 2 + p.offX, p.h / 2 + p.offY, p.w * p.fill, p.h * p.fill, {
        t, silhouette: true, pxScale: k * (p.zoom || 1), detail: 'card', flip: p.flip, amp: p.amp,
      });
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'source-in';
      g.fillStyle = p.silColor;
      g.fillRect(0, 0, s.width, s.height);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(s, 0, 0, c.width, c.height, 0, 0, c.width, c.height);
      return;
    }
    drawSpeciesIcon(ctx, p.speciesId, p.w / 2 + p.offX, p.h / 2 + p.offY, p.w * p.fill, p.h * p.fill, {
      t, silhouette: sil, shiny: !sil && p.shiny, glow: !sil && p.glow !== false, pxScale: k * (p.zoom || 1),
      detail: 'card', flip: p.flip, amp: p.amp,
    });
    if (p.after) {
      ctx.save();
      p.after(ctx, p.w, p.h, t, p);
      ctx.restore();
    }
  }

  let scratchCanvas = null;
  function scratch(w, h) {
    if (!scratchCanvas) scratchCanvas = document.createElement('canvas');
    if (scratchCanvas.width < w) scratchCanvas.width = w;
    if (scratchCanvas.height < h) scratchCanvas.height = h;
    return scratchCanvas;
  }

  function makeP(w, h, o) {
    return {
      canvas: uiCanvas(game, w, h, o.cls || 'fu-portrait'),
      w, h,
      speciesId: o.speciesId || null,
      silhouette: !!o.silhouette,
      silColor: o.silColor || null,
      shiny: !!o.shiny,
      glow: o.glow,
      fill: o.fill !== undefined ? o.fill : 0.86,
      offX: o.offX || 0,
      offY: o.offY || 0,
      flip: !!o.flip,
      amp: o.amp,
      zoom: o.zoom || 1,
      backdrop: o.backdrop || null,
      after: o.after || null,
      active: o.active !== false,
      t0: o.t0 !== undefined ? o.t0 : Math.random() * 20,
      speed: o.speed || 1,
    };
  }

  return {
    /** An animated portrait. Returns p (p.canvas to insert; p.set(id, opts) to change; p.active to pause). */
    live(w, h, o = {}) {
      const p = makeP(w, h, o);
      p.set = (id, opts = {}) => {
        p.speciesId = id;
        for (const k in opts) p[k] = opts[k];
        paint(p, (game.time.real + p.t0) * p.speed);
      };
      p.dispose = () => live.delete(p);
      live.add(p);
      if (p.speciesId) paint(p, p.t0);
      return p;
    },
    /** A static portrait rendered once (queued; a few per frame). */
    thumb(w, h, o = {}) {
      const p = makeP(w, h, o);
      p.set = (id, opts = {}) => {
        p.speciesId = id;
        for (const k in opts) p[k] = opts[k];
        if (!p.queued) {
          p.queued = true;
          jobs.push(p);
        }
      };
      p.dispose = () => thumbs.delete(p);
      thumbs.add(p);
      if (p.speciesId) {
        p.queued = true;
        jobs.push(p);
      }
      return p;
    },
    /** Paint a portrait right now (e.g. before showing a card). */
    paintNow(p, t = 0) {
      paint(p, t);
    },
    tick(t) {
      for (const p of live) {
        if (!p.active || !p.canvas.isConnected) continue;
        try {
          paint(p, (t + p.t0) * p.speed);
        } catch (e) {
          game.reportError('ui.portrait', e);
          p.active = false;
        }
      }
      if (jobs.length) {
        const t0 = performance.now();
        while (jobs.length && performance.now() - t0 < 3) {
          const p = jobs.shift();
          p.queued = false;
          try {
            paint(p, p.t0);
          } catch (e) {
            game.reportError('ui.thumb', e);
          }
        }
      }
    },
    /** Re-fit every canvas after a resize (thumbnails are re-rendered). */
    resize() {
      for (const p of live) fitCanvas(game, p.canvas);
      for (const p of thumbs) {
        if (p.speciesId && !p.queued) {
          p.queued = true;
          jobs.push(p);
        }
      }
    },
  };
}
