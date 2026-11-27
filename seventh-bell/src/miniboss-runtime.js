import {MINIBOSSES} from './miniboss-data.js';
import {BOSS_ATTACK_RATE,attackSeconds} from './boss-tempo.js';
import {minibossSteel} from './boss-strikes.js';
import {advanceCreatureGait} from './creature-motion.js';
import {journeyAt} from './journey-data.js';
import {sanctuaryAt,canBeginEnemyAttack} from './sanctuary.js';
import {body,solids,moveBody,clearLine} from './world.js';
import {bladeTouches} from './blade.js';
import {spawnEnemyShot} from './projectile-combat.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function activeMiniboss(g){return(g.world.minibosses||[]).find(e=>e.active&&!e.dead&&journeyAt(e.x)?.id===journeyAt(g.p.x)?.id&&Math.abs(e.x-g.p.x)<700)||null;}
export function beginMiniboss(g,e,index){const d=MINIBOSSES[e.type];e.attackIndex=index;e.state='windup';e.t=0;e.vx=0;e.hits=new Set();e.counterQueued=false;e.endCol=null;e.dir=Math.sign(g.p.x-e.x)||e.dir;e.aim={x:g.p.x,y:g.p.y-24};e.prep=d.attacks[index].windup;e.shielding=d.attacks[index].kind==='guard';}
function hit(g,e,a,beat){if(e.hits.has(beat))return;const blade=minibossSteel(e,a);e.steel={...blade,life:.14,max:.14,at:g.clock,radius:8};if(bladeTouches(blade,body(g.p),8)&&clearLine(g,blade.ax,blade.ay,g.p.x,g.p.y-24)){e.hits.add(beat);g.hurt(a.damage,e);}}
export function updateMiniboss(g,e,dt){const d=MINIBOSSES[e.type];e.hit=Math.max(0,e.hit-dt);if(e.steel)e.steel.life-=dt;if(e.dead){e.deathT+=dt;return;}if(journeyAt(e.homeX)?.id!==journeyAt(g.p.x)?.id||Math.abs(e.x-g.p.x)>900)return;
 const p=g.p,dx=p.x-e.x,dy=p.y-e.y,oldX=e.x,oldVX=e.vx;e.t+=dt;e.cooldown-=dt;e.stagger=Math.max(0,e.stagger-dt);
 const resting=sanctuaryAt(g);if(resting||Math.abs(dx)>600||Math.abs(dy)>260){e.retire=(e.retire||0)+dt;e.state='idle';e.vx=0;e.shielding=false;if(e.retire>2.5){e.active=false;e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.cooldown=1.2;e.retire=0;}return;}e.retire=0;
 if(!e.active){if(Math.abs(dx)<350&&Math.abs(dy)<120&&clearLine(g,e.x,e.y-25,p.x,p.y-24)){e.active=true;e.cooldown=attackSeconds(1.25);e.t=0;g.event('miniIntro',{id:e.type,name:d.name});}else return;}
 if(e.stagger>0){e.vx=0;}
 else if(e.state==='windup'){e.vx=0;if(e.t>=e.prep){e.state=e.shielding&&!e.counterQueued?'recover':'attack';e.endCol=e.state==='recover'?2:null;e.t=0;e.shielding=false;e.released=false;}}
 else if(e.state==='attack'){const a=d.attacks[e.attackIndex];e.vx=a.kind==='rush'?e.dir*a.speed*BOSS_ATTACK_RATE:0;
  if(a.kind==='cast'){if(!e.released&&e.t>=attackSeconds(.08)){e.released=true;const angle=Math.atan2(e.aim.y-(e.y-Math.min(e.h*.65,35)),e.aim.x-e.x);for(let n=0;n<(a.shots||1);n++)spawnEnemyShot(g,e,d.shot,angle+(n-((a.shots||1)-1)/2)*.16,160,{damage:a.damage,range:310});g.sound('echo');}}
  else if(a.kind==='double'){if(e.t>=attackSeconds(.08)&&e.t<attackSeconds(.24))hit(g,e,a,0);if(e.t>=a.active*.57&&e.t<a.active*.85)hit(g,e,a,1);}
  else if(e.t>=(a.kind==='slam'?a.active*.52:attackSeconds(.08))&&e.t<Math.max(attackSeconds(.2),a.active*.82))hit(g,e,a,0);
  if(!e.released&&a.kind!=='cast'&&e.t>=(a.kind==='slam'?a.active*.52:attackSeconds(.08))){e.released=true;g.sound(a.kind==='slam'?'slamHit':'heavy');if(a.kind==='slam'){g.shake=Math.max(g.shake,2);g.fx(e.x+e.dir*35,e.y,'dust',.45);}}
  if(e.t>=a.active){e.state='recover';e.endCol=4;e.t=0;e.vx=0;e.cooldown=.8;}
 }else if(e.state==='recover'){e.vx=0;if(e.t>=d.attacks[Math.max(0,e.attackIndex)].recover){e.state='idle';e.t=0;e.cooldown=attackSeconds(.65);}}
 else{e.dir=Math.sign(dx)||e.dir;const desired=Math.abs(dx)>100?e.dir*d.speed:0;e.vx=oldVX+clamp(desired-oldVX,-d.speed*6*dt,d.speed*6*dt);if(e.cooldown<=0&&canBeginEnemyAttack(g,e)&&Math.abs(dx)<330&&Math.abs(dy)<110&&clearLine(g,e.x,e.y-25,p.x,p.y-24)){const choices=d.attacks.map((a,i)=>({a,i})).filter(({a})=>Math.abs(dx)>180?['rush','cast'].includes(a.kind):true);const choice=choices.length?choices[e.cycle++%choices.length].i:e.cycle++%3;beginMiniboss(g,e,choice);}}
 e.vy=Math.min(500,e.vy+1100*dt);moveBody(e,dt,solids(g));e.x=clamp(e.x,e.homeX-d.half,e.homeX+d.half);e.walk+=Math.abs(e.x-oldX);advanceCreatureGait(e,dt,e.x-oldX,d.stride);
}
export function damageMiniboss(g,e,n,dir,push,kind){if(e.dead)return;const d=MINIBOSSES[e.type];if(e.shielding&&(g.p.x-e.x)*e.dir>0){e.counterQueued=true;e.t=Math.min(e.t,e.prep-.8);n=Math.max(1,Math.round(n*(['heavy','plunge'].includes(kind)?.65:.35)));g.fx(e.x+e.dir*20,e.y-35,'parry',.3);}e.active=true;e.hp=Math.max(0,e.hp-n);e.hit=.13;e.hitDir=dir;e.poise+=(['heavy','plunge','counter'].includes(kind)?2:1);if(e.poise>=4&&!e.shielding){e.poise=0;e.stagger=.7;e.state='recover';e.t=0;e.vx=0;}
 g.hitPause(.055,kind);g.fx(e.x,e.y-e.h*.5,'hit',.3);g.effects.push({kind:'number',x:e.x,y:e.y-e.h-6,text:String(n),life:.65,max:.65});g.sound('hit');if(e.hp>0)return;
 e.dead=true;e.active=false;e.deathT=0;e.vx=0;e.shielding=false;g.projectiles=g.projectiles.filter(q=>q.owner!==e.id);g.combatFields=(g.combatFields||[]).filter(f=>f.owner!==e.id);
 if(g.profile.minibosses.includes(e.type))return;g.profile.minibosses.push(e.type);const coins=80+d.chapter*40;g.profile.marks=Math.min(Number.MAX_SAFE_INTEGER,g.profile.marks+coins);g.profile.points++;g.gainXp(45+d.chapter*20);g.profile.points=Math.min(100,g.profile.points);g.tell(d.name+' · '+coins+' 동전, 기술 점수 +1');g.event('miniClear',{id:e.type,text:d.lore});g.sound('bell');g.save();
}
