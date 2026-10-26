import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { RELICS } from '../src/content.js';
import { getPermanentUpgradeOffers } from '../src/progression.js';

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
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
}
async function freeze() {
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = 1e6;
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
      Math.random = () => (index + .01) / available.length;
      if (!game.openRelic('성장 검증 보상')) throw new Error('Relic choice did not open');
    } finally { Math.random = random; }
  }, { id, ids: RELICS.map(relic => relic.id) });
  await page.locator(`[data-relic="${id}"]`).click();
  assert.ok(await page.evaluate(id => window.__game.stats.relics.includes(id), id));
}

try {
  assert.equal(RELICS.length, 28, 'twenty new relics extend the previous eight');
  await load(); await start();
  const income = await page.evaluate(() => {
    const game = window.__game;
    game.stats.critChance = 0; game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    const enemy = game.spawnEnemy(.1, 0, 0);
    game.hitEnemy(enemy, enemy.hp + 1);
    const baseGold = game.pickups.find(pickup => pickup.type === 'gold').value;
    game.dropPickup(game.player.position, 'gold', 495);
    game.stepForTest(.2);
    return { baseGold, gold: game.state.gold };
  });
  assert.equal(income.baseGold, 5, 'an ordinary actual stage-one kill now pays five gold');
  assert.equal(income.gold, 500);
  await page.evaluate(() => {
    const game = window.__game;
    game._state.hp = 1; game.invulnerable = 0;
    game.spawnEnemy(.1, 0, 0); game.stepForTest(.02);
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
  await start();
  const upgraded = await page.evaluate(() => window.__game.state);
  near(upgraded.damage, 18 * 1.12 ** 4, 'four sword purchases compound to a noticeable 57% gain');
  near(upgraded.spellDamage, 18 * 1.12, 'magic branch compounds independently');
  assert.ok(upgraded.damage / 18 > 1.5);
  assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')))).bank, 500 - spent);
  console.log('PASS economy: real kill5G → contact death500G → affordable purchases → reload → independent compounded growth');

  await load(); await start();
  const growth = await page.evaluate(() => {
    const game = window.__game, stages = [];
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game.stats.critChance = 0;
    for (let index = 0; index < 4; index++) {
      const sample = game.spawnEnemy(20, 0, 0);
      stages.push({ stage: game.state.stage, damage: game.stats.damage, spellDamage: game.stats.spellDamage, hp: game.stats.maxHp, enemyHp: sample.maxHp });
      const boss = game.spawnBoss();
      game.hitEnemy(boss, boss.hp + 1);
      // Boss rewards remain real; record their result before stage multipliers.
      const before = { damage: game.stats.damage, spellDamage: game.stats.spellDamage, hp: game.stats.maxHp };
      game._state.stageTime = game.state.stageDuration;
      if (!game.nextStage()) throw new Error('Actual cleared boss did not unlock the next stage');
      stages.at(-1).before = before;
      stages.at(-1).after = { damage: game.stats.damage, spellDamage: game.stats.spellDamage, hp: game.stats.maxHp, health: game.state.hp };
    }
    const sample = game.spawnEnemy(20, 0, 0);
    stages.push({ stage: game.state.stage, damage: game.stats.damage, spellDamage: game.stats.spellDamage, hp: game.stats.maxHp, enemyHp: sample.maxHp });
    return stages;
  });
  for (const stage of growth.slice(0, -1)) {
    near(stage.after.damage, stage.before.damage * 3.2, 'sword growth matches the monster stage exponent');
    near(stage.after.spellDamage, stage.before.spellDamage * 3.2, 'magic receives the same stage growth');
    near(stage.after.hp, stage.before.hp * 3.2, 'survivability receives the same stage growth');
    near(stage.after.health, stage.after.hp, 'stage transition fills the improved health pool');
  }
  near(growth.at(-1).hp / growth[0].hp, 3.2 ** 4, 'fifth-stage player health is exponentially larger');
  for (let index = 1; index < growth.length; index++) near(growth[index].enemyHp / growth[index - 1].enemyHp, 3.2, 'monster curve remains exponential');
  console.log('PASS stage growth: actual boss gates advance five stages while sword, magic and health each scale×3.2');

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
    const ordinary = game.spawnEnemy(12, 0, 0), elite = game.spawnEnemy(14, 0, 0, { elite: true });
    const ordinaryHp = ordinary.hp, eliteHp = elite.hp;
    game.hitEnemy(ordinary, 10); game.hitEnemy(elite, 10);
    return { ordinary: ordinaryHp - ordinary.hp, elite: eliteHp - elite.hp };
  });
  near(damage.ordinary, 10, 'executioner leaves ordinary enemies unchanged');
  near(damage.elite, 13, 'executioner increases actual elite damage');
  await acquire('shockwave');
  const dash = await page.evaluate(() => {
    const game = window.__game;
    const enemy = game.spawnEnemy(2, 0, 0), before = enemy.hp;
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
