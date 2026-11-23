import {BOSS_ACTIONS} from '../src/boss-actions.js';
import {fieldTouches} from '../src/combat-fields.js';
import {BOSS_DEFS} from '../src/bosses.js';
const hitTimes={gateShield:[0],gateBlade:[.05],gateRift:[.18],gateRush:[.02,.2,.4,.6,.8],gateCounter:[.06],knightThree:[.3,1.03,1.76],anvilStrike:[.18],royalFirst:[.06,.68],dawnThrust:[.05],royalProcession:[.35,1.15,1.95],royalFour:[.33,1.09,1.85,2.61],ropeOrbit:[.1,.3,.5],leftAttack:[.08]};
export function encounterInputs(g,stats){const e=g.world.boss,p=g.p,dx=e.x-p.x,dist=Math.abs(dx),a=BOSS_ACTIONS[e.pattern],d=BOSS_DEFS[e.id];let evade=0,move=dist>34,jump=false;
 if(e.state==='weakened'){if(dist<80)g.press('interact');return{left:dx<0&&dist>=75,right:dx>0&&dist>=75,jump:true};}
 if(p.dead)return{};
 const active=p.action&&p.action.spec&&p.action.t>=p.action.spec.windup&&p.action.t<p.action.spec.end;
 const can=!p.action||g.canRecover();let retreatForHeal=false,stopForHeal=false,avoidHeat=false,fieldDanger=false;
 // Read the committed actor state and already visible projectiles/marks, never
 // change HP, position, damage, cooldowns, rewards or the opponent's choice.
 const times=hitTimes[e.pattern]||[],t=e.state==='windup'?-a.windup+e.t:e.state==='attack'?e.t:-99,until=times.find(at=>at>t+.002)-t;
 if(until>0&&until<.13&&dist<155&&Math.abs(p.y-e.y)<70&&can){if(g.parry())stats.parries++;move=false;}
 let incoming=false;for(const q of g.projectiles){if(q.friendly)continue;const tx=q.vx?(p.x-q.x)/q.vx:9;if(tx>0&&tx<.28&&Math.abs(q.y+q.vy*tx-(p.y-24))<29){incoming=true;if(tx<.13&&can){if(g.parry())stats.parries++;}else if(p.grounded&&can)jump=true;}}
 for(const f of g.combatFields||[]){if(f.damage<=0)continue;const soon=f.age+.27;if(soon<f.warning||soon>f.warning+f.duration)continue;
  if(f.kind==='ring'){const radius=(soon-f.warning)*f.speed;if(Math.abs(Math.abs(p.x-f.x)-radius)<55&&Math.abs(p.y-f.y)<55)jump=true;continue;}
  if(['crack','metal','lava','embers','ink'].includes(f.kind)&&f.age>=f.warning-.4&&p.grounded&&Math.abs(p.y-f.y)<35&&((f.x>p.x&&f.x<e.x)||(f.x+f.w<p.x&&f.x+f.w>e.x))&&Math.min(Math.abs(p.x-f.x),Math.abs(p.x-f.x-f.w))<85)jump=true;
  if(fieldTouches({...f,age:soon},p)){fieldDanger=true;
   if(['crack','metal','lava','heat','flood','ink','embers'].includes(f.kind)){jump=true;evade=p.x<f.x+f.w/2?-1:1;}
   else if(['light','future','zone','erase'].includes(f.kind))evade=p.x<f.x+f.w/2?-1:1;
   else if(can&&p.dashCD<=0)g.press('dash');
  }
 }
 if(e.pattern==='gateRush'&&['windup','attack'].includes(e.state)&&dist<150&&can&&p.grounded)jump=true;
 if(e.state==='windup'&&['futureRecord','eraseSentence','bookMaze','artificialDawn','lighthouseAim'].includes(e.pattern))move=true;
 const vulnerable=e.state==='recover'||e.state==='idle'||e.stagger>.2||e.state==='transition';
 if(e.pattern==='overheat'&&['windup','attack'].includes(e.state)||g.combatFields.some(f=>f.kind==='heat'&&f.owner===e.id)){avoidHeat=dist<155;move=false;}
 const healingWindow=vulnerable||e.state==='windup'&&a.windup-e.t>.95&&['voiceStairs','silentGround','risingTide','resonanceClones','gearRotation','invertedPage','bookMaze','artificialDawn','lighthouseAim'].includes(e.pattern);
 if(healingWindow&&!fieldDanger&&p.hp<g.maxHp*.6&&g.profile.flasks&&p.grounded&&dist>85&&!p.action){stopForHeal=true;if(Math.abs(p.vx)<12)g.heal();}
 if(vulnerable){if(!fieldDanger&&p.hp<g.maxHp*.6&&g.profile.flasks&&p.grounded){if(dist<110)retreatForHeal=true;else{stopForHeal=true;if(!p.action&&Math.abs(p.vx)<12)g.heal();}}if(!retreatForHeal&&!stopForHeal&&!avoidHeat&&dist<53&&Math.abs(p.y-e.y)<66){if(p.stamina>17)g.press('attack');move=false;}else if(g.skillCD===0&&dist<160&&Math.abs(p.y-e.y)<38&&p.stamina>30&&!p.action)g.press('skill');if(e.y<p.y-50&&p.grounded&&can)jump=true;}
 if(p.y>350&&can){if(p.grounded||p.vy>-40&&p.jumps<2)jump=true;}
 if(!p.grounded&&p.vy>-40&&e.y<p.y-60&&p.jumps<2&&can)jump=true;
 if(e.id==='brag'&&e.pattern==='overheat'&&e.state==='windup'&&p.x<e.x+145){evade=1;if(p.grounded||p.vy>-40&&p.jumps<2)jump=true;}
 if(e.id==='brag'&&p.y>307&&p.x<d.left+325){evade=1;if(p.grounded||p.vy>-40&&p.jumps<2)jump=true;}
 if(jump)g.press('jump');
 if(incoming&&p.action?.kind==='parry')move=false;
 if(p.action?.kind==='heal')move=false;
 let direction=evade||((avoidHeat||retreatForHeal)?-Math.sign(dx):stopForHeal?0:((move||p.dir!==Math.sign(dx))?Math.sign(dx):0));
 if(p.x<d.left+90&&direction<0||p.x>d.right-90&&direction>0)direction=0;
 return{left:direction<0,right:direction>0,jump:true};
}
export function runEncounter(g,seconds=240,stopPhase=false){const stats={parries:0,hits:0,damageTaken:0,patterns:new Set(),phases:new Set()},e=g.world.boss;let hp=e.hp,playerHp=g.p.hp;g.paused=false;for(let i=0;i<seconds*120;i++){if(g.profile.flags[e.id]||g.p.dead){g.paused=true;return{...stats,patterns:[...stats.patterns],phases:[...stats.phases],choice:g.profile.flags[e.id],dead:g.p.dead,hp:g.p.hp,bossHp:e.hp,seconds:i/120};}if(e.pattern)stats.patterns.add(e.pattern);stats.phases.add(e.phase);if(e.hp<hp){stats.hits++;hp=e.hp;}if(g.p.hp<playerHp)stats.damageTaken+=playerHp-g.p.hp;playerHp=g.p.hp;if(stopPhase&&e.phase===2){g.paused=true;return{phase:2};}g.update(1/120,encounterInputs(g,stats));}g.paused=true;return{timeout:true,...stats,patterns:[...stats.patterns],phases:[...stats.phases],hp:g.p.hp,bossHp:e.hp,position:{x:g.p.x,y:g.p.y},boss:{x:e.x,y:e.y,state:e.state,pattern:e.pattern}};}
