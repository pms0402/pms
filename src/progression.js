const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const RECEIPT_LIMIT = 200;

/** Core combat upgrades compound; affordable quadratic costs keep each run rewarding. */
export const PERMANENT_UPGRADES = [
  { id: 'power', branch: 'sword', requires: [], name: '검술의 뿌리', description: '단계마다 검 공격력 ×1.12 · 마법과 독립 성장', icon: 'sword', maxLevel: 50, baseCost: 12, increment: 12, compound: true, unit: '%' },
  { id: 'haste', branch: 'sword', requires: [{ id: 'power', level: 1 }], name: '연속 베기', description: '단계마다 검 공격 속도 ×1.025', icon: 'sword', maxLevel: 40, baseCost: 18, increment: 2.5, compound: true, unit: '%' },
  { id: 'bladeReach', branch: 'sword', requires: [{ id: 'power', level: 1 }], name: '검기의 가지', description: '검 타격 범위 +2%', icon: 'target', maxLevel: 20, baseCost: 20, increment: 2, unit: '%' },
  { id: 'arcana', branch: 'magic', requires: [], name: '마력의 뿌리', description: '단계마다 마법 공격력 ×1.12 · 검과 독립 성장', icon: 'orbit', maxLevel: 50, baseCost: 12, increment: 12, compound: true, unit: '%' },
  { id: 'focus', branch: 'magic', requires: [{ id: 'arcana', level: 1 }], name: '주문의 흐름', description: '단계마다 마법 시전 속도 ×1.025', icon: 'bolt', maxLevel: 40, baseCost: 18, increment: 2.5, compound: true, unit: '%' },
  { id: 'spellArea', branch: 'magic', requires: [{ id: 'arcana', level: 1 }], name: '확산의 가지', description: '마법 효과 범위 +2%', icon: 'orbit', maxLevel: 20, baseCost: 20, increment: 2, unit: '%' },
  { id: 'vitality', branch: 'core', requires: [], name: '생명의 뿌리', description: '단계마다 기본 최대 체력 ×1.10', icon: 'heart', maxLevel: 50, baseCost: 15, increment: 10, compound: true, unit: '%' },
  { id: 'armor', branch: 'core', requires: [], name: '견고한 피부', description: '모든 런의 기본 피해 감소 +0.75%p', icon: 'shield', maxLevel: 40, baseCost: 24, increment: 0.75, unit: '%p' },
  { id: 'magnet', branch: 'core', requires: [], name: '잔향 자석', description: '모든 런의 기본 획득 범위 +3%', icon: 'magnet', maxLevel: 30, baseCost: 10, increment: 3, unit: '%' },
  { id: 'fortune', branch: 'core', requires: [], name: '황금의 운', description: '모든 런의 골드 획득량 +5%', icon: 'coin', maxLevel: 30, baseCost: 20, increment: 5, unit: '%' },
];

/** Unlocks are sidegrades: stronger specialties come with a weaker counterpart. */
export const CHARACTERS = [
  { id: 'wanderer', name: '방랑자', description: '검과 마법을 균형 있게 다루는 기본 캐릭터.', icon: 'move', cost: 0, damageMultiplier: 1, spellDamageMultiplier: 1, maxHpMultiplier: 1 },
  { id: 'arcanist', name: '비전술사', description: '마법 공격력 +16% · 검 공격력 -15% · 최대 체력 -10%', icon: 'orbit', cost: 150, damageMultiplier: 0.85, spellDamageMultiplier: 1.16, maxHpMultiplier: 0.9 },
  { id: 'berserker', name: '광전사', description: '검 공격력 +20% · 마법 공격력 -18% · 최대 체력 -15%', icon: 'sword', cost: 200, damageMultiplier: 1.2, spellDamageMultiplier: 0.82, maxHpMultiplier: 0.85 },
];

export const WEAPONS = [
  { id: 'voidblade', name: '공허의 검', description: '공격력과 속도가 균형 잡힌 기본 검.', icon: 'sword', cost: 0, damageMultiplier: 1, attackRateMultiplier: 1, swordRangeMultiplier: 1 },
  { id: 'tempest', name: '질풍검', description: '검 공격 속도 +20% · 범위 +8% · 검 공격력 -18%', icon: 'bolt', cost: 120, damageMultiplier: 0.82, attackRateMultiplier: 1.2, swordRangeMultiplier: 1.08 },
  { id: 'greatsword', name: '파쇄 대검', description: '검 공격력 +30% · 범위 +20% · 검 공격 속도 -28%', icon: 'sword', cost: 180, damageMultiplier: 1.3, attackRateMultiplier: 0.72, swordRangeMultiplier: 1.2 },
];

const unlockCatalog = type => type === 'character' ? CHARACTERS : type === 'weapon' ? WEAPONS : null;
const unlockKey = type => type === 'character' ? 'characters' : 'weapons';

function validUnlocks(values, catalog) {
  const known = new Set(catalog.map(item => item.id));
  return [...new Set([catalog[0].id, ...(Array.isArray(values) ? values.filter(id => known.has(id)) : [])])];
}

function numeric(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN;
  if (typeof value === 'string' && !value.trim()) return NaN;
  return Number(value);
}

function nonnegativeInteger(value) {
  const number = numeric(value);
  return Number.isFinite(number) ? Math.min(MAX_SAFE, Math.max(0, Math.floor(number))) : 0;
}

function receiptId(value) {
  return typeof value === 'string' ? value.trim().slice(0, 256) : '';
}

function receipts(values) {
  if (!Array.isArray(values)) return [];
  // Keep the most recent occurrence before imposing the bounded receipt window.
  return [...new Set(values.map(receiptId).filter(Boolean).reverse())].reverse().slice(-RECEIPT_LIMIT);
}

function safeAdd(first, second) {
  return first + Math.min(second, MAX_SAFE - first);
}

/** Repair stored data without importing any historical earnings again. */
export function normalizeProgress(input) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const levels = source.upgrades && typeof source.upgrades === 'object' ? source.upgrades : {};
  const characters = validUnlocks(source.unlocks?.characters, CHARACTERS);
  const weapons = validUnlocks(source.unlocks?.weapons, WEAPONS);
  return {
    version: 1,
    bank: nonnegativeInteger(source.bank),
    lifetimeGold: nonnegativeInteger(source.lifetimeGold),
    upgrades: Object.fromEntries(PERMANENT_UPGRADES.map(upgrade => [upgrade.id, Math.min(upgrade.maxLevel, nonnegativeInteger(levels[upgrade.id]))])),
    settledRunIds: receipts(source.settledRunIds),
    importedHistory: true,
    unlocks: { characters, weapons },
    loadout: {
      character: characters.includes(source.loadout?.character) ? source.loadout.character : 'wanderer',
      weapon: weapons.includes(source.loadout?.weapon) ? source.loadout.weapon : 'voidblade',
    },
  };
}

function completedHistoryRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record) || record.completed === false) return false;
  // The existing history collection contains finished runs without a phase field.
  // Explicit live-run records must never be imported as money already earned.
  if (record.phase != null && !['over', 'won', 'dead', 'finished', 'completed'].includes(record.phase)) return false;
  if (['playing', 'running', 'menu', 'paused', 'upgrade', 'unfinished'].includes(record.status)) return false;
  return true;
}

/** Call only when the saved progress record does not yet exist. */
export function createProgress(history = []) {
  const result = normalizeProgress(null);
  const ids = [];
  const seen = new Set();
  for (const record of Array.isArray(history) ? history : []) {
    if (!completedHistoryRecord(record)) continue;
    const id = receiptId(record.runId);
    if (id && seen.has(id)) continue;
    if (id) { seen.add(id); ids.push(id); }
    const gold = numeric(record.gold);
    if (!Number.isFinite(gold) || gold <= 0) continue;
    const amount = nonnegativeInteger(gold);
    result.bank = safeAdd(result.bank, amount);
    result.lifetimeGold = safeAdd(result.lifetimeGold, amount);
  }
  result.settledRunIds = receipts(ids);
  return result;
}

function upgradeCost(definition, level) {
  if (level >= definition.maxLevel) return null;
  return Math.min(MAX_SAFE, Math.ceil(definition.baseCost * (1 + 0.22 * level + 0.018 * level ** 2)));
}

function upgradeBonus(definition, level) {
  return definition.compound ? ((1 + definition.increment / 100) ** level - 1) * 100 : level * definition.increment;
}

export function getPermanentUpgradeOffers(progress) {
  const current = normalizeProgress(progress);
  return PERMANENT_UPGRADES.map(definition => {
    const level = current.upgrades[definition.id];
    const cost = upgradeCost(definition, level);
    const missingRequirements = definition.requires.filter(requirement => current.upgrades[requirement.id] < requirement.level);
    // Previously purchased nodes remain available when an older save predates branches.
    const locked = level === 0 && missingRequirements.length > 0;
    const requirementsText = definition.requires.map(requirement => `${PERMANENT_UPGRADES.find(node => node.id === requirement.id).name} Lv.${requirement.level}`).join(' · ');
    return {
      ...definition,
      level,
      cost,
      currentBonus: upgradeBonus(definition, level),
      nextBonus: upgradeBonus(definition, Math.min(definition.maxLevel, level + 1)),
      maxed: level >= definition.maxLevel,
      locked,
      requirementsText,
      canAfford: !locked && cost !== null && current.bank >= cost,
    };
  });
}

export function getPermanentBonuses(progress) {
  const { upgrades, loadout } = normalizeProgress(progress);
  const character = CHARACTERS.find(item => item.id === loadout.character);
  const weapon = WEAPONS.find(item => item.id === loadout.weapon);
  return {
    damageMultiplier: 1.12 ** upgrades.power * character.damageMultiplier * weapon.damageMultiplier,
    spellDamageMultiplier: 1.12 ** upgrades.arcana * character.spellDamageMultiplier,
    maxHpMultiplier: 1.1 ** upgrades.vitality * character.maxHpMultiplier,
    attackRateMultiplier: 1.025 ** upgrades.haste * weapon.attackRateMultiplier,
    spellRateMultiplier: 1.025 ** upgrades.focus,
    swordRangeMultiplier: (1 + 0.02 * upgrades.bladeReach) * weapon.swordRangeMultiplier,
    spellAreaMultiplier: 1 + 0.02 * upgrades.spellArea,
    armorBonus: 0.0075 * upgrades.armor,
    magnetMultiplier: 1 + 0.03 * upgrades.magnet,
    goldMultiplier: 1 + 0.05 * upgrades.fortune,
    characterId: character.id,
    weaponId: weapon.id,
  };
}

/** Accept a finished run receipt once. Valid zero-gold receipts are also recorded. */
export function settleRun(progress, run) {
  const current = normalizeProgress(progress);
  const runId = receiptId(run?.runId);
  const gold = numeric(run?.gold);
  if (!runId || !Number.isFinite(gold) || gold < 0) return { progress: current, credited: false, amount: 0, duplicate: false };
  if (current.settledRunIds.includes(runId)) return { progress: current, credited: false, amount: 0, duplicate: true };
  const earned = nonnegativeInteger(gold);
  const amount = Math.min(earned, MAX_SAFE - current.bank);
  return {
    progress: {
      ...current,
      bank: safeAdd(current.bank, earned),
      lifetimeGold: safeAdd(current.lifetimeGold, earned),
      settledRunIds: [...current.settledRunIds, runId].slice(-RECEIPT_LIMIT),
    },
    credited: true,
    amount,
    duplicate: false,
  };
}

/** This pure operation is called by the between-run UI, never by the live run shop. */
export function purchasePermanentUpgrade(progress, id) {
  const current = normalizeProgress(progress);
  const offer = getPermanentUpgradeOffers(current).find(upgrade => upgrade.id === id);
  if (!offer) return { progress: current, success: false, reason: 'unknown_upgrade', cost: null };
  if (offer.maxed) return { progress: current, success: false, reason: 'maxed', cost: null };
  if (offer.locked) return { progress: current, success: false, reason: 'prerequisite', cost: offer.cost };
  if (!offer.canAfford) return { progress: current, success: false, reason: 'insufficient_gold', cost: offer.cost };
  return {
    progress: {
      ...current,
      bank: current.bank - offer.cost,
      upgrades: { ...current.upgrades, [id]: offer.level + 1 },
    },
    success: true,
    reason: null,
    cost: offer.cost,
  };
}

/** All unlocks and selected equipment are saved alongside the same permanent wallet. */
export function getUnlockOffers(progress) {
  const current = normalizeProgress(progress);
  return ['character', 'weapon'].flatMap(type => unlockCatalog(type).map(definition => {
    const unlocked = current.unlocks[unlockKey(type)].includes(definition.id);
    return {
      ...definition,
      type,
      unlocked,
      selected: current.loadout[type] === definition.id,
      canAfford: !unlocked && current.bank >= definition.cost,
    };
  }));
}

export function purchaseUnlock(progress, type, id) {
  const current = normalizeProgress(progress);
  const definition = unlockCatalog(type)?.find(item => item.id === id);
  if (!definition) return { progress: current, success: false, reason: 'unknown_unlock', cost: null };
  const key = unlockKey(type);
  if (current.unlocks[key].includes(id)) return { progress: current, success: false, reason: 'already_unlocked', cost: 0 };
  if (current.bank < definition.cost) return { progress: current, success: false, reason: 'insufficient_gold', cost: definition.cost };
  return {
    progress: { ...current, bank: current.bank - definition.cost, unlocks: { ...current.unlocks, [key]: [...current.unlocks[key], id] } },
    success: true,
    reason: null,
    cost: definition.cost,
  };
}

export function selectLoadout(progress, type, id) {
  const current = normalizeProgress(progress);
  const definition = unlockCatalog(type)?.find(item => item.id === id);
  if (!definition) return { progress: current, success: false, reason: 'unknown_unlock' };
  if (!current.unlocks[unlockKey(type)].includes(id)) return { progress: current, success: false, reason: 'locked' };
  return { progress: { ...current, loadout: { ...current.loadout, [type]: id } }, success: true, reason: null };
}
