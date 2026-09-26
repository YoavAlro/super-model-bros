// Smoke test: drives the built game with Playwright at desktop size and in an iPhone landscape
// viewport, completes the given levels through the ?debug hooks, and saves screenshots.
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/smoke.mjs gpt-2-1 claude-2-2        # or: node scripts/smoke.mjs all
//
// Env: SMOKE_URL (default http://localhost:4173/), SMOKE_OUT (default ./smoke-shots),
//      SMOKE_VIEWPORTS=desktop,phone
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = require('/opt/node22/lib/node_modules/playwright'));
}

const BASE = process.env.SMOKE_URL ?? 'http://localhost:4173/';
const OUT = process.env.SMOKE_OUT ?? 'smoke-shots';
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = {
  desktop: { viewport: { width: 1280, height: 720 } },
  phone: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const wanted = (process.env.SMOKE_VIEWPORTS ?? 'desktop,phone').split(',');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(page, fn, arg, timeout = 30000, every = 250) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const v = await page.evaluate(fn, arg).catch(() => null);
    if (v) return v;
    await sleep(every);
  }
  return null;
}

/** Plays one level from its intro card to its outro card. */
async function completeLevel(page, id, tag) {
  await page.goto(`${BASE}?debug&level=${id}&flags=shadowBooks`);
  const intro = await waitFor(page, () => window.__smb?.card?.());
  if (!intro) throw new Error(`${id}: no intro card`);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-intro.png` });
  await page.evaluate(() => window.__smb.next());
  await waitFor(page, () => window.__smb.state() === 'playing');
  await sleep(600);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-play.png` });
  await page.evaluate(() => window.__smb.invincible());

  const flag = await page.evaluate(() => window.__smb.flag());
  if (flag) {
    await page.evaluate((f) => window.__smb.teleport(f.x - 6, f.y + 3), flag);
    await page.keyboard.down('ArrowRight');
    const done = await waitFor(page, () => ['clear', 'done'].includes(window.__smb.state()) || !!window.__smb.card(), null, 20000);
    await page.keyboard.up('ArrowRight');
    if (!done) throw new Error(`${id}: never reached the flag`);
  } else {
    // Boss level: fly to the arena, then stomp every boss until the level clears. Holding the
    // power button with the cape keeps the player thinking, which reveals the Hallucination King.
    await page.evaluate(() => window.__smb.give('cape'));
    await page.keyboard.down('KeyS');
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) {
      const state = await page.evaluate(() => window.__smb.state());
      if (state === 'clear' || state === 'done' || state === null) break;
      const boss = await page.evaluate(() => (window.__smb.bosses() ?? []).find((b) => b.hp > 0));
      if (!boss) {
        await sleep(300);
        continue;
      }
      await page.evaluate(() => window.__smb.stomp());
      await sleep(700);
    }
    await page.keyboard.up('KeyS');
    await page.screenshot({ path: `${OUT}/${tag}-${id}-boss.png` });
  }
  const outro = await waitFor(page, () => window.__smb.card(), null, 20000);
  if (!outro) throw new Error(`${id}: no outro card`);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-outro.png` });
  // A finale's outro leads to the path recap.
  if (/path is complete/.test(await page.evaluate(() => document.querySelector('.modal-date')?.textContent ?? ''))) {
    await sleep(500);
    await page.evaluate(() => window.__smb.next());
    const recap = await waitFor(page, () => (window.__smb.card() ?? '').includes('complete!') && window.__smb.card(), null, 8000);
    if (!recap) throw new Error(`${id}: no recap after the finale`);
    await sleep(400);
    await page.screenshot({ path: `${OUT}/${tag}-${id}-recap.png` });
    return `${outro} → ${recap}`;
  }
  return outro;
}

const browser = await chromium.launch();
let failures = 0;
for (const tag of wanted) {
  const context = await browser.newContext(VIEWPORTS[tag]);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}?debug`);
  await sleep(800);
  await page.screenshot({ path: `${OUT}/${tag}-title.png` });
  let ids = process.argv.slice(2);
  if (ids[0] === 'all') ids = (await page.evaluate(() => window.__smbLevelIds?.())) ?? [];

  for (const id of ids) {
    try {
      const outro = await completeLevel(page, id, tag);
      console.log(`${tag} ${id}: ok (${outro})`);
    } catch (e) {
      failures++;
      console.log(`${tag} ${id}: FAIL ${e.message}`);
      await page.screenshot({ path: `${OUT}/${tag}-${id}-fail.png` });
    }
  }
  if (errors.length) {
    failures++;
    console.log(`${tag}: console errors:\n  ${errors.join('\n  ')}`);
  }
  await context.close();
}
await browser.close();
console.log(failures ? `SMOKE FAILED (${failures})` : 'SMOKE OK');
process.exit(failures ? 1 : 0);
