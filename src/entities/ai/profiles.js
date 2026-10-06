// LIFE — per-species behaviour profiles: how each animal moves, groups, rests and hunts.
// Derived from the species bible (src/data/species.js) plus hand-tuned overrides below.
import { SPECIES } from '../../data/species.js';
import { boundsOf } from '../../render/bestiary.js';
import { lengthFor, visualLength } from '../../data/species.js';

// arch     'swim' (fish, sharks, rays, eels, squid, turtle, seahorse) · 'jelly' (pulse-driven drifters)
//          · 'crawl' (benthic walkers) · 'item' (static props)
// group    'solo' · 'school' (polarised formation behind a virtual leader) · 'loose' (social group, weak cohesion)
//          · 'cluster' (shares a tiny home: clownfish + anemone) · 'bloom' (jellies drifting together) · 'conga' (single file)
// homeR    home range in px (0 = transient: crosses the region and leaves)
// hover    [min,max] px between belly and seabed (demersal / benthic swimmers)
// surf     [min,max] px below the surface (surface layer)
// restP    chance to pause at each decision · restDur [s] · turnEvery [s] random heading changes
// hunter   0..1 tendency to rush schools of smaller fish · special  see motion.js
const O = {
  clownfish: { group: 'cluster', homeR: 70, hover: [6, 44], restP: 0.5, restDur: [1, 3], agility: 4.5, turnRate: 9, turnEvery: [2, 5], dart: 1 },
  blue_tang: { group: 'school', spacing: 1.25, homeR: 560, restP: 0.06, agility: 3.2, turnRate: 8 },
  sardine: { group: 'school', spacing: 0.72, mill: true, homeR: 1000, restP: 0, agility: 3.8, turnRate: 9, tight: 1.5 },
  moorish_idol: { group: 'loose', homeR: 420, restP: 0.2, agility: 2.6, turnRate: 7 },
  yellowtail_snapper: { group: 'school', spacing: 1.35, homeR: 680, restP: 0.05, agility: 2.6 },
  garibaldi: { group: 'loose', homeR: 150, hover: [8, 52], restP: 0.4, agility: 3, turnEvery: [3, 8] },
  mackerel: { group: 'school', spacing: 0.95, homeR: 0, restP: 0, agility: 3.2, turnRate: 8 },
  parrotfish: { group: 'loose', homeR: 520, hover: [6, 46], restP: 0.4, restDur: [2, 5], agility: 2.4, special: 'grazer' },
  pufferfish: { homeR: 240, hover: [14, 70], restP: 0.45, restDur: [2, 6], agility: 1.6, cruiseMul: 0.9, turnRate: 5 },
  flying_fish: { group: 'school', spacing: 1.6, homeR: 0, surf: [10, 64], agility: 3.6, special: 'flyer', turnRate: 8 },
  lionfish: { homeR: 140, hover: [10, 60], restP: 0.72, restDur: [3, 8], agility: 1.3, turnRate: 4, cruiseMul: 0.8 },
  mahi_mahi: { group: 'loose', homeR: 0, surf: [18, 210], agility: 3, hunter: 0.7, turnRate: 6 },
  barracuda: { homeR: 900, restP: 0.45, restDur: [2, 7], agility: 3, hunter: 0.8, turnRate: 6 },
  yellowfin_tuna: { group: 'school', spacing: 1.7, homeR: 0, agility: 2.4, hunter: 0.6, turnRate: 5 },
  goliath_grouper: { homeR: 240, hover: [16, 90], restP: 0.6, restDur: [4, 10], agility: 0.9, turnRate: 2.6, cruiseMul: 0.85 },
  ocean_sunfish: { homeR: 600, surf: [0, 190], agility: 0.7, turnRate: 2.2, special: 'basker' },
  sailfish: { group: 'loose', homeR: 0, surf: [24, 260], agility: 2.4, hunter: 0.8, turnRate: 4.5 },
  swordfish: { homeR: 0, agility: 2, hunter: 0.5, turnRate: 3.5 },
  bluefin_tuna: { group: 'school', spacing: 1.9, homeR: 0, agility: 2.1, hunter: 0.6, turnRate: 3.6 },
  blue_marlin: { homeR: 0, agility: 2, hunter: 0.7, turnRate: 3.2 },
  lanternfish: { group: 'school', spacing: 1.8, homeR: 760, agility: 3, glow: 'flicker', turnRate: 8 },
  stingray: { homeR: 460, hover: [1, 10], restP: 0.65, restDur: [4, 12], agility: 1.4, tailRate: 0.55, turnRate: 3.5, special: 'bottom' },
  moray_eel: { homeR: 240, hover: [0, 6], restP: 0.6, restDur: [6, 16], agility: 1.6, turnRate: 4, special: 'lurker' },
  leopard_shark: { group: 'loose', homeR: 1300, hover: [8, 70], restP: 0.04, agility: 1.6, turnRate: 3.6 },
  blacktip_reef_shark: { group: 'loose', homeR: 1700, agility: 2, hunter: 0.6, turnRate: 4.2 },
  viperfish: { homeR: 420, restP: 0.6, restDur: [3, 9], agility: 2.4, special: 'ambush', glow: 'pulse' },
  gulper_eel: { homeR: 520, restP: 0.4, restDur: [3, 8], agility: 1, special: 'gape', glow: 'pulse', turnRate: 3 },
  anglerfish: { homeR: 280, restP: 0.8, restDur: [5, 14], agility: 0.9, glow: 'lure', turnRate: 3, cruiseMul: 0.8 },
  hammerhead: { group: 'loose', homeR: 0, agility: 1.6, hunter: 0.5, turnRate: 3.4, special: 'sweep' },
  mako_shark: { homeR: 0, agility: 2.6, hunter: 0.8, turnRate: 4.2 },
  manta_ray: { group: 'loose', homeR: 2400, agility: 0.8, turnRate: 2, tailRate: 0.45, special: 'filter' },
  goblin_shark: { homeR: 1000, hover: [20, 110], agility: 0.9, turnRate: 2.8 },
  oarfish: { homeR: 640, restP: 0.55, restDur: [6, 16], agility: 0.7, turnRate: 1.8, special: 'oarfish', maxPitch: 1.45 },
  great_white: { homeR: 0, agility: 1.5, hunter: 0.7, turnRate: 2.8 },
  whale_shark: { homeR: 0, surf: [40, 280], agility: 0.45, turnRate: 1.6, special: 'filter' },
  coelacanth: { homeR: 520, hover: [16, 90], restP: 0.5, restDur: [5, 12], agility: 0.8, turnRate: 2.4, special: 'headdown', maxPitch: 0.7 },
  megalodon: { homeR: 0, agility: 0.7, hunter: 0.3, turnRate: 1.5, cruiseMul: 0.62 },
  moon_jelly: { arch: 'jelly', group: 'bloom', homeR: 340, pulse: 0.75, thrust: 1, glow: 'pulse', maxPitch: 0.15 },
  blue_crab: { arch: 'crawl', homeR: 320, restP: 0.5, restDur: [0.6, 2.5], gait: 'scuttle', snapTurn: true, maxPitch: 0.15 },
  spiny_lobster: { arch: 'crawl', group: 'conga', homeR: 640, restP: 0.35, restDur: [1.5, 5], gait: 'walk', special: 'tailflip' },
  seahorse: { group: 'loose', homeR: 70, hover: [10, 70], restP: 0.7, restDur: [3, 9], agility: 1, turnRate: 3, cruiseMul: 0.8, maxPitch: 0.15 },
  octopus: { arch: 'crawl', homeR: 380, restP: 0.5, restDur: [2, 6], gait: 'creep', special: 'ink' },
  lions_mane: { arch: 'jelly', homeR: 420, pulse: 0.42, thrust: 0.9, maxPitch: 0.15 },
  giant_isopod: { arch: 'crawl', group: 'loose', homeR: 420, restP: 0.55, restDur: [2, 7], gait: 'walk' },
  humboldt_squid: { group: 'school', spacing: 2.1, homeR: 950, agility: 2.6, hunter: 0.5, glow: 'flash', jet: 1.2, turnRate: 6 },
  nautilus: { group: 'loose', homeR: 320, hover: [20, 120], agility: 1.2, jet: 0.55, turnRate: 3, restP: 0.2, maxPitch: 0.15 },
  sea_turtle: { homeR: 1000, agility: 1.2, turnRate: 2.8, special: 'breather', tailRate: 0.55 },
  dumbo_octopus: { homeR: 320, hover: [20, 110], agility: 1, jet: 0.6, turnRate: 3, restP: 0.3, restDur: [2, 6], maxPitch: 0.15 },
  vampire_squid: { homeR: 320, restP: 0.4, restDur: [2, 6], agility: 1.5, glow: 'pulse', special: 'ink', jet: 0.8 },
  giant_squid: { homeR: 0, agility: 0.9, hunter: 0.4, turnRate: 2.2, jet: 0.45 },
};

const DEF = {
  arch: 'swim', group: 'solo', cruiseMul: 1, agility: 2, turnRate: 6, tailRate: 1, maxPitch: 0.6,
  restP: 0.15, restDur: [1.5, 4], turnEvery: [7, 18], homeR: 600, hover: null, surf: null,
  hunter: 0, special: null, glow: null, pulse: 0, thrust: 1, jet: 0, gait: null, snapTurn: false,
  spacing: 1.2, mill: false, tight: 1, dart: 0,
};

/** Group style from species data when not overridden. */
function defaultGroup(sp) {
  return sp.school[1] > 1 ? 'loose' : 'solo';
}

/** Cruise speed (px/s) of an individual of on-screen length `len`. speed 1 ≈ a relaxed reef fish (~50 px/s). */
export function cruiseFor(prof, len) {
  const s = prof.sp.speed;
  if (s <= 0) return 0;
  return 50 * Math.pow(s, 0.85) * Math.pow(len / 60, 0.22) * prof.cruiseMul;
}

/** Build every profile. Call once from createFishSystem (after the art modules registered their bounds). */
export function buildProfiles() {
  const out = {};
  for (const sp of SPECIES) {
    const o = O[sp.id] || {};
    const p = { ...DEF, ...o, sp, id: sp.id, level: sp.level };
    if (!o.group) p.group = defaultGroup(sp);
    if (sp.group === 'item') {
      p.arch = 'item';
      p.group = 'solo';
      p.homeR = 0;
      p.maxPitch = 0.15; // drawn upright: the registry rotates them by pitch
    }
    // art extents in units of len (body centre → top / belly / snout / tail)
    const b = boundsOf(sp.id);
    p.up = Math.max(0.05, -b.y0);
    p.down = Math.max(0.05, b.y1);
    p.front = Math.max(0.2, b.x1);
    p.back = Math.max(0.2, -b.x0);
    p.refLen = visualLength(lengthFor(sp, 0.35));
    p.orient = { maxPitch: p.maxPitch, turnRate: p.turnRate, tailRate: p.tailRate };
    // small, schooling prey fears big things a lot; giants barely care
    p.fearK = sp.level >= 7 ? 0.15 : sp.predator > 0 ? 0.35 : 1;
    p.burst = p.arch === 'crawl' ? 2.4 : sp.temperament === 'skittish' ? 3.2 : 2.6;
    p.affCache = Object.create(null);
    p.isHunter = p.hunter > 0;
    out[sp.id] = p;
  }
  return out;
}
