import test from 'node:test';
import assert from 'node:assert/strict';
import { applyUpgrade, getUpgradeChoices } from '../src/balance.js';
import { BASE_SWORD_RANGE, SWORD_EVOLUTIONS, getSwordProfile, isSwordHit, getSwordEvolutionChoices } from '../src/sword.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
const point = (distance, degrees) => [Math.sin(degrees * Math.PI / 180) * distance, Math.cos(degrees * Math.PI / 180) * distance];
const stats = () => ({ damage: 18, spellDamage: 18, swordRangeMultiplier: 1, passiveLevels: {}, spells: { fireball: 1 }, evolutions: {} });

test('starter sword hits only within the measured 2.8-unit, forward 120-degree sector', () => {
  const profile = getSwordProfile();
  assert.equal(profile.range, BASE_SWORD_RANGE);
  near(profile.arc, Math.PI * 2 / 3);
  assert.equal(isSwordHit(profile, 0, 2.8, 0, 1), true);
  assert.equal(isSwordHit(profile, 0, 2.8001, 0, 1), false);
  assert.equal(isSwordHit(profile, 0, 4, 0, 1), false, 'the old invisible five-unit reach is gone');
  assert.equal(isSwordHit(profile, ...point(2.5, 60), 0, 1), true);
  assert.equal(isSwordHit(profile, ...point(2.5, -60), 0, 1), true);
  assert.equal(isSwordHit(profile, ...point(2.5, 60.01), 0, 1), false);
  assert.equal(isSwordHit(profile, 0, -1, 0, 1), false, 'enemies behind the player are excluded');
  assert.equal(isSwordHit(profile, 2.5, 0, 1, 0), true, 'the same sector follows the actual attack direction');
  assert.equal(isSwordHit(profile, 0, 2.5, 1, 0), false);
  assert.equal(isSwordHit(profile, NaN, 1, 0, 1), false);
});

test('optional target radius intersects finite sector edges without allowing rear hits', () => {
  const profile = getSwordProfile();
  assert.equal(isSwordHit(profile, 0, 2.9, 0, 1, 0.2), true);
  assert.equal(isSwordHit(profile, ...point(2, 62), 0, 1, 0.1), true);
  assert.equal(isSwordHit(profile, ...point(2, 70), 0, 1, 0.1), false);
  assert.equal(isSwordHit(profile, 0, -1, 0, 1, 0.2), false);
  assert.equal(isSwordHit(profile, 0, 2.9, 0, 1, 0), false, 'zero-radius checks match the visible boundary exactly');
});

test('earned range ranks compound with saved/relic range, stay separate from damage and stop at eight', () => {
  const player = stats(); player.swordRangeMultiplier = 1.4 * 1.2;
  const initial = structuredClone(player);
  for (let rank = 1; rank <= 8; rank++) {
    assert.equal(applyUpgrade(player, 'blade_range'), true);
    near(getSwordProfile(player).range, BASE_SWORD_RANGE * initial.swordRangeMultiplier * 1.12 ** rank);
    assert.equal(player.passiveLevels.blade_range, rank);
    assert.equal(player.damage, initial.damage);
    assert.equal(player.spellDamage, initial.spellDamage);
  }
  const capped = structuredClone(player);
  assert.equal(applyUpgrade(player, 'blade_range'), false);
  assert.deepEqual(player, capped);
});

test('sword evolution requires earned sword ranks and one mutually exclusive choice', () => {
  for (const definition of SWORD_EVOLUTIONS) {
    const player = stats();
    assert.equal(applyUpgrade(player, definition.id), false);
    applyUpgrade(player, 'power'); applyUpgrade(player, 'haste');
    assert.deepEqual(getSwordEvolutionChoices(player), []);
    assert.equal(player.swordEvolution, undefined);
    applyUpgrade(player, 'blade_range');
    const before = structuredClone(player);
    assert.equal(getSwordEvolutionChoices(player).length, 3);
    assert.deepEqual(player, before, 'becoming eligible does not change any stat');
    assert.equal(applyUpgrade(player, definition.id), true);
    assert.equal(player.swordEvolution, definition.mode);
    for (const other of SWORD_EVOLUTIONS) assert.equal(applyUpgrade(player, other.id), false);
    const profile = getSwordProfile(player);
    near(profile.range, BASE_SWORD_RANGE * 1.12 * definition.rangeMultiplier);
    near(profile.arc, definition.arc);
    near(profile.damageMultiplier, definition.damageMultiplier);
    near(profile.attackRateMultiplier, definition.attackRateMultiplier);
    assert.deepEqual(getSwordEvolutionChoices(player), []);
    assert.equal(player.damage, before.damage, 'evolution factors are applied by the shared attack profile once');
    assert.equal(player.spellDamage, before.spellDamage);
  }
});

test('level-up offers all sword branches over RNG without displacing spell or utility choices', () => {
  const player = stats(); player.passiveLevels = { power: 1, haste: 1, blade_range: 1 };
  const before = structuredClone(player), seen = new Set();
  for (let index = 0; index <= 100; index++) {
    const choices = getUpgradeChoices(player, () => index / 100);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    assert.ok(choices.some(choice => choice.spellId));
    assert.ok(choices.some(choice => choice.branch === 'core'));
    for (const choice of choices) seen.add(choice.id);
  }
  assert.ok(seen.has('blade_range'));
  for (const definition of SWORD_EVOLUTIONS) assert.ok(seen.has(definition.id), definition.id);
  assert.deepEqual(player, before);
});
