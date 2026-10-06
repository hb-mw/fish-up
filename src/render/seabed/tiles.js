// Ground tile cache: 512-world-px tiles baked lazily by bakeGround() at a resolution bucket close to the current
// device px per world px; byte-capped LRU; budgeted prefetch around the view; another bucket's tile stands in
// (scaled) while the right one is queued, so zooming never hitches.
import { heightAt } from '../../world/terrain.js';
import { bakeGround, fillInterior } from './ground.js';
import { REACH } from './materials.js';
import { makeCanvas } from './util.js';

const T = 512; // tile size (world px)
const M = 2; // overlap margin baked around each tile (world px) — hides seams
const BUCKETS = [0.375, 0.5, 0.75, 1, 1.5, 2];
const MAX_BYTES = 112 * 1024 * 1024;

export function createTiles(game) {
  const cache = new Map(); // key → tile
  const colInfo = new Map(); // i → {minIn, maxReach}
  const queue = [];
  let bytes = 0, frame = 0, res = 1;
  let bakeMs = 0, bakes = 0, maxBake = 0;

  function column(i) {
    let c = colInfo.get(i);
    if (c) return c;
    let minIn = Infinity, maxReach = -Infinity;
    for (let x = i * T - REACH - 8; x <= (i + 1) * T + REACH + 8; x += 4) {
      const y = heightAt(x);
      if (y > maxReach) maxReach = y;
      if (x >= i * T - M - 8 && x <= (i + 1) * T + M + 8 && y < minIn) minIn = y;
    }
    c = { minIn, maxReach };
    colInfo.set(i, c);
    return c;
  }
  /** 'empty' | 'solid' | 'band' */
  function kindOf(i, j) {
    const c = column(i);
    const y0 = j * T - M, y1 = (j + 1) * T + M;
    if (c.minIn > y1 + 4) return 'empty';
    if (y0 > c.maxReach + REACH + 4) return 'solid';
    return 'band';
  }

  function pickRes() {
    const k = game.view.scale * game.camera.zoom;
    let want = BUCKETS[BUCKETS.length - 1];
    for (const b of BUCKETS) {
      if (b >= k * 0.92) {
        want = b;
        break;
      }
    }
    // hysteresis: keep the current bucket while it is "good enough", and while the zoom is still moving
    const settling = Math.abs(game.camera.zoom - game.camera.tzoom) > 0.02;
    const ok = res >= k * 0.85 && res <= k * (settling ? 2.4 : 1.7);
    return ok ? res : want;
  }

  const key = (i, j, r) => i + ',' + j + '@' + r;
  function bake(i, j, r) {
    const t0 = performance.now();
    const x0 = i * T - M, y0 = j * T - M, x1 = (i + 1) * T + M, y1 = (j + 1) * T + M;
    const canvas = makeCanvas((x1 - x0) * r, (y1 - y0) * r);
    bakeGround(canvas.getContext('2d'), x0, y0, x1, y1, r);
    const tile = { canvas, x0, y0, x1, y1, r, used: frame, bytes: canvas.width * canvas.height * 4 };
    cache.set(key(i, j, r), tile);
    bytes += tile.bytes;
    const ms = performance.now() - t0;
    bakeMs += ms;
    bakes++;
    maxBake = Math.max(maxBake, ms);
    if (bytes > MAX_BYTES) evict();
    return tile;
  }
  function evict() {
    const list = [...cache.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, tl] of list) {
      if (bytes < MAX_BYTES * 0.75) break;
      if (tl.used >= frame - 1) continue; // never drop what is on screen
      cache.delete(k);
      bytes -= tl.bytes;
    }
  }
  /** Best available tile for (i,j) — exact bucket, else any other bucket (queued), else baked now. */
  function get(i, j) {
    let tl = cache.get(key(i, j, res));
    if (tl) return tl;
    for (const r of BUCKETS) {
      tl = cache.get(key(i, j, r));
      if (tl) {
        const qk = key(i, j, res);
        if (!queue.includes(qk)) queue.push(qk);
        return tl;
      }
    }
    return bake(i, j, res);
  }

  function visRange(pad) {
    const b = game.camera.bounds;
    return [Math.floor((b.left - pad) / T), Math.floor((b.right + pad) / T), Math.floor((b.top - pad) / T), Math.floor((b.bottom + pad) / T)];
  }

  return {
    get res() {
      return res;
    },
    /** Prefetch / upgrade tiles within a time budget (call from update). */
    update(budgetMs = 3) {
      res = pickRes();
      const t0 = performance.now();
      const [i0, i1, j0, j1] = visRange(T * 0.75);
      for (let j = j0; j <= j1 && performance.now() - t0 < budgetMs; j++) {
        for (let i = i0; i <= i1 && performance.now() - t0 < budgetMs; i++) {
          if (kindOf(i, j) === 'band' && !cache.has(key(i, j, res))) bake(i, j, res);
        }
      }
      while (queue.length && performance.now() - t0 < budgetMs) {
        const [ij, r] = queue.shift().split('@');
        const [i, j] = ij.split(',').map(Number);
        if (Number(r) === res && !cache.has(key(i, j, res))) bake(i, j, res);
      }
    },
    /** Draw only the band tiles overlapping a world rect (used by the island's tint layer). */
    drawRange(ctx, x0, x1, y0, y1) {
      for (let i = Math.floor(x0 / T); i <= Math.floor(x1 / T); i++) {
        for (let j = Math.floor(y0 / T); j <= Math.floor(y1 / T); j++) {
          if (kindOf(i, j) !== 'band') continue;
          const tl = get(i, j);
          tl.used = frame;
          ctx.drawImage(tl.canvas, 0, 0, tl.canvas.width, tl.canvas.height, tl.x0, tl.y0, tl.x1 - tl.x0, tl.y1 - tl.y0);
        }
      }
    },
    /** Draw the visible ground (WORLD space ctx). */
    draw(ctx) {
      frame++;
      if (frame === 1) res = pickRes();
      const [i0, i1, j0, j1] = visRange(0);
      for (let i = i0; i <= i1; i++) {
        let solidFrom = null;
        for (let j = j0; j <= j1; j++) {
          const kind = kindOf(i, j);
          if (kind === 'empty') continue;
          if (kind === 'solid') {
            if (solidFrom === null) solidFrom = j;
            continue;
          }
          const tl = get(i, j);
          tl.used = frame;
          ctx.drawImage(tl.canvas, 0, 0, tl.canvas.width, tl.canvas.height, tl.x0, tl.y0, tl.x1 - tl.x0, tl.y1 - tl.y0);
        }
        if (solidFrom !== null) {
          const b = game.camera.bounds;
          const y0 = solidFrom * T - 0.5;
          fillInterior(ctx, i * T - 0.5, y0, (i + 1) * T + 0.5, Math.max(y0 + 1, b.bottom + 4));
        }
      }
    },
    stats() {
      return { tiles: cache.size, tileMB: +(bytes / 1048576).toFixed(1), res, bakes, avgBakeMs: +(bakeMs / Math.max(1, bakes)).toFixed(2), maxBakeMs: +maxBake.toFixed(2) };
    },
  };
}
