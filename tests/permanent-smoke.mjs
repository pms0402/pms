import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Runtime fixtures shorten the run, but gold is collected, deaths use enemy
// collision, and wins use the real final-boss and stage-progression paths.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const origin = process.env.BASE_URL || 'http://127.0.0.1:5173';
const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
let page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
const progress = () => page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
const phase = () => page.evaluate(() => window.__game.state.phase);
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} ≈ ${expected}`);

async function load() {
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
}
async function stopClock() {
  await page.evaluate(() => {
    const game = window.__game;
    cancelAnimationFrame(game.raf);
    game.spawnTimer = 1e6;
    game.attackTimer = 1e6;
  });
}
async function collectGold(value) {
  return page.evaluate(value => {
    const game = window.__game;
    game.dropPickup(game.player.position, 'gold', value);
    game.stepForTest(.25);
    return game.state.gold;
  }, value);
}
async function contactDeath() {
  await page.evaluate(() => {
    const game = window.__game;
    game._state.hp = 1;
    game.invulnerable = 0;
    game.attackTimer = 1e6;
    game.magic.cooldowns.fireball = 10;
    game.spawnEnemy(game.player.position.x + .1, game.player.position.z, 2);
    game.stepForTest(.02);
  });
  assert.equal(await phase(), 'over');
  assert.equal(await page.locator('.modal-result').isVisible(), true);
}

try {
  await load();
  assert.equal((await progress()).bank, 0);
  await page.locator('#start-button').click();
  await stopClock();
  const firstRun = await page.evaluate(() => window.__game.state.runId);
  assert.ok(typeof firstRun === 'string' && firstRun.length > 5, 'each actual run has a settlement identity');
  assert.equal(await collectGold(100), 100);
  assert.equal((await progress()).bank, 0, 'collected run gold is not credited until the run ends');
  await contactDeath();
  let saved = await progress();
  assert.equal(saved.bank, 100);
  assert.equal(saved.lifetimeGold, 100);
  assert.ok(saved.settledRunIds.includes(firstRun));
  assert.equal(await page.locator('#bank-gold').textContent(), '100');
  console.log('PASS settlement: real gold pickup → contact death → persistent bank and unique receipt');

  await page.locator('#result-permanent').click();
  assert.equal(await page.locator('.modal-permanent').isVisible(), true);
  assert.equal(await page.locator('#permanent-grid [data-permanent-buy]').count(), 10);
  const endedDamage = await page.evaluate(() => window.__game.state.damage);
  await page.locator('[data-permanent-buy="power"]').click();
  saved = await progress();
  assert.equal(saved.bank, 88);
  assert.equal(saved.upgrades.power, 1);
  await page.locator('[data-permanent-buy="vitality"]').click();
  await page.locator('[data-permanent-buy="fortune"]').click();
  saved = await progress();
  assert.equal(saved.bank, 53);
  assert.equal(saved.upgrades.vitality, 1);
  assert.equal(saved.upgrades.fortune, 1);
  assert.equal(await page.evaluate(() => window.__game.state.damage), endedDamage, 'purchases configure the next run instead of rewriting an ended run');
  assert.equal(await page.locator('[data-permanent-buy="power"]').isDisabled(), false, 'another affordable upgrade stays available after several purchases');
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  saved = await progress();
  assert.equal(saved.bank, 53, 'reload neither resets funds nor deposits the same run again');
  assert.equal(saved.upgrades.power, 1);
  assert.equal(saved.upgrades.vitality, 1);
  assert.equal(saved.upgrades.fortune, 1);
  console.log('PASS permanent purchases: exact debit, compound upgrades, continued affordability, save and reload');

  await page.locator('#start-button').click();
  await stopClock();
  const secondRun = await page.evaluate(() => window.__game.state);
  assert.notEqual(secondRun.runId, firstRun);
  near(secondRun.damage, 18 * 1.12, 'purchased damage carries into the next run');
  near(secondRun.maxHp, 100 * 1.1, 'purchased vitality carries into the next run');
  near(secondRun.hp, secondRun.maxHp, 'a run starts at its permanently improved maximum health');
  near(secondRun.playerStats.goldMultiplier, 1.05, 'fortune improves future run earnings');
  assert.equal(secondRun.gold, 0);
  assert.equal(secondRun.stage, 1);
  assert.equal(secondRun.level, 1);
  assert.deepEqual(secondRun.playerStats.passiveLevels, {});
  assert.deepEqual(secondRun.playerStats.spells, { fireball: 1, frost: 0, lightning: 0, orbit: 0 });
  await page.locator('[data-nav="permanent"]').first().click();
  assert.equal(await phase(), 'paused');
  const disabled = await page.locator('[data-permanent-buy]').evaluateAll(buttons => buttons.length === 10 && buttons.every(button => button.disabled));
  assert.equal(disabled, true, 'permanent upgrades can only be purchased between runs');
  const rejected = await page.evaluate(() => window.__game.setPermanentBonuses({ damageMultiplier: 2 }));
  assert.equal(rejected, false, 'the engine rejects changes to permanent bonuses during a run');
  await page.locator('#modal-close').click();
  assert.equal(await phase(), 'playing');
  assert.equal((await progress()).bank, 53);
  near(await collectGold(50), 52.5, 'fortune preserves fractional earnings before final settlement');
  await contactDeath();
  saved = await progress();
  assert.equal(saved.bank, 105);
  assert.equal(saved.lifetimeGold, 152);
  assert.equal(saved.upgrades.power, 1, 'dying again never removes permanent upgrades');
  assert.ok(saved.settledRunIds.includes(secondRun.runId));
  console.log('PASS next run: permanent bonuses apply, temporary build resets, purchases lock during play, improved earnings settle after death');

  await page.locator('#retry').click();
  await stopClock();
  const bankBeforeVictory = (await progress()).bank;
  const victory = await page.evaluate(() => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game._state.stage = 5;
    game._state.stageTime = game.state.stageDuration;
    const boss = game.spawnBoss();
    game.hitEnemy(boss, boss.hp + 1, game.player.position.clone().set(1, 0, 0));
    game.tick(1 / 60);
    return { runId: game.state.runId, gold: Math.floor(game.state.gold), phase: game.state.phase };
  });
  assert.equal(victory.phase, 'won');
  saved = await progress();
  assert.equal(saved.bank, bankBeforeVictory + victory.gold);
  assert.ok(saved.settledRunIds.includes(victory.runId));
  await page.locator('#result-permanent').click();
  await page.locator('#camp-resultback').click();
  assert.equal(await page.locator('.modal-result').isVisible(), true);
  assert.equal((await progress()).bank, saved.bank, 'opening the results twice cannot double-credit winnings');
  await page.locator('#result-permanent').click();
  await page.locator('#camp-start').click();
  await stopClock();
  assert.equal(await phase(), 'playing');
  near(await page.evaluate(() => window.__game.state.damage), 18 * 1.12, 'camp retry retains purchased power');
  assert.equal(await page.evaluate(() => window.__game.state.gold), 0);
  assert.equal((await progress()).bank, saved.bank);
  console.log('PASS victory: final-boss completion settles once, returning to results is idempotent, camp retry keeps permanent upgrades');
  const beforeAbandon = (await progress()).bank;
  await collectGold(20);
  await page.locator('#pause-button').click();
  await page.locator('#pause-restart').click();
  assert.equal(await phase(), 'over');
  assert.equal(await page.evaluate(() => window.__game.state.endedReason), 'abandoned');
  assert.equal((await progress()).bank, beforeAbandon + 21, 'ending a run manually also recovers collected earnings');
  assert.ok(await page.locator('#result-permanent').isVisible());
  console.log('PASS manual run end: collected gold is recovered instead of discarded by a pause-menu restart');
  await context.close();

  const legacyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await legacyContext.addInitScript(() => {
    if (!localStorage.getItem('voidrun.test.legacySeeded')) {
      localStorage.setItem('voidrun.history', JSON.stringify([{ gold: 100, stage: 1, won: false, kills: 2, level: 1, elapsed: 10, date: '10. 26.' }]));
      localStorage.setItem('voidrun.test.legacySeeded', 'true');
    }
  });
  page = await legacyContext.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await load();
  saved = await progress();
  assert.equal(saved.bank, 100, 'completed runs recorded before permanent upgrades are imported');
  assert.equal(saved.importedHistory, true);
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal((await progress()).bank, 100, 'legacy history is migrated exactly once');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('voidrun.progression'));
    saved.bank = 0;
    saved.upgrades.power = 50;
    localStorage.setItem('voidrun.progression', JSON.stringify(saved));
  });
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  await page.locator('[data-nav="permanent"]').first().click();
  assert.equal(await page.locator('[data-permanent-buy="power"]').isDisabled(), true, 'maximum-level upgrades remain unpurchasable');
  await page.locator('#modal-close').click();
  await page.locator('#start-button').click();
  await stopClock();
  near(await page.evaluate(() => window.__game.state.damage), 18 * 1.12 ** 50, 'saved maximum-level permanent upgrades apply once without the former hidden cap');
  await legacyContext.close();
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS migration and caps: prior earnings imported once, maximum levels reject purchase and apply exactly once');
  console.log('All permanent-progression browser checks passed.');
} finally {
  await browser.close();
}
