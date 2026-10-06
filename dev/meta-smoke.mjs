// META browser smoke test — a --script for tools/shot.mjs:
//   node tools/shot.mjs "/?mode=play&nosave=1&off=ui,audio,postfx&debug=1" /tmp/meta-smoke.png --script dev/meta-smoke.mjs
// Emits fake 'catch' events with real fish entities and checks records, coins, level-ups, dex, quests and the
// catalogue → buy → equip flow inside the running game. Throws (→ exit code 1) when a check fails.

export default async function ({ page, shot, sleep }) {
  await page.waitForFunction(() => window.__game && window.__game.progression, { timeout: 15000 });
  await sleep(400);
  const res = await page.evaluate(async () => {
    const g = window.__game;
    const P = g.player;
    const prog = g.progression;
    const { createFish } = await import('/src/entities/fishbase.js');
    const out = { fails: [], notes: [] };
    const ok = (c, m) => { if (!c) out.fails.push(m); };
    const log = [];
    const off = g.events.on('*', (type, payload) => log.push([type, payload]));
    const lastRecord = () => { const e = log.filter((l) => l[0] === 'catchScored').pop(); return e && e[1].record; };

    ok(P.coins === 0 && P.level === 1 && P.stats.tackle === 1.5 && P.stats.lineLengthM === 60, 'fresh profile (nosave)');
    ok(prog.getQuests().length === 3, '3 quests');

    // 1. a reef clownfish
    g.boat.x = 1800;
    g.events.emit('catch', { fish: createFish('clownfish', { sizeQ: 0.5 }), hookQuality: 'perfect', fightTime: 2.5, maxTension: 0.4, streak: 1, depthM: 40 });
    let r = lastRecord();
    ok(r && r.speciesId === 'clownfish' && r.isNew && r.biome === 'reef' && r.points > 0 && r.coins > 0 && r.xp > 0, 'clownfish record');
    ok(P.coins === r.coins && P.dex.clownfish && P.dex.clownfish.count === 1, 'coins + dex updated');
    ok(log.map((l) => l[0]).join(',').startsWith('coins,xp,dexNew'), 'event order coins,xp,dexNew… got ' + log.map((l) => l[0]).join(','));
    out.notes.push(`clownfish: ${r.points} pts, ${r.coins} coins, ${r.xp} XP — ${r.breakdown.map((b) => b.label + ' ' + b.value).join(' | ')}`);

    // 2. a shiny trophy bluefin, deep and far out → big points, level-ups with unlocks
    g.boat.x = 8800;
    log.length = 0;
    g.events.emit('catch', { fish: createFish('bluefin_tuna', { sizeQ: 0.97, shiny: true }), hookQuality: 'perfect', fightTime: 41, maxTension: 1.1, streak: 4, depthM: 140 });
    r = lastRecord();
    ok(r.shiny && r.sizeClass.id === 'trophy' && r.breakdown.some((b) => b.label === 'Shiny!') && r.breakdown.some((b) => b.label.startsWith('Deep-sea premium')), 'shiny trophy bluefin breakdown');
    const lu = log.find((l) => l[0] === 'levelUp');
    ok(lu && lu[1].level > 1 && lu[1].unlocked.length > 0 && r.levelUp && r.levelUp.level === lu[1].level, 'levelUp with unlocks, mirrored on the record');
    out.notes.push(`bluefin: ${r.points} pts, ${r.coins} coins, ${r.xp} XP, level → ${P.level} (${r.levelUp && r.levelUp.title}); unlocked ${lu && lu[1].unlocked.length} items — ${r.breakdown.map((b) => b.label + ' ' + b.value).join(' | ')}`);

    // 3. a protected turtle and a bottle
    g.boat.x = 2200;
    g.events.emit('catch', { fish: createFish('sea_turtle', { sizeQ: 0.4 }), hookQuality: 'good', fightTime: 20, streak: 5, depthM: 25 });
    r = lastRecord();
    ok(r.released && r.protected, 'turtle released');
    g.events.emit('catch', { fish: createFish('message_bottle', { sizeQ: 0.5 }), hookQuality: 'good', streak: 6, depthM: 1 });
    r = lastRecord();
    ok(r.isItem && r.itemKind === 'bottle' && typeof r.note === 'string', 'bottle note');
    out.notes.push(`bottle: "${r.note}"`);

    // 4. shop
    const cat = prog.getCatalog();
    ok(cat.length >= 40 && cat.every((c) => c.id && c.slot && c.stats && typeof c.locked === 'boolean' && typeof c.affordable === 'boolean' && c.accent), 'catalogue shape');
    out.notes.push(`catalogue: ${cat.length} items; mono line stats ${JSON.stringify(cat.find((c) => c.id === 'line_mono').stats)}`);
    ok(prog.cheat('coins', 5000), 'cheat coins');
    log.length = 0;
    const b1 = prog.buy('line_mono');
    ok(b1.ok && P.stats.lineLengthM === 120 && P.gear.line === 'line_mono', 'buy 120 m line');
    ok(log.some((l) => l[0] === 'purchase') && log.some((l) => l[0] === 'equip') && log.some((l) => l[0] === 'coins' && l[1].delta < 0), 'purchase/equip/coins events');
    ok(prog.buy('lure_shrimp').ok && P.lureId === 'shrimp' && g.fishing.lure.id === 'shrimp', 'buy shrimp → selected and mirrored');
    ok(prog.buy('rod_leviathan').reason === 'level', 'locked rod refused');
    ok(prog.equip('line_cotton').ok && P.stats.lineLengthM === 60 && prog.equip('line_mono').ok, 'equip swaps lines');
    ok(prog.cycleLure() === 'worm' && prog.cycleLure() === 'shrimp', 'cycleLure');

    // 5. read APIs
    const dex = prog.getDex();
    ok(dex.length === 55 && dex.filter((d) => d.discovered).length === 4, 'dex: 55 entries, 4 discovered');
    const li = prog.getLevelInfo();
    ok(li.level === P.level && li.progress >= 0 && li.progress <= 1 && li.maxLevel === 30, 'level info');
    const sum = prog.getSummary();
    ok(sum.totalCaught === 3 && sum.speciesFound === 3 && sum.speciesTotal === 50 && sum.biggestCatch && sum.bestCatch.speciesId === 'bluefin_tuna', 'summary');
    const ach = prog.getAchievements();
    ok(ach.find((a) => a.id === 'first_catch').unlocked && ach.find((a) => a.id === 'shiny').unlocked && ach.find((a) => a.id === 'trophy').unlocked, 'achievements unlocked');
    ok(!prog.hasSave() && prog.save() === false, 'nosave: hasSave false, save() refuses');
    out.notes.push(`level ${li.level} ${li.title} ${li.xpIntoLevel}/${li.xpForLevel}; quests: ${prog.getQuests().map((q) => q.title + ' [' + q.progress + '/' + q.goal + ']').join(' · ')}`);
    out.errors = [...g.errors.entries()].map(([k, v]) => `${k}: ${v.msg}`);
    ok(!out.errors.some((e) => /progression/.test(e)), 'no progression errors in game.errors');
    off();
    return out;
  });
  for (const n of res.notes) console.log('  · ' + n);
  if (res.errors && res.errors.length) console.log('  game.errors:', res.errors.join(' ; '));
  await shot('meta-smoke.png');
  if (res.fails.length) throw new Error('META smoke FAILED:\n  - ' + res.fails.join('\n  - '));
  console.log('META smoke: all checks passed');
}
