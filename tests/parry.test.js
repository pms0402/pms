import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { ParrySystem, PARRY, counterProfile } from "../src/parry.js";
function fixture() {
  const particles = [],
    g = {
      scene: new THREE.Scene(),
      player: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      _state: { phase: "playing", elapsed: 0 },
      stats: { relics: [] },
      combatStats: { damage: 18 },
      analytics: { parryAttempts: 0, parrySuccesses: 0, parryBossStuns: 0 },
      callbacks: {},
      groundHeight: () => 0,
      combatArt: { emit: (...a) => particles.push(a) },
      queryEnemies: () => [],
      sound() {},
      clearTelegraph() {},
      removeGroup() {},
      attack() {},
      bossPhases: {},
      bossSystem: { cancelParryable() {} },
    };
  const p = new ParrySystem(g);
  g.parry = p;
  return { g, p, particles };
}
test("guard success alone creates shockwave feedback and hit-stop; failures and partial guard do not", () => {
  const { g, p, particles } = fixture();
  p.press();
  assert.equal(particles.length, 0);
  assert.equal(p.defend(new THREE.Vector3(0, 0, -1)), 1);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1), { unblockable: true }), 1);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1), { parryable: false }), 1);
  assert.equal(particles.length, 0);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1)), 0);
  assert.equal(g.analytics.parrySuccesses, 1);
  assert.equal(p.hitStop, 0.1);
  let attacks = 0;
  g.attack = () => attacks++;
  p.press();
  assert.equal(attacks, 0);
  assert.equal(g.attackTimer, 0);
  assert.equal(p.consume(), 2.5);
  assert.equal(p.consume(), 1);
  p.reset();
  p.press();
  p.update(0.2);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1)), 0.35);
  assert.equal(p.hitStop, 0);
  p.dispose();
});
test("counter uses a bounded half-circle and scales with sword growth and evolution", () => {
  const base = counterProfile({}),
    evolved = counterProfile({
      swordEvolution: "wave",
      swordRangeMultiplier: 1.5,
    }),
    max = counterProfile({ swordRangeMultiplier: 100 });
  assert.equal(base.arc, Math.PI);
  assert.equal(base.range, 3.5);
  assert.ok(evolved.range > base.range);
  assert.equal(max.range, 7);
  assert.equal(max.targets, 24);
});
test("boss stagger resists repeated parries and shortens for the third phase", () => {
  const { g, p } = fixture(),
    boss = { kind: 4, hp: 100, combatPhase: 1, group: new THREE.Group() };
  assert.ok(p.stunBoss(boss));
  assert.equal(boss.parryStun, 0.6);
  assert.equal(g.analytics.parryBossStuns, 1);
  boss.parryStun = 0;
  g._state.elapsed = 4;
  assert.equal(p.stunBoss(boss), false);
  assert.equal(boss.parryStun, 0);
  g._state.elapsed = 5.01;
  boss.combatPhase = 3;
  assert.ok(p.stunBoss(boss));
  assert.equal(boss.parryStun, 0.45);
  assert.equal(g.analytics.parryBossStuns, 2);
  p.dispose();
});
test("crowd control distinguishes elites and cannot be refreshed every hit", () => {
  const { g, p } = fixture(),
    enemy = (elite) => ({
      hp: 100,
      kind: 5,
      elite,
      size: 1,
      group: new THREE.Group(),
      seed: 1,
      stagger: new THREE.Vector3(),
      action: "charge-warning",
    }),
    normal = enemy(false),
    elite = enemy(true);
  normal.group.position.z = elite.group.position.z = 2;
  p.control(normal);
  p.control(elite);
  assert.equal(normal.action, "chase");
  assert.ok(normal.parryStun > elite.parryStun);
  assert.ok(normal.parryPush.length() > elite.parryPush.length());
  assert.equal(p.control(normal, true), false);
  g._state.elapsed = 2;
  assert.ok(p.control(normal, true));
  assert.ok(normal.parryStun < PARRY.stun);
  p.dispose();
});
test("reduced effects disable localized flashes without hiding wave range; resources reset and dispose", () => {
  const { g, p } = fixture();
  g.effectIntensity = 0;
  p.press();
  p.defend(new THREE.Vector3(0, 0, 1));
  p.feedback.update(0.08);
  assert.equal(p.feedback.flash.visible, false);
  assert.equal(p.feedback.light.intensity, 0);
  assert.equal(p.feedback.disc.visible, true);
  assert.equal(p.feedback.disc.scale.x, 4);
  const refs = [...p.feedback.root.children];
  for (let i = 0; i < 20; i++) {
    p.reset();
    p.press();
    p.defend(new THREE.Vector3(0, 0, 1));
  }
  assert.deepEqual(p.feedback.root.children, refs);
  p.reset();
  assert.equal(p.hitStop, 0);
  assert.equal(p.feedback.wave.visible, false);
  p.dispose();
  assert.equal(g.scene.children.length, 0);
});
