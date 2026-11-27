// Only attack clocks change. Walking, damage, poise, HP and player timers do not.
export const BOSS_ATTACK_RATE=1.2;
export const BOSS_RECOVERY_RATE=1.15;
export const MIN_BOSS_WARNING=.45;
export const attackSeconds=seconds=>seconds/BOSS_ATTACK_RATE;
export const recoverySeconds=seconds=>seconds/BOSS_RECOVERY_RATE;
export const attackTime=e=>e.t*BOSS_ATTACK_RATE;
export function bossFieldTiming(config){const f={...config};if(f.warning>0)f.warning=Math.max(MIN_BOSS_WARNING,attackSeconds(f.warning));if(f.duration)f.duration=attackSeconds(f.duration);if(f.speed)f.speed*=BOSS_ATTACK_RATE;if(f.flow)f.flow*=BOSS_ATTACK_RATE;return f;}
export function quickenBossShot(q,style){if(q.bossTempo)return q;q.bossTempo=BOSS_ATTACK_RATE;q.bossStyle=style;q.vx*=BOSS_ATTACK_RATE;q.vy*=BOSS_ATTACK_RATE;q.life=attackSeconds(q.life);if(q.gravity)q.gravity*=BOSS_ATTACK_RATE**2;if(q.turnRate)q.turnRate*=BOSS_ATTACK_RATE;if(q.returnSpeed)q.returnSpeed*=BOSS_ATTACK_RATE;if(q.holdTime!==undefined)q.holdTime=attackSeconds(q.holdTime);return q;}
