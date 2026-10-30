import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { normalizeProgress } from '../src/progression.js';

// Fixtures shorten travel and give durable targets; all choices, hits, enemy
// damage, deaths and rendered resources below use the actual game modules.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const saved = normalizeProgress({ bank: 987654321, lifetimeGold: 1234567890,
  upgrades: { power: 3, arcana: 4, vitality: 2 }, settledRunIds: ['older-run'],
  unlocks: { characters: ['wanderer', 'arcanist'], weapons: ['voidblade', 'greatsword'] },
  loadout: { character: 'wanderer', weapon: 'voidblade' }, importedHistory: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const errors = [], gpuErrors = [];
const near = (a, b, label) => assert.ok(Math.abs(a - b) < 1e-6, `${label}: ${a} ≈ ${b}`);
let page;

async function fixture() { await page.evaluate(() => window.expansionFixture()); }
async function noPageScroll() {
  const size = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  assert.ok(size.every(n => n <= 1), `no document scrolling: ${size}`);
}

try {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  await context.addInitScript(progress => localStorage.setItem('voidrun.progression', JSON.stringify(progress)), saved);
  page = await manualPage(context,);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/GL_INVALID|Shader Error|VALIDATE_STATUS|THREE.WebGLProgram:/.test(message.text())) gpuErrors.push(message.text()); });
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.artReady);
  await page.locator('#start-button').click();
  await page.evaluate(() => {
    const g = window.__game; cancelAnimationFrame(g.raf);g.renderer.setPixelRatio(.5);
    window.expansionFixture = () => {
      g.start(); cancelAnimationFrame(g.raf);g.renderer.setPixelRatio(.5);
      g.spawnTimer = g.attackTimer = g.nextChestTime = g.nextEliteTime = g.nextGoldenTime = g.nextAltarTime = 1e6;
      g.stats.spells = {};g.actions.syncSlots(); g.stats.critChance = 0; g.stats.armor = 0; g.stats.regen = 0;
      g._state.xpNeeded = 1e9; g.invulnerable = 0;
      return g;
    };
    window.expansionFixture();
  });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression'))), saved, 'existing balances, upgrades, receipts and unlocks load intact');

  const before = await page.evaluate(() => {
    const g = window.__game; g._state.hp = 61; g._state.stageTime = g.state.stageDuration; g.bossDefeated = true;
    const before = { stats: JSON.stringify(g.stats), hp: g.state.hp, elapsed: g.state.elapsed };
    before.opened = g.nextStage(); return before;
  });
  assert.ok(before.opened);
  await page.locator('[data-route="standard"]').click();
  const choices = await page.locator('[data-region]').evaluateAll(elements => elements.map(element => element.dataset.region));
  assert.equal(choices.length, 3); assert.equal(new Set(choices).size, 3);
  await page.keyboard.press('Escape');
  await page.locator('[data-nav="guide"]').first().click({ force: true });
  const locked = await page.evaluate(() => {
    const g = window.__game, invalid = g.chooseRegion('invalid'); g.stepForTest(3);
    return { phase: g.state.phase, stage: g.state.stage, elapsed: g.state.elapsed, invalid, stats: JSON.stringify(g.stats), hp: g.state.hp };
  });
  assert.equal(locked.phase, 'region'); assert.equal(locked.stage, 1); assert.equal(locked.invalid, false);
  assert.equal(locked.elapsed, before.elapsed); assert.equal(locked.stats, before.stats); assert.equal(locked.hp, 61);
  await page.locator(`[data-region="${choices[0]}"]`).click();
  const entered = await page.evaluate(() => ({ stage: window.__game.state.stage, phase: window.__game.state.phase,
    region: window.__game.regionId, stats: JSON.stringify(window.__game.stats), hp: window.__game.state.hp }));
  assert.deepEqual(entered, { stage: 2, phase: 'playing', region: choices[0], stats: before.stats, hp: 61 });
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression'))), saved);
  console.log('PASS mandatory distinct region choice, locked combat, valid floor entry and unchanged saved/player stats');

  await fixture();
  const rewards = await page.evaluate(() => {
    const g = window.__game, result = [];
    for (const id of ['volcano', 'tundra', 'forest', 'ruins', 'void']) {
      window.expansionFixture(); g.regionId = id; g.regionSystem.setRegion(id); g._state.stage = 8;
      const stats = JSON.stringify(g.stats); g.openChestReward('지역 보물상자');
      result.push({ id, choices: g.chestChoices.map(item => ({ id: item.id, rarity: item.rarity })), region: g.state.region,
        noGrant: stats === JSON.stringify(g.stats), phase: g.state.phase });
      g.chooseChestReward(g.chestChoices[0].id);
    }
    return result;
  });
  for (const result of rewards) {
    assert.equal(result.phase, 'relic'); assert.equal(result.noGrant, true); assert.equal(result.choices.length, 3);
    assert.ok(result.choices.some(choice => result.id === 'ruins' ? ['epic', 'legendary'].includes(choice.rarity) : result.region.relicAffinity.includes(choice.id)), `${result.id} actually guarantees its advertised reward slot`);
  }
  console.log('PASS all five regions offer real, unowned affinity rewards through guarded-chest selection');
  await fixture();
  const stackedChests = await page.evaluate(() => {
    const g = window.__game; g._state.stage = 8; g.regionId = 'ruins'; g.routeId = 'treasure'; g.regionSystem.setRegion('ruins'); g.nextChestTime = 20;
    for (const at of [20, 45, 70, 95]) { g._state.stageTime = at; g.updateAdventure(0); }
    return { count: g.chests.length, bonus: g.getFloorModifiers().chestBonus, enemies: g.enemies.length };
  });
  assert.equal(stackedChests.bonus, 2); assert.equal(stackedChests.count, 4, 'treasure route and ruins each add an obtainable chest within the 120s floor');
  assert.ok(stackedChests.enemies <= 160);


  await fixture();
  const armor = await page.evaluate(() => {
    const g = window.__game;
    const normal = g.spawnEnemy(4, 0, 0, { mutations: [] }), steel = g.spawnEnemy(5, 0, 0, { mutations: ['steel'] }), swift = g.spawnEnemy(6, 0, 0, { mutations: ['swift'] });
    normal.hp = steel.hp = 1000;
    g.hitEnemy(normal, 100, undefined, 'explosion'); g.hitEnemy(steel, 100, undefined, 'explosion');
    return { normalLoss: 1000 - normal.hp, steelLoss: 1000 - steel.hp, normalSpeed: normal.speed, steelSpeed: steel.speed, swiftSpeed: swift.speed, gold: steel.rewardMultiplier, xp: steel.mutationXpMultiplier };
  });
  near(armor.normalLoss, 100, 'baseline direct damage'); near(armor.steelLoss, 70, 'real steel damage mitigation');
  near(armor.steelSpeed / armor.normalSpeed, .75, 'steel movement tradeoff'); near(armor.swiftSpeed / armor.normalSpeed, 1.3, 'swift movement');
  assert.ok(armor.gold > 1 && armor.xp > 1);

  await fixture();
  const vampire = await page.evaluate(() => {
    const g = window.__game, e = g.spawnEnemy(.6, 0, 0, { mutations: ['vampire'] });
    e.hp = e.maxHp / 2; const before = e.hp, player = g.state.hp;
    window.testEnemyStrike(g,e); const healed = e.hp - before, dealt = player - g.state.hp;
    g.updateEnemies(1 / 60);
    return { healed, dealt, secondHp: e.hp, firstHp: before + healed, cap: e.maxHp * .08 };
  });
  assert.ok(vampire.dealt > 0 && vampire.healed > 0); near(vampire.healed, Math.min(vampire.dealt * .45, vampire.cap), 'vampire heals actual accepted damage');
  near(vampire.secondHp, vampire.firstHp, 'invulnerability does not feed vampire');

  await fixture();
  const berserker = await page.evaluate(() => {
    const g = window.__game, e = g.spawnEnemy(0, 12, 3, { mutations: ['berserker'] });
    const normalSpeed = e.speed; e.hp = e.maxHp * .3; e.shootTimer = 2; e.windup = 0;
    g.updateEnemies(.1);
    const result = { speed: e.speed / normalSpeed, shotTime: e.shootTimer, rate: e.mutationAttackRate };
    e.windup = .65; g.updateEnemies(.1); result.warning = e.windup;
    return result;
  });
  near(berserker.speed, 1.3, 'injured berserker movement'); near(berserker.shotTime, 2 - .145, 'ranged attack preparation accelerated');
  near(berserker.warning, .55, 'attack warning still gives its full reaction window');
  console.log('PASS steel/swift tradeoffs, actual-hit vampire healing and berserker attack cadence without shorter telegraphs');

  await fixture();
  const splitting = await page.evaluate(() => {
    const g = window.__game; g._state.stage = 6;
    const snapshots = [];
    for (const kind of [0, 7]) {
      const e = g.spawnEnemy(3, 0, kind, { mutations: ['splitter'] });
      g.hitEnemy(e, 1e9, undefined, 'explosion');
      snapshots.push(g.enemies.map(child => ({ minion: child.minion, child: child.splitChild, mutations: child.mutations, reward: child.rewardMultiplier })));
      for (const child of [...g.enemies]) g.hitEnemy(child, 1e9, undefined, 'explosion');
      snapshots.push(g.enemies.length);
    }
    return snapshots;
  });
  for (const index of [0, 2]) {
    assert.equal(splitting[index].length, 2, 'natural+mutation splitting never doubles children');
    assert.ok(splitting[index].every(child => child.child && child.minion && child.mutations.length === 0 && child.reward < 1));
    assert.equal(splitting[index + 1], 0, 'children cannot split or mutate again');
  }

  await fixture();
  const explosion = await page.evaluate(() => {
    const g = window.__game, enemy = g.spawnEnemy(1, 0, 0, { mutations: ['explosive'] });
    const hp = g.state.hp; g.hitEnemy(enemy, 1e9, undefined, 'explosion');
    g.mutationSystem.update(.5); const warningHp = g.state.hp, warning = g.mutationSystem.getDebugState().warningCount;
    g._state.phase = 'paused'; g.mutationSystem.update(3); const pausedHp = g.state.hp;
    g._state.phase = 'playing'; g.mutationSystem.update(.51);
    return { hp, warningHp, warning, pausedHp, afterHp: g.state.hp, warningsAfter: g.mutationSystem.getDebugState().warningCount };
  });
  assert.equal(explosion.hp, explosion.warningHp); assert.equal(explosion.warningHp, explosion.pausedHp); assert.equal(explosion.warning, 1);
  assert.ok(explosion.afterHp < explosion.hp); assert.equal(explosion.warningsAfter, 0);
  console.log('PASS bounded one-generation splitting and delayed, pause-safe mutation death explosions');

  await fixture();
  const regionalCombat = await page.evaluate(() => {
    const g = window.__game, results = {};
    g.regionId = 'volcano'; g.regionSystem.setRegion('volcano'); g.regionSystem.hazardTimer = 1e6;
    const hp = g.state.hp; g.regionSystem.spawnHazard('lava', g.player.position);
    g.stepForTest(1.2); results.warning = { hp: g.state.hp, hazards: g.regionSystem.hazards.length };
    g.stepForTest(.3); results.lava = { hp: g.state.hp, original: hp, events: g.regionSystem.damageEvents };
    window.expansionFixture(); g.regionId = 'volcano'; g.regionSystem.setRegion('volcano'); g.regionSystem.hazardTimer = 1e6;
    g.regionSystem.spawnHazard('lava', g.player.position); g.player.position.x += 6;
    const avoided = g.state.hp; g.stepForTest(1.8); results.avoided = g.state.hp === avoided;
    window.expansionFixture(); g.regionId = 'tundra'; g.regionSystem.setRegion('tundra');
    const frost = g.spawnEnemy(.6, 0, 1, { mutations: [] }); frost.speed = 0;
    window.testEnemyStrike(g,frost); results.slow = g.regionSystem.movementMultiplier();
    g.removeEnemyWithoutReward(frost); g.stepForTest(1.1); results.recovered = g.regionSystem.movementMultiplier();
    window.expansionFixture(); g.regionId = 'forest'; g.regionSystem.setRegion('forest'); g.regionSystem.hazardTimer = 1e6;
    const poison = g.spawnEnemy(.6, 0, 3, { mutations: [] }); poison.speed = 0;
    poison.aim.copy(g.player.position).sub(poison.group.position).normalize();poison.windup=.01;g.updateEnemies(.02);g.updateEnemyProjectiles(.01); g.removeEnemyWithoutReward(poison);
    const poisoned = g.state.hp; g.stepForTest(1.1); results.poison = g.state.hp < poisoned;
    window.expansionFixture(); g.regionId = 'void'; g.regionSystem.setRegion('void'); g.regionSystem.blinkTimer = 1e6;
    const blink = g.spawnEnemy(12, 0, 3, { mutations: [] }); blink.speed = 0;
    const from = blink.group.position.clone(), started = g.regionSystem.startBlink();
    g.stepForTest(.9); const waiting = from.distanceTo(blink.group.position) < .001;
    g.stepForTest(.5); results.blink = { started, waiting, moved: from.distanceTo(blink.group.position) > 1, distance: blink.group.position.distanceTo(g.player.position),
      walkable: g.world.isWalkable(blink.group.position.x, blink.group.position.z, .5) };
    return results;
  });
  assert.equal(regionalCombat.warning.hp, regionalCombat.lava.original); assert.equal(regionalCombat.warning.hazards, 1);
  assert.ok(regionalCombat.lava.hp < regionalCombat.lava.original && regionalCombat.lava.events > 0 && regionalCombat.avoided);
  near(regionalCombat.slow, .82, 'frost enemy applies actual movement slow'); near(regionalCombat.recovered, 1, 'slow expires');
  assert.ok(regionalCombat.poison, 'forest poison deals subsequent real damage');
  assert.ok(regionalCombat.blink.started && regionalCombat.blink.waiting && regionalCombat.blink.moved && regionalCombat.blink.distance >= 5 && regionalCombat.blink.walkable);
  console.log('PASS warned/avoidable lava, frost attack slow recovery, poison damage and telegraphed safe void teleport');

  await fixture();
  const firestorm = await page.evaluate(() => {
    const g = window.__game; g.stats.spells = { fireball: 5 }; g.stats.evolutions.fireball = true; g.stats.swordEvolution = 'twinblade';
    g.magic.cooldowns.fireball = 1e6;
    const e = g.spawnEnemy(0, 2, 0, { mutations: [] }); e.hp = e.maxHp = 1e6; e.speed = 0;
    const random = Math.random;
    try { Math.random = () => 0; window.testStrike(g); window.testStrike(g); } finally { Math.random = random; }
    const initial = e.hp, zones = g.magic.zones.filter(zone => zone.type === 'firestorm').length;
    g.stepForTest(.65);
    return { zones, damaged: e.hp < initial, triggers: g.magic.getDebugState().comboTriggers.firestorm, recorded: g.runReport.damageBySource.combo };
  });
  assert.equal(firestorm.zones, 1); assert.equal(firestorm.triggers, 1); assert.ok(firestorm.damaged && firestorm.recorded > 0);

  await fixture();
  const judgment = await page.evaluate(() => {
    const g = window.__game; g.stats.spells = { lightning: 5 }; g.stats.evolutions.lightning = true; g.stats.swordEvolution = 'wave';
    const first = g.spawnEnemy(0, 2, 0, { mutations: [] }), nearby = g.spawnEnemy(1, 3, 0, { mutations: [] });
    for (const e of [first, nearby]) { e.hp = e.maxHp = 1e6; e.speed = 0; }
    g.hitEnemy(first, 10, undefined, 'sword'); const firstCombo = g.runReport.damageBySource.combo;
    for (let i = 0; i < 30; i++) g.hitEnemy(first, 10, undefined, i % 2 ? 'sword' : 'combo');
    return { nearbyLoss: 1e6 - nearby.hp, firstCombo, triggers: g.magic.getDebugState().comboTriggers.thunderJudgment };
  });
  assert.ok(judgment.nearbyLoss > 0 && judgment.firstCombo > 0); assert.equal(judgment.triggers, 1, 'neither repeated swords nor combo hits bypass judgment cooldown');

  await fixture();
  const zero = await page.evaluate(() => {
    const g = window.__game; g.stats.spells = { frost: 5 }; g.stats.evolutions.frost = true; g.stats.relics = ['glacier'];
    const e = g.spawnEnemy(0, 5, 0, { mutations: [] }); e.hp = e.maxHp = 1e6; e.speed = 0;
    g.spawnBoss(); const boss = g.boss; boss.group.position.set(3, 0, 4); boss.hp = boss.maxHp = 1e8; boss.speed = 0; boss.actionTimer = 1e6;
    g.magic.castFrost(); g.magic.cooldowns.frost = 1e6; g.stepForTest(1.02);
    const result = { freeze: e.freezeTime, bossFreeze: boss.freezeTime || 0, comboDamage: g.runReport.damageBySource.combo, triggers: g.magic.getDebugState().comboTriggers.absoluteZero };
    e.speed = 3; const position = e.group.position.clone(); g.stepForTest(.15);
    result.immobile = position.distanceTo(e.group.position) < .001;
    g.stepForTest(.5); result.resumed = position.distanceTo(e.group.position) > .1;
    e.slowTime = 5; boss.slowTime = 5; g.stepForTest(2);
    result.after = g.magic.getDebugState().comboTriggers.absoluteZero;
    return result;
  });
  assert.ok(zero.freeze > 0 && zero.freeze <= .45); assert.equal(zero.bossFreeze, 0); assert.ok(zero.comboDamage > 0 && zero.immobile && zero.resumed);
  assert.equal(zero.after, zero.triggers, 'repeated sustained slow cannot refreeze a target during its recovery');

  await fixture();
  const voidBurst = await page.evaluate(() => {
    const g = window.__game; g.stats.spells = { orbit: 5 }; g.stats.evolutions.orbit = true; g.stats.relics = ['arcanePrism']; g.invulnerable = 1e6;
    const e = g.spawnEnemy(1, 0, 0, { mutations: [] }); e.hp = e.maxHp = 1e6; e.speed = 0;
    window.testCast(g,'orbit');g.stepForTest(5.85); const before = g.magic.getDebugState().comboTriggers.voidBurst;
    for (let i = 0; i < 30; i++) g.hitEnemy(e, 1, undefined, 'combo');
    return { before, after: g.magic.getDebugState().comboTriggers.voidBurst, orbitDamage: g.runReport.damageBySource.orbit, comboDamage: g.runReport.damageBySource.combo };
  });
  assert.ok(voidBurst.before > 0 && voidBurst.orbitDamage > 0 && voidBurst.comboDamage > 0); assert.equal(voidBurst.before, voidBurst.after);
  console.log('PASS four hidden skills produce real combat effects, with repeated-hit cooldowns, finite freeze and boss immunity');

  await fixture();
  const unlocks = await page.evaluate(() => {
    const g = window.__game, original = g.callbacks.onLoot, notifications = [];
    g.callbacks.onLoot = value => { notifications.push(value); original?.(value); };
    g.stats.spells = { lightning: 5 }; g.stats.evolutions.lightning = true; g.stats.swordEvolution = 'wave';
    const stats = JSON.stringify(g.stats); g.magic.refreshSynergies(); g.magic.refreshSynergies();
    g.magic.reset({ preserveUnlocks: true }); g.magic.refreshSynergies();
    g.callbacks.onLoot = original;
    return { count: notifications.filter(value => value.includes('해금')).length, same: stats === JSON.stringify(g.stats) };
  });
  assert.equal(unlocks.count, 1); assert.equal(unlocks.same, true);

  await fixture();
  const stress = await page.evaluate(() => {
    const g = window.__game; g._state.stage = 10; g.regionId = 'void'; g.regionSystem.setRegion('void'); g.invulnerable = 1e6;
    g.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 }; g.stats.evolutions = { fireball: true, frost: true, lightning: true, orbit: true };
    g.stats.relics = ['glacier', 'arcanePrism']; g.stats.swordEvolution = 'wave';
    const ids = ['vampire', 'explosive', 'steel', 'berserker', 'splitter', 'swift'];
    for (let i = 0; i < 160; i++) {
      const angle = i * 2.399, radius = 3 + i % 12;
      const e = g.spawnEnemy(Math.cos(angle) * radius, Math.sin(angle) * radius, [0, 1, 2, 3, 5, 6, 7, 8, 9][i % 9], { mutations: [ids[i % 6], ids[(i + 1) % 6]] });
      e.hp = e.maxHp = 1e8;
    }
    for (let i = 0; i < 40; i++) g.regionSystem.spawnHazard('lava', g.player.position);
    g.stepForTest(2); g.renderer.render(g.scene, g.camera);
    const state = g.getDebugState(), batches = [...g.mutationSystem.markers.values()].length;
    g.start(); g.renderer.render(g.scene, g.camera);
    return { state, batches, resetMutations: g.mutationSystem.getDebugState(), resetRegion: g.regionSystem.getDebugState(), resetCombos: g.magic.getDebugState() };
  });
  assert.ok(stress.state.enemies <= 160 && stress.state.mutationSystem.active > 0 && stress.state.mutationSystem.markers <= 320);
  assert.ok(stress.state.regionSystem.hazards <= 4 && stress.state.mutationSystem.warningCount <= 12);
  assert.ok(stress.state.magic.effects <= 100 && stress.state.magic.projectiles <= 40 && stress.state.magic.zones <= 12);
  // Three fixed, shared pore/albedo/weave maps extend the previous texture budget.
  assert.ok(stress.state.drawCalls < 420 && stress.state.resources.textures <= 55, `bounded loaded scene: ${JSON.stringify({ calls: stress.state.drawCalls, resources: stress.state.resources })}`);
  assert.equal(stress.batches, 6); assert.equal(stress.resetMutations.active, 0); assert.equal(stress.resetMutations.markers, 0); assert.equal(stress.resetRegion.hazards, 0);
  assert.ok(Object.values(stress.resetCombos.comboTriggers).every(count => count === 0));
  console.log('PASS once-per-run unlocks and bounded 160 dual-mutation battle, regional hazards, combo effects and clean restart', JSON.stringify({ calls: stress.state.drawCalls, resources: stress.state.resources }));

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport); await fixture();
    await page.evaluate(() => { const g = window.__game; g._state.stageTime = g.state.stageDuration; g.bossDefeated = true; g.nextStage(); });
    await page.locator('[data-route="standard"]').click();
    assert.equal(await page.locator('[data-region]').count(), 3); await noPageScroll();
    const target = page.locator('[data-region]').nth(viewport.width < 500 ? 2 : 0);
    const chosen = await target.getAttribute('data-region');
    await target.click();
    assert.equal(await page.evaluate(() => window.__game.regionId), chosen); await noPageScroll();
  }
  await fixture();
  const final = await page.evaluate(() => {
    const g = window.__game; g._state.stage = 9; g._state.stageTime = g.state.stageDuration; g.bossDefeated = true;
    g.nextStage(); g.chooseRoute('standard');
    const entry = { stage: g.state.stage, region: g.regionId, phase: g.state.phase };
    g._state.stageTime = g.state.stageDuration; g.bossDefeated = false;
    const blocked = g.nextStage(); return { entry, blocked, phase: g.state.phase };
  });
  assert.deepEqual(final.entry, { stage: 10, region: 'throne', phase: 'playing' }); assert.equal(final.blocked, false); assert.equal(final.phase, 'playing');
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression'))), saved, 'all new selections/combat leave permanent progress untouched until settlement');
  console.log('PASS mobile portrait/landscape region controls without document scroll, fixed final region and final-boss gate');
  assert.deepEqual(errors, []); assert.deepEqual(gpuErrors, []);
} finally { await browser.close(); }
