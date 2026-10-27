import test from 'node:test';
import assert from 'node:assert/strict';
import {
  STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES, ARENA_RADIUS, SPELLS, ENEMY_HEALTH_GROWTH, ENEMY_DAMAGE_GROWTH,
  getStageStats, getBossStats, getSpawnInterval, getXpRequired,
  formatGold, getUpgradeChoices, applyUpgrade,
} from '../src/balance.js';

const fresh = () => ({
  maxHp: 100, damage: 18, spellDamage: 18, attackRate: 1.5, spellRate: 1.5, speed: 7.5, magnet: 5.5,
  critChance: 0.08, armor: 0, regen: 0,
  spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 },
  evolutions: {}, passiveLevels: {},
});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);

test('two-minute stages, late bosses and four times the previous map area', () => {
  assert.equal(STAGE_DURATION, 120);
  assert.equal(BOSS_SPAWN_TIME, 90);
  assert.ok(BOSS_SPAWN_TIME < STAGE_DURATION);
  assert.equal(MAX_STAGES, 10);
  assert.equal(ARENA_RADIUS, 90);
});

test('monster curves remain independent of player stats with earned gold x10 per floor', () => {
  assert.equal(getStageStats(1).enemyHealth, 28);
  assert.equal(getStageStats(1).enemyDamage, 7.5);
  assert.equal(getStageStats(1).coinValue, 5);
  assert.equal(ENEMY_HEALTH_GROWTH, 1.7);
  assert.equal(ENEMY_DAMAGE_GROWTH, 1.35);
  for (let stage = 2; stage <= MAX_STAGES; stage++) {
    const previous = getStageStats(stage - 1), current = getStageStats(stage);
    assert.equal(current.coinValue / previous.coinValue, 10);
    near(current.enemyHealth / previous.enemyHealth, ENEMY_HEALTH_GROWTH);
    near(current.enemyDamage / previous.enemyDamage, ENEMY_DAMAGE_GROWTH);
    assert.ok(current.maxEnemies >= previous.maxEnemies && current.maxEnemies <= 160);
  }
  assert.deepEqual(getStageStats(-9), getStageStats(1));
  assert.deepEqual(getStageStats(Infinity), getStageStats(1));
  assert.deepEqual(getStageStats(99), getStageStats(MAX_STAGES));
});

test('every stage has a named boss with substantial health and real rewards', () => {
  const names = new Set();
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    const boss = getBossStats(stage), monsters = getStageStats(stage);
    names.add(boss.name);
    near(boss.health, monsters.enemyHealth * 35);
    assert.ok(boss.damage > monsters.enemyDamage);
    assert.equal(boss.coinValue, monsters.coinValue * 25);
    assert.equal(boss.xpValue, 15);
  }
  assert.equal(names.size, MAX_STAGES);
});

test('spawns preserve the quiet opening and ramp over the full longer stage', () => {
  assert.equal(getSpawnInterval(1, 0), 2.6);
  assert.equal(getSpawnInterval(1, 12), 2.6);
  assert.ok(getSpawnInterval(5, STAGE_DURATION) < 0.1);
  assert.ok(getSpawnInterval(1, 45) > getSpawnInterval(1, 110) * 2);
  for (let stage = 1; stage <= MAX_STAGES; stage++) {
    let previous = Infinity;
    for (let time = 0; time <= STAGE_DURATION; time++) {
      const interval = getSpawnInterval(stage, time);
      assert.ok(interval > 0 && interval <= previous);
      previous = interval;
    }
  }
  assert.equal(getSpawnInterval(1, -1), getSpawnInterval(1, 0));
  assert.equal(getSpawnInterval(5, 1000), getSpawnInterval(5, STAGE_DURATION));
});

test('first level-up is accessible and later levels still require increasing XP', () => {
  assert.equal(getXpRequired(1), 5);
  for (let level = 2; level <= 100; level++) assert.ok(getXpRequired(level) > getXpRequired(level - 1));
  assert.equal(getXpRequired(-5), 5);
  assert.equal(getXpRequired(NaN), 5);
});

test('every level offers a real spell and small passive with three distinct choices', () => {
  for (const seed of [0, 0.2, 0.5, 0.9, 1]) {
    const choices = getUpgradeChoices(fresh(), () => seed);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    assert.ok(choices.some(choice => choice.category === 'spell'));
    assert.ok(choices.some(choice => choice.category === 'passive'));
    for (const choice of choices) {
      assert.ok(choice.title && choice.description && choice.icon);
      assert.ok(choice.rank > 0 && choice.rank <= choice.maxRank);
      assert.equal(applyUpgrade(fresh(), choice.id), true);
    }
  }
});

test('passives give meaningful compound improvements and caps reject additional purchases', () => {
  const effects = {
    power: ['damage', 18 * 1.2], haste: ['attackRate', 1.5 * 1.08],
    spell_power: ['spellDamage', 18 * 1.2], spell_haste: ['spellRate', 1.5 * 1.08],
    vitality: ['maxHp', 115], magnet: ['magnet', 5.5 * 1.08],
    critical: ['critChance', 0.10], armor: ['armor', 0.02],
    regen: ['regen', 0.2], speed: ['speed', 7.5 * 1.03],
  };
  for (const [id, [key, expected]] of Object.entries(effects)) {
    const stats = fresh();
    assert.equal(applyUpgrade(stats, id), true);
    near(stats[key], expected);
    assert.equal(stats.passiveLevels[id], 1);
    for (let count = 1; count < (id === 'regen' ? 10 : 12); count++) assert.equal(applyUpgrade(stats, id), true);
    const capped = structuredClone(stats);
    assert.equal(applyUpgrade(stats, id), false, id);
    assert.deepEqual(stats, capped);
  }
  const highCrit = { ...fresh(), critChance: 0.595 };
  applyUpgrade(highCrit, 'critical');
  assert.equal(highCrit.critChance, 0.6);
  assert.equal(applyUpgrade(highCrit, 'critical'), false);
  const highArmor = { ...fresh(), armor: 0.495 };
  applyUpgrade(highArmor, 'armor');
  assert.equal(highArmor.armor, 0.5);
  assert.equal(applyUpgrade(highArmor, 'armor'), false);
});

test('four spells unlock, rank up and evolve once after rank five', () => {
  for (const spell of SPELLS) {
    const stats = fresh(); stats.spells[spell.id] = 0;
    assert.equal(applyUpgrade(stats, `evolve_${spell.id}`), false);
    for (let rank = 1; rank <= 5; rank++) {
      assert.equal(applyUpgrade(stats, `spell_${spell.id}`), true);
      assert.equal(stats.spells[spell.id], rank);
    }
    assert.equal(applyUpgrade(stats, `spell_${spell.id}`), false);
    const evolution = getUpgradeChoices(stats, () => 0).find(choice => choice.id === `evolve_${spell.id}`);
    if (spell.id === 'fireball') assert.equal(evolution?.category, 'evolution');
    assert.equal(applyUpgrade(stats, `evolve_${spell.id}`), true);
    assert.equal(stats.evolutions[spell.id], true);
    assert.equal(applyUpgrade(stats, `evolve_${spell.id}`), false);
    assert.ok(getUpgradeChoices(stats).every(choice => choice.id !== `spell_${spell.id}` && choice.id !== `evolve_${spell.id}`));
  }
});

test('fully completed temporary builds have no invalid additional upgrades', () => {
  const stats = fresh();
  for (const spell of SPELLS) { stats.spells[spell.id] = 5; stats.evolutions[spell.id] = true; }
  for (const id of ['power', 'haste', 'spell_power', 'spell_haste', 'vitality', 'magnet', 'critical', 'armor', 'regen', 'speed']) stats.passiveLevels[id] = 12;
  stats.passiveLevels.blade_range = 8;
  stats.swordEvolution = 'broadsword';
  assert.deepEqual(getUpgradeChoices(stats), []);
  assert.equal(applyUpgrade(stats, 'missing'), false);
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
