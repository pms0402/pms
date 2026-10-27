import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createPlayerModel } from '../src/player-model.js';

function fixture() {
  const game = { scene: new THREE.Scene(), ownedGeometries: new Set(), presentation: { clothMap: null }, geo: { heroRound: new THREE.SphereGeometry(1, 20, 14), roundSmall: new THREE.SphereGeometry(1, 8, 6), roundCylinder: new THREE.CylinderGeometry(1, 1, 1, 10), roundTorus: new THREE.TorusGeometry(1, .12, 6, 20) } };
  createPlayerModel(game); game.scene.updateMatrixWorld(true); return game;
}
test('knight has adult proportions, finite smooth geometry and a bounded rendering budget', () => {
  const g = fixture(), body = new THREE.Box3().setFromObject(g.playerVisual), head = new THREE.Box3().setFromObject(g.playerHead);
  const ratio = (body.max.y - body.min.y) / (head.max.y - head.min.y);
  assert.ok(ratio > 6.5 && ratio < 8.5);
  let meshes = 0, triangles = 0;
  g.playerVisual.traverse(object => {
    if (!object.isMesh) return;
    meshes++; triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
    assert.notEqual(object.geometry.type, 'BoxGeometry');
    for (const name of ['position', 'normal', 'uv']) assert.ok([...object.geometry.attributes[name].array].every(Number.isFinite));
  });
  assert.ok(meshes < 80 && triangles < 40000);
  assert.equal(g.hairLocks.length, 3); assert.equal(g.clothParts.length, 5);
});
test('armor baking preserves independent hip, knee, elbow and weapon joints', () => {
  const g = fixture();
  assert.equal(g.kneeLeft.parent, g.legLeft); assert.equal(g.kneeRight.parent, g.legRight);
  assert.equal(g.footLeft.parent, g.kneeLeft); assert.equal(g.rightElbow.parent, g.rightShoulder);
  assert.equal(g.swordArm.parent, g.rightElbow); assert.equal(g.blade.parent, g.swordArm);
  assert.ok(g.offhandParts.every(part => part.parent === g.offhandGrip && !part.visible));
  const left = g.leftShoulder.quaternion.clone(); g.rightShoulder.rotation.x = -.8;
  assert.ok(g.leftShoulder.quaternion.equals(left));
  assert.ok(g.blade.children.some(child => child.material === g.heroGlow));
});
test('coat panels anchor at their own shoulders or waist, with zero deformation at the seam', () => {
  const g = fixture();
  for (const cloth of g.clothParts) {
    assert.equal(cloth.base.length, cloth.mesh.geometry.attributes.position.array.length);
    assert.equal(cloth.weights.length, cloth.mesh.geometry.attributes.position.count);
    assert.equal(Math.min(...cloth.weights), 0); assert.equal(Math.max(...cloth.weights), 1);
    const top = Math.max(...Array.from({ length: cloth.weights.length }, (_, i) => cloth.base[i * 3 + 1]));
    assert.ok(Math.abs(top) < 1e-7);
  }
  assert.ok(g.heroMaterials.armor.metalness > .6 && g.heroMaterials.cloth.roughness > .8);
  assert.notEqual(g.heroMaterials.armor, g.heroMaterials.cloth);
});
