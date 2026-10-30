import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { StageObjectives, objectiveFor } from "../src/stage-objectives.js";

function fixture(type) {
  const rewards = [],
    hurt = [],
    g = {
      scene: new THREE.Scene(),
      player: new THREE.Group(),
      _state: { stage: 2, stageTime: 0, elapsed: 0, runId: "fixed" },
      enemies: [],
      sideAreas: { active: null },
      runReport: {},
      callbacks: {},
      stageStats: () => ({ enemyDamage: 10, coinValue: 5 }),
      groundHeight: () => 0,
      resolvePosition: (p) => p.setY(0),
      getThreat: () => ({ enemyDamage: 1 }),
      combatArt: { hit() {} },
      emit() {},
    };
  g.spawnEnemy = (x, z, kind, options) => {
    const e = { hp: 100, kind, group: new THREE.Group(), speed: 2, ...options };
    e.group.position.set(x, 0, z);
    g.enemies.push(e);
    return e;
  };
  g.collectPickup = (p) => rewards.push(p.value);
  g.takeDamage = (d, p, c, a, o) => hurt.push({ d, o });
  const goals = new StageObjectives(g);
  g.objectives = goals;
  goals.begin(2, "sanctum", type);
  return { g, goals, rewards, hurt };
}
test("floor objectives vary reproducibly, preserve opening/final survival and replace the wait gate", () => {
  assert.equal(objectiveFor(1, "void", "a"), "survival");
  assert.equal(objectiveFor(10, "void", "a"), "survival");
  assert.equal(
    new Set(
      Array.from({ length: 8 }, (_, i) => objectiveFor(i + 2, "ruins", "seed")),
    ).size,
    6,
  );
  const { g, goals } = fixture("elite");
  goals.goal.complete = true;
  g._state.stageTime = 19;
  assert.equal(goals.canSummon(), false);
  g._state.stageTime = 20;
  assert.equal(goals.canSummon(), true);
  assert.equal(goals.canAdvance(), true);
  goals.begin(1, "sanctum", "survival");
  g._state.stageTime = 90;
  assert.equal(goals.canSummon(), true);
  assert.equal(goals.canAdvance(), false);
  g._state.stageTime = 120;
  assert.equal(goals.canAdvance(), true);
  goals.dispose();
});
test("elite/hunt require marked kills exactly once, keep rewards finite, and respect the actor cap", () => {
  for (const type of ["elite", "hunt"]) {
    const { g, goals, rewards } = fixture(type);
    for (let i = 0; i < goals.goal.target; i++) goals.update(1.1);
    for (const e of [...goals.targets]) {
      e.hp = 0;
      goals.onKill(e, e.group.position);
      goals.onKill(e, e.group.position);
    }
    assert.equal(goals.goal.complete, true);
    assert.equal(rewards.length, 1);
    goals.finish();
    assert.equal(rewards.length, 1);
    goals.dispose();
  }
  const { g, goals } = fixture("elite");
  g.enemies = Array.from({ length: 160 }, () => ({ hp: 1 }));
  goals.update(2);
  assert.equal(goals.targets.size, 0);
  goals.dispose();
});
test("defense takes real device damage, can fail and restart, and completes only after an armed defense", () => {
  const { g, goals, rewards } = fixture("defense");
  goals.update(30);
  assert.equal(goals.goal.complete, false);
  g.player.position.copy(goals.points[0].position);
  assert.ok(goals.interact(0));
  goals.update(0.1);
  const raider = [...goals.raiders][0];
  assert.ok(goals.targetFor(raider));
  assert.ok(goals.damageDevice(raider, 200));
  assert.equal(goals.goal.broken, true);
  assert.equal(goals.goal.complete, false);
  assert.equal(rewards.length, 0);
  assert.ok(goals.interact(0));
  assert.equal(goals.goal.hp, goals.goal.maxHp);
  goals.update(28);
  assert.equal(goals.goal.complete, true);
  assert.equal(rewards.length, 1);
  goals.dispose();
});
test("seals require a dead guardian and actual interaction; crossing has warned damage and ordered progress", () => {
  const { g, goals, rewards } = fixture("seals");
  goals.update(0.1);
  for (const p of goals.points) {
    g.player.position.copy(p.position);
    assert.equal(goals.interactionTarget(), null);
    p.guard.hp = 0;
    assert.ok(goals.interact(p.id));
    assert.equal(goals.interact(p.id), false);
  }
  assert.equal(goals.goal.complete, true);
  assert.equal(rewards.length, 1);
  goals.dispose();
  const f = fixture("crossing");
  f.g._state.stageTime = 1.4;
  f.g.player.position
    .copy(f.goals.points[0].position)
    .add(new THREE.Vector3(2.5, 0, 0));
  f.goals.update(0.01);
  assert.equal(f.hurt.length, 1);
  assert.equal(f.hurt[0].o.unblockable, true);
  assert.equal(f.goals.goal.progress, 0);
  f.g._state.stageTime = 0;
  for (const p of f.goals.points) {
    f.g.player.position.copy(p.position);
    f.goals.update(0.01);
  }
  assert.equal(f.goals.goal.complete, true);
  assert.equal(f.rewards.length, 1);
  f.goals.dispose();
});
test("ritual requires activation and nearby non-minion kills; room kills cannot advance a parent goal", () => {
  const { g, goals } = fixture("ritual"),
    enemy = { kind: 0, minion: false };
  const p = goals.points[0].position;
  goals.onKill(enemy, p);
  assert.equal(goals.goal.progress, 0);
  g.player.position.copy(p);
  goals.interact(0);
  g.sideAreas.active = {};
  goals.onKill(enemy, p);
  assert.equal(goals.goal.progress, 0);
  g.sideAreas.active = null;
  goals.onKill({ ...enemy, minion: true }, p);
  assert.equal(goals.goal.progress, 0);
  for (let i = 0; i < 5; i++) goals.onKill(enemy, p);
  assert.equal(goals.goal.complete, true);
  goals.dispose();
});
