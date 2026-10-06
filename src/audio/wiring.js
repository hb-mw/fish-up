// Fish Up — game events → sounds. Big stingers (catch fanfare, level-up, quest, achievement, dex) are
// queued so they never pile up; small ones (coins, xp, toasts, the separate 'record' event) that land on
// top of a stinger are deferred or dropped. Payloads are read defensively (other modules may be partial).
import { SPECIES_BY_ID } from '../data/species.js';
import { rarityOf, ZONES } from '../core/config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const zoneIdx = (id) => Math.max(0, ZONES.findIndex((z) => z.id === id));
/** Splash/jump size from a fish (0.3 small … 3 huge). */
export const fishSize = (f) => clamp(0.35 + ((f && f.visualLen) || 90) / 210, 0.35, 3);
const levelOf = (f) => (f && f.species && f.species.level) || 3;
const STINGER_LEN = { common: 1.2, uncommon: 1.6, rare: 2.2, epic: 2.8, legendary: 4.2, mythic: 5.6, junk: 1.6, treasure: 2, bottle: 1.4 };

/** Fanfare options from a scored catch record (shape owned by META — read defensively). */
export function fanfareOpts(rec = {}) {
  const fish = rec.fish || null;
  const id = rec.speciesId || (rec.species && rec.species.id) || (fish && fish.speciesId);
  const sp = SPECIES_BY_ID[id] || (fish && fish.species) || null;
  const level = rec.level !== undefined ? rec.level : sp ? sp.level : 1;
  let rarity = typeof rec.rarity === 'string' ? rec.rarity : rec.rarity && rec.rarity.id;
  if (!rarity || rarity === 'item') rarity = level > 0 ? rarityOf(level).id : 'common';
  const kind = (rec.item && rec.item.kind) || rec.itemKind || (sp && sp.item && sp.item.kind) || null;
  const item = kind === 'treasure' || kind === 'bottle' || kind === 'junk' ? kind : level === 0 ? 'junk' : null;
  const sc = rec.sizeClass && (rec.sizeClass.id || rec.sizeClass);
  return {
    rarity,
    item,
    shiny: !!(rec.shiny || (fish && fish.shiny)),
    record: !!(rec.isRecord || rec.newRecord || rec.personalBest || rec.record === true || sc === 'trophy' || rec.trophy === true),
    released: !!(rec.released || (rec.released === undefined && sp && sp.protected)),
  };
}

/**
 * @param {object} game
 * @param {object} A  { play(name, o), now(), duck(bus, level, hold), music(), report(where, e), ready(), I (inputs) }
 */
export function wireEvents(game, A) {
  const ev = game.events;
  if (!ev) return { update() {} };
  const q = { buffer: null, busyUntil: 0, lastStinger: -9, lastFanfare: -9, fanfareRecord: false, lastLure: -9, lastCoins: -9, lastBiome: -9, pendingCatch: null };
  const on = (type, fn) =>
    ev.on(type, (p) => {
      if (!A.ready()) return;
      try {
        fn(p || {});
      } catch (e) {
        A.report('on.' + type, e);
      }
    });
  const P = (name, o) => A.play(name, o || {});
  /** Queue a big stinger after whatever stinger is sounding; duck the music under it. */
  function stinger(name, o, len) {
    const now = A.now();
    const start = Math.max(now, q.busyUntil - 0.2);
    if (start - now > 6) return;
    P(name, { ...o, t: start + 0.015 });
    q.busyUntil = start + len;
    q.lastStinger = now;
    A.duck('music', 0.32, start - now + len, 0.08, 1.2);
    A.duck('ambience', 0.7, start - now + len * 0.7, 0.1, 1.0);
  }
  const busy = (pad = 0) => A.now() < q.busyUntil + pad;
  const music = () => A.music() || { fightStart() {}, fightEnd() {}, fightLevel() {} };

  // ── fishing flow ──
  on('castCharge', () => P('castCharge'));
  on('cast', (p) => P('cast', { power: p.power }));
  on('lureSplash', (p) => {
    q.lastLure = A.now();
    P('lureSplash', { x: p.x, size: clamp((p.speed || 500) / 800, 0.25, 1.3) });
  });
  on('splash', (p) => {
    if (p.kind === 'lure' && A.now() - q.lastLure < 0.35) return;
    P('splash', { x: p.x, size: p.size || 1 });
  });
  on('lureBottom', (p) => P('lureBottom', { x: p.x }));
  on('twitch', (p) => P('twitch', { x: p.x }));
  on('retrieved', () => P('retrieved'));
  on('nibble', (p) => P('nibble', { x: p.x !== undefined ? p.x : p.fish && p.fish.x, size: fishSize(p.fish) * 0.6 }));
  on('bite', (p) => {
    P('bite', { x: p.fish && p.fish.x });
    A.duck('music', 0.45, 0.7, 0.03, 0.6);
  });
  on('hookSet', (p) => P('hookSet', { quality: p.quality, x: p.fish && p.fish.x }));
  on('hookMiss', () => P('hookMiss'));
  on('fightStart', (p) => music().fightStart(levelOf(p.fish), p.fish && p.fish.sizeQ, game.fishing && game.fishing.tension, p.fish && p.fish.uid));
  on('run', (p) => P('run', { size: fishSize(p.fish) / 2, x: p.fish && p.fish.x }));
  on('jump', (p) => P('jump', { x: p.x, size: fishSize(p.fish) }));
  on('tensionWarn', () => P('tensionWarn'));
  on('predatorStrike', (p) => {
    P('predatorStrike', { level: levelOf(p.predator), x: p.prey && p.prey.x });
    A.duck('music', 0.5, 0.8, 0.02, 0.6);
    if (p.took) music().fightLevel(levelOf(p.predator), p.predator && p.predator.sizeQ);
  });
  on('lineSnap', (p) => {
    P('lineSnap', { x: p.x });
    music().fightEnd('lost');
  });
  on('escape', () => {
    P('escape');
    music().fightEnd('lost');
  });
  on('fightEnd', (p) => music().fightEnd(p.result === 'landed' ? 'landed' : 'lost'));
  on('landed', (p) => P('landed', { size: fishSize(p.fish) }));
  // META emits coins/xp/dexNew/record/levelUp synchronously between 'catch' and 'catchScored':
  // hold them so the fanfare always leads, then replay them behind it.
  on('catch', (p) => {
    q.pendingCatch = { at: A.now() + 0.8, fish: p.fish || null };
    q.buffer = [];
  });
  on('catchScored', (p) => {
    q.pendingCatch = null;
    fanfare(fanfareOpts(p.record || {}));
    flush();
  });
  function flush() {
    const b = q.buffer || [];
    q.buffer = null;
    const order = ['dexNew', 'record', 'levelUp', 'coins', 'xp'];
    b.sort((x, y) => order.indexOf(x[0]) - order.indexOf(y[0]));
    for (const [type, fn] of b) fn();
  }
  /** Handler wrapper: while a catch is being scored, defer instead of playing. */
  const held = (type, fn) => (p) => (q.buffer ? q.buffer.push([type, () => fn(p)]) : fn(p));
  function fanfare(o) {
    const len = (STINGER_LEN[o.item || o.rarity] || 1.5) + (o.record ? 0.6 : 0) + (o.released ? 0.8 : 0);
    q.lastFanfare = A.now();
    q.fanfareRecord = o.record;
    stinger('fanfare', o, len);
  }

  // ── world / fx ──
  on('thunder', (p) => P('thunder', { power: p.power }));
  on('bubbles', (p) => {
    if (A.I.submerged > 0.3 || (p.y !== undefined && p.y > 0)) P('bubbles', { x: p.x, n: p.n, volume: 0.5 + 0.5 * A.I.submerged });
  });
  on('ink', (p) => P('ink', { x: p.x }));
  on('zone', (p) => {
    const a = zoneIdx(p.from), b = zoneIdx(p.to);
    P('zone', { zone: b, up: b < a });
    A.duck('music', 0.55, 1.2, 0.2, 1.2);
  });
  on('biome', (p) => {
    if (A.now() - q.lastBiome < 6) return;
    q.lastBiome = A.now();
    P('biome', { to: p.to });
  });
  on('phase', (p) => {
    P('phase', { to: p.to });
    if (p.to === 'dawn' && A.I.submerged < 0.5) P('birds', { volume: 0.8 });
  });

  // ── progression ──
  on('coins', held('coins', (p) => {
    const d = Number(p.delta) || 0;
    if (d <= 0) return;
    const now = A.now();
    const t = busy() ? q.busyUntil - 0.15 : now;
    q.lastCoins = now;
    P('coins', { amount: d, t, volume: busy() ? 0.8 : 1 });
  }));
  on('xp', held('xp', () => {
    if (busy(0.5) || A.now() - q.lastCoins < 1) return;
    P('xp');
  }));
  on('levelUp', held('levelUp', () => stinger('levelUp', {}, 1.9)));
  on('questComplete', () => stinger('questComplete', {}, 1.4));
  on('achievement', () => stinger('achievement', {}, 1.9));
  on('dexNew', held('dexNew', () => stinger('dexNew', {}, 1.0)));
  on('record', held('record', () => {
    if (A.now() - q.lastFanfare < 4 && q.fanfareRecord) return;
    stinger('record', {}, 0.8);
  }));
  on('purchase', () => P('purchase'));
  on('equip', () => P('ui_equip'));
  on('toast', (p) => {
    if (busy(0.3) || A.now() - q.lastStinger < 1.5) return;
    P('toast', { kind: p.kind });
  });

  // ── UI ──
  on('ui:click', () => P('ui_click'));
  on('ui:hover', () => P('ui_hover'));

  return {
    /** Fallback fanfare when no progression module scores the catch. */
    update() {
      const pc = q.pendingCatch;
      if (pc && A.now() > pc.at) {
        q.pendingCatch = null;
        const f = pc.fish;
        fanfare(fanfareOpts({ fish: f, speciesId: f && f.speciesId, shiny: f && f.shiny }));
        flush();
      }
    },
  };
}
