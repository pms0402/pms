import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { RELICS } from '../src/content.js';

// Runtime fixtures shorten waiting; combat, pickups, choices and persistence
// still execute the game's real code. This is not a full-run balance claim.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5173';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (a, b, message) => assert.ok(Math.abs(a - b) < 1e-7, `${message}: ${a} ≈ ${b}`);
let context, page;
async function load({ seed, viewport = { width: 1440, height: 1000 }, mobile = false, fallback = false } = {}) {
  await context?.close();
  context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  if (seed) await context.addInitScript(value => {
    if (!localStorage.getItem('voidrun.test.seeded')) {
      localStorage.setItem('voidrun.progression', JSON.stringify(value));
      localStorage.setItem('voidrun.test.seeded', '1');
    }
  }, seed);
  if (fallback) await context.addInitScript(() => {
    // Init scripts run before documentElement exists. Disable the prototype API
    // so the app follows the same viewport fallback used by iPad browsers.
    Object.defineProperty(Element.prototype, 'requestFullscreen', { value: undefined });
    Object.defineProperty(Element.prototype, 'webkitRequestFullscreen', { value: undefined });
  });
  page = await manualPage(context);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf)); // Domain fixtures advance time explicitly; keep menu rendering out of UI waits.
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
}
async function stopClock() {
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);game.renderer.setPixelRatio(.5);
    game.spawnTimer = 1e6; game.attackTimer = 1e6; game.nextAltarTime = 1e6;
  });
}
async function start() {
  await page.locator('#start-button').click(); await stopClock();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
}
async function rewardLevel({ id, category = 'relic' } = {}) {
  return page.evaluate(({ id, category, ids }) => {
    const game = window.__game, random = Math.random;
    const available = ids.filter(candidate => !game.stats.relics.includes(candidate));
    const index = id ? available.indexOf(id) : 0;
    if (id && category === 'relic' && index < 0) throw new Error(`Unknown available reward ${id}`);
    try {
      let rolls = 0;
      Math.random = () => category === 'relic' && ++rolls === 4 ? (index + .01) / Math.max(1, available.length) : 0;
      game._state.xp = game._state.xpNeeded;
      if (!game.openLevelUp()) throw new Error('An earned level-up did not open');
      const special = game.upgradeChoices.find(choice => choice.category === category);
      if (!special || (id && special.id !== `${category}_${id}`)) throw new Error('The queued reward was not offered');
      return { id: special.id, rewardId: special.rewardId, count: game.upgradeChoices.length };
    } finally { Math.random = random; }
  }, { id, category, ids: RELICS.map(relic => relic.id) });
}
async function assertNoPageScroll() {
  const size = await page.evaluate(() => ({
    height: innerHeight, width: innerWidth,
    scrollHeight: document.documentElement.scrollHeight,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(size.scrollHeight <= size.height + 1, `page cannot scroll vertically: ${JSON.stringify(size)}`);
  assert.ok(size.scrollWidth <= size.width + 1, `page cannot scroll horizontally: ${JSON.stringify(size)}`);
}

try {
  await load({ seed: { bank: 2000, lifetimeGold: 2000, upgrades: {}, importedHistory: true } });
  await page.locator('[data-nav="permanent"]').first().click();
  assert.ok(await page.locator('.skill-tree').isVisible(), 'camp presents a connected branch tree');
  assert.equal(await page.locator('[data-permanent-buy="haste"]').isDisabled(), true);
  assert.equal(await page.locator('[data-permanent-buy="focus"]').isDisabled(), true);
  await page.locator('[data-permanent-buy="power"]').click();
  assert.equal(await page.locator('[data-permanent-buy="haste"]').isDisabled(), false, 'sword root unlocks its own child');
  assert.equal(await page.locator('[data-permanent-buy="focus"]').isDisabled(), true, 'sword purchase does not unlock a magic child');
  await page.locator('[data-permanent-buy="arcana"]').click();
  await page.locator('[data-permanent-buy="focus"]').click();
  await page.locator('.camp-tab[data-camp-tab="loadout"]').click();
  const arcanist = page.locator('[data-unlock-type="character"][data-unlock-id="arcanist"]');
  await arcanist.click();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  assert.ok(saved.unlocks.characters.includes('arcanist'));
  if (saved.loadout.character !== 'arcanist') await arcanist.click();
  const greatsword = page.locator('[data-unlock-type="weapon"][data-unlock-id="greatsword"]');
  await greatsword.click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  if (saved.loadout.weapon !== 'greatsword') await greatsword.click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  assert.equal(saved.bank, 1628, 'three skill purchases and two unlocks debit exactly once');
  assert.equal(saved.loadout.character, 'arcanist');
  assert.equal(saved.loadout.weapon, 'greatsword');
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf)); // Domain fixtures advance time explicitly; keep menu rendering out of UI waits.
  await start();
  const built = await page.evaluate(() => window.__game.state.playerStats);
  near(built.damage, 18 * 1.12 * .85 * 1.3, 'sword bonuses combine with the chosen sidegrades');
  near(built.spellDamage, 18 * 1.12 * 1.16, 'magic damage grows separately');
  near(built.attackRate, 1.5 * .72, 'heavy weapon affects only sword speed');
  near(built.spellRate, 1.5 * 1.025, 'magic branch affects only casting speed');
  near(built.maxHp, 90, 'character weakness is retained');
  await page.evaluate(() => {
    const game = window.__game; game.dropPickup(game.player.position, 'gold', 25);
    game.stepForTest(.2); game.endRun();
  });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  assert.equal(saved.bank, 1653); assert.equal(saved.loadout.character, 'arcanist');
  assert.equal(saved.upgrades.power, 1); assert.equal(saved.upgrades.arcana, 1);
  console.log('PASS branch tree: prerequisite isolation, exact purchases, character/weapon sidegrades, reload and settlement');

  const risks = {};
  for (const risk of ['none', 'swarm', 'fury']) {
    await load();
    await page.locator(`[data-risk="${risk}"]`).click();
    await start();
    risks[risk] = await page.evaluate(() => {
      const game = window.__game;
      game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
      const enemy = game.spawnEnemy(.1, 0, 0); enemy.speed = 0;
      const hp = game.state.hp; game.invulnerable = 0; window.testEnemyStrike(game,enemy);
      const damage = hp - game.state.hp;
      game.dropPickup(game.player.position, 'gold', 10);
      // Random drop scatter can begin just outside the immediate pickup radius.
      game.updatePickups(.05); game.updatePickups(.05);
      return { health: enemy.maxHp, damage, gold: game.state.gold, locked: game.setRiskPact('none'), risk: game.state.risk };
    });
    assert.equal(risks[risk].locked, false, 'risk cannot be changed during play');
  }
  assert.ok(risks.swarm.health > risks.none.health && risks.fury.health > risks.swarm.health);
  assert.ok(risks.swarm.damage > risks.none.damage && risks.fury.damage > risks.swarm.damage);
  assert.equal(risks.none.gold, 10, 'the fixture collects its real scattered pickup before comparing contract payouts');
  near(risks.swarm.gold, risks.none.gold * 1.8, 'swarm increased earnings');
  near(risks.fury.gold, risks.none.gold * 2.2, 'fury increased earnings');
  console.log('PASS risk/reward: chosen contracts produce stronger actual enemies and contact damage with proportional gold');

  await load(); await start();
  const chest = await page.evaluate(() => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    game._state.xpNeeded = 1e6;
    const before = JSON.stringify(game.stats);
    const chest = game.spawnChest(10, 0);
    game.player.position.set(10, 0, 0); game.updateAdventure(.01);
    const blocked = !chest.opened && chest.guards.length === 3;
    const guardHealth = chest.guards.map(enemy => enemy.maxHp);
    for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
    const level = game.state.level, xp = game.state.xp, gold = game.state.gold;
    game.tick(.01);
    return { blocked, guardHealth, opened: chest.opened, phase: game.state.phase, rewardTokens: game.state.rewardTokens, statsUnchanged: JSON.stringify(game.stats) === before, level, xp, gold, afterLevel: game.state.level, afterXp: game.state.xp, afterGold: game.state.gold, choices: game.chestChoices.map(choice => choice.id) };
  });
  assert.equal(chest.blocked, true, 'living guardians prevent free chest rewards');
  assert.ok(chest.guardHealth.every(hp => hp > 28), 'guardians are stronger than ordinary stage-one enemies');
  assert.equal(chest.opened, true); assert.equal(chest.phase, 'relic');
  assert.equal(chest.rewardTokens, 0); assert.equal(chest.statsUnchanged, true, 'opening a chest does not grant a stat without choosing');
  assert.equal(chest.afterLevel, chest.level); assert.equal(chest.afterXp, chest.xp);
  assert.ok(chest.afterGold >= chest.gold + 40, 'gold is paid as soon as the guarded chest opens');
  assert.equal(chest.choices.length, 3); assert.equal(new Set(chest.choices).size, 3);
  assert.equal(await page.locator('[data-chest-relic]').count(), 3, 'chest selection offers three immediate cards without requiring a level');
  const acquiredId = chest.choices[0];
  await page.locator(`[data-chest-relic="${acquiredId}"]`).click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  const relic = await page.evaluate(id => {
    const game = window.__game;
    return { acquired: game.stats.relics.includes(id), owned: game.stats.relics, duplicate: game.chooseChestReward(id), tokens: game.state.rewardTokens, level: game.state.level };
  }, acquiredId);
  assert.equal(relic.acquired, true); assert.deepEqual(relic.owned, [acquiredId]); assert.equal(relic.duplicate, false); assert.equal(relic.tokens, 0); assert.equal(relic.level, chest.level);
  await page.evaluate(() => window.__game.openRelic('다음 정예 처치 보상'));
  const nextOffer = await rewardLevel();
  assert.notEqual(nextOffer.id, `relic_${acquiredId}`, 'owned chest relics leave later eligible level-up rewards');
  console.log('PASS guarded chest: guardians gate immediate gold and three relic options; exactly one selected relic applies without a level-up');

  await load(); await start();
  const elite = await page.evaluate(() => {
    const game = window.__game; game._state.xpNeeded = 1e6;
    const before = JSON.stringify(game.stats);
    const normal = game.spawnEnemy(15, 0, 2);
    const elite = game.spawnEnemy(10, 0, 2, { elite: true });
    const stronger = elite.maxHp > normal.maxHp && elite.damageMultiplier > normal.damageMultiplier;
    game.hitEnemy(elite, elite.hp + 1); game.tick(.01);
    return { stronger, phase: game.state.phase, tokens: game.state.rewardTokens, statsUnchanged: JSON.stringify(game.stats) === before, gold: game.pickups.filter(p => p.type === 'gold').reduce((sum, p) => sum + p.value, 0) };
  });
  assert.equal(elite.stronger, true); assert.equal(elite.phase, 'playing');
  assert.ok(elite.gold >= 60, 'elite pays four times the ordinary heavy enemy');
  assert.equal(elite.tokens, 1); assert.equal(elite.statsUnchanged, true);
  const eliteOffer = await rewardLevel();
  await page.locator(`[data-upgrade="${eliteOffer.id}"]`).click();
  assert.equal(await page.evaluate(() => window.__game.stats.relics.length), 1);
  console.log('PASS elite: extra health/damage and gold; its queued relic waits for the earned level-up selection');

  await load(); await start();
  const golden = await page.evaluate(() => {
    const game = window.__game; game._state.xpNeeded = 1e6;
    const enemy = game.spawnEnemy(6, 0, 1, { golden: true });
    const before = enemy.group.position.length(); game.updateEnemies(.1);
    const flees = enemy.group.position.length() > before;
    game.hitEnemy(enemy, enemy.hp + 1);
    const payout = game.pickups.filter(p => p.type === 'gold').reduce((sum, p) => sum + p.value, 0);
    const escapee = game.spawnEnemy(-8, 0, 1, { golden: true }); escapee.escapeTime = .001;
    const count = game.pickups.length; game.updateEnemies(.01);
    return { flees, payout, escaped: !game.enemies.includes(escapee), noEscapeReward: game.pickups.length === count };
  });
  assert.deepEqual(golden, { flees: true, payout: 100, escaped: true, noEscapeReward: true });
  console.log('PASS rare gold monster: flees, pays eightfold only on a kill, escapes without a reward');

  await load(); await start();
  const boss = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss();
    const before = JSON.stringify(game.stats), range = game.stats.swordRangeMultiplier;
    game.hitEnemy(boss, boss.hp + 1); if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); }
    game.hitEnemy(boss, 1e6);
    return { range, unchanged: JSON.stringify(game.stats) === before, pending: game.pendingBossRewards.length, rewards: game.stats.bossRewards };
  });
  assert.equal(boss.unchanged, true, 'a boss kill cannot automatically improve player stats');
  assert.equal(boss.pending, 1); assert.deepEqual(boss.rewards, []);
  const bossOffer = await rewardLevel({ id: 'warden', category: 'boss' });
  assert.equal(bossOffer.count, 4);
  await page.locator('[data-upgrade="boss_warden"]').click();
  const chosenBoss = await page.evaluate(() => ({ range: window.__game.stats.swordRangeMultiplier, rewards: window.__game.stats.bossRewards, pending: window.__game.pendingBossRewards.length, repeat: window.__game.chooseUpgrade('boss_warden') }));
  near(chosenBoss.range, boss.range * 1.1, 'choosing the earned boss card applies its described range bonus');
  assert.deepEqual(chosenBoss.rewards, ['warden']); assert.equal(chosenBoss.pending, 0); assert.equal(chosenBoss.repeat, false);
  console.log('PASS boss reward: defeat queues eligibility; an actual level-up selection grants the ability exactly once');

  await load(); await start();
  await page.evaluate(() => window.__game.openRelic('서리불꽃 조합'));
  await rewardLevel({ id: 'frostfire' });
  await page.locator('[data-upgrade="relic_frostfire"]').click();
  const synergy = await page.evaluate(() => {
    const game = window.__game; game.stats.critChance = 0;
    const slowed = game.spawnEnemy(10,0,0,{mutations:[]}), ordinary = game.spawnEnemy(10,.5,0,{mutations:[]});
    slowed.hp = ordinary.hp = 1000; slowed.slowTime = 2;
    game.magic.explode(slowed.group.position.clone(), 2, 10, false);
    return { slowed: 1000 - slowed.hp, ordinary: 1000 - ordinary.hp, hits: game.magic.getDebugState().synergyHits };
  });
  near(synergy.slowed, 12, 'frostfire gives its damage bonus to a slowed target');
  near(synergy.ordinary, 10, 'an un-slowed target receives ordinary explosion damage');
  assert.ok(synergy.hits >= 1);
  console.log('PASS relic synergy: actual fire explosion gains 20% against a frost-slowed enemy');

  await load(); await start();
  const stress = await page.evaluate(() => {
    const game = window.__game;game.renderer.setPixelRatio(1);
    game.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 };
    game.stats.evolutions = { fireball: true, frost: true, lightning: true, orbit: true };
    game.stats.damage = game.stats.spellDamage = .01; game.stats.critChance = 0;
    game._state.xpNeeded = 1e9; game._state.stage = 5; game.invulnerable = 999;
    game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
    for (let index = 0; index < 160; index++) {
      const angle = index * 2.399, radius = 4 + index % 12;
      const enemy = game.spawnEnemy(Math.cos(angle) * radius, Math.sin(angle) * radius, index % 4);
      enemy.hp = enemy.maxHp = 1e6;
    }
    for (let index = 0; index < 250; index++) {
      game.floatText(String(index), game.player.position, '#ffffff');
      game.burst(game.player.position, '#caff88', 6);
    }
    for(const id of ['fireball','frost','lightning','orbit'])window.testCast(game,id);
    const peak = { effects: game.effects.length, texts: game.floatingTexts.length };
    game.stepForTest(4);
    game.renderer.render(game.scene, game.camera);
    const result = game.getDebugState();
    return { peak, result, effects: game.effects.length, geometry: game.renderer.info.memory.geometries, shadows: game.renderer.shadowMap.enabled, pixelRatio: game.renderer.getPixelRatio() };
  });
  assert.equal(stress.result.phase, 'playing');
  assert.equal(stress.result.enemies, 160);
  assert.ok(stress.peak.effects <= 200 && stress.peak.texts <= 40, 'bursts and damage labels have fixed resource limits');
  assert.ok(stress.result.enemyProjectiles <= 80 && stress.result.magic.projectiles <= 40);
  assert.ok(stress.result.magic.effects <= 100 && stress.effects <= 200);
  assert.ok(stress.geometry < 180, 'shared geometry budget: '+JSON.stringify({geometry:stress.geometry,actors:stress.result.enemies}));
  assert.equal(stress.shadows, true, 'optimization retains high-quality shadows');
  assert.ok(stress.pixelRatio >= 1, 'optimization keeps the configured render resolution');
  console.log('PASS stress: 160 enemies, all evolved spells, bounded effects/projectiles/labels, shared geometry and high-quality rendering');

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await load({ viewport, mobile: true, fallback: true });
    await start();
    await assertNoPageScroll();
    await page.locator('#fullscreen').click();
    assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'), 'true');
    assert.ok(await page.locator('body').evaluate(body => body.classList.contains('theater-mode')));
    await assertNoPageScroll();
    for (const selector of ['#fullscreen', '#pause-button', '#touch-dash', '.dpad']) {
      const bounds = await page.locator(selector).boundingBox();
      assert.ok(bounds && bounds.width > 0 && bounds.height > 0, `${selector} visible on ${viewport.width}×${viewport.height}`);
      assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1, `${selector} remains within the viewport`);
    }
    await page.locator('#fullscreen').click();
    assert.equal(await page.locator('#fullscreen').getAttribute('aria-pressed'), 'false');
    await assertNoPageScroll();
  }
  console.log('PASS mobile portrait/landscape: no document scrolling, fullscreen fallback and visible touch controls');
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('All adventure and branch-growth browser checks passed.');
} finally {
  await context?.close(); await browser.close();
}
