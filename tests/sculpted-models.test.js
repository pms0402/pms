import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {sculptedGeometry,buildSculptedMonster,SCULPTED_ASSETS} from '../src/sculpted-models.js';
import {tagMotionGeometry,deformReference} from '../src/monster-motion.js';

function fixture(){return{ownedGeometries:new Set(),mats:Object.fromEntries(['enemyDark','bone','eye','bossGlow','rangedGlow','healGlow','trunk'].map(id=>[id,new THREE.MeshStandardMaterial()]))};}
test('all authored actors and environments have finite closed mesh data, valid indices and unit normals',()=>{
  const g=fixture();
  for(const id of SCULPTED_ASSETS){
    const a=sculptedGeometry(g,id),p=a.attributes.position,n=a.attributes.normal;
    assert.ok(p.count>20&&a.index.count>100,id);
    assert.ok([...p.array,...n.array,...a.attributes.uv.array].every(Number.isFinite),id);
    for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.001,id);
    for(const index of a.index.array)assert.ok(index<p.count,id);
    assert.ok(a.boundingSphere.radius>0,id);
  }
});
test('ten monster designs reuse bind geometry and preserve meaningful independent joint tags',()=>{
  const g=fixture(),skin=new THREE.MeshStandardMaterial(),shapes=new Set();
  for(let kind=0;kind<10;kind++){
    const a=new THREE.Group(),b=new THREE.Group();assert.ok(buildSculptedMonster(g,a,kind,skin));
    const allocated=g.ownedGeometries.size;buildSculptedMonster(g,b,kind,skin);assert.equal(g.ownedGeometries.size,allocated);
    assert.ok(a.children.length>=3);
    for(let i=0;i<a.children.length;i++){assert.equal(a.children[i].geometry,b.children[i].geometry);assert.ok(Number.isInteger(a.children[i].userData.rigJoint));}
    if(kind!==7)assert.ok(new Set(a.children.map(m=>m.userData.rigJoint)).size>=3);
    shapes.add(a.children.map(m=>m.geometry.attributes.position.count).join('/'));
  }
  assert.equal(shapes.size,10);
});
test('six boss silhouettes have different geometry and bounded triangles, not scaled copies of the grunt',()=>{
  const g=fixture(),skin=new THREE.MeshStandardMaterial(),shapes=new Set();
  for(const id of ['warden','artillery','plague','brood','storm','reaper']){
    const a=new THREE.Group();assert.ok(buildSculptedMonster(g,a,4,skin,'boss_'+id));
    const triangles=a.children.reduce((n,m)=>n+m.geometry.index.count/3,0);
    assert.ok(triangles>1000&&triangles<20000,`${id}: ${triangles}`);
    shapes.add(a.children.map(m=>m.geometry.attributes.position.count).join('/'));
  }
  assert.equal(shapes.size,6);
});
test('regional landmarks and weapon silhouettes differ in shape while sharing decoded geometry',()=>{
  const g=fixture();
  for(const ids of [['world_basalt','world_ice','world_tree','world_ruin','world_voidarch'],['weapon_longsword','weapon_cleaver','weapon_saber']]){
    const shapes=ids.map(id=>{const a=sculptedGeometry(g,id);assert.equal(a,sculptedGeometry(g,id));return Array.from(a.attributes.position.array).join(',');});
    assert.equal(new Set(shapes).size,ids.length);
  }
});
test('the new brood boss articulates all six legs around their authored body attachments',()=>{
  const g=fixture(),root=new THREE.Group();buildSculptedMonster(g,root,4,new THREE.MeshStandardMaterial(),'boss_brood');
  const legs=root.children.filter(m=>m.userData.rigJoint>=2&&m.userData.rigJoint<=7);
  assert.equal(legs.length,6);assert.equal(new Set(legs.map(m=>m.userData.rigJoint)).size,6);
  for(const leg of legs){
    const pivot=leg.userData.rigPivot;assert.ok(pivot?.length===3);
    const geometry=tagMotionGeometry(leg.geometry.clone(),4,leg.userData.rigJoint,pivot),posed=geometry.clone();
    for(let i=0;i<3;i++)assert.ok(Math.abs(geometry.attributes.vrPivot.array[i]-pivot[i])<1e-6);
    deformReference(geometry,posed,new Float32Array([1,1,0,0,0,0,0,0]));
    assert.ok(posed.attributes.position.array.some((v,i)=>Math.abs(v-geometry.attributes.position.array[i])>1e-4));
  }
});
