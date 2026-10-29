import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {DeathPresentation} from '../src/death-presentation.js';
import {CombatArt} from '../src/combat-art.js';
test('defeat copies reuse shared geometry, never mutate targets/materials and stay bounded',()=>{
 const scene=new THREE.Scene(),game={scene,effectIntensity:1},deaths=new DeathPresentation(game),geometry=new THREE.SphereGeometry(.4,8,6),material=new THREE.MeshStandardMaterial();
 const actor=()=>{const group=new THREE.Group(),visual=new THREE.Group();visual.add(new THREE.Mesh(geometry,material));group.add(visual);return{group,visual,kind:0,visualKind:0,hp:0};};
 const first=actor();deaths.capture(first,new THREE.Vector3(1,0,0));const copy=deaths.slots[0].root.children[0].children[0];assert.equal(copy.geometry,geometry);assert.notEqual(copy.material,material);assert.equal(material.transparent,false);assert.equal(first.group.position.x,0);
 for(let i=0;i<50;i++)deaths.capture(actor(),new THREE.Vector3(1,0,0));assert.equal(deaths.slots.length,10);assert.equal(deaths.slots.filter(e=>e.life).length,10);
 deaths.update(.2);assert.ok(deaths.slots[0].root.position.x>0);deaths.update(1);assert.ok(deaths.slots.every(e=>!e.root.visible));deaths.capture(actor());assert.equal(deaths.slots.length,10);deaths.reset();assert.ok(deaths.slots.every(e=>!e.life));deaths.dispose();assert.equal(scene.children.includes(deaths.root),false);geometry.dispose();material.dispose();
});
test('parry particles replace expendable particles without exceeding the fixed GPU buffer',()=>{
 const scene=new THREE.Scene(),vfx=new CombatArt(scene,8),p=new THREE.Vector3();vfx.emit(p,'fireball',8,true);assert.equal(vfx.count,8);vfx.emit(p,'parry',6);assert.equal(vfx.count,8);assert.equal(Array.from(vfx.priority).filter(x=>x===3).length,6);assert.ok(Array.from(vfx.shape).filter(x=>x===2).length>=6);vfx.update(.1);assert.ok(vfx.count<=8);vfx.dispose();
});
test('lower quality trims active copies and never displaces a living boss with a normal defeat',()=>{
 const game={scene:new THREE.Scene(),effectIntensity:1},deaths=new DeathPresentation(game),geo=new THREE.SphereGeometry(1,8,6),mat=new THREE.MeshBasicMaterial();
 const actor=kind=>{const group=new THREE.Group(),visual=new THREE.Group();visual.add(new THREE.Mesh(geo,mat));group.add(visual);return{group,visual,kind,visualKind:kind};};
 for(let i=0;i<10;i++)deaths.capture(actor(0));deaths.setLimit(3);assert.equal(deaths.slots.filter(s=>s.life>0).length,3);
 deaths.reset();for(let i=0;i<3;i++)deaths.capture(actor(4));deaths.capture(actor(0));assert.equal(deaths.slots.filter(s=>s.life>0).length,3);assert.equal(deaths.slots.filter(s=>s.life>0&&s.boss).length,3);deaths.dispose();geo.dispose();mat.dispose();
});
