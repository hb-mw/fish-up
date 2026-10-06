// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — global constants. KERNEL FILE (owned by the lead; do not edit —
// ask for a change instead). Everything here is part of the shared contract.
// ─────────────────────────────────────────────────────────────────────────────

/** Logical view height. All drawing is authored in "logical px" at a 1080p reference. */
export const VIEW_H = 1080;
export const MIN_VIEW_W = 1280;
export const MAX_VIEW_W = 2600;

/**
 * World coordinates (logical px):
 *   x: 0 … WORLD.width   (left = home island / reef, right = open ocean / trench)
 *   y: 0 = mean sea level. NEGATIVE y is up (sky), POSITIVE y is down (depth).
 */
export const WORLD = {
  width: 12000,
  depth: 7200,          // deepest point of the world (px below sea level)
  pxPerM: 8,            // depth scale: 8 px = 1 metre  →  world is 900 m deep
  horizonY: -64,        // the far-sea band: the horizon sits this far above mean sea level
  skyTop: -1500,        // nothing is drawn above this
  boatMinX: 760,
  boatMaxX: 11650,
  startX: 1750,
};

export const depthM = (y) => y / WORLD.pxPerM;
export const mToPx = (m) => m * WORLD.pxPerM;

/** Vertical light zones (by world y in px). */
export const ZONES = [
  { id: 'sunlit', name: 'Sunlit Zone', from: 0, to: 1500, blurb: 'Warm, bright and full of life' },
  { id: 'twilight', name: 'Twilight Zone', from: 1500, to: 3600, blurb: 'The light fades. Strange things stir' },
  { id: 'midnight', name: 'Midnight Zone', from: 3600, to: 5600, blurb: 'Eternal darkness, living lights' },
  { id: 'abyss', name: 'The Abyss', from: 5600, to: 7200, blurb: 'Here be monsters' },
];
export function zoneAt(y) {
  for (let i = ZONES.length - 1; i >= 0; i--) if (y >= ZONES[i].from) return ZONES[i];
  return ZONES[0];
}

/** Horizontal biomes (by world x in px). See src/world/terrain.js for the seabed profile. */
export const BIOMES = [
  { id: 'shore', name: 'Home Island', from: 0, to: 600 },
  { id: 'reef', name: 'Coral Reef', from: 600, to: 3000 },
  { id: 'kelp', name: 'Kelp Forest', from: 3000, to: 5000 },
  { id: 'slope', name: 'The Drop-off', from: 5000, to: 7400 },
  { id: 'open', name: 'Open Ocean', from: 7400, to: 10300 },
  { id: 'trench', name: 'The Trench', from: 10300, to: 12000 },
];
export function biomeAt(x) {
  for (let i = BIOMES.length - 1; i >= 0; i--) if (x >= BIOMES[i].from) return BIOMES[i];
  return BIOMES[0];
}

// ── Scoring bible ────────────────────────────────────────────────────────────
/** Base points per species level (index = level 1..10). Items (level 0) carry their own points. */
export const LEVEL_POINTS = [0, 10, 25, 50, 90, 150, 250, 400, 650, 1000, 2500];

export const RARITIES = [
  { id: 'common', name: 'Common', color: '#b8c4d0', levels: [1, 2] },
  { id: 'uncommon', name: 'Uncommon', color: '#5fd46b', levels: [3, 4] },
  { id: 'rare', name: 'Rare', color: '#4aa8ff', levels: [5, 6] },
  { id: 'epic', name: 'Epic', color: '#b46bff', levels: [7, 8] },
  { id: 'legendary', name: 'Legendary', color: '#ffb52e', levels: [9, 9] },
  { id: 'mythic', name: 'Mythic', color: '#ff4d6d', levels: [10, 10] },
];
export function rarityOf(level) {
  for (const r of RARITIES) if (level >= r.levels[0] && level <= r.levels[1]) return r;
  return { id: 'item', name: 'Item', color: '#d9c7a0', levels: [0, 0] };
}

/** Size classes by sizeQ (0..1 position of the individual within its species' length range). */
export const SIZE_CLASSES = [
  { id: 'tiny', name: 'Tiny', maxQ: 0.1 },
  { id: 'small', name: 'Small', maxQ: 0.3 },
  { id: 'average', name: 'Average', maxQ: 0.58 },
  { id: 'large', name: 'Large', maxQ: 0.8 },
  { id: 'huge', name: 'Huge', maxQ: 0.93 },
  { id: 'trophy', name: 'TROPHY', maxQ: 1.01 },
];
export function sizeClassOf(sizeQ) {
  for (const c of SIZE_CLASSES) if (sizeQ < c.maxQ) return c;
  return SIZE_CLASSES[SIZE_CLASSES.length - 1];
}
/** Points multiplier from size: 0.6× for the smallest, 2.0× for a maximum-size individual. */
export const sizeMultiplier = (sizeQ) => 0.6 + 1.4 * Math.pow(Math.max(0, Math.min(1, sizeQ)), 1.3);

/** Bait/lure tags. Species have `diet: {tag: affinity 0..1}`, lures have `tags: {tag: strength 0..1}`. */
export const BAIT_TAGS = ['worm', 'crustacean', 'small_fish', 'flashy', 'squid', 'glow', 'meat', 'jelly', 'plankton'];

/**
 * Player gear stats — the ONLY thing gameplay code reads about equipment.
 * The progression module recomputes `game.player.stats` from equipped gear; these are the starter values.
 */
export const DEFAULT_STATS = {
  tackle: 1.5,          // 1..10 overall rod+line strength rating. Compared against the fish's fight power.
  castPower: 1.0,       // multiplier on cast distance
  reelSpeed: 300,       // px/s of line retrieved with no load
  lineLengthM: 60,      // metres of line on the spool → how deep you can fish (× WORLD.pxPerM = px)
  rodControl: 0.0,      // 0..1 rod quality: dampens tension spikes, widens the safe zone
  dragSmooth: 0.0,      // 0..1 reel quality: smoother drag, tension rises slower when a fish runs
  hookWindowBonus: 0.0, // extra seconds on every bite window
  sinkBonus: 0.0,       // 0..1 extra lure sink speed (weights)
  boatSpeed: 300,       // px/s top speed
  sonar: 0,             // 0 none · 1 shows fish blips under the boat · 2 also shows their rarity colour
  lamp: 0,              // 0 none · 1+ night lamp radius/attraction
  luck: 0.0,            // 0..1 bonus chance for rare / big / shiny fish
};

/** One full day/night cycle, in real seconds. */
export const DAY_LENGTH_S = 600;
export const START_HOUR = 7.2;

export const SAVE_KEY = 'fishup.save.v1';
