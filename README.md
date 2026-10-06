# 🎣 Fish Up!

A side-view fishing game for the browser. Fifty real species (plus five things you'd rather not hook),
a 900 m deep ocean from a coral reef to a hydrothermal trench, a day/night cycle, weather, tension-based
fights, a tackle shop, quests and a Fishdex — all drawn and synthesised procedurally in plain JavaScript.
No build step, no runtime dependencies.

## Play

- **macOS:** double-click `Play Fish Up.command`.
- **Anywhere:** `npm start` (or `node tools/serve.mjs --open`), then open <http://localhost:5173/>.

| Action | Keys |
|---|---|
| Sail | **A / D** (or ← / →) |
| Cast | hold **SPACE** (or the mouse on the sea) to charge, release to cast |
| Lure in the water | hold **SPACE** to reel · tap to jig · **S** to drop deeper · **R** to retrieve |
| Bite (!) | press **SPACE** quickly — early = *perfect* hook |
| Fight | hold **SPACE** to reel, let go when the gauge turns red, ease off when it jumps |
| Lures | **1–9** / **E** (with the line in) |
| Panels | **B** shop · **F** Fishdex · **Q** quests · **Esc** pause · **M** mute |

Points = base points for the species' level (1–10) × a size multiplier, with bonuses for perfect hooks,
trophies, streaks and rare golden variants. Coins buy rods, reels, longer line (deeper water), lures,
boats and gadgets. Protected species are released for a conservation bonus.

## Development

- `?debug=1` shows an fps/layer profiler; other URL flags are listed at the top of `src/main.js`.
- `node tools/shot.mjs "<path?flags>" out.png` takes headless screenshots (needs Chrome);
  `node tools/smoke.mjs` runs the integration matrix; `dev/gallery.html` shows every creature.
- Layout: `src/core` (loop, camera, input), `src/world` (lighting, waves, terrain), `src/data`
  (species, lures, gear, quests), `src/entities` (fish AI, boat), `src/gameplay` (fishing, progression),
  `src/render` (sky, water, seabed, boat, creature art, effects, WebGL post-processing), `src/ui`,
  `src/audio`.
