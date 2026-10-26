import test from 'node:test';
import assert from 'node:assert/strict';
import { RELICS, applyRelic, getRelicChoices, getThreatModifiers, applyBossReward } from '../src/content.js';

const fresh = () => ({
  damage: 18, spellDamage: 18, attackRate: 1.5, spellRate: 1.5,
  maxHp: 100, armor: 0, regen: 0, speed: 7.5, magnet: 5.5,
  swordRangeMultiplier: 1, spellAreaMultiplier: 1, goldMultiplier: 1,
  xpMultiplier: 1, relics: [],
});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.abs(expected) * 1e-10, `${actual} ≈ ${expected}`);
const originalIds = ['blast', 'pierce', 'blood', 'leech', 'momentum', 'frostfire', 'thunderRune', 'greed'];

test('twenty additional relics each change a real stat or combat modifier, with all original relics retained', () => {
  assert.equal(RELICS.length, 28);
  assert.equal(new Set(RELICS.map(relic => relic.id)).size, 28);
  assert.equal(new Set(RELICS.map(relic => relic.title)).size, 28);
  assert.ok(originalIds.every(id => RELICS.some(relic => relic.id === id)));
  const additions = RELICS.filter(relic => !originalIds.includes(relic.id));
  assert.equal(additions.length, 20);
  for (const relic of additions) {
    assert.ok(relic.title && relic.description && relic.icon && relic.rarity);
    const stats = fresh(), before = structuredClone(stats);
    assert.equal(applyRelic(stats, relic.id), true);
    const { relics, ...effect } = stats;
    const { relics: _oldRelics, ...oldEffect } = before;
    assert.notDeepEqual(effect, oldEffect, `${relic.id} must affect combat or collection`);
    assert.deepEqual(relics, [relic.id]);
    const after = structuredClone(stats);
    assert.equal(applyRelic(stats, relic.id), false);
    assert.deepEqual(stats, after, `${relic.id} may not stack through duplicate selection`);
  }
});

test('sword and magic relic builds amplify their own damage and timing independently', () => {
  const sword = fresh(), magic = fresh();
  for (const id of ['whetstone', 'warDrum', 'longblade']) applyRelic(sword, id);
  near(sword.damage / 18 * (sword.attackRate / 1.5), 1.68);
  near(sword.swordRangeMultiplier, 1.2);
  assert.equal(sword.spellDamage, 18);
  assert.equal(sword.spellRate, 1.5);
  for (const id of ['arcanePrism', 'hourglass', 'wideSigil']) applyRelic(magic, id);
  near(magic.spellDamage / 18 * (magic.spellRate / 1.5), 1.68);
  near(magic.spellAreaMultiplier, 1.18);
  assert.equal(magic.damage, 18);
  assert.equal(magic.attackRate, 1.5);
  for (const [id, field] of [['inferno', 'fireballBonus'], ['glacier', 'frostBonus'], ['conductor', 'lightningBonus'], ['satellites', 'orbitBonus']]) {
    applyRelic(magic, id);
    assert.equal(magic[field], 0.25);
  }
});

test('high-growth health, damage and fortune keep their gains when relics are combined', () => {
  const first = { ...fresh(), damage: 1e8, maxHp: 1e7, goldMultiplier: 2.5 };
  applyRelic(first, 'whetstone'); applyRelic(first, 'giantsHeart');
  near(first.damage, 1.4e8); near(first.maxHp, 1.4e7);
  applyRelic(first, 'alchemy'); applyRelic(first, 'greed'); applyBossReward(first, 5);
  const second = { ...fresh(), goldMultiplier: 2.5 };
  applyRelic(second, 'greed'); applyRelic(second, 'alchemy'); applyBossReward(second, 5);
  near(first.goldMultiplier, 2.5 * 1.3 * 1.15 * 1.1);
  near(first.goldMultiplier, second.goldMultiplier);
  const danger = getThreatModifiers(first, 'swarm');
  near(danger.enemyHealth, 1.3 * 1.2 * 1.15);
  near(danger.enemyDamage, 1.15 * 1.15 * 1.1);
  assert.equal(danger.goldMultiplier, 1.8, 'contract reward is applied separately once, not inside relic fortune');
});

test('survival and exploration relics expose one-use revival and bounded movement while scaling collection', () => {
  const stats = fresh();
  for (const id of ['ironroot', 'spring', 'windstep', 'vacuum', 'huntersWisdom', 'secondWind', 'shockwave', 'executioner']) applyRelic(stats, id);
  assert.equal(stats.reviveCharges, 1);
  assert.equal(stats.dashShockwave, true);
  assert.equal(stats.eliteDamageBonus, 0.3);
  assert.ok(stats.armor > 0 && stats.armor <= 0.6);
  assert.ok(stats.regen > 0);
  assert.ok(stats.speed > 7.5 && stats.speed <= 20);
  near(stats.magnet, 5.5 * 1.4);
  near(stats.xpMultiplier, 1.35);
});

test('a player owning the original eight can discover all twenty new relics without duplicate or invalid offers', () => {
  const stats = fresh();
  originalIds.forEach(id => applyRelic(stats, id));
  for (let remaining = 20; remaining > 0; remaining--) {
    const options = getRelicChoices(stats, () => remaining % 3 / 3);
    assert.equal(options.length, Math.min(3, remaining));
    assert.ok(options.every(relic => !stats.relics.includes(relic.id) && !originalIds.includes(relic.id)));
    assert.equal(applyRelic(stats, options.at(-1).id), true);
  }
  assert.equal(stats.relics.length, 28);
  assert.deepEqual(getRelicChoices(stats), []);
  for (const value of Object.values(stats).filter(value => typeof value === 'number')) assert.ok(Number.isFinite(value));
});
