const rank = (stats, id) => Math.max(0, Number(stats?.spells?.[id]) || 0);
const bladeRank = stats => Math.max(0, Number(stats?.passiveLevels?.blade_range) || 0);
const evolved = (stats, id) => rank(stats, id) >= 5 && !!stats?.evolutions?.[id];
const owns = (stats, ids) => Array.isArray(stats?.relics) && ids.some(id => stats.relics.includes(id));

/** Build combinations never grant stats: they enable specific combat interactions. */
export const SYNERGIES = Object.freeze([
  Object.freeze({ id: 'shatter', title: '빙쇄 검무', description: '둔화된 적을 검으로 베면 주변 2.2m에 검 피해의 35%를 가하는 얼음 파편이 터집니다. 적마다 1초 간격.', requirement: '서리 파동 습득 + 검 범위 강화 2단계', icon: 'snow', color: '#89e8ff' }),
  Object.freeze({ id: 'flamewave', title: '화염 검기', description: '불붙은 적을 검으로 베면 주변 2.6m에 검 피해의 30%를 가하는 화염이 번집니다. 적마다 1초 간격.', requirement: '화염구 습득 + 검기 진화', icon: 'fire', color: '#ff9c54' }),
  Object.freeze({ id: 'runelight', title: '전류 성좌', description: '3초마다 공허 룬에서 가까운 적에게 마법 피해의 35%를 가하는 번개를 방출합니다.', requirement: '연쇄 번개 + 공허 룬 습득', icon: 'bolt', color: '#c39bff' }),
  Object.freeze({ id: 'firestorm', title: '화염 폭풍', description: '검 적중 시 25% 확률로 3.2m 불꽃 회오리 생성. 2.4초 동안 0.6초마다 최대 6명에게 검 피해의 35%. 발동 간격 4초, 대상별 피해 간격 0.6초.', requirement: '화염구 진화 + 질풍의 쌍검', icon: 'fire', color: '#ff784b', hidden: true }),
  Object.freeze({ id: 'absoluteZero', title: '절대영도', description: '1초 이상 연속 둔화된 적에게 서리 마법 피해의 65%와 0.45초 빙결. 보스는 추가 피해만 받습니다. 대상마다 6초 간격, 2초당 최대 6명.', requirement: '서리 파동 진화 + 빙하의 파편 또는 서리불꽃', icon: 'snow', color: '#b6f2ff', hidden: true }),
  Object.freeze({ id: 'thunderJudgment', title: '천둥의 심판', description: '검 적중 위치에 번개를 내려 3.4m 내 최대 5명에게 번개 마법 피해의 75%. 전체 발동 및 대상별 피해 간격 3초.', requirement: '연쇄 번개 진화 + 공허의 검기', icon: 'bolt', color: '#d5c2ff', hidden: true }),
  Object.freeze({ id: 'voidBurst', title: '공허의 폭발', description: '공허 룬 직접 적중 8회마다 3.6m 폭발. 최대 8명에게 룬 마법 피해의 120%. 전체 발동 및 대상별 피해 간격 3.5초. 적중 횟수는 대상마다 0.4초 간격으로 집계.', requirement: '공허 룬 진화 + 화약 심장 또는 비전 프리즘', icon: 'orbit', color: '#cf98ff', hidden: true }),
]);

export function getActiveSynergies(stats = {}) {
  const active = {
    shatter: rank(stats, 'frost') >= 1 && bladeRank(stats) >= 2,
    flamewave: rank(stats, 'fireball') >= 1 && stats?.swordEvolution === 'wave',
    runelight: rank(stats, 'lightning') >= 1 && rank(stats, 'orbit') >= 1,
    firestorm: evolved(stats, 'fireball') && stats?.swordEvolution === 'twinblade',
    absoluteZero: evolved(stats, 'frost') && owns(stats, ['glacier', 'frostfire']),
    thunderJudgment: evolved(stats, 'lightning') && stats?.swordEvolution === 'wave',
    voidBurst: evolved(stats, 'orbit') && owns(stats, ['blast', 'arcanePrism']),
  };
  return SYNERGIES.filter(synergy => active[synergy.id]);
}
