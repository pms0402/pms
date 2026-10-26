/** The economy and enemy curve are deliberately independent of player upgrades. */
export const STAGE_DURATION = 45;
export const MAX_STAGES = 5;

function stageNumber(stage) {
  return Math.max(1, Math.floor(Number(stage) || 1));
}

export function getStageStats(stage = 1) {
  const index = stageNumber(stage) - 1;
  return {
    enemyHealth: 10 * 3.2 ** index,
    enemyDamage: 5 * 3.2 ** index,
    coinValue: 10 ** index,
    spawnInterval: getSpawnInterval(stage, 0),
    maxEnemies: Math.min(140, 36 + index * 26),
  };
}

/** Quiet opening, then a continuous ramp into the final-stage horde. Seconds. */
export function getSpawnInterval(stage = 1, stageTime = 0) {
  const index = stageNumber(stage) - 1;
  const elapsed = Math.max(0, Math.min(STAGE_DURATION, Number(stageTime) || 0));
  const ramp = Math.max(0, (elapsed - 8) / (STAGE_DURATION - 8));
  const openingInterval = 2.2 / (1 + index * 0.7);
  return Math.max(0.085, openingInterval * (1 - 0.84 * ramp ** 1.4));
}

export function getXpRequired(level = 1) {
  const index = Math.max(0, Math.floor(Number(level) || 1) - 1);
  return 8 + index * 4 + Math.floor(index ** 1.3);
}

export function formatGold(value = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return amount === Infinity ? '∞' : '0';
  const safe = Math.max(0, amount);
  const units = [
    [1e16, '경'],
    [1e12, '조'],
    [1e8, '억'],
    [1e4, '만'],
  ];
  for (const [divisor, suffix] of units) {
    if (safe >= divisor) {
      const compact = Math.floor((safe / divisor) * 10) / 10;
      return `${compact.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${suffix}`;
    }
  }
  return Math.floor(safe).toLocaleString('ko-KR');
}

const UPGRADES = [
  { id: 'power', title: '공허의 칼날', description: '모든 공격의 피해량 +75%', rarity: 'epic', icon: 'sword', weight: 5 },
  { id: 'haste', title: '광란의 리듬', description: '공격 속도 +22%', rarity: 'rare', icon: 'bolt', weight: 4 },
  { id: 'vitality', title: '끈질긴 생명', description: '최대 체력 +40 · 체력 40 회복', rarity: 'rare', icon: 'heart', weight: 3 },
  { id: 'magnet', title: '탐욕의 자석', description: '경험치와 골드 획득 범위 +40%', rarity: 'rare', icon: 'magnet', weight: 2 },
  { id: 'multishot', title: '별의 파편', description: '마법 투사체 +1개', rarity: 'legendary', icon: 'sparkles', weight: 2 },
  { id: 'critical', title: '치명적인 직감', description: '치명타 확률 +12%p · 치명타는 2배 피해', rarity: 'epic', icon: 'crosshair', weight: 3 },
  { id: 'armor', title: '흑요석 갑옷', description: '받는 피해 10%p 감소', rarity: 'rare', icon: 'shield', weight: 3 },
  { id: 'regen', title: '숲의 숨결', description: '초당 체력 2 재생', rarity: 'epic', icon: 'leaf', weight: 2 },
];

/** Returns three distinct choices. A supplied RNG keeps simulations reproducible. */
export function getUpgradeChoices(playerStats = {}, random = Math.random) {
  const candidates = UPGRADES.filter((upgrade) => {
    if (upgrade.id === 'critical') return (playerStats.critChance ?? 0.08) < 0.85;
    if (upgrade.id === 'armor') return (playerStats.armor ?? 0) < 0.7;
    if (upgrade.id === 'multishot') return (playerStats.projectiles ?? 1) < 6;
    return true;
  });
  const choices = [];
  while (choices.length < 3 && candidates.length) {
    const total = candidates.reduce((sum, upgrade) => sum + upgrade.weight, 0);
    let cursor = Math.max(0, Math.min(0.999999, Number(random()) || 0)) * total;
    let selected = candidates.length - 1;
    for (let index = 0; index < candidates.length; index += 1) {
      cursor -= candidates[index].weight;
      if (cursor < 0) { selected = index; break; }
    }
    const { weight: _weight, ...choice } = candidates.splice(selected, 1)[0];
    choices.push(choice);
  }
  return choices;
}

export function applyUpgrade(stats, id) {
  switch (id) {
    case 'power': stats.damage = (stats.damage ?? 18) * 1.75; break;
    case 'haste': stats.attackRate = (stats.attackRate ?? 1.5) * 1.22; break;
    case 'vitality': stats.maxHp = (stats.maxHp ?? 100) + 40; break;
    case 'magnet': stats.magnet = (stats.magnet ?? 5) * 1.4; break;
    case 'multishot': stats.projectiles = Math.min(6, (stats.projectiles ?? 1) + 1); break;
    case 'critical': stats.critChance = Math.min(0.9, (stats.critChance ?? 0.08) + 0.12); break;
    case 'armor': stats.armor = Math.min(0.75, (stats.armor ?? 0) + 0.1); break;
    case 'regen': stats.regen = (stats.regen ?? 0) + 2; break;
    default: return false;
  }
  return true;
}
