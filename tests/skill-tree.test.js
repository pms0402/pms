import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProgress, normalizeProgress, settleRun, purchasePermanentUpgrade,
  getPermanentUpgradeOffers, getPermanentBonuses, CHARACTERS, WEAPONS,
  getUnlockOffers, purchaseUnlock, selectLoadout,
} from '../src/progression.js';

const richProgress = () => settleRun(createProgress(), { runId: 'test-income', gold: 2000 }).progress;

test('sword and magic branches unlock independently and require their own roots', () => {
  const initial = richProgress();
  const offers = getPermanentUpgradeOffers(initial);
  for (const id of ['haste', 'bladeReach', 'focus', 'spellArea']) {
    const offer = offers.find(item => item.id === id);
    assert.equal(offer.locked, true);
    assert.ok(offer.requirementsText.includes('Lv.1'));
    const blocked = purchasePermanentUpgrade(initial, id);
    assert.equal(blocked.reason, 'prerequisite');
    assert.equal(blocked.progress.bank, 2000);
  }
  const sword = purchasePermanentUpgrade(initial, 'power').progress;
  assert.equal(getPermanentUpgradeOffers(sword).find(item => item.id === 'haste').locked, false);
  assert.equal(getPermanentUpgradeOffers(sword).find(item => item.id === 'focus').locked, true);
  const before = getPermanentBonuses(initial), after = getPermanentBonuses(sword);
  assert.equal(after.damageMultiplier, 1.02);
  assert.equal(after.spellDamageMultiplier, before.spellDamageMultiplier);
  assert.equal(after.spellRateMultiplier, before.spellRateMultiplier);
  const magic = purchasePermanentUpgrade(initial, 'arcana').progress;
  const magicBonus = getPermanentBonuses(purchasePermanentUpgrade(magic, 'focus').progress);
  assert.equal(magicBonus.damageMultiplier, before.damageMultiplier);
  assert.equal(magicBonus.attackRateMultiplier, before.attackRateMultiplier);
  assert.equal(magicBonus.spellDamageMultiplier, 1.02);
  assert.equal(magicBonus.spellRateMultiplier, 1.01);
});

test('old wallet, receipts and upgrade levels survive additive tree migration', () => {
  const old = { version: 1, bank: 9876, lifetimeGold: 18000, upgrades: { power: 3, haste: 4, vitality: 5, armor: 6, magnet: 7, fortune: 8 }, settledRunIds: ['old-run'] };
  const snapshot = structuredClone(old);
  const migrated = normalizeProgress(old);
  assert.equal(migrated.bank, old.bank);
  assert.equal(migrated.lifetimeGold, old.lifetimeGold);
  for (const [id, level] of Object.entries(old.upgrades)) assert.equal(migrated.upgrades[id], level);
  for (const id of ['arcana', 'focus', 'bladeReach', 'spellArea']) assert.equal(migrated.upgrades[id], 0);
  assert.deepEqual(migrated.loadout, { character: 'wanderer', weapon: 'voidblade' });
  assert.deepEqual(migrated.unlocks, { characters: ['wanderer'], weapons: ['voidblade'] });
  assert.equal(settleRun(migrated, { runId: 'old-run', gold: 100 }).duplicate, true);
  assert.deepEqual(old, snapshot);
  const grandfathered = normalizeProgress({ bank: 1000, upgrades: { haste: 2 } });
  assert.equal(purchasePermanentUpgrade(grandfathered, 'haste').success, true, 'already bought nodes stay usable');
});

test('unlock purchase debits once and equipment selection never changes the wallet', () => {
  const initial = richProgress();
  const snapshot = structuredClone(initial);
  const bought = purchaseUnlock(initial, 'character', 'arcanist');
  assert.equal(bought.success, true);
  assert.equal(bought.cost, 150);
  assert.equal(bought.progress.bank, 1850);
  assert.equal(bought.progress.lifetimeGold, 2000);
  assert.equal(bought.progress.loadout.character, 'wanderer', 'unlocking does not silently equip');
  assert.deepEqual(initial, snapshot);
  const duplicate = purchaseUnlock(bought.progress, 'character', 'arcanist');
  assert.equal(duplicate.reason, 'already_unlocked');
  assert.equal(duplicate.progress.bank, 1850);
  const selected = selectLoadout(bought.progress, 'character', 'arcanist');
  assert.equal(selected.success, true);
  assert.equal(selected.progress.loadout.character, 'arcanist');
  assert.equal(selected.progress.bank, 1850);
  assert.equal(selectLoadout(initial, 'character', 'arcanist').reason, 'locked');
  assert.equal(purchaseUnlock(createProgress(), 'weapon', 'greatsword').reason, 'insufficient_gold');
  assert.equal(purchaseUnlock(initial, 'bogus', 'arcanist').reason, 'unknown_unlock');
  assert.equal(selectLoadout(initial, 'weapon', 'bogus').reason, 'unknown_unlock');
});

test('selected character and sword produce distinct bounded sidegrades', () => {
  let progress = richProgress();
  progress = purchaseUnlock(progress, 'character', 'arcanist').progress;
  progress = purchaseUnlock(progress, 'weapon', 'tempest').progress;
  progress = selectLoadout(progress, 'character', 'arcanist').progress;
  progress = selectLoadout(progress, 'weapon', 'tempest').progress;
  const saved = normalizeProgress(JSON.parse(JSON.stringify(progress)));
  const bonus = getPermanentBonuses(saved);
  assert.equal(bonus.characterId, 'arcanist');
  assert.equal(bonus.weaponId, 'tempest');
  assert.equal(bonus.damageMultiplier, 0.85 * 0.82);
  assert.equal(bonus.spellDamageMultiplier, 1.16);
  assert.equal(bonus.maxHpMultiplier, 0.9);
  assert.equal(bonus.attackRateMultiplier, 1.2);
  assert.equal(bonus.swordRangeMultiplier, 1.08);
  const offers = getUnlockOffers(saved);
  assert.equal(offers.length, CHARACTERS.length + WEAPONS.length);
  assert.equal(offers.filter(item => item.selected).length, 2);
  assert.ok(offers.find(item => item.id === 'arcanist').unlocked);
  for (const character of CHARACTERS.slice(1)) assert.ok(character.damageMultiplier < 1 || character.spellDamageMultiplier < 1);
  for (const weapon of WEAPONS.slice(1)) assert.ok(weapon.damageMultiplier * weapon.attackRateMultiplier < 1.01, 'weapon DPS stays close to the starter with range as a tradeoff');
});

test('malformed unlock saves cannot select unpaid equipment or debit below zero', () => {
  const sanitized = normalizeProgress({ bank: 119.9, unlocks: { characters: ['bogus', 'wanderer', 'wanderer'], weapons: null }, loadout: { character: 'berserker', weapon: 'greatsword' } });
  assert.deepEqual(sanitized.unlocks, { characters: ['wanderer'], weapons: ['voidblade'] });
  assert.deepEqual(sanitized.loadout, { character: 'wanderer', weapon: 'voidblade' });
  const rejected = purchaseUnlock(sanitized, 'weapon', 'tempest');
  assert.equal(rejected.success, false);
  assert.equal(rejected.progress.bank, 119);
  const exact = purchaseUnlock(normalizeProgress({ bank: 120 }), 'weapon', 'tempest');
  assert.equal(exact.success, true);
  assert.equal(exact.progress.bank, 0);
  assert.equal(purchaseUnlock(exact.progress, 'character', 'arcanist').success, false);
});
