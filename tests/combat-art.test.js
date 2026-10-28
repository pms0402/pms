import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatArt } from '../src/combat-art.js';
import { ActorShadows } from '../src/actor-shadows.js';
import { LANDMARK, isWalkable, resolveTerrainMovement, terrainHeight } from '../src/terrain.js';

test('impact particles stay bounded, expire, and never consume gameplay randomness', () => {
  const scene = new THREE.Scene(), art = new CombatArt(scene, 24), origin = new THREE.Vector3(1, 2, 3), before = origin.clone();
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('cosmetic renderer consumed gameplay RNG'); };
    for (let i = 0; i < 30; i++) art.hit(origin, 'sword', true);
    assert.equal(art.count, 24); assert.equal(art.geometry.instanceCount, 24); assert.ok(origin.equals(before));
    art.update(.1); assert.ok([...art.position].every(Number.isFinite));
    art.update(.8); assert.equal(art.count, 0); assert.equal(art.mesh.visible, false);
    art.hit(origin, 'fireball'); assert.ok(art.count > 0); art.reset(); assert.equal(art.geometry.instanceCount, 0);
  } finally { Math.random = random; art.dispose(); }
});
test('fire trails use a per-step budget, shared buffers and one render object', () => {
  const scene = new THREE.Scene(), art = new CombatArt(scene), origin = new THREE.Vector3();
  const geometry = art.geometry;
  for (let i = 0; i < 100; i++) art.trail(origin);
  assert.equal(art.count, 12); assert.equal(scene.children.length, 1);
  art.update(.05); for (let i = 0; i < 20; i++) art.trail(origin);
  assert.equal(art.count, 24); assert.equal(art.geometry, geometry); art.dispose(); assert.equal(scene.children.length, 0);
});
test('crowd contact shadows follow living actors and reset without disposing shared maps', () => {
  const scene = new THREE.Scene(), map = new THREE.Texture(), enemies = [];
  let disposed = false; map.addEventListener('dispose', () => disposed = true);
  for (let i = 0; i < 4; i++) { const group = new THREE.Group(); group.position.set(i, i * .5, -i); enemies.push({ hp: i === 0 ? 0 : 100, group, size: 1 }); }
  const shadows = new ActorShadows(scene, enemies, map, 2); shadows.sync(); assert.equal(shadows.mesh.count, 2);
  const matrix = new THREE.Matrix4(); shadows.mesh.getMatrixAt(0, matrix); const position = new THREE.Vector3().setFromMatrixPosition(matrix);
  assert.ok(Math.abs(position.y - .535) < 1e-6); assert.equal(position.x, 1);
  shadows.reset(); assert.equal(shadows.mesh.count, 0); assert.equal(shadows.mesh.visible, false); shadows.dispose(); assert.equal(disposed, false);
});
test('the new arch has solid pillars and an open, grounded passage', () => {
  assert.ok(isWalkable(LANDMARK.x, LANDMARK.z, .65));
  for (const side of [-1, 1]) {
    const x = LANDMARK.x + side * LANDMARK.pillarOffset;
    assert.equal(isWalkable(x, LANDMARK.z, .1), false);
    const position = new THREE.Vector3(x, 20, LANDMARK.z); resolveTerrainMovement(position, .65);
    assert.ok(isWalkable(position.x, position.z, .649)); assert.equal(position.y, terrainHeight(position.x, position.z));
  }
});
