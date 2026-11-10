/** Numeric growth stays small; weapon evolutions and conditional effects carry builds. */
export const PERMANENT_GROWTH=Object.freeze({power:.006,arcana:.006,vitality:.005,haste:.0035,focus:.0035,bladeReach:.005,spellArea:.005,armor:.0015});
export const RUN_GROWTH=Object.freeze({power:.03,spell_power:.03,vitality:.02,haste:.02,spell_haste:.02,blade_range:.03,spell_area:.03,speed:.01});
export const SKILL_RANK_GROWTH=.04;
export function linearGrowth(level,step){return 1+Math.max(0,Number.isFinite(Number(level))?Math.floor(Number(level)):0)*step;}
/** Multiplicative composition with relics, independent of purchase order; ranks themselves add. */
export function addGrowthRank(value,rank,step,fallback=1){const current=Number.isFinite(Number(value))?Number(value):fallback;return current*linearGrowth(rank+1,step)/linearGrowth(rank,step);}
export function skillRankPower(rank){return 1+Math.max(0,Math.min(4,(Number(rank)||1)-1))*SKILL_RANK_GROWTH;}
