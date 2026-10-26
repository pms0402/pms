/** Stage economy is independent of the player's selected build. */
export const STAGE_DURATION = 120;
export const BOSS_SPAWN_TIME = 90;
export const MAX_STAGES = 5;
// Doubling the playable radius gives four times the previous map area.
export const ARENA_RADIUS = 62;

const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const stageNumber = stage => clamp(Math.floor(finite(stage, 1)), 1, MAX_STAGES);

export function getStageStats(stage = 1) {
  const index = stageNumber(stage) - 1;
  return {
    enemyHealth: 28 * 3.2 ** index,
    enemyDamage: 7.5 * 3.2 ** index,
    coinValue: 10 ** index,
    spawnInterval: getSpawnInterval(stage, 0),
    maxEnemies: Math.min(160, 56 + index * 26),
  };
}

/** A quiet first twelve seconds, followed by a continuous two-minute ramp. */
export function getSpawnInterval(stage = 1, stageTime = 0) {
  const index = stageNumber(stage) - 1;
  const elapsed = clamp(finite(stageTime, 0), 0, STAGE_DURATION);
  const ramp = Math.max(0, (elapsed - 12) / (STAGE_DURATION - 12));
  const openingInterval = 2.6 / (1 + index * 0.8);
  return Math.max(0.085, openingInterval * (1 - 0.88 * ramp ** 1.35));
}

const BOSS_NAMES = ['초원의 파수꾼', '황혼의 파괴자', '역병의 군주', '심연의 집행자', '공허의 왕'];

export function getBossStats(stage = 1) {
  const index = stageNumber(stage) - 1;
  const stats = getStageStats(stage);
  return {
    name: BOSS_NAMES[index],
    health: stats.enemyHealth * 35,
    damage: stats.enemyDamage * 1.3,
    coinValue: stats.coinValue * 25,
    xpValue: 15,
  };
}

/** The first choices arrive early; later levels still require combat and pickups. */
export function getXpRequired(level = 1) {
  const index = Math.max(0, Math.floor(finite(level, 1)) - 1);
  return 5 + index * 2 + Math.floor(index ** 1.15 * 0.8);
}

export function formatGold(value = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return amount === Infinity ? '∞' : '0';
  const safe = Math.max(0, amount);
  const units = [[1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  for (const [divisor, suffix] of units) {
    if (safe >= divisor) {
      const compact = Math.floor((safe / divisor) * 10) / 10;
      return `${compact.toLocaleString('ko-KR', { maximumFractionDigits: 1 })}${suffix}`;
    }
  }
  return Math.floor(safe).toLocaleString('ko-KR');
}

export const SPELLS = [
  { id: 'fireball', name: '화염구', description: '가까운 적을 향해 날아가 폭발하는 화염구.', icon: 'flame', color: '#ff9363', evolutionName: '태양의 격노', maxRank: 5 },
  { id: 'frost', name: '서리 파동', description: '주변 적에게 피해를 주고 2초 동안 50% 둔화.', icon: 'snowflake', color: '#87dcff', evolutionName: '영원의 눈보라', maxRank: 5 },
  { id: 'lightning', name: '연쇄 번개', description: '여러 적 사이를 도약하는 자동 연쇄 번개.', icon: 'bolt', color: '#d4b5ff', evolutionName: '폭풍의 심판', maxRank: 5 },
  { id: 'orbit', name: '궤도 룬', description: '몸 주위를 회전하며 가까운 적을 타격하는 룬.', icon: 'orbit', color: '#a8ffc3', evolutionName: '공허의 성좌', maxRank: 5 },
];

const SPELL_UPGRADES = {
  fireball: '화염구 피해와 폭발 범위 증가 · 재사용 시간 감소',
  frost: '서리 피해와 범위 증가 · 재사용 시간 감소',
  lightning: '번개 피해 증가 · 성장에 따라 추가 적에게 도약',
  orbit: '룬 피해와 궤도 범위 증가 · 성장에 따라 룬 추가',
};
const EVOLUTIONS = {
  fireball: '화염구를 3연속 발사하고 폭발의 여진을 남깁니다.',
  frost: '눈보라를 남기며 적을 70% 둔화시킵니다.',
  lightning: '가지치는 두 갈래 번개가 더 많은 적을 타격합니다.',
  orbit: '룬 3개 추가 · 궤도 확대 · 광역 파동 발생',
};

const PASSIVES = [
  { id: 'power', title: '예리한 칼날', description: '검과 마법의 공격력 +5%', rarity: 'rare', icon: 'sword', weight: 4, maxRank: 12 },
  { id: 'haste', title: '정교한 호흡', description: '검과 마법의 공격 속도 +5%', rarity: 'rare', icon: 'bolt', weight: 3, maxRank: 12 },
  { id: 'vitality', title: '생명의 씨앗', description: '최대 체력 +5% · 증가한 체력만큼 회복', rarity: 'rare', icon: 'heart', weight: 3, maxRank: 12 },
  { id: 'magnet', title: '작은 탐욕', description: '경험치와 골드 획득 범위 +8%', rarity: 'rare', icon: 'magnet', weight: 2, maxRank: 12 },
  { id: 'critical', title: '집중', description: '치명타 확률 +2%p', rarity: 'rare', icon: 'target', weight: 2, maxRank: 12 },
  { id: 'armor', title: '흑요석 조각', description: '받는 피해 감소 +2%p', rarity: 'rare', icon: 'shield', weight: 3, maxRank: 12 },
  { id: 'regen', title: '숲의 숨결', description: '초당 최대 체력의 0.2% 재생 추가', rarity: 'rare', icon: 'cross', weight: 2, maxRank: 10 },
  { id: 'speed', title: '가벼운 발걸음', description: '이동 속도 +3%', rarity: 'rare', icon: 'move', weight: 2, maxRank: 12 },
];

const spellRank = (stats, id) => clamp(Math.floor(finite(stats?.spells?.[id], 0)), 0, 5);
const passiveRank = (stats, id) => Math.max(0, Math.floor(finite(stats?.passiveLevels?.[id], 0)));

function spellChoices(stats = {}) {
  return SPELLS.flatMap(spell => {
    const rank = spellRank(stats, spell.id);
    if (rank < spell.maxRank) return [{
      id: `spell_${spell.id}`,
      title: rank ? `${spell.name} 강화` : `${spell.name} 습득`,
      description: rank ? SPELL_UPGRADES[spell.id] : spell.description,
      rarity: rank ? 'epic' : 'rare',
      icon: spell.icon,
      category: 'spell',
      rank: rank + 1,
      maxRank: spell.maxRank,
      spellId: spell.id,
      weight: rank === 0 ? 4 : 5,
    }];
    if (!stats.evolutions?.[spell.id]) return [{
      id: `evolve_${spell.id}`, title: spell.evolutionName,
      description: EVOLUTIONS[spell.id], rarity: 'legendary', icon: spell.icon,
      category: 'evolution', rank: 5, maxRank: 5, spellId: spell.id, weight: 12,
    }];
    return [];
  });
}

function passiveChoices(stats = {}) {
  return PASSIVES.filter(passive => {
    if (passiveRank(stats, passive.id) >= passive.maxRank) return false;
    if (passive.id === 'critical' && finite(stats.critChance, 0.08) >= 0.6) return false;
    if (passive.id === 'armor' && finite(stats.armor, 0) >= 0.5) return false;
    return true;
  }).map(passive => ({ ...passive, category: 'passive', rank: passiveRank(stats, passive.id) + 1 }));
}

function takeWeighted(candidates, random) {
  const total = candidates.reduce((sum, choice) => sum + choice.weight, 0);
  let cursor = clamp(finite(random(), 0), 0, 0.999999) * total;
  let index = candidates.length - 1;
  for (let i = 0; i < candidates.length; i++) {
    cursor -= candidates[i].weight;
    if (cursor < 0) { index = i; break; }
  }
  return candidates.splice(index, 1)[0];
}

const withoutWeight = ({ weight: _weight, ...choice }) => choice;

/** Every level offers a spell when one is available, alongside small passives. */
export function getUpgradeChoices(playerStats = {}, random = Math.random) {
  const spells = spellChoices(playerStats);
  const passives = passiveChoices(playerStats);
  const selected = [];
  if (spells.length) selected.push(takeWeighted(spells, random));
  if (passives.length) selected.push(takeWeighted(passives, random));
  const remaining = [...spells, ...passives];
  while (selected.length < 3 && remaining.length) selected.push(takeWeighted(remaining, random));
  return selected.map(withoutWeight);
}

/** Apply exactly one valid choice; bounded temporary upgrades stay within their caps. */
export function applyUpgrade(stats, id) {
  if (!stats || typeof stats !== 'object') return false;
  const spell = SPELLS.find(candidate => id === `spell_${candidate.id}` || id === `evolve_${candidate.id}`);
  if (spell) {
    const rank = spellRank(stats, spell.id);
    if (id.startsWith('evolve_')) {
      if (rank < spell.maxRank || stats.evolutions?.[spell.id]) return false;
      stats.evolutions ||= {};
      stats.evolutions[spell.id] = true;
    } else {
      if (rank >= spell.maxRank) return false;
      stats.spells ||= {};
      stats.spells[spell.id] = rank + 1;
    }
    return true;
  }
  const passive = passiveChoices(stats).find(candidate => candidate.id === id);
  if (!passive) return false;
  switch (id) {
    case 'power': stats.damage = finite(stats.damage, 18) * 1.05; break;
    case 'haste': stats.attackRate = finite(stats.attackRate, 1.5) * 1.05; break;
    case 'vitality': stats.maxHp = finite(stats.maxHp, 100) * 1.05; break;
    case 'magnet': stats.magnet = finite(stats.magnet, 5.5) * 1.08; break;
    case 'critical': stats.critChance = Math.min(0.6, finite(stats.critChance, 0.08) + 0.02); break;
    case 'armor': stats.armor = Math.min(0.5, finite(stats.armor, 0) + 0.02); break;
    case 'regen': stats.regen = finite(stats.regen, 0) + 0.2; break;
    case 'speed': stats.speed = finite(stats.speed, 7.5) * 1.03; break;
    default: return false;
  }
  stats.passiveLevels ||= {};
  stats.passiveLevels[id] = passiveRank(stats, id) + 1;
  return true;
}
