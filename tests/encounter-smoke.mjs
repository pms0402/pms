import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { STAGES, BOSS_TYPES, ENEMY_TYPES, getEnemyPool } from '../src/encounters.js';

// Fixtures shorten waits and select encounters, but warnings, movement, shots,
// damage, summons, drops and floor transitions use the real game systems.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} ≈ ${expected}`);
let context, page;

async function load(viewport = { width: 1440, height: 1000 }) {
  await context?.close();
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200, isMobile: viewport.width < 1000 });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  await page.locator('#start-button').click();
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf));
}

async function fixture(stage = 1) {
  await page.evaluate(stage => {
    const game = window.__game;
    game.start(); cancelAnimationFrame(game.raf);
    game._state.stage = stage; game._state.xpNeeded = 1e9;
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = 1e6;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game.stats.critChance = 0; game.stats.regen = 0;
    game.emit();
  }, stage);
}

try {
  assert.equal(STAGES.length, 10); assert.equal(Object.keys(BOSS_TYPES).length, 6);
  assert.equal(ENEMY_TYPES.length, 9);
  assert.deepEqual(ENEMY_TYPES.filter(enemy => enemy.kind >= 5).map(enemy => enemy.kind), [5, 6, 7, 8, 9]);
  for (const enemy of ENEMY_TYPES) {
    assert.ok(getEnemyPool(enemy.unlockStage).some(candidate => candidate.kind === enemy.kind));
    if (enemy.unlockStage > 1) assert.ok(getEnemyPool(enemy.unlockStage - 1).every(candidate => candidate.kind !== enemy.kind));
  }
  assert.ok(getEnemyPool(10).every(enemy => enemy.kind !== 4), 'normal spawns never randomly select a boss');
  await load(); await fixture();

  const charger = await page.evaluate(() => {
    const game = window.__game, enemy = game.spawnEnemy(8, 0, 5); enemy.actionTimer = 0;
    const before = enemy.group.position.clone(); game.updateEnemies(.01);
    const warning = { action: enemy.action, visible: !!enemy.telegraph?.parent, hp: game.state.hp, aim: enemy.aim.toArray() };
    game.hitEnemy(enemy, 1, enemy.aim.clone().negate());
    game.player.position.z = 6; game.updateEnemies(.4);
    const held = enemy.group.position.distanceTo(before);
    game.updateEnemies(.36); game.updateEnemies(.1);
    return { warning, held, action: enemy.action, x: enemy.group.position.x, z: enemy.group.position.z, hp: game.state.hp };
  });
  assert.equal(charger.warning.action, 'charge-warning'); assert.equal(charger.warning.visible, true);
  near(charger.held, 0, 'charger holds position during its warning');
  assert.equal(charger.action, 'rush'); assert.ok(charger.x < 7 && Math.abs(charger.z) < .01, 'rush follows its locked warning rather than the moved player');
  assert.equal(charger.hp, charger.warning.hp);
  console.log('PASS charger: visible warning, held position, locked-direction burst with counterplay');

  await fixture();
  const bomber = await page.evaluate(() => {
    const game = window.__game;
    const enemy = game.spawnEnemy(2.5, 0, 6); enemy.actionTimer = 0;
    game.updateEnemies(.01);
    const warning = { action: enemy.action, visible: !!enemy.telegraph?.parent, hp: game.state.hp };
    game.updateEnemies(.5); const hpBeforeEscape = game.state.hp;
    game.player.position.z = 8; game.updateEnemies(.51);
    const escaped = { hp: game.state.hp, alive: game.enemies.includes(enemy), drops: game.pickups.length, kills: game.state.kills };
    game.player.position.set(0, 0, 0);
    const next = game.spawnEnemy(2.5, 0, 6); next.actionTimer = 0;
    game.updateEnemies(.01); game.invulnerable = 0; game.updateEnemies(1.01);
    return { warning, hpBeforeEscape, escaped, hitHp: game.state.hp, hitDrops: game.pickups.length, kills: game.state.kills };
  });
  assert.equal(bomber.warning.action, 'detonate-warning'); assert.equal(bomber.warning.visible, true);
  assert.equal(bomber.hpBeforeEscape, bomber.warning.hp, 'bomber warning itself deals no damage');
  assert.equal(bomber.escaped.hp, bomber.warning.hp, 'moving outside the warned radius avoids the explosion');
  assert.equal(bomber.escaped.alive, false); assert.equal(bomber.escaped.drops, 0); assert.equal(bomber.escaped.kills, 0);
  assert.ok(bomber.hitHp < bomber.warning.hp, 'staying inside the same warning suffers real explosion damage');
  assert.equal(bomber.hitDrops, 0); assert.equal(bomber.kills, 0, 'self-destruction never awards free kill money');
  console.log('PASS bomber: readable fuse, avoidable area damage and no free self-destruction payout');

  await fixture(6);
  const splitter = await page.evaluate(() => {
    const game = window.__game, parent = game.spawnEnemy(10, 0, 7), parentHp = parent.maxHp;
    game.hitEnemy(parent, parent.hp + 1);
    const children = game.enemies.filter(enemy => enemy.splitChild);
    const info = children.map(enemy => ({ kind: enemy.kind, minion: enemy.minion, hp: enemy.maxHp, size: enemy.size }));
    for (const child of children) game.hitEnemy(child, child.hp + 1);
    const recursivelySplit = game.enemies.filter(enemy => enemy.splitChild).length;
    while (game.enemies.length < 159) game.spawnEnemy(20, 20, 0);
    const crowded = game.spawnEnemy(10, 0, 7); game.hitEnemy(crowded, crowded.hp + 1);
    return { parentHp, children: info, recursivelySplit, crowdedCount: game.enemies.length, crowdedChildren: game.enemies.filter(enemy => enemy.splitChild).length };
  });
  assert.equal(splitter.children.length, 2);
  assert.ok(splitter.children.every(child => child.kind === 1 && child.minion && child.hp < splitter.parentHp));
  assert.equal(splitter.recursivelySplit, 0); assert.equal(splitter.crowdedCount, 160); assert.equal(splitter.crowdedChildren, 1);
  console.log('PASS splitter: actual death creates two weaker children, no recursive splitting, crowd cap respected');

  await fixture();
  const sniper = await page.evaluate(() => {
    const game = window.__game, enemy = game.spawnEnemy(20, 0, 8); enemy.shootTimer = 0;
    game.updateEnemies(.01);
    const warning = { action: enemy.action, visible: !!enemy.telegraph?.parent, aim: enemy.aim.clone() };
    game.updateEnemies(1.1); const earlyShots = game.enemyProjectiles.length;
    game.player.position.z = 6; game.updateEnemies(.11);
    const shot = game.enemyProjectiles[0];
    const dot = shot.velocity.clone().normalize().dot(warning.aim), speed = shot.velocity.length();
    game.player.position.copy(shot.mesh.position); game.player.position.y = 0;
    game.invulnerable = 0; const hp = game.state.hp;
    game.dash(); game.updateEnemyProjectiles(.001);
    const dashHp = game.state.hp;
    game.clearEnemyProjectiles();
    game.shootEnemyProjectile(enemy, warning.aim, { speed: 17 });
    game.player.position.copy(game.enemyProjectiles[0].mesh.position); game.player.position.y = 0;
    game.invulnerable = 0; game.updateEnemyProjectiles(.001);
    return { action: warning.action, visible: warning.visible, earlyShots, dot, speed, hp, dashHp, hitHp: game.state.hp };
  });
  assert.equal(sniper.action, 'snipe-warning'); assert.equal(sniper.visible, true); assert.equal(sniper.earlyShots, 0);
  assert.ok(sniper.dot > .999); near(sniper.speed, 17, 'sniper projectile travels faster than ordinary bolts');
  assert.equal(sniper.dashHp, sniper.hp, 'an invulnerable dash avoids an actual sniper projectile');
  assert.ok(sniper.hitHp < sniper.dashHp, 'the same projectile collision damages an unprotected player');
  console.log('PASS sniper: long locked aim, real fast bolt, dash avoidance and unprotected collision damage');

  await fixture();
  const shaman = await page.evaluate(() => {
    const game = window.__game, healer = game.spawnEnemy(15, 0, 9); healer.actionTimer = 0;
    const allies = Array.from({ length: 7 }, (_, index) => game.spawnEnemy(13 + index * .4, 1, 0));
    for (const ally of allies) { ally.hp = ally.maxHp * .5; ally.speed = 0; }
    const boss = game.spawnBoss(); boss.group.position.set(16, 0, 0); boss.hp = boss.maxHp * .5;
    const bossHp = boss.hp; game.updateEnemies(.01);
    const warning = healer.action === 'heal-warning' && !!healer.telegraph?.parent;
    game.updateEnemies(.81);
    return { warning, bossHp, afterBossHp: boss.hp, healed: allies.filter(ally => ally.hp > ally.maxHp * .5).length, fractions: allies.map(ally => ally.hp / ally.maxHp), casts: healer.specialCasts };
  });
  assert.equal(shaman.warning, true); assert.equal(shaman.casts, 1); assert.equal(shaman.healed, 5);
  assert.equal(shaman.afterBossHp, shaman.bossHp, 'shaman cannot heal a boss');
  assert.ok(shaman.fractions.every(fraction => fraction >= .5 && fraction <= .55 + 1e-9), 'each cast has a bounded five-percent heal');
  console.log('PASS shaman: healing warning, at most five ordinary allies, bounded healing and boss exclusion');

  const patterns = {};
  for (const [stage, type] of [[1, 'warden'], [2, 'artillery'], [3, 'plague'], [4, 'brood'], [5, 'storm'], [6, 'reaper']]) {
    await fixture(stage);
    patterns[type] = await page.evaluate(() => {
      const game = window.__game, boss = game.spawnBoss(); boss.group.position.set(18, 0, 0); boss.actionTimer = 0;
      game.updateBoss(boss, .01);
      const warning = { archetype: boss.archetype, mode: boss.mode, zones: game.bossSystem.zones.length, telegraph: !!boss.telegraph?.parent, position: boss.group.position.toArray(), target: boss.blinkTarget?.toArray(), aim: boss.aimDirection?.toArray(), hp: game.state.hp };
      if (boss.archetype === 'plague') {
        for (let index = 0; index < 10; index++) game.bossSystem.updateEffects(.1);
        warning.safeDuringWarning = game.state.hp === warning.hp;
        game.player.position.set(0, 0, 12);
        for (let index = 0; index < 3; index++) game.bossSystem.updateEffects(.1);
        warning.safeOutsidePools = game.state.hp === warning.hp;
        const zone = game.bossSystem.zones[0];
        game.player.position.copy(zone.position); game.invulnerable = 0;
        game.bossSystem.updateEffects(.01);
        warning.damagedInsidePool = game.state.hp < warning.hp;
      } else {
        game.player.position.set(0, 0, 16);
        game.updateBoss(boss, 1.21);
        for (let index = 0; index < 10; index++) game.bossSystem.updateEffects(.1);
      }
      const result = { warning, after: { mode: boss.mode, position: boss.group.position.toArray(), bolts: game.enemyProjectiles.length, minions: game.enemies.filter(enemy => enemy.minion).length, zones: game.bossSystem.zones.length, casts: game.bossSystem.getDebugState().actions }, velocities: game.enemyProjectiles.map(shot => shot.velocity.toArray()) };
      if (boss.archetype === 'storm') {
        boss.mode = 'chase'; boss.actionTimer = 0; game.updateBoss(boss, .01);
        result.secondWarning = boss.mode;
        result.secondRadius = Math.max(...game.bossSystem.zones.map(zone => zone.radius));
      }
      game.hitEnemy(boss, boss.hp + 1);
      result.afterDeath = game.bossSystem.getDebugState();
      result.boltsAfterDeath = game.enemyProjectiles.length;
      return result;
    });
    assert.equal(patterns[type].warning.archetype, type);
    assert.match(patterns[type].warning.mode, /warning$/, `${type} must warn before resolving`);
    assert.equal(patterns[type].afterDeath.zones, 0); assert.equal(patterns[type].afterDeath.pendingShots, 0);
    assert.equal(patterns[type].boltsAfterDeath, 0, 'a dead boss cannot leave owned bullets active');
  }
  assert.equal(patterns.warden.warning.mode, 'charge-warning'); assert.equal(patterns.warden.warning.telegraph, true);
  assert.equal(patterns.artillery.warning.mode, 'barrage-warning'); assert.ok(patterns.artillery.after.bolts >= 6);
  assert.equal(patterns.plague.warning.zones, 3);
  assert.equal(patterns.plague.warning.safeDuringWarning, true); assert.equal(patterns.plague.warning.safeOutsidePools, true); assert.equal(patterns.plague.warning.damagedInsidePool, true);
  assert.equal(patterns.brood.warning.mode, 'summon-warning'); assert.ok(patterns.brood.after.minions >= 4 && patterns.brood.after.minions <= 6);
  assert.equal(patterns.storm.warning.mode, 'radial-warning'); assert.ok(patterns.storm.after.bolts >= 10);
  assert.equal(patterns.storm.secondWarning, 'nova-warning'); assert.ok(patterns.storm.secondRadius >= 8);
  assert.equal(patterns.reaper.warning.mode, 'blink-warning');
  assert.deepEqual(patterns.reaper.after.position, patterns.reaper.warning.target, 'reaper teleports to its previously marked location');
  assert.ok(patterns.reaper.after.bolts >= 12, 'reaper follows its blink with delayed cross-fire');
  console.log('PASS six boss archetypes: charge, artillery, avoidable poison, summons, radial/nova and marked blink/cross-fire; death clears attacks');

  await fixture(3);
  const cleanup = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss(); boss.actionTimer = 0; game.updateBoss(boss, .01);
    const warning = game.bossSystem.zones[0].warning;
    game.pause(); game.stepForTest(2);
    const pausedWarning = game.bossSystem.zones[0].warning;
    game.start(); game.spawnTimer = game.attackTimer = 1e6; game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    const hp = game.state.hp; game.stepForTest(.5);
    return { warning, pausedWarning, debug: game.bossSystem.getDebugState(), hp, afterHp: game.state.hp };
  });
  assert.equal(cleanup.warning, cleanup.pausedWarning, 'pause freezes warning timers and delayed damage');
  assert.equal(cleanup.debug.zones, 0); assert.equal(cleanup.debug.pendingShots, 0); assert.equal(cleanup.hp, cleanup.afterHp);
  console.log('PASS attack cleanup: pause freezes effects and restart removes all residual zones and delayed damage');

  await fixture(4);
  const stress = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss();
    while (game.enemies.length < 160) game.spawnEnemy(20, 20, 0);
    for (let index = 0; index < 15; index++) { boss.mode = 'chase'; boss.actionTimer = 0; game.updateBoss(boss, .01); game.updateBoss(boss, 1.2); }
    const summons = game.bossSystem.summoned;
    for (let index = 0; index < 50; index++) {
      game.bossSystem.zone(game.player.position, 2, 1, 2, 1);
      game.bossSystem.schedule(boss, 1, game.player.position.clone().set(1, 0, 0), { count: 12 });
      game.shootEnemyProjectile(boss, game.player.position.clone().set(1, 0, 0), { count: 12 });
    }
    return { enemies: game.enemies.length, summons, bolts: game.enemyProjectiles.length, zones: game.bossSystem.zones.length, pending: game.bossSystem.pendingShots.length, shadows: game.renderer.shadowMap.enabled };
  });
  assert.ok(stress.enemies <= 161); assert.ok(stress.summons <= 18); assert.ok(stress.bolts <= 80); assert.ok(stress.zones <= 12); assert.ok(stress.pending <= 12); assert.equal(stress.shadows, true);
  console.log('PASS encounter limits: crowds, summons, bolts, zones and pending attacks stay bounded while shadows remain enabled');

  await fixture(5);
  const fifth = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss(); game.hitEnemy(boss, boss.hp + 1);
    game._state.stageTime = game.state.stageDuration;
    const advanced = game.nextStage();
    return { advanced, stage: game.state.stage, phase: game.state.phase };
  });
  assert.deepEqual(fifth, { advanced: true, stage: 6, phase: 'playing' }, 'the old fifth-floor ending now continues into floor six');
  await fixture(10);
  const final = await page.evaluate(() => {
    const game = window.__game, boss = game.spawnBoss(); game._state.stageTime = game.state.stageDuration;
    game.emit();
    const livingGate = game.nextStage();
    const names = { stage: document.querySelector('#stage-name').textContent, counter: document.querySelector('#stage-number').textContent, routes: document.querySelectorAll('.route-stop').length };
    game.hitEnemy(boss, boss.hp + 1);
    const won = game.nextStage();
    return { livingGate, names, won, phase: game.state.phase, stage: game.state.stage };
  });
  assert.equal(final.livingGate, false); assert.equal(final.names.stage, STAGES[9].name); assert.equal(final.names.counter, '10'); assert.equal(final.names.routes, 10);
  assert.equal(final.won, true); assert.equal(final.phase, 'won'); assert.equal(final.stage, 10);
  assert.match(await page.locator('.modal-result').textContent(), /10\s*\/\s*10/);
  console.log('PASS ten-floor progression: fifth floor continues, living final guardian blocks victory, final defeat shows10/10');

  for (const viewport of [{ width: 1180, height: 820 }, { width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await load(viewport); await fixture(10);
    await page.evaluate(() => { window.__game.spawnBoss(); window.__game.emit(); });
    const hud = await page.evaluate(() => {
      const arena = document.querySelector('.arena').getBoundingClientRect(), boss = document.querySelector('#boss-hud').getBoundingClientRect();
      return { height: boss.height, top: boss.top - arena.top, width: document.documentElement.scrollWidth, heightScroll: document.documentElement.scrollHeight, availableWidth: innerWidth, availableHeight: innerHeight };
    });
    assert.ok(hud.height <= 35 && hud.top <= 12 && hud.top >= 0, 'ten-floor encounters retain the compact top boss bar');
    assert.ok(hud.width <= hud.availableWidth + 1 && hud.heightScroll <= hud.availableHeight + 1);
    if (viewport.width < 1000) {
      assert.equal(await page.locator('#touch-controls').isVisible(), true);
      const before = await page.evaluate(() => window.__game.player.position.toArray());
      await page.evaluate(() => { const game = window.__game; game.setMoveInput(1, 0); game.stepForTest(.2); game.setMoveInput(0, 0); });
      const after = await page.evaluate(() => window.__game.player.position.toArray());
      assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > .5);
    }
  }
  assert.deepEqual(errors, [], 'no uncaught browser errors');
  console.log('PASS responsive encounters: compact top bar, touch movement and no page scroll on iPad, portrait and landscape');
  console.log('All expanded encounter browser checks passed.');
} finally {
  await context?.close(); await browser.close();
}
