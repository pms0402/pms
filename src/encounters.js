const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

/** Each floor keeps a distinct atmosphere and introduces a readable encounter mix. */
export const STAGES = Object.freeze([
  { id: 'grove', name: '잊혀진 성역', english: 'THE FORSAKEN SANCTUM', palette: ['#454640', '#202b32', '#b7c7d8', '#c2a875'], description: '느린 추격자와 빠른 사냥꾼. 돌진 예고를 익히세요.' },
  { id: 'ruins', name: '황혼의 폐허', english: 'TWILIGHT RUINS', palette: ['#383128', '#1b1813', '#eed6ae', '#d7ae71'], description: '뿔 돌격수가 합류합니다. 포격자의 사선에서 벗어나세요.' },
  { id: 'poisonwood', name: '독안개의 숲', english: 'POISONWOOD', palette: ['#302a37', '#17131e', '#c9b8e7', '#ad91df'], description: '원거리 사술사와 독 웅덩이가 이동 경로를 압박합니다.' },
  { id: 'citadel', name: '심연의 성채', english: 'ABYSSAL CITADEL', palette: ['#382b2b', '#1c1314', '#e7b8ae', '#d7957f'], description: '자폭충과 소환된 군단을 흩어 놓고 돌파하세요.' },
  { id: 'void', name: '공허의 심장', english: 'HEART OF THE VOID', palette: ['#252f3a', '#101722', '#b4cde8', '#82c6dd'], description: '회전 탄막의 빈틈으로 이동하고 폭풍의 중심을 피하세요.' },
  { id: 'frosthall', name: '얼어붙은 회랑', english: 'THE FROZEN HALL', palette: ['#263d43', '#101e29', '#c9edff', '#8cddf3'], description: '분열체와 순간이동하는 망령이 안전한 거리를 흔듭니다.' },
  { id: 'caldera', name: '잿불의 화산', english: 'EMBER CALDERA', palette: ['#44312b', '#241411', '#ffd5b1', '#f2a36a'], description: '저격수를 먼저 찾아내고 강화된 포격을 회피하세요.' },
  { id: 'temple', name: '망각의 사원', english: 'TEMPLE OF OBLIVION', palette: ['#373441', '#191523', '#dbcbf0', '#c4a8f0'], description: '치유 주술사가 동료를 회복합니다. 우선 처치가 필요합니다.' },
  { id: 'rift', name: '별의 균열', english: 'ASTRAL RIFT', palette: ['#263742', '#101b2d', '#c7deff', '#8db7ff'], description: '저격과 군단 소환이 겹칩니다. 공격 사이의 틈을 이용하세요.' },
  { id: 'throne', name: '종말의 왕좌', english: 'THRONE OF THE END', palette: ['#3b293c', '#1d1027', '#f0d0ef', '#ed9cdb'], description: '모든 군종과 종말의 폭풍왕을 돌파하는 마지막 층입니다.' },
].map((stage, index) => Object.freeze({ ...stage, stage: index + 1, palette: Object.freeze(stage.palette) })));

const stageNumber = stage => clamp(Math.floor(finite(stage, 1)), 1, STAGES.length);

export function getStageDefinition(stage = 1) {
  const definition = STAGES[stageNumber(stage) - 1];
  return { ...definition, palette: [...definition.palette] };
}

/** Boss silhouettes and their attacks are shared by the renderer and behaviour modules. */
export const BOSS_TYPES = Object.freeze(Object.fromEntries([
  { id: 'warden', name: '돌진 수호자', color: '#5d343b', secondary: '#ef785c', scale: 3.1, aspect: [1, 1, 1], speedMultiplier: 1, hint: '푸른 직선은 패링하거나 옆으로 피하고, 붉은 원형 충격파는 대시로 벗어나세요.', actions: ['charge', 'pulse'], actionLabels: { 'charge-warning': '돌진 예고', charge: '돌진', 'pulse-warning': '충격파 예고', pulse: '충격파' } },
  { id: 'artillery', name: '포격 사냥꾼', color: '#735139', secondary: '#ffbe72', scale: 3, aspect: [1.3, 0.9, 1.2], speedMultiplier: 0.9, hint: '거리를 벌리는 포격자를 쫓으며 부채꼴 탄환과 연속 사선을 피하세요.', actions: ['fan', 'barrage'], actionLabels: { 'fan-warning': '포격 조준', fan: '부채꼴 포격', 'barrage-warning': '연속 사격 예고', barrage: '연속 사격' } },
  { id: 'plague', name: '역병 지배자', color: '#485c36', secondary: '#b9eb6c', scale: 3.2, aspect: [1.05, 1.15, 1.25], speedMultiplier: 0.85, hint: '발밑의 독 예고에서 벗어나세요. 독 웅덩이는 잠시 남습니다.', actions: ['poison', 'fan'], actionLabels: { 'poison-warning': '독 웅덩이 예고', poison: '역병 확산', 'fan-warning': '독침 조준', fan: '독침 발사' } },
  { id: 'brood', name: '군단 소환자', color: '#66456d', secondary: '#dca1f7', scale: 3.4, aspect: [1.35, 0.85, 1.35], speedMultiplier: 0.8, hint: '소환된 적을 정리하며 본체를 공격하세요. 근접 충격파를 주의하세요.', actions: ['summon', 'pulse'], actionLabels: { 'summon-warning': '군단 소환 예고', summon: '군단 소환', 'pulse-warning': '충격파 예고', pulse: '군단의 파동' } },
  { id: 'storm', name: '폭풍 군주', color: '#3d5278', secondary: '#a0deff', scale: 3, aspect: [1.1, 1.45, 1.1], speedMultiplier: 1, hint: '회전 탄막 사이로 이동하고, 커지는 원형 폭풍에서 벗어나세요.', actions: ['radial', 'nova'], actionLabels: { 'radial-warning': '회전 탄막 예고', radial: '회전 탄막', 'nova-warning': '폭풍 폭발 예고', nova: '폭풍 폭발' } },
  { id: 'reaper', name: '순간이동 망령', color: '#436575', secondary: '#b7f2f5', scale: 2.8, aspect: [0.85, 1.5, 0.85], speedMultiplier: 1.05, hint: '순간이동 표식을 따라가며 나타난 위치의 교차 공격을 피하세요.', actions: ['blink', 'cross'], actionLabels: { 'blink-warning': '순간이동 예고', blink: '그림자 이동', 'cross-warning': '교차 파동 예고', cross: '교차 파동' } },
].map(type => [type.id, Object.freeze({ ...type, aspect: Object.freeze(type.aspect), actions: Object.freeze(type.actions), actionLabels: Object.freeze(type.actionLabels) })])));

const BOSSES = Object.freeze([
  ['초원의 파수꾼', 'warden'], ['황혼의 파괴자', 'artillery'],
  ['역병의 군주', 'plague'], ['심연의 집행자', 'brood'],
  ['공허의 왕', 'storm'], ['얼음거울의 망령', 'reaper'],
  ['잿불 포격자', 'artillery'], ['망각의 독사', 'plague'],
  ['균열의 어미', 'brood'], ['종말의 폭풍왕', 'storm'],
].map(([name, archetype], index) => Object.freeze({ id: `boss_${String(index + 1).padStart(2, '0')}`, stage: index + 1, name, archetype, variant: index >= 6 ? 2 : 1 })));

export function getBossDefinition(stage = 1) {
  const definition = BOSSES[stageNumber(stage) - 1];
  const type = BOSS_TYPES[definition.archetype];
  return { ...type, ...definition, aspect: [...type.aspect], actions: [...type.actions], actionLabels: { ...type.actionLabels } };
}

const ENEMY_DETAILS = {
  0: { color: '#55724c', counterplay: '무리의 바깥을 돌며 한 번에 여러 적을 베세요.' },
  1: { color: '#8d5840', counterplay: '접근이 빠릅니다. 멈추지 말고 대시로 간격을 만드세요.' },
  2: { color: '#54416e', counterplay: '정면 접촉을 피하고 마법과 넉백으로 거리를 유지하세요.' },
  3: { color: '#5c658e', counterplay: '시전 예고를 보고 옆으로 이동하면 탄환을 피할 수 있습니다.' },
  5: { color: '#c47a38', counterplay: '직선 돌진 예고가 보이면 사선 밖으로 이동하세요.' },
  6: { color: '#8aac45', counterplay: '점멸이 시작되면 폭발 범위에서 빠르게 벗어나세요.' },
  7: { color: '#3c9e9c', counterplay: '작은 개체는 다시 나뉘지 않습니다. 범위 공격으로 정리하세요.' },
  8: { color: '#a4b9c7', counterplay: '긴 조준선을 옆으로 피한 뒤 시전 중인 본체를 노리세요.' },
  9: { color: '#9970bb', counterplay: '회복 대상보다 주술사를 먼저 처치하세요.' },
};

/** Kind 4 is reserved for bosses, keeping saved test fixtures and combat tags compatible. */
export const ENEMY_TYPES = Object.freeze([
  { kind: 0, id: 'shambler', name: '황야 추격자', description: '무리를 지어 다가오는 기본 근접 몬스터.', unlockStage: 1, healthMultiplier: 1, damageMultiplier: 1, speed: 2.95, size: 0.96, goldMultiplier: 1, xp: 1 },
  { kind: 1, id: 'runner', name: '갈퀴 사냥꾼', description: '체력은 낮지만 빠르게 파고드는 사냥꾼.', unlockStage: 1, healthMultiplier: 0.8, damageMultiplier: 1, speed: 4.1, size: 0.88, goldMultiplier: 1, xp: 1 },
  { kind: 2, id: 'brute', name: '뿔 거인', description: '느리지만 높은 체력과 근접 피해를 가진 중장 몬스터.', unlockStage: 1, healthMultiplier: 2.2, damageMultiplier: 1.4, speed: 2.25, size: 1.18, goldMultiplier: 3, xp: 3 },
  { kind: 3, id: 'ranged', name: '핏빛 사술사', description: '거리를 유지하며 예고 후 비유도 탄환을 쏩니다.', unlockStage: 3, healthMultiplier: 1.15, damageMultiplier: 1, speed: 3, size: 1.02, goldMultiplier: 2, xp: 2 },
  { kind: 5, id: 'charger', name: '뿔 돌격수', description: '짧은 직선 예고를 남긴 뒤 한 방향으로 돌진합니다.', unlockStage: 2, healthMultiplier: 1.4, damageMultiplier: 1.3, speed: 3.2, size: 1.05, goldMultiplier: 2, xp: 2 },
  { kind: 6, id: 'bomber', name: '불씨 자폭충', description: '가까워지면 붉게 점멸하고 폭발합니다. 폭발 전에 벗어나세요.', unlockStage: 4, healthMultiplier: 0.85, damageMultiplier: 1.6, speed: 3.5, size: 0.9, goldMultiplier: 2, xp: 2 },
  { kind: 7, id: 'splitter', name: '공허 분열체', description: '처치하면 작은 분열체가 둘 나옵니다. 작은 개체는 다시 나뉘지 않습니다.', unlockStage: 6, healthMultiplier: 1.5, damageMultiplier: 1, speed: 2.7, size: 1.12, goldMultiplier: 3, xp: 3 },
  { kind: 8, id: 'sniper', name: '별빛 저격수', description: '긴 조준 예고 후 빠른 직선 탄환을 발사합니다.', unlockStage: 7, healthMultiplier: 0.95, damageMultiplier: 1.4, speed: 2.4, size: 0.98, goldMultiplier: 3, xp: 3 },
  { kind: 9, id: 'shaman', name: '회복 주술사', description: '주변 동료를 주기적으로 회복합니다. 본체를 먼저 처치하세요.', unlockStage: 8, healthMultiplier: 1.8, damageMultiplier: 0.9, speed: 2.5, size: 1.08, goldMultiplier: 4, xp: 4 },
].map(enemy => Object.freeze({ ...enemy, ...ENEMY_DETAILS[enemy.kind] })));

export function getEnemyDefinition(kind = 0) {
  return { ...(ENEMY_TYPES.find(enemy => enemy.kind === Number(kind)) || ENEMY_TYPES[0]) };
}

const WEIGHTS = Object.freeze([
  [55, 30, 15, 0, 0, 0, 0, 0, 0],
  [45, 28, 17, 0, 10, 0, 0, 0, 0],
  [36, 22, 17, 17, 8, 0, 0, 0, 0],
  [32, 18, 14, 17, 11, 8, 0, 0, 0],
  [28, 17, 15, 18, 12, 10, 0, 0, 0],
  [26, 15, 13, 16, 12, 10, 8, 0, 0],
  [22, 13, 12, 14, 13, 10, 9, 7, 0],
  [20, 11, 12, 13, 12, 10, 9, 7, 6],
  [16, 10, 12, 12, 12, 11, 10, 9, 8],
  [14, 9, 12, 12, 13, 12, 10, 10, 8],
].map(Object.freeze));

export function getEnemyPool(stage = 1) {
  const number = stageNumber(stage), weights = WEIGHTS[number - 1];
  return ENEMY_TYPES.flatMap((enemy, index) => enemy.unlockStage <= number && weights[index] > 0 ? [{ ...enemy, weight: weights[index] }] : []);
}

/** A bad random source cannot select a boss, an unknown kind or a locked monster. */
export function chooseEnemyKind(stage = 1, random = Math.random) {
  const pool = getEnemyPool(stage);
  const total = pool.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = clamp(finite(typeof random === 'function' ? random() : random, 0), 0, 0.999999999) * total;
  for (const entry of pool) {
    cursor -= entry.weight;
    if (cursor < 0) return entry.kind;
  }
  return pool.at(-1).kind;
}
