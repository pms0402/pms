const rank = (stats, id) => Math.max(0, Number(stats?.spells?.[id]) || 0);
const bladeRank = stats => Math.max(0, Number(stats?.passiveLevels?.blade_range) || 0);

/** Build combinations never grant stats: they enable specific combat interactions. */
export const SYNERGIES = Object.freeze([
  Object.freeze({ id: 'shatter', title: '빙쇄 검무', description: '둔화된 적을 검으로 베면 주변 2.2m에 검 피해의 35%를 가하는 얼음 파편이 터집니다. 적마다 1초 간격.', requirement: '서리 파동 습득 + 검 범위 강화 2단계', icon: 'snow', color: '#89e8ff' }),
  Object.freeze({ id: 'flamewave', title: '화염 검기', description: '불붙은 적을 검으로 베면 주변 2.6m에 검 피해의 30%를 가하는 화염이 번집니다. 적마다 1초 간격.', requirement: '화염구 습득 + 검기 진화', icon: 'fire', color: '#ff9c54' }),
  Object.freeze({ id: 'runelight', title: '전류 성좌', description: '3초마다 궤도 룬에서 가까운 적에게 마법 피해의 35%를 가하는 번개를 방출합니다.', requirement: '연쇄 번개 + 궤도 룬 습득', icon: 'bolt', color: '#c39bff' }),
]);

export function getActiveSynergies(stats = {}) {
  const active = {
    shatter: rank(stats, 'frost') >= 1 && bladeRank(stats) >= 2,
    flamewave: rank(stats, 'fireball') >= 1 && stats?.swordEvolution === 'wave',
    runelight: rank(stats, 'lightning') >= 1 && rank(stats, 'orbit') >= 1,
  };
  return SYNERGIES.filter(synergy => active[synergy.id]);
}
