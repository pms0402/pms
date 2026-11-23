import {worldBlade,sweptBlades,bladeTouches} from './blade.js';
import {body,solids} from './world.js';

const basics=new Set(['light1','light3']);
function pointDistance(x,y,b){const dx=b.bx-b.ax,dy=b.by-b.ay,t=Math.max(0,Math.min(1,((x-b.ax)*dx+(y-b.ay)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-b.ax-t*dx,y-b.ay-t*dy);}
// Inspect the projectile's entire travelled segment, before applying body damage.
// The blade samples are the exact rigid steel samples used for enemy damage.
export function swordIntercept(g,q,oldX,oldY){
 const a=g.p.action;if(q.friendly||q.life<=0||!q.destructible||q.destroyed||!a||!basics.has(a.kind)||a.t<a.spec.windup||a.t>=a.spec.end)return false;
 const current=worldBlade(g.p),paths=g.activeSteel?.serial===a.serial&&g.activeSteel.clock===g.clock?g.activeSteel.paths:sweptBlades(a.previousBlade,current);
 const r=body(g.p),radius=q.radius||4,steps=Math.max(1,Math.ceil(Math.hypot(q.x-oldX,q.y-oldY)/2));
 for(let i=0;i<=steps;i++){const f=i/steps,x=oldX+(q.x-oldX)*f,y=oldY+(q.y-oldY)*f;
  if(paths.some(b=>pointDistance(x,y,b)<=radius+2)){
   q.destroyed=true;q.life=0;q.x=x;q.y=y;g.projectileCuts=(g.projectileCuts||0)+1;g.fx(x,y,'projectileBreak',.3);g.sound('shatter');return true;
  }
  if(x>=r.x-radius&&x<=r.x+r.w+radius&&y>=r.y-radius&&y<=r.y+r.h+radius)return false;
 }
 return false;
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
