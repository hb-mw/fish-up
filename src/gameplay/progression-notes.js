// Fish Up — META: messages found in bottles, and what turns up in chests and oysters.
// Hints marked `tip` are real: they match the habitat / depth / time / bait data in src/data/species.js.

export const BOTTLE_NOTES = [
  // ── real tips ──
  { tip: true, text: 'Swordfish hunt below 200 m all day. After sunset they rise to within 160 m of the surface. They cannot say no to squid.' },
  { tip: true, text: 'Manta rays and whale sharks ignore hooks… unless it looks like a cloud of krill. Try the surface past the drop-off. Be gentle: they go back.' },
  { tip: true, text: 'The ocean sunfish basks at the surface beyond the drop-off and would do anything for a jellyfish.' },
  { tip: true, text: 'Something enormous circles the trench after dark, deeper than 480 m. The old-timers say it smells chum a mile away. Bring the strongest line ever spun.' },
  { tip: true, text: 'A fish that outlived the dinosaurs still hunts the drop-off and the trench, 250 m and deeper, from dusk till dawn. It is partial to squid.' },
  { tip: true, text: 'Lobsters and octopus hide all day. Come back at night and drag a shrimp along the bottom.' },
  { tip: true, text: 'In the abyss, light is the only language. A glowing jig speaks it fluently.' },
  { tip: true, text: 'Barracuda cannot resist anything that flashes. Spin a silver blade along the reef.' },
  { tip: true, text: 'Tuna feed hardest at dawn and dusk, out past the drop-off. Live sardines are their candy.' },
  { tip: true, text: 'Giant oysters sit on the reef and kelp floors, 40 m and deeper. Some of them are keeping pearls.' },
  { tip: true, text: 'Red devils rise from the deep at night: Humboldt squid, hunting in packs. They hit anything that glows.' },
  { tip: true, text: 'The marlin of your dreams cruises the open ocean near the surface in daylight. Troll a live sardine and hold on tight.' },
  { tip: true, text: 'Golden fish are real. Patience and a little luck will bring one to your hook.' },
  { tip: true, text: 'Great whites prowl the kelp edge and beyond, mostly at dawn and dusk. They want meat. A lot of it.' },
  { tip: true, text: 'Below 450 m, off the open ocean, something with eyes the size of dinner plates is watching your lure.' },
  { tip: true, text: 'Pirates lost their gold where the sea floor falls away. Look for chests 250 m down and deeper. Try near the old wreck.' },
  { tip: true, text: 'The green turtle cruises the shallows by day and loves a jellyfish snack. She is protected: say hello, then let her go.' },
  { tip: true, text: 'Every night the lanternfish climb toward the surface: the biggest migration on Earth. After dark, shallow lines catch deep fish.' },
  // ── just for fun ──
  { tip: false, text: 'If found, please return to Gary. Gary is a crab. Gary cannot read.' },
  { tip: false, text: 'Day 43. The seagull has accepted me as one of its own. I have accepted the seagull.' },
  { tip: false, text: 'Roses are red, the sea is deep, I dropped my sandwich, and now I weep.' },
  { tip: false, text: 'SOS: Stuck On Sandbar. Not urgent. Lovely weather. Please send snacks.' },
  { tip: false, text: 'To whoever finds this: the fish are not biting. Please send more fish.' },
  { tip: false, text: 'Grandma’s famous chowder. Step one: catch a fish. Step two: (the rest of the page is wet).' },
  { tip: false, text: 'I am a message in a bottle. You are a person holding a bottle. We have both had quite a day.' },
  { tip: false, text: 'Note to self: the big one did not get away. The big one was a boot.' },
];

/**
 * Pick the next bottle note: never repeats until every note has been read once.
 * @param {number[]} read  indices already read (mutated: the chosen index is appended)
 * @param {() => number} rand  0..1
 * @returns {string}
 */
export function nextBottleNote(read, rand) {
  const n = BOTTLE_NOTES.length;
  let unread = [];
  for (let i = 0; i < n; i++) if (!read.includes(i)) unread.push(i);
  if (!unread.length) {
    read.length = 0;
    unread = BOTTLE_NOTES.map((_, i) => i);
  }
  const idx = unread[Math.min(unread.length - 1, Math.floor(rand() * unread.length))];
  read.push(idx);
  return BOTTLE_NOTES[idx].text;
}

export function chestNote(coins, lureName) {
  return lureName
    ? `Inside: ${coins.toLocaleString('en-US')} gold doubloons… and a brand-new ${lureName}!`
    : `Inside: ${coins.toLocaleString('en-US')} gold doubloons, a bent spoon and a very surprised crab.`;
}

export function pearlNote(coins) {
  return `A flawless pearl the size of a marble, worth ${coins.toLocaleString('en-US')} coins.`;
}
