import { getStageStats, getBossStats } from "./balance.js";
import { getBossDefinition } from "./encounters.js";
export const ABYSS_RULES = Object.freeze([
  {
    id: "haste",
    title: "추격의 심연",
    description: "몬스터 이동 속도 +15%. 대시와 둔화로 거리를 벌리세요.",
    speed: 1.15,
  },
  {
    id: "bolts",
    title: "탄막의 심연",
    description: "적 탄환 속도 +18%. 조준 후 옆으로 이동하거나 패링하세요.",
    projectiles: 1.18,
  },
  {
    id: "scar",
    title: "상처의 심연",
    description: "모든 회복량 25% 감소. 회복 유물·방어·장비로 보완하세요.",
    healing: 0.75,
  },
  {
    id: "elites",
    title: "군세의 심연",
    description:
      "정예 출현 빈도 ×1.4. 추가 정예 골드와 장비 기회도 증가합니다.",
    elites: 1.4,
  },
  {
    id: "hazards",
    title: "균열의 심연",
    description: "지역 위험 발생 간격 25% 감소. 지면 예고를 확인하세요.",
    hazards: 1.33,
  },
  {
    id: "element",
    title: "비전의 심연",
    description:
      "적 원거리 공격 피해 +15%. 탄환은 방어·대시로 회피할 수 있습니다.",
    ranged: 1.15,
  },
]);
export function abyssRule(floor) {
  if (floor < 20) return null;
  return ABYSS_RULES[(Math.floor(floor / 10) - 2) % ABYSS_RULES.length];
}
const number = (n, cap = 1e15) =>
  Math.min(cap, Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0));
export function abyssStats(floor = 11) {
  const depth = Math.max(
      1,
      Math.min(1e6, Math.floor(Number(floor) || 11) - 10),
    ),
    base = getStageStats(10);
  return {
    ...base,
    enemyHealth: Math.min(
      1e12,
      base.enemyHealth * Math.exp(Math.min(25, depth * Math.log(1.16))),
    ),
    enemyDamage: Math.min(
      1e8,
      base.enemyDamage * Math.exp(Math.min(20, depth * Math.log(1.09))),
    ),
    coinValue: Math.min(
      1e12,
      base.coinValue * Math.exp(Math.min(12, depth * Math.log(1.22))),
    ),
    spawnInterval: 0.1,
    maxEnemies: 160,
  };
}
export function abyssBoss(floor = 11) {
  const stats = abyssStats(floor),
    special = floor % 5 === 0,
    definition = getBossDefinition(
      5 + (Math.max(0, Math.floor(floor) - 11) % 6),
    );
  return {
    ...getBossStats(10),
    ...definition,
    name: `심연 ${floor}층 ${special ? "재앙 · " : ""}${definition.name}`,
    variant: special ? 3 : 2,
    health: Math.min(5e13, stats.enemyHealth * (special ? 48 : 35)),
    damage: stats.enemyDamage * (special ? 1.5 : 1.3),
    coinValue: stats.coinValue * (special ? 40 : 25),
    xpValue: special ? 40 : 25,
  };
}
export function normalizeEndgame(value = {}, history = []) {
  const source = value && typeof value === "object" ? value : {};
  return {
    version: 1,
    unlocked:
      !!source.unlocked ||
      history.some((r) => r.won && r.stage >= 10 && r.mode !== "abyss"),
    bestFloor: number(source.bestFloor),
    bestKills: number(source.bestKills),
    bestGold: number(source.bestGold),
    bestTime: number(source.bestTime),
    bestRun:
      source.bestRun &&
      typeof source.bestRun === "object" &&
      source.bestRun.build &&
      Array.isArray(source.bestRun.build.relics) &&
      Array.isArray(source.bestRun.build.equipment) &&
      source.bestRun.build.spells &&
      source.bestRun.build.equipment.every(
        (i) =>
          i &&
          typeof i.title === "string" &&
          Array.isArray(i.options) &&
          Number.isFinite(i.power),
      )
        ? source.bestRun
        : null,
    receipts: Array.isArray(source.receipts)
      ? [
          ...new Set(source.receipts.filter((x) => typeof x === "string")),
        ].slice(-200)
      : [],
  };
}
export function recordEndgame(progress, state, won = false) {
  const next = normalizeEndgame(progress);
  if (won && state.mode !== "abyss") next.unlocked = true;
  if (
    state.mode !== "abyss" ||
    !state.runId ||
    next.receipts.includes(state.runId)
  )
    return next;
  next.receipts = [...next.receipts, state.runId].slice(-200);
  if (state.stage > next.bestFloor)
    next.bestRun = {
      floor: number(state.stage),
      kills: number(state.kills),
      gold: number(state.grossGold ?? state.gold),
      time: number(state.elapsed),
      character: state.playerStats?.characterId || "wanderer",
      weapon: state.playerStats?.weaponId || "voidblade",
      build: {
        spells: { ...state.playerStats?.spells },
        evolutions: { ...state.playerStats?.evolutions },
        sword: state.playerStats?.swordEvolution || "",
        relics: [...(state.playerStats?.relics || [])],
        equipment:
          state.equipment?.bag
            ?.filter((i) =>
              Object.values(state.equipment.slots || {}).includes(i.id),
            )
            .slice(0, 4) || [],
      },
    };
  next.bestFloor = Math.max(next.bestFloor, number(state.stage));
  next.bestKills = Math.max(next.bestKills, number(state.kills));
  next.bestGold = Math.max(
    next.bestGold,
    number(state.grossGold ?? state.gold),
  );
  next.bestTime = Math.max(next.bestTime, number(state.elapsed));
  return next;
}
