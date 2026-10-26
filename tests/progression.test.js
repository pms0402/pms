import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PERMANENT_UPGRADES, createProgress, normalizeProgress, getPermanentUpgradeOffers,
  getPermanentBonuses, settleRun, purchasePermanentUpgrade,
} from '../src/progression.js';

test('finished-run earnings become permanent money and a receipt is credited only once', () => {
  const original = createProgress();
  const snapshot = structuredClone(original);
  const receipt = settleRun(original, { runId: 'death-001', gold: 137.9 });
  assert.equal(receipt.credited, true);
  assert.equal(receipt.amount, 137);
  assert.equal(receipt.progress.bank, 137);
  assert.equal(receipt.progress.lifetimeGold, 137);
  assert.deepEqual(receipt.progress.settledRunIds, ['death-001']);
  assert.deepEqual(original, snapshot, 'settling must not mutate a prior saved record');
  const duplicate = settleRun(receipt.progress, { runId: 'death-001', gold: 999 });
  assert.equal(duplicate.credited, false);
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.progress.bank, 137);
  const victory = settleRun(receipt.progress, { runId: 'victory-002', gold: 200 });
  assert.equal(victory.progress.bank, 337, 'a new run adds to the wallet instead of replacing it');
});

test('zero-gold receipts are settled once while invalid earnings and missing IDs are rejected', () => {
  const zero = settleRun(createProgress(), { runId: 'empty-run', gold: 0 });
  assert.equal(zero.credited, true);
  assert.equal(zero.amount, 0);
  assert.equal(settleRun(zero.progress, { runId: 'empty-run', gold: 100 }).duplicate, true);
  for (const gold of [-1, NaN, Infinity, -Infinity, null, undefined, '', {}, []]) {
    const result = settleRun(createProgress(), { runId: 'bad', gold });
    assert.equal(result.credited, false);
    assert.equal(result.progress.bank, 0);
    assert.deepEqual(result.progress.settledRunIds, []);
  }
  for (const runId of ['', '   ', undefined, 1]) assert.equal(settleRun(createProgress(), { runId, gold: 10 }).credited, false);
});

test('purchases debit the permanent wallet exactly and preserve lifetime earnings', () => {
  const before = settleRun(createProgress(), { runId: 'income', gold: 100 }).progress;
  const snapshot = structuredClone(before);
  const result = purchasePermanentUpgrade(before, 'power');
  assert.equal(result.success, true);
  assert.equal(result.cost, 20);
  assert.equal(result.progress.bank, 80);
  assert.equal(result.progress.lifetimeGold, 100);
  assert.equal(result.progress.upgrades.power, 1);
  assert.deepEqual(before, snapshot, 'buying must not mutate a prior saved record');
  assert.equal(getPermanentUpgradeOffers(result.progress).find(offer => offer.id === 'power').cost, 32);
  assert.equal(purchasePermanentUpgrade(createProgress(), 'power').reason, 'insufficient_gold');
  assert.equal(purchasePermanentUpgrade(before, 'not-a-real-upgrade').reason, 'unknown_upgrade');
});

test('upgrade prices rise geometrically and completed upgrades cannot be bought again', () => {
  for (const definition of PERMANENT_UPGRADES) {
    const progress = normalizeProgress({ bank: Number.MAX_SAFE_INTEGER, upgrades: { [definition.id]: 2 } });
    const offer = getPermanentUpgradeOffers(progress).find(candidate => candidate.id === definition.id);
    assert.equal(offer.cost, Math.ceil(definition.baseCost * 1.6 ** 2));
    assert.equal(offer.currentBonus, definition.increment * 2);
    assert.equal(offer.nextBonus, definition.increment * 3);
    const capped = normalizeProgress({ bank: Number.MAX_SAFE_INTEGER, upgrades: { [definition.id]: definition.maxLevel } });
    const finalOffer = getPermanentUpgradeOffers(capped).find(candidate => candidate.id === definition.id);
    assert.equal(finalOffer.cost, null);
    assert.equal(finalOffer.canAfford, false);
    assert.equal(finalOffer.maxed, true);
    assert.equal(purchasePermanentUpgrade(capped, definition.id).reason, 'maxed');
  }
});

test('permanent bonuses remain small and independently affect the intended starting stat', () => {
  assert.deepEqual(getPermanentBonuses(createProgress()), { damageMultiplier: 1, spellDamageMultiplier: 1, maxHpMultiplier: 1, attackRateMultiplier: 1, spellRateMultiplier: 1, swordRangeMultiplier: 1, spellAreaMultiplier: 1, armorBonus: 0, magnetMultiplier: 1, goldMultiplier: 1, characterId: 'wanderer', weaponId: 'voidblade' });
  assert.deepEqual(getPermanentBonuses({ upgrades: { power: 2, vitality: 2, haste: 2, armor: 2, magnet: 2, fortune: 2 } }), {
    damageMultiplier: 1.04,
    spellDamageMultiplier: 1,
    maxHpMultiplier: 1.04,
    attackRateMultiplier: 1.02,
    spellRateMultiplier: 1,
    swordRangeMultiplier: 1,
    spellAreaMultiplier: 1,
    armorBonus: 0.01,
    magnetMultiplier: 1.04,
    goldMultiplier: 1.02,
    characterId: 'wanderer',
    weaponId: 'voidblade',
  });
  const offer = getPermanentUpgradeOffers({ upgrades: { armor: 2 } }).find(item => item.id === 'armor');
  assert.equal(offer.currentBonus, 1, 'armor is displayed in percentage points');
  assert.equal(offer.nextBonus, 1.5);
});

test('old completed-run history is imported only by the initial factory', () => {
  const history = [
    { runId: 'old-death', gold: 20.9, won: false },
    { runId: 'old-victory', gold: 30.8, won: true },
    { runId: 'old-victory', gold: 30.8, won: true },
    { gold: 5.9, won: false },
    { runId: 'live', gold: 100, phase: 'playing' },
    { gold: 999, completed: false },
    { gold: -7 },
    { gold: NaN },
    { gold: Infinity },
  ];
  const migrated = createProgress(history);
  assert.equal(migrated.bank, 55);
  assert.equal(migrated.lifetimeGold, 55);
  assert.equal(migrated.importedHistory, true);
  assert.deepEqual(migrated.settledRunIds, ['old-death', 'old-victory']);
  const spent = purchasePermanentUpgrade(migrated, 'power').progress;
  assert.equal(normalizeProgress(spent).bank, 35, 'normalization never replays or reimports the history');
  assert.equal(settleRun(spent, { runId: 'old-death', gold: 20 }).duplicate, true);
});

test('stored values are sanitized, levels capped, and receipts deduplicated and bounded', () => {
  const progress = normalizeProgress({
    bank: 18.9,
    lifetimeGold: -30,
    upgrades: { power: 1e9, vitality: -3, haste: NaN, armor: '3.9', magnet: Infinity, fortune: 2 },
    settledRunIds: ['first', ...Array.from({ length: 205 }, (_, i) => `receipt-${i}`), 'receipt-204', '', 4],
  });
  assert.equal(progress.bank, 18);
  assert.equal(progress.lifetimeGold, 0);
  assert.deepEqual(progress.upgrades, { power: 50, vitality: 0, haste: 0, armor: 3, magnet: 0, fortune: 2, arcana: 0, focus: 0, bladeReach: 0, spellArea: 0 });
  assert.equal(progress.settledRunIds.length, 200);
  assert.equal(new Set(progress.settledRunIds).size, 200);
  assert.equal(progress.settledRunIds.at(-1), 'receipt-204');
  assert.equal(progress.version, 1);
  assert.deepEqual(normalizeProgress(null), createProgress());
});

test('very large earnings and wallets remain exact safe integers', () => {
  const original = normalizeProgress({ bank: Number.MAX_SAFE_INTEGER - 3, lifetimeGold: Number.MAX_SAFE_INTEGER - 2 });
  const result = settleRun(original, { runId: 'large', gold: 1000 });
  assert.equal(result.amount, 3);
  assert.equal(result.progress.bank, Number.MAX_SAFE_INTEGER);
  assert.equal(result.progress.lifetimeGold, Number.MAX_SAFE_INTEGER);
  assert.ok(Number.isSafeInteger(result.progress.bank));
  const migrated = createProgress([{ gold: Number.MAX_SAFE_INTEGER }, { gold: Number.MAX_SAFE_INTEGER }]);
  assert.equal(migrated.bank, Number.MAX_SAFE_INTEGER);
  assert.equal(migrated.lifetimeGold, Number.MAX_SAFE_INTEGER);
});
