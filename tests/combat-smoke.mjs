import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ARENA_RADIUS, BOSS_SPAWN_TIME, STAGE_DURATION, MAX_STAGES } from '../src/balance.js';

// These tests shorten waiting with simulation steps and explicit combat fixtures.
// They verify real collision/spell/progression code, not normal-health victory balance.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const origin = process.env.BASE_URL || 'http://127.0.0.1:5173';
const errors = [];
let page;
async function freshRun() {
  if(!page){page=await manualPage(browser,{viewport:{width:1440,height:1000}});page.on('pageerror',error=>errors.push(error.message));await page.goto(origin);}
  else {await page.evaluate(()=>localStorage.clear());await page.reload();} // Fresh app state, shared browser shader cache.
  await page.waitForFunction(() => window.__game?.getDebugState().frames > 1);
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf)); // Domain fixtures advance time explicitly; keep menu rendering out of UI waits.
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  await page.locator('#start-button').click();
  await page.evaluate(() => { const g = window.__game; cancelAnimationFrame(g.raf);g.renderer.setPixelRatio(.5); const spawn = g.spawnEnemy.bind(g); /* Isolate baseline movement/collision; mutations have their own integration suite. */ g.spawnEnemy = (x,z,kind,options={}) => spawn(x,z,kind,{mutations:[],...options}); });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
}

try {
  assert.equal(ARENA_RADIUS, 90);
  assert.equal(STAGE_DURATION, 120);
  assert.equal(BOSS_SPAWN_TIME, 90);
  await freshRun();
  const traversal = await page.evaluate(() => {
    const game = window.__game;
    game.spawnTimer = 1e6;
    game.setMoveInput(1, 0);
    game.stepForTest(6);
    game.setMoveInput(0, 0);
    game.updateCamera(2);
    game.camera.updateMatrixWorld();
    const player = game.player.position;
    // The follow camera now frames the upper body while looking along the character.
    const projected = player.clone().add(player.clone().set(0, 2.35 * game.player.scale.y, 0)).project(game.camera);
    const feet = player.clone().project(game.camera);
    return { radius: Math.hypot(player.x, player.z), projected: [projected.x, projected.y], feet: [feet.x, feet.y], debug: game.getDebugState() };
  });
  assert.ok(traversal.radius > 31 && traversal.radius <= ARENA_RADIUS, 'the player can traverse beyond the old map boundary');
  assert.ok(Math.abs(traversal.projected[0]) < 0.2 && Math.abs(traversal.projected[1]) < 0.3, 'camera follows the upper body on the enlarged map');
  assert.ok(Math.abs(traversal.feet[0]) < 1 && Math.abs(traversal.feet[1]) < 1, 'the whole character remains in frame');
  console.log('PASS enlarged terrain arena: radius90, old boundary traversable, camera follows');

  await freshRun();
  await page.evaluate(() => {
    const game = window.__game;
    game.spawnTimer = 1e6; game.stats.critChance = 0;
    // Keep the XP fixture inside the measured 2.8m sword sector instead of
    // relying on random critical fireballs against an out-of-reach pack.
    for (let i = 0; i < 7; i++) {
      const enemy = game.spawnEnemy(2 + i * .05, (i - 3) * .1, 0);
      enemy.speed = 0;
    }
    for(let i=0;i<3&&game.state.phase==='playing';i++){window.testStrike(game,{x:1,z:0});game.stepForTest(.65);}
    if(game.state.phase==='playing')game.stepForTest(2);
  });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'upgrade', 'actual manually requested combat and collected XP lead to level up');
  assert.equal(await page.locator('[data-upgrade]').count(), 3);
  const spellChoice = page.locator('[data-upgrade^="spell_"]').first();
  assert.ok(await spellChoice.count(), 'every uncapped level-up includes a spell choice');
  const spellId = (await spellChoice.getAttribute('data-upgrade')).replace('spell_', '');
  const rankBefore = await page.evaluate(id => window.__game.stats.spells[id], spellId);
  await spellChoice.click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  assert.equal(await page.evaluate(id => window.__game.stats.spells[id], spellId), rankBefore + 1);
  assert.ok(await page.locator(`.spell-slot[data-spell="${spellId}"]`).isVisible());
  console.log('PASS growth: real kills → XP pickup → three choices including magic → learned/upgraded spell in HUD');

  // Additional magic, build and boss assertions follow below after their fixtures.
  for (const id of ['fireball', 'frost', 'lightning', 'orbit']) {
    await freshRun();
    const result = await page.evaluate(id => {
      const game = window.__game;
      game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0, [id]: 1 };
      game.stats.critChance = 0;
      game.magic.reset();
      game.spawnTimer = 1e6; game.attackTimer = 1e6; game.nextAltarTime = 1e6;
      const points = id === 'fireball' ? [[9, 0], [10, 1]] : id === 'lightning' ? [[7, 0], [11, 0], [15, 0]] : [[id === 'frost' ? 4 : 3.5, 0]];
      const targets = points.map(([x, z]) => { const enemy = game.spawnEnemy(x, z, 2); enemy.speed = 0; return enemy; });
      for(const e of targets)e.hp=e.maxHp=10000;
      const before = targets.map(enemy => enemy.hp);
      window.testCast(game,id);
      for (let step = 0; step < 55; step++) game.magic.update(1 / 60);
      let slowMovement = null;
      if (id === 'frost') {
        const enemy = targets[0]; enemy.speed = 4; enemy.stagger.set(0, 0, 0); enemy.hitTime = 0;
        const position = enemy.group.position.clone(); game.updateEnemies(.1);
        slowMovement = enemy.group.position.distanceTo(position);
      }
      return { before, after: targets.map(enemy => enemy.hp), slowTime: targets[0].slowTime, slowMovement, debug: game.magic.getDebugState(), fieldBound:game.magic.orbs.every(o=>o.parent===o.userData.field&&o.userData.field.parent===game.scene) };
    }, id);
    assert.ok(result.debug.spellsCast[id] >= 1, `${id} actually casts`);
    assert.ok(result.after.every((hp, index) => hp < result.before[index]), `${id} damages every intended target`);
    if (id === 'fireball') assert.ok(result.debug.hits >= 2, 'fireball explosion damages a nearby second enemy');
    if (id === 'frost') {
      assert.ok(result.slowTime > 1, 'frost applies a lasting slow');
      assert.ok(result.slowMovement <= .21, 'the short initial freeze and 50% slow constrain movement');
    }
    if (id === 'lightning') assert.ok(result.debug.hits >= 3, 'lightning chains across three separated enemies');
    if (id === 'orbit') assert.ok(result.debug.zones === 1 && result.debug.activeOrbit === 3 && result.fieldBound, 'runes belong to the manually installed field, with no body orbit');
  }
  console.log('PASS four distinct spells: fireball splash, frost slow/movement, chained lightning and damaging orbit');

  await freshRun();
  await page.evaluate(() => {
    const game = window.__game;
    // This max-rank fixture tests the actual offered evolution and selection flow.
    game.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 };
    game.stats.evolutions = { frost: true, lightning: true, orbit: true };
    game.dropPickup(game.player.position, 'xp', game.state.xpNeeded);
    game.stepForTest(.05);
  });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'upgrade');
  assert.ok(await page.locator('[data-upgrade="evolve_fireball"]').isVisible());
  await page.locator('[data-upgrade="evolve_fireball"]').click();
  assert.equal(await page.evaluate(() => window.__game.stats.evolutions.fireball), true);
  const evolution = await page.evaluate(() => {
    const game = window.__game;
    game.magic.reset();
    game.spawnEnemy(10, 0, 2);
    game.magic.castFireball();
    return { projectiles: game.magic.projectiles.length, evolved: game.magic.getState().find(spell => spell.id === 'fireball').evolved };
  });
  assert.equal(evolution.evolved, true);
  assert.equal(evolution.projectiles, 3, 'evolved fireball changes the attack pattern to three projectiles');
  assert.match(await page.locator('.spell-slot[data-spell="fireball"] .spell-slot-rank').textContent(), /진화/);
  console.log('PASS evolution: rank-five card → real evolved spell pattern → HUD');

  await freshRun();
  await page.evaluate(() => { window.__game._state.gold = 123; window.__game.emit(); });
  const damageBeforeBuild = await page.evaluate(() => window.__game.state.damage);
  await page.locator('#run-build-button').click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'paused');
  assert.ok(await page.locator('.skill-equip-row').first().isVisible());
  assert.equal(await page.locator('[data-buy]').count(), 0, 'the run build view cannot spend money');
  await page.locator('#modal-close').click();
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'playing');
  assert.equal(await page.evaluate(() => window.__game.state.gold), 123);
  assert.equal(await page.evaluate(() => window.__game.state.damage), damageBeforeBuild);
  console.log('PASS run build: read-only spell information pauses safely and preserves earned gold');

  await freshRun();
  const regeneration = await page.evaluate(() => {
    const game = window.__game;
    game.stats.maxHp = 1000; game._state.hp = 500; game.stats.regen = .2;
    game.spawnTimer = 1e6;
    game.tick(1);
    const regenerated = game.state.hp;
    game._state.hp = 999.9;
    game.tick(1);
    return { regenerated, capped: game.state.hp };
  });
  assert.ok(Math.abs(regeneration.regenerated - 502) < 1e-9, 'micro regeneration scales with maximum HP in later stages');
  assert.equal(regeneration.capped, 1000, 'regeneration never exceeds maximum HP');

  await freshRun();
  const bossGate = await page.evaluate(({ spawnTime, duration }) => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    game.spawnTimer = 1e6; game.attackTimer = 1e6; game.nextAltarTime = 1e6;
    game._state.hp = 37; game._state.xpNeeded = 1e9;
    game.actions.syncSlots();
    const unchangedStats = JSON.stringify(game.stats);
    game._state.stageTime = spawnTime - .01;
    game.tick(.02);
    const spawned = game.bossSpawned && game.boss?.kind === 4;
    const initialBoss = game.boss;
    game.tick(.02);
    const once = game.boss === initialBoss && game.enemies.filter(enemy => enemy.kind === 4).length === 1;
    game._state.stageTime = duration - .01;
    game.tick(.02);
    const blockedAlive = game.state.stage === 1 && game.state.stageTime === duration && !game.nextStage();
    // Test both gates independently: killing early does not waive survival time.
    game._state.stageTime = duration - 10;
    game.hitEnemy(game.boss, game.boss.hp + 1, game.player.position.clone().set(1, 0, 0));
    if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); }
    const blockedEarly = game.bossDefeated && !game.nextStage() && game.state.stage === 1;
    game._state.stageTime = duration;
    game.tick(1 / 60);
    const routeOffered = game.state.phase === 'route' && game.state.stage === 1;
    if (!routeOffered || !game.chooseRoute('standard')) throw new Error('Completed floor must choose a route before advancing');
    if (game.state.phase === 'region' && !game.chooseRegion(game.regionChoices[0].id)) throw new Error('A regional choice must complete the floor transition');
    return { spawned, once, blockedAlive, blockedEarly, routeOffered, stage: game.state.stage, hp: game.state.hp, maxHp: game.state.maxHp, statsUnchanged: JSON.stringify(game.stats) === unchangedStats, bossReset: !game.bossSpawned && !game.bossDefeated };
  }, { spawnTime: BOSS_SPAWN_TIME, duration: STAGE_DURATION });
  assert.equal(bossGate.spawned, true);
  assert.equal(bossGate.once, true);
  assert.equal(bossGate.blockedAlive, true);
  assert.equal(bossGate.blockedEarly, true);
  assert.equal(bossGate.routeOffered, true);
  assert.equal(bossGate.stage, 2);
  assert.equal(bossGate.hp, 37, 'clearing a floor preserves current health without an automatic full heal');
  assert.equal(bossGate.maxHp, 100);
  assert.equal(bossGate.statsUnchanged, true, 'boss defeat and the next floor cannot improve stats without a selected card');
  assert.equal(bossGate.bossReset, true);
  console.log('PASS boss progression: both survival and boss defeat required; next floor resets encounters without changing stats or health');

  await freshRun();
  const bossAttacks = await page.evaluate(() => {
    const game = window.__game;
    const boss = game.spawnBoss(); boss.group.position.set(5, 0, 0);
    boss.actionIndex = 1; boss.actionTimer = .01;
    const initial = game.state.hp;
    game.updateBoss(boss, .02);
    const warning = boss.mode === 'pulse-warning' && !!boss.telegraph;
    game.updateBoss(boss, .4);
    const safeDuringWarning = game.state.hp === initial;
    game.updateBoss(boss, .7);
    const pulseDamage = game.state.hp < initial;
    const beforeDash = game.state.hp;
    game.invulnerable = 0; boss.mode = 'pulse-warning';boss.recoveryTime=0; boss.actionTimer = .01;
    game.createBossTelegraph(boss, 'pulse');
    const dashed = game.dash();
    game.updateBoss(boss, .02);
    const dashBlocked = game.state.hp === beforeDash;
    let chargeAligned = true;
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      boss.chargeDirection.set(x, 0, z).normalize();
      game.createBossTelegraph(boss, 'charge');
      boss.telegraph.updateMatrixWorld();
      const longAxis = boss.chargeDirection.clone().setFromMatrixColumn(boss.telegraph.matrixWorld, 1).normalize();
      chargeAligned &&= Math.abs(longAxis.dot(boss.chargeDirection)) > .999999;
    }
    return { warning, safeDuringWarning, pulseDamage, dashed, dashBlocked, chargeAligned };
  });
  assert.deepEqual(bossAttacks, { warning: true, safeDuringWarning: true, pulseDamage: true, dashed: true, dashBlocked: true, chargeAligned: true });
  console.log('PASS boss attacks: aligned charge warning, visible windup before damage, dash avoids the pulse');

  await freshRun();
  const ranged = await page.evaluate(() => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    game._state.stage = 3;
    const enemy = game.spawnEnemy(12, 0, 3); enemy.shootTimer = 0;
    game.updateEnemies(.01);
    const warned = enemy.windup > 0 && !!enemy.warning;
    game.updateEnemies(.7);
    const fired = game.enemyProjectiles.length > 0;
    const before = game.state.hp;
    for (let tick = 0; tick < 80 && game.enemyProjectiles.length; tick++) game.updateEnemyProjectiles(.02);
    const hit = game.state.hp < before;
    game.clearEnemyProjectiles(); game.invulnerable = 0;
    const beforeDash = game.state.hp;
    game.dash();
    const source = game.player.position.clone().add(game.player.position.clone().set(.5, 0, 0));
    game.shootEnemyProjectile(source, game.player.position.clone().set(-1, 0, 0), { speed: 1, damage: 10 });
    game.updateEnemyProjectiles(.01);
    const dashBlocked = game.state.hp === beforeDash;
    game.invulnerable = 0;
    game.shootEnemyProjectile(source, game.player.position.clone().set(-1, 0, 0), { speed: 1, damage: 10 });
    game.updateEnemyProjectiles(.01);
    const afterInvulnerability = game.state.hp === beforeDash - 10;
    const close = game.spawnEnemy(3, 0, 3); close.shootTimer = 100;
    const distanceBefore = close.group.position.length(); game.updateEnemies(.1);
    const retreats = close.group.position.length() > distanceBefore;
    const savedRandom = Math.random;
    let earlyKind, lateKind;
    try {
      Math.random = () => .8;
      game._state.stage = 1; earlyKind = game.spawnEnemy(20, 20).kind;
      game._state.stage = 3; lateKind = game.spawnEnemy(20, -20).kind;
    } finally { Math.random = savedRandom; }
    return { warned, fired, hit, dashBlocked, afterInvulnerability, retreats, earlyKind, lateKind };
  });
  assert.equal(ranged.warned, true);
  assert.equal(ranged.fired, true);
  assert.equal(ranged.hit, true);
  assert.equal(ranged.dashBlocked, true);
  assert.equal(ranged.afterInvulnerability, true);
  assert.equal(ranged.retreats, true);
  assert.notEqual(ranged.earlyKind, 3);
  assert.equal(ranged.lateKind, 3);
  console.log('PASS ranged enemies: stage-three introduction, standoff/retreat, windup, damaging bolts and dash protection');

  await freshRun();
  const finalGate = await page.evaluate(({ duration, finalStage }) => {
    const game = window.__game;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };game.actions.syncSlots();
    game.spawnTimer = 1e6; game.attackTimer = 1e6; game.nextAltarTime = 1e6;
    game._state.stage = finalStage; game._state.stageTime = duration - .01;
    const boss = game.spawnBoss();
    game.tick(.02);
    const blocked = game.state.phase !== 'won' && game.state.stage === finalStage;
    game.hitEnemy(boss, boss.hp + 1, game.player.position.clone().set(1, 0, 0)); if (game.equipment?.rewardQueue.length) { game.equipment.nextReward(); document.querySelector('[data-equipment-choice="skip"]')?.click(); }
    game.tick(1 / 60);
    return { blocked, phase: game.state.phase, bossDefeated: game.bossDefeated };
  }, { duration: STAGE_DURATION, finalStage: MAX_STAGES });
  assert.equal(finalGate.blocked, true);
  assert.equal(finalGate.phase, 'won');
  assert.equal(finalGate.bossDefeated, true);
  assert.ok(await page.locator('.modal-result').isVisible());
  console.log('PASS final stage: living final boss blocks victory, actual boss defeat unlocks the win result');

  assert.deepEqual(errors, [], 'no uncaught browser exceptions');
  console.log('All combat and roguelike growth checks passed.');
} finally {
  await page?.close();
  await browser.close();
}
