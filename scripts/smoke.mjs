// Smoke test: drives the built game with Playwright at desktop size and in an iPhone landscape
// viewport, completes the given levels through the ?debug hooks, and saves screenshots.
//
//   npm run build && npx vite preview --port 4173 &
//   node scripts/smoke.mjs gpt-2-1 claude-2-2        # or: node scripts/smoke.mjs all
//   node scripts/smoke.mjs kart-arc char:llama       # a Benchmark Kart race; a level played as a character
//   node scripts/smoke.mjs path:gpt path:claude      # a whole path in one session, start to recap
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
  return playLevel(page, id, tag);
}

/** Plays the level whose intro card is up (or about to be). */
async function playLevel(page, id, tag) {
  const intro = await waitFor(page, () => window.__smb?.card?.());
  if (!intro) throw new Error(`${id}: no intro card`);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-intro.png` });
  await page.evaluate(() => window.__smb.next());
  await waitFor(page, () => window.__smb.state() === 'playing');
  await sleep(600);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-play.png` });
  await page.evaluate(() => window.__smb.invincible());

  // Draw budget (whole frame, cast included): the phone must stay under 120 calls and 250k triangles
  // on the level's busiest screen, not just its first. Sweep the camera across the whole level in
  // 6-tile steps; Stage keeps the most calls and triangles of any frame since the level was built.
  const flag = await page.evaluate(() => window.__smb.flag());
  const end = flag ? flag.x - 6 : ((await page.evaluate(() => window.__smb.width?.())) ?? 0) - 10;
  for (let x = 4; x < end; x += 6) {
    await page.evaluate((x) => window.__smb.teleport(x, 10), x);
    await sleep(350);
  }
  const draws = await page.evaluate(() => window.__smb.draws());
  if (draws) {
    console.log(`${tag} ${id}: ${draws.calls} draw calls at the flag run, ${draws.maxCalls} at most (${draws.maxTriangles} triangles)`);
    if (tag === 'phone' && (draws.maxCalls > 120 || draws.maxTriangles > 250000)) {
      throw new Error(`${id}: over the phone draw budget (${draws.maxCalls} calls, ${draws.maxTriangles} triangles at the busiest screen)`);
    }
  }

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

/** Plays a Benchmark Kart race from its intro card to its results card. */
async function completeKart(page, id, tag) {
  await page.goto(`${BASE}?debug&kart=${id}`);
  const intro = await waitFor(page, () => window.__smb?.card?.());
  if (!intro) throw new Error(`${id}: no race card`);
  await page.evaluate(() => window.__smb.next());
  const racing = await waitFor(page, () => window.__smb.kartState()?.state === 'racing', null, 20000);
  if (!racing) throw new Error(`${id}: the race never started`);
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-race.png` });
  await page.evaluate(() => window.__smb.kartFinish());
  const result = await waitFor(page, () => window.__smb.card(), null, 20000);
  if (!result) throw new Error(`${id}: no results card`);
  await page.screenshot({ path: `${OUT}/${tag}-${id}-result.png` });
  return result;
}

/** What each unlockable's trait does when you press the power button (or just by playing). */
const TRAIT_CHECKS = {
  seeHidden: null,
  efficient: null,
  airDash: null,
  dropCopy: () => window.__smb.copies() > 0,
  cloud: () => window.__smb.platforms().length > 0,
};

/** Plays World 2-1 as an unlockable character: its trait works, and the level can be finished. */
async function completeAsCharacter(page, char, tag) {
  await page.goto(`${BASE}?debug&level=gpt-2-1&char=${char}`);
  if (!(await waitFor(page, () => window.__smb?.card?.()))) throw new Error(`${char}: no intro card`);
  await page.evaluate(() => window.__smb.next());
  await waitFor(page, () => window.__smb.state() === 'playing');
  const trait = await page.evaluate(() => window.__smb.trait());
  const check = TRAIT_CHECKS[trait];
  if (check) {
    await page.keyboard.press('KeyS');
    await sleep(500);
    if (!(await page.evaluate(check))) throw new Error(`${char}: the ${trait} trait did nothing`);
  }
  await page.screenshot({ path: `${OUT}/${tag}-char-${char}.png` });
  await page.evaluate(() => window.__smb.invincible());
  const flag = await page.evaluate(() => window.__smb.flag());
  await page.evaluate((f) => window.__smb.teleport(f.x - 6, f.y + 3), flag);
  await page.keyboard.down('ArrowRight');
  const done = await waitFor(page, () => !!window.__smb.card() && window.__smb.state() !== 'playing', null, 20000);
  await page.keyboard.up('ArrowRight');
  if (!done) throw new Error(`${char}: never reached the flag`);
  return `${trait}, ${await page.evaluate(() => window.__smb.card())}`;
}

/**
 * Plays a whole path in one session, from its first level to the recap: every level, every card
 * between them (unlocks, world breaks) and every Benchmark Kart race. Logs renderer memory per level
 * so a leak shows up as steady growth.
 */
async function completePath(page, path, tag) {
  const ids = (await page.evaluate(() => window.__smbLevelIds?.())) ?? [];
  const first = ids.find((id) => id.startsWith(`${path}-`));
  await page.goto(`${BASE}?debug&path=${path}&level=${first}${path === 'claude' ? '&flags=shadowBooks' : ''}`);
  const memory = [];
  for (let guard = 0; guard < 400; guard++) {
    const card = await waitFor(page, () => window.__smb?.card?.(), null, 30000);
    if (!card) throw new Error(`${path}: stuck with no card (after ${memory.length} levels)`);
    if (card.includes('path complete!')) {
      await page.screenshot({ path: `${OUT}/${tag}-path-${path}-recap.png` });
      const perf = memory.map((m) => `${m.geometries}/${m.textures}`).join(' ');
      return `${memory.length} levels, recap "${card}"; geometries/textures per level: ${perf}`;
    }
    if (card.startsWith('Benchmark Kart')) {
      await page.evaluate(() => window.__smb.next());
      if (!(await waitFor(page, () => window.__smb.kartState?.()?.state === 'racing', null, 20000))) throw new Error(`${path}: race never started`);
      await page.evaluate(() => window.__smb.kartFinish());
      await waitFor(page, () => !window.__smb.kartState?.(), null, 20000);
      continue;
    }
    const level = await page.evaluate(() => window.__smb.level());
    const state = await page.evaluate(() => window.__smb.state());
    if (level && state === 'intro') {
      const outro = await playLevel(page, level, `${tag}-path`);
      memory.push(await page.evaluate(() => window.__smb.perf()));
      // The finale's outro already led to the recap.
      if (outro.includes('path complete!')) {
        await page.screenshot({ path: `${OUT}/${tag}-path-${path}-recap.png` });
        const perf = memory.map((m) => `${m.geometries}/${m.textures}`).join(' ');
        return `${memory.length} levels, ${outro}; geometries/textures after each level: ${perf}`;
      }
      continue;
    }
    await page.evaluate(() => window.__smb.next());
    await sleep(400);
  }
  throw new Error(`${path}: too many cards`);
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
  if (ids[0] === 'all') {
    ids = [
      ...((await page.evaluate(() => window.__smbLevelIds?.())) ?? []),
      ...((await page.evaluate(() => window.__smbKartIds?.())) ?? []),
      ...((await page.evaluate(() => window.__smbUnlockables?.())) ?? []).map((c) => `char:${c}`),
    ];
  }

  for (const id of ids) {
    try {
      const outro = id.startsWith('path:')
        ? await completePath(page, id.slice(5), tag)
        : id.startsWith('kart-')
        ? await completeKart(page, id, tag)
        : id.startsWith('char:')
          ? await completeAsCharacter(page, id.slice(5), tag)
          : await completeLevel(page, id, tag);
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
