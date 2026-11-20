import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {ATTACKS} from '../src/data.js';
import {STEEL,steelRig} from '../src/cuts.js';
import {registeredPose,sweptBlades,bladeTouches} from '../src/blade.js';
import {ribbonEdges} from '../src/afterimages.js';
import {enemy} from '../src/world.js';

const tick=(g,t)=>{for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120);};
function scene(distance){const g=new Game();g.start();g.world.traps=[];const e=enemy('e90','watchman',g.p.x+distance,302);e.hp=e.maxHp=300;g.world.enemies=[e];g.updateEnemy=()=>{};return{g,e};}
const at=degrees=>{const a=degrees*Math.PI/180;return{ax:0,ay:0,bx:Math.cos(a)*48,by:Math.sin(a)*48};};

test('a broad rotating cut reaches its outer edge without shrinking into a chord',()=>{
 for(const mirror of [1,-1]){const a=at(-80),b=at(80);a.bx*=mirror;b.bx*=mirror;const path=sweptBlades(a,b),outer={x:mirror>0?45:-49,y:-3,w:4,h:6};assert.ok(path.some(p=>bladeTouches(p,outer)));assert.ok(path.every(p=>Math.abs(Math.hypot(p.bx-p.ax,p.by-p.ay)-48)<1e-8));assert.ok(path.length>40);assert.equal(path.some(p=>bladeTouches(p,{x:mirror*80,y:-3,w:3,h:6})),false);}
});
test('visible crescent and damaging blade sweep share samples, including ground clearance',()=>{
 const a={...at(170),floor:10},b={...at(10),floor:10},path=sweptBlades(a,b),ribbon=ribbonEdges(a,b);assert.equal(path.length,ribbon.outer.length);for(let i=0;i<path.length;i++){assert.deepEqual(ribbon.outer[i],{x:path[i].bx,y:path[i].by});assert.ok(path[i].by<=10.000001);assert.ok(Math.abs(Math.hypot(path[i].bx-path[i].ax,path[i].by-path[i].ay)-48)<1e-8);}
});
test('the new basic swing actually hits farther, while distant, rear and walled targets stay safe',()=>{
 for(const distance of [65,80,115,-100]){const{g,e}=scene(distance);g.press('attack');tick(g,1);assert.equal(e.hp,[65,80].includes(distance)?282:300);assert.equal(g.lastHits.length,[65,80].includes(distance)?1:0);}
 const{g,e}=scene(80);g.world.platforms.push({x:g.p.x+40,y:170,w:10,h:132});g.press('attack');tick(g,1);assert.equal(e.hp,300);
});
test('thrust visibly chambers behind the hip before a straight, full-arm extension',()=>{
 const{g,e}=scene(65);g.dash();g.press('attack');tick(g,ATTACKS.thrust.windup*.88);const loaded=registeredPose(g.p),rear=steelRig(g.p,loaded);assert.equal(loaded.sheet,'cut-thrust');assert.equal(loaded.frame,3);assert.equal(loaded.bladeBehind,true);assert.ok(rear.handX<g.p.x-10);assert.equal(e.hp,300);assert.equal(g.bladeEchoes.length,0);assert.equal(g.p.stamina,68);
 for(let i=0;i<40&&g.p.action.t<ATTACKS.thrust.windup;i++)g.update(1/120);const extended=registeredPose(g.p),front=steelRig(g.p,extended);assert.equal(extended.frame,4);assert.ok(front.handX>g.p.x+15);assert.equal(front.by,front.ay);assert.equal(extended.bladeBehind,false);tick(g,1);assert.equal(e.hp,274);assert.equal(g.lastHits.length,1);
});
test('large cuts preserve rigid steel length and floor-safe poses after body registration',()=>{
 const{g}=scene(80);for(const kind of ['light1','upper','light3','heavy','thrust'])for(const t of [0,ATTACKS[kind].windup*.9,ATTACKS[kind].windup,ATTACKS[kind].end-.001,ATTACKS[kind].duration-.001]){g.p.action={kind,spec:ATTACKS[kind],t,air:false};const pose=registeredPose(g.p),b=steelRig(g.p,pose);assert.equal(STEEL.length,48);assert.ok(Math.abs(Math.hypot(b.bx-b.ax,b.by-b.ay)-48)<1e-8);assert.ok(b.by<=g.p.y-1.49);}
 g.p.action=null;const ready=steelRig(g.p,registeredPose(g.p));assert.ok(ready.by<g.p.y-1.5);
});
