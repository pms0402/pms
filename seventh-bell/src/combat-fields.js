import {attackSeconds} from './boss-tempo.js';
import {body,overlaps,clearLine} from './world.js';
import {bladeTouches} from './blade.js';

export const fieldActive=f=>f.age>=f.warning&&f.age<f.warning+f.duration;
export function addField(g,config){
 g.combatFields??=[];
 // Timed attacks never blanket an arena; one owner has at most four live fields.
 const own=g.combatFields.filter(f=>f.owner===config.owner&&f.damage>0);
 if(config.damage>0&&own.length>=4)return null;
 const f={id:'field-'+(++g.fieldSerial|| (g.fieldSerial=1)),age:0,warning:.85,duration:1.5,damage:0,kind:'zone',color:'#e5bc86',...config};g.combatFields.push(f);return f;
}
export function fieldTouches(f,p){
 const r=body(p);
 if(f.kind==='ring'){const radius=(f.age-f.warning)*f.speed;if(radius<0)return false;const mid=p.y-p.h/2,dy=Math.max(0,Math.abs(mid-f.y)-p.h/2),dx=Math.abs(p.x-f.x),ellipse=Math.hypot(dx,dy*(radius/Math.max(1,f.ry||24)));return Math.abs(ellipse-radius)<(f.thickness||7)+p.w/2&&dy<=(f.ry||24)+7;}
 if(['bladeEcho','beam','ropeOrbit'].includes(f.kind))return bladeTouches({ax:f.ax,ay:f.ay,bx:f.bx,by:f.by},r,f.radius||5);
 return overlaps({x:f.x,y:f.y,w:f.w,h:f.h},r);
}
export function updateFields(g,dt){
 g.p.silenced=Math.max(0,(g.p.silenced||0)-dt);g.combatFields??=[];g.arenaPlatforms??=[];g.arenaObstacles??=[];g.arenaClones??=[];
 for(const f of g.combatFields){f.age+=dt;if(f.kind==='erase'&&f.age>=f.warning+f.duration&&g.p.x+g.p.w/2>f.x&&g.p.x-g.p.w/2<f.x+f.w&&g.p.y>f.y+1&&g.p.y<490)f.age=f.warning+f.duration-.0001;if(f.scan){const t=Math.max(0,Math.min(1,(f.age-f.warning)/f.duration)),angle=f.scan.from+(f.scan.to-f.scan.from)*t;f.bx=f.ax+Math.cos(angle)*f.scan.length;f.by=f.ay+Math.sin(angle)*f.scan.length;}if(f.orbitOwner){const owner=g.world.bosses.find(e=>e.id===f.orbitOwner);if(owner){f.ax=owner.x;f.ay=owner.y-34;const angle=-Math.PI+Math.min(1,f.age/f.duration)*Math.PI*2;f.bx=f.ax+Math.cos(angle)*f.length;f.by=f.ay+Math.sin(angle)*f.length;}}if(f.follow){const e=g.world.bosses.find(e=>e.id===f.follow);if(e){f.x=e.x-f.w/2;f.y=e.y-f.h;}}if(f.flow&&f.age>=f.warning)f.x=Math.min(f.limit,f.x+f.flow*dt);if(f.kind==='flood'){const t=Math.max(0,f.age-f.warning)/f.duration,k=Math.max(0,1-Math.abs(2*t-1));f.y=f.base+(f.peak-f.base)*k;f.h=480-f.y;}if(!fieldActive(f))continue;
  if(f.kind==='silence'){if(fieldTouches(f,g.p))g.p.silenced=.15;continue;}
  if(f.damage>0&&fieldTouches(f,g.p)&&(!['beam','ropeOrbit'].includes(f.kind)||clearLine(g,f.ax,f.ay,g.p.x,g.p.y-24))){const source={x:f.sourceX??f.x,unblockable:f.unblockable!==false,stagger:0,state:'idle'};g.hurt(f.damage,source);}
 }
 for(const f of g.combatFields)if(f.age>=f.warning+f.duration&&g.world.bosses.some(e=>e.id===f.owner))g.effects.push({kind:'bossDisperse',field:{...f},life:.18,max:.18});g.combatFields=g.combatFields.filter(f=>f.age<f.warning+f.duration);
 for(const p of g.arenaPlatforms){p.age+=dt;const oldX=p.x,oldY=p.y;if(p.orbit){const angle=p.angle+p.age*p.rate;p.x=p.cx+Math.cos(angle)*p.rx-p.w/2;p.y=p.cy+Math.sin(angle)*p.ry;}if(g.p.grounded&&g.p.support===p){g.p.x+=p.x-oldX;g.p.y+=p.y-oldY;}}
 // A platform flashes for 1.4 seconds before retirement and stays while occupied
 // until a short hard cap; an adjacent permanent ledge is always available.
 g.arenaPlatforms=g.arenaPlatforms.filter(p=>p.age<p.life||g.p.support===p&&p.age<p.life+2);
 for(const o of g.arenaObstacles)o.age+=dt;g.arenaObstacles=g.arenaObstacles.filter(o=>o.age<o.life);
 for(const c of g.arenaClones){if(c.steel)c.steel.life-=dt;c.age+=dt;c.t+=dt;const boss=g.world.boss;if(c.hp<=0||c.age>=c.life)continue;
  if(c.t>=attackSeconds(1.5)&&!c.warned){c.warned=true;c.ax=c.x;c.ay=c.y-35;c.bx=c.x+c.dir*75;c.by=c.y-25;}
  if(c.t>=attackSeconds(2.3)&&!c.struck){c.struck=true;c.steel={ax:c.ax,ay:c.ay,bx:c.bx,by:c.by,at:g.clock,life:.14,max:.14,radius:4};if(bladeTouches({ax:c.ax,ay:c.ay,bx:c.bx,by:c.by},body(g.p),4))g.hurt(35,{x:c.x,unblockable:false,stagger:0,state:'idle'});}
  if(c.t>attackSeconds(3.1)){c.t=0;c.warned=false;c.struck=false;c.dir=Math.sign(g.p.x-c.x)||c.dir;}
 }
 const had=g.arenaClones.length,allKilled=had>0&&g.arenaClones.every(c=>c.hp<=0);g.arenaClones=g.arenaClones.filter(c=>c.hp>0&&c.age<c.life);if(allKilled&&!g.arenaClones.length&&g.world.boss.id==='carillon'&&!g.world.boss.dead){g.world.boss.stagger=Math.max(g.world.boss.stagger,.95);g.world.boss.state='recover';g.world.boss.t=0;}
}
export function terrainAfterErase(g,base){
 const erased=(g.combatFields||[]).filter(f=>f.kind==='erase'&&fieldActive(f));let result=base;
 for(const f of erased)result=result.flatMap(p=>{if(p.oneway||Math.abs(p.y-f.y)>2||p.x>=f.x+f.w||p.x+p.w<=f.x)return[p];return[...(p.x<f.x?[{...p,w:f.x-p.x}]:[]),...(p.x+p.w>f.x+f.w?[{...p,x:f.x+f.w,w:p.x+p.w-f.x-f.w}]:[])];});
 return result;
}
export function dynamicSolids(g,base){return[...terrainAfterErase(g,base),...(g.arenaPlatforms||[]),...(g.arenaObstacles||[]).filter(o=>o.age>=o.warning)];
}
export function clearArena(g){g.combatFields=[];g.arenaPlatforms=[];g.arenaObstacles=[];g.arenaClones=[];g.activeSteel=null;}
