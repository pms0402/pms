import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  monsterJoint,
  jointAngles,
  tagMotionGeometry,
  deformReference,
  rigMaterial,
} from "../src/monster-motion.js";
import { beginSwordStroke } from "../src/motion.js";
import { SwordTrail } from "../src/sword-trail.js";

test("anatomy distinguishes hands, legs, head, quadruped and insect limbs", () => {
  assert.equal(monsterJoint(0, -0.55, 0.35, 0.25), 2);
  assert.equal(monsterJoint(0, 0.23, 0.1, 0.13), 5);
  assert.equal(monsterJoint(0, 0.32, 1.23, 0.12), 1);
  assert.equal(monsterJoint(1, 0.18, 1.09, 0.4), 1);
  assert.deepEqual(
    [-0.43, 0.36].flatMap((z) =>
      [-0.25, 0.25].map((x) => monsterJoint(1, x, 0.3, z)),
    ),
    [6, 7, 4, 5],
  );
  assert.deepEqual(
    [-0.3, 0.1, 0.47].flatMap((z) =>
      [-0.65, 0.65].map((x) => monsterJoint(6, x, 0.39, z)),
    ),
    [6, 7, 4, 5, 2, 3],
  );
  assert.equal(monsterJoint(9, 0.66, 2.17, 0.21), 3);
  assert.equal(monsterJoint(7, 0.43, 0.23, 0.05), 0);
});
test("deformation rotates intact limbs and normals without mutating shared geometry", () => {
  const source = tagMotionGeometry(
      new THREE.SphereGeometry(0.1, 8, 6).translate(-0.23, 0.2, 0.13),
      0,
      4,
    ),
    target = source.clone();
  const original = source.attributes.position.array.slice(),
    normals = source.attributes.normal.array.slice();
  const pose = new Float32Array([Math.PI / 2, 1, 0, 0, 0, 0, 0, 0]);
  deformReference(source, target, pose);
  assert.deepEqual(source.attributes.position.array, original);
  assert.deepEqual(source.attributes.normal.array, normals);
  assert.notDeepEqual(target.attributes.position.array, original);
  for (let i = 0; i < normals.length; i += 3) {
    const a = target.attributes.normal.array;
    assert.ok(Math.abs(Math.hypot(a[i], a[i + 1], a[i + 2]) - 1) < 1e-5);
  }
  const before = target.attributes.position.array.slice();
  deformReference(source, target, pose);
  assert.deepEqual(
    target.attributes.position.array,
    before,
    "deformation never accumulates",
  );
  for (const kind of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    for (let j = 0; j <= 8; j++)
      assert.ok(jointAngles(kind, j, pose, []).every(Number.isFinite));
  source.dispose();
  target.dispose();
});
test("instanced shaders transform both surface normals and geometry with matching shadow inputs", () => {
  const base = new THREE.MeshStandardMaterial(),
    rig = rigMaterial(base),
    shader = {
      vertexShader: "#include <beginnormal_vertex>\n#include <begin_vertex>",
    };
  rig.onBeforeCompile(shader);
  assert.match(shader.vertexShader, /objectNormal=vrRotate/);
  assert.match(shader.vertexShader, /transformed=vrRotate/);
  assert.match(shader.vertexShader, /attribute vec4 vrPose0/);
  assert.notEqual(rig, base);
  assert.equal(base.onBeforeCompile.toString().includes("vrRotate"), false);
  rig.dispose();
  base.dispose();
});
test("fast sword hits retain full readable strokes with bounded duration and alternating cuts", () => {
  const g = { combatStats: { attackRate: 1 }, attackAnim: 0, swingSide: -1 },
    profile = { attackRateMultiplier: 1 };
  assert.ok(beginSwordStroke(g, profile));
  assert.equal(g.attackAnimTotal, 0.3);
  assert.equal(g.swingSide, 1);
  g.combatStats.attackRate = 100;
  assert.equal(beginSwordStroke(g, profile), false);
  g.attackAnim = 0;
  assert.ok(beginSwordStroke(g, profile));
  assert.equal(g.attackAnimTotal, 0.13);
  assert.equal(g.swingSide, -1);
});
test("blade ribbons follow actual world-space steel, expire, reset and reuse bounded buffers", () => {
  const player = new THREE.Group(),
    blade = new THREE.Mesh(
      new THREE.BoxGeometry(),
      new THREE.MeshBasicMaterial(),
    );
  player.add(blade);
  const g = {
      scene: new THREE.Scene(),
      player,
      blade,
      attackAnim: 0.2,
      attackAnimTotal: 0.3,
      parry: { active: 0 },
      stats: {},
      effectIntensity: 1,
    },
    trail = new SwordTrail(g),
    buffer = trail.position;
  for (let i = 0; i < 150; i++) {
    blade.rotation.y += 0.08;
    trail.sample();
    trail.update(0.008);
  }
  assert.ok(trail.mesh.visible && trail.geometry.drawRange.count > 0);
  assert.ok(
    trail.paths[0].length <= trail.capacity &&
      trail.geometry.drawRange.count <= trail.alpha.length,
  );
  const point = trail.paths[0].at(-1),
    tip = new THREE.Vector3(0, 0, 1).applyMatrix4(blade.matrixWorld);
  assert.ok(point.tip.distanceTo(tip) < 1e-8);
  g.attackAnim = 0;
  trail.update(0.2);
  assert.equal(trail.mesh.visible, false);
  trail.reset();
  assert.equal(trail.position, buffer);
  assert.equal(trail.paths[0].length, 0);
  assert.equal(trail.geometry.drawRange.count, 0);
  trail.dispose();
  blade.geometry.dispose();
  blade.material.dispose();
});
