import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {EnemyRenderer} from '../src/enemy-renderer.js';
import {tagMotionGeometry,deformReference} from '../src/monster-motion.js';
function fixture(capacity=160) {
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.position.set(0,3,12);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 const enemies=[],manager=new EnemyRenderer(scene,enemies,capacity),geometry=new THREE.SphereGeometry(1,8,6),material=new THREE.MeshStandardMaterial();
 const add=(x=0,options={})=>{const group=new THREE.Group(),visual=new THREE.Group(),part=new THREE.Mesh(geometry,options.material||material);part.castShadow=!!options.shadow;part.receiveShadow=true;visual.add(part);group.add(visual);group.position.set(x,0,0);scene.add(group);const enemy={group,visual,hp:100,kind:options.kind??0};enemies.push(enemy);return {enemy,part};};
 const sync=()=>{scene.updateMatrixWorld(true);manager.sync(camera);};
 return {scene,camera,enemies,manager,geometry,material,add,sync};
}
test('instancing preserves world transforms, materials and shadow settings',()=>{
 const f=fixture(),a=f.add(1,{shadow:true}),b=f.add(-2);a.enemy.group.rotation.y=.6;a.enemy.group.scale.setScalar(1.3);a.enemy.visual.position.y=.25;
 f.sync();assert.equal(f.manager.getDebugState().instances,2);assert.equal(f.manager.batches.size,2);
 const batch=[...f.manager.batches.values()].find(x=>x.mesh.castShadow);assert.equal(batch.mesh.geometry,f.geometry);assert.equal(batch.mesh.material,f.material);assert.equal(batch.mesh.receiveShadow,true);
 const matrix=new THREE.Matrix4();batch.mesh.getMatrixAt(0,matrix);for(let i=0;i<16;i++)assert.ok(Math.abs(matrix.elements[i]-a.part.matrixWorld.elements[i])<1e-6);
 assert.equal(a.part.visible,false);assert.equal(b.part.visible,false);assert.equal(a.enemy.hp,100);f.manager.dispose();
});
test('transparent parts and independent bosses keep individual rendering',()=>{
 const f=fixture(),transparent=f.add(0,{material:new THREE.MeshBasicMaterial({transparent:true,opacity:.6})}),boss=f.add(1,{kind:4});f.sync();assert.equal(f.manager.batches.size,0);assert.equal(transparent.part.visible,true);assert.equal(boss.part.visible,true);f.manager.dispose();
});
test('off-screen normal bodies are culled while off-screen shadow casters remain',()=>{
 const f=fixture(),hidden=f.add(1000),caster=f.add(1000,{shadow:true});f.sync();assert.equal(f.manager.getDebugState().instances,1);assert.equal(hidden.part.visible,false);assert.equal(caster.part.visible,false);f.manager.dispose();
});
test('death, restart and disabling batches restore originals without stale instances',()=>{
 const f=fixture(),a=f.add();f.sync();a.enemy.hp=0;f.sync();assert.equal(f.manager.getDebugState().instances,0);assert.equal(a.part.visible,true);a.enemy.hp=100;f.sync();f.manager.enabled=false;f.sync();assert.equal(a.part.visible,true);assert.equal(f.manager.getDebugState().instances,0);f.manager.enabled=true;f.sync();f.manager.reset();assert.equal(a.part.visible,true);assert.equal(f.manager.getDebugState().instances,0);f.manager.dispose();
});
test('overflow remains visible and disposal does not destroy shared source assets',()=>{
 const f=fixture(1),a=f.add(),b=f.add(1);let geometryDisposed=false,materialDisposed=false;f.geometry.addEventListener('dispose',()=>geometryDisposed=true);f.material.addEventListener('dispose',()=>materialDisposed=true);f.sync();assert.equal(f.manager.getDebugState().instances,1);assert.equal(a.part.visible,false);assert.equal(b.part.visible,true);f.manager.dispose();assert.equal(geometryDisposed,false);assert.equal(materialDisposed,false);assert.equal(a.part.visible,true);assert.equal(f.scene.children.some(x=>x.isInstancedMesh),false);
});
test('transparent joint attachments share their original geometry and match vertex deformation without accumulating transforms',()=>{
 const f=fixture(),{enemy,part}=f.add(1,{material:new THREE.MeshBasicMaterial({transparent:true,opacity:.8})});
 tagMotionGeometry(f.geometry,9,3);enemy.motion={pose:new Float32Array([1,.8,.6,.4,.9,0,.2,.1])};
 f.scene.updateMatrixWorld(true);const bind=part.matrixWorld.clone(),reference=f.geometry.clone();deformReference(f.geometry,reference,enemy.motion.pose);
 const expected=new THREE.Vector3().fromBufferAttribute(reference.attributes.position,0).applyMatrix4(bind);
 for(let frame=0;frame<4;frame++){f.sync();const actual=new THREE.Vector3().fromBufferAttribute(part.geometry.attributes.position,0).applyMatrix4(part.matrixWorld);assert.ok(actual.distanceTo(expected)<1e-5);assert.equal(part.geometry,f.geometry);assert.equal(f.manager.cpuParts.size,0);}
 assert.deepEqual(part.position.toArray(),[0,0,0]);f.manager.release(enemy);reference.dispose();f.manager.dispose();
});
