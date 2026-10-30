const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const radians = degrees => degrees * Math.PI / 180;

export const BASE_SWORD_RANGE = 2.8;
export const SWORD_EVOLUTION_REQUIREMENT = 3;

export const SWORD_EVOLUTIONS = Object.freeze([
  { id: 'blade_broadsword', mode: 'broadsword', title: '진화 · 거인의 대검', description: '180° 넓은 베기 · 검 피해 +35% · 모션 가속 능력치 -22%.', color: '#ffd18b', arc: radians(180), rangeMultiplier: 1, damageMultiplier: 1.35, attackRateMultiplier: 0.78 },
  { id: 'blade_twinblade', mode: 'twinblade', title: '진화 · 질풍의 쌍검', description: '모션 가속 능력치 +75% · 검 피해 -8% · 사거리 -10% · 100° 연속 베기.', color: '#9cefff', arc: radians(100), rangeMultiplier: 0.9, damageMultiplier: 0.92, attackRateMultiplier: 1.75 },
  { id: 'blade_wave', mode: 'wave', title: '진화 · 공허의 검기', description: '직접 조준하는 관통 검기 · 사거리 +80% · 검 피해 +5% · 모션 가속 능력치 -15%.', color: '#d9adff', arc: radians(45), rangeMultiplier: 1.8, damageMultiplier: 1.05, attackRateMultiplier: 0.85 },
].map(Object.freeze));

/** Stats, rendering and collision all consume this same measured sector. */
export function getSwordProfile(stats = {}) {
  const evolution = SWORD_EVOLUTIONS.find(choice => choice.mode === stats?.swordEvolution);
  return {
    mode: evolution?.mode || 'default',
    range: BASE_SWORD_RANGE * Math.max(0.1, finite(stats?.swordRangeMultiplier, 1)) * (evolution?.rangeMultiplier || 1),
    arc: evolution?.arc || radians(120),
    damageMultiplier: evolution?.damageMultiplier || 1,
    attackRateMultiplier: evolution?.attackRateMultiplier || 1,
    targets: 5 + clamp(Math.floor(finite(stats?.swordTargetsBonus, 0)), 0, 4),
    color: evolution?.color || '#c6ff89',
  };
}

/** Point/optional-circle intersection with the exact rendered forward sector. */
export function isSwordHit(profile, dx, dz, forwardX, forwardZ, targetRadius = 0) {
  if (![dx, dz, forwardX, forwardZ, profile?.range, profile?.arc].every(Number.isFinite)) return false;
  const range = Math.max(0, profile.range);
  const radius = Math.max(0, finite(targetRadius, 0));
  const distance = Math.hypot(dx, dz);
  const tolerance = 1e-9;
  if (distance > range + radius + tolerance) return false;
  if (distance <= radius + tolerance) return true;
  const length = Math.hypot(forwardX, forwardZ);
  const fx = length > tolerance ? forwardX / length : 0;
  const fz = length > tolerance ? forwardZ / length : 1;
  const halfArc = clamp(profile.arc, 0, Math.PI * 2) / 2;
  const angle = Math.acos(clamp((dx * fx + dz * fz) / distance, -1, 1));
  if (angle <= halfArc + tolerance) return true;
  if (!radius) return false;
  // Outside the wedge, a circle can touch either finite boundary ray.
  for (const sign of [-1, 1]) {
    const cos = Math.cos(sign * halfArc), sin = Math.sin(sign * halfArc);
    const bx = fx * cos - fz * sin, bz = fx * sin + fz * cos;
    const projection = clamp(dx * bx + dz * bz, 0, range);
    if (Math.hypot(dx - bx * projection, dz - bz * projection) <= radius + tolerance) return true;
  }
  return false;
}

export function getSwordEvolutionChoices(stats = {}) {
  if (stats?.swordEvolution) return [];
  const ranks = ['power', 'haste', 'blade_range'].reduce((sum, id) => sum + Math.max(0, Math.floor(finite(stats?.passiveLevels?.[id], 0))), 0);
  if (ranks < SWORD_EVOLUTION_REQUIREMENT) return [];
  return SWORD_EVOLUTIONS.map(({ id, mode, title, description, color }) => ({
    id, mode, title, description, color, category: 'blade-evolution', branch: 'sword',
    rarity: 'legendary', icon: 'sword', rank: 1, maxRank: 1, weight: 8,
  }));
}

export function applySwordEvolution(stats, id) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return false;
  const choice = getSwordEvolutionChoices(stats).find(candidate => candidate.id === id);
  if (!choice) return false;
  stats.swordEvolution = choice.mode;
  return true;
}
