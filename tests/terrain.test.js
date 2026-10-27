import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_RADIUS,HILLS,STRUCTURES,WORLD_COLLIDERS,terrainHeight,isWalkable,resolveTerrainMovement,steerAroundWalls} from '../src/terrain.js';
test('terrain provides a flat safe start and nine substantial climbable hills',()=>{
 assert.equal(WORLD_RADIUS,90);assert.equal(HILLS.length,9);assert.equal(terrainHeight(0,0),0);assert.equal(terrainHeight(8,0),0);
 for(const h of HILLS){assert.ok(terrainHeight(h.x,h.z)>3);for(let i=0;i<15;i++){const x=h.x+i*.15,z=h.z+i*.1;assert.ok(Math.abs(terrainHeight(x+.1,z)-terrainHeight(x,z))<.2);}}
});
test('ruins have usable doors while walls and towers block actors',()=>{
 assert.equal(STRUCTURES.length,9);
 for(const s of STRUCTURES){
  if(s.type==='tower'){assert.equal(isWalkable(s.x,s.z),false);continue;}
  assert.ok(isWalkable(s.x,s.z+s.depth/2,.65),'center doorway remains open');
  const wall=WORLD_COLLIDERS.find(c=>c.id===s.id);const p={x:wall.x,z:wall.z,y:0};resolveTerrainMovement(p,.65);assert.ok(isWalkable(p.x,p.z,.649));assert.equal(p.y,terrainHeight(p.x,p.z));
 }
});
test('collision resolution preserves a grounded point inside the enlarged boundary',()=>{
 const p={x:200,y:100,z:120};resolveTerrainMovement(p,.65);assert.ok(Math.hypot(p.x,p.z)<=89.35001);assert.equal(p.y,terrainHeight(p.x,p.z));
});
test('steering provides a walkable detour instead of walking through a wall',()=>{
 const p={x:21.4,z:26};const d=steerAroundWalls(p,1,0,.5,1);assert.ok(Math.abs(d.z)>.1);assert.ok(isWalkable(p.x+d.x,p.z+d.z,.5));
});
