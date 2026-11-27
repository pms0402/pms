import {clearLine,moveBody,solids} from './world.js';
import {journeyAt} from './journey-data.js';
import {ordinaryProjectile,projectileWallTime} from './projectile-combat.js';
import {workLevel,trainingRank} from './upgrades.js';

export const ABILITIES={
 bellPulse:{name:'종격',key:'F',talent:'bellPulse',cost:24,cooldown:8,duration:.65,windup:.22},
 blackChain:{name:'검은 사슬',key:'G',talent:'blackChain',cost:20,cooldown:10,duration:.72,windup:.27}
};
const learned=(g,id)=>g.profile.talents.includes(id);
export const abilityCooldown=(g,id)=>Math.max(0,(g.profile.abilityReady?.[id]||0)-g.profile.playtime);
export function abilityStats(g,id){const d=ABILITIES[id];if(!d)return null;const power=(g.profile.level-1)*2+workLevel(g.profile,'focus')*2+Math.floor(trainingRank(g.profile)/2);return{...d,cooldown:id==='bellPulse'&&learned(g,'pulseEcho')?5.5:d.cooldown,damage:id==='bellPulse'?28+power+(learned(g,'pulsePower')?18:0):10+Math.floor(power/2),range:id==='bellPulse'?(learned(g,'pulseEcho')?180:140):(learned(g,'chainRange')?260:180),bind:learned(g,'chainSeal')?3.2:2,curse:learned(g,'chainSeal')?6:4};}
export function abilityReason(g,id){const d=ABILITIES[id];if(!d||!learned(g,d.talent))return '기술 나무에서 먼저 익혀야 한다.';if(abilityCooldown(g,id)>0)return '아직 울림이 돌아오지 않았다.';if(g.p.silenced>0)return '지금은 울림을 낼 수 없다.';if(g.p.stamina<d.cost)return '집중이 부족하다.';if(g.paused||g.p.dead||g.p.action||g.p.hurt>0)return '지금은 사용할 수 없다.';return null;}
export function castAbility(g,id){if(!g.profile.started||abilityReason(g,id))return false;const d=abilityStats(g,id),p=g.p;p.stamina-=d.cost;p.vx=0;p.brake=0;p.comboQueued=false;g.bladeEchoes=[];
 p.action={kind:id,t:0,air:!p.grounded,released:false,serial:++g.attackSerial,spec:{...d,end:d.windup+.02,row:7,start:0}};g.profile.abilityReady??={};g.profile.abilityReady[id]=g.profile.playtime+d.cooldown;g.sound(id==='bellPulse'?'bellCharge':'chainCharge');g.save();return true;}
function targets(g){return[...g.world.enemies,...(g.world.minibosses||[]),...g.world.bosses].filter(e=>!e.dead&&!e.training&&(!e.boss||g.bossActive&&e===g.world.boss)&&journeyAt(e.x)?.id===journeyAt(g.p.x)?.id);}
export function resolveAbility(g,a){if(!ABILITIES[a.kind])return false;if(a.released)return true;a.released=true;const s=a.spec,p=g.p,x=p.x,y=p.y-26;
 if(a.kind==='bellPulse'){g.abilityWaves.push({x,y,age:0,life:.5,range:s.range,damage:s.damage,hit:new Set(),journey:journeyAt(p.x)?.id,clips:Array.from({length:65},(_,n)=>{const angle=n/64*Math.PI*2;return projectileWallTime(g,{radius:0},x,y,x+Math.cos(angle)*s.range,y+Math.sin(angle)*s.range/1.7);})});g.sound('bellPulse');}
 else{const marks=[];for(const e of targets(g)){const dy=e.y-e.h/2-y,dx=(e.x-x)*p.dir;if(dx<0||dx>s.range||Math.abs(dy)>85||!clearLine(g,x,y,e.x,e.y-e.h/2))continue;g.damageEnemy(e,s.damage,p.dir,0,'blackChain');if(e.dead)continue;if(e.boss||e.miniboss)e.frayedUntil=g.clock+s.curse;else e.boundUntil=g.clock+s.bind;marks.push({x:e.x,y:e.y-e.h/2});}if(!marks.length){const end=x+p.dir*s.range,f=projectileWallTime(g,{radius:2},x,y,end,y);marks.push({x:x+(end-x)*f,y});}g.effects.push({kind:'chainCast',x,y,marks,life:.3,max:.3});g.sound('blackChain');}
 return true;
}
export function updateAbilities(g,dt){const room=journeyAt(g.p.x)?.id;for(const w of g.abilityWaves){w.age+=dt;if(w.journey!==room){w.age=w.life;continue;}if(w.age>.28)continue;const radius=w.range*Math.min(1,w.age/.28),inside=(x,y)=>Math.hypot(x-w.x,(y-w.y)*1.7)<=radius;
  for(const e of targets(g)){if(w.hit.has(e.id)||!inside(e.x,e.y-e.h/2)||!clearLine(g,w.x,w.y,e.x,e.y-e.h/2))continue;w.hit.add(e.id);g.damageEnemy(e,Math.round(w.damage*(learned(g,'resonantSeal')&&(e.boundUntil>g.clock||e.frayedUntil>g.clock)?1.25:1)),Math.sign(e.x-w.x)||g.p.dir,210,'bellPulse');}
  for(const q of g.projectiles){if(q.destroyed||q.life<=0||!ordinaryProjectile(g,q)||!inside(q.x,q.y)||!clearLine(g,w.x,w.y,q.x,q.y))continue;q.destroyed=true;q.life=0;g.projectileCuts=(g.projectileCuts||0)+1;g.fx(q.x,q.y,'projectileBreak',.3);g.sound('shatter');}
 }g.abilityWaves=g.abilityWaves.filter(w=>w.age<w.life);
}
export function holdBoundEnemy(g,e,dt){if(e.dead||!(e.boundUntil>g.clock))return false;e.vx=0;if(e.flying||e.surface==='wall')e.vy=0;else{e.vy=Math.min(500,e.vy+1100*dt);moveBody(e,dt,solids(g));}return true;}
