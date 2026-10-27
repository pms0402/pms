import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMANENT_UPGRADES, createProgress, normalizeProgress, settleRun,
  purchasePermanentUpgrade, getPermanentBonuses, getPermanentUpgradeOffers,
} from '../src/progression.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1, expected) * 1e-10, `${actual} ≈ ${expected}`);

test('an early 1000-gold wallet buys broad, immediately meaningful permanent growth', () => {
  let progress = settleRun(createProgress(), { runId: 'earned-first-stage', gold: 1000 }).progress;
  let purchased = 0;
  for (let round = 0; round < 50; round++) {
    let bought = false;
    for (const id of ['power', 'arcana', 'vitality', 'haste', 'focus']) {
      const result = purchasePermanentUpgrade(progress, id);
      if (result.success) { progress = result.progress; purchased++; bought = true; }
    }
    if (!bought) break;
  }
  const bonuses = getPermanentBonuses(progress);
  assert.ok(purchased >= 25, `${purchased} purchases should preserve accessible early growth`);
  assert.ok(bonuses.damageMultiplier * bonuses.attackRateMultiplier >= 2, 'sword DPS at least doubles from bought upgrades');
  assert.ok(bonuses.spellDamageMultiplier * bonuses.spellRateMultiplier >= 2, 'magic DPS independently doubles');
  assert.ok(bonuses.maxHpMultiplier >= 1.7, 'health purchases noticeably improve survival');
  assert.ok(progress.bank >= 0 && progress.bank < 1000);
  assert.equal(progress.lifetimeGold, 1000, 'spending never reduces earned lifetime gold');
});

test('higher combat levels keep compounding instead of adding negligible percentages', () => {
  const level10 = getPermanentBonuses({ upgrades: { power: 10, arcana: 10, vitality: 10 } });
  const level20 = getPermanentBonuses({ upgrades: { power: 20, arcana: 20, vitality: 20 } });
  assert.ok(level10.damageMultiplier > 3);
  assert.ok(level20.damageMultiplier > 9);
  near(level20.damageMultiplier / level10.damageMultiplier, level10.damageMultiplier);
  near(level20.spellDamageMultiplier / level10.spellDamageMultiplier, level10.spellDamageMultiplier);
  near(level20.maxHpMultiplier / level10.maxHpMultiplier, level10.maxHpMultiplier);
  const sword = getPermanentBonuses({ upgrades: { power: 10, haste: 10 } });
  assert.equal(sword.spellDamageMultiplier, 1);
  assert.equal(sword.spellRateMultiplier, 1);
  const magic = getPermanentBonuses({ upgrades: { arcana: 10, focus: 10 } });
  assert.equal(magic.damageMultiplier, 1);
  assert.equal(magic.attackRateMultiplier, 1);
});

test('all branches keep their first five prices and scale late ranks to floor-sized income', () => {
  for (const definition of PERMANENT_UPGRADES) {
    let previous = 0;
    for (let level = 0; level < definition.maxLevel; level++) {
      const offer = getPermanentUpgradeOffers({ upgrades: { [definition.id]: level } }).find(offer => offer.id === definition.id);
      assert.ok(Number.isSafeInteger(offer.cost) && offer.cost > previous, `${definition.id} prices must be positive and increase`);
      if (level <= 4) assert.equal(offer.cost, Math.ceil(definition.baseCost * (1 + .22 * level + .018 * level ** 2)), `${definition.id} early prices are retained`);
      if (level > 0) assert.ok(offer.cost / previous < 5, `${definition.id} avoids a compressed anchor's abrupt price jump`);
      previous = offer.cost;
    }
    assert.equal(previous, definition.baseCost * 2.5e10, `${definition.id} final purchase belongs to the late-game price band`);
    assert.ok(previous >= 250000000000 && previous <= 600000000000);
  }
});

test('long combat trees follow explicit 10-rank late-game price landmarks', () => {
  for (const [level, expected] of [[9, 3000], [19, 300000], [29, 30000000], [39, 3000000000], [49, 300000000000]]) {
    for (const id of ['power', 'arcana']) {
      const offer = getPermanentUpgradeOffers({ upgrades: { [id]: level } }).find(item => item.id === id);
      assert.equal(offer.cost, expected, `${id} rank ${level + 1} cost`);
    }
  }
});

test('a mid-floor 100-million-gold wallet cannot complete a combat node or the whole tree', () => {
  let sword = settleRun(createProgress(), { runId: 'mid-floor-sword', gold: 100000000 }).progress;
  while (true) {
    const purchase = purchasePermanentUpgrade(sword, 'power');
    if (!purchase.success) break;
    sword = purchase.progress;
  }
  assert.ok(sword.upgrades.power >= 25 && sword.upgrades.power < 40, 'mid-floor money still buys substantial growth before the late ranks');
  assert.ok(getPermanentUpgradeOffers(sword).find(item => item.id === 'power').cost > sword.bank);

  let balanced = settleRun(createProgress(), { runId: 'mid-floor-balanced', gold: 100000000 }).progress;
  for (let round = 0; round < 50; round++) {
    let bought = false;
    for (const node of PERMANENT_UPGRADES) {
      const purchase = purchasePermanentUpgrade(balanced, node.id);
      if (purchase.success) { balanced = purchase.progress; bought = true; }
    }
    if (!bought) break;
  }
  assert.ok(PERMANENT_UPGRADES.every(node => balanced.upgrades[node.id] < node.maxLevel), 'no branch can be cheaply maxed while buying the tree');
  assert.ok(balanced.bank >= 0 && balanced.bank < 100000000);
  assert.equal(balanced.lifetimeGold, 100000000);
});

test('offer percentages match actual compounded bonuses before and after a purchase', () => {
  const before = normalizeProgress({ bank: 1000000000000, upgrades: { power: 9, arcana: 3, vitality: 4, haste: 2 } });
  for (const [id, multiplier] of [['power', 'damageMultiplier'], ['arcana', 'spellDamageMultiplier'], ['vitality', 'maxHpMultiplier'], ['haste', 'attackRateMultiplier']]) {
    const offer = getPermanentUpgradeOffers(before).find(item => item.id === id);
    const purchase = purchasePermanentUpgrade(before, id);
    assert.equal(purchase.success, true);
    near(offer.currentBonus, (getPermanentBonuses(before)[multiplier] - 1) * 100);
    near(offer.nextBonus, (getPermanentBonuses(purchase.progress)[multiplier] - 1) * 100);
    assert.equal(purchase.progress.bank, before.bank - offer.cost);
  }
});

test('existing paid levels and earned money retain their identity and get the stronger effects', () => {
  const oldSave = { version: 1, bank: 175, lifetimeGold: 2000, upgrades: { power: 12, vitality: 9, fortune: 8 }, settledRunIds: ['already-settled'], unlocks: { characters: ['wanderer', 'arcanist'], weapons: ['voidblade', 'tempest'] }, loadout: { character: 'arcanist', weapon: 'tempest' } };
  const snapshot = structuredClone(oldSave);
  const restored = normalizeProgress(JSON.parse(JSON.stringify(oldSave)));
  assert.equal(restored.bank, 175);
  assert.equal(restored.lifetimeGold, 2000);
  assert.equal(restored.upgrades.power, 12);
  assert.equal(restored.upgrades.vitality, 9);
  assert.deepEqual(restored.loadout, oldSave.loadout);
  const bonuses = getPermanentBonuses(restored);
  near(bonuses.damageMultiplier, 1.12 ** 12 * 0.85 * 0.82);
  near(bonuses.maxHpMultiplier, 1.1 ** 9 * 0.9);
  near(bonuses.goldMultiplier, 1.4);
  assert.equal(settleRun(restored, { runId: 'already-settled', gold: 1000 }).duplicate, true);
  assert.deepEqual(oldSave, snapshot);
});

test('all maximum saved levels give finite bounded bonuses and cannot over-purchase', () => {
  const progress = normalizeProgress({ bank: Number.MAX_SAFE_INTEGER, upgrades: Object.fromEntries(PERMANENT_UPGRADES.map(node => [node.id, Infinity])) });
  assert.ok(Object.values(progress.upgrades).every(level => level === 0), 'non-finite saves are rejected');
  const capped = normalizeProgress({ bank: Number.MAX_SAFE_INTEGER, upgrades: Object.fromEntries(PERMANENT_UPGRADES.map(node => [node.id, node.maxLevel + 100])) });
  for (const node of PERMANENT_UPGRADES) {
    assert.equal(capped.upgrades[node.id], node.maxLevel);
    assert.equal(purchasePermanentUpgrade(capped, node.id).reason, 'maxed');
  }
  const bonuses = getPermanentBonuses(capped);
  for (const [key, value] of Object.entries(bonuses)) if (typeof value === 'number') assert.ok(Number.isFinite(value) && value >= 0, key);
  assert.ok(bonuses.damageMultiplier > 250 && bonuses.damageMultiplier < 300);
  assert.ok(bonuses.maxHpMultiplier > 100 && bonuses.maxHpMultiplier < 120);
  assert.ok(bonuses.attackRateMultiplier < 3);
  assert.equal(bonuses.armorBonus, 0.3);
  assert.equal(bonuses.goldMultiplier, 2.5);
});
