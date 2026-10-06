// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — gear catalogue (owned by META / src/gameplay/progression.js).
//
// Every piece of equipment the shop sells, plus the pure function that turns
// "what is equipped" into game.player.stats (the ONLY thing gameplay reads).
//
//   slot      'rod' | 'reel' | 'line' | 'boat' | 'gadget'   (lures live in LURE_SHOP below)
//   tier      1..n within its slot (tier 1 of rod/reel/line/boat is the free starter kit)
//   stats     the stats this item contributes (see computeStats for how they combine)
//   price     coins          unlockLevel  player level needed to buy it
//
// Stat model (computeStats):
//   tackle      = rod.tackle + line.tackle            1.0 + 0.5 = 1.5 at the start → 6.0 + 4.0 = 10 maxed
//   castPower, rodControl                             from the rod
//   reelSpeed, dragSmooth                             from the reel
//   lineLengthM                                       from the line (60 → 950 m)
//   boatSpeed  (+ boatTier 0..2)                      from the boat
//   sonar, lamp, sinkBonus, hookWindowBonus, luck     max over every OWNED gadget (all gadgets are always on)
// ─────────────────────────────────────────────────────────────────────────────
import { DEFAULT_STATS } from '../core/config.js';
import { LURES, LURES_BY_ID } from './lures.js';

const item = (slot, tier, id, name, price, unlockLevel, accent, stats, desc) => ({
  id, slot, tier, name, price, unlockLevel, accent, stats, desc,
});

export const RODS = [
  item('rod', 1, 'rod_bamboo', 'Bamboo Pole', 0, 1, '#c9a46a',
    { tackle: 1.0, castPower: 1.0, rodControl: 0.0 },
    "Grandpa's old pole. Bends like a reed, holds like a promise."),
  item('rod', 2, 'rod_fiberglass', 'Fiberglass Spinner', 100, 1, '#5fd46b',
    { tackle: 1.8, castPower: 1.1, rodControl: 0.12 },
    'Light, springy and forgiving: the reef’s favourite workhorse.'),
  item('rod', 3, 'rod_graphite', 'Graphite Pro', 380, 3, '#4aa8ff',
    { tackle: 2.6, castPower: 1.2, rodControl: 0.25 },
    'Stiff spine, fast tip. Feels every nibble, sets every hook.'),
  item('rod', 4, 'rod_carbon', 'Carbon Striker', 900, 7, '#b46bff',
    { tackle: 3.6, castPower: 1.3, rodControl: 0.4 },
    'Built for bluewater brawlers that run, jump and never quit.'),
  item('rod', 5, 'rod_titan', 'Titanium Big-Game', 2800, 13, '#ffb52e',
    { tackle: 4.8, castPower: 1.4, rodControl: 0.55 },
    'A roller-guide stand-up rod that laughs at marlin.'),
  item('rod', 6, 'rod_leviathan', 'Leviathan', 7000, 19, '#ff4d6d',
    { tackle: 6.0, castPower: 1.5, rodControl: 0.7 },
    'Forged for monsters out of myth. It has never bent past forty degrees.'),
];

export const REELS = [
  item('reel', 1, 'reel_rusty', 'Rusty Spincaster', 0, 1, '#a8927a',
    { reelSpeed: 300, dragSmooth: 0.0 },
    'Squeaks a little. Works a lot.'),
  item('reel', 2, 'reel_bay', 'Bay Spinner', 80, 1, '#5fd46b',
    { reelSpeed: 380, dragSmooth: 0.12 },
    'A smooth little spinning reel with a drag that actually drags.'),
  item('reel', 3, 'reel_surf', 'Surf Caster', 300, 3, '#4aa8ff',
    { reelSpeed: 470, dragSmooth: 0.25 },
    'Big spool, sealed bearings, salt-proof to the core.'),
  item('reel', 4, 'reel_offshore', 'Offshore Baitcaster', 1000, 8, '#b46bff',
    { reelSpeed: 580, dragSmooth: 0.4 },
    'Star drag and a winching gear ratio for fish that pull back.'),
  item('reel', 5, 'reel_lever', 'Lever-Drag Big-Game', 2600, 13, '#ffb52e',
    { reelSpeed: 700, dragSmooth: 0.55 },
    'Two-speed, carbon-washer drag. Pure butter under pressure.'),
  item('reel', 6, 'reel_winch', 'Abyssal Power Winch', 6000, 18, '#ff4d6d',
    { reelSpeed: 850, dragSmooth: 0.7 },
    'Electric assist for kilometre drops. Hums like a submarine.'),
];

export const LINES = [
  item('line', 1, 'line_cotton', 'Cotton Twine', 0, 1, '#d8cbb0',
    { lineLengthM: 60, tackle: 0.5 },
    'Good enough for the shallows. Don’t ask it for more.'),
  item('line', 2, 'line_mono', 'Nylon Mono · 120 m', 50, 1, '#5fd46b',
    { lineLengthM: 120, tackle: 0.8 },
    'Clear, stretchy and cheap. Doubles your reach: hello, kelp forest.'),
  item('line', 3, 'line_braid', 'Braided Line · 220 m', 450, 4, '#4aa8ff',
    { lineLengthM: 220, tackle: 1.3 },
    'Thin, tough, zero stretch. The twilight zone starts at 187 m…'),
  item('line', 4, 'line_fluoro', 'Fluorocarbon · 350 m', 900, 7, '#7f8cff',
    { lineLengthM: 350, tackle: 1.8 },
    'Invisible underwater and twice as tough. Deep enough for the wreck.'),
  item('line', 5, 'line_spectra', 'Spectra Deep-Line · 500 m', 2000, 11, '#b46bff',
    { lineLengthM: 500, tackle: 2.4 },
    'Half a kilometre of hope. Welcome to the midnight zone.'),
  item('line', 6, 'line_dyneema', 'Dyneema Abyss-Line · 700 m', 3600, 15, '#ffb52e',
    { lineLengthM: 700, tackle: 3.1 },
    'Stronger than steel, lighter than water. Down to the edge of the abyss.'),
  item('line', 7, 'line_kevlar', 'Kevlar Trench-Line · 950 m', 6000, 19, '#ff4d6d',
    { lineLengthM: 950, tackle: 4.0 },
    'Rated for the bottom of the world, and for whatever lives down there.'),
];

export const BOATS = [
  item('boat', 1, 'boat_skiff', 'Old Skiff', 0, 1, '#b08a5a',
    { boatSpeed: 300, boatTier: 0 },
    'Leaks a bit. Gets you there. Eventually.'),
  item('boat', 2, 'boat_cruiser', 'Bay Cruiser', 1300, 6, '#4aa8ff',
    { boatSpeed: 430, boatTier: 1 },
    'Inboard diesel, a proper cabin and a cup holder. Luxury.'),
  item('boat', 3, 'boat_sportfisher', 'Sport-Fisher', 8000, 14, '#ffb52e',
    { boatSpeed: 580, boatTier: 2 },
    'Twin engines, flying bridge, fighting chair. The real deal.'),
];

export const GADGETS = [
  item('gadget', 1, 'gad_sinkers', 'Lead Sinkers', 120, 2, '#9aa7b5',
    { sinkBonus: 0.35 },
    'A pocketful of split-shot. Your lure gets down to business faster.'),
  item('gadget', 2, 'gad_sonar1', 'Fish-Finder Sonar', 250, 3, '#3fd0c9',
    { sonar: 1 },
    'Pings the water under your hull and paints fish as blips.'),
  item('gadget', 3, 'gad_hooks', 'Needle-Sharp Hooks', 600, 5, '#d6e4f0',
    { hookWindowBonus: 0.15 },
    'Chemically sharpened. A heartbeat longer to set every hook.'),
  item('gadget', 4, 'gad_lamp', 'Night Lamp', 750, 6, '#ffd36a',
    { lamp: 1 },
    'A warm lantern on the bow. Night creatures come to see who’s visiting.'),
  item('gadget', 5, 'gad_charm', 'Lucky Doubloon', 1800, 9, '#ffcf4a',
    { luck: 0.12 },
    'A brass coin on a string. Big fish and golden ones seem to like it.'),
  item('gadget', 6, 'gad_tungsten', 'Tungsten Drop-Weights', 2200, 11, '#8f9bb0',
    { sinkBonus: 0.7 },
    'Dense as a dwarf star. Straight to the bottom of anything.'),
  item('gadget', 7, 'gad_sonar2', 'Deep-Scan Sonar', 3500, 13, '#4aa8ff',
    { sonar: 2 },
    'Colour-coded returns: see how rare it is before it bites.'),
  item('gadget', 8, 'gad_circle', 'Tournament Circle Hooks', 6000, 16, '#e8f2ff',
    { hookWindowBonus: 0.3 },
    'They set themselves in the corner of the jaw. Almost cheating.'),
  item('gadget', 9, 'gad_floodlight', 'Abyssal Floodlight', 9000, 18, '#9ffcff',
    { lamp: 2 },
    'Five thousand lumens of “come here”. The deep can’t look away.'),
  item('gadget', 10, 'gad_kraken', 'Kraken’s Eye', 28000, 24, '#ff4d6d',
    { luck: 0.25 },
    'A pearl that glows in the dark, pried from the trench. The sea’s luck is yours.'),
];

/**
 * Shop table for lures (ids and the attraction model come from src/data/lures.js — only price and
 * unlock level are re-balanced here). Order = LURES order.
 */
export const LURE_SHOP = {
  worm: { price: 0, unlockLevel: 1 },
  shrimp: { price: 50, unlockLevel: 1 },
  spinner: { price: 150, unlockLevel: 2 },
  jelly: { price: 350, unlockLevel: 4 },
  minnow: { price: 550, unlockLevel: 5 },
  krill: { price: 900, unlockLevel: 8 },
  squid_jig: { price: 1100, unlockLevel: 9 },
  glow_jig: { price: 2000, unlockLevel: 12 },
  chum: { price: 3800, unlockLevel: 16 },
};

/** Lure catalogue entries in the same shape as gear (slot 'lure'). id = 'lure_<lureId>'. */
export const LURE_ITEMS = LURES.map((l, i) => ({
  id: 'lure_' + l.id,
  slot: 'lure',
  tier: i + 1,
  name: l.name,
  price: (LURE_SHOP[l.id] || l).price,
  unlockLevel: (LURE_SHOP[l.id] || l).unlockLevel,
  accent: l.color,
  stats: {},
  desc: l.desc,
  lureId: l.id,
}));

/** Gear slots that hold exactly one equipped item. */
export const EQUIP_SLOTS = ['rod', 'reel', 'line', 'boat'];
/** Shop order. */
export const SLOT_ORDER = ['rod', 'reel', 'line', 'lure', 'boat', 'gadget'];

export const GEAR = [...RODS, ...REELS, ...LINES, ...BOATS, ...GADGETS];
/** Every shop item (gear + lures) by catalogue id. */
export const ITEMS_BY_ID = Object.fromEntries([...GEAR, ...LURE_ITEMS].map((g) => [g.id, g]));
export const ALL_ITEMS = SLOT_ORDER.flatMap((slot) => [...GEAR, ...LURE_ITEMS].filter((g) => g.slot === slot));

/** The free starter kit: equipped ids per slot. */
export const STARTER_GEAR = { rod: 'rod_bamboo', reel: 'reel_rusty', line: 'line_cotton', boat: 'boat_skiff' };

/** Resolve a catalogue id — accepts 'lure_shrimp' and the bare lure id 'shrimp'. */
export function itemById(id) {
  if (typeof id !== 'string') return null;
  return ITEMS_BY_ID[id] || (LURES_BY_ID[id] ? ITEMS_BY_ID['lure_' + id] : null) || null;
}

const r2 = (v) => Math.round(v * 100) / 100;

const SLOT_LISTS = { rod: RODS, reel: REELS, line: LINES, boat: BOATS };
/** The equipped item of a slot (falls back to the starter item for unknown ids). */
export function equippedItem(equipped, slot) {
  const it = ITEMS_BY_ID[equipped && equipped[slot]];
  return it && it.slot === slot ? it : SLOT_LISTS[slot][0];
}
/** Visual boat tier 0..2 of the equipped boat (mirrored to player.boatTier and game.boat.tier). */
export function boatTierOf(equipped) {
  return equippedItem(equipped, 'boat').stats.boatTier;
}

/**
 * Pure: the player's gear stats from what is equipped.
 * @param {{rod?:string, reel?:string, line?:string, boat?:string}} equipped  catalogue ids per slot
 * @param {string[]} gadgets  owned gadget ids (all active)
 * @returns {object} exactly the keys of DEFAULT_STATS
 */
export function computeStats(equipped = {}, gadgets = []) {
  const rod = equippedItem(equipped, 'rod'), reel = equippedItem(equipped, 'reel');
  const line = equippedItem(equipped, 'line'), boat = equippedItem(equipped, 'boat');
  const s = { ...DEFAULT_STATS };
  s.tackle = r2(rod.stats.tackle + line.stats.tackle);
  s.castPower = rod.stats.castPower;
  s.rodControl = rod.stats.rodControl;
  s.reelSpeed = reel.stats.reelSpeed;
  s.dragSmooth = reel.stats.dragSmooth;
  s.lineLengthM = line.stats.lineLengthM;
  s.boatSpeed = boat.stats.boatSpeed;
  for (const id of gadgets) {
    const g = ITEMS_BY_ID[id];
    if (!g || g.slot !== 'gadget') continue;
    for (const k in g.stats) if (k in s && g.stats[k] > s[k]) s[k] = g.stats[k];
  }
  return s;
}
