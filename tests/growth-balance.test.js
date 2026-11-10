import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { applyUpgrade, getStageStats } from '../src/balance.js';
import { applyRelic } from '../src/content.js';
import { MagicSystem } from '../src/magic.js';
import { abyssStats } from '../src/abyss.js';
import { normalizeProgress, getPermanentBonuses, getPermanentUpgradeOffers, settleRun } from '../src/progression.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} ≈ ${expected}`);
const fresh = () => ({ damage: 18, spellDamage: 18, maxHp: 100, attackRate: 1.5, spellRate: 1.5, speed: 7.5, swordRangeMultiplier: 1, spellAreaMultiplier: 1, passiveLevels: {}, spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 }, evolutions: {}, relics: [] });

test('maximum earned combat ranks stay modest and preserve separate damage, timing and reach channels', () => {
  const channels = [
    ['power', 'damage', 12, 1.36], ['spell_power', 'spellDamage', 12, 1.36],
    ['haste', 'attackRate', 12, 1.24], ['spell_haste', 'spellRate', 12, 1.24],
    ['vitality', 'maxHp', 12, 1.24], ['speed', 'speed', 12, 1.12],
    ['blade_range', 'swordRangeMultiplier', 8, 1.24], ['spell_area', 'spellAreaMultiplier', 6, 1.18],
  ];
  for (const [id, field, cap, multiplier] of channels) {
    const stats = fresh(), initial = structuredClone(stats);
    let previous = stats[field], increment;
    for (let rank = 1; rank <= cap; rank++) {
      assert.equal(applyUpgrade(stats, id), true, `${id} rank ${rank}`);
      if (rank === 1) increment = stats[field] - previous;
      else near(stats[field] - previous, increment);
      previous = stats[field];
    }
    near(stats[field], initial[field] * multiplier);
    assert.equal(applyUpgrade(stats, id), false);
    assert.equal(stats.passiveLevels[id], cap);
    for (const [, otherField] of channels) if (otherField !== field) assert.equal(stats[otherField], initial[otherField], `${id} must not increase ${otherField}`);
  }
});

test('taking relics before, between or after earned ranks produces the same build', () => {
  for (const [id, field, relic, multiplier] of [
    ['power', 'damage', 'whetstone', 1.1], ['spell_power', 'spellDamage', 'arcanePrism', 1.1],
    ['haste', 'attackRate', 'warDrum', 1.06], ['spell_haste', 'spellRate', 'hourglass', 1.06],
    ['vitality', 'maxHp', 'giantsHeart', 1.12], ['blade_range', 'swordRangeMultiplier', 'longblade', 1.1],
    ['spell_area', 'spellAreaMultiplier', 'wideSigil', 1.1],
  ]) {
    const plain = fresh();
    for (let rank = 0; rank < 6; rank++) assert.equal(applyUpgrade(plain, id), true);
    for (const insertion of [0, 3, 6]) {
      const stats = fresh();
      for (let rank = 0; rank <= 6; rank++) {
        if (rank === insertion) assert.equal(applyRelic(stats, relic), true);
        if (rank < 6) assert.equal(applyUpgrade(stats, id), true);
      }
      near(stats[field], plain[field] * multiplier);
      assert.deepEqual(stats.relics, [relic]);
      assert.equal(stats.passiveLevels[id], 6);
    }
  }
});

test('real spell damage uses modest rank growth while advanced fireball retains its divided second projectile', t => {
  for (const id of ['fireball', 'frost', 'lightning', 'orbit']) {
    const measured = [];
    for (const rank of [1, 5]) {
      const group = new THREE.Group(); group.position.set(0, 0, 3);
      const target = { hp: 1e6, group, size: 1 };
      const hits = [];
      const game = {
        scene: new THREE.Scene(), player: new THREE.Group(), enemies: [target], _state: { phase: 'playing' },
        stats: { ...fresh(), spells: { [id]: rank } },
        hitEnemy(enemy, damage) { hits.push(damage); enemy.hp -= damage; },
      };
      const magic = new MagicSystem(game); t.after(() => magic.dispose());
      if (id === 'fireball') {
        assert.equal(magic.castFireball(), true);
        assert.equal(magic.projectiles.length, rank === 5 ? 2 : 1);
        measured.push(magic.projectiles[0].damage);
      }
      if (id === 'frost') { assert.equal(magic.castFrost(), true); measured.push(hits[0]); }
      if (id === 'lightning') { assert.equal(magic.castLightning(new THREE.Vector3(0, 0, 1)), true); measured.push(hits[0]); }
      if (id === 'orbit') { assert.equal(magic.castOrbit(group.position), true); measured.push(magic.zones[0].damage); }
      assert.equal(magic.spellsCast[id], 1);
    }
    assert.ok(measured[0] > 0, `${id} must deal real damage`);
    near(measured[1] / measured[0], id === 'fireball' ? 1.16 / Math.sqrt(2) : 1.16);
  }
});

test('reading new growth effects leaves a paid save and its anti-duplicate receipts unchanged', () => {
  const saved = normalizeProgress({ version: 1, bank: 456789, lifetimeGold: 987654321, upgrades: { power: 49, arcana: 35, vitality: 43, haste: 30, armor: 12, fortune: 10 }, settledRunIds: ['old-earned-run'], unlocks: { characters: ['wanderer', 'arcanist'], weapons: ['voidblade', 'tempest'] }, loadout: { character: 'arcanist', weapon: 'tempest' } });
  const snapshot = structuredClone(saved);
  for (let reload = 0; reload < 3; reload++) {
    const restored = normalizeProgress(JSON.parse(JSON.stringify(saved)));
    const bonuses = getPermanentBonuses(restored);
    near(bonuses.damageMultiplier, 1.294 * .85 * .82);
    near(bonuses.spellDamageMultiplier, 1.21 * 1.16);
    const offer = getPermanentUpgradeOffers(restored).find(item => item.id === 'power');
    near(offer.currentBonus, 29.4); near(offer.nextBonus, 30);
    assert.equal(offer.cost, 300000000000);
    assert.equal(settleRun(restored, { runId: 'old-earned-run', gold: 999999 }).duplicate, true);
    assert.deepEqual(restored, snapshot);
  }
  assert.deepEqual(saved, snapshot);
});

test('abyss health and damage increase with diminishing increments while earned currency remains independent', () => {
  const base = getStageStats(10);
  let previous = base, previousHpGain = Infinity, previousDamageGain = Infinity;
  for (let floor = 11; floor <= 210; floor++) {
    const current = abyssStats(floor), hpGain = current.enemyHealth - previous.enemyHealth, damageGain = current.enemyDamage - previous.enemyDamage;
    assert.ok(hpGain > 0 && damageGain > 0);
    assert.ok(hpGain <= previousHpGain && damageGain <= previousDamageGain, 'later abyss floors cannot restore exponential stat inflation');
    assert.ok(current.enemyHealth < base.enemyHealth * 7 && current.enemyDamage < base.enemyDamage * 4);
    assert.ok(current.coinValue >= previous.coinValue);
    previous = current; previousHpGain = hpGain; previousDamageGain = damageGain;
  }
  const remote = abyssStats(1e9);
  assert.ok(remote.enemyHealth < base.enemyHealth * 7 && remote.enemyDamage < base.enemyDamage * 4);
  near(abyssStats(11).coinValue / base.coinValue, 1.22);
});
