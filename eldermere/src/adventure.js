import {CHAPTERS,CLASSES,CONTRACTS,stageAt,learned,nodesFor,nodeReason,skillPoints} from './progression.js';
import {RUINS} from './adventure-world.js';
export class AdventureSystem{
 constructor(game){this.g=game;this.hazards=[];this.slow=0;}
 get s(){return this.g.state;}get r(){return this.s.rpg;}
 choose(id){if(!Object.hasOwn(CLASSES,id)||this.s.map!=='overworld'||this.g.activities.busy||this.g.enemies.some(e=>Math.hypot(e.x-this.g.p.x,e.y-this.g.p.y)<180))return false;this.r.class=id;this.r.buffs.guard=0;this.g.p.hp=Math.min(this.g.p.hp,this.g.maxHp);this.g.notify(CLASSES[id].name+'의 길을 택했습니다. K에서 기술을 배울 수 있습니다.','level');this.g.save(false);return true;}
 learn(id){const n=nodesFor(this.r.class).find(n=>n.id===id);if(nodeReason(this.s,n)||this.g.activities.busy)return false;this.r.learned[id]=true;this.g.notify(n.name+' 습득 · 기술 점수 '+skillPoints(this.s),'level');this.g.save(false);return true;}
 bonusHp(){return learned(this.s,'vigor')?15:0;}bonusDamage(){return(learned(this.s,'edge')?3:0)+(learned(this.s,'legacy')?5:0);}bonusDefense(){return (learned(this.s,'legacy')?3:0)+(this.r.buffs.ward>0?3:0);}
 canEnter(map){const c=CHAPTERS.find(c=>c.map===map);if(!c)return'알 수 없는 유적';const i=CHAPTERS.indexOf(c);if(stageAt(this.s)<i)return CHAPTERS[i-1].name+' 보스를 먼저 처치하세요.';if(this.g.p.level<c.level)return'전투 레벨 '+c.level+'이 필요합니다. 게시판 의뢰와 현재 지역 전투로 성장하세요.';return'';}
 enter(map){const reason=this.canEnter(map);if(reason){this.g.notify(reason);return false;}const c=CHAPTERS.find(c=>c.map===map);if(this.s.map!=='overworld'||Math.hypot(this.g.p.x-c.x,this.g.p.y-c.y)>65)return false;const d=RUINS[map];this.hazards=[];this.g.life.travel(map,d.entry.x,d.entry.y);this.g.notify(c.name+' · 보스의 공격 예고를 살피세요.');return true;}
 exit(map){const c=CHAPTERS.find(c=>c.map===map);if(!c)return false;this.hazards=[];this.g.life.travel('overworld',c.x,c.y+45);return true;}
 cast(slot,angle){const c=CLASSES[this.r.class],skill=c?.skills[slot];if(!skill||this.g.paused||this.g.activities.busy||!learned(this.s,'active'+(slot+1)))return false;if((this.r.cooldowns[skill.id]||0)>0||this.g.p.stamina<skill.cost)return false;
 const g=this.g,p=g.p,a=Number.isFinite(angle)?angle:[Math.PI/2,0,-Math.PI/2,Math.PI][p.dir],power=g.damage*(learned(this.s,'mastery1')&&slot===0?1.3:1);p.stamina-=skill.cost;this.r.cooldowns[skill.id]=skill.cooldown*(learned(this.s,'mastery2')&&slot===1?.75:1);g.event('sound',{name:'cast'});
 const aoe=(radius,damage,cone=false,slow=0)=>{for(const e of g.enemies){const dx=e.x-p.x,dy=e.y-p.y;if(Math.hypot(dx,dy)>radius||!g.clearLine(p.x,p.y,e.x,e.y)||cone&&Math.abs(Math.atan2(Math.sin(Math.atan2(dy,dx)-a),Math.cos(Math.atan2(dy,dx)-a)))>1.6)continue;e.slow=Math.max(e.slow||0,slow);g.hitEnemy(e,Math.round(damage),Math.atan2(dy,dx));}};
 if(skill.id==='cleave')aoe(100,power*1.7,true);
 if(skill.id==='guard')this.r.buffs.guard=5;
 if(skill.id==='volley')for(const off of[-.2,0,.2])g.projectiles.push({x:p.x,y:p.y,angle:a+off,speed:330,range:310,damage:Math.round(power*.75),type:'arrow'});
 if(skill.id==='snare')aoe(120,power*.7,false,4);
 if(skill.id==='nova')aoe(115,power*1.3,false,3);
 if(skill.id==='blink'||skill.id==='lunge'){if(skill.id==='lunge')aoe(100,power*2,true);g.invulnerable=Math.max(g.invulnerable,.4);g.move(p,Math.cos(a)*(skill.id==='blink'?95:55),Math.sin(a)*(skill.id==='blink'?95:55));}
 if(skill.id==='smoke'){g.invulnerable=Math.max(g.invulnerable,1.2);p.stamina=Math.min(100,p.stamina+35);aoe(105,power*.3,false,4);}
 g.burst(p.x,p.y-15,26,c.color);g.effects.push({x:p.x,y:p.y-45,text:skill.name,color:c.color,life:1});return true;
 }
 update(dt){this.slow=Math.max(0,this.slow-dt);for(const k of Object.keys(this.r.cooldowns))this.r.cooldowns[k]=Math.max(0,this.r.cooldowns[k]-dt);for(const k of Object.keys(this.r.buffs))this.r.buffs[k]=Math.max(0,this.r.buffs[k]-dt);
 for(const h of this.hazards){if(h.map!==this.s.map){h.dead=true;continue;}h.t-=dt;if(h.t>0)continue;h.life-=dt;if(h.kind==='orb'){const nx=h.x+Math.cos(h.angle)*h.speed*dt,ny=h.y+Math.sin(h.angle)*h.speed*dt;if(this.g.solid(nx,ny,3)){h.dead=true;continue;}h.x=nx;h.y=ny;}
 if(!h.hit){const p=this.g.p,hit=h.kind==='line'?distanceLine(p.x,p.y,h.x,h.y,h.xx,h.yy)<h.radius:Math.hypot(p.x-h.x,p.y-h.y)<h.radius+6;if(hit){h.hit=true;const hurt=this.g.hurt(h.damage,{x:h.x,y:h.y});if(h.slow&&hurt)this.slow=3;if(h.kind==='orb')h.dead=true;}}
 if(h.life<=0)h.dead=true;}
 this.hazards=this.hazards.filter(h=>!h.dead);
 }
 hazard(e,kind,data){this.hazards.push({map:e.map,kind,t:.9,life:.25,damage:e.damage,radius:34,color:e.type==='emberlord'?'#e79759':e.type==='frostqueen'?'#9fded4':'#c3a0df',...data});}
 enemy(e,dt){if(!e.boss)return false;e.castFlash=Math.max(0,(e.castFlash||0)-dt);e.hit=Math.max(0,e.hit-dt);e.cooldown-=dt;e.slow=Math.max(0,(e.slow||0)-dt);const p=this.g.p,dx=p.x-e.x,dy=p.y-e.y,d=Math.hypot(dx,dy);if(d>360&&Math.hypot(e.x-e.homeX,e.y-e.homeY)<10)return true;
 if(e.cooldown<=0){e.castFlash=.7;const phase=e.hp<e.maxHp*.5,round=e.round++;
  if(e.type==='emberlord'){if(round%2===0){for(let i=0;i<(phase?4:3);i++)this.hazard(e,'circle',{x:p.x+(i===0?0:Math.cos(i*2.3)*65),y:p.y+(i===0?0:Math.sin(i*2.3)*60),t:.95+i*.16,radius:phase?42:35});}else {const a=Math.atan2(dy,dx);this.hazard(e,'line',{x:e.x,y:e.y,xx:e.x+Math.cos(a)*265,yy:e.y+Math.sin(a)*265,radius:19,t:1});}e.cooldown=phase?2.6:3.4;}
  if(e.type==='frostqueen'){const a=Math.atan2(dy,dx);for(let i=0;i<(phase?8:5);i++)this.hazard(e,'orb',{x:e.x,y:e.y-5,angle:phase?i*Math.PI/4:a+(i-2)*.24,speed:105,life:3.3,radius:8,t:.85,slow:true});if(round%2===1)this.hazard(e,'circle',{x:p.x,y:p.y,radius:50,t:1.35,slow:true});e.cooldown=phase?2.5:3.5;}
  if(e.type==='riftkeeper'){if(round%2===0){for(let i=0;i<2;i++){const a=(round*.45)+i*Math.PI/2;this.hazard(e,'line',{x:e.x-Math.cos(a)*290,y:e.y-Math.sin(a)*290,xx:e.x+Math.cos(a)*290,yy:e.y+Math.sin(a)*290,radius:phase?24:18,t:1.1});}}else{for(let i=0;i<(phase?8:5);i++)this.hazard(e,'orb',{x:e.x,y:e.y,angle:Math.atan2(dy,dx)+(i-(phase?3.5:2))*.3,speed:130,life:3,radius:9,t:.8});this.hazard(e,'circle',{x:p.x,y:p.y,radius:45,t:1.1});}e.cooldown=phase?2.2:3.2;}
  this.g.event('sound',{name:'cast'});
 }
 if(d>55&&e.hit<=0)this.g.pursueEnemy(e,p,e.slow?13:23,dt,55);return true;
 }
 onKill(e){this.r.kills[e.type]=(this.r.kills[e.type]||0)+1;const c=CHAPTERS.find(c=>c.boss===e.id);if(c){e.dead=true;e.respawn=1e12;this.s.killed[e.id]=1e12;if(this.r.clears.includes(c.boss))return true;if(CHAPTERS.indexOf(c)!==stageAt(this.s))return true;this.r.clears.push(c.boss);this.s.inventory[c.reward]+=4;this.s.gold+=c.gold;this.g.gainXp(c.xp);if(c.boss==='guardian'){this.s.inventory.crystal++;if(this.s.quest===2)this.s.quest=3;this.g.life.unlock('silver');}if(c.boss==='frostqueen')this.g.life.unlock('mythril');this.g.notify('챕터 완료 · '+c.name+'! '+c.unlock+' 해금','level');this.g.event('chapter',{chapter:c});this.hazards=[];this.g.save(false);return true;}
 const special=({emberling:'emberCore',frostling:'frostHeart',riftsentinel:'starSigil'})[e.type];if(special&&this.r.kills[e.type]%3===0){this.s.inventory[special]++;this.g.notify('전투 전용 재료를 얻었습니다.','level');}return false;
 }
 contract(id,action){const c=CONTRACTS[id];if(!c||stageAt(this.s)<c.stage||this.g.activities.busy)return false;const near=this.g.life.objects().some(o=>o.id==='quest-board'&&this.g.life.near(o,80)||o.type==='elder'&&this.g.life.near(o,80));if(!near)return false;const day=Math.floor((this.s.time+200)/600);let q=this.r.contracts[id];if(action==='accept'){if(q?.active||q?.day===day)return false;this.r.contracts[id]={active:true,start:this.r.kills[c.type]||0,day:-1};}else if(action==='deliver'){if(!q?.active||(this.r.kills[c.type]||0)-q.start<c.qty)return false;q.active=false;q.day=day;this.s.gold+=c.gold;this.g.gainXp(c.xp);this.g.notify('모험 의뢰 완료 · '+c.gold+' G / '+c.xp+' XP','level');}else return false;this.g.save(false);return true;}
}
function distanceLine(x,y,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-ax-t*dx,y-ay-t*dy);}
