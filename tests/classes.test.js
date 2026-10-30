import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { NEW_CLASSES, ClassSystem } from "../src/classes.js";
import {
  normalizeProgress,
  purchaseUnlock,
  selectLoadout,
  getPermanentBonuses,
} from "../src/progression.js";
test("four paid jobs preserve old wallets and loadouts and have real tradeoffs", () => {
  for (const job of NEW_CLASSES) {
    let p = normalizeProgress({ bank: 1000, upgrades: { power: 2 } });
    p = purchaseUnlock(p, "character", job.id).progress;
    assert.equal(p.bank, 1000 - job.cost);
    p = selectLoadout(p, "character", job.id).progress;
    assert.equal(getPermanentBonuses(p).characterId, job.id);
    assert.ok(
      job.maxHpMultiplier < 1 ||
        job.damageMultiplier < 1 ||
        job.speedMultiplier < 1,
    );
  }
  assert.equal(
    normalizeProgress({ bank: 100, loadout: { character: "summoner" } }).loadout
      .character,
    "wanderer",
  );
});
test("job passives charge, consume once and keep pets/shields/healing bounded", () => {
  const target = { hp: 100, group: new THREE.Group() },
    hits = [],
    game = {
      scene: new THREE.Scene(),
      player: new THREE.Group(),
      playerVisual: new THREE.Group(),
      stats: { characterId: "warlock" },
      combatStats: { spellDamage: 20, maxHp: 100 },
      _state: { elapsed: 0 },
      queryEnemies: () => [target],
      groundHeight: () => 0,
      magic: { lightningLine() {} },
      hitEnemy: (...a) => hits.push(a),
      heal: (n) => hits.push(n),
      puff() {},
    };
  const c = new ClassSystem(game);
  for (let i = 0; i < 6; i++) c.onKill();
  assert.equal(c.spellBonus("magic"), 1.6);
  assert.equal(c.spellBonus("magic"), 1);
  game.stats.characterId = "assassin";
  c.onKill();
  c.onDash();
  assert.equal(c.swordBonus(), 1.2);
  assert.equal(c.swordBonus(), 1);
  game.stats.characterId = "summoner";
  for (let i = 0; i < 8; i++) {
    game._state.elapsed += 0.21;
    c.onMagic(target);
  }
  c.update(.01);assert.equal(hits.length,0,'a pet never attacks without a manual command');target.group.position.z=2;c.command(new THREE.Vector3(0,0,1));
  c.update(0.01);
  assert.equal(hits[0][1], 20 * 0.45 * 1.8);
  assert.equal(c.magicHits, 0);
  c.update(0.01);
  assert.equal(hits.length, 1);
  game.stats.characterId = "paladin";
  c.onParry();
  c.onParry();
  assert.equal(hits.length, 2);
  game._state.elapsed = 12;
  c.update(0.1);
  assert.equal(c.shield, 8);
  assert.equal(c.absorb(20), 8);
  assert.equal(c.absorb(20), 0);
  c.reset();
  assert.equal(c.stacks, 0);
  c.dispose();
});
