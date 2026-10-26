import test from 'node:test';
import assert from 'node:assert/strict';
import { STAGES, BOSS_TYPES, ENEMY_TYPES, getStageDefinition, getBossDefinition, getEnemyDefinition, getEnemyPool, chooseEnemyKind } from '../src/encounters.js';
import { MAX_STAGES, STAGE_DURATION, getStageStats, getBossStats, getStageGrowth, getSpawnInterval } from '../src/balance.js';

const nearRatio = (actual, expected) => assert.ok(Math.abs(actual / expected - 1) < 1e-12, `${actual} ≈ ${expected}`);

test('ten named floors each supply a distinct atmosphere and a real boss identity', () => {
  assert.equal(MAX_STAGES, 10);
  assert.equal(STAGES.length, MAX_STAGES);
  const names = new Set(), palettes = new Set(), bossNames = new Set(), ids = new Set(), archetypes = new Set();
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    const floor = getStageDefinition(stage), boss = getBossStats(stage);
    assert.equal(floor.stage, stage); assert.equal(boss.stage, stage);
    assert.ok(floor.name && floor.english && floor.description && boss.hint);
    assert.equal(floor.palette.length, 4);
    assert.ok(floor.palette.every(color => /^#[\da-f]{6}$/i.test(color)));
    names.add(floor.name); palettes.add(floor.palette.join()); bossNames.add(boss.name); ids.add(boss.id); archetypes.add(boss.archetype);
  }
  assert.equal(names.size, 10); assert.equal(palettes.size, 10); assert.equal(bossNames.size, 10); assert.equal(ids.size, 10);
  assert.equal(archetypes.size, 6, 'bosses differ in their attack families as well as their names');
  assert.equal(getBossStats(1).archetype, 'warden', 'the first guardian keeps its introductory charge/pulse fight');
  assert.equal(getStageDefinition(6).name, '얼어붙은 회랑');
  assert.equal(getStageDefinition(10).name, '종말의 왕좌');
});

test('later floor stats continue the economy and player-matched exponent without uncapped crowds', () => {
  const growth = getStageGrowth();
  for (let stage = 2; stage <= MAX_STAGES; stage++) {
    const previous = getStageStats(stage - 1), current = getStageStats(stage);
    nearRatio(current.enemyHealth / previous.enemyHealth, growth.damageMultiplier);
    nearRatio(current.enemyDamage / previous.enemyDamage, growth.maxHpMultiplier);
    assert.equal(current.coinValue / previous.coinValue, 10);
    assert.ok(Number.isFinite(current.enemyHealth) && Number.isSafeInteger(current.coinValue));
    assert.ok(current.maxEnemies <= 160);
    if (stage >= 5) assert.equal(current.maxEnemies, 160);
    assert.ok(getSpawnInterval(stage, STAGE_DURATION) >= 0.085);
    const boss = getBossStats(stage);
    nearRatio(boss.health, current.enemyHealth * 35);
    assert.equal(boss.coinValue, current.coinValue * 25);
  }
  assert.ok(getStageStats(10).enemyHealth > getStageStats(5).enemyHealth * 300);
  assert.ok(getStageStats(10).coinValue > getStageStats(5).coinValue * 90000);
});

test('enemy composition introduces special roles at their own floors and preserves melee support', () => {
  assert.equal(ENEMY_TYPES.length, 9);
  assert.equal(new Set(ENEMY_TYPES.map(enemy => enemy.kind)).size, ENEMY_TYPES.length);
  assert.ok(ENEMY_TYPES.every(enemy => enemy.kind !== 4));
  const specialKinds = [5, 6, 7, 8, 9];
  for (const kind of specialKinds) {
    const enemy = getEnemyDefinition(kind);
    assert.ok(enemy.description && enemy.goldMultiplier >= 2 && enemy.xp >= 2);
    assert.ok(!getEnemyPool(enemy.unlockStage - 1).some(candidate => candidate.kind === kind));
    assert.ok(getEnemyPool(enemy.unlockStage).some(candidate => candidate.kind === kind));
  }
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    const pool = getEnemyPool(stage);
    assert.ok(pool.every(enemy => enemy.unlockStage <= stage && enemy.weight > 0));
    assert.ok(pool.some(enemy => enemy.kind === 0), 'special attacks retain a readable melee baseline');
    assert.equal(pool.reduce((sum, enemy) => sum + enemy.weight, 0), 100);
  }
  assert.equal(getEnemyPool(10).length, 9);
});

test('weighted spawns can reach every available species and never choose reserved or locked kinds', () => {
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    const allowed = new Set(getEnemyPool(stage).map(enemy => enemy.kind)), seen = new Set();
    for (let roll = 0; roll < 1000; roll++) seen.add(chooseEnemyKind(stage, () => roll / 1000));
    assert.deepEqual(seen, allowed);
    for (const random of [() => NaN, () => Infinity, () => -100, () => 1, () => 100, null]) {
      const selected = chooseEnemyKind(stage, random);
      assert.ok(allowed.has(selected)); assert.notEqual(selected, 4);
    }
  }
});

test('catalog lookups safely clamp bad floors and return mutable copies without corrupting definitions', () => {
  for (const stage of [-7, 0, NaN, Infinity]) {
    assert.equal(getStageDefinition(stage).stage, 1); assert.equal(getBossDefinition(stage).stage, 1);
  }
  assert.equal(getStageDefinition(100).stage, 10); assert.equal(getBossDefinition(100).stage, 10);
  assert.equal(getEnemyDefinition(4).kind, 0); assert.equal(getEnemyDefinition('bad').kind, 0);
  const boss = getBossDefinition(1), floor = getStageDefinition(1), enemy = getEnemyDefinition(5);
  boss.actions.push('bad'); boss.actionLabels.charge = 'bad'; boss.aspect[0] = 100;
  floor.palette[0] = '#000000'; enemy.speed = 100;
  assert.deepEqual(getBossDefinition(1).actions, ['charge', 'pulse']);
  assert.notEqual(getBossDefinition(1).actionLabels.charge, 'bad');
  assert.equal(getBossDefinition(1).aspect[0], 1);
  assert.notEqual(getStageDefinition(1).palette[0], '#000000');
  assert.notEqual(getEnemyDefinition(5).speed, 100);
  assert.equal(Object.keys(BOSS_TYPES).length, 6);
});
