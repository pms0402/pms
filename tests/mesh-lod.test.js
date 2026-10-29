import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { clusterGeometry, MonsterLod } from "../src/mesh-lod.js";
import { tagMotionGeometry } from "../src/monster-motion.js";
test("LOD reduces distant triangles, preserves joint pivots, unit normals and immutable near mesh", () => {
  const source = new THREE.SphereGeometry(1, 32, 24);
  tagMotionGeometry(source, 9, 3);
  const original = Array.from(source.attributes.position.array),
    small = clusterGeometry(source, 0.17);
  assert.ok(small.index.count < source.index.count * 0.7);
  assert.deepEqual(Array.from(source.attributes.position.array), original);
  const a = small.attributes;
  for (let i = 0; i < a.position.count; i++) {
    assert.equal(a.vrJoint.getX(i), 3);
    assert.equal(a.vrKind.getX(i), 9);
    assert.ok(
      Math.abs(
        Math.hypot(a.normal.getX(i), a.normal.getY(i), a.normal.getZ(i)) - 1,
      ) < 1e-5,
    );
  }
  for (let i = 0; i < small.index.count; i += 3) {
    const t = Array.from(small.index.array.slice(i, i + 3));
    assert.equal(new Set(t).size, 3);
  }
  source.dispose();
  small.dispose();
});
test("screen size changes select a shared level with hysteresis; bosses retain their mesh", () => {
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  tagMotionGeometry(geometry, 0, 1);
  const material = new THREE.MeshStandardMaterial(),
    part = new THREE.Mesh(geometry, material),
    group = new THREE.Group(),
    visual = new THREE.Group();
  visual.add(part);
  group.add(visual);
  group.updateMatrixWorld(true);
  const enemy = { kind: 0, hp: 1, visual, group };
  const lod = new MonsterLod(),
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 100;
  camera.updateMatrixWorld();
  lod.prepare([enemy], camera, 600, new Map());
  assert.notEqual(lod.geometry(geometry), geometry);
  const distant = lod.geometry(geometry);
  camera.position.z = 99;
  lod.prepare([enemy], camera, 600, new Map());
  assert.equal(lod.geometry(geometry), distant);
  camera.position.z = 5;
  lod.prepare([enemy], camera, 600, new Map());
  assert.equal(lod.geometry(geometry), geometry);
  enemy.kind = 4;
  camera.position.z = 100;
  lod.prepare([enemy], camera, 600, new Map());
  assert.equal(lod.geometry(geometry), geometry);
  lod.dispose();
  geometry.dispose();
  material.dispose();
});
test("close body keeps tiny eyes and teeth at authored detail as one silhouette", () => {
  const body = new THREE.SphereGeometry(1, 24, 16),
    eye = new THREE.SphereGeometry(0.04, 16, 12);
  tagMotionGeometry(body, 0, 1);
  tagMotionGeometry(eye, 0, 1);
  const group = new THREE.Group(),
    visual = new THREE.Group(),
    material = new THREE.MeshBasicMaterial();
  visual.add(new THREE.Mesh(body, material), new THREE.Mesh(eye, material));
  group.add(visual);
  group.updateMatrixWorld(true);
  const lod = new MonsterLod(),
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.z = 5;
  lod.prepare([{ kind: 0, hp: 1, group, visual }], camera, 600, new Map());
  assert.equal(lod.geometry(body), body);
  assert.equal(lod.geometry(eye), eye);
  lod.dispose();
  body.dispose();
  eye.dispose();
  material.dispose();
});
