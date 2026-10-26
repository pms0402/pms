const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const validStats = value => value && typeof value === 'object' && !Array.isArray(value);
const multiplyStat = (stats, key, factor, fallback = 1, maximum = 1e12) => {
  stats[key] = Math.min(maximum, clamp(finite(stats[key], fallback), 0, maximum / factor) * factor);
};
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
  { id: 'whetstone', title: '별철 숫돌', description: '검 공격력 ×1.4. 마법 공격력과 별도로 적용됩니다.', icon: 'sword', rarity: 'epic' },
  { id: 'warDrum', title: '전쟁의 북', description: '검 공격 속도 ×1.2. 더 빠른 연속 베기.', icon: 'bolt', rarity: 'rare' },
  { id: 'longblade', title: '거인의 검집', description: '검 타격 범위 ×1.2. 더 멀리 있는 적까지 벱니다.', icon: 'sword', rarity: 'rare' },
  { id: 'executioner', title: '집행자의 인장', description: '정예와 보스에게 주는 검·마법 피해 +30%.', icon: 'target', rarity: 'epic' },
  { id: 'arcanePrism', title: '비전 프리즘', description: '마법 공격력 ×1.4. 검 공격력과 별도로 적용됩니다.', icon: 'orbit', rarity: 'epic' },
  { id: 'hourglass', title: '별빛 모래시계', description: '모든 마법의 시전 속도 ×1.2.', icon: 'bolt', rarity: 'epic' },
  { id: 'wideSigil', title: '퍼지는 성문', description: '마법 효과 범위 ×1.18. 폭발·파동·번개·궤도를 넓힙니다.', icon: 'orbit', rarity: 'rare' },
  { id: 'inferno', title: '불사조의 깃털', description: '화염구 피해 +25%. 화염구를 습득하면 적용됩니다.', icon: 'flame', rarity: 'epic', synergy: ['fireball'] },
  { id: 'glacier', title: '빙하의 파편', description: '서리 파동과 눈보라 피해 +25%. 서리 습득 후 적용.', icon: 'snowflake', rarity: 'epic', synergy: ['frost'] },
  { id: 'conductor', title: '천둥의 지휘봉', description: '연쇄 번개 피해 +25%. 번개를 습득하면 적용됩니다.', icon: 'bolt', rarity: 'epic', synergy: ['lightning'] },
  { id: 'satellites', title: '달의 파수꾼', description: '궤도 룬과 궤도 파동 피해 +25%. 룬 습득 후 적용.', icon: 'orbit', rarity: 'epic', synergy: ['orbit'] },
  { id: 'giantsHeart', title: '거인의 심장', description: '최대 체력 ×1.4. 늘어난 최대 체력만큼 즉시 회복.', icon: 'heart', rarity: 'epic' },
  { id: 'ironroot', title: '강철 뿌리', description: '받는 피해 감소 +8%p. 최대 피해 감소 60%.', icon: 'shield', rarity: 'rare' },
  { id: 'spring', title: '생명의 샘', description: '매초 최대 체력의 0.8%를 추가로 재생합니다.', icon: 'cross', rarity: 'epic' },
  { id: 'windstep', title: '바람의 발목', description: '이동 속도 ×1.15. 빠르게 이동하며 공격을 피하세요.', icon: 'move', rarity: 'rare' },
  { id: 'vacuum', title: '공허의 자석', description: '경험치·골드 획득 범위 ×1.4.', icon: 'magnet', rarity: 'rare' },
  { id: 'huntersWisdom', title: '사냥꾼의 기록', description: '획득하는 경험치 ×1.35. 레벨업과 마법 진화 가속.', icon: 'diamond', rarity: 'rare' },
  { id: 'alchemy', title: '금빛 연금로', description: '골드 +30% · 모든 적 피해 +15%. 이후 출현하는 적 체력 +20%.', icon: 'coin', rarity: 'legendary' },
  { id: 'secondWind', title: '불굴의 불씨', description: '이번 런에 한 번, 사망 시 체력 35%로 부활하고 1.5초 무적.', icon: 'heart', rarity: 'legendary' },
  { id: 'shockwave', title: '돌진의 뇌심', description: '대시할 때 검 공격력의 80% 피해를 주는 충격파 발생.', icon: 'bolt', rarity: 'epic' },
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
      multiplyStat(stats, 'goldMultiplier', 1.15);
      stats.relicThreat = {
        enemyHealth: clamp(finite(stats.relicThreat?.enemyHealth, 1), 1, 3) * 1.15,
        enemyDamage: clamp(finite(stats.relicThreat?.enemyDamage, 1), 1, 3) * 1.1,
      };
      break;
    case 'whetstone': multiplyStat(stats, 'damage', 1.4, 18); break;
    case 'warDrum': multiplyStat(stats, 'attackRate', 1.2, 1.5); break;
    case 'longblade': multiplyStat(stats, 'swordRangeMultiplier', 1.2); break;
    case 'executioner': stats.eliteDamageBonus = clamp(finite(stats.eliteDamageBonus) + 0.3, 0, 1); break;
    case 'arcanePrism': multiplyStat(stats, 'spellDamage', 1.4, 18); break;
    case 'hourglass': multiplyStat(stats, 'spellRate', 1.2, 1.5); break;
    case 'wideSigil': multiplyStat(stats, 'spellAreaMultiplier', 1.18); break;
    case 'inferno': stats.fireballBonus = clamp(finite(stats.fireballBonus) + 0.25, 0, 1); break;
    case 'glacier': stats.frostBonus = clamp(finite(stats.frostBonus) + 0.25, 0, 1); break;
    case 'conductor': stats.lightningBonus = clamp(finite(stats.lightningBonus) + 0.25, 0, 1); break;
    case 'satellites': stats.orbitBonus = clamp(finite(stats.orbitBonus) + 0.25, 0, 1); break;
    case 'giantsHeart': multiplyStat(stats, 'maxHp', 1.4, 100); break;
    case 'ironroot': stats.armor = clamp(finite(stats.armor) + 0.08, 0, 0.6); break;
    case 'spring': stats.regen = clamp(finite(stats.regen) + 0.8, 0, 20); break;
    case 'windstep': multiplyStat(stats, 'speed', 1.15, 7.5, 20); break;
    case 'vacuum': multiplyStat(stats, 'magnet', 1.4, 5.5, 100); break;
    case 'huntersWisdom': multiplyStat(stats, 'xpMultiplier', 1.35); break;
    case 'alchemy':
      multiplyStat(stats, 'goldMultiplier', 1.3);
      stats.relicThreat = {
        enemyHealth: clamp(finite(stats.relicThreat?.enemyHealth, 1), 1, 3) * 1.2,
        enemyDamage: clamp(finite(stats.relicThreat?.enemyDamage, 1), 1, 3) * 1.15,
      };
      break;
    case 'secondWind': stats.reviveCharges = clamp(Math.floor(finite(stats.reviveCharges)) + 1, 0, 1); break;
    case 'shockwave': stats.dashShockwave = true; break;
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
  { id: 'voidheart', stage: 5, title: '공허의 심장', description: '레벨업에서 선택하면 최대 체력 +15%.', icon: 'heart', rarity: 'legendary' },
  { id: 'reaperBeat', stage: 6, title: '사신의 박자', description: '검 공격 속도와 마법 시전 속도 +8%.', icon: 'bolt', rarity: 'legendary' },
  { id: 'sight', stage: 7, title: '파괴자의 조준경', description: '치명타 확률 +5%p. 최대 65%.', icon: 'target', rarity: 'legendary' },
  { id: 'aegis', stage: 8, title: '망각의 수호석', description: '받는 피해 감소 +4%p. 최대 60%.', icon: 'shield', rarity: 'legendary' },
  { id: 'legion', stage: 9, title: '군단의 전술서', description: '검의 추가 타격 대상 +1 · 마법 공격력 +8%.', icon: 'sword', rarity: 'legendary' },
  { id: 'crown', stage: 10, title: '종말의 왕관', description: '최종 보스 이후 줍는 골드 +10%. 이미 획득한 골드에는 소급되지 않습니다.', icon: 'diamond', rarity: 'legendary' },
].map(Object.freeze));

export function getBossReward(stage) {
  const reward = BOSS_REWARDS.find(candidate => candidate.stage === Number(stage));
  return reward ? { ...reward, category: 'boss' } : null;
}

/** Apply only a boss legacy explicitly selected from an earned level-up offer. */
export function applyBossReward(stats, stage) {
  const reward = getBossReward(stage);
  if (!validStats(stats) || !reward) return false;
  const owned = uniqueIds(stats.bossRewards, BOSS_REWARDS);
  if (owned.includes(reward.id)) return false;
  switch (reward.id) {
    case 'warden': stats.swordRangeMultiplier = clamp(finite(stats.swordRangeMultiplier, 1), 1, 3) * 1.1; break;
    case 'breaker': multiplyStat(stats, 'damage', 1.12, 18); break;
    case 'plague': stats.poisonExplosion = true; break;
    case 'abyss': multiplyStat(stats, 'spellDamage', 1.12, 18); break;
    case 'voidheart': multiplyStat(stats, 'maxHp', 1.15, 100); break;
    case 'reaperBeat':
      multiplyStat(stats, 'attackRate', 1.08, 1.5);
      multiplyStat(stats, 'spellRate', 1.08, 1.5);
      break;
    case 'sight': stats.critChance = clamp(finite(stats.critChance, .08) + .05, 0, .65); break;
    case 'aegis': stats.armor = clamp(finite(stats.armor) + .04, 0, .6); break;
    case 'legion':
      stats.swordTargetsBonus = clamp(finite(stats.swordTargetsBonus) + 1, 0, 4);
      multiplyStat(stats, 'spellDamage', 1.08, 18);
      break;
    case 'crown': multiplyStat(stats, 'goldMultiplier', 1.1); break;
  }
  stats.bossRewards = [...owned, reward.id];
  return true;
}
