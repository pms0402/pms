/** Run curses last until the run ends; a chosen route lasts for one floor. */
const neutral = Object.freeze({
  enemyHealth: 1,
  enemyDamage: 1,
  goldMultiplier: 1,
  spawnMultiplier: 1,
  eliteMultiplier: 1,
  chestBonus: 0,
});

const definitions = entries => Object.freeze(entries.map(entry => Object.freeze({ ...neutral, ...entry })));

export const CURSES = definitions([
  {
    id: 'bloodDebt', title: '피의 빚', icon: 'heart',
    description: '이번 런 동안 적 최대 체력 ×1.5 · 적 피해 ×1.2 · 획득 골드 ×1.8. 다른 저주와 곱해 적용됩니다.',
    enemyHealth: 1.5, enemyDamage: 1.2, goldMultiplier: 1.8,
  },
  {
    id: 'frenzy', title: '광기의 부름', icon: 'bolt',
    description: '이번 런 동안 적 최대 체력 ×1.2 · 적 피해 ×1.35 · 출현 빈도 ×1.2 · 획득 골드 ×1.65. 다른 저주와 곱해 적용됩니다.',
    enemyHealth: 1.2, enemyDamage: 1.35, goldMultiplier: 1.65, spawnMultiplier: 1.2,
  },
  {
    id: 'titans', title: '거인의 분노', icon: 'skull',
    description: '이번 런 동안 적 최대 체력 ×1.8 · 적 피해 ×1.3 · 획득 골드 ×2.1. 다른 저주와 곱해 적용됩니다.',
    enemyHealth: 1.8, enemyDamage: 1.3, goldMultiplier: 2.1,
  },
]);

export const ROUTES = definitions([
  {
    id: 'standard', title: '일반 구역', icon: 'move',
    description: '다음 층을 기본 난이도와 기본 보상으로 탐험합니다. 이미 받은 저주는 유지됩니다.',
  },
  {
    id: 'elite', title: '정예 구역', icon: 'sword',
    description: '다음 층에서 적 최대 체력 ×1.35 · 적 피해 ×1.2 · 출현 빈도 ×1.15 · 정예 출현 빈도 ×2 · 획득 골드 ×1.65.',
    enemyHealth: 1.35, enemyDamage: 1.2, goldMultiplier: 1.65, spawnMultiplier: 1.15, eliteMultiplier: 2,
  },
  {
    id: 'treasure', title: '보물 구역', icon: 'chest',
    description: '다음 층에서 적 최대 체력 ×1.2 · 적 피해 ×1.1 · 획득 골드 ×1.3 · 수호자가 지키는 보물상자 1개 추가.',
    enemyHealth: 1.2, enemyDamage: 1.1, goldMultiplier: 1.3, chestBonus: 1,
  },
]);

const cursesById = new Map(CURSES.map(curse => [curse.id, curse]));
const routesById = new Map(ROUTES.map(route => [route.id, route]));
const uniqueCurseIds = ids => Array.isArray(ids)
  ? [...new Set(ids.filter(id => typeof id === 'string' && cursesById.has(id)))]
  : [];

/** Only the three distinct authored curses can contribute, keeping products finite. */
export function getRunModifiers(curseIds = [], routeId = 'standard') {
  const route = routesById.get(routeId) || ROUTES[0];
  const result = Object.fromEntries(Object.keys(neutral).map(key => [key, route[key]]));
  for (const id of uniqueCurseIds(curseIds)) {
    const curse = cursesById.get(id);
    for (const key of Object.keys(neutral)) {
      if (key === 'chestBonus') result[key] += curse[key];
      else result[key] *= curse[key];
    }
  }
  return result;
}

/** An exhausted altar may be skipped without presenting an empty mandatory choice. */
export function getCurseChoices(owned = []) {
  const selected = new Set(uniqueCurseIds(owned));
  return CURSES.filter(curse => !selected.has(curse.id)).map(curse => ({ ...curse }));
}
