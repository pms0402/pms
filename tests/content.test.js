import test from 'node:test';
import assert from 'node:assert/strict';
import { RELICS, getRelicChoices, applyRelic, RISK_PACTS, getRiskStats, getThreatModifiers, BOSS_REWARDS, getBossReward, applyBossReward } from '../src/content.js';

const fresh = () => ({ damage: 18, spellDamage: 18, goldMultiplier: 1, swordRangeMultiplier: 1, relics: [], bossRewards: [] });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} ≈ ${expected}`);
const pressure = threat => threat.enemyHealth * threat.enemyDamage * threat.enemySpeed * threat.spawnRate;

test('a run can complete its relic collection without duplicate choices or stuck empty offers', () => {
  const stats = fresh();
  for (let index = 0; index < RELICS.length; index++) {
    const before = new Set(stats.relics);
    const choices = getRelicChoices(stats, () => index % 2 ? 1 : 0);
    assert.equal(choices.length, Math.min(3, RELICS.length - index));
    assert.equal(new Set(choices.map(choice => choice.id)).size, choices.length);
    assert.ok(choices.every(choice => !before.has(choice.id) && choice.title && choice.description));
    assert.equal(applyRelic(stats, choices[0].id), true);
  }
  assert.equal(stats.relics.length, RELICS.length);
  assert.deepEqual(getRelicChoices(stats), []);
});

test('reopening a relic choice cannot grant or amplify the same reward twice', () => {
  for (const relic of RELICS) {
    const stats = fresh();
    assert.equal(applyRelic(stats, relic.id), true);
    const after = structuredClone(stats);
    for (let count = 0; count < 100; count++) assert.equal(applyRelic(stats, relic.id), false);
    assert.deepEqual(stats, after);
    for (const number of Object.values(stats).filter(value => typeof value === 'number')) assert.ok(Number.isFinite(number));
  }
  const stats = fresh(), before = structuredClone(stats);
  assert.equal(applyRelic(stats, 'not-a-relic'), false);
  assert.deepEqual(stats, before);
  assert.equal(applyRelic(null, 'blast'), false);
  assert.equal(applyRelic([], 'blast'), false);
});

test('conditional relics expose distinct combat effects without merging sword and magic power', () => {
  const stats = fresh();
  for (const id of ['blast', 'pierce', 'blood', 'leech', 'momentum', 'frostfire', 'thunderRune']) assert.equal(applyRelic(stats, id), true);
  assert.equal(stats.damage, 18);
  assert.equal(stats.spellDamage, 18);
  assert.equal(stats.killExplosion, true);
  assert.equal(stats.swordTargetsBonus, 2);
  assert.ok(stats.lowHealthDamageBonus > 0 && stats.lowHealthDamageBonus <= 0.25);
  assert.ok(stats.lifeOnKill > 0 && stats.lifeOnKill <= 1);
  assert.ok(stats.comboCritBonus > 0 && stats.comboCritBonus <= 0.1);
  assert.ok(stats.frostfireBonus > 0 && stats.frostfireBonus <= 0.25);
  assert.ok(stats.runeSynergyBonus > 0 && stats.runeSynergyBonus <= 0.15);
});

test('every bonus-gold contract carries more combined combat pressure than its reward gain', () => {
  let previousReward = 0, previousPressure = 0;
  for (const pact of RISK_PACTS) {
    const threat = getRiskStats(pact.id);
    assert.ok(threat.goldMultiplier > previousReward);
    assert.ok(pressure(threat) > previousPressure);
    assert.ok(pressure(threat) >= threat.goldMultiplier);
    if (threat.goldMultiplier > 1) {
      assert.ok(threat.enemyHealth > 1 && threat.enemyDamage > 1);
      assert.ok(threat.spawnRate > 1);
    }
    previousReward = threat.goldMultiplier; previousPressure = pressure(threat);
  }
  assert.deepEqual(getRiskStats('corrupt-save'), getRiskStats('none'));
  const mutated = getRiskStats('fury'); mutated.enemyHealth = 0;
  assert.ok(getRiskStats('fury').enemyHealth > 1);
});

test('greed and a contract compound their threats and pay gold exactly once per source', () => {
  const stats = fresh(), normal = getThreatModifiers(stats, 'swarm');
  assert.equal(applyRelic(stats, 'greed'), true);
  const danger = getThreatModifiers(stats, 'swarm');
  assert.ok(danger.enemyHealth > normal.enemyHealth && danger.enemyDamage > normal.enemyDamage);
  close(danger.goldMultiplier, normal.goldMultiplier);
  const totalReward = stats.goldMultiplier * danger.goldMultiplier;
  close(totalReward, 1.15 * normal.goldMultiplier);
  assert.ok(pressure(danger) > totalReward);
  assert.deepEqual(getThreatModifiers({ relicThreat: { enemyHealth: NaN, enemyDamage: -5 } }, 'none'), getRiskStats('none'));
});

test('boss rewards are distinct, stage-specific and idempotent with isolated damage channels', () => {
  assert.equal(new Set(BOSS_REWARDS.map(reward => reward.id)).size, 5);
  const stats = fresh();
  for (const reward of BOSS_REWARDS) {
    assert.equal(getBossReward(reward.stage).id, reward.id);
    const before = structuredClone(stats);
    assert.equal(applyBossReward(stats, reward.stage), true);
    if (reward.stage === 2) { assert.ok(stats.damage > before.damage); assert.equal(stats.spellDamage, before.spellDamage); }
    if (reward.stage === 4) { assert.ok(stats.spellDamage > before.spellDamage); assert.equal(stats.damage, before.damage); }
    const after = structuredClone(stats);
    assert.equal(applyBossReward(stats, reward.stage), false);
    assert.deepEqual(stats, after);
  }
  assert.ok(stats.swordRangeMultiplier > 1);
  assert.equal(stats.poisonExplosion, true);
  assert.equal(stats.bossRewards.length, 5);
  assert.equal(getBossReward(99), null);
  const before = structuredClone(stats);
  assert.equal(applyBossReward(stats, 0), false);
  assert.deepEqual(stats, before);
});

test('corrupted relic storage and RNG values cannot leak unknown entries or produce invalid offers', () => {
  for (const value of [NaN, Infinity, -1, 1, 100]) {
    const choices = getRelicChoices({ relics: ['blast', 'blast', 'unknown'] }, () => value);
    assert.equal(choices.length, 3);
    assert.ok(choices.every(choice => choice.id !== 'blast' && RELICS.some(relic => relic.id === choice.id)));
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
  }
  const stats = { relics: ['blast', 'blast', 'unknown'], lifeOnKill: Infinity };
  assert.equal(applyRelic(stats, 'leech'), true);
  assert.deepEqual(stats.relics, ['blast', 'leech']);
  assert.ok(Number.isFinite(stats.lifeOnKill) && stats.lifeOnKill <= 1.2);
});
