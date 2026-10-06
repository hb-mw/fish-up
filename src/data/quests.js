// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — quest templates & achievements (owned by META / src/gameplay/progression.js).
//
// QUEST_TEMPLATES: what kinds of quests the generator may roll (see progression-quests.js for the
// logic that fits each one to what the player can currently reach, and scales its reward to effort).
//   weight      relative roll chance        minLevel  player level needed before it appears
//
// ACHIEVEMENTS: permanent goals. `value(player)` → current progress, unlocked when value ≥ goal.
//   hidden achievements are reported masked (title '???', desc = hint) until unlocked.
// ─────────────────────────────────────────────────────────────────────────────
import { ANIMALS } from './species.js';

export const QUEST_TEMPLATES = [
  { type: 'species', weight: 3.0, minLevel: 1 },
  { type: 'biome', weight: 1.6, minLevel: 2 },
  { type: 'zone', weight: 1.8, minLevel: 1 },
  { type: 'level', weight: 1.4, minLevel: 2 },
  { type: 'size', weight: 1.3, minLevel: 1 },
  { type: 'night', weight: 1.0, minLevel: 3 },
  { type: 'rain', weight: 0.45, minLevel: 6 },
  { type: 'perfect', weight: 1.1, minLevel: 1 },
  { type: 'weight', weight: 1.0, minLevel: 2 },
  { type: 'streak', weight: 0.9, minLevel: 2 },
  { type: 'shiny', weight: 0.25, minLevel: 10 },
  { type: 'junk', weight: 0.7, minLevel: 1 },
  { type: 'points', weight: 0.9, minLevel: 1 },
  { type: 'newSpecies', weight: 1.4, minLevel: 1 },
  { type: 'depth', weight: 0.9, minLevel: 2 },
  { type: 'release', weight: 0.6, minLevel: 3 },
];

/** Biome wording for quests. */
export const BIOME_TEXT = {
  shore: { title: 'Harbour Duty', where: 'by the harbour' },
  reef: { title: 'Reef Patrol', where: 'on the Coral Reef' },
  kelp: { title: 'Kelp Patrol', where: 'in the Kelp Forest' },
  slope: { title: 'Edge Run', where: 'at the Drop-off' },
  open: { title: 'Bluewater Run', where: 'in the Open Ocean' },
  trench: { title: 'Trench Run', where: 'in the Trench' },
};
export const ZONE_TEXT = {
  sunlit: { title: 'Sunlit Rounds', where: 'in the Sunlit Zone' },
  twilight: { title: 'Twilight Expedition', where: 'in the Twilight Zone (below 187 m)' },
  midnight: { title: 'Midnight Expedition', where: 'in the Midnight Zone (below 450 m)' },
  abyss: { title: 'Abyssal Expedition', where: 'in the Abyss (below 700 m)' },
};

const ANIMAL_IDS = new Set(ANIMALS.map((s) => s.id));
const TOP_GEAR = ['rod_leviathan', 'reel_winch', 'line_kevlar'];
const t = (p) => p.totals || {};
const count = (p, id) => (p.dex && p.dex[id] ? p.dex[id].count : 0);
/** Number of animal species caught at least once (items don't count). */
export const speciesFound = (p) => {
  let n = 0;
  for (const id in p.dex || {}) if (ANIMAL_IDS.has(id) && p.dex[id] && p.dex[id].count > 0) n++;
  return n;
};

export const ACHIEVEMENTS = [
  { id: 'first_catch', title: 'First Bite', desc: 'Land your very first catch.', goal: 1, value: (p) => t(p).caught },
  { id: 'reef_regular', title: 'Reef Regular', desc: 'Catch 25 fish on the Coral Reef.', goal: 25, value: (p) => t(p).biomes?.reef },
  { id: 'kelp', title: 'Kelp Wanderer', desc: 'Catch a fish in the Kelp Forest.', goal: 1, value: (p) => t(p).biomes?.kelp },
  { id: 'slope', title: 'Over the Edge', desc: 'Catch a fish at the Drop-off.', goal: 1, value: (p) => t(p).biomes?.slope },
  { id: 'open', title: 'Blue Water', desc: 'Catch a fish in the Open Ocean.', goal: 1, value: (p) => t(p).biomes?.open },
  { id: 'trench', title: 'Edge of the World', desc: 'Catch a fish in the Trench.', goal: 1, value: (p) => t(p).biomes?.trench },
  { id: 'twilight', title: 'Into the Twilight', desc: 'Catch something below 187 m.', goal: 1, value: (p) => t(p).zones?.twilight },
  { id: 'midnight', title: 'Midnight Zone', desc: 'Catch something below 450 m.', goal: 1, value: (p) => t(p).zones?.midnight },
  { id: 'abyss', title: 'Abyssal', desc: 'Catch something below 700 m.', goal: 1, value: (p) => t(p).zones?.abyss },
  { id: 'dex_10', title: 'Collector', desc: 'Discover 10 species.', goal: 10, value: speciesFound },
  { id: 'dex_25', title: 'Naturalist', desc: 'Discover 25 species.', goal: 25, value: speciesFound },
  { id: 'dex_all', title: 'Marine Biologist', desc: `Complete the Fishdex: all ${ANIMAL_IDS.size} species.`, goal: ANIMAL_IDS.size, value: speciesFound },
  { id: 'trophy', title: 'Trophy Hunter', desc: 'Land a TROPHY-size fish.', goal: 1, value: (p) => t(p).trophies },
  { id: 'legendary', title: 'Stuff of Legend', desc: 'Catch a Legendary animal.', goal: 1, value: (p) => t(p).legendary },
  { id: 'heavyweight', title: 'Heavyweight', desc: 'Land a single catch over 1,000 kg.', goal: 1000, value: (p) => Math.floor(t(p).heaviestKg || 0) },
  { id: 'night_owl', title: 'Night Owl', desc: 'Catch 25 fish at night.', goal: 25, value: (p) => t(p).night },
  { id: 'storm_chaser', title: 'Storm Chaser', desc: 'Catch 5 fish during a storm.', goal: 5, value: (p) => t(p).storm },
  { id: 'cleanup', title: 'Clean-up Crew', desc: 'Haul 10 pieces of junk out of the sea.', goal: 10, value: (p) => t(p).junk },
  { id: 'shiny', title: 'Golden Glimmer', desc: 'Catch a shiny golden variant.', goal: 1, value: (p) => t(p).shiny },
  { id: 'perfect', title: 'Hair Trigger', desc: 'Land 25 fish with a perfect hook-set.', goal: 25, value: (p) => t(p).perfect },
  { id: 'streak', title: 'On a Roll', desc: 'Land 10 fish in a row without losing one.', goal: 10, value: (p) => t(p).longestStreak },
  { id: 'treasure', title: 'X Marks the Spot', desc: 'Haul up a sunken treasure chest.', goal: 1, value: (p) => t(p).chests },
  { id: 'bottle', title: 'Message Received', desc: 'Find a message in a bottle.', goal: 1, value: (p) => t(p).bottles },
  { id: 'pearl', title: 'Pearl Diver', desc: 'Bring up a giant pearl oyster.', goal: 1, value: (p) => t(p).pearls },
  { id: 'guardian', title: 'Guardian of the Sea', desc: 'Catch and release 5 protected animals.', goal: 5, value: (p) => t(p).released },
  { id: 'wreck', title: 'Wreck Diver', desc: 'Catch something deep beside the sunken wreck.', goal: 1, value: (p) => t(p).wreck },
  { id: 'tycoon', title: 'Tycoon', desc: 'Earn 25,000 coins.', goal: 25000, value: (p) => t(p).coinsEarned },
  { id: 'rigged', title: 'Fully Rigged', desc: 'Own the best rod, reel and line money can buy.', goal: 3, value: (p) => TOP_GEAR.filter((id) => (p.owned || []).includes(id)).length },
  { id: 'sea_legs', title: 'Sea Legs', desc: 'Spend 7 days at sea.', goal: 7, value: (p) => p.day },
  { id: 'master', title: 'Master Angler', desc: 'Reach level 15.', goal: 15, value: (p) => p.level },
  { id: 'legend', title: 'Legend of the Deep', desc: 'Reach level 30.', goal: 30, value: (p) => p.level },
  // ── hidden ──
  { id: 'got_away', title: 'The One That Got Away', desc: 'Lose 10 fish.', goal: 10, hidden: true, hint: 'Not every fight is won.', value: (p) => t(p).lost },
  { id: 'old_man', title: 'The Old Man and the Sea', desc: 'Land a blue marlin.', goal: 1, hidden: true, hint: 'A classic tale of the open sea.', value: (p) => count(p, 'blue_marlin') },
  { id: 'kraken', title: 'Release the Kraken', desc: 'Catch a giant squid.', goal: 1, hidden: true, hint: 'Eyes like dinner plates.', value: (p) => count(p, 'giant_squid') },
  { id: 'fossil', title: 'Living Fossil', desc: 'Catch a coelacanth.', goal: 1, hidden: true, hint: 'It was supposed to be extinct.', value: (p) => count(p, 'coelacanth') },
  { id: 'vents', title: 'Hot Spot', desc: 'Catch something beside the hydrothermal vents.', goal: 1, hidden: true, hint: 'Where the sea floor smokes.', value: (p) => t(p).vents },
  { id: 'megalodon', title: 'It’s Real', desc: 'Catch the Megalodon.', goal: 1, hidden: true, hint: 'Some legends are true.', value: (p) => count(p, 'megalodon') },
];
