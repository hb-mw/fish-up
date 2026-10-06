// End-to-end playtest with EVERY module on (real fish AI, UI catch card, progression, effects, audio).
//   node tools/shot.mjs "/?mode=play&nosave=1&x=1750&time=10&tips=0" out.png --script dev/playtest.mjs
// Env: PT_CATCHES=3 (stop after N catches) · PT_MAX=300 (max game seconds) · PT_SCALE=2 (time scale) · PT_SHOTS=1 (screenshots)
export default async ({ page, shot, sleep }) => {
  const want = Number(process.env.PT_CATCHES || 3);
  const maxT = Number(process.env.PT_MAX || 300);
  const scale = Number(process.env.PT_SCALE || 2);
  const shots = process.env.PT_SHOTS === '1';
  await page.waitForFunction(() => window.__game && __game.mods.fishingCtl && __game.fish && __game.fish.scan, { timeout: 20000 });
  await page.evaluate((sc) => {
    const g = window.__game;
    g.time.scale = sc;
    window.__pt = { events: [], catches: [], scored: [], errors: [] };
    for (const n of ['cast', 'lureSplash', 'bite', 'hookSet', 'hookMiss', 'fightStart', 'run', 'jump', 'lineSnap', 'escape', 'predatorStrike', 'landed', 'catch', 'catchScored', 'catchDismissed', 'levelUp', 'coins', 'questComplete', 'toast']) {
      g.events.on(n, (p) => {
        window.__pt.events.push([g.time.now.toFixed(1), n, p && p.fish ? p.fish.speciesId : p && p.record ? p.record.speciesId : p && p.text ? p.text : '']);
        if (n === 'catch') window.__pt.catches.push({ id: p.fish.speciesId, kg: +p.fish.weightKg.toFixed(2), q: p.hookQuality, t: +p.fightTime.toFixed(1), depth: +p.depthM.toFixed(0) });
        if (n === 'catchScored') window.__pt.scored.push({ id: p.record.speciesId, pts: p.record.points, coins: p.record.coins, xp: p.record.xp, size: p.record.sizeClass && p.record.sizeClass.name, isNew: p.record.isNew });
      });
    }
  }, scale);

  if (process.env.PT_SETUP) {
    await page.evaluate((spec) => {
      const g = window.__game, p = g.progression;
      if (!p) return;
      for (const part of spec.split(',')) {
        const [k, v] = part.split(':');
        if (k === 'buy') console.log('[playtest] buy', v, JSON.stringify(p.buy(v)));
        else if (k === 'lure') console.log('[playtest] lure', v, p.selectLure(v));
        else p.cheat(k, v === undefined ? undefined : Number(v));
      }
    }, process.env.PT_SETUP);
  }
  const state = () => page.evaluate(() => {
    const g = window.__game, f = g.fishing;
    return { s: f.state, t: g.time.now, tension: f.tension, biteT: f.biteT, win: f.biteWindow, hooked: f.hooked && f.hooked.speciesId, open: g.ui.isOpen && g.ui.isOpen(), errs: [...g.errors].map(([k, v]) => k + ' ' + v.msg) };
  });
  const hold = (a, on) => page.evaluate(([a, on]) => window.__game.input.setVirtual(a, on), [a, on]);
  const tap = (a) => page.evaluate((a) => window.__game.input.tap(a), a);

  let catches = 0, shotN = 0, lastCast = -99, lastTwitch = -99, reeling = false;
  const t0 = (await state()).t;
  while (catches < want) {
    const st = await state();
    if (st.t - t0 > maxT) break;
    if (st.errs.length) { console.log('[playtest] module errors:', st.errs.join(' | ')); break; }
    if (st.s === 'idle' && !st.open) {
      if (st.t - lastCast > 1.5) {
        await hold('action', true); await sleep(700); await hold('action', false);
        lastCast = st.t;
      }
    } else if (st.s === 'waiting') {
      // a single twitch every ~5 s; let it sink otherwise
      if (st.t - lastTwitch > 5) { lastTwitch = st.t; await tap('action'); }
    } else if (st.s === 'bite') {
      await tap('action');
      if (shots) await shot(`pt-${++shotN}-bite.png`);
    } else if (st.s === 'fight') {
      const wantReel = st.tension < 0.8 || (reeling && st.tension < 0.92);
      if (wantReel !== reeling) { reeling = wantReel; await hold('action', reeling); }
      if (shots && shotN < 6 && Math.random() < 0.05) await shot(`pt-${++shotN}-fight.png`);
    } else if (st.s === 'caught') {
      if (reeling) { reeling = false; await hold('action', false); }
      await sleep(1400);
      if (shots) await shot(`pt-${++shotN}-card.png`);
      await page.keyboard.press('Enter');
      await sleep(400);
      catches = await page.evaluate(() => window.__pt.scored.length);
    } else if (st.s === 'broken') {
      if (reeling) { reeling = false; await hold('action', false); }
    }
    await sleep(90);
  }
  if (reeling) await hold('action', false);
  const r = await page.evaluate(() => ({ ...window.__pt, player: { coins: __game.player.coins, xp: __game.player.xp, level: __game.player.level, score: __game.player.score }, fps: __game.time.fps.toFixed(0) }));
  console.log(`[playtest] catches ${r.catches.length}/${want}  scored ${r.scored.length}  level ${r.player.level}  coins ${r.player.coins}  score ${r.player.score}  fps ${r.fps}`);
  for (const c of r.catches) console.log('  catch ', JSON.stringify(c));
  for (const c of r.scored) console.log('  scored', JSON.stringify(c));
  console.log('  events:', r.events.map((e) => `${e[0]}s ${e[1]}${e[2] ? '(' + e[2] + ')' : ''}`).join(' → '));
  if (r.catches.length !== r.scored.length) console.log('[playtest] MISMATCH catches vs catchScored');
  if (shots) await shot('pt-final.png');
};
