import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { getPermanentUpgradeOffers } from '../src/progression.js';

// Legacy-wallet fixtures check the real camp, exact debits and save migration.
// The short played runs use normal stats; zero-gold manual settlement supplies
// a genuine ended-run state without pretending to balance a complete run.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-9), `${label}: ${actual} ≈ ${expected}`);
let context, page;
const readProgress = () => page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
async function load(seed) {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (seed) await context.addInitScript(value => {
    if (!localStorage.getItem('voidrun.economy.scale.seeded')) {
      localStorage.setItem('voidrun.progression', JSON.stringify(value));
      localStorage.setItem('voidrun.economy.scale.seeded', '1');
    }
  }, seed);
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await ready();
}
async function ready() {
  await page.waitForFunction(() => window.__game?.frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf));
}
async function startRun() {
  await page.locator('#start-button').click();
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
  });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
}
async function endRunAtCamp() {
  await page.locator('#pause-button').click();
  await page.locator('#pause-restart').click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'over');
  await page.locator('#result-permanent').click();
  assert.ok(await page.locator('.modal-permanent').isVisible());
}

try {
  // Explicit landmarks guard the intended scale rather than restating whatever
  // formula the browser currently happens to use.
  for (const [level, cost] of [[19, 300_000], [29, 30_000_000], [39, 3_000_000_000], [49, 300_000_000_000]]) {
    const offer = getPermanentUpgradeOffers({ bank: 1e12, upgrades: { power: level } }).find(item => item.id === 'power');
    assert.equal(offer.cost, cost, `sword level ${level + 1} has its authored price milestone`);
  }

  const oldSave = {
    version: 1, bank: 100_000_000, lifetimeGold: 900_000_000,
    upgrades: { power: 49, arcana: 29, vitality: 19, bladeReach: 19, haste: 12, focus: 8 },
    settledRunIds: ['paid-before-price-rebalance'], importedHistory: true,
  };
  await load(oldSave);
  let saved = await readProgress();
  assert.equal(saved.bank, oldSave.bank); assert.equal(saved.lifetimeGold, oldSave.lifetimeGold);
  for (const [id, level] of Object.entries(oldSave.upgrades)) assert.equal(saved.upgrades[id], level, `old ${id} levels survive repricing`);
  assert.deepEqual(saved.settledRunIds, oldSave.settledRunIds);
  await page.locator('[data-nav="permanent"]').first().click();
  const unaffordable = page.locator('[data-permanent-buy="power"]');
  assert.equal(await unaffordable.isDisabled(), true, 'one hundred million gold cannot buy the final three-hundred-billion upgrade');
  const price = (await unaffordable.locator('.permanent-price').textContent()).replace(/\s/g, '');
  assert.match(price, /^3,?000억G$/, 'the camp displays the real three-hundred-billion price in Korean units');
  await unaffordable.dispatchEvent('click');
  saved = await readProgress();
  assert.equal(saved.bank, oldSave.bank); assert.equal(saved.upgrades.power, 49, 'the real purchase handler also rejects an unaffordable click');
  await page.reload(); await ready();
  assert.equal((await readProgress()).bank, oldSave.bank);
  assert.deepEqual((await readProgress()).settledRunIds, oldSave.settledRunIds);
  console.log('PASS legacy economy: saved levels, wallet and receipts survive; 1억 cannot bypass a 3000억 final price');

  const wealthySave = { ...oldSave, bank: 1_000_000_000_000, lifetimeGold: 1_000_000_000_000 };
  await load(wealthySave); await startRun();
  const beforeDamage = await page.evaluate(() => window.__game.state.damage);
  near(beforeDamage, 18 * 1.12 ** 49, 'existing paid sword levels still apply before another purchase');
  await endRunAtCamp();
  const beforePurchase = await readProgress();
  assert.equal(beforePurchase.bank, 1_000_000_000_000);
  assert.equal(beforePurchase.settledRunIds.length, oldSave.settledRunIds.length + 1, 'ending an actual run records one new receipt even when it earned zero');
  const buy = page.locator('[data-permanent-buy="power"]');
  assert.equal(await buy.isDisabled(), false);
  await buy.click();
  saved = await readProgress();
  assert.equal(saved.bank, 700_000_000_000, 'the visible purchase debits exactly three hundred billion');
  assert.equal(saved.upgrades.power, 50);
  assert.equal(saved.lifetimeGold, wealthySave.lifetimeGold, 'spending is not recorded as additional income');
  assert.deepEqual(saved.settledRunIds, beforePurchase.settledRunIds, 'a purchase does not add or consume settlement receipts');
  near(await page.evaluate(() => window.__game.state.damage), beforeDamage, 'between-run purchases do not rewrite the ended run');
  assert.equal(await page.locator('[data-permanent-buy="power"]').isDisabled(), true, 'the purchased maximum cannot be bought again');
  await page.locator('[data-permanent-buy="power"]').dispatchEvent('click');
  assert.equal((await readProgress()).bank, 700_000_000_000, 'a repeated max-level click cannot debit a second time');
  await page.reload(); await ready();
  saved = await readProgress();
  assert.equal(saved.bank, 700_000_000_000); assert.equal(saved.upgrades.power, 50);
  assert.deepEqual(saved.settledRunIds, beforePurchase.settledRunIds, 'reloading cannot settle the finished run twice');
  await startRun();
  near(await page.evaluate(() => window.__game.state.damage), 18 * 1.12 ** 50, 'the new run receives the complete paid maximum exactly once');
  assert.equal((await readProgress()).bank, 700_000_000_000);
  console.log('PASS late purchase: exact 3000억 debit, max-level guard, retained receipts, reload and next-run compounded power');

  await load();
  assert.equal((await readProgress()).bank, 0);
  await startRun();
  await page.evaluate(() => window.__game.collectPickup({ type: 'gold', value: 12, mesh: null }));
  assert.equal((await readProgress()).bank, 0, 'run earnings still wait for settlement');
  await endRunAtCamp();
  const first = page.locator('[data-permanent-buy="power"]');
  assert.equal(await first.isDisabled(), false);
  assert.match((await first.locator('.permanent-price').textContent()).replace(/\s/g, ''), /^12G$/);
  await first.click();
  saved = await readProgress();
  assert.equal(saved.bank, 0); assert.equal(saved.upgrades.power, 1);
  assert.equal(saved.lifetimeGold, 12);
  console.log('PASS first-run affordability: twelve collected and settled gold still buys the first useful upgrade');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('All income-scaled permanent-economy browser checks passed.');
} finally { await context?.close(); await browser.close(); }
