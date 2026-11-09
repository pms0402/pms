import test from 'node:test';
import assert from 'node:assert/strict';
import {BossArenaLayout,BOSS_ARENAS} from '../src/boss-arena-layout.js';
import {TerrainNavigation} from '../src/terrain-layout.js';
import {volumeEntry,bodyHeight,swordHeightHit} from '../src/combat-collision.js';
import {BossArenaSystem} from '../src/boss-arena.js';
import {bossJointOffset,BOSS_STYLES} from '../src/boss-joints.js';
import {jointAngles} from '../src/monster-motion.js';
import {SOUND_PROFILES} from '../src/soundscape.js';
import {RegionSystem} from '../src/region-system.js';

test('optional boss arena hooks safely fall back in the training and original room contexts',()=>{const arena=new BossArenaSystem({});assert.equal(arena.minionPosition(0),null);assert.equal(arena.blinkTarget(),null);assert.equal(arena.state(),null);assert.equal(arena.close(),undefined);});
test('hidden boss hit height follows the authored model instead of an unscaled generic body',()=>{const boss={kind:4,size:3,hurtHeight:6,group:{scale:{y:1},position:{x:0,y:0,z:0}}};assert.equal(bodyHeight(boss),6);assert.ok(swordHeightHit({y:3},boss));assert.equal(swordHeightHit({y:7},boss),false);});
test('arena status ticks expire frost and apply residual poison without creating outdoor hazards',()=>{let hits=0;const state={slowRemaining:.9,poisonRemaining:1,poisonTick:.05,game:{player:{position:{x:0,y:0,z:0}}},hurt:()=>hits++};RegionSystem.prototype.updateStatuses.call(state,.1);assert.ok(Math.abs(state.slowRemaining-.8)<1e-6&&Math.abs(state.poisonRemaining-.9)<1e-6);assert.equal(hits,1);RegionSystem.prototype.updateStatuses.call(state,1);assert.equal(state.slowRemaining,0);assert.equal(state.poisonRemaining,0);});

for(const id of Object.keys(BOSS_ARENAS))test(id+' arena: every terrace remains connected for player and boss in all phases',()=>{
  const l=new BossArenaLayout(id),floors=structuredClone(l.surfaces);
  for(const phase of [1,2,3]){
    l.advance(phase);
    for(const [radius,height] of [[.8,3.6],[1.4,7.5]]){
      const nav=new TerrainNavigation(l,{radius,height});
      for(const a of l.anchors){const node=nav.nearest(a);assert.ok(node>=0&&nav.reachable[node],`${id} phase ${phase}: ${a.id} radius ${radius}`);assert.ok(Math.abs(nav.nodes[node].y-a.y)<.7,'reachable at the actual requested floor');}
      for(const a of l.rifts){const n=nav.nearest(a);assert.ok(nav.reachable[n],'rift endpoint reachable without teleport');}
    }
    assert.deepEqual(l.surfaces,floors,'phase changes never remove the sole supporting floor');
  }
  assert.equal(l.canStand(31,0,0),false);assert.equal(l.legacySolids.length,0);
});
test('cover blocks real swept projectiles until its second boss impact, then opens collision exactly once',()=>{
  const l=new BossArenaLayout('artillery'),c=l.breakables.find(s=>s.cover),a={x:c.x,y:1,z:c.z-4},b={...a,z:c.z+4};
  assert.ok(volumeEntry(a,b,c)<1);l.bossImpact(c.id);assert.equal(c.disabled,undefined);assert.ok(l.walls().includes(c));
  const revision=l.revision;l.bossImpact(c.id);assert.equal(c.disabled,true);assert.equal(l.revision,revision+1);assert.ok(!l.walls().includes(c));assert.equal(l.bossImpact(c.id),null);assert.equal(l.revision,revision+1);
});
test('phase removal is monotonic, opens physical routes and keeps the central dodge court clear',()=>{
  for(const id of Object.keys(BOSS_ARENAS)){
    const l=new BossArenaLayout(id),before=l.solids.length;assert.equal(l.advance(1).length,0);l.advance(3);assert.equal(l.phase,3);assert.equal(l.advance(2).length,0);assert.equal(l.solids.length,before);
    for(const s of l.breakables)if(s.phaseRemove)assert.equal(s.disabled,true);
    for(const [x,z] of [[0,0],[3,0],[-3,0],[0,3]])assert.ok(l.support(x,z,undefined,.65),'central escape corridor');
  }
});
test('rift routing uses phase-active endpoints and always offers a distinct distant destination',()=>{
  const l=new BossArenaLayout('reaper');assert.equal(l.rifts.filter(r=>r.phase<=l.phase).length,2);
  const first=l.rifts[0],next=l.riftTarget(first);assert.notEqual(next.id,first.id);assert.ok(Math.hypot(first.x-next.x,first.z-next.z)>20);
  l.advance(3);assert.equal(l.rifts.filter(r=>r.phase<=l.phase).length,4);
});
test('boss poses articulate distinct shoulders, torso and legs with bounded finite rotations in every phase',()=>{
  const signatures=new Set(),p=new Float32Array(16),out=new Float32Array(3);p[0]=.7;p[1]=.5;p[2]=.6;p[3]=.8;p[4]=.3;p[15]=1;
  for(const style of Object.values(BOSS_STYLES)){
    p[12]=style;const pose=[];
    for(const phase of [1,2,3]){p[5]=phase;for(let j=0;j<=8;j++){bossJointOffset(j,p,out);pose.push(...out);jointAngles(4,j,p,out);assert.ok([...out].every(v=>Number.isFinite(v)&&Math.abs(v)<2.8));}}
    signatures.add(pose.map(v=>v.toFixed(3)).join(','));
  }
  assert.equal(signatures.size,9);
});
test('boss attack, collapse, phase and victory sounds have distinct bounded procedural profiles',()=>{
  const names=['boss-enter','boss-phase','boss-victory','arena-collapse','boss-stone','boss-cannon','boss-venom','boss-summon','boss-thunder','boss-rift','boss-abyss'];
  assert.equal(new Set(names.map(n=>JSON.stringify(SOUND_PROFILES[n]))).size,names.length);
  for(const n of names){const p=SOUND_PROFILES[n];assert.ok(p[2]<=.8&&p[6]>=.25&&p[3]<=.15);}
});
