import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { getUpgradeChoices } from '../src/balance.js';
import { RELICS } from '../src/content.js';
import { CURSES, ROUTES } from '../src/run-events.js';

// Fixtures shorten travel and fights. Selections, collision, payouts, modal
// locking and combat resource limits execute the real runtime implementation.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-6, `${message}: ${actual} ≈ ${expected}`);
let context, page;

async function fresh(viewport = { width: 1440, height: 1000 }) {
  await context?.close();
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200, isMobile: viewport.width < 1000 });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  await page.locator('#start-button').click();
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game.stats.critChance = 0; game._state.xpNeeded = 1e9;
  });
}

async function earnChoice(id) {
  const stats = await page.evaluate(() => structuredClone(window.__game.stats));
  let roll;
  for (let index = 0; index < 1000; index++) {
    const candidate = (index + .5) / 1000;
    if (getUpgradeChoices(stats, () => candidate).some(choice => choice.id === id)) { roll = candidate; break; }
  }
  assert.notEqual(roll, undefined, `the requested legal upgrade is offerable: ${id}`);
  const opened = await page.evaluate(value => {
    const game = window.__game, random = Math.random;
    const before = JSON.stringify(game.stats), beforeLevel = game.state.level;
    try {
      Math.random = () => value;
      game._state.xp = game._state.xpNeeded;
      const success = game.openLevelUp();
      return { success, before, after: JSON.stringify(game.stats), beforeLevel, level: game.state.level };
    } finally { Math.random = random; }
  }, roll);
  assert.equal(opened.success, true); assert.equal(opened.before, opened.after, 'opening the choice grants no hidden stats');
  assert.equal(opened.level, opened.beforeLevel + 1);
  await page.locator(`[data-upgrade="${id}"]`).click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
}

async function noPageScroll() {
  const size = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight }));
  assert.ok(size.sw <= size.width + 1 && size.sh <= size.height + 1, `document stays inside viewport: ${JSON.stringify(size)}`);
}

async function assertChoiceLocked(selector, phase) {
  const before = await page.evaluate(() => window.__game.state.elapsed);
  await page.keyboard.press('Escape');
  await page.locator('[data-nav="guide"]').first().click({ force: true });
  await page.evaluate(() => window.__game.stepForTest(2));
  assert.equal(await page.evaluate(() => window.__game.state.phase), phase);
  assert.ok(await page.locator(selector).count() > 0, 'navigation cannot replace a mandatory choice');
  assert.equal(await page.evaluate(() => window.__game.state.elapsed), before, 'combat time freezes throughout the choice');
}

try {
  await fresh();
  const collision = await page.evaluate(() => {
    const game = window.__game;
    const points = [[0, 2.3], [0, 2.81], [0, -2.4], [Math.sin(80 * Math.PI / 180) * 2.4, Math.cos(80 * Math.PI / 180) * 2.4]];
    const targets = points.map(([x, z]) => { const enemy = game.spawnEnemy(x, z, 0); enemy.hp = enemy.maxHp = 1000; enemy.speed = 0; return enemy; });
    game.attack();
    const slash = game.effects.find(effect => effect.type === 'slash');
    if (!slash) throw new Error('A landed sword swing must render its sweep');
    const visual = { radius: slash.mesh.geometry.parameters.outerRadius * slash.mesh.scale.x, arc: slash.mesh.geometry.parameters.thetaLength, scale: slash.mesh.scale.x };
    game.animateEffects(.1);
    return { hp: targets.map(enemy => enemy.hp), profile: game.state.sword, visual, afterScale: slash.mesh.scale.x };
  });
  near(collision.profile.range, 2.8, 'unupgraded sword has a short measured reach');
  assert.ok(collision.hp[0] < 1000, 'front target inside the sweep is hit');
  assert.deepEqual(collision.hp.slice(1), [1000, 1000, 1000], 'outside radius, rear and outside-angle targets cannot take invisible sword hits');
  near(collision.visual.radius, collision.profile.range, 'visible outer edge equals the collision range');
  near(collision.visual.arc, collision.profile.arc, 'visible sweep angle equals the collision sector');
  near(collision.afterScale, collision.visual.scale, 'the effect fades without expanding beyond its hit area');
  const directedSweeps = await page.evaluate(() => {
    const game = window.__game, records = [];
    for (const mode of ['', 'broadsword', 'twinblade', 'wave']) {
      game.stats.swordEvolution = mode;
      const profile = game.state.sword, direction = game.player.position.clone().set(.6, 0, .8);
      game.slash(direction, profile);
      const sweep = game.effects.at(-1), mesh = sweep.mesh; mesh.updateMatrixWorld(true);
      const center = mesh.localToWorld(direction.clone().set(1, 0, 0)).sub(mesh.position);
      records.push({ mode: profile.mode, radius: center.length(), profile: profile.range, aim: (center.x * .6 + center.z * .8) / center.length(), angle: mesh.geometry.parameters.thetaLength, arc: profile.arc });
    }
    return records;
  });
  for (const sweep of directedSweeps) {
    near(sweep.radius, sweep.profile, `${sweep.mode} footprint retains its exact reach`);
    near(sweep.aim, 1, `${sweep.mode} graphic points toward the actual attack direction`);
    near(sweep.angle, sweep.arc, `${sweep.mode} graphic matches its evolved collision angle`);
  }
  console.log('PASS sword detail: measured2.8 reach, exact forward sector and matching nonexpanding sweep');

  await fresh();
  const beforeRange = await page.evaluate(() => window.__game.state.sword.range);
  await earnChoice('blade_range');
  const upgraded = await page.evaluate(() => {
    const game = window.__game;
    const enemy = game.spawnEnemy(0, 3, 0); enemy.hp = enemy.maxHp = 1000; enemy.speed = 0;
    game.attack();
    return { range: game.state.sword.range, hp: enemy.hp, damage: game.stats.damage, spellDamage: game.stats.spellDamage, rank: game.stats.passiveLevels.blade_range };
  });
  near(upgraded.range, beforeRange * 1.12, 'only selected range upgrade increases reach');
  assert.ok(upgraded.hp < 1000, 'a previously unreachable target is now actually hit');
  assert.equal(upgraded.rank, 1); assert.equal(upgraded.damage, 18); assert.equal(upgraded.spellDamage, 18);
  await earnChoice('blade_range'); await earnChoice('power'); await earnChoice('blade_wave');
  const evolution = await page.evaluate(() => ({ mode: window.__game.state.sword.mode, multiplier: window.__game.state.sword.range, rejected: window.__game.chooseUpgrade('blade_broadsword') }));
  assert.equal(evolution.mode, 'wave'); assert.equal(evolution.rejected, false);
  near(evolution.multiplier, 2.8 * 1.12 ** 2 * 1.8, 'earned wave evolution combines with chosen range ranks');
  console.log('PASS chosen growth: range rank reaches new targets; three sword ranks unlock one mutually exclusive evolution');

  await fresh();
  const shatter = await page.evaluate(() => {
    const game = window.__game;
    game.stats.spells.frost = 1; game.stats.passiveLevels.blade_range = 2;
    const primary = game.spawnEnemy(0, 2.65, 0), splash = game.spawnEnemy(0, 4.2, 0), far = game.spawnEnemy(0, 7, 0);
    for (const enemy of [primary, splash, far]) { enemy.hp = enemy.maxHp = 1000; enemy.speed = 0; }
    primary.slowTime = 2;
    game.attack(); const first = splash.hp;
    game.attack();
    return { first, second: splash.hp, far: far.hp, report: game.state.runReport };
  });
  assert.ok(shatter.first < 1000, 'a slowed sword target shatters into a nearby enemy outside sword reach');
  assert.equal(shatter.second, shatter.first, 'same-target shatter cooldown prevents repeated splash in the same instant');
  assert.equal(shatter.far, 1000); assert.ok(shatter.report.damageBySource.combo > 0);
  console.log('PASS sword/frost combo: real splash beyond the blade, finite radius and per-target cooldown');

  await fresh();
  const flames = await page.evaluate(() => {
    const game = window.__game; game.stats.spells.fireball = 1; game.stats.swordEvolution = 'wave';
    const primary = game.spawnEnemy(0, 2.65, 0), side = game.spawnEnemy(2, 2.65, 0);
    for (const enemy of [primary, side]) { enemy.hp = enemy.maxHp = 1000; enemy.speed = 0; }
    game.magic.explode(primary.group.position.clone(), .1, 1, false);
    const marked = primary.burnTime; game.attack(); const after = side.hp;
    game.attack();
    const triggers = game.state.runReport.synergyTriggers.flamewave;
    game.removeEnemyWithoutReward(primary);
    const recycled = game.spawnEnemy(0, 20, 0);
    return { marked, after, again: side.hp, triggers, reused: recycled.group === primary.group, recycledBurn: recycled.burnTime };
  });
  assert.ok(flames.marked > 0 && flames.after < 1000, 'a real fire explosion marks an enemy whose sword hit spreads fire outside the narrow wave');
  assert.equal(flames.again, flames.after); assert.equal(flames.triggers, 1);
  assert.equal(flames.reused, true); assert.equal(flames.recycledBurn, 0, 'pooled enemies never inherit a previous life\'s burn');
  await fresh();
  const current = await page.evaluate(() => {
    const game = window.__game; game.stats.spells.lightning = game.stats.spells.orbit = 1;
    const target = game.spawnEnemy(4, 0, 0); target.hp = target.maxHp = 1000; target.speed = 0;
    game.magic.syncOrbit(); game.magic.updateOrbit(.01);
    const first = game.magic.updateBuildSynergy(), hp = target.hp;
    const second = game.magic.updateBuildSynergy();
    return { first, second, hp, after: target.hp, triggers: game.state.runReport.synergyTriggers.runelight, relicBonus: game.stats.runeSynergyBonus || 0 };
  });
  assert.equal(current.first, true); assert.equal(current.second, false); assert.ok(current.hp < 1000); assert.equal(current.after, current.hp);
  assert.equal(current.triggers, 1); assert.equal(current.relicBonus, 0, 'the chosen spell combination works independently of the old rune relic');
  console.log('PASS fire-wave and rune-current combos: real burn condition, bounded repeat rate, pooled status reset and relic-independent cast');

  await fresh();
  const beforeCurse = await page.evaluate(() => {
    const game = window.__game, enemy = game.spawnEnemy(0, 10, 0); enemy.hp = enemy.maxHp * .4; enemy.speed = 0;
    const stats = JSON.stringify(game.stats), result = { maxHp: enemy.maxHp, hp: enemy.hp, stats, beforeTime: game.state.elapsed };
    if (!game.openCurseAltar()) throw new Error('The optional altar should open while playing');
    return result;
  });
  assert.equal(await page.locator('[data-curse]:not([data-curse="skip"])').count(), CURSES.length);
  await assertChoiceLocked('[data-curse]', 'curse');
  const curse = CURSES.find(item => item.id === 'bloodDebt');
  await page.locator('[data-curse="bloodDebt"]').click();
  const afterCurse = await page.evaluate(() => {
    const game = window.__game, existing = game.enemies[0], future = game.spawnEnemy(10, 0, 0);
    const gold = game.state.gold; game.collectPickup({ type: 'gold', value: 10, mesh: null });
    game.invulnerable = 0; const hp = game.state.hp; game.takeDamage(10, game.player.position);
    return { phase: game.state.phase, existingHp: existing.hp, existingMax: existing.maxHp, futureHp: future.maxHp, gold: game.state.gold - gold, damage: hp - game.state.hp, stats: JSON.stringify(game.stats), curses: game.state.activeCurses };
  });
  assert.equal(afterCurse.phase, 'playing'); assert.equal(afterCurse.stats, beforeCurse.stats, 'risk choices do not silently grant player stats');
  near(afterCurse.existingMax, beforeCurse.maxHp * curse.enemyHealth, 'already-spawned enemies become tougher too');
  near(afterCurse.existingHp / afterCurse.existingMax, .4, 'existing damage percentage is preserved');
  near(afterCurse.futureHp, afterCurse.existingMax, 'future enemies use the same health multiplier');
  near(afterCurse.gold, 10 * curse.goldMultiplier, 'the announced risk increases actual collected gold');
  near(afterCurse.damage, 10 * curse.enemyDamage, 'the announced risk increases actual incoming damage');
  assert.deepEqual(afterCurse.curses, ['bloodDebt']);
  console.log('PASS optional altar: locked choice, no stat grants, existing/future enemy parity and actual risk/reward payouts');

  await fresh();
  const routeBaseline = await page.evaluate(() => {
    const game = window.__game, random = Math.random; const before = JSON.stringify(game.stats), hp = game.state.hp;
    try { Math.random = () => .5; const boss = game.spawnBoss(); game.hitEnemy(boss, boss.hp + 1); if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); } } finally { Math.random = random; }
    game._state.stageTime = game.state.stageDuration;
    if (!game.nextStage()) throw new Error('A cleared completed floor should offer a route');
    return { before, hp, stage: game.state.stage, phase: game.state.phase };
  });
  assert.equal(routeBaseline.phase, 'route'); assert.equal(routeBaseline.stage, 1);
  assert.equal(await page.locator('[data-route]').count(), ROUTES.length);
  await assertChoiceLocked('[data-route]', 'route');
  await page.locator('[data-route="elite"]').click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'region');
  await assertChoiceLocked('[data-region]', 'region');
  await page.locator('[data-region]').first().click();
  const route = await page.evaluate(() => ({ phase: window.__game.state.phase, stage: window.__game.state.stage, routeId: window.__game.state.routeId, stats: JSON.stringify(window.__game.stats), hp: window.__game.state.hp, modifiers: window.__game.state.runModifiers }));
  assert.equal(route.phase, 'playing'); assert.equal(route.stage, 2); assert.equal(route.routeId, 'elite');
  assert.equal(route.stats, routeBaseline.before); assert.equal(route.hp, routeBaseline.hp, 'route transition never adds free stats or healing');
  assert.ok(route.modifiers.enemyHealth > 1 && route.modifiers.goldMultiplier > 1);
  console.log('PASS route choice: completed boss floor waits for a choice, then advances with promised threat/reward and no free player growth');

  await fresh();
  const queued = await page.evaluate(() => {
    const game = window.__game;
    for (let index = 0; index < 2; index++) {
      const chest = game.spawnChest(0, index * .2);
      for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
    }
    const gold = game.state.gold; game.tick(.01);
    return { gold: game.state.gold - gold, phase: game.state.phase, count: game.chestChoices.length };
  });
  assert.equal(queued.phase, 'relic'); assert.equal(queued.count, 3); assert.equal(queued.gold, 80);
  await page.locator('[data-chest-relic]').first().click();
  await page.evaluate(() => window.__game.tick(.01));
  assert.equal(await page.locator('[data-chest-relic]').count(), 3);
  await page.locator('[data-chest-relic]').first().click();
  assert.equal(await page.evaluate(() => window.__game.stats.relics.length), 2);
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  const completed = await page.evaluate(ids => {
    const game = window.__game; game.stats.relics = ids;
    const chest = game.spawnChest(0, 0); for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
    const gold = game.state.gold; game.tick(.01);
    return { gold: game.state.gold - gold, expectedGold: 40 * game.stats.goldMultiplier, phase: game.state.phase, count: game.chestChoices.length };
  }, RELICS.map(relic => relic.id));
  near(completed.gold, Math.round(completed.expectedGold * 100) / 100, 'all-owned chest retains its promised gold'); assert.equal(completed.phase, 'playing'); assert.equal(completed.count, 0);
  console.log('PASS chest edge cases: simultaneous rewards queue separately; a complete collection keeps gold without an empty-modal deadlock');

  await fresh();
  const boundary = await page.evaluate(() => {
    const game = window.__game;
    const boss = game.spawnBoss(); game.hitEnemy(boss, boss.hp + 1); if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); }
    const chest = game.spawnChest(0, 0); for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
    game._state.xp = game._state.xpNeeded; game._state.stageTime = game.state.stageDuration;
    const level = game.state.level; game.tick(.01);
    return { level, afterLevel: game.state.level, phase: game.state.phase, stage: game.state.stage, opened: chest.opened };
  });
  assert.equal(boundary.opened, true); assert.equal(boundary.phase, 'relic'); assert.equal(boundary.afterLevel, boundary.level); assert.equal(boundary.stage, 1);
  await page.locator('[data-chest-relic]').first().click();
  await page.evaluate(() => window.__game.tick(.01));
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'upgrade', 'a simultaneous earned level follows the chest without replacing it');
  await page.locator('[data-upgrade]').first().click();
  // Transition collection can earn further real levels from the boss/guards.
  // Select those normally rather than silently discarding their swept XP.
  for (let pending = 0; pending < 12; pending++) {
    await page.evaluate(() => window.__game.tick(.01));
    const phase = await page.evaluate(() => window.__game.state.phase);
    if (phase === 'route') break;
    assert.equal(phase, 'upgrade', 'remaining earned XP must still resolve through explicit choices');
    await page.locator('[data-upgrade]').first().click();
  }
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'route', 'only completed reward selections unlock the pending route');
  console.log('PASS reward ordering: simultaneous chest, earned level and cleared-floor route never overwrite one another');

  await fresh();
  await page.evaluate(() => {
    const game = window.__game, enemy = game.spawnEnemy(0, 2, 0); enemy.hp = enemy.maxHp = 10;
    game.attack(); game.invulnerable = 0; game.takeDamage(200, game.player.position); game.tick(.01);
  });
  const report = await page.evaluate(() => window.__game.state.runReport);
  assert.ok(report.damageBySource.sword > 0 && report.damageBySource.sword <= 10, 'damage report counts effective damage without overkill');
  assert.ok(report.damageTaken > 0); assert.ok(report.deathCause); assert.ok(report.peakCombo >= 1);
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'over');
  assert.ok((await page.locator('#modal').textContent()).includes('검'), 'results explain the actual damage build');
  console.log('PASS run analysis: actual damage without overkill, received damage, final cause and peak combo reach the result screen');

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1180, height: 820 }]) {
    await fresh(viewport);
    await page.evaluate(() => window.__game.openCurseAltar());
    await noPageScroll();
    const cards = page.locator('[data-curse]');
    for (let index = 0; index < await cards.count(); index++) {
      const card = cards.nth(index); await card.scrollIntoViewIfNeeded(); const bounds = await card.boundingBox();
      assert.ok(bounds && bounds.x >= -1 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y >= -1 && bounds.y < viewport.height, 'every risk card is reachable inside the viewport');
    }
    await noPageScroll();
    await page.locator('[data-curse="skip"]').click();
    assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
    await noPageScroll();
  }
  assert.deepEqual(errors, [], 'no uncaught runtime exceptions');
  console.log('PASS mobile/tablet details: portrait and landscape choices remain reachable with no document scrolling');
  console.log('All chosen-build, expedition and detail browser checks passed.');
} finally {
  await context?.close(); await browser.close();
}
