import {wardTime} from './sanctuary.js';
import {worldBlade,sweptBlades,bladeTouches} from './blade.js';
import {body,solids,clearLine} from './world.js';

const melee=new Set(['light1','light3','heavy','thrust','upper','counter','plunge']);
export function ordinaryProjectile(g,q){if(q.friendly||q.source==='boss'||q.source==='trap'||g.world.bosses.some(e=>e.id===q.owner)||g.world.traps.some(e=>e.id===q.owner))return false;const owner=[...g.world.enemies,...(g.world.minibosses||[])].find(e=>e.id===q.owner);if(owner?.boss||owner?.training)return false;return !!(owner&&!owner.boss&&!owner.training||q.source==='enemy'||q.destructible===true);}
function breakShot(g,q,x,y){if(q.destroyed||q.life<=0)return false;q.destroyed=true;q.life=0;q.x=x;q.y=y;g.projectileCuts=(g.projectileCuts||0)+1;g.fx(x,y,'projectileBreak',.3);g.sound('shatter');return true;}
const activeMelee=a=>a&&melee.has(a.kind)&&a.t>=a.spec.windup&&(a.kind==='plunge'?(!a.landed||a.recoveryT===0):a.t<a.spec.end);
function pointDistance(x,y,b){const dx=b.bx-b.ax,dy=b.by-b.ay,t=Math.max(0,Math.min(1,((x-b.ax)*dx+(y-b.ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-b.ax-t*dx,y-b.ay-t*dy);}
// Inspect the projectile's entire travelled segment, before applying body damage.
// The blade samples are the exact rigid steel samples used for enemy damage.
export function swordIntercept(g,q,oldX,oldY){
 const a=g.p.action;if(q.life<=0||q.destroyed||!ordinaryProjectile(g,q)||!activeMelee(a))return false;
 const current=worldBlade(g.p),paths=g.activeSteel?.serial===a.serial&&g.activeSteel.clock===g.clock?g.activeSteel.paths:sweptBlades(a.previousBlade,current);
 const r=body(g.p),radius=q.radius||4,steps=Math.max(1,Math.ceil(Math.hypot(q.x-oldX,q.y-oldY)/2));
 for(let i=0;i<=steps;i++){const f=i/steps,x=oldX+(q.x-oldX)*f,y=oldY+(q.y-oldY)*f;
  if(paths.some(b=>pointDistance(x,y,b)<=radius+2)&&clearLine(g,g.p.x,g.p.y-30,x,y)){
   return breakShot(g,q,x,y);
  }
  if(x>=r.x-radius&&x<=r.x+r.w+radius&&y>=r.y-radius&&y<=r.y+r.h+radius)return false;
 }
 return false;
}

// Relative motion makes two fast projectiles meet even between rendered frames.
function boxEntry(ax,ay,bx,by,r,pad=0){let lo=0,hi=1;for(const[a,d,min,max]of[[ax,bx-ax,r.x-pad,r.x+r.w+pad],[ay,by-ay,r.y-pad,r.y+r.h+pad]]){if(Math.abs(d)<1e-9){if(a<min||a>max)return Infinity;}else{const u=(min-a)/d,v=(max-a)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));if(lo>hi)return Infinity;}}return lo;}
function flight(g,q,dt){const copy={...q};prepareProjectile(g,copy,dt);if(copy.life<=0)return null;const speed=Math.hypot(copy.vx,copy.vy),dx=copy.vx*dt,dy=copy.vy*dt,limit=Math.min(1,q.life/dt,speed?Math.max(0,((q.range||300)-(q.distance||0))/(speed*dt)):1),wall=projectileWallTime(g,q,q.x,q.y,q.x+dx,q.y+dy),ward=wardTime(g,q,q.x,q.y,q.x+dx,q.y+dy);return{x:q.x,y:q.y,dx,dy,limit:Math.min(limit,wall,ward)};}
export function echoIntercept(g,dt){if(dt<=0)return;const friendly=g.projectiles.filter(q=>q.friendly&&q.life>0&&q.kind==='echoBlade');if(!friendly.length)return;const hostile=g.projectiles.filter(q=>q.life>0&&ordinaryProjectile(g,q));
 for(const a of friendly){const path=flight(g,a,dt);if(!path)continue;
  // A spent piercing blade cannot clear shots behind its last actual target.
  const stops=[...g.world.enemies,...(g.world.minibosses||[]),g.world.boss,...(g.arenaClones||[])].filter(e=>!e.dead&&(!e.boss||g.bossActive&&e===g.world.boss)&&!a.hit.has(e.id)).map(e=>({e,t:boxEntry(path.x-Math.sign(a.vx)*14,path.y,path.x+path.dx+Math.sign(a.vx)*14,path.y+path.dy,body(e),2)})).filter(o=>o.t<=path.limit&&clearLine(g,path.x,path.y,o.e.x,o.e.y-Math.min(35,o.e.h/2))).sort((a,b)=>a.t-b.t),remaining=a.pierce-a.hit.size;if(remaining<=0)continue;if(stops.length>=remaining)path.limit=Math.min(path.limit,stops[remaining-1].t);
  for(const q of hostile){if(q.life<=0)continue;const b=flight(g,q,dt);if(!b)continue;const x=b.x-path.x,y=b.y-path.y,dx=b.dx-path.dx,dy=b.dy-path.dy,r=(q.radius||5)+14,A=dx*dx+dy*dy,B=2*(x*dx+y*dy),C=x*x+y*y-r*r,D=B*B-4*A*C;let t=C<=0?0:A>1e-9&&D>=0?(-B-Math.sqrt(D))/(2*A):Infinity;
   const playerAt=boxEntry(b.x,b.y,b.x+b.dx,b.y+b.dy,body(g.p),q.radius||5);if(t<0||t>Math.min(path.limit,b.limit)||t>playerAt||!clearLine(g,path.x+path.dx*t,path.y+path.dy*t,b.x+b.dx*t,b.y+b.dy*t))continue;
   breakShot(g,q,b.x+b.dx*t,b.y+b.dy*t);
  }
 }
}

export function prepareProjectile(g,q,dt){
 if(q.turnRate&&!q.returning){const desired=Math.atan2(g.p.y-23-q.y,g.p.x-q.x),angle=Math.atan2(q.vy,q.vx),delta=Math.atan2(Math.sin(desired-angle),Math.cos(desired-angle)),turn=Math.max(-q.turnRate*dt,Math.min(q.turnRate*dt,delta)),speed=Math.hypot(q.vx,q.vy);q.vx=Math.cos(angle+turn)*speed;q.vy=Math.sin(angle+turn)*speed;}
 if(q.gravity)q.vy+=q.gravity*dt;
 if(!q.tether)return;
 const e=g.world.bosses.find(e=>e.id===q.owner);if(!e||e.dead){q.life=0;return;}
 q.age=(q.age||0)+dt;
 if(!q.returning&&(q.distance>=q.outRange||q.stuck)){q.stuck=true;q.hold=(q.hold||0)+dt;q.vx=q.vy=0;if(q.hold>q.holdTime){q.returning=true;q.stuck=false;}}
 if(q.returning){const dx=e.x-q.x,dy=e.y-48-q.y,d=Math.hypot(dx,dy);if(d<20){q.life=0;e.anchorOut=false;return;}q.vx=dx/d*q.returnSpeed;q.vy=dy/d*q.returnSpeed;}
}

export function spawnEnemyShot(g,e,kind,angle,speed=165,extra={}){
 g.spawnShot(e.x+e.dir*18,e.y-Math.min(e.h*.65,35),Math.cos(angle)*speed,Math.sin(angle)*speed,extra.damage||23+(e.rank||0)*4,e.id,kind,extra.range||340);
 const q=g.projectiles.at(-1);Object.assign(q,{destructible:true,radius:kind==='harpoon'?4:5,...extra});return q;
}

export const projectileBody=(q,x=q.x,y=q.y)=>({x:x-(q.radius||5),y:y-(q.radius||5),w:(q.radius||5)*2,h:(q.radius||5)*2});
export const projectileTouches=(q,oldX,oldY,r)=>bladeTouches({ax:oldX,ay:oldY,bx:q.x,by:q.y},r,q.radius||5);

// Clip at the first physical wall, then let steel/body CCD inspect only the
// travelled prefix. A wall behind the player cannot erase an earlier contact.
export function projectileWallTime(g,q,ax,ay,bx,by){let first=1;const dx=bx-ax,dy=by-ay,r=q.radius||3;for(const wall of solids(g)){if(wall.oneway)continue;let lo=0,hi=1;for(const[a,v,min,max]of [[ax,dx,wall.x-r,wall.x+wall.w+r],[ay,dy,wall.y-r,wall.y+wall.h+r]]){if(Math.abs(v)<1e-8){if(a<min||a>max){lo=2;break;}}else{let t0=(min-a)/v,t1=(max-a)/v;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>hi)break;}}if(lo<=hi&&hi>=0&&lo>=0&&lo<first)first=lo;}return first;}
