import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {body,overlaps,solids} from '../src/world.js';
import {updateEncounters} from '../src/encounters.js';
import {pacifyEnemy,canBeginEnemyAttack,safeSpawn} from '../src/sanctuary.js';
import {SPECIES,nativeEnemyPose} from '../src/enemy-species.js';
import {advanceCreatureGait} from '../src/creature-motion.js';
import {BOSS_MOTION,bossPose} from '../src/boss-motion.js';

test('every authored enemy starts on a usable floor, clear of closed doors and route walls',()=>{
 const g=new Game();for(const e of g.world.enemies){g.resetPlayer(e);assert.ok(safeSpawn(g.world,e),e.id);assert.ok(!solids(g).some(q=>!q.oneway&&overlaps(body(e),q)),e.id+' embedded in active geometry');assert.ok(![...g.world.gates,...g.world.routeWalls].some(q=>overlaps(body(e),q)),e.id+' on a door that can close');}
});
test('more than seven close enemies keep their physics and reaction timers while attack starts remain limited',()=>{
 const g=new Game(),template=g.world.enemies.find(e=>e.type==='patrol');g.world.sanctuaries=[];g.world.gates=[];g.world.routeWalls=[];g.world.movers=[];g.world.waterPlatforms=[];g.world.platforms=[{x:0,y:302,w:3000,h:1000}];g.resetPlayer({x:1600,y:302});
 g.world.enemies=Array.from({length:12},(_,i)=>({...template,id:'crowd-'+i,x:1250+i*28,homeX:1250+i*28,y:290,homeY:302,vx:0,vy:0,cooldown:10,stagger:.1,state:'idle'}));
 for(let i=0;i<60;i++)updateEncounters(g,1/120);
 assert.equal(g.activeEnemies,12);for(const e of g.world.enemies){assert.ok(e.cooldown<9.6,e.id+' frozen timer');assert.equal(e.stagger,0);assert.equal(e.y,302,e.id+' frozen gravity');}
 for(const e of g.world.enemies.slice(0,2))e.state='windup';assert.equal(canBeginEnemyAttack(g,g.world.enemies[11]),false);
});
test('ordinary enemies returning home while the player rests cannot walk into a closed gate',()=>{
 const g=new Game();g.world.sanctuaries=[{x:0,y:0,w:560,h:500}];g.world.platforms=[{x:0,y:302,w:2000,h:1000}];g.world.routeWalls=[];g.world.movers=[];g.world.waterPlatforms=[];g.world.gates=[{id:'mechanism',x:800,y:100,w:32,h:202}];g.resetPlayer({x:300,y:302});const e={...g.world.enemies[0],x:750,homeX:900,y:302,homeY:302,vx:0,vy:0,grounded:true};
 for(let n=0;n<360;n++){assert.ok(pacifyEnemy(g,e,1/120));assert.ok(!overlaps(body(e),g.world.gates[0]));}assert.ok(e.x<=800-e.w/2);
});
test('hit reactions expire even when the player returns to sanctuary',()=>{
 const g=new Game(),e=g.world.enemies.find(e=>e.type==='patrol');g.resetPlayer({x:145,y:302});Object.assign(e,{hit:.13,stagger:.4});for(let n=0;n<72;n++)g.updateEnemy(e,1/120);assert.equal(e.hit,0);assert.equal(e.stagger,0);
});
test('all 21 species use 24 actual movement poses; moving shield users never freeze in a guard drawing',()=>{
 const g=new Game();for(const d of Object.values(SPECIES)){const e={...g.world.enemies.find(e=>e.type===d.id),state:'idle',stagger:0,shielding:true,vx:30,dead:false},cells=new Set();for(let n=0;n<24;n++){e.gaitPhase=n/24;const p=nativeEnemyPose(e);assert.equal(p.gait,true);assert.equal(p.frame,n);cells.add(p.row+':'+p.col);}assert.equal(cells.size,24,d.id);}
});
test('seven bosses and both discarded-equipment phases have 24 distance-driven walk drawings',()=>{
 const g=new Game();for(const e of g.world.bosses)for(const phase of [1,2]){Object.assign(e,{phase,state:'idle',vx:30,stagger:0});const cells=new Set();for(let n=0;n<24;n++){e.gaitPhase=n/24;const p=bossPose(e);assert.equal(p.sheet,e.id+'-gait');if(['edran','arkein'].includes(e.id))assert.equal(Math.floor(p.row/4),phase-1);cells.add(p.row+':'+p.col);}assert.equal(cells.size,24);}
});
test('stride phase follows distance, closes its loop and settles at a planted foot without resetting on a turn',()=>{
 const a={walk:0},b={walk:0};for(let n=0;n<60;n++)advanceCreatureGait(a,1/60,44/60);for(let n=0;n<120;n++)advanceCreatureGait(b,1/120,-44/120);assert.ok(Math.min(a.gaitPhase,1-a.gaitPhase)<1e-8);assert.ok(Math.min(b.gaitPhase,1-b.gaitPhase)<1e-8);a.gaitPhase=.31;advanceCreatureGait(a,.05,0);assert.ok(a.gaitPhase>.31&&a.gaitPhase<.5);for(let n=0;n<30;n++)advanceCreatureGait(a,1/120,0);assert.equal(a.gaitPhase,.5);assert.equal(a.gaitSettling,false);
 const flying={flying:true};advanceCreatureGait(flying,.25,0,44,1);assert.equal(flying.gaitPhase,.25);
});
