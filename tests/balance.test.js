import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_DURATION, MAX_STAGES, getStageStats, getSpawnInterval,
  getXpRequired, formatGold, getUpgradeChoices, applyUpgrade,
} from '../src/balance.js';

test('each new stage multiplies gold by 10 and monster health/damage by 3.2', () => {
  assert.equal(STAGE_DURATION, 45);
  assert.equal(MAX_STAGES, 5);
  for (let stage = 2; stage <= MAX_STAGES; stage += 1) {
    const previous = getStageStats(stage - 1);
    const current = getStageStats(stage);
    assert.equal(current.coinValue / previous.coinValue, 10);
    assert.ok(Math.abs(current.enemyHealth / previous.enemyHealth - 3.2) < 1e-12);
    assert.ok(Math.abs(current.enemyDamage / previous.enemyDamage - 3.2) < 1e-12);
    assert.ok(current.maxEnemies > previous.maxEnemies);
  }
  assert.equal(getStageStats(-9).coinValue, 1);
});

test('spawn curve preserves a quiet opening and grows into a dense late horde', () => {
  assert.equal(getSpawnInterval(1, 0), 2.2);
  assert.equal(getSpawnInterval(1, 8), 2.2);
  assert.ok(getSpawnInterval(5, 45) < 0.1);
  for (let stage = 1; stage <= MAX_STAGES; stage += 1) {
    let previous = Infinity;
    for (let time = 0; time <= STAGE_DURATION; time += 1) {
      const interval = getSpawnInterval(stage, time);
      assert.ok(interval > 0 && interval <= previous);
      previous = interval;
    }
  }
  assert.equal(getSpawnInterval(1, -1), getSpawnInterval(1, 0));
  assert.equal(getSpawnInterval(5, 1000), getSpawnInterval(5, 45));
});

test('level requirements increase and never collapse on invalid input', () => {
  assert.equal(getXpRequired(1), 8);
  for (let level = 2; level <= 100; level += 1) {
    assert.ok(getXpRequired(level) > getXpRequired(level - 1));
  }
  assert.equal(getXpRequired(-5), 8);
});

test('level-up choices are distinct and honor capped player stats', () => {
  for (const seed of [0, 0.2, 0.5, 0.9, 1]) {
    const choices = getUpgradeChoices({}, () => seed);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map((choice) => choice.id)).size, 3);
    assert.ok(choices.every((choice) => choice.title && choice.description && choice.icon));
  }
  const capped = { critChance: 0.9, armor: 0.75, projectiles: 6 };
  for (let run = 0; run < 25; run += 1) {
    assert.ok(getUpgradeChoices(capped).every((choice) => !['critical', 'armor', 'multishot'].includes(choice.id)));
  }
});

test('all upgrades improve a real combat stat and preserve caps', () => {
  const initial = { maxHp: 100, damage: 18, attackRate: 1.5, speed: 7, magnet: 5, projectiles: 1, critChance: 0.08, armor: 0, regen: 0 };
  const keys = { power: 'damage', haste: 'attackRate', vitality: 'maxHp', magnet: 'magnet', multishot: 'projectiles', critical: 'critChance', armor: 'armor', regen: 'regen' };
  for (const [id, key] of Object.entries(keys)) {
    const stats = { ...initial };
    assert.equal(applyUpgrade(stats, id), true);
    assert.ok(stats[key] > initial[key], id);
    assert.ok(Object.values(stats).every(Number.isFinite));
    for (let run = 0; run < 100; run += 1) applyUpgrade(stats, id);
    if (id === 'armor') assert.ok(stats.armor <= 0.75);
    if (id === 'critical') assert.ok(stats.critChance <= 0.9);
    if (id === 'multishot') assert.ok(stats.projectiles <= 6);
  }
  const stats = { ...initial };
  assert.equal(applyUpgrade(stats, 'missing'), false);
  assert.deepEqual(stats, initial);
});

test('gold display supports the large stage economy and Korean large-number units', () => {
  assert.equal(formatGold(0), '0');
  assert.equal(formatGold(9999), '9,999');
  assert.equal(formatGold(10000), '1만');
  assert.equal(formatGold(12500), '1.2만');
  assert.equal(formatGold(100000000), '1억');
  assert.equal(formatGold(1000000000000), '1조');
  assert.equal(formatGold(-10), '0');
  assert.equal(formatGold(NaN), '0');
});
