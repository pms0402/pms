import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against an already-started dev/preview server. No browser binaries are downloaded.
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const baseURL = process.env.BASE_URL || 'http://localhost:5173';
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await manualPage(context);
page.on('pageerror', (error) => errors.push(error.message));
const phase = () => page.evaluate(() => window.__game.state.phase);
const modalVisible = () => page.locator('#modal-backdrop').isVisible();

try {
  await page.goto(baseURL);
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal(await phase(), 'menu');
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  assert.ok(await page.locator('#game-canvas canvas').isVisible());

  await page.locator('.main-nav [data-nav="guide"]').click();
  assert.equal(await modalVisible(), true);
  assert.equal(await page.locator('#modal').evaluate((el) => document.activeElement === el), true);
  await page.keyboard.press('Escape');
  assert.equal(await modalVisible(), false);
  assert.equal(await page.locator('.main-nav [data-nav="guide"]').evaluate((el) => document.activeElement === el), true);

  await page.locator('.main-nav [data-nav="history"]').click();
  assert.ok(await page.locator('.empty-history').isVisible());
  await page.locator('#history-start').click();
  assert.equal(await phase(), 'playing');
  assert.equal(await modalVisible(), false);
  assert.equal(await page.locator('#live-hud').isVisible(), true);
  console.log('PASS desktop: WebGL scene, guide focus/close, empty history and first-run start');

  await page.locator('#pause-button').click();
  assert.equal(await phase(), 'paused');
  assert.equal(await page.locator('.modal-pause').isVisible(), true);
  const pausedTime = await page.evaluate(() => window.__game.state.elapsed);
  await page.evaluate(() => window.__game.stepForTest(0.5));
  assert.equal(await page.evaluate(() => window.__game.state.elapsed), pausedTime);
  await page.locator('#resume').click();
  assert.equal(await phase(), 'playing');
  await page.keyboard.press('Escape');
  assert.equal(await phase(), 'paused');
  await page.keyboard.press('Escape');
  assert.equal(await phase(), 'playing');
  assert.equal(await modalVisible(), false);
  console.log('PASS desktop: pause button, frozen simulation, resume and Escape toggle');

  await page.locator('#settings').click();
  assert.equal(await phase(), 'paused');
  await page.locator('#setting-sound').click();
  assert.equal(await page.locator('#setting-sound').getAttribute('aria-checked'), 'true');
  await page.locator('[data-quality="low"]').click();
  assert.equal(await page.evaluate(() => window.__game.quality), 'low');
  assert.equal(await page.evaluate(() => window.__game.renderer.shadowMap.enabled), false);
  await page.locator('#modal-close').click();
  assert.equal(await phase(), 'playing');
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.preferences'))), { muted: false, quality: 'low', risk: 'none', viewMode:'third' });
  assert.equal(await page.locator('#sound-toggle').getAttribute('aria-label'), '사운드 끄기');
  assert.equal(await page.evaluate(() => window.__game.quality), 'low');
  console.log('PASS desktop: sound/quality preferences persist after reload and activate renderer settings');

  await page.locator('#start-button').click();
  // Create an actual contact hit; do not call the UI result callback or manufacture a record.
  // The low-health fixture shortens this flow without changing application logic.
  await page.evaluate(() => {
    const game = window.__game;
    // Stay clear of an attack boundary so a random critical hit cannot remove the fixture first.
    if (game.attackTimer < 0.05) game.stepForTest(0.1);
    game._state.hp = 1;
    const e=game.spawnEnemy(game.player.position.x + 0.1, game.player.position.z, 2);
    window.testEnemyStrike(game,e);
  });
  assert.equal(await phase(), 'over');
  assert.equal(await page.locator('.modal-result').isVisible(), true);
  const record = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.history')));
  assert.equal(record.length, 1);
  assert.equal(record[0].won, false);
  assert.equal(record[0].stage, 1);
  assert.equal(await page.locator('#history-count').textContent(), '01');
  await page.locator('#retry').click();
  assert.equal(await phase(), 'playing');
  assert.equal(await modalVisible(), false);
  assert.equal(await page.evaluate(() => window.__game.state.kills), 0);
  await page.locator('.main-nav [data-nav="history"]').click();
  assert.equal(await page.locator('.history-row:not(.history-head)').count(), 1);
  assert.equal(await phase(), 'paused');
  await page.locator('#modal-close').click();
  assert.equal(await phase(), 'playing');
  console.log('PASS desktop: contact damage → game over → persisted history → retry');
  await context.close();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const phone = await mobile.newPage();
  phone.on('pageerror', (error) => errors.push(error.message));
  await phone.goto(baseURL);
  await phone.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, 'mobile page must not overflow horizontally');
  await phone.locator('#start-button').tap();
  assert.equal(await phone.evaluate(() => window.__game.state.phase), 'playing');
  assert.equal(await phone.locator('#touch-controls').isVisible(), true);
  const right = await phone.locator('[data-move="1,0"]').boundingBox();
  assert.ok(right && right.width > 0 && right.x + right.width <= 390);
  const session = await mobile.newCDPSession(phone);
  const before = await phone.evaluate(() => window.__game.getDebugState().player);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2 }] });
  await phone.evaluate(() => window.__game.stepForTest(0.25));
  const after = await phone.evaluate(() => window.__game.getDebugState().player);
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 0.5, 'touch direction button moves player');
  assert.deepEqual(await phone.evaluate(() => window.__game.touchMove), { x: 0, y: 0 }, 'touch release stops movement');
  await phone.locator('#touch-dash').tap();
  assert.ok(await phone.evaluate(() => window.__game.state.dashCooldown > 0), 'touch dash starts cooldown');
  assert.equal(await phone.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  await phone.locator('#pause-button').tap();
  await phone.locator('#pause-settings').tap();
  assert.equal(await phone.locator('.modal-settings').isVisible(), true);
  assert.equal(await phone.evaluate(() => window.__game.state.phase), 'paused');
  await phone.locator('#modal-close').tap();
  assert.equal(await phone.evaluate(() => window.__game.state.phase), 'playing');
  await mobile.close();
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS mobile (390px): no horizontal overflow, real touch movement/release, dash and modal pause/resume');
  console.log('All browser smoke checks passed.');
} finally {
  await browser.close();
}
