import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { RELICS } from '../src/content.js';
import { getPermanentUpgradeOffers } from '../src/progression.js';
import { MAX_STAGES, ENEMY_HEALTH_GROWTH } from '../src/balance.js';

// Shortened runtime fixtures exercise actual attacks, loot, death settlement,
// purchases and stage transitions. They do not establish full-run difficulty.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-7, Math.abs(expected) * 1e-9), `${message}: ${actual} ≈ ${expected}`);
let context, page;

async function load({ seed, viewport = { width: 1440, height: 1000 }, mobile = false } = {}) {
  await context?.close();
  context = await browser.newContext({ viewport, hasTouch: mobile, isMobile: mobile });
  if (seed) await context.addInitScript(value => {
    if (!localStorage.getItem('voidrun.growth.seed')) {
      localStorage.setItem('voidrun.progression', JSON.stringify(value));
      localStorage.setItem('voidrun.growth.seed', '1');
    }
  }, seed);
  page = await manualPage(context);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf)); // Domain fixtures advance time explicitly; keep menu rendering out of UI waits.
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
}
async function freeze() {
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);game.renderer.setPixelRatio(.5);
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
    game._state.xpNeeded = 1e9;
  });
}
async function start() {
  await page.locator('#start-button').click();
  await freeze();
}
async function acquire(id) {
  // Control only which offer is randomly selected, not the effect application.
  await page.evaluate(({ id, ids }) => {
    const game = window.__game;
    const available = ids.filter(candidate => !game.stats.relics.includes(candidate));
    const index = available.indexOf(id);
    if (index < 0) throw new Error(`Cannot offer ${id}`);
    const random = Math.random;
    try {
      let rolls = 0;
      // Three ordinary cards are drawn first; target the first relic draw, then its special slot.
      Math.random = () => ++rolls === 4 ? (index + .01) / available.length : 0;
      const before = JSON.stringify(game.stats);
      if (!game.openRelic('성장 검증 보상')) throw new Error('Relic token did not queue');
      if (game.state.phase !== 'playing' || JSON.stringify(game.stats) !== before) throw new Error('A queued reward changed the live build');
      game._state.xp = game._state.xpNeeded;
      if (!game.openLevelUp()) throw new Error('Earned level-up did not open');
    } finally { Math.random = random; }
  }, { id, ids: RELICS.map(relic => relic.id) });
  await page.locator(`[data-upgrade="relic_${id}"]`).click();
  assert.ok(await page.evaluate(id => window.__game.stats.relics.includes(id), id));
  await page.evaluate(() => { window.__game._state.xp = 0; window.__game._state.xpNeeded = 1e9; });
}

try {
  assert.equal(RELICS.length, 28, 'twenty new relics extend the previous eight');
  await load(); await start();
  const income = await page.evaluate(() => {
    const game = window.__game;
    game.stats.critChance = 0; game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    const enemy = game.spawnEnemy(.1, 0, 0, { mutations: [] });
    game.hitEnemy(enemy, enemy.hp + 1);
    const baseGold = game.pickups.find(pickup => pickup.type === 'gold').value;
    game.dropPickup(game.player.position, 'gold', 487.5);
    game.stepForTest(.2);
    return { baseGold, gold: game.state.gold };
  });
  assert.equal(income.baseGold, 12.5, 'an ordinary actual stage-one kill now pays 12.5 gold');
  assert.equal(income.gold, 500);
  await page.evaluate(() => {
    const game = window.__game;
    game._state.hp = 1; game.invulnerable = 0;
    const e=game.spawnEnemy(.1, 0, 0, { mutations: [] });window.testEnemyStrike(game,e);
  });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'over');
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  assert.equal(saved.bank, 500, 'collected income is deposited by actual contact death');
  await page.locator('#result-permanent').click();
  let spent = 0;
  for (const id of ['power', 'power', 'power', 'power', 'arcana']) {
    const cost = getPermanentUpgradeOffers(saved).find(offer => offer.id === id).cost;
    spent += cost;
    await page.locator(`[data-permanent-buy="${id}"]`).click();
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
    assert.equal(saved.bank, 500 - spent, 'each inexpensive purchase debits exactly once');
  }
  assert.ok(spent < 100, 'four sword upgrades and one magic upgrade use less than one fifth of this run');
  await page.reload(); await page.waitForFunction(() => window.__game?.frames > 1);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf)); // Domain fixtures advance time explicitly; keep menu rendering out of UI waits.
  await start();
  const upgraded = await page.evaluate(() => window.__game.state);
  near(upgraded.damage, 18 * 1.12 ** 4, 'four sword purchases compound to a noticeable 57% gain');
  near(upgraded.spellDamage, 18 * 1.12, 'magic branch compounds independently');
  assert.ok(upgraded.damage / 18 > 1.5);
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')))).bank, 500 - spent);
  console.log('PASS economy: real kill5G → contact death500G → affordable purchases → reload → independent compounded growth');

  await load(); await start();
  const growth = await page.evaluate(floors => {
    const game = window.__game, stages = [];
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    game.stats.critChance = 0; game._state.hp = 63;
    for (let index = 0; index < floors - 1; index++) {
      const sample = game.spawnEnemy(20, 0, 0, { mutations: [] });
      const beforeKill = JSON.stringify(game.stats);
      stages.push({ stage: game.state.stage, hp: game.stats.maxHp, enemyHp: sample.maxHp, regionHealth: game.getThreat().enemyHealth });
      const boss = game.spawnBoss();
      game.hitEnemy(boss, boss.hp + 1); if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); }
      stages.at(-1).bossChangedStats = JSON.stringify(game.stats) !== beforeKill;
      const before = { stats: JSON.stringify(game.stats), hp: game.state.hp };
      game._state.stageTime = game.state.stageDuration;
      if (!game.nextStage()) throw new Error('Actual cleared boss did not unlock the route choice');
      if (game.state.phase !== 'route' || !game.chooseRoute('standard')) throw new Error('The standard route must be chosen to advance');
      if (game.state.phase === 'region' && !game.chooseRegion(game.regionChoices[0].id)) throw new Error('A regional choice must complete the floor transition');
      stages.at(-1).before = before;
      stages.at(-1).after = { stats: JSON.stringify(game.stats), hp: game.state.hp };
    }
    const sample = game.spawnEnemy(20, 0, 0, { mutations: [] });
    stages.push({ stage: game.state.stage, hp: game.stats.maxHp, enemyHp: sample.maxHp, regionHealth: game.getThreat().enemyHealth });
    return stages;
  }, MAX_STAGES);
  for (const stage of growth.slice(0, -1)) {
    assert.equal(stage.bossChangedStats, false, 'defeating a boss only makes its reward eligible');
    assert.equal(stage.after.stats, stage.before.stats, 'crossing a floor never multiplies any player stat');
    near(stage.after.hp, stage.before.hp, 'crossing a floor does not provide an automatic heal');
  }
  assert.equal(growth.length, MAX_STAGES);
  near(growth.at(-1).hp, growth[0].hp, 'maximum health stays unchanged across all ten floors without a selected upgrade');
  for (let index = 1; index < growth.length; index++) near(growth[index].enemyHp / growth[index - 1].enemyHp, ENEMY_HEALTH_GROWTH * growth[index].regionHealth / growth[index - 1].regionHealth, 'the original monster curve and selected region health multiply exactly once');
  console.log(`PASS floor progression: ${MAX_STAGES} floors preserve all player stats and current health until a reward is selected`);

  await load({ seed: { bank: 123, lifetimeGold: 999, upgrades: { power: 30, arcana: 30, vitality: 30, haste: 30, focus: 30 }, settledRunIds: ['old-paid-run'], importedHistory: true } });
  await start();
  const legacy = await page.evaluate(() => ({ stats: window.__game.stats, saved: JSON.parse(localStorage.getItem('voidrun.progression')) }));
  near(legacy.stats.damage, 18 * 1.12 ** 30, 'previously paid sword levels receive the new compound value without an obsolete×2 clamp');
  near(legacy.stats.spellDamage, 18 * 1.12 ** 30, 'previously paid magic levels retain the same benefit');
  near(legacy.stats.maxHp, 100 * 1.1 ** 30, 'existing health levels are preserved and enhanced');
  near(legacy.stats.attackRate, 1.5 * 1.025 ** 30, 'casting/attack purchased rates are not silently capped');
  assert.equal(legacy.saved.bank, 123); assert.ok(legacy.saved.settledRunIds.includes('old-paid-run'));
  console.log('PASS migration: high-level saved purchases apply fully while money and settlement receipts survive');

  await load(); await start();
  await acquire('giantsHeart');
  near(await page.evaluate(() => window.__game.stats.maxHp), 140, 'giant heart changes actual maximum health');
  near(await page.evaluate(() => window.__game.state.hp), 140, 'maximum-health relic heals only its new health capacity');
  await acquire('huntersWisdom');
  const xp = await page.evaluate(() => { const game = window.__game; game.dropPickup(game.player.position, 'xp', 10); game.stepForTest(.2); return game.state.xp; });
  near(xp, 13.5, 'wisdom increases actually collected experience');
  await acquire('executioner');
  const damage = await page.evaluate(() => {
    const game = window.__game; game.stats.critChance = 0;
    const ordinary = game.spawnEnemy(12, 0, 0, { mutations: [] }), elite = game.spawnEnemy(14, 0, 0, { elite: true, mutations: [] });
    const ordinaryHp = ordinary.hp, eliteHp = elite.hp;
    game.hitEnemy(ordinary, 10); game.hitEnemy(elite, 10);
    return { ordinary: ordinaryHp - ordinary.hp, elite: eliteHp - elite.hp };
  });
  near(damage.ordinary, 10, 'executioner leaves ordinary enemies unchanged');
  near(damage.elite, 13, 'executioner increases actual elite damage');
  await acquire('shockwave');
  const dash = await page.evaluate(() => {
    const game = window.__game;
    const enemy = game.spawnEnemy(2, 0, 0, { mutations: [] }), before = enemy.hp;
    const first = game.dash(), after = enemy.hp, second = game.dash();
    return { first, second, dealt: before - after, repeated: after - enemy.hp, base: game.stats.damage };
  });
  assert.equal(dash.first, true); assert.equal(dash.second, false);
  near(dash.dealt, dash.base * .8, 'dash shockwave uses a real attack rather than description-only metadata');
  near(dash.repeated, 0, 'cooldown prevents repeating free dash damage');
  await acquire('secondWind');
  const revive = await page.evaluate(() => {
    const game = window.__game; game._state.hp = 0; game.tick(.001);
    const first = { hp: game.state.hp, phase: game.state.phase, remaining: game.stats.reviveCharges, invulnerable: game.invulnerable, max: game.stats.maxHp };
    game._state.hp = 0; game.invulnerable = 0; game.tick(.001);
    return { first, second: { phase: game.state.phase, hp: game.state.hp } };
  });
  assert.equal(revive.first.phase, 'playing'); assert.equal(revive.first.remaining, 0);
  near(revive.first.hp, revive.first.max * .35, 'second wind really revives at35%');
  assert.ok(revive.first.invulnerable >= 1.49);
  assert.deepEqual(revive.second, { phase: 'over', hp: 0 }, 'revival is consumed once');
  console.log('PASS new relics: health, XP, elite specialization, dash damage and single-use revival affect real gameplay');

  for (const viewport of [{ width: 1440, height: 1000 }, { width: 1180, height: 820 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await load({ viewport, mobile: viewport.width < 1000 }); await start();
    await page.evaluate(() => { window.__game.spawnBoss(); window.__game.emit(); });
    const geometry = await page.evaluate(() => {
      const arena = document.querySelector('.arena').getBoundingClientRect();
      const boss = document.querySelector('#boss-hud').getBoundingClientRect();
      const pause = document.querySelector('#pause-button').getBoundingClientRect();
      const full = document.querySelector('#fullscreen').getBoundingClientRect();
      const overlaps = other => !(boss.right <= other.left || boss.left >= other.right || boss.bottom <= other.top || boss.top >= other.bottom);
      return { top: boss.top - arena.top, height: boss.height, withinArena: boss.left >= arena.left && boss.right <= arena.right, occludesCenter: boss.bottom >= arena.top + arena.height * .4, pauseOverlap: overlaps(pause), fullOverlap: overlaps(full), scrollHeight: document.documentElement.scrollHeight, heightAvailable: innerHeight, scrollWidth: document.documentElement.scrollWidth, widthAvailable: innerWidth };
    });
    assert.ok(geometry.top >= 0 && geometry.top <= 12, `boss bar stays against the arena top: ${JSON.stringify({ viewport, geometry })}`);
    assert.ok(geometry.height <= 42 && geometry.height > 4, 'boss health occupies only a compact strip');
    assert.equal(geometry.withinArena, true); assert.equal(geometry.occludesCenter, false);
    assert.equal(geometry.pauseOverlap, false); assert.equal(geometry.fullOverlap, false);
    assert.ok(geometry.scrollHeight <= geometry.heightAvailable + 1 && geometry.scrollWidth <= geometry.widthAvailable + 1);
    assert.equal(await page.locator('#boss-health-fill').isVisible(), true);
  }
  console.log('PASS compact boss HUD: top strip stays clear of action/controls at desktop, iPad, portrait and landscape sizes');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('All growth and economy browser checks passed.');
} finally {
  await context?.close(); await browser.close();
}
