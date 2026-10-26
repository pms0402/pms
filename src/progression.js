const MAX_SAFE = Number.MAX_SAFE_INTEGER;
const RECEIPT_LIMIT = 200;

/** Permanent upgrades are intentionally small; a run's build still matters. */
export const PERMANENT_UPGRADES = [
  { id: 'power', name: '무기 숙련', description: '모든 런의 기본 공격력 +2%', icon: 'sword', maxLevel: 50, baseCost: 20, increment: 2, unit: '%' },
  { id: 'vitality', name: '생명의 뿌리', description: '모든 런의 기본 최대 체력 +2%', icon: 'heart', maxLevel: 50, baseCost: 25, increment: 2, unit: '%' },
  { id: 'haste', name: '전투 감각', description: '모든 런의 기본 공격 속도 +1%', icon: 'bolt', maxLevel: 40, baseCost: 30, increment: 1, unit: '%' },
  { id: 'armor', name: '견고한 피부', description: '모든 런의 기본 피해 감소 +0.5%p', icon: 'shield', maxLevel: 40, baseCost: 40, increment: 0.5, unit: '%p' },
  { id: 'magnet', name: '잔향 자석', description: '모든 런의 기본 획득 범위 +2%', icon: 'magnet', maxLevel: 30, baseCost: 18, increment: 2, unit: '%' },
  { id: 'fortune', name: '황금의 운', description: '모든 런의 골드 획득량 +1%', icon: 'coin', maxLevel: 30, baseCost: 35, increment: 1, unit: '%' },
];

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
  return {
    version: 1,
    bank: nonnegativeInteger(source.bank),
    lifetimeGold: nonnegativeInteger(source.lifetimeGold),
    upgrades: Object.fromEntries(PERMANENT_UPGRADES.map(upgrade => [upgrade.id, Math.min(upgrade.maxLevel, nonnegativeInteger(levels[upgrade.id]))])),
    settledRunIds: receipts(source.settledRunIds),
    importedHistory: true,
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
  return Math.min(MAX_SAFE, Math.ceil(definition.baseCost * 1.6 ** level));
}

export function getPermanentUpgradeOffers(progress) {
  const current = normalizeProgress(progress);
  return PERMANENT_UPGRADES.map(definition => {
    const level = current.upgrades[definition.id];
    const cost = upgradeCost(definition, level);
    return {
      ...definition,
      level,
      cost,
      currentBonus: level * definition.increment,
      nextBonus: Math.min(definition.maxLevel, level + 1) * definition.increment,
      maxed: level >= definition.maxLevel,
      canAfford: cost !== null && current.bank >= cost,
    };
  });
}

export function getPermanentBonuses(progress) {
  const { upgrades } = normalizeProgress(progress);
  return {
    damageMultiplier: 1 + 0.02 * upgrades.power,
    maxHpMultiplier: 1 + 0.02 * upgrades.vitality,
    attackRateMultiplier: 1 + 0.01 * upgrades.haste,
    armorBonus: 0.005 * upgrades.armor,
    magnetMultiplier: 1 + 0.02 * upgrades.magnet,
    goldMultiplier: 1 + 0.01 * upgrades.fortune,
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
