import {SPECIES} from './enemy-species.js';
import {body,moveBody,solids,clearLine} from './world.js';
import {bladeTouches} from './blade.js';
import {spawnEnemyShot} from './projectile-combat.js';
import {addField} from './combat-fields.js';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const rangeRoles=new Set(['ranged','notes','paper','mage','harpoon','lantern','resonator']);
function begin(e,g,mode){const d=SPECIES[e.type];e.mode=mode;e.state='windup';e.t=0;e.beat=0;e.released=false;e.didHit=false;e.dir=Math.sign(g.p.x-e.x)||e.dir;e.aim={x:g.p.x,y:g.p.y-24};e.prep=d.windup*(e.buffedUntil>g.clock?.8:1);e.shielding=['guard','bookguard','duelist'].includes(d.role)&&mode==='guard';}
function fire(g,e,kind,offset=0,extra={}){const angle=Math.atan2(e.aim.y-(e.y-Math.min(e.h*.65,35)),e.aim.x-e.x)+offset;return spawnEnemyShot(g,e,kind,angle,extra.speed||170,extra);}
function strike(g,e,reach,height=32){const n=SPECIES[e.type],start={ax:e.x,ay:e.y-height,bx:e.x+e.dir*reach,by:e.y-height};if(!e.didHit&&bladeTouches(start,body(g.p),5)&&clearLine(g,e.x,e.y-25,g.p.x,g.p.y-24)){e.didHit=true;g.hurt(26+(n.chapter-1)*4+(e.elite?4:0),e);}}
function release(g,e){const d=SPECIES[e.type],role=d.role;e.released=true;e.shielding=false;
 if(role==='ranged')fire(g,e,'arrow');
 if(role==='notes'){for(const a of [-.18,0,.18])fire(g,e,'note',a);e.relocate=true;}
 if(role==='paper'){fire(g,e,'paperKnife');}
 if(role==='mage'){fire(g,e,'sunbolt');addField(g,{owner:e.id,kind:'zone',x:e.aim.x-29,y:e.aim.y+16,w:58,h:12,warning:1.15,duration:1,damage:26,color:'#efd991'});}
 if(role==='harpoon')fire(g,e,'harpoon',0,{speed:225,range:430});
 if(role==='lantern')fire(g,e,'lanternPearl',0,{speed:95,turnRate:.55,range:340});
 if(role==='resonator')for(const a of [-.28,0,.28])fire(g,e,'resonance',a,{speed:145});
 if(role==='ember')fire(g,e,'fireball',0,{speed:145});
 if(role==='monk'&&e.mode==='wave')spawnEnemyShot(g,e,'lowNote',e.dir>0?0:Math.PI,135,{damage:25+e.rank*3,range:250,y:e.y-8});
 if(role==='support'&&e.mode==='chant'){for(const ally of g.world.enemies)if(ally!==e&&!ally.dead&&Math.hypot(ally.x-e.x,ally.y-e.y)<230)ally.buffedUntil=g.clock+6;g.fx(e.x,e.y-25,'echo',.5);}
}
export function updateNativeEnemy(g,e,dt){
 const d=SPECIES[e.type];if(!d)return false;e.hit=Math.max(0,e.hit-dt);if(e.dead){e.deathT+=dt;return true;}if(Math.abs(e.x-g.p.x)>1000||Math.abs(e.y-g.p.y)>750)return true;
 e.stagger=Math.max(0,e.stagger-dt);e.cooldown-=dt;e.t+=dt;e.trailClock=(e.trailClock||0)+dt;const p=g.p,dx=p.x-e.x,dy=p.y-e.y,dist=Math.abs(dx),alert=dist<440&&Math.abs(dy)<(e.flying?300:190),oldX=e.x,oldY=e.y;
 if(e.unstableUntil>g.clock){e.vx=0;e.t=0;e.stagger=Math.max(e.stagger,.15);e.state='recover';}
 else if(e.stagger>0){e.vx*=Math.max(0,1-dt*8);}
 else if(e.state==='windup'){
  e.vx=0;if(e.t>=e.prep){e.state='attack';e.t=0;e.didHit=false;e.released=false;release(g,e);g.sound(rangeRoles.has(d.role)?'echo':'swing');}
 }else if(e.state==='attack'){
  e.vx=0;
  if(['cart','hook'].includes(d.role)){e.vx=e.dir*(d.role==='cart'?180:195);strike(g,e,d.role==='cart'?e.w/2+22:70,25);}
  else if(d.role==='dive'){const x=e.aim.x-e.x,y=e.aim.y+16-e.y,len=Math.hypot(x,y)||1;e.vx=x/len*215;e.vy=y/len*215;strike(g,e,42,14);}
  else if(!rangeRoles.has(d.role)&&!['ember','support'].includes(d.role)&&!(d.role==='monk'&&e.mode==='wave'))strike(g,e,d.reach,d.role==='ink'?12:e.beat%2?17:32);
  else if(d.role==='support'&&e.mode==='push')strike(g,e,76,24);
  if(e.t>=(d.role==='dive'?.85:.25)){const combo=d.combo+(e.elite&&['pick','duelist','rhythm','copy'].includes(d.role)?1:0);if(e.beat+1<combo){e.beat++;e.state='windup';e.t=0;e.prep=d.role==='rhythm'?.58:.48;e.didHit=false;if(d.role==='duelist'){e.dir=Math.sign(p.x-e.x)||e.dir;e.aim={x:p.x,y:p.y-24};}}else{e.state='recover';e.t=0;e.vx=0;e.cooldown=d.role==='harpoon'?1.35:.9;}}
 }else if(e.state==='recover'){
  e.vx=0;if(e.relocate&&e.flying)e.vx=-Math.sign(dx)*d.speed;if(e.t>(['cart','spear','rhythm'].includes(d.role)?1.15:.85)){e.state='idle';e.t=0;e.relocate=false;}
 }else if(alert){
  e.dir=Math.sign(dx)||e.dir;e.shielding=['guard','bookguard','duelist'].includes(d.role);
  if(d.role==='ember'&&e.hp<e.maxHp*.4&&!e.retreated){e.retreated=true;e.retreatUntil=g.clock+2.5;addField(g,{owner:e.id,kind:'embers',x:e.x-25,y:e.y-12,w:50,h:12,warning:.5,duration:2.4,damage:22,color:'#ef8c4b'});}
  const ranged=rangeRoles.has(d.role)||d.role==='ember',reachable=Math.abs(dy)<(ranged||e.flying?230:65);
  if(d.role==='lantern'&&dist<125||e.retreatUntil>g.clock){e.vx=-e.dir*d.speed;}
  else if(ranged){e.vx=dist<125?-e.dir*d.speed*.8:dist>d.reach?e.dir*d.speed:0;if(e.cooldown<=0&&dist<d.reach+55&&reachable&&clearLine(g,e.x,e.y-25,p.x,p.y-24))begin(e,g,'shoot');}
  else if(d.role==='support'){const allies=g.world.enemies.some(a=>a!==e&&!a.dead&&Math.abs(a.x-e.x)<230);if(e.cooldown<=0&&(dist<76||allies))begin(e,g,dist<76?'push':'chant');else e.vx=dist<135?-e.dir*d.speed:0;}
  else if(d.role==='monk'){e.vx=dist>66?e.dir*d.speed:0;if(e.cooldown<=0&&dist<230&&reachable)begin(e,g,dist>94&&e.attackCycle++%2===0?'wave':'staff');}
  else if(d.role==='bookguard'&&e.guardHits>0&&e.cooldown<=0){begin(e,g,'guard');e.prep=1.1;e.guardHits=0;}
  else{e.vx=dist>(d.role==='duelist'?75:d.reach-15)?e.dir*d.speed:0;if(e.cooldown<=0&&dist<d.reach&&reachable&&clearLine(g,e.x,e.y-20,p.x,p.y-20)){begin(e,g,'melee');if(d.role==='dive')e.aim.y=p.y-12;}}
 }else{e.shielding=false;e.vx=Math.abs(e.homeX-e.x)>40?Math.sign(e.homeX-e.x)*22:0;}

 if(d.role==='ink'&&e.trailClock>.7&&alert){e.trailClock=0;addField(g,{owner:e.id,kind:'ink',x:e.x-(e.surface==='wall'?4:15),y:e.y-(e.surface==='wall'?20:7),w:e.surface==='wall'?7:30,h:e.surface==='wall'?30:7,warning:.35,duration:2.4,damage:15,color:'#9b80ad'});}
 if(e.flying){
  const yTarget=d.role==='dive'?(e.state==='recover'?p.y-14:e.homeY-82):alert?p.y-27:e.homeY;
  if(!(d.role==='dive'&&e.state==='attack'))e.vy=clamp((yTarget-e.y)*3,-85,85);
  e.x+=e.vx*dt;e.y+=e.vy*dt;
  if(solids(g).some(q=>!q.oneway&&e.x+e.w/2>q.x&&e.x-e.w/2<q.x+q.w&&e.y>q.y&&e.y-e.h<q.y+q.h)){e.x=oldX;e.y=oldY;e.vx=0;}
 }else{
  e.vy=Math.min(500,e.vy+1100*dt);const floors=solids(g),direction=Math.sign(e.vx)||e.dir,ahead=floors.some(q=>q.x<e.x+direction*(e.w/2+10)&&q.x+q.w>e.x+direction*(e.w/2+10)&&Math.abs(q.y-e.y)<30);
  const climbable=d.role==='ink'&&floors.some(q=>!q.oneway&&q.y<e.y-20&&q.y+q.h>e.y-e.h&&Math.abs((direction>0?q.x:q.x+q.w)-(e.x+direction*e.w/2))<15);if(!ahead&&e.grounded&&!climbable)e.vx=0;
  if(d.role==='hook'&&g.world.waterAreas?.some(w=>e.x>w.x&&e.x<w.x+w.w&&e.y>w.level))e.vx*=1.35;
  const wanted=e.vx;moveBody(e,dt,floors);if(e.grounded)e.surface='floor';
  if(d.role==='cart'&&e.state==='attack'&&Math.abs(wanted)>1&&Math.abs(e.x-oldX)<.01){e.state='recover';e.t=0;e.stagger=1.1;e.vx=0;g.fx(e.x+e.dir*30,e.y-20,'hit',.3);}
  if(d.role==='ink'&&wanted&&Math.abs(e.x-oldX)<.01){e.surface='wall';e.y-=Math.min(45*dt,40);e.vy=0;}
 }
 e.walk+=Math.abs(e.x-oldX);return true;
}
export function speciesDamage(g,e,n,kind){const d=SPECIES[e.type];if(!d)return n;
 if(e.shielding&&(g.p.x-e.x)*e.dir>0&&g.p.y>e.y-e.h-12){e.guardHits=(e.guardHits||0)+1;g.fx(e.x+e.dir*18,e.y-28,'parry',.2);return Math.max(1,Math.round(n*(kind==='heavy'?.7:d.role==='bookguard'?.22:.48)));}
 if(d.role==='ink'&&g.p.y<e.y-26)return Math.round(n*1.5);return n;
}
export function speciesKilled(g,e){if(e.type==='resonator')for(const ally of g.world.enemies)if(ally.type==='resonator'&&ally!==e&&!ally.dead&&Math.abs(ally.x-e.x)<350)ally.unstableUntil=g.clock+2;}
