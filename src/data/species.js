// ─────────────────────────────────────────────────────────────────────────────
// Fish Up — the species bible. KERNEL FILE (ids are frozen: art, AI, UI and
// progression all key off them).
//
// Field guide:
//   id, name, sci        identifiers / display names
//   set                  which art module draws it: 'bony' | 'sharks' | 'creatures'
//   group                'fish'|'shark'|'ray'|'eel'|'cephalopod'|'jelly'|'crustacean'|'reptile'|'item'
//   level                1..10 → base points (LEVEL_POINTS) and rarity colour. Items are level 0.
//   lengthCm [min,max]   size range of catchable individuals. `sizeLabel` says what is measured.
//   maxWeightKg          weight at max length; weight scales with length³ (see weightFor)
//   biomes               where it lives horizontally: 'reef'|'kelp'|'slope'|'open'|'trench'
//   depthM [min,max]     depth band in metres (× 8 = px). nightDepthM (optional) replaces it at night.
//   layer                'surface' (top of the column) | 'pelagic' (open water within depthM)
//                        | 'demersal' (hovers just above the seabed) | 'benthic' (on the seabed)
//   active               activity/bite multiplier per phase {day, dawn, dusk, night}
//   abundance            relative spawn weight inside its habitat (1 = common, 0.05 = very rare)
//   school [min,max]     group size
//   speed                cruise speed multiplier (1 ≈ a relaxed reef fish)
//   temperament          'skittish'|'curious'|'bold'|'aggressive'|'passive' — how it approaches a lure
//   diet                 {baitTag: affinity 0..1} — matched against the lure's tags
//   mouth                1..5 — hook size it can take (lure.hook must be within ±1)
//   fight                {style, power 1..10, stamina 1..10}
//                        styles: 'darter' (quick zig-zags) · 'runner' (long fast runs) · 'diver' (bores for the bottom)
//                        · 'jumper' (leaps, head-shakes) · 'thrasher' (rolls & shakes) · 'bulldog' (stubborn, short tugs)
//                        · 'deadweight' (slow, heavy) · 'floater' (drifts, barely fights)
//   biteWindow           seconds the player has to set the hook
//   protected            true → must be released: no sale, conservation bonus instead
//   glow                 bioluminescence colour (drawn additively in the dark) or null
//   predator             0 none · 1..3 = may attack a hooked fish up to (its level − 1); bigger number = bolder
//   valueMult            market value multiplier (coins)
//   accent               signature colour (UI accents, placeholder art)
//   fact                 fun fact for the Fishdex
// ─────────────────────────────────────────────────────────────────────────────

const A = (day, dawn, dusk, night) => ({ day, dawn, dusk, night });
const ALL = A(1, 1, 1, 1);

/** @type {Array<object>} */
export const SPECIES = [
  // ══ BONY FISH (set: 'bony') ═══════════════════════════════════════════════
  {
    id: 'clownfish', name: 'Clownfish', sci: 'Amphiprion ocellaris', set: 'bony', group: 'fish', level: 1,
    lengthCm: [5, 11], maxWeightKg: 0.03, biomes: ['reef'], depthM: [30, 64], layer: 'demersal',
    active: A(1, 0.8, 0.8, 0.15), abundance: 1.0, school: [2, 5], speed: 0.7, temperament: 'curious',
    diet: { worm: 1, plankton: 0.6, crustacean: 0.4 }, mouth: 1, fight: { style: 'darter', power: 1, stamina: 1 },
    biteWindow: 1.15, accent: '#ff7a1a',
    fact: 'All clownfish are born male. When the female of a group dies, the dominant male changes sex and takes her place.',
  },
  {
    id: 'blue_tang', name: 'Blue Tang', sci: 'Paracanthurus hepatus', set: 'bony', group: 'fish', level: 1,
    lengthCm: [10, 31], maxWeightKg: 0.6, biomes: ['reef'], depthM: [8, 58], layer: 'pelagic',
    active: A(1, 0.8, 0.8, 0.1), abundance: 0.9, school: [3, 7], speed: 0.9, temperament: 'skittish',
    diet: { worm: 0.8, plankton: 0.8, jelly: 0.2 }, mouth: 1, fight: { style: 'darter', power: 1, stamina: 1 },
    biteWindow: 1.0, accent: '#1e6bff',
    fact: 'Carries a razor-sharp spine at the base of its tail — the "scalpel" that gives surgeonfish their name.',
  },
  {
    id: 'sardine', name: 'Pacific Sardine', sci: 'Sardinops sagax', set: 'bony', group: 'fish', level: 1,
    lengthCm: [10, 28], maxWeightKg: 0.25, biomes: ['kelp', 'slope', 'open'], depthM: [3, 90], layer: 'pelagic',
    active: A(1, 1, 1, 0.7), abundance: 1.2, school: [8, 16], speed: 1.1, temperament: 'skittish',
    diet: { worm: 0.7, plankton: 1, flashy: 0.3 }, mouth: 1, fight: { style: 'darter', power: 1, stamina: 1 },
    biteWindow: 0.9, accent: '#9fb6c9',
    fact: 'Sardine schools can stretch for kilometres and hold billions of fish, moving like a single silver animal.',
  },
  {
    id: 'moorish_idol', name: 'Moorish Idol', sci: 'Zanclus cornutus', set: 'bony', group: 'fish', level: 2,
    lengthCm: [10, 23], maxWeightKg: 0.4, biomes: ['reef'], depthM: [8, 58], layer: 'pelagic',
    active: A(1, 0.8, 0.8, 0.1), abundance: 0.6, school: [1, 3], speed: 0.8, temperament: 'skittish',
    diet: { worm: 0.6, crustacean: 0.7, plankton: 0.5 }, mouth: 1, fight: { style: 'darter', power: 1, stamina: 2 },
    biteWindow: 0.85, accent: '#ffd21a',
    fact: 'Its trailing dorsal streamer can be longer than its whole body.',
  },
  {
    id: 'yellowtail_snapper', name: 'Yellowtail Snapper', sci: 'Ocyurus chrysurus', set: 'bony', group: 'fish', level: 2,
    lengthCm: [20, 75], maxWeightKg: 4.0, biomes: ['reef', 'kelp'], depthM: [10, 80], layer: 'pelagic',
    active: A(0.8, 1, 1, 0.7), abundance: 0.9, school: [3, 6], speed: 1.0, temperament: 'curious',
    diet: { worm: 0.7, crustacean: 1, small_fish: 0.6 }, mouth: 2, fight: { style: 'runner', power: 2, stamina: 2 },
    biteWindow: 0.9, accent: '#ffd84a',
    fact: 'Hovers above the reef in loose schools and does most of its feeding after dark.',
  },
  {
    id: 'garibaldi', name: 'Garibaldi', sci: 'Hypsypops rubicundus', set: 'bony', group: 'fish', level: 2,
    lengthCm: [15, 38], maxWeightKg: 1.0, biomes: ['kelp'], depthM: [20, 140], layer: 'demersal',
    active: A(1, 0.8, 0.8, 0.1), abundance: 0.8, school: [1, 2], speed: 0.7, temperament: 'bold',
    diet: { worm: 0.8, crustacean: 0.9 }, mouth: 2, fight: { style: 'bulldog', power: 2, stamina: 2 },
    biteWindow: 1.0, accent: '#ff6a00',
    fact: 'Fiercely territorial. Males tend little algae "gardens" for years to impress females.',
  },
  {
    id: 'mackerel', name: 'Atlantic Mackerel', sci: 'Scomber scombrus', set: 'bony', group: 'fish', level: 2,
    lengthCm: [20, 60], maxWeightKg: 3.0, biomes: ['kelp', 'slope', 'open', 'trench'], depthM: [3, 150], layer: 'pelagic',
    active: A(1, 1.2, 1.2, 0.5), abundance: 1.1, school: [5, 10], speed: 1.4, temperament: 'bold',
    diet: { flashy: 1, small_fish: 0.7, worm: 0.4, crustacean: 0.5 }, mouth: 2, fight: { style: 'runner', power: 2, stamina: 2 },
    biteWindow: 0.75, accent: '#2f9c8f',
    fact: 'Never stops swimming — it has no swim bladder and would sink if it did.',
  },
  {
    id: 'parrotfish', name: 'Stoplight Parrotfish', sci: 'Sparisoma viride', set: 'bony', group: 'fish', level: 3,
    lengthCm: [25, 64], maxWeightKg: 2.5, biomes: ['reef'], depthM: [20, 64], layer: 'demersal',
    active: A(1, 0.7, 0.7, 0.05), abundance: 0.6, school: [1, 3], speed: 0.8, temperament: 'curious',
    diet: { worm: 0.8, crustacean: 0.6, plankton: 0.3 }, mouth: 2, fight: { style: 'bulldog', power: 3, stamina: 3 },
    biteWindow: 0.9, accent: '#19c2a0',
    fact: 'Grinds up coral with its beak and poops out fine white sand — up to 90 kg of beach per year.',
  },
  {
    id: 'pufferfish', name: 'Porcupine Pufferfish', sci: 'Diodon holocanthus', set: 'bony', group: 'fish', level: 3,
    lengthCm: [15, 50], maxWeightKg: 3.0, biomes: ['reef', 'kelp'], depthM: [10, 70], layer: 'demersal',
    active: A(0.5, 0.8, 1, 1), abundance: 0.45, school: [1, 1], speed: 0.5, temperament: 'curious',
    diet: { crustacean: 1, worm: 0.5 }, mouth: 2, fight: { style: 'floater', power: 3, stamina: 2 },
    biteWindow: 1.2, accent: '#d9b36a',
    fact: 'Gulps water to inflate into a spiky ball three times its normal size. (It will. On your line.)',
  },
  {
    id: 'flying_fish', name: 'Flying Fish', sci: 'Cheilopogon melanurus', set: 'bony', group: 'fish', level: 3,
    lengthCm: [15, 32], maxWeightKg: 0.4, biomes: ['slope', 'open', 'trench'], depthM: [0, 20], layer: 'surface',
    active: A(1, 1, 1, 0.4), abundance: 0.6, school: [3, 6], speed: 1.5, temperament: 'skittish',
    diet: { plankton: 1, worm: 0.5, flashy: 0.5 }, mouth: 1, fight: { style: 'jumper', power: 2, stamina: 2 },
    biteWindow: 0.6, accent: '#5aa9e6',
    fact: 'Glides more than 200 m over the waves on wing-like fins to escape tuna and mahi-mahi.',
  },
  {
    id: 'lionfish', name: 'Red Lionfish', sci: 'Pterois volitans', set: 'bony', group: 'fish', level: 4,
    lengthCm: [18, 47], maxWeightKg: 1.4, biomes: ['reef', 'kelp'], depthM: [15, 70], layer: 'demersal',
    active: A(0.4, 0.8, 1, 1), abundance: 0.35, school: [1, 1], speed: 0.5, temperament: 'bold',
    diet: { small_fish: 1, crustacean: 0.8 }, mouth: 2, fight: { style: 'bulldog', power: 3, stamina: 3 },
    biteWindow: 1.0, accent: '#c0392b',
    fact: 'Eighteen venomous spines hide in that lacy mane. Beautiful, invasive, and best handled with gloves.',
  },
  {
    id: 'mahi_mahi', name: 'Mahi-mahi', sci: 'Coryphaena hippurus', set: 'bony', group: 'fish', level: 4,
    lengthCm: [50, 190], maxWeightKg: 40, biomes: ['slope', 'open', 'trench'], depthM: [0, 60], layer: 'surface',
    active: A(1, 1.1, 1, 0.3), abundance: 0.5, school: [1, 3], speed: 1.6, temperament: 'aggressive',
    diet: { flashy: 1, small_fish: 1, squid: 0.6 }, mouth: 3, fight: { style: 'jumper', power: 5, stamina: 4 },
    biteWindow: 0.7, accent: '#3ddc5f',
    fact: 'One of the fastest-growing fish alive, flashing electric gold, green and blue when excited.',
  },
  {
    id: 'barracuda', name: 'Great Barracuda', sci: 'Sphyraena barracuda', set: 'bony', group: 'fish', level: 5,
    lengthCm: [60, 190], maxWeightKg: 46, biomes: ['reef', 'kelp', 'slope'], depthM: [3, 90], layer: 'pelagic',
    active: A(1, 1.2, 1.2, 0.4), abundance: 0.35, school: [1, 1], speed: 1.6, temperament: 'aggressive',
    diet: { flashy: 1, small_fish: 1 }, mouth: 3, fight: { style: 'runner', power: 5, stamina: 4 },
    biteWindow: 0.6, predator: 1, accent: '#a8b8c4',
    fact: 'Strikes at 58 km/h and is irresistibly drawn to anything that glints.',
  },
  {
    id: 'yellowfin_tuna', name: 'Yellowfin Tuna', sci: 'Thunnus albacares', set: 'bony', group: 'fish', level: 5,
    lengthCm: [60, 210], maxWeightKg: 180, biomes: ['slope', 'open', 'trench'], depthM: [10, 180], layer: 'pelagic',
    active: A(1, 1.3, 1.3, 0.5), abundance: 0.4, school: [2, 4], speed: 1.8, temperament: 'bold',
    diet: { small_fish: 1, flashy: 0.9, squid: 0.8 }, mouth: 3, fight: { style: 'runner', power: 6, stamina: 6 },
    biteWindow: 0.65, valueMult: 1.4, accent: '#ffd400',
    fact: 'A torpedo of pure muscle that can cross an entire ocean in a matter of weeks.',
  },
  {
    id: 'goliath_grouper', name: 'Goliath Grouper', sci: 'Epinephelus itajara', set: 'bony', group: 'fish', level: 6,
    lengthCm: [80, 250], maxWeightKg: 360, biomes: ['reef', 'kelp', 'slope'], depthM: [35, 260], layer: 'demersal',
    active: A(0.8, 1, 1, 0.6), abundance: 0.2, school: [1, 1], speed: 0.6, temperament: 'bold',
    diet: { small_fish: 1, crustacean: 1, meat: 0.6, squid: 0.5 }, mouth: 4, fight: { style: 'diver', power: 7, stamina: 5 },
    biteWindow: 0.9, accent: '#8a7a4a',
    fact: 'Can swallow a small shark whole, and warns intruders with a boom you can feel in your chest.',
  },
  {
    id: 'ocean_sunfish', name: 'Ocean Sunfish', sci: 'Mola mola', set: 'bony', group: 'fish', level: 6,
    lengthCm: [100, 330], maxWeightKg: 2300, biomes: ['slope', 'open', 'trench'], depthM: [0, 200], layer: 'surface',
    active: A(1, 0.8, 0.8, 0.4), abundance: 0.15, school: [1, 1], speed: 0.4, temperament: 'passive',
    diet: { jelly: 1, squid: 0.3, plankton: 0.3 }, mouth: 2, fight: { style: 'deadweight', power: 5, stamina: 8 },
    biteWindow: 1.4, accent: '#9aa7b5',
    fact: 'The heaviest bony fish on Earth. It basks on its side at the surface to warm up after deep dives.',
  },
  {
    id: 'sailfish', name: 'Atlantic Sailfish', sci: 'Istiophorus albicans', set: 'bony', group: 'fish', level: 7,
    lengthCm: [150, 340], maxWeightKg: 100, biomes: ['slope', 'open', 'trench'], depthM: [0, 80], layer: 'surface',
    active: A(1, 1.2, 1.1, 0.3), abundance: 0.18, school: [1, 2], speed: 2.2, temperament: 'aggressive',
    diet: { small_fish: 1, flashy: 0.9, squid: 0.7 }, mouth: 3, fight: { style: 'jumper', power: 7, stamina: 6 },
    biteWindow: 0.5, valueMult: 1.2, accent: '#3a5bd9',
    fact: 'The fastest fish in the sea — clocked at 110 km/h. It raises that enormous sail to herd its prey.',
  },
  {
    id: 'swordfish', name: 'Swordfish', sci: 'Xiphias gladius', set: 'bony', group: 'fish', level: 7,
    lengthCm: [140, 450], maxWeightKg: 650, biomes: ['slope', 'open', 'trench'], depthM: [200, 550], nightDepthM: [15, 160], layer: 'pelagic',
    active: A(0.6, 0.9, 1, 1.2), abundance: 0.15, school: [1, 1], speed: 1.9, temperament: 'aggressive',
    diet: { squid: 1, small_fish: 0.9, glow: 0.6 }, mouth: 4, fight: { style: 'diver', power: 8, stamina: 7 },
    biteWindow: 0.55, valueMult: 1.3, accent: '#5a6a8a',
    fact: 'Heats its own eyes and brain to hunt in the cold dark. The sword is for slashing, not spearing.',
  },
  {
    id: 'bluefin_tuna', name: 'Bluefin Tuna', sci: 'Thunnus thynnus', set: 'bony', group: 'fish', level: 7,
    lengthCm: [120, 380], maxWeightKg: 680, biomes: ['slope', 'open', 'trench'], depthM: [20, 300], layer: 'pelagic',
    active: A(1, 1.3, 1.3, 0.5), abundance: 0.14, school: [1, 3], speed: 2.0, temperament: 'bold',
    diet: { small_fish: 1, squid: 0.9, flashy: 0.7 }, mouth: 4, fight: { style: 'runner', power: 8, stamina: 9 },
    biteWindow: 0.55, valueMult: 2.0, accent: '#1f3a7a',
    fact: 'A single bluefin once sold for $3.1 million. Warm-blooded, it dives to 1,000 m and sprints at 70 km/h.',
  },
  {
    id: 'blue_marlin', name: 'Blue Marlin', sci: 'Makaira nigricans', set: 'bony', group: 'fish', level: 8,
    lengthCm: [200, 500], maxWeightKg: 820, biomes: ['open', 'trench'], depthM: [0, 150], layer: 'pelagic',
    active: A(1, 1.2, 1.1, 0.3), abundance: 0.08, school: [1, 1], speed: 2.1, temperament: 'aggressive',
    diet: { small_fish: 1, squid: 0.8, flashy: 0.8, meat: 0.4 }, mouth: 4, fight: { style: 'jumper', power: 9, stamina: 8 },
    biteWindow: 0.5, valueMult: 1.5, accent: '#1c4fd6',
    fact: 'The trophy of trophies. Females top 800 kg and "light up" electric blue when they hunt.',
  },

  // ══ SHARKS, RAYS, EELS & DEEP-SEA FISH (set: 'sharks') ═════════════════════
  {
    id: 'lanternfish', name: 'Lanternfish', sci: 'Myctophum punctatum', set: 'sharks', group: 'fish', level: 2,
    lengthCm: [5, 15], maxWeightKg: 0.03, biomes: ['slope', 'open', 'trench'], depthM: [190, 520], nightDepthM: [50, 260], layer: 'pelagic',
    active: A(1, 1, 1, 1.2), abundance: 1.2, school: [6, 12], speed: 0.8, temperament: 'skittish',
    diet: { plankton: 1, glow: 0.8, worm: 0.4 }, mouth: 1, fight: { style: 'darter', power: 1, stamina: 1 },
    biteWindow: 0.9, glow: '#7fd8ff', accent: '#6fb7ff',
    fact: 'The most numerous vertebrates on Earth. Every night they make the biggest migration on the planet — straight up.',
  },
  {
    id: 'stingray', name: 'Blue-spotted Stingray', sci: 'Taeniura lymma', set: 'sharks', group: 'ray', level: 4,
    lengthCm: [35, 90], maxWeightKg: 5, biomes: ['reef'], depthM: [30, 70], layer: 'benthic',
    active: A(0.6, 0.9, 1, 1), abundance: 0.35, school: [1, 1], speed: 0.7, temperament: 'passive',
    diet: { crustacean: 1, worm: 0.8 }, mouth: 2, fight: { style: 'bulldog', power: 4, stamina: 4 },
    biteWindow: 1.0, accent: '#3aa0ff',
    fact: 'Those electric-blue spots are a warning: the tail carries two venomous barbs.',
  },
  {
    id: 'moray_eel', name: 'Green Moray', sci: 'Gymnothorax funebris', set: 'sharks', group: 'eel', level: 4,
    lengthCm: [80, 250], maxWeightKg: 29, biomes: ['reef', 'kelp', 'slope'], depthM: [25, 160], layer: 'benthic',
    active: A(0.4, 0.8, 1, 1.2), abundance: 0.3, school: [1, 1], speed: 0.7, temperament: 'aggressive',
    diet: { small_fish: 1, crustacean: 0.8, squid: 0.8, meat: 0.7 }, mouth: 3, fight: { style: 'thrasher', power: 5, stamina: 4 },
    biteWindow: 0.8, accent: '#7a9a3a',
    fact: 'Has a second set of jaws in its throat that shoots forward to drag prey down — just like the Alien.',
  },
  {
    id: 'leopard_shark', name: 'Leopard Shark', sci: 'Triakis semifasciata', set: 'sharks', group: 'shark', level: 4,
    lengthCm: [70, 190], maxWeightKg: 19, biomes: ['reef', 'kelp'], depthM: [20, 150], layer: 'demersal',
    active: A(0.8, 1, 1, 0.9), abundance: 0.35, school: [1, 3], speed: 1.0, temperament: 'passive',
    diet: { crustacean: 1, worm: 0.7, small_fish: 0.7, squid: 0.6 }, mouth: 3, fight: { style: 'bulldog', power: 4, stamina: 5 },
    biteWindow: 0.9, accent: '#b9a37a',
    fact: 'Harmless to people. Its saddles and spots are unique to each shark, like a fingerprint.',
  },
  {
    id: 'blacktip_reef_shark', name: 'Blacktip Reef Shark', sci: 'Carcharhinus melanopterus', set: 'sharks', group: 'shark', level: 5,
    lengthCm: [80, 200], maxWeightKg: 24, biomes: ['reef', 'kelp'], depthM: [3, 70], layer: 'pelagic',
    active: A(1, 1.2, 1.2, 0.8), abundance: 0.3, school: [1, 3], speed: 1.5, temperament: 'bold',
    diet: { small_fish: 1, meat: 0.9, squid: 0.6, flashy: 0.5 }, mouth: 3, fight: { style: 'runner', power: 5, stamina: 5 },
    biteWindow: 0.7, predator: 1, accent: '#8a8f98',
    fact: 'Patrols water so shallow that its black-tipped dorsal fin slices the surface.',
  },
  {
    id: 'viperfish', name: "Sloane's Viperfish", sci: 'Chauliodus sloani', set: 'sharks', group: 'fish', level: 5,
    lengthCm: [15, 35], maxWeightKg: 0.1, biomes: ['slope', 'open', 'trench'], depthM: [300, 720], layer: 'pelagic',
    active: A(1, 1, 1, 1.1), abundance: 0.4, school: [1, 1], speed: 0.9, temperament: 'aggressive',
    diet: { glow: 1, small_fish: 0.8, squid: 0.4 }, mouth: 2, fight: { style: 'thrasher', power: 3, stamina: 3 },
    biteWindow: 0.7, glow: '#8affc1', accent: '#3a4a6a',
    fact: "Fangs so long they don't fit in its mouth — they curve back up past its own eyes.",
  },
  {
    id: 'gulper_eel', name: 'Gulper Eel', sci: 'Eurypharynx pelecanoides', set: 'sharks', group: 'eel', level: 6,
    lengthCm: [40, 100], maxWeightKg: 1.0, biomes: ['open', 'trench'], depthM: [450, 880], layer: 'pelagic',
    active: ALL, abundance: 0.25, school: [1, 1], speed: 0.6, temperament: 'curious',
    diet: { glow: 1, crustacean: 0.7, squid: 0.5 }, mouth: 3, fight: { style: 'thrasher', power: 4, stamina: 4 },
    biteWindow: 1.0, glow: '#ff6fae', accent: '#2a2a3a',
    fact: 'Its enormous hinged mouth balloons open like a pelican pouch to swallow prey bigger than itself.',
  },
  {
    id: 'anglerfish', name: 'Deep-sea Anglerfish', sci: 'Ceratias holboelli', set: 'sharks', group: 'fish', level: 6,
    lengthCm: [20, 120], maxWeightKg: 22, biomes: ['slope', 'open', 'trench'], depthM: [450, 880], layer: 'pelagic',
    active: ALL, abundance: 0.25, school: [1, 1], speed: 0.4, temperament: 'bold',
    diet: { glow: 1, small_fish: 0.8, squid: 0.5 }, mouth: 3, fight: { style: 'bulldog', power: 5, stamina: 4 },
    biteWindow: 0.9, glow: '#9ffcff', accent: '#3a2f3a',
    fact: 'The glowing lure is powered by bacteria. Tiny males bite the female and fuse onto her — permanently.',
  },
  {
    id: 'hammerhead', name: 'Great Hammerhead', sci: 'Sphyrna mokarran', set: 'sharks', group: 'shark', level: 7,
    lengthCm: [180, 550], maxWeightKg: 450, biomes: ['kelp', 'slope', 'open'], depthM: [5, 250], layer: 'pelagic',
    active: A(0.8, 1.1, 1.2, 1), abundance: 0.12, school: [1, 2], speed: 1.5, temperament: 'aggressive',
    diet: { meat: 1, small_fish: 0.8, squid: 0.7, crustacean: 0.4 }, mouth: 4, fight: { style: 'runner', power: 8, stamina: 7 },
    biteWindow: 0.7, predator: 2, accent: '#8f8a7a',
    fact: "That hammer is a 360° sensor array: it can feel a stingray's heartbeat under the sand.",
  },
  {
    id: 'mako_shark', name: 'Shortfin Mako', sci: 'Isurus oxyrinchus', set: 'sharks', group: 'shark', level: 7,
    lengthCm: [150, 400], maxWeightKg: 570, biomes: ['slope', 'open', 'trench'], depthM: [0, 300], layer: 'pelagic',
    active: A(1, 1.1, 1.1, 0.8), abundance: 0.1, school: [1, 1], speed: 2.2, temperament: 'aggressive',
    diet: { small_fish: 1, meat: 0.9, squid: 0.7, flashy: 0.6 }, mouth: 4, fight: { style: 'jumper', power: 8, stamina: 7 },
    biteWindow: 0.55, predator: 2, accent: '#2f5fb5',
    fact: 'The fastest shark alive: 74 km/h bursts, and leaps six metres clear of the water when hooked.',
  },
  {
    id: 'manta_ray', name: 'Giant Manta Ray', sci: 'Mobula birostris', set: 'sharks', group: 'ray', level: 7,
    lengthCm: [250, 700], sizeLabel: 'wingspan', maxWeightKg: 2000, biomes: ['slope', 'open', 'trench'], depthM: [0, 120], layer: 'pelagic',
    active: A(1, 1, 0.9, 0.5), abundance: 0.1, school: [1, 2], speed: 1.0, temperament: 'passive',
    diet: { plankton: 1 }, mouth: 3, fight: { style: 'runner', power: 7, stamina: 8 },
    biteWindow: 1.2, protected: true, accent: '#2a2f3a',
    fact: 'Has the biggest brain of any fish. Mantas recognise themselves in mirrors and queue up at "cleaning stations".',
  },
  {
    id: 'goblin_shark', name: 'Goblin Shark', sci: 'Mitsukurina owstoni', set: 'sharks', group: 'shark', level: 8,
    lengthCm: [150, 380], maxWeightKg: 210, biomes: ['slope', 'open', 'trench'], depthM: [300, 880], layer: 'demersal',
    active: ALL, abundance: 0.08, school: [1, 1], speed: 0.7, temperament: 'bold',
    diet: { squid: 1, glow: 0.8, small_fish: 0.8, crustacean: 0.6, meat: 0.5 }, mouth: 4, fight: { style: 'thrasher', power: 7, stamina: 5 },
    biteWindow: 0.8, accent: '#e5a3a8',
    fact: 'A 125-million-year-old lineage. Its jaws catapult right out of its face to snatch prey.',
  },
  {
    id: 'oarfish', name: 'Giant Oarfish', sci: 'Regalecus glesne', set: 'sharks', group: 'fish', level: 8,
    lengthCm: [300, 1100], maxWeightKg: 270, biomes: ['open', 'trench'], depthM: [150, 650], layer: 'pelagic',
    active: ALL, abundance: 0.07, school: [1, 1], speed: 0.7, temperament: 'passive',
    diet: { plankton: 1, crustacean: 0.7, squid: 0.6, glow: 0.5 }, mouth: 2, fight: { style: 'thrasher', power: 6, stamina: 5 },
    biteWindow: 1.1, accent: '#cfd6e0',
    fact: 'The longest bony fish alive, and the truth behind sea-serpent legends. It hangs vertically in the water, head up.',
  },
  {
    id: 'great_white', name: 'Great White Shark', sci: 'Carcharodon carcharias', set: 'sharks', group: 'shark', level: 9,
    lengthCm: [250, 610], maxWeightKg: 2000, biomes: ['kelp', 'slope', 'open', 'trench'], depthM: [0, 250], layer: 'pelagic',
    active: A(1, 1.3, 1.3, 0.7), abundance: 0.06, school: [1, 1], speed: 1.8, temperament: 'aggressive',
    diet: { meat: 1, small_fish: 0.5, squid: 0.4 }, mouth: 5, fight: { style: 'runner', power: 10, stamina: 9 },
    biteWindow: 0.6, predator: 3, protected: true, accent: '#7d8791',
    fact: 'Senses one drop of blood in 100 litres of water, and launches three metres into the air when it hunts.',
  },
  {
    id: 'whale_shark', name: 'Whale Shark', sci: 'Rhincodon typus', set: 'sharks', group: 'shark', level: 9,
    lengthCm: [400, 1800], maxWeightKg: 21000, biomes: ['slope', 'open', 'trench'], depthM: [0, 100], layer: 'surface',
    active: A(1, 1, 0.9, 0.5), abundance: 0.05, school: [1, 1], speed: 0.6, temperament: 'passive',
    diet: { plankton: 1 }, mouth: 5, fight: { style: 'deadweight', power: 9, stamina: 10 },
    biteWindow: 1.5, protected: true, accent: '#3f5f7a',
    fact: 'The biggest fish in the sea eats some of the smallest things in it. Every one wears a unique star-map of spots.',
  },
  {
    id: 'coelacanth', name: 'Coelacanth', sci: 'Latimeria chalumnae', set: 'sharks', group: 'fish', level: 9,
    lengthCm: [90, 200], maxWeightKg: 90, biomes: ['slope', 'trench'], depthM: [250, 720], layer: 'demersal',
    active: A(0.5, 0.8, 1, 1.2), abundance: 0.05, school: [1, 1], speed: 0.5, temperament: 'curious',
    diet: { squid: 1, small_fish: 0.9, glow: 0.7 }, mouth: 3, fight: { style: 'bulldog', power: 6, stamina: 6 },
    biteWindow: 1.0, protected: true, accent: '#3d5a9a',
    fact: 'A "living fossil" believed extinct for 66 million years — until a fisherman hauled one up in 1938.',
  },
  {
    id: 'megalodon', name: 'Megalodon', sci: 'Otodus megalodon', set: 'sharks', group: 'shark', level: 10,
    lengthCm: [1000, 1800], maxWeightKg: 60000, biomes: ['trench'], depthM: [480, 880], layer: 'pelagic',
    active: A(0.05, 0.1, 0.4, 1), abundance: 0.012, school: [1, 1], speed: 1.5, temperament: 'aggressive',
    diet: { meat: 1 }, mouth: 5, fight: { style: 'runner', power: 10, stamina: 10 },
    biteWindow: 0.7, predator: 3, protected: true, secret: true, accent: '#4a5560',
    fact: 'They said it died out 3.6 million years ago. They were wrong.',
  },

  // ══ INVERTEBRATES, REPTILES & OTHER CREATURES (set: 'creatures') ═══════════
  {
    id: 'moon_jelly', name: 'Moon Jellyfish', sci: 'Aurelia aurita', set: 'creatures', group: 'jelly', level: 2,
    lengthCm: [10, 40], sizeLabel: 'bell', maxWeightKg: 1.2, biomes: ['reef', 'kelp', 'slope', 'open'], depthM: [2, 120], layer: 'pelagic',
    active: ALL, abundance: 0.7, school: [2, 5], speed: 0.25, temperament: 'passive',
    diet: { plankton: 1 }, mouth: 1, fight: { style: 'floater', power: 1, stamina: 1 },
    biteWindow: 1.5, glow: '#bfe9ff', accent: '#cfe8ff',
    fact: 'No brain, no heart, no blood — and it has drifted the oceans for 500 million years.',
  },
  {
    id: 'blue_crab', name: 'Blue Crab', sci: 'Callinectes sapidus', set: 'creatures', group: 'crustacean', level: 2,
    lengthCm: [9, 23], sizeLabel: 'width', maxWeightKg: 0.5, biomes: ['reef', 'kelp'], depthM: [30, 180], layer: 'benthic',
    active: A(0.6, 0.9, 1, 1), abundance: 0.6, school: [1, 1], speed: 0.5, temperament: 'bold',
    diet: { worm: 1, meat: 1, crustacean: 0.5, small_fish: 0.4 }, mouth: 2, fight: { style: 'bulldog', power: 1, stamina: 2 },
    biteWindow: 1.3, accent: '#3f7fd9',
    fact: 'Its scientific name means "beautiful savoury swimmer" — the back legs are paddles.',
  },
  {
    id: 'spiny_lobster', name: 'Spiny Lobster', sci: 'Panulirus argus', set: 'creatures', group: 'crustacean', level: 3,
    lengthCm: [20, 60], maxWeightKg: 6.8, biomes: ['reef', 'kelp', 'slope'], depthM: [35, 300], layer: 'benthic',
    active: A(0.3, 0.8, 1, 1.2), abundance: 0.4, school: [1, 2], speed: 0.5, temperament: 'skittish',
    diet: { worm: 1, meat: 0.9, crustacean: 0.6 }, mouth: 2, fight: { style: 'bulldog', power: 2, stamina: 2 },
    biteWindow: 1.1, valueMult: 1.6, accent: '#c0562b',
    fact: 'Migrates across the seafloor in single-file conga lines of up to fifty lobsters.',
  },
  {
    id: 'seahorse', name: 'Lined Seahorse', sci: 'Hippocampus erectus', set: 'creatures', group: 'fish', level: 3,
    lengthCm: [6, 19], sizeLabel: 'height', maxWeightKg: 0.03, biomes: ['reef', 'kelp'], depthM: [20, 110], layer: 'demersal',
    active: A(1, 0.8, 0.8, 0.3), abundance: 0.25, school: [1, 2], speed: 0.2, temperament: 'passive',
    diet: { plankton: 1, worm: 0.5, crustacean: 0.5 }, mouth: 1, fight: { style: 'floater', power: 1, stamina: 1 },
    biteWindow: 1.6, protected: true, accent: '#e8b23a',
    fact: 'The male gets pregnant — and gives birth to as many as 1,500 babies at once.',
  },
  {
    id: 'octopus', name: 'Common Octopus', sci: 'Octopus vulgaris', set: 'creatures', group: 'cephalopod', level: 4,
    lengthCm: [30, 130], maxWeightKg: 10, biomes: ['reef', 'kelp', 'slope'], depthM: [25, 220], layer: 'benthic',
    active: A(0.5, 0.9, 1.1, 1.2), abundance: 0.3, school: [1, 1], speed: 0.7, temperament: 'curious',
    diet: { crustacean: 1, small_fish: 0.5, meat: 0.5, worm: 0.4 }, mouth: 2, fight: { style: 'bulldog', power: 4, stamina: 3 },
    biteWindow: 1.2, accent: '#c96a4a',
    fact: 'Three hearts, blue blood, nine brains — and it can squeeze through a hole the size of its own eyeball.',
  },
  {
    id: 'lions_mane', name: "Lion's Mane Jellyfish", sci: 'Cyanea capillata', set: 'creatures', group: 'jelly', level: 4,
    lengthCm: [30, 200], sizeLabel: 'bell', maxWeightKg: 120, biomes: ['kelp', 'slope', 'open'], depthM: [2, 150], layer: 'pelagic',
    active: ALL, abundance: 0.2, school: [1, 1], speed: 0.25, temperament: 'passive',
    diet: { plankton: 1, jelly: 0.5, small_fish: 0.4 }, mouth: 2, fight: { style: 'deadweight', power: 3, stamina: 2 },
    biteWindow: 1.5, accent: '#d9622b',
    fact: 'Its tentacles can trail for 36 metres — longer than a blue whale.',
  },
  {
    id: 'giant_isopod', name: 'Giant Isopod', sci: 'Bathynomus giganteus', set: 'creatures', group: 'crustacean', level: 4,
    lengthCm: [17, 50], maxWeightKg: 1.7, biomes: ['slope', 'open', 'trench'], depthM: [300, 890], layer: 'benthic',
    active: ALL, abundance: 0.4, school: [1, 2], speed: 0.3, temperament: 'bold',
    diet: { meat: 1, worm: 0.6, crustacean: 0.5, squid: 0.5 }, mouth: 2, fight: { style: 'bulldog', power: 2, stamina: 2 },
    biteWindow: 1.4, accent: '#c9b8c9',
    fact: 'A woodlouse the size of a cat. One in a Japanese aquarium went five years without eating.',
  },
  {
    id: 'humboldt_squid', name: 'Humboldt Squid', sci: 'Dosidicus gigas', set: 'creatures', group: 'cephalopod', level: 5,
    lengthCm: [60, 250], maxWeightKg: 50, biomes: ['slope', 'open', 'trench'], depthM: [150, 560], nightDepthM: [10, 200], layer: 'pelagic',
    active: A(0.7, 0.9, 1, 1.3), abundance: 0.3, school: [2, 5], speed: 1.4, temperament: 'aggressive',
    diet: { squid: 1, small_fish: 0.9, glow: 0.9, flashy: 0.5 }, mouth: 3, fight: { style: 'runner', power: 5, stamina: 4 },
    biteWindow: 0.7, glow: '#ff5a5a', accent: '#b0302a',
    fact: 'The "red devil" hunts in packs of over a thousand and talks by flashing red and white.',
  },
  {
    id: 'nautilus', name: 'Chambered Nautilus', sci: 'Nautilus pompilius', set: 'creatures', group: 'cephalopod', level: 5,
    lengthCm: [10, 27], sizeLabel: 'shell', maxWeightKg: 1.3, biomes: ['slope', 'trench'], depthM: [150, 560], layer: 'demersal',
    active: A(0.8, 1, 1, 1.1), abundance: 0.25, school: [1, 2], speed: 0.3, temperament: 'passive',
    diet: { crustacean: 1, meat: 0.8, worm: 0.5 }, mouth: 2, fight: { style: 'floater', power: 2, stamina: 2 },
    biteWindow: 1.5, protected: true, accent: '#d98a5a',
    fact: 'Its shell is a near-perfect logarithmic spiral — a design unchanged for 500 million years.',
  },
  {
    id: 'sea_turtle', name: 'Green Sea Turtle', sci: 'Chelonia mydas', set: 'creatures', group: 'reptile', level: 5,
    lengthCm: [60, 150], sizeLabel: 'shell', maxWeightKg: 300, biomes: ['reef', 'kelp', 'slope'], depthM: [0, 60], layer: 'pelagic',
    active: A(1, 0.9, 0.8, 0.3), abundance: 0.2, school: [1, 1], speed: 0.7, temperament: 'passive',
    diet: { jelly: 1, plankton: 0.4, crustacean: 0.3 }, mouth: 2, fight: { style: 'bulldog', power: 5, stamina: 7 },
    biteWindow: 1.4, protected: true, accent: '#5f9a5a',
    fact: "Navigates thousands of kilometres by Earth's magnetic field to nest on the very beach where it hatched.",
  },
  {
    id: 'dumbo_octopus', name: 'Dumbo Octopus', sci: 'Grimpoteuthis', set: 'creatures', group: 'cephalopod', level: 6,
    lengthCm: [20, 90], maxWeightKg: 6, biomes: ['open', 'trench'], depthM: [550, 890], layer: 'demersal',
    active: ALL, abundance: 0.2, school: [1, 1], speed: 0.35, temperament: 'curious',
    diet: { crustacean: 1, worm: 0.8, glow: 0.6 }, mouth: 2, fight: { style: 'floater', power: 2, stamina: 3 },
    biteWindow: 1.5, accent: '#ff9fb5',
    fact: 'The deepest-living octopus known. It "flies" through the abyss by flapping its ear-like fins.',
  },
  {
    id: 'vampire_squid', name: 'Vampire Squid', sci: 'Vampyroteuthis infernalis', set: 'creatures', group: 'cephalopod', level: 6,
    lengthCm: [13, 30], maxWeightKg: 0.5, biomes: ['slope', 'open', 'trench'], depthM: [450, 880], layer: 'pelagic',
    active: ALL, abundance: 0.2, school: [1, 1], speed: 0.5, temperament: 'skittish',
    diet: { plankton: 1, glow: 0.9, crustacean: 0.5 }, mouth: 1, fight: { style: 'darter', power: 2, stamina: 3 },
    biteWindow: 0.9, glow: '#59c8ff', accent: '#7a1f2f',
    fact: 'Neither vampire nor squid. When threatened it turns itself inside-out and squirts glowing blue mucus.',
  },
  {
    id: 'giant_squid', name: 'Giant Squid', sci: 'Architeuthis dux', set: 'creatures', group: 'cephalopod', level: 9,
    lengthCm: [400, 1300], maxWeightKg: 275, biomes: ['open', 'trench'], depthM: [450, 890], layer: 'pelagic',
    active: A(1, 1, 1, 1.1), abundance: 0.045, school: [1, 1], speed: 1.2, temperament: 'aggressive',
    diet: { squid: 1, glow: 1, small_fish: 0.8, meat: 0.7 }, mouth: 4, fight: { style: 'diver', power: 9, stamina: 7 },
    biteWindow: 0.8, predator: 2, accent: '#b8433a',
    fact: 'Eyes the size of dinner plates — the largest in the animal kingdom — for spotting sperm whales in the dark.',
  },

  // ══ ITEMS (set: 'creatures', group: 'item', level 0) ═══════════════════════
  // item.kind: 'junk' (cleanup bonus) | 'treasure' (coins) | 'bottle' (a note + XP).
  // They never "bite": the lure snags them when it passes close. They come up as dead weight.
  {
    id: 'old_boot', name: 'Old Boot', sci: 'Calceus antiquus', set: 'creatures', group: 'item', level: 0,
    item: { kind: 'junk', points: 5, coins: [2, 6] },
    lengthCm: [28, 32], maxWeightKg: 1.2, biomes: ['reef', 'kelp', 'slope'], depthM: [20, 400], layer: 'benthic',
    active: ALL, abundance: 0.18, school: [1, 1], speed: 0, temperament: 'passive',
    diet: {}, mouth: 0, fight: { style: 'deadweight', power: 1, stamina: 0 }, biteWindow: 2, accent: '#7a5a3a',
    fact: 'Somewhere, someone is hopping home.',
  },
  {
    id: 'tin_can', name: 'Rusty Can', sci: 'Stannum oxidatum', set: 'creatures', group: 'item', level: 0,
    item: { kind: 'junk', points: 5, coins: [1, 5] },
    lengthCm: [11, 13], maxWeightKg: 0.1, biomes: ['reef', 'kelp', 'slope', 'open'], depthM: [20, 640], layer: 'benthic',
    active: ALL, abundance: 0.18, school: [1, 1], speed: 0, temperament: 'passive',
    diet: {}, mouth: 0, fight: { style: 'deadweight', power: 1, stamina: 0 }, biteWindow: 2, accent: '#a8623a',
    fact: 'A tin can takes about 50 years to break down in seawater. Thanks for cleaning up!',
  },
  {
    id: 'message_bottle', name: 'Message in a Bottle', sci: 'Epistula vitrea', set: 'creatures', group: 'item', level: 0,
    item: { kind: 'bottle', points: 60, coins: [15, 40] },
    lengthCm: [28, 30], maxWeightKg: 0.6, biomes: ['reef', 'kelp', 'slope', 'open', 'trench'], depthM: [0, 2], layer: 'surface',
    active: ALL, abundance: 0.1, school: [1, 1], speed: 0, temperament: 'passive',
    diet: {}, mouth: 0, fight: { style: 'floater', power: 1, stamina: 0 }, biteWindow: 2, accent: '#7fd6b8',
    fact: 'The oldest message in a bottle ever found had been drifting for 131 years.',
  },
  {
    id: 'pearl_oyster', name: 'Giant Pearl Oyster', sci: 'Pinctada maxima', set: 'creatures', group: 'item', level: 0,
    item: { kind: 'treasure', points: 150, coins: [120, 260] },
    lengthCm: [20, 30], maxWeightKg: 5, biomes: ['reef', 'kelp'], depthM: [40, 170], layer: 'benthic',
    active: ALL, abundance: 0.07, school: [1, 1], speed: 0, temperament: 'passive',
    diet: {}, mouth: 0, fight: { style: 'deadweight', power: 2, stamina: 0 }, biteWindow: 2, accent: '#f2e9dc',
    fact: 'A pearl is an oyster\'s way of dealing with an itch: layer upon layer of nacre around an irritant.',
  },
  {
    id: 'treasure_chest', name: 'Sunken Treasure Chest', sci: 'Arca thesauri', set: 'creatures', group: 'item', level: 0,
    item: { kind: 'treasure', points: 400, coins: [350, 900] },
    lengthCm: [75, 85], maxWeightKg: 60, biomes: ['slope', 'open', 'trench'], depthM: [250, 890], layer: 'benthic',
    active: ALL, abundance: 0.05, school: [1, 1], speed: 0, temperament: 'passive',
    diet: {}, mouth: 0, fight: { style: 'deadweight', power: 5, stamina: 0 }, biteWindow: 2, accent: '#ffcf4a',
    fact: 'Pirates never did trust banks.',
  },
];

// Fill optional fields so consumers never need to null-check.
for (const s of SPECIES) {
  if (s.predator === undefined) s.predator = 0;
  if (s.protected === undefined) s.protected = false;
  if (s.glow === undefined) s.glow = null;
  if (s.valueMult === undefined) s.valueMult = 1;
  if (s.sizeLabel === undefined) s.sizeLabel = 'length';
  if (s.nightDepthM === undefined) s.nightDepthM = null;
  if (s.secret === undefined) s.secret = false;
  if (s.item === undefined) s.item = null;
}

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));
/** Living things only (no items). */
export const ANIMALS = SPECIES.filter((s) => s.group !== 'item');
export const ITEMS = SPECIES.filter((s) => s.group === 'item');

/** Weight (kg) of an individual of this species at a given length — cubic scaling from the max. */
export function weightFor(species, lengthCm) {
  const r = lengthCm / species.lengthCm[1];
  return species.maxWeightKg * r * r * r;
}
/** Length (cm) at a size quantile 0..1 within the species range. */
export function lengthFor(species, sizeQ) {
  return species.lengthCm[0] + (species.lengthCm[1] - species.lengthCm[0]) * sizeQ;
}
/**
 * On-screen length (logical px at zoom 1) of an animal of real length (cm).
 * Deliberately non-linear so that a 10 cm clownfish is still visible and an 18 m megalodon fits on screen:
 *   8 cm → 34 px · 30 cm → 66 px · 1 m → 132 px · 2 m → 197 px · 4.5 m → 316 px · 10 m → 502 px · 18 m → 706 px
 */
export function visualLength(lengthCm) {
  return Math.max(34, 132 * Math.pow(lengthCm / 100, 0.58));
}

/** Nicely formatted weight: 0.03 kg → "30 g", 12.34 → "12.3 kg", 21000 → "21.0 t". */
export function formatWeight(kg) {
  if (kg < 1) return `${Math.max(1, Math.round(kg * 1000))} g`;
  if (kg < 10) return `${kg.toFixed(2)} kg`;
  if (kg < 1000) return `${kg.toFixed(1)} kg`;
  return `${(kg / 1000).toFixed(2)} t`;
}
/** Nicely formatted length: 9.5 → "9.5 cm", 250 → "2.50 m". */
export function formatLength(cm) {
  if (cm < 100) return `${cm.toFixed(1)} cm`;
  return `${(cm / 100).toFixed(2)} m`;
}
