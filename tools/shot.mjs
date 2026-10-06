#!/usr/bin/env node
// Headless screenshot + smoke-test tool (dev only). Uses the system Chrome via puppeteer-core.
//
//   node tools/shot.mjs <url-or-path> <out.png> [options]
//
//   <url-or-path>   e.g. "/?mode=play&time=18.5" or "dev/gallery.html?set=bony"  (served from http://localhost:5173)
//   --w 1920 --h 1080   viewport size (CSS px)            --dpr 1     device pixel ratio
//   --wait 1500         ms to wait after load before the shot
//   --eval "js"         JS evaluated in the page right after load (before the wait). May be async.
//   --after "js"        JS evaluated after the wait, right before the screenshot.
//   --keys "Space:600,KeyD:1200"   press+hold keys sequentially (code:holdMs) after load, before the wait
//   --clip x,y,w,h      capture only a region (CSS px)
//   --series N --every 500   take N shots (out-0.png, out-1.png, ...) every 500 ms after the wait
//   --script file.mjs   custom flow: export default async ({page, shot, sleep}) => {...}  (shot(name) saves a PNG next to <out>)
//   --quiet             do not print console.log lines from the page (errors are always printed)
//   --fps               print the average FPS the page achieved during the wait
//
// Exit code is 1 when the page threw an uncaught error (so it doubles as a smoke test).
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
if (argv.length < 2) {
  console.error('usage: node tools/shot.mjs <url-or-path> <out.png> [--w 1920 --h 1080 --wait 1500 --eval "js" --after "js" --keys "Space:600" --series N --every ms --script f.mjs --fps --quiet]');
  process.exit(2);
}
const [target, outFile] = argv;
const opt = (name, def) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] !== undefined ? argv[i + 1] : def;
};
const flag = (name) => argv.includes(name);

const W = Number(opt('--w', 1920));
const H = Number(opt('--h', 1080));
const DPR = Number(opt('--dpr', 1));
const WAIT = Number(opt('--wait', 1500));
const BASE = process.env.FISHUP_URL || 'http://localhost:5173';
const url = /^https?:/.test(target) ? target : BASE + (target.startsWith('/') ? '' : '/') + target;

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const executablePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!executablePath) {
  console.error('No Chrome found. Set CHROME_PATH.');
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fishup-shot-'));
let hadError = false;

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir,
  args: [
    `--window-size=${W},${H}`,
    '--hide-scrollbars',
    '--mute-audio',
    '--autoplay-policy=no-user-gesture-required',
    '--enable-gpu',
    '--ignore-gpu-blocklist',
    '--use-angle=metal',
    '--enable-webgl',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
  defaultViewport: { width: W, height: H, deviceScaleFactor: DPR },
});

try {
  const page = await browser.newPage();
  page.on('console', (msg) => {
    const type = msg.type();
    if (type === 'error') {
      console.log('[page error]', msg.text());
    } else if (type === 'warning' || type === 'warn') {
      if (!flag('--quiet')) console.log('[page warn]', msg.text());
    } else if (!flag('--quiet')) {
      console.log('[page]', msg.text());
    }
  });
  page.on('pageerror', (err) => {
    hadError = true;
    console.log('[UNCAUGHT]', err && err.stack ? err.stack : String(err));
  });
  page.on('requestfailed', (req) => {
    console.log('[request failed]', req.url(), req.failure() && req.failure().errorText);
  });
  page.on('response', (res) => {
    if (res.status() >= 400) console.log(`[http ${res.status()}]`, res.url());
  });

  await page.goto(url, { waitUntil: 'load', timeout: 30000 });

  const outDir = path.dirname(path.resolve(outFile));
  fs.mkdirSync(outDir, { recursive: true });
  const clipArg = opt('--clip', null);
  const clip = clipArg ? (([x, y, width, height]) => ({ x, y, width, height }))(clipArg.split(',').map(Number)) : undefined;
  const shot = async (file) => {
    const p = path.isAbsolute(file) ? file : path.join(outDir, file);
    await page.screenshot({ path: p, clip });
    console.log('saved', p);
    return p;
  };

  const evalJs = opt('--eval', null);
  if (evalJs) {
    const r = await page.evaluate(`(async () => { ${evalJs} })()`);
    if (r !== undefined) console.log('[eval]', JSON.stringify(r));
  }

  const keys = opt('--keys', null);
  if (keys) {
    for (const part of keys.split(',')) {
      const [code, ms] = part.split(':');
      if (/^\d+$/.test(code)) { await sleep(Number(code)); continue; } // bare number = pause
      await page.keyboard.down(code);
      await sleep(Number(ms || 80));
      await page.keyboard.up(code);
    }
  }

  const script = opt('--script', null);
  if (script) {
    const mod = await import(pathToFileURL(path.resolve(script)).href);
    await mod.default({ page, shot, sleep, browser });
  } else {
    if (flag('--fps')) {
      await page.evaluate(() => {
        window.__fpsN = 0;
        const tick = () => { window.__fpsN++; requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        window.__fpsT0 = performance.now();
      });
    }
    await sleep(WAIT);
    if (flag('--fps')) {
      const fps = await page.evaluate(() => (window.__fpsN * 1000) / (performance.now() - window.__fpsT0));
      console.log('[fps]', fps.toFixed(1));
    }
    const afterJs = opt('--after', null);
    if (afterJs) {
      const r = await page.evaluate(`(async () => { ${afterJs} })()`);
      if (r !== undefined) console.log('[after]', JSON.stringify(r));
      await sleep(60);
    }
    const series = Number(opt('--series', 0));
    if (series > 0) {
      const every = Number(opt('--every', 500));
      const ext = path.extname(outFile);
      const stem = outFile.slice(0, -ext.length);
      for (let i = 0; i < series; i++) {
        await shot(`${path.resolve(stem)}-${i}${ext}`);
        if (i < series - 1) await sleep(every);
      }
    } else {
      await shot(path.resolve(outFile));
    }
  }
} catch (e) {
  hadError = true;
  console.error('[shot failed]', e && e.stack ? e.stack : e);
} finally {
  await browser.close().catch(() => {});
  fs.rmSync(userDataDir, { recursive: true, force: true });
}
process.exit(hadError ? 1 : 0);
