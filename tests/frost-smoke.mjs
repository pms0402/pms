import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Mechanical regression fixtures use a durable target to observe movement and
// control effects, not to claim ordinary-health victory or full-run balance.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, label) => assert.ok(Math.abs(actual - expected) < 1e-7, `${label}: ${actual} ≈ ${expected}`);
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  await page.locator('#start-button').click();
  await page.evaluate(() => {
    const game = window.__game; cancelAnimationFrame(game.raf);
    window.frostFixture = () => {
      game.start(); cancelAnimationFrame(game.raf);
      game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
      game.stats.spells = { fireball: 0, frost: 1, lightning: 0, orbit: 0 };
      game.stats.critChance = 0; game._state.xpNeeded = 1e9;
      const enemy = game.spawnEnemy(0, 5, 0); enemy.hp = enemy.maxHp = 1e6; enemy.speed = 0;
      return { game, enemy };
    };
  });

  const impacts = await page.evaluate(() => {
    const { game, enemy } = window.frostFixture();
    game.magic.castFrost();
    const fresh = { push: enemy.stagger.length(), hitTime: enemy.hitTime, slowTime: enemy.slowTime, factor: enemy.slowFactor, hp: enemy.hp };
    const direction = enemy.group.position.clone().normalize();
    game.hitEnemy(enemy, 1, direction, 'sword');
    const sword = { push: enemy.stagger.toArray(), hitTime: enemy.hitTime };
    enemy.hitTime = .07;
    game.magic.castFrost();
    const retained = { push: enemy.stagger.toArray(), hitTime: enemy.hitTime };
    enemy.stagger.set(0, 0, 0); enemy.hitTime = 0; game.stats.critChance = .65;
    const random = Math.random;
    try { Math.random = () => 0; game.magic.castFrost(); } finally { Math.random = random; }
    return { fresh, sword, retained, critical: { push: enemy.stagger.length(), hitTime: enemy.hitTime } };
  });
  near(impacts.fresh.push, 0, 'normal frost adds no displacement');
  near(impacts.fresh.hitTime, 0, 'normal frost adds no hit stun');
  near(impacts.fresh.slowTime, 1.4, 'frost retains its shorter timed slow');
  near(impacts.fresh.factor, .6, 'base frost slows by forty percent');
  assert.ok(impacts.fresh.hp < 1e6, 'frost still deals real damage');
  assert.ok(Math.hypot(...impacts.sword.push) > 0 && impacts.sword.hitTime > 0, 'sword keeps its impact');
  assert.deepEqual(impacts.retained.push, impacts.sword.push, 'a frost hit does not erase or replace an earlier sword push');
  near(impacts.retained.hitTime, .07, 'frost does not restart earlier sword hit stun');
  near(impacts.critical.push, 0, 'a critical frost cannot reintroduce knockback');
  near(impacts.critical.hitTime, 0, 'a critical frost cannot reintroduce hit stun');
  console.log('PASS frost impact: damage and timed slow remain, while ordinary/critical frost cannot push or restart hit stun');

  const blizzard = await page.evaluate(() => {
    const { game, enemy } = window.frostFixture();
    game.stats.spells.frost = 5; game.stats.evolutions.frost = true;
    game.magic.castFrost();
    const pulse = { hp: enemy.hp, factor: enemy.slowFactor, slow: enemy.slowTime };
    enemy.slowTime = 0; enemy.stagger.set(0, 0, 0); enemy.hitTime = 0;
    game.magic.updateZones(.5);
    const zone = { hp: enemy.hp, factor: enemy.slowFactor, slow: enemy.slowTime, push: enemy.stagger.length(), hitTime: enemy.hitTime };
    game.magic.updateZones(.9); game.magic.updateZones(.9); game.magic.updateZones(.11);
    return { pulse, zone, zones: game.magic.zones.length };
  });
  near(blizzard.pulse.factor, .45, 'evolved main pulse slows by fifty-five percent');
  near(blizzard.pulse.slow, 1.8, 'evolved pulse has a finite shorter duration');
  assert.ok(blizzard.zone.hp < blizzard.pulse.hp, 'lingering blizzard still deals real damage');
  near(blizzard.zone.factor, .7, 'lingering blizzard has a weaker thirty-percent slow');
  near(blizzard.zone.slow, .7, 'lingering slow cannot cover every tick');
  near(blizzard.zone.push, 0, 'blizzard ticks add no push'); near(blizzard.zone.hitTime, 0, 'blizzard ticks add no hit stun');
  assert.equal(blizzard.zones, 0, 'the blizzard expires rather than stacking forever');
  console.log('PASS evolved frost: finite weaker blizzard ticks deal damage without repeated displacement or hit stun');

  const shatter = await page.evaluate(() => {
    const { game, enemy } = window.frostFixture();
    game.stats.passiveLevels.blade_range = 2; enemy.slowTime = 1;
    const splash = game.spawnEnemy(0, 6, 0); splash.hp = splash.maxHp = 1000; splash.speed = 0;
    game.magic.onSwordHit(enemy, 100);
    return { hp: splash.hp, push: splash.stagger.length(), hitTime: splash.hitTime, source: game.state.runReport.damageBySource.combo };
  });
  assert.ok(shatter.hp < 1000 && shatter.source > 0, 'the frost/sword combo still applies its real splash');
  near(shatter.push, 0, 'shatter splash cannot create a second frost knockback'); near(shatter.hitTime, 0, 'shatter splash adds no crowd-locking hit stun');
  console.log('PASS ice combo: shatter damage remains while its splash cannot extend crowd lock');

  const approach = await page.evaluate(() => {
    const { game, enemy } = window.frostFixture();
    game.stats.spells.frost = 5; game.stats.evolutions.frost = true; game.stats.spellRate = 1e6;
    enemy.group.position.set(0, 0, 8); enemy.speed = 3;
    game.magic.reset(); game.magic.cooldowns.frost = 0;
    let elapsed = 0, previous = 0, maxPush = 0, maxHitStun = 0, maxZones = 0, outwardSteps = 0, afterPulseTravel = 0;
    const casts = [], startHp = game.state.hp;
    for (let frame = 0; frame < 720; frame++) {
      const dt = 1 / 60; elapsed += dt; game._state.elapsed += dt;
      game.invulnerable = Math.max(0, game.invulnerable - dt);
      const before = enemy.group.position.length();
      game.magic.update(dt);
      maxPush = Math.max(maxPush, enemy.stagger.length()); maxHitStun = Math.max(maxHitStun, enemy.hitTime);
      maxZones = Math.max(maxZones, game.magic.zones.length);
      if (game.magic.spellsCast.frost !== previous) { previous = game.magic.spellsCast.frost; casts.push(elapsed); }
      game.updateEnemies(dt); game.animateEffects(dt);
      const after = enemy.group.position.length();
      if (after > before + 1e-6) outwardSteps++;
      if (elapsed > 1.85 && elapsed < 2.7) afterPulseTravel += Math.max(0, before - after);
      if (game.state.hp < startHp) break;
    }
    return { elapsed, hp: game.state.hp, startHp, distance: enemy.group.position.length(), casts, maxPush, maxHitStun, maxZones, outwardSteps, afterPulseTravel, enemyHp: enemy.hp, cooldown: game.magic.maxCooldown('frost') };
  });
  near(approach.cooldown, 2.75, 'even excessive spell haste cannot skip the frost cooldown floor');
  assert.ok(approach.casts.length >= 2, 'the approach happens under repeated actual frost casts');
  for (let i = 1; i < approach.casts.length; i++) assert.ok(approach.casts[i] - approach.casts[i - 1] >= 2.75 - 1e-6, 'actual recasts obey the minimum interval');
  assert.ok(approach.hp < approach.startHp && approach.elapsed < 12, 'a durable melee enemy can approach and land contact damage against stationary maximum-haste evolved frost');
  assert.ok(approach.afterPulseTravel > 0.5, 'the enemy has meaningful movement between pulses');
  near(approach.maxPush, 0, 'frost never adds an outward velocity during the approach');
  near(approach.maxHitStun, 0, 'frost never repeatedly stops enemy movement through hit stun');
  assert.equal(approach.outwardSteps, 0); assert.ok(approach.maxZones <= 1, 'short-lived zones cannot pile up at maximum haste');
  assert.ok(approach.enemyHp < 1e6, 'the approaching enemy still takes frost damage');
  console.log(`PASS maximum-haste approach: enemy reached contact in ${approach.elapsed.toFixed(2)}s despite evolved frost; no displacement, no stun and no overlapping blizzards`);
  assert.deepEqual(errors, []);
  console.log('All frost crowd-control regression checks passed.');
} finally { await browser.close(); }
