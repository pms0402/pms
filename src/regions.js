import { getEnemyPool, getEnemyDefinition } from './encounters.js';
import { getRelicChoices, RELICS } from './content.js';

const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const roll = random => clamp(Number(typeof random === 'function' ? random() : random) || 0, 0, .999999999);
const neutral = { enemyHealth: 1, enemyDamage: 1, goldMultiplier: 1, spawnMultiplier: 1, eliteMultiplier: 1, chestBonus: 0, mutationBias: [], relicAffinity: [], enemyWeights: {}, earlyEnemies: [] };
const define = region => Object.freeze({ ...neutral, ...region, title: region.name });
export const SANCTUM_REGION = define({ id: 'sanctum', name: '잊혀진 성역', english: 'FORSAKEN SANCTUM', icon: 'shield', color: '#c2a875', palette: ['#454640', '#202b32', '#b7c7d8', '#c2a875'], description: '첫 전투를 준비하는 고딕 성역.', hazard: '추가 지역 위험 없음', reward: '기본 보상', counterplay: '추격자를 피하며 이번 런의 빌드를 준비하세요.' });

/** Regional multipliers add tactical pressure without ever changing player base stats. */
export const REGIONS = Object.freeze([
  define({ id: 'volcano', name: '화산 지대', english: 'EMBER CALDERA', icon: 'fire', color: '#ff925b', palette: ['#713a2b', '#301c1d', '#efccb5', '#ff925b'], enemyHealth: 1.1, enemyDamage: 1.06, goldMultiplier: 1.3,
    mutationBias: ['explosive'], relicAffinity: ['inferno', 'blast', 'frostfire'], enemyWeights: { 3: 1.6, 5: 1.6, 6: 3 }, earlyEnemies: [{ kind: 6, stage: 2, weight: 8 }],
    description: '붉은 용암 균열 위로 불씨 자폭충과 화염 사술사가 모입니다.', hazard: '14초마다 발밑 용암 예고 1.4초 → 반경 2.6m 분출. 적 체력 ×1.1 · 피해 ×1.06.', reward: '획득 골드 ×1.3 · 상자 유물 선택에 화염 유물 1칸 보장(미보유 후보가 있을 때).', counterplay: '분출 표식에서 벗어나세요. 화염 빌드 없이도 대시와 이동으로 모든 분출을 피할 수 있습니다.' }),
  define({ id: 'tundra', name: '빙결 설원', english: 'GLACIAL WASTES', icon: 'snow', color: '#94e5ff', palette: ['#b6d1d9', '#263946', '#d3efff', '#94e5ff'], enemyHealth: 1.08, enemyDamage: 1.04, goldMultiplier: 1.2,
    mutationBias: ['steel'], relicAffinity: ['glacier', 'frostfire'], enemyWeights: { 1: 1.4, 3: 2, 8: 1.5 }, earlyEnemies: [{ kind: 3, stage: 2, weight: 10 }],
    description: '서리 사술사와 날렵한 사냥꾼이 얼어붙은 폐허를 지킵니다.', hazard: '서리 사술사·사냥꾼의 적중 공격은 이동을 0.9초간 18% 둔화. 적 체력 ×1.08 · 피해 ×1.04.', reward: '획득 골드 ×1.2 · 상자 유물 선택에 서리 유물 1칸 보장(미보유 후보가 있을 때).', counterplay: '둔화된 적에게 서리 피해 +10%. 이 지역은 서리 공격에 면역이 없으며 대시는 둔화되지 않습니다.' }),
  define({ id: 'forest', name: '오염된 숲', english: 'BLIGHTED WOOD', icon: 'heart', color: '#b2df78', palette: ['#344735', '#162d26', '#b8d6aa', '#b2df78'], enemyHealth: 1.1, enemyDamage: 1.05, goldMultiplier: 1.25,
    mutationBias: ['splitter', 'vampire'], relicAffinity: ['leech', 'ironroot', 'spring', 'giantsHeart', 'secondWind'], enemyWeights: { 7: 2.8, 9: 1.8, 3: 1.4 }, earlyEnemies: [{ kind: 7, stage: 3, weight: 9 }],
    description: '독성 안개와 분열체가 이동할 공간을 서서히 좁힙니다.', hazard: '18초마다 1.6초 예고 후 4초간 독 지대. 사술사·분열체의 적중 공격은 짧은 독을 남깁니다. 적 체력 ×1.1 · 피해 ×1.05.', reward: '획득 골드 ×1.25 · 상자 유물 선택에 생존 유물 1칸 보장(미보유 후보가 있을 때).', counterplay: '독 표식 안에서 머무르지 마세요. 독은 중첩되지 않으며 분열된 작은 적은 다시 나뉘지 않습니다.' }),
  define({ id: 'ruins', name: '잊혀진 유적', english: 'ARCANE RUINS', icon: 'chest', color: '#edc58c', palette: ['#655d49', '#292639', '#e3d5b3', '#edc58c'], enemyHealth: 1.15, enemyDamage: 1.08, goldMultiplier: 1.2, chestBonus: 1, eliteMultiplier: 1.15,
    mutationBias: ['steel', 'swift'], relicAffinity: [], enemyWeights: { 3: 2.8, 8: 2.4, 9: 1.7 }, earlyEnemies: [{ kind: 3, stage: 2, weight: 16 }],
    description: '고대 마법 구조물과 원거리 수호자들이 잊힌 보물을 지킵니다.', hazard: '원거리 적 증가 · 정예 출현 빈도 ×1.15 · 적 체력 ×1.15 · 피해 ×1.08.', reward: '획득 골드 ×1.2 · 수호 상자 1개 추가 · 상자 유물 선택에 영웅/전설 유물 1칸 보장(미보유 후보가 있을 때).', counterplay: '조준선에서 옆으로 이동하고 수호병을 처치하세요. 추가 상자는 시간이 지나면 출현하며 적 수 제한을 지킵니다.' }),
  define({ id: 'void', name: '공허 지대', english: 'THE FRACTURED VOID', icon: 'orbit', color: '#c391ff', palette: ['#483453', '#1d142e', '#d4c5eb', '#c391ff'], enemyHealth: 1.25, enemyDamage: 1.12, goldMultiplier: 1.55, eliteMultiplier: 1.2,
    mutationBias: ['swift', 'berserker'], relicAffinity: ['arcanePrism', 'blast', 'satellites', 'executioner'], enemyWeights: { 7: 2, 3: 1.5, 8: 1.5 },
    description: '보라색 균열 사이로 변이 개체와 순간이동하는 적이 나타납니다.', hazard: '변이·복합 변이 증가 · 일부 적이 1.2초 예고 후 안전거리 밖으로 이동 · 적 체력 ×1.25 · 피해 ×1.12.', reward: '획득 골드 ×1.55 · 상자 유물 선택에 공격/궤도 유물 1칸 보장(미보유 후보가 있을 때).', counterplay: '보라색 도착 표식을 보며 이동하세요. 순간이동은 플레이어 5m 안이나 벽 안으로 들어오지 않습니다.' }),
]);
export const FINAL_REGION = define({ id: 'throne', name: '종말의 왕좌', english: 'THRONE OF THE END', icon: 'skull', color: '#ed9cdb', palette: ['#3b293c', '#1d1027', '#f0d0ef', '#ed9cdb'], description: '열 번째 층, 종말의 폭풍왕이 지키는 고유 최종 지역.', hazard: '고유 최종 보스와 모든 기존 군종 등장', reward: '최종 보스 보상 · 층 기본 보상 유지', counterplay: '회전 탄막과 폭풍 예고의 빈틈을 이용하세요.' });
export function getRegion(id = 'sanctum') { return REGIONS.find(region => region.id === id) || (id === 'throne' ? FINAL_REGION : SANCTUM_REGION); }
export function getRegionModifiers(id) {
  const region = getRegion(id);
  return Object.fromEntries(['enemyHealth', 'enemyDamage', 'goldMultiplier', 'spawnMultiplier', 'eliteMultiplier', 'chestBonus'].map(key => [key, region[key]]));
}
export function getRegionChoices(stage, currentId, random = Math.random) {
  if (Number(stage) >= 10) return [{ ...FINAL_REGION }];
  const pool = REGIONS.filter(region => region.id !== currentId), choices = [];
  while (choices.length < 3 && pool.length) choices.push({ ...pool.splice(Math.floor(roll(random) * pool.length), 1)[0] });
  return choices;
}
export function getRegionalEnemyPool(stage, regionId) {
  const region = getRegion(regionId), number = clamp(Math.floor(Number(stage) || 1), 1, 10);
  const pool = getEnemyPool(number).map(enemy => ({ ...enemy, weight: enemy.weight * (region.enemyWeights[enemy.kind] || 1) }));
  for (const entry of region.earlyEnemies) if (number >= entry.stage && !pool.some(enemy => enemy.kind === entry.kind)) pool.push({ ...getEnemyDefinition(entry.kind), weight: entry.weight });
  return pool;
}
export function chooseRegionalEnemyKind(stage, regionId, random = Math.random) {
  const pool = getRegionalEnemyPool(stage, regionId); let cursor = roll(random) * pool.reduce((sum, enemy) => sum + enemy.weight, 0);
  for (const enemy of pool) { cursor -= enemy.weight; if (cursor < 0) return enemy.kind; }
  return pool.at(-1).kind;
}
/** Selection changes the offer, never grants a relic or a stat without player input. */
export function getRegionRelicChoices(stats = {}, regionId = 'sanctum', random = Math.random) {
  const choices = getRelicChoices(stats, random), region = getRegion(regionId), owned = new Set(stats?.relics || []);
  const candidates = RELICS.filter(relic => !owned.has(relic.id) && (region.id === 'ruins' ? ['epic', 'legendary'].includes(relic.rarity) : region.relicAffinity.includes(relic.id)));
  if (!candidates.length || !choices.length || choices.some(choice => candidates.some(relic => relic.id === choice.id))) return choices;
  const guaranteed = candidates[Math.floor(roll(random) * candidates.length)];
  choices[0] = { ...guaranteed, category: 'relic' };
  return choices;
}
