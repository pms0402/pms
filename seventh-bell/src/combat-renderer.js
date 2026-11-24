import {projectileWallTime} from './projectile-combat.js';
import {routeWallActive} from './world-routes.js';
import {cell,draw,drawPose,drawBoss,gatePanel,prop} from './art.js';
import {SPECIES,nativeEnemyPose} from './enemy-species.js';
import {fieldActive} from './combat-fields.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function atlasObject(c,col,row,x,y,w,h){const im=cell('combat-atlas',col,row),b=im.opaqueBounds;c.drawImage(im,b.x,b.y,b.w,b.h,Math.round(x-w/2),Math.round(y-h),Math.round(w),Math.round(h));}
const shotCells={arrow:[0,0],note:[1,0],lowNote:[0,2],fireball:[2,0],ember:[2,0],paperKnife:[3,0],page:[3,0],sunbolt:[4,0],harpoon:[5,0],lanternPearl:[0,1],resonance:[1,2],metalShard:[2,1],anchor:[3,1],ironWeight:[4,1],hook:[5,1],choirWave:[0,2],bellWave:[1,2]};
export function renderProjectile(c,q,g){const coords=shotCells[q.kind];if(!coords)return false;
 if(q.tether){const owner=g.world.bosses.find(e=>e.id===q.owner);if(owner){c.save();c.strokeStyle='#242a2a';c.lineWidth=3;c.beginPath();c.moveTo(owner.x,owner.y-48);c.lineTo(q.x,q.y);c.stroke();c.strokeStyle='#c5b48c';c.lineWidth=1;c.setLineDash([3,3]);c.stroke();c.restore();}}
 const long=['arrow','harpoon','paperKnife','hook'].includes(q.kind),big=['anchor','ironWeight'].includes(q.kind),wave=['choirWave','bellWave','lowNote'].includes(q.kind),w=big?34:long?29:wave?34:19,h=big?32:long?12:wave?28:19;
 c.save();c.translate(Math.round(q.x),Math.round(q.y));c.rotate(long?Math.atan2(q.vy,q.vx):0);atlasObject(c,...coords,0,h/2,w,h);if(q.destructible){c.fillStyle='#f1eed4';c.fillRect(-2,-h/2-4,4,1);}c.restore();return true;
}
export function renderNativeEnemy(c,e,g){const pose=nativeEnemyPose(e);if(!pose)return false;if(e.type==='inkworm'&&e.surface==='wall'&&!e.grounded){const im=cell(pose.sheet,pose.col,pose.row),b=im.opaqueBounds,w=b.w*pose.size/im.width,h=b.h*pose.size/im.height;c.save();c.translate(Math.round(e.x),Math.round(e.y-e.h/2));c.rotate(-e.dir*Math.PI/2);if(e.dir<0)c.scale(-1,1);c.drawImage(im,b.x,b.y,b.w,b.h,-w/2,-h/2,w,h);c.restore();}else if(pose.gait)drawPose(c,pose,e.x,e.y,e.dir);else draw(c,pose.sheet,pose.col,pose.row,e.x,e.y,pose.size,pose.size,e.dir<0,1,!e.flying);if(g&&e.buffedUntil>g.clock)atlasObject(c,1,0,e.x,e.y-e.h-5,14,15);return true;}
export function renderArena(r){const c=r.c,g=r.g,boss=g.world.boss;if(boss.pattern==='invertedPage'&&boss.state==='windup'&&boss.destination){c.save();c.globalAlpha=.3;drawBoss(c,{...boss,x:boss.destination.x,y:boss.destination.y,state:'idle',pattern:null,hit:0,stagger:0});c.restore();atlasObject(c,3,0,boss.destination.x,boss.destination.y+20,36,22);}
 for(const m of g.world.movers||[]){if(m.enabled&&!g.profile.routes[m.enabled])continue;c.save();c.strokeStyle='#93866c';c.lineWidth=2;if(m.periodic==='orbit'){if(m.id.endsWith('-a'))prop(c,'gearwheel',m.cx,m.cy+65,130,.8);c.beginPath();c.moveTo(m.cx,m.cy);c.lineTo(m.x+m.w/2,m.y);c.stroke();}else if(!m.periodic){c.beginPath();c.moveTo(m.x+m.w/2,Math.min(m.top,m.bottom)-70);c.lineTo(m.x+m.w/2,m.y);c.stroke();}else{c.beginPath();c.moveTo(m.left,m.y-32);c.lineTo(m.right+m.w,m.y-32);c.stroke();}atlasObject(c,1,3,m.x+m.w/2,m.y+m.h,m.w,m.h);c.restore();}
 for(const w of g.world.routeWalls||[]){if(routeWallActive(g,w)){if(w.water)gatePanel(c,w);else atlasObject(c,4,w.style==='bookcase'?2:3,w.x+w.w/2,w.y+w.h,w.w,w.h);}}
 for(const floating of g.world.waterPlatforms||[])atlasObject(c,1,3,floating.x+floating.w/2,floating.y+floating.h,floating.w,floating.h);
 for(const water of g.world.waterAreas||[]){c.save();c.fillStyle='#3a7d873a';c.fillRect(water.x,water.level,water.w,water.bottom-water.level);for(let x=water.x;x<water.x+water.w;x+=64)atlasObject(c,0,3,x+32,water.level+10,66,20);c.restore();}

 for(const p of g.arenaPlatforms||[]){c.save();if(p.age>p.life-1.4)c.globalAlpha=.55+.35*Math.sin(g.clock*15);atlasObject(c,p.style==='book'?4:1,p.style==='book'?2:3,p.x+p.w/2,p.y+p.h,p.w,p.h);c.restore();}
 for(const o of g.arenaObstacles||[]){c.save();if(o.age<o.warning){c.globalAlpha=.3;c.setLineDash([4,4]);c.strokeStyle='#d6c0e8';c.strokeRect(o.x,o.y,o.w,o.h);}atlasObject(c,4,2,o.x+o.w/2,o.y+o.h,o.w,o.h);c.restore();}
 for(const f of g.combatFields||[]){if(f.owner&&f.owner!==g.world.boss.id&&Math.abs((f.x||0)-g.p.x)>850)continue;const active=fieldActive(f),c=r.c;c.save();c.strokeStyle=f.color;c.fillStyle=f.color;c.lineWidth=active?2:1;c.globalAlpha=active?.85:.48;if(!active)c.setLineDash([4,4]);
  if(f.kind==='ring'){if(active){const radius=(f.age-f.warning)*f.speed;c.beginPath();c.ellipse(f.x,f.y,Math.max(1,radius),f.ry||24,0,0,Math.PI*2);c.stroke();for(const dir of [-1,1])atlasObject(c,0,2,f.x+dir*radius,f.y+8,22,18);}}
  else if(['bladeEcho','beam','ropeOrbit'].includes(f.kind)){c.lineWidth=active?(f.radius||5)*2:2;c.beginPath();c.moveTo(f.ax,f.ay);const clip=['beam','ropeOrbit'].includes(f.kind)?projectileWallTime(g,{radius:1},f.ax,f.ay,f.bx,f.by):1,bx=f.ax+(f.bx-f.ax)*clip,by=f.ay+(f.by-f.ay)*clip;c.lineTo(bx,by);c.stroke();if(f.kind==='ropeOrbit')atlasObject(c,3,1,bx,by+10,24,24);if(f.kind==='beam'&&!active&&f.scan){c.globalAlpha=.2;for(const angle of [f.scan.from,f.scan.to]){c.beginPath();c.moveTo(f.ax,f.ay);c.lineTo(f.ax+Math.cos(angle)*f.scan.length,f.ay+Math.sin(angle)*f.scan.length);c.stroke();}}if(f.kind==='bladeEcho'){if(f.ghost){c.save();c.globalAlpha=active?.7:.3;drawBoss(c,{...g.world.boss,x:f.ghost.x,y:f.ghost.y,dir:f.ghost.dir,dead:false,state:'attack',pattern:'leftAttack',t:.2,poseRow:f.ghost.row,poseCol:f.ghost.col,stagger:0,hit:0});c.restore();}c.globalAlpha=.5;atlasObject(c,3,0,(f.ax+f.bx)/2,(f.ay+f.by)/2+8,34,16);}}
  else if(f.kind==='flood'){c.globalAlpha=.35;c.fillRect(f.x,f.y,f.w,f.h);c.globalAlpha=.85;for(let x=f.x;x<f.x+f.w;x+=64)atlasObject(c,0,3,x+32,f.y+9,66,18);}
  else{c.strokeRect(f.x,f.y,f.w,f.h);if(active){c.globalAlpha=f.kind==='light'?.23:.18;c.fillRect(f.x,f.y,f.w,f.h);c.globalAlpha=.9;
   if(['crack','metal','embers','lava'].includes(f.kind))for(let x=f.x+20;x<f.x+f.w;x+=42)atlasObject(c,f.kind==='crack'?3:5,2,x,f.y+f.h,44,18);
   if(f.kind==='future')atlasObject(c,3,0,f.x+f.w/2,f.y+30,28,28);
   if(f.kind==='silence'){c.beginPath();c.ellipse(f.x+f.w/2,f.y+6,f.w/2,9,0,0,Math.PI*2);c.stroke();}
  }else{const progress=clamp(f.age/Math.max(.01,f.warning),0,1);c.fillRect(f.x,f.y+f.h-2,f.w*progress,2);}}
  c.restore();
 }
}
export function renderClones(r){const c=r.c,g=r.g;for(const e of g.arenaClones||[]){c.save();c.globalAlpha=.65;c.translate(Math.round(e.x),Math.round(e.y));c.scale(.65,.65);const fake={...g.world.boss,x:0,y:0,dir:e.dir,dead:false,state:e.warned&&!e.struck?'windup':e.struck?'attack':'idle',pattern:'leftAttack',t:e.t<2.3?.9:.2,stagger:0,hit:0,phase:2,poseRow:2,poseCol:e.struck?4:2};drawBoss(c,fake);c.restore();c.fillStyle='#95cbc7';for(let i=0;i<e.hp;i++)c.fillRect(e.x-9+i*7,e.y-80,4,2);}}
