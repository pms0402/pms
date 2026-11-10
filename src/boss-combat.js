/** All strong attacks retain a readable windup and a bounded, punishable end. */
export const BOSS_COMBAT=Object.freeze({guard:.6,opening:1.25,parried:1.35,transition:.75,link:.28,recovery:1.05,chase:.55,minWarning:.78});
export const BOSS_PATTERNS=Object.freeze({artillery:['fan-warning','barrage-warning'],plague:['poison-warning','fan-warning'],brood:['pulse-warning','summon-warning'],storm:['nova-warning','radial-warning'],reaper:['cross-warning','blink-warning']});
export const BOSS_PATTERN_NAMES=Object.freeze({'fan-warning':'산개 탄막','barrage-warning':'집중 포격','poison-warning':'독성 봉쇄','pulse-warning':'지면 충격파','summon-warning':'군단 소환','nova-warning':'번개 파열','radial-warning':'회전 탄막','cross-warning':'십자 검기','blink-warning':'균열 도약'});
export function bossChain(archetype,first,phase=1,variant=1){const options=BOSS_PATTERNS[archetype];if(!options)return[first];const count=phase>=3?3:phase>=2||variant>1?2:1;return Array.from({length:count},(_,i)=>i%2?options.find(p=>p!==first):first);}
export function bossWarning(base,phase){return Math.max(BOSS_COMBAT.minWarning,base-(phase===3?.12:phase===2?.06:0));}
export function bossDamageState(boss){return boss.transitionTime>0?'transition':boss.parryStun>0?'parried':boss.recoveryTime>0&&!(boss.chainRemaining>0)?'opening':'guard';}
export function bossDamageMultiplier(boss,counter=false){const state=bossDamageState(boss);return state==='transition'?0:state==='parried'?BOSS_COMBAT.parried:state==='opening'?BOSS_COMBAT.opening:counter?1:BOSS_COMBAT.guard;}
/** One packet cannot skip two phases. No healing or stat scaling to the player's build. */
export function limitBossDamage(boss,damage,counter=false){
  const amount=Math.max(0,Number(damage)||0)*bossDamageMultiplier(boss,counter),phase=boss.combatPhase||1,floor=boss.maxHp*(phase===1?.7:phase===2?.35:0);
  if(phase<3&&boss.hp>=floor){const epsilon=Math.max(1e-7,boss.maxHp*1e-8);return Math.min(amount,Math.max(0,boss.hp-floor+epsilon));}return amount;
}
export function chargeTravel(distance){return Math.max(9,Math.min(27,(Number(distance)||0)+3));}
export function annulusWarning(distance,speed,inner){return Math.max(1.5,Math.min(5,Math.max(0,distance-(inner-1))/Math.max(3,Number(speed)||7.5)+.7));}
