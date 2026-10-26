import assert from 'node:assert/strict';
import { chromium } from 'playwright';

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
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
}
async function stopClock() {
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);
    game.spawnTimer = 1e6; game.attackTimer = 1e6;
  });
}
async function start() {
  await page.locator('#start-button').click(); await stopClock();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
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
  assert.equal(saved.bank, 1600, 'three skill purchases and two unlocks debit exactly once');
  assert.equal(saved.loadout.character, 'arcanist');
  assert.equal(saved.loadout.weapon, 'greatsword');
  await page.reload();
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  await start();
  const built = await page.evaluate(() => window.__game.state.playerStats);
  near(built.damage, 18 * 1.02 * .85 * 1.3, 'sword bonuses combine with the chosen sidegrades');
  near(built.spellDamage, 18 * 1.02 * 1.16, 'magic damage grows separately');
  near(built.attackRate, 1.5 * .72, 'heavy weapon affects only sword speed');
  near(built.spellRate, 1.5 * 1.01, 'magic branch affects only casting speed');
  near(built.maxHp, 90, 'character weakness is retained');
  await page.evaluate(() => {
    const game = window.__game; game.dropPickup(game.player.position, 'gold', 25);
    game.stepForTest(.2); game.endRun();
  });
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')));
  assert.equal(saved.bank, 1625); assert.equal(saved.loadout.character, 'arcanist');
  assert.equal(saved.upgrades.power, 1); assert.equal(saved.upgrades.arcana, 1);
  console.log('PASS branch tree: prerequisite isolation, exact purchases, character/weapon sidegrades, reload and settlement');

  const risks = {};
  for (const risk of ['none', 'swarm', 'fury']) {
    await load();
    await page.locator(`[data-risk="${risk}"]`).click();
    await start();
    risks[risk] = await page.evaluate(() => {
      const game = window.__game;
      game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
      const enemy = game.spawnEnemy(.1, 0, 0); enemy.speed = 0;
      const hp = game.state.hp; game.invulnerable = 0; game.updateEnemies(.001);
      const damage = hp - game.state.hp;
      game.dropPickup(game.player.position, 'gold', 10); game.updatePickups(.05);
      return { health: enemy.maxHp, damage, gold: game.state.gold, locked: game.setRiskPact('none'), risk: game.state.risk };
    });
    assert.equal(risks[risk].locked, false, 'risk cannot be changed during play');
  }
  assert.ok(risks.swarm.health > risks.none.health && risks.fury.health > risks.swarm.health);
  assert.ok(risks.swarm.damage > risks.none.damage && risks.fury.damage > risks.swarm.damage);
  near(risks.swarm.gold, risks.none.gold * 1.8, 'swarm increased earnings');
  near(risks.fury.gold, risks.none.gold * 2.2, 'fury increased earnings');
  console.log('PASS risk/reward: chosen contracts produce stronger actual enemies and contact damage with proportional gold');

  await load(); await start();
  const chest = await page.evaluate(() => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game._state.xpNeeded = 1e6;
    const chest = game.spawnChest(10, 0);
    game.player.position.set(10, 0, 0); game.updateAdventure(.01);
    const blocked = !chest.opened && chest.guards.length === 3;
    const guardHealth = chest.guards.map(enemy => enemy.maxHp);
    for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
    game.tick(.01);
    return { blocked, guardHealth, opened: chest.opened, phase: game.state.phase, choices: game.relicChoices.map(choice => choice.id) };
  });
  assert.equal(chest.blocked, true, 'living guardians prevent free chest rewards');
  assert.ok(chest.guardHealth.every(hp => hp > 28), 'guardians are stronger than ordinary stage-one enemies');
  assert.equal(chest.opened, true); assert.equal(chest.phase, 'relic');
  assert.equal(chest.choices.length, 3); assert.equal(new Set(chest.choices).size, 3);
  await page.locator(`[data-relic="${chest.choices[0]}"]`).click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  const relic = await page.evaluate(id => {
    const game = window.__game;
    const acquired = game.stats.relics.includes(id), duplicate = game.chooseRelic(id);
    game.openRelic('다음 보물상자');
    return { acquired, duplicate, offeredAgain: game.relicChoices.some(choice => choice.id === id) };
  }, chest.choices[0]);
  assert.deepEqual(relic, { acquired: true, duplicate: false, offeredAgain: false });
  console.log('PASS guarded chest: stronger guardians gate opening; three distinct choices apply once and leave the pool');

  await load(); await start();
  const elite = await page.evaluate(() => {
    const game = window.__game; game._state.xpNeeded = 1e6;
    const normal = game.spawnEnemy(15, 0, 2);
    const elite = game.spawnEnemy(10, 0, 2, { elite: true });
    const stronger = elite.maxHp > normal.maxHp && elite.damageMultiplier > normal.damageMultiplier;
    game.hitEnemy(elite, elite.hp + 1); game.tick(.01);
    return { stronger, phase: game.state.phase, choices: game.relicChoices.length, gold: game.pickups.filter(p => p.type === 'gold').reduce((sum, p) => sum + p.value, 0) };
  });
  assert.equal(elite.stronger, true); assert.equal(elite.phase, 'relic');
  assert.ok(elite.gold >= 12, 'elite pays four times the ordinary heavy enemy');
  assert.equal(elite.choices, 3);
  console.log('PASS elite: extra health/damage, enhanced gold and an actual relic selection');

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
  assert.deepEqual(golden, { flees: true, payout: 8, escaped: true, noEscapeReward: true });
  console.log('PASS rare gold monster: flees, pays eightfold only on a kill, escapes without a reward');

  await load(); await start();
  const boss = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss();
    const before = game.stats.swordRangeMultiplier;
    game.hitEnemy(boss, boss.hp + 1);
    const after = game.stats.swordRangeMultiplier;
    game.hitEnemy(boss, 1e6);
    return { before, after, rewards: game.stats.bossRewards, afterDuplicate: game.stats.swordRangeMultiplier };
  });
  near(boss.after, boss.before * 1.1, 'first boss grants the unique range upgrade');
  assert.deepEqual(boss.rewards, ['warden']);
  assert.equal(boss.afterDuplicate, boss.after);
  console.log('PASS boss reward: actual defeat grants its unique ability exactly once');

  await load(); await start();
  await page.evaluate(() => {
    const game = window.__game, random = Math.random;
    try { Math.random = () => .65; game.openRelic('서리불꽃 조합'); }
    finally { Math.random = random; }
  });
  await page.locator('[data-relic="frostfire"]').click();
  const synergy = await page.evaluate(() => {
    const game = window.__game; game.stats.critChance = 0;
    const slowed = game.spawnEnemy(10, 0, 0), ordinary = game.spawnEnemy(10, .5, 0);
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
    const game = window.__game;
    game.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 };
    game.stats.evolutions = { fireball: true, frost: true, lightning: true, orbit: true };
    game.stats.damage = game.stats.spellDamage = .01; game.stats.critChance = 0;
    game._state.xpNeeded = 1e9; game._state.stage = 5; game.invulnerable = 999;
    game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = 1e6;
    for (let index = 0; index < 160; index++) {
      const angle = index * 2.399, radius = 4 + index % 12;
      const enemy = game.spawnEnemy(Math.cos(angle) * radius, Math.sin(angle) * radius, index % 4);
      enemy.hp = enemy.maxHp = 1e6;
    }
    for (let index = 0; index < 250; index++) {
      game.floatText(String(index), game.player.position, '#ffffff');
      game.burst(game.player.position, '#caff88', 6);
    }
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
  assert.ok(stress.geometry < 180, 'shared geometries prevent per-hit geometry accumulation');
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
