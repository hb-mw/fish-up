// Lures & baits. KERNEL FILE (ids frozen). The progression module may re-balance price/unlockLevel
// from its own tables, but the attraction model below is what fish AI and gameplay read.
//
//   tags        {baitTag: strength 0..1} — matched against species.diet
//   hook        [minMouth, maxMouth] — species.mouth must fall inside this range to be hookable
//   glow        0..1 light the lure emits (visible from far away in dark water; draws deep-sea life)
//   flash       0..1 glint when it moves (visual sparkle; attracts in bright water)
//   sink        px/s terminal sink speed
//   bigBias     0..1 — skews bites toward larger individuals
//   price, unlockLevel — shop defaults

export const LURES = [
  {
    id: 'worm', name: 'Garden Worm', tags: { worm: 1 }, hook: [1, 2], glow: 0, flash: 0, sink: 150, bigBias: 0,
    price: 0, unlockLevel: 1, color: '#d9796a',
    desc: 'The classic. Small reef fish can\'t resist a wriggler.',
  },
  {
    id: 'shrimp', name: 'Live Shrimp', tags: { crustacean: 1, worm: 0.4 }, hook: [1, 3], glow: 0, flash: 0.1, sink: 165, bigBias: 0.05,
    price: 120, unlockLevel: 2, color: '#ff9f80',
    desc: 'Snapper, parrotfish, rays, octopus — everybody on the reef loves shrimp.',
  },
  {
    id: 'spinner', name: 'Silver Spinner', tags: { flashy: 1, small_fish: 0.4 }, hook: [2, 3], glow: 0, flash: 1, sink: 195, bigBias: 0.1,
    price: 320, unlockLevel: 3, color: '#dfe8f2',
    desc: 'A flashing blade that drives mackerel, barracuda and mahi-mahi wild.',
  },
  {
    id: 'jelly', name: 'Jelly Blob', tags: { jelly: 1, plankton: 0.5 }, hook: [1, 3], glow: 0.15, flash: 0, sink: 120, bigBias: 0.1,
    price: 480, unlockLevel: 4, color: '#c9b8ff',
    desc: 'A wobbling imitation jellyfish. Turtles and the mighty sunfish go for it.',
  },
  {
    id: 'minnow', name: 'Live Sardine', tags: { small_fish: 1, flashy: 0.4 }, hook: [3, 4], glow: 0, flash: 0.5, sink: 205, bigBias: 0.2,
    price: 750, unlockLevel: 5, color: '#9fc0d9',
    desc: 'Live bait for serious predators: tuna, sailfish, marlin and sharks.',
  },
  {
    id: 'krill', name: 'Krill Cloud', tags: { plankton: 1 }, hook: [1, 5], glow: 0.1, flash: 0.2, sink: 115, bigBias: 0.15,
    price: 950, unlockLevel: 6, color: '#ffb3a0',
    desc: 'A pink puff of krill. The gentle giants — manta rays and whale sharks — filter it right up.',
  },
  {
    id: 'squid_jig', name: 'Squid Jig', tags: { squid: 1, glow: 0.5, small_fish: 0.3 }, hook: [2, 4], glow: 0.5, flash: 0.3, sink: 265, bigBias: 0.2,
    price: 1600, unlockLevel: 7, color: '#ff7ad1',
    desc: 'A luminous jig for the twilight zone: squid, swordfish and stranger things.',
  },
  {
    id: 'glow_jig', name: 'Abyss Glow Jig', tags: { glow: 1, squid: 0.4, plankton: 0.3 }, hook: [1, 4], glow: 1, flash: 0.1, sink: 330, bigBias: 0.2,
    price: 2800, unlockLevel: 9, color: '#6ffcf0',
    desc: 'Heavy, bright and built for the dark. Down there, light is the only language.',
  },
  {
    id: 'chum', name: 'Bloody Chum', tags: { meat: 1, small_fish: 0.3 }, hook: [3, 5], glow: 0, flash: 0, sink: 245, bigBias: 0.35,
    price: 4200, unlockLevel: 11, color: '#b3261e',
    desc: 'A slab of tuna trailing a blood slick. You\'re going to need a bigger boat.',
  },
];

export const LURES_BY_ID = Object.fromEntries(LURES.map((l) => [l.id, l]));

/**
 * How attractive is `lure` to `species`? 0 = ignores it completely, 1 = irresistible.
 * (Pure diet match — fish AI layers distance, light, mood, time of day… on top.)
 */
export function lureAffinity(lure, species) {
  if (!lure || !species || species.group === 'item') return 0;
  if (species.mouth < lure.hook[0] || species.mouth > lure.hook[1]) return 0;
  let best = 0;
  for (const tag in lure.tags) {
    const a = (species.diet[tag] || 0) * lure.tags[tag];
    if (a > best) best = a;
  }
  return best;
}
