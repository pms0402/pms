import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TerrainLayout,TerrainNavigation} from '../src/terrain-layout.js';
import {ExplorableTerrain} from '../src/explorable-terrain.js';
import {STRUCTURES} from '../src/terrain.js';
import {volumeEntry,combatLineClear,projectileTarget,swordHeightHit,clipAimPoint} from '../src/combat-collision.js';

test('every regional layout and all three variants have reachable exploration anchors and legacy landmarks',()=>{
 for(const region of ['sanctum','volcano','tundra','forest','ruins','void','throne'])for(let v=0;v<3;v++){
  const l=new TerrainLayout(region,v),n=new TerrainNavigation(l);
  for(const a of l.anchors){const id=n.nearest(a,true);assert.ok(id>=0,region+v+': '+a.id);assert.ok(n.reachable[id]);assert.ok(Math.hypot(n.nodes[id].x-a.x,n.nodes[id].z-a.z)<3.5,region+v+': '+a.id+' position');assert.ok(Math.abs(n.nodes[id].y-a.y)<.7,region+v+': '+a.id+' layer');}
  for(const s of STRUCTURES){const p=n.project({x:s.x,z:s.z-s.depth/2-3,y:l.ground(s.x,s.z)});assert.ok(n.reachable[n.nearest(p)]);}
  const goal=l.anchors.find(a=>['crossing','root-canopy','upper-citadel','floating-island:0'].includes(a.id));
  let p={x:0,y:0,z:0},steps=0;for(;steps<1400;steps++){if(Math.hypot(p.x-goal.x,p.z-goal.z)<.55&&Math.abs(p.y-goal.y)<.7)break;const d=n.steer(p,goal);p=l.traverse(p,{x:p.x+d.x*.125,z:p.z+d.z*.125},.65,3.6).point;}assert.ok(steps<1400,region+v+' actual capsule follows flow across stairs');
  assert.ok(n.nodes.length<10000,'bounded layered grid');
 }
});
test('same X/Z supports cave floor and roof without snapping, falling or ceiling penetration',()=>{
 const l=new TerrainLayout('tundra',1),floor=l.anchors.find(a=>a.id==='underground'),top=l.anchors.find(a=>a.id==='cave-upper');
 assert.ok(top.y-floor.y>5.5);
 assert.equal(l.support(-40,0,floor.y,.6,3.6).y,floor.y);
 assert.equal(l.support(-40,0,top.y,.6,3.6).y,top.y);
 assert.equal(l.canStand(-40,0,floor.y,.6,7.5),false,'large boss cannot enter a low cave');
 const a={x:29,y:l.height(29,0),z:0},fall=l.traverse(a,{x:29,z:-8},.65,3.6);assert.equal(fall.clear,false,'no stepping off the bridge');assert.ok(Math.abs(fall.point.y-a.y)<.7);
 const seal=l.breakables[0];assert.equal(l.traverse({x:-40,z:0,y:floor.y},{x:-32,z:0},.6,3.6).clear,false);
 assert.ok(l.damage(seal.id,100));assert.ok(seal.disabled);assert.ok(l.traverse({x:-40,z:0,y:floor.y},{x:-32,z:0},.6,3.6).clear,'destroyed wall opens a real corridor');
});
test('walls and slabs block rays only on their actual vertical interval',()=>{
 const slab={type:'rect',x:0,z:0,hx:5,hz:5,minY:5,maxY:5.5};
 assert.equal(volumeEntry({x:-8,y:2,z:0},{x:8,y:2,z:0},slab),Infinity);
 assert.ok(volumeEntry({x:0,y:1,z:0},{x:0,y:9,z:0},slab)<1);
 const game={world:{colliders:[slab]},groundHeight:()=>0};
 assert.ok(combatLineClear(game,new THREE.Vector3(-8,0,0),new THREE.Vector3(8,0,0)));
 assert.equal(combatLineClear(game,new THREE.Vector3(0,0,0),new THREE.Vector3(0,7,0)),false);
 const stop=projectileTarget(game,new THREE.Vector3(0,2,0),new THREE.Vector3(0,8,0));assert.ok(stop.y<5&&stop.y>4.8);
 const enemy={kind:0,size:1,group:{position:new THREE.Vector3(0,6,0)}};assert.equal(swordHeightHit(new THREE.Vector3(),enemy),false);
});
test('bridge winch opens only its optional route and mutation invalidates the flow field',()=>{
 const l=new TerrainLayout('volcano',0),bridge=l.surfaces.find(s=>s.id==='secret-bridge');assert.equal(l.active(bridge),false);
 const revision=l.revision;assert.ok(l.use('bridge-lever'));assert.equal(l.active(bridge),true);assert.equal(l.revision,revision+1);assert.equal(l.use('bridge-lever'),null);
 const n=new TerrainNavigation(l);for(const a of l.anchors)assert.ok(n.reachable[n.nearest(a,true)]);
});

test('aim placement uses target floor height before clipping raised foundations',()=>{
 const g={world:{colliders:[{type:'rect',x:3,z:0,hx:.4,hz:6,minY:3.8,maxY:12}]},groundHeight:x=>x>=3?6:3};
 const end=clipAimPoint(g,new THREE.Vector3(0,3,0),new THREE.Vector3(6,0,0));assert.ok(end.x<2.6);assert.equal(end.y,3);
 const voidMap=new TerrainLayout('void');assert.ok(voidMap.reserved(40,-40),'legacy ground decorations hidden over abyss');
});

test('ground-directed spell placement cannot skip over a high ridge',()=>{
 const height=(x)=>x>2&&x<4?5:0,g={world:{colliders:[],topology:{layout:{ground:height}}},groundHeight:height};
 const target=clipAimPoint(g,new THREE.Vector3(0,0,0),new THREE.Vector3(6,0,0));assert.ok(target.x<2.1);assert.equal(target.y,0);
});

test('explicit relocation between floors is respected even at nearby X/Z',()=>{
 const p=new THREE.Vector3(-38,-5.7,1),g={history:new WeakMap(),enabled:()=>true,project:point=>{g.projected=true;return point;},layout:{traverse:(from,to)=>({clear:true,point:{...to,y:from.y}})}};
 g.history.set(p,{x:-38,y:.3,z:6});ExplorableTerrain.prototype.resolve.call(g,p,.6);assert.ok(g.projected);assert.equal(p.y,-5.7);
 g.projected=false;p.y=.3;g.history.set(p,{x:-38,y:.3,z:1});p.z=1.1;ExplorableTerrain.prototype.resolve.call(g,p,.6);assert.equal(g.projected,false);assert.equal(p.y,.3);
});
