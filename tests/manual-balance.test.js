import test from 'node:test';
import assert from 'node:assert/strict';
import * as balance from '../src/balance.js';

const { ENEMY_HEALTH_GROWTH, ENEMY_DAMAGE_GROWTH, MAX_STAGES, getStageStats, getBossStats, getXpDropMultiplier, getXpRequired, applyUpgrade } = balance;
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < Math.max(1e-10, Math.abs(expected) * 1e-12), `${actual} ≈ ${expected}`);
const starter = () => ({ damage: 18, spellDamage: 18, maxHp: 100, attackRate: 1.5, spellRate: 1.5, passiveLevels: {}, spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 }, evolutions: {} });

test('the balance API no longer exposes an automatic player-growth multiplier', () => {
  assert.equal('getStageGrowth' in balance, false, 'removing the floor bonus must not leave a neutral or hidden automatic-growth helper');
  assert.equal(MAX_STAGES, 10);
  assert.equal(ENEMY_HEALTH_GROWTH, 1.7);
  assert.equal(ENEMY_DAMAGE_GROWTH, 1.35);
});

test('all ten floors retain affordable enemy pressure without the former exponential wall', () => {
  assert.equal(getStageStats(1).enemyHealth, 28);
  assert.equal(getStageStats(1).enemyDamage, 7.5);
  for (let stage = 2; stage <= MAX_STAGES; stage++) {
    const before = getStageStats(stage - 1), current = getStageStats(stage);
    close(current.enemyHealth / before.enemyHealth, ENEMY_HEALTH_GROWTH);
    close(current.enemyDamage / before.enemyDamage, ENEMY_DAMAGE_GROWTH);
    assert.ok(Number.isFinite(current.enemyHealth) && Number.isFinite(current.enemyDamage));
    assert.ok(current.maxEnemies <= 160);
    if (stage >= 5) assert.equal(current.maxEnemies, 160);
    close(getBossStats(stage).health, current.enemyHealth * 35);
  }
  const last = getStageStats(MAX_STAGES);
  assert.ok(last.enemyHealth < 3400, 'a normal final-floor enemy no longer assumes a free3.2× player bonus every floor');
  assert.ok(last.enemyDamage < 120, 'player health can be built through chosen upgrades rather than forced floor scaling');
  assert.ok(last.enemyHealth > getStageStats(5).enemyHealth * 10, 'later floors still grow substantially');
});

test('the gold curve and boss payouts survive the manual-growth rebalance unchanged', () => {
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    const stats = getStageStats(stage), boss = getBossStats(stage);
    assert.equal(stats.coinValue, 5 * 10 ** (stage - 1));
    assert.equal(boss.coinValue, stats.coinValue * 25);
    assert.ok(Number.isSafeInteger(stats.coinValue));
    if (stage > 1) assert.equal(stats.coinValue / getStageStats(stage - 1).coinValue, 10);
  }
});

test('later XP drops increase earned level-up opportunities with bounded predictable growth', () => {
  assert.equal(getXpDropMultiplier(1), 1);
  close(getXpDropMultiplier(2), 1.2);
  close(getXpDropMultiplier(10), 2.8);
  for (let stage = 2; stage <= MAX_STAGES; stage++) {
    const before = getXpDropMultiplier(stage - 1), current = getXpDropMultiplier(stage);
    close(current - before, 0.2);
    assert.ok(30 * current >= getXpRequired(5), 'a modest amount of actual combat can still earn choices after early levels');
  }
  assert.equal(getXpDropMultiplier(-100), 1);
  assert.equal(getXpDropMultiplier(Infinity), 1);
  assert.equal(getXpDropMultiplier(NaN), 1);
  close(getXpDropMultiplier(999), 2.8);
});

test('chosen damage, speed and health upgrades compound only their own stat channels', () => {
  const stats = starter();
  for (let choice = 0; choice < 3; choice++) assert.equal(applyUpgrade(stats, 'power'), true);
  close(stats.damage, 18 * 1.2 ** 3);
  assert.equal(stats.spellDamage, 18); assert.equal(stats.maxHp, 100);
  assert.equal(applyUpgrade(stats, 'spell_power'), true);
  close(stats.spellDamage, 18 * 1.2); close(stats.damage, 18 * 1.2 ** 3);
  assert.equal(applyUpgrade(stats, 'vitality'), true);
  close(stats.maxHp, 115);
  assert.equal(applyUpgrade(stats, 'haste'), true);
  close(stats.attackRate, 1.5 * 1.08); assert.equal(stats.spellRate, 1.5);
  assert.deepEqual(stats.passiveLevels, { power: 3, spell_power: 1, vitality: 1, haste: 1 });
});
