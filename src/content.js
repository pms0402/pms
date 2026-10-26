const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const validStats = value => value && typeof value === 'object' && !Array.isArray(value);
const uniqueIds = (value, definitions) => Array.isArray(value)
  ? [...new Set(value.filter(id => definitions.some(definition => definition.id === id)))] : [];

/** Relics change a run's behaviour; none can be stacked indefinitely. */
export const RELICS = Object.freeze([
  { id: 'blast', title: '화약 심장', description: '적 처치 시 작은 폭발. 폭발로 쓰러진 적은 연쇄 폭발하지 않습니다.', icon: 'flame', rarity: 'epic' },
  { id: 'pierce', title: '갈라진 검끝', description: '검의 한 번 베기로 타격할 수 있는 적 +2.', icon: 'sword', rarity: 'rare' },
  { id: 'blood', title: '붉은 맹세', description: '체력이 35% 이하일 때 검과 마법 피해 +20%.', icon: 'heart', rarity: 'epic' },
  { id: 'leech', title: '흡혈 이끼', description: '적을 처치할 때 체력 0.4 회복. 최대 체력을 넘지 않습니다.', icon: 'cross', rarity: 'rare' },
  { id: 'momentum', title: '사냥꾼의 박자', description: '10연속 처치부터 검 치명타 확률 +8%p.', icon: 'target', rarity: 'rare' },
  { id: 'frostfire', title: '서리불꽃', description: '서리로 둔화된 적에게 화염구 피해 +20%.', icon: 'snowflake', rarity: 'epic', synergy: ['fireball', 'frost'] },
  { id: 'thunderRune', title: '폭풍의 문양', description: '연쇄 번개와 궤도 룬을 함께 보유하면 마법 피해 +12%.', icon: 'orbit', rarity: 'epic', synergy: ['lightning', 'orbit'] },
  { id: 'greed', title: '탐욕의 인장', description: '골드 +15% · 모든 적 피해 +10%. 이후 출현하는 적 체력 +15%.', icon: 'coin', rarity: 'legendary' },
].map(Object.freeze));

/** Bad RNG inputs still produce a bounded, distinct set of unowned choices. */
export function getRelicChoices(stats = {}, random = Math.random) {
  const owned = uniqueIds(stats?.relics, RELICS);
  const pool = RELICS.filter(relic => !owned.includes(relic.id));
  const choices = [];
  while (pool.length && choices.length < 3) {
    const value = typeof random === 'function' ? finite(random(), 0) : 0;
    const index = Math.floor(clamp(value, 0, 0.999999999) * pool.length);
    choices.push({ ...pool.splice(index, 1)[0], category: 'relic' });
  }
  return choices;
}

/** A selection only takes effect once, and rejects invalid IDs without mutation. */
export function applyRelic(stats, id) {
  if (!validStats(stats) || !RELICS.some(relic => relic.id === id)) return false;
  const owned = uniqueIds(stats.relics, RELICS);
  if (owned.includes(id)) return false;
  switch (id) {
    case 'blast': stats.killExplosion = true; break;
    case 'pierce': stats.swordTargetsBonus = clamp(finite(stats.swordTargetsBonus) + 2, 0, 4); break;
    case 'blood': stats.lowHealthDamageBonus = clamp(finite(stats.lowHealthDamageBonus) + 0.2, 0, 0.4); break;
    case 'leech': stats.lifeOnKill = clamp(finite(stats.lifeOnKill) + 0.4, 0, 1.2); break;
    case 'momentum': stats.comboCritBonus = clamp(finite(stats.comboCritBonus) + 0.08, 0, 0.16); break;
    case 'frostfire': stats.frostfireBonus = clamp(finite(stats.frostfireBonus) + 0.2, 0, 0.4); break;
    case 'thunderRune': stats.runeSynergyBonus = clamp(finite(stats.runeSynergyBonus) + 0.12, 0, 0.24); break;
    case 'greed':
      stats.goldMultiplier = clamp(finite(stats.goldMultiplier, 1), 1, 3) * 1.15;
      stats.relicThreat = {
        enemyHealth: clamp(finite(stats.relicThreat?.enemyHealth, 1), 1, 3) * 1.15,
        enemyDamage: clamp(finite(stats.relicThreat?.enemyDamage, 1), 1, 3) * 1.1,
      };
      break;
  }
  stats.relics = [...owned, id];
  return true;
}

/** Optional contracts increase reward together with survivability pressure. */
export const RISK_PACTS = Object.freeze([
  { id: 'none', name: '기본 탐험', description: '추가 위험 없이 기본 보상으로 출발합니다.', enemyHealth: 1, enemyDamage: 1, enemySpeed: 1, spawnRate: 1, goldMultiplier: 1 },
  { id: 'swarm', name: '군세의 계약', description: '골드 ×1.8 · 적 체력 +30%, 피해 +15%, 출현 빈도 +40%.', enemyHealth: 1.3, enemyDamage: 1.15, enemySpeed: 1, spawnRate: 1.4, goldMultiplier: 1.8 },
  { id: 'fury', name: '광란의 계약', description: '골드 ×2.2 · 적 체력 +65%, 피해 +40%, 속도 +8%, 출현 빈도 +10%.', enemyHealth: 1.65, enemyDamage: 1.4, enemySpeed: 1.08, spawnRate: 1.1, goldMultiplier: 2.2 },
].map(Object.freeze));

export function getRiskStats(id = 'none') {
  return { ...(RISK_PACTS.find(pact => pact.id === id) || RISK_PACTS[0]) };
}

/** Gold from a greed relic is already in stats.goldMultiplier; do not apply it twice. */
export function getThreatModifiers(stats = {}, pactId = 'none') {
  const pact = getRiskStats(pactId);
  return {
    ...pact,
    enemyHealth: pact.enemyHealth * clamp(finite(stats?.relicThreat?.enemyHealth, 1), 1, 3),
    enemyDamage: pact.enemyDamage * clamp(finite(stats?.relicThreat?.enemyDamage, 1), 1, 3),
  };
}

export const BOSS_REWARDS = Object.freeze([
  { id: 'warden', stage: 1, title: '파수꾼의 검집', description: '검의 공격 범위 +10%.', icon: 'sword', rarity: 'legendary' },
  { id: 'breaker', stage: 2, title: '파괴자의 송곳니', description: '검 공격력 +12%. 마법 공격력에는 영향을 주지 않습니다.', icon: 'sword', rarity: 'legendary' },
  { id: 'plague', stage: 3, title: '역병의 씨앗', description: '적 처치 시 작은 독 폭발. 폭발 처치는 다시 폭발하지 않습니다.', icon: 'flame', rarity: 'legendary' },
  { id: 'abyss', stage: 4, title: '심연의 성배', description: '마법 공격력 +12%. 검 공격력에는 영향을 주지 않습니다.', icon: 'orbit', rarity: 'legendary' },
  { id: 'crown', stage: 5, title: '공허의 왕관', description: '최종 보스 이후 줍는 골드 +10%. 이미 획득한 골드에는 소급되지 않습니다.', icon: 'diamond', rarity: 'legendary' },
].map(Object.freeze));

export function getBossReward(stage) {
  const reward = BOSS_REWARDS.find(candidate => candidate.stage === Number(stage));
  return reward ? { ...reward, category: 'boss' } : null;
}

export function applyBossReward(stats, stage) {
  const reward = getBossReward(stage);
  if (!validStats(stats) || !reward) return false;
  const owned = uniqueIds(stats.bossRewards, BOSS_REWARDS);
  if (owned.includes(reward.id)) return false;
  switch (reward.id) {
    case 'warden': stats.swordRangeMultiplier = clamp(finite(stats.swordRangeMultiplier, 1), 1, 3) * 1.1; break;
    case 'breaker': stats.damage = clamp(finite(stats.damage, 18), 0, 1e9) * 1.12; break;
    case 'plague': stats.poisonExplosion = true; break;
    case 'abyss': stats.spellDamage = clamp(finite(stats.spellDamage, 18), 0, 1e9) * 1.12; break;
    case 'crown': stats.goldMultiplier = clamp(finite(stats.goldMultiplier, 1), 1, 3) * 1.1; break;
  }
  stats.bossRewards = [...owned, reward.id];
  return true;
}
