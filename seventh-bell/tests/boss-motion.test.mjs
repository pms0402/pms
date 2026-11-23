import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {BOSS_DEFS,PATTERNS} from '../src/bosses.js';
import {BOSS_MOTION,bossPose,bossWindup,bossImpactAt,bossRecovery,BOSS_RECOVER_STEP} from '../src/boss-motion.js';

function scene(id='edran'){const g=new Game();g.start();g.world.enemies=[];g.world.traps=[];const e=g.world.bosses.find(e=>e.id===id);g.world.boss=e;g.bossActive=true;Object.assign(g.p,{x:e.x-150,y:302,vx:0,vy:0,invulnerable:0,dir:1});return{g,e};}
test('every real boss pattern has its own preparation and strike row, including the second swing',()=>{
 let count=0;
 for(const[id,m]of Object.entries(BOSS_MOTION)){const{e}=scene(id),rows=new Set();for(const pattern of new Set(BOSS_DEFS[id].patterns.flat())){
  assert.ok(Object.hasOwn(m.rows,pattern));e.pattern=pattern;e.second=false;e.stagger=0;
  const cells=new Set(),sizes=new Set();for(const[state,t]of [['windup',.1],['windup',bossWindup(e)*.4],['windup',bossWindup(e)*.9],['attack',PATTERNS[pattern].active*.25],['attack',PATTERNS[pattern].active*.75],['recover',.2]]){e.state=state;e.t=t;const pose=bossPose(e);assert.equal(pose.sheet,id+'-motion');cells.add(pose.col);sizes.add(pose.size);}
  assert.equal(cells.size,6);assert.equal(sizes.size,1);rows.add(bossPose(e).row);count++;
  if(PATTERNS[pattern].twice){const first=bossPose(e).row;e.second=true;assert.notEqual(bossPose(e).row,first);assert.equal(bossWindup(e),PATTERNS[pattern].secondWindup||.85);}
 }assert.equal(rows.size,Object.keys(m.rows).length);}
 assert.equal(count,Object.keys(PATTERNS).length);
});
test('ordinary damage preserves an approaching boss and a committed attack instead of knocking it down',()=>{
 for(const id of Object.keys(BOSS_DEFS))for(const state of ['idle','windup','attack','recover']){const{g,e}=scene(id);Object.assign(e,{state,pattern:BOSS_DEFS[id].patterns[0][0],t:state==='recover'?.6:.1,vx:-20,walk:20,stagger:0});const before=bossPose(e),t=e.t,y=e.y;g.damageEnemy(e,7,1,230,'light3');assert.equal(e.state,state);assert.equal(e.t,t);assert.equal(e.stagger,0);assert.equal(e.vx,-20);assert.equal(e.y,y);assert.equal(e.dead,false);assert.deepEqual(bossPose(e),before);assert.ok(e.hit>0);}
});
test('bosses walk during their approach and later recovery while the full attack opening remains',()=>{
 for(const id of Object.keys(BOSS_DEFS)){const{g,e}=scene(id);e.cooldown=10;const x=e.x;g.updateBoss(.1);assert.ok(e.x<x);assert.equal(bossPose(e).role,'walk');
  Object.assign(e,{state:'recover',pattern:BOSS_DEFS[id].patterns[0][0],t:0,vx:0});const at=e.x;g.updateBoss(.1);assert.equal(e.x,at);assert.equal(bossPose(e).role,'recover');g.updateBoss(BOSS_RECOVER_STEP);assert.ok(e.x<at);assert.equal(e.state,'recover');assert.equal(bossPose(e).role,'walk');assert.ok(e.t<bossRecovery(e));
  g.p.x=e.x-30;g.updateBoss(.01);assert.equal(e.vx,0);assert.equal(bossPose(e).role,'guard');
 }
});
test('melee damage and ground waves wait for the actual contact drawing and release only once',()=>{
 for(const[id,pattern]of [['edran','sweep'],['edran','slam'],['brag','hammer'],['leonel','footnote'],['arkein','royalFall']]){const{g,e}=scene(id),spec=PATTERNS[pattern];Object.assign(e,{state:'attack',pattern,t:0,dir:-1,didHit:false,released:false});g.p.x=e.x-40;
  const contact=bossImpactAt(pattern);g.updateBoss(contact-.001);assert.equal(g.p.hp,100);assert.equal(g.projectiles.length,0);g.updateBoss(.002);assert.equal(g.p.hp,100-spec.damage);assert.equal(bossPose(e).col,spec.wave?4:3);const count=g.projectiles.length;assert.equal(count,spec.wave?2:0);g.p.invulnerable=0;g.updateBoss(.02);assert.equal(g.p.hp,100-spec.damage);assert.equal(g.projectiles.length,count);
 }
});
test('book and voice casts keep their original finite projectiles but release with the extended-hand pose',()=>{
 for(const[id,pattern]of [['marie','choir'],['leonel','folio']]){const{g,e}=scene(id);Object.assign(e,{state:'attack',pattern,t:0,dir:-1,released:false});const contact=bossImpactAt(pattern);g.updateBoss(contact-.001);assert.equal(g.projectiles.length,0);g.updateBoss(.002);assert.equal(g.projectiles.length,1);assert.equal(bossPose(e).role,'strike');assert.equal(g.projectiles[0].owner,id);assert.ok(g.projectiles[0].range<=380);g.updateBoss(.02);assert.equal(g.projectiles.length,1);}
});
test('a real parry leaves the boss standing, still grants a paid counter and then returns to approach',()=>{
 for(const id of Object.keys(BOSS_DEFS)){const{g,e}=scene(id);const pattern=BOSS_DEFS[id].patterns[0][0];Object.assign(e,{state:'attack',pattern,t:bossImpactAt(pattern)-.01,dir:-1});g.p.x=e.x-45;g.parry();g.p.action.t=.08;const y=e.y,hp=g.p.hp;g.updateBoss(.02);assert.equal(g.p.hp,hp);assert.equal(e.state,'recover');assert.equal(e.stagger,1.35);assert.equal(bossPose(e).role,'parry');assert.equal(e.y,y);assert.equal(e.dead,false);assert.ok(g.p.counterReady>0);assert.ok(g.press('attack'));assert.equal(g.p.action.kind,'counter');assert.equal(g.projectiles.filter(q=>q.owner===id).length,0);for(let i=0;i<110;i++)g.update(1/120);assert.ok(e.hp<e.maxHp,'the parry counter must actually land');g.p.x=e.x-250;g.updateBoss(1.4);g.updateBoss(.01);assert.equal(e.stagger,0);assert.equal(e.y,y);assert.equal(bossPose(e).role,'walk');}
});
test('stabilization and death retain their separate story poses instead of being ordinary reactions',()=>{
 for(const id of Object.keys(BOSS_DEFS)){const{e}=scene(id);for(const state of ['weakened','transition']){e.state=state;assert.equal(bossPose(e),null);}e.state='recover';e.dead=true;assert.equal(bossPose(e),null);}
});
test('parrying a blow cancels its own shockwave without clearing older or friendly projectiles',()=>{
 const{g,e}=scene('brag');e.attackSerial=7;Object.assign(e,{state:'attack',pattern:'hammer',t:bossImpactAt('hammer')-.001,dir:-1});g.p.x=e.x-45;
 g.spawnShot(e.x+150,200,100,0,8,e.id);g.projectiles[0].attackSerial=6;
 g.projectiles.push({friendly:true,owner:'player',attackSerial:7});
 g.parry();g.p.action.t=.08;g.updateBoss(.002);assert.equal(e.stagger,1.35);assert.equal(g.projectiles.length,2);assert.ok(g.projectiles.some(q=>q.owner===e.id&&q.attackSerial===6));assert.ok(g.projectiles.some(q=>q.friendly));assert.equal(g.projectiles.some(q=>q.owner===e.id&&q.attackSerial===7),false);
});
