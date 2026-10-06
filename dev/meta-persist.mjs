// META persistence test — a --script for tools/shot.mjs (WITHOUT nosave; shot.mjs gives each run a fresh profile):
//   node tools/shot.mjs "/?mode=play&off=ui,audio,postfx&debug=1" /tmp/meta-persist.png --script dev/meta-persist.mjs
// Plays a little, lets the debounced AUTOSAVE write (no explicit save()), reloads the page in the same browser
// session and checks the profile came back; then pagehide flush, a corrupted save and reset().

const SAVE_KEY = 'fishup.save.v1';
const ready = (page) => page.waitForFunction(() => window.__game && window.__game.progression, { timeout: 15000 });

export default async function ({ page, shot, sleep }) {
  const fails = [];
  const ok = (c, m) => { if (!c) fails.push(m); else console.log('  ✓ ' + m); };

  // ── session 1: play, autosave ──
  await ready(page);
  const s1 = await page.evaluate(async (KEY) => {
    const g = window.__game, prog = g.progression;
    const { createFish } = await import('/src/entities/fishbase.js');
    const before = { hasSave: prog.hasSave(), stored: localStorage.getItem(KEY) };
    g.boat.x = 1800;
    for (const [id, q] of [['clownfish', 0.6], ['blue_tang', 0.3], ['yellowtail_snapper', 0.8]]) {
      g.events.emit('catch', { fish: createFish(id, { sizeQ: q }), hookQuality: 'good', fightTime: 4, streak: 1, depthM: 35 });
    }
    prog.cheat('coins', 2000);
    prog.buy('line_mono');
    prog.buy('lure_shrimp');
    prog.buy('rod_fiberglass');
    prog.buy('gad_sinkers');
    prog.equip('rod_bamboo'); // keep an older rod equipped: equipped ≠ best owned must survive the reload
    g.events.emit('newDay', { day: 2 });
    const P = g.player;
    return {
      before,
      snap: {
        coins: P.coins, xp: P.xp, level: P.level, lureId: P.lureId, lures: [...P.lures], gear: { ...P.gear }, owned: [...P.owned],
        dex: Object.fromEntries(Object.entries(P.dex).map(([k, v]) => [k, v.count])), quests: prog.getQuests().map((q) => q.id + ':' + q.progress),
        day: P.day, caught: P.totals.caught, stats: { ...P.stats },
      },
    };
  }, SAVE_KEY);
  ok(!s1.before.hasSave && !s1.before.stored, 'fresh browser profile: no save before playing');
  await sleep(2200); // > the 1.2 s autosave debounce
  const stored = await page.evaluate((KEY) => localStorage.getItem(KEY), SAVE_KEY);
  ok(!!stored && JSON.parse(stored).v === 1, `autosave wrote localStorage["${SAVE_KEY}"] (${stored ? stored.length : 0} bytes)`);

  // ── session 2: reload, compare ──
  await page.reload({ waitUntil: 'load' });
  await ready(page);
  const s2 = await page.evaluate(() => {
    const g = window.__game, prog = g.progression, P = g.player;
    return {
      hasSave: prog.hasSave(),
      snap: {
        coins: P.coins, xp: P.xp, level: P.level, lureId: P.lureId, lures: [...P.lures], gear: { ...P.gear }, owned: [...P.owned],
        dex: Object.fromEntries(Object.entries(P.dex).map(([k, v]) => [k, v.count])), quests: prog.getQuests().map((q) => q.id + ':' + q.progress),
        day: P.day, caught: P.totals.caught, stats: { ...P.stats },
      },
      fishingLure: g.fishing.lure.id,
    };
  });
  ok(s2.hasSave, 'hasSave() true after reload');
  for (const k of Object.keys(s1.snap)) ok(JSON.stringify(s1.snap[k]) === JSON.stringify(s2.snap[k]), `reload restores ${k}: ${JSON.stringify(s2.snap[k]).slice(0, 90)}`);
  ok(s2.fishingLure === s1.snap.lureId, 'selected lure mirrored to game.fishing after reload');

  // ── pagehide flushes immediately (no waiting for the debounce) ──
  const flushed = await page.evaluate(async (KEY) => {
    const g = window.__game;
    const { createFish } = await import('/src/entities/fishbase.js');
    g.events.emit('catch', { fish: createFish('moorish_idol', { sizeQ: 0.5 }), hookQuality: 'perfect', streak: 2, depthM: 30 });
    window.dispatchEvent(new Event('pagehide'));
    const saved = JSON.parse(localStorage.getItem(KEY));
    return saved.player.dex.moorish_idol ? saved.player.dex.moorish_idol.count : 0;
  }, SAVE_KEY);
  ok(flushed === 1, 'pagehide writes the save at once');

  // ── corrupted save → fresh profile, no crash, raw copy kept ──
  // (planted before the next document's scripts run: the old page's pagehide flush would otherwise
  //  — correctly — overwrite it with the live, valid profile)
  await page.evaluateOnNewDocument((KEY) => {
    if (sessionStorage.getItem('meta-corrupt-planted')) return;
    sessionStorage.setItem('meta-corrupt-planted', '1');
    localStorage.setItem(KEY, '{"v":1,"player":{"coins":12');
  }, SAVE_KEY);
  await page.reload({ waitUntil: 'load' });
  await ready(page);
  await sleep(300);
  const s3 = await page.evaluate(async (KEY) => {
    const f0 = window.__game.time.frame;
    await new Promise((r) => setTimeout(r, 800));
    return {
      coins: window.__game.player.coins, level: window.__game.player.level, quests: window.__game.progression.getQuests().length,
      backup: localStorage.getItem(KEY + '.corrupt'), framesAdvanced: window.__game.time.frame - f0,
    };
  }, SAVE_KEY);
  ok(s3.coins === 0 && s3.level === 1 && s3.quests === 3 && s3.framesAdvanced > 0, `corrupted save → game boots with a fresh profile and keeps running (${JSON.stringify({ ...s3, backup: undefined })})`);
  ok(s3.backup === '{"v":1,"player":{"coins":12', 'unreadable save kept in .corrupt');

  // ── reset() wipes the save ──
  const s4 = await page.evaluate(async (KEY) => {
    const g = window.__game, prog = g.progression;
    const { createFish } = await import('/src/entities/fishbase.js');
    g.events.emit('catch', { fish: createFish('clownfish', { sizeQ: 0.5 }), hookQuality: 'good', streak: 1, depthM: 30 });
    prog.save();
    const had = !!localStorage.getItem(KEY);
    let fired = false;
    const off = g.events.on('profileReset', () => (fired = true));
    prog.reset();
    off();
    return { had, fired, after: localStorage.getItem(KEY), hasSave: prog.hasSave(), coins: g.player.coins, dex: Object.keys(g.player.dex).length };
  }, SAVE_KEY);
  ok(s4.had && s4.fired && s4.after === null && !s4.hasSave && s4.coins === 0 && s4.dex === 0, 'reset() wipes the save, emits profileReset');
  await sleep(1600);
  const s5 = await page.evaluate((KEY) => localStorage.getItem(KEY), SAVE_KEY);
  ok(s5 === null, 'no save re-created for an untouched fresh profile');

  await shot('meta-persist.png');
  if (fails.length) throw new Error('META persistence FAILED:\n  - ' + fails.join('\n  - '));
  console.log('META persistence: all checks passed');
}
