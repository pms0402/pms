import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  rollEquipment,
  equipmentBonuses,
  EQUIPMENT_GRADES,
  EquipmentSystem,
} from "../src/equipment.js";
import {
  abyssStats,
  abyssBoss,
  abyssRule,
  normalizeEndgame,
  recordEndgame,
} from "../src/abyss.js";
import { ParrySystem } from "../src/parry.js";
import { chooseNpc, ExplorationSystem } from "../src/exploration.js";
test("equipment grades have exact distinct option budgets and regional elements", () => {
  for (let min = 0; min < 4; min++) {
    const item = rollEquipment(4, "tundra", () => 0.99, min);
    assert.equal(item.grade, EQUIPMENT_GRADES[min].id);
    assert.equal(item.options.length, min);
    assert.equal(new Set(item.options).size, min);
    assert.equal(item.element, "frost");
    assert.equal(!!item.unique, min === 3);
  }
  const item = rollEquipment(1, "volcano", () => 0);
  assert.equal(item.grade, "legendary");
  assert.equal(item.element, "fireball");
});
test("equipment comparison is reversible, bounded and never mutates the base build", () => {
  const base = { damage: 18, maxHp: 100 };
  const item = {
    ...rollEquipment(10, "void", () => 0),
    slot: "weapon",
    options: ["crit", "haste", "blast"],
  };
  const before = JSON.stringify(base),
    b = equipmentBonuses([item]);
  assert.ok(
    b.damage > 1 && b.crit === 0.04 && b.attackRate === 1.08 && b.blast === 1,
  );
  assert.equal(JSON.stringify(base), before);
  assert.equal(equipmentBonuses([]).damage, 1);
  assert.ok(b.combo > 1);
});
test("parry accepts a brief forward attack, rejects rear/unblockable attacks and consumes counter once", () => {
  const game = {
    scene: new THREE.Scene(),
    player: new THREE.Group(),
    _state: { phase: "playing", elapsed: 0 },
    camera:new THREE.PerspectiveCamera(), groundHeight:()=>0, combatArt:{emit(){}}, queryEnemies:()=>[],
    stats: { relics: [] },
    callbacks: {},
    sound() {},
    puff() {},
    attack() {},
  };
  const p = new ParrySystem(game);
  assert.ok(p.press());
  assert.equal(p.defend(new THREE.Vector3(0, 0, -1)), 1);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1), { unblockable: true }), 1);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1)), 0);
  assert.equal(p.successes, 1);
  assert.equal(p.consume(), 2.5);
  assert.equal(p.consume(), 1);
  assert.equal(p.press(), false);
  p.update(4);
  p.press();
  p.update(0.2);
  assert.equal(p.defend(new THREE.Vector3(0, 0, 1)), 0.35);
  p.dispose();
});
test("abyss curves remain finite at extreme floors, preserve caps and rotate constraints", () => {
  for (const floor of [11, 15, 20, 30, 1000, 1e9]) {
    const s = abyssStats(floor),
      b = abyssBoss(floor);
    assert.equal(s.maxEnemies, 160);
    for (const n of [
      s.enemyHealth,
      s.enemyDamage,
      s.coinValue,
      b.health,
      b.damage,
    ])
      assert.ok(Number.isFinite(n) && n > 0);
    assert.ok(s.enemyHealth <= 1e12 && s.enemyDamage <= 1e8);
  }
  assert.ok(abyssBoss(15).variant > abyssBoss(14).variant);
  assert.equal(new Set([11,12,13,14,15,16].map(f => abyssBoss(f).archetype)).size, 6);
  assert.equal(abyssRule(19), null);
  assert.notEqual(abyssRule(20).id, abyssRule(30).id);
  assert.ok(abyssRule(20).description);
});
test("endgame migration preserves old achievements and records results once without changing permanent progression", () => {
  const source = { bank: 123, upgrades: { power: 5 } },
    before = JSON.stringify(source);
  let p = normalizeEndgame({}, [{ won: true, stage: 10 }]);
  assert.ok(p.unlocked);
  const state = {
    mode: "abyss",
    runId: "run-1",
    stage: 16,
    kills: 100,
    gold: 12345,
    elapsed: 80,
    playerStats: {
      spells: { fireball: 5 },
      evolutions: { fireball: true },
      relics: [],
    },
    equipment: { bag: [], slots: {} },
  };
  p = recordEndgame(p, state);
  assert.equal(p.bestFloor, 16);
  assert.equal(p.bestRun.build.spells.fireball, 5);
  assert.deepEqual(recordEndgame(p, { ...state, stage: 100 }), p);
  assert.equal(JSON.stringify(source), before);
});
test("NPC region weights produce all five encounter types and reject bad randomness safely", () => {
  const ids = new Set();
  for (let i = 0; i < 100; i++) ids.add(chooseNpc("volcano", () => i / 100));
  assert.equal(ids.size, 5);
  assert.ok(chooseNpc("forest", () => NaN));
});
test("equipping after a cached empty inventory updates bonuses and discarding restores them", () => {
  const game = {
    scene: new THREE.Scene(),
    _state: { phase: "playing", hp: 60 },
    callbacks: {},
    combatStats: { maxHp: 100 },
  };
  const system = new EquipmentSystem(game);
  assert.equal(system.bonuses().damage, 1);
  const item = { ...rollEquipment(5, "volcano", () => 0), slot: "weapon" };
  system.add(item);
  system.equip(item.id);
  assert.ok(system.bonuses().damage > 1);
  system.discard(item.id);
  assert.equal(system.bonuses().damage, 1);
  assert.equal(game._state.hp, 60);
  system.dispose();
});
