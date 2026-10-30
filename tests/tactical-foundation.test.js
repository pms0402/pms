import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  segmentEntry,
  combatLineClear,
  clipAimPoint,
} from "../src/combat-collision.js";
import { LockOnSystem } from "../src/lock-on.js";
import {
  normalizeBindings,
  DEFAULT_BINDINGS,
} from "../src/control-bindings.js";

const p = (x, z) => new THREE.Vector3(x, 0, z);
test("swept collision catches thin walls and pillars without filling door openings", () => {
  const wall = { type: "rect", x: 0, z: 2, hx: 2, hz: 0.02 };
  assert.ok(segmentEntry(p(0, 0), p(0, 4), wall) > 0.49);
  assert.equal(segmentEntry(p(3, 0), p(3, 4), wall), Infinity);
  assert.ok(
    segmentEntry(p(0, 0), p(0, 10), {
      type: "circle",
      x: 0,
      z: 4,
      radius: 0.4,
    }) < 0.4,
  );
  assert.equal(segmentEntry(p(0, 0), p(0, 0), wall), Infinity);
  const g = { world: { colliders: [wall] }, groundHeight: () => 0 };
  assert.equal(combatLineClear(g, p(0, 0), p(0, 4)), false);
  const end = clipAimPoint(g, p(0, 0), p(0, 4));
  assert.ok(end.z < 1.9 && end.z > 1.5);
});
function fixture() {
  const g = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(),
    player: new THREE.Group(),
    _state: { phase: "playing" },
    callbacks: {},
    enemies: [],
    activeEnemies: new Set(),
    world: { colliders: [] },
    view: { movement: { reset() {} } },
  };
  g.actions = {
    current: null,
    setAim(v) {
      this.aim = v.clone();
      if (!this.current) g.player.rotation.y = Math.atan2(v.x, v.z);
    },
  };
  g.add = (x, z, boss = false) => {
    const e = {
      hp: 100,
      name: "test",
      kind: boss ? 4 : 0,
      size: 1,
      spawnSerial: g.enemies.length + 1,
      group: new THREE.Group(),
    };
    e.group.position.set(x, 0, z);
    g.enemies.push(e);
    g.activeEnemies.add(e);
    return e;
  };
  g.lock = new LockOnSystem(g);
  return g;
}
test("lock selection stays stable through crowds and changes only on explicit switching or loss", () => {
  const g = fixture(),
    front = g.add(0, 8);
  g.add(7, 6);
  assert.ok(g.lock.toggle());
  assert.equal(g.lock.target, front);
  for (let i = 0; i < 150; i++) g.add((i % 5) - 2, 3 + (i % 2));
  for (let i = 0; i < 60; i++) g.lock.update(1 / 60);
  assert.equal(g.lock.target, front);
  g.lock.cycle();
  assert.notEqual(g.lock.target, front);
  g.lock.target.hp = 0;
  g.lock.update(0.01);
  assert.equal(g.lock.target, null);
  g.lock.dispose();
});
test("lock keeps strafe/back movement, bounded turning, and attack snapshots while handling occlusion grace", () => {
  const g = fixture(),
    e = g.add(10, 0);
  g.lock.set(e);
  g.lock.update(1 / 60);
  assert.ok(Math.abs(g.player.rotation.y) <= 3.2 / 60 + 1e-8);
  const side = g.lock.movement(1, 0),
    forward = p(Math.sin(g.player.rotation.y), Math.cos(g.player.rotation.y));
  assert.ok(Math.abs(side.dot(forward)) < 1e-8);
  assert.ok(g.lock.movement(0, 1).dot(forward) < -0.99);
  g.actions.current = {};
  const heading = g.player.rotation.y;
  g.lock.update(0.1);
  assert.equal(g.player.rotation.y, heading);
  g.world.colliders = [{ type: "rect", x: 5, z: 0, hx: 0.05, hz: 4 }];
  g.lock.update(0.5);
  assert.equal(g.lock.target, e);
  g.lock.update(0.3);
  assert.equal(g.lock.target, null);
  g.lock.dispose();
});
test("new lock bindings preserve old customized keys and resolve new default collisions", () => {
  const old = { ...DEFAULT_BINDINGS, left: "l", interact: "k" };
  delete old.lockon;
  delete old.targetNext;
  delete old.targetPrev;
  const b = normalizeBindings(old);
  assert.equal(b.left, "l");
  assert.equal(b.interact, "k");
  assert.equal(new Set(Object.values(b)).size, Object.keys(b).length);
  assert.ok(b.lockon && b.targetNext && b.targetPrev);
});
