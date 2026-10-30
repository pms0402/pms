import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CombatLinks } from "../src/combat-links.js";
import { MagicSystem } from "../src/magic.js";

function fixture() {
  const hits = [],
    g = {
      scene: new THREE.Scene(),
      _state: { phase: "playing", elapsed: 1 },
      player: new THREE.Group(),
      stats: {
        damage: 20,
        spellDamage: 20,
        spellRate: 1.5,
        spells: { fireball: 1, frost: 1, lightning: 1, orbit: 1 },
      },
      combatStats: { spellDamage: 20 },
      parry: { counterTime: 2 },
      runReport: {},
      enemies: [],
      combatLineClear: () => true,
    };
  g.queryEnemies = () => g.enemies;
  g.hitEnemy = (e, damage, direction, source, id, impact) => {
    hits.push({ e, damage, source, id, impact });
    e.hp -= damage;
    return true;
  };
  g.enemy = (x, z) => {
    const e = { group: new THREE.Group(), kind: 0, size: 1, hp: 10000 };
    e.group.position.set(x, 0, z);
    g.enemies.push(e);
    return e;
  };
  g.links = new CombatLinks(g);
  g.magic = new MagicSystem(g);
  return { g, hits };
}
test("frost-heavy bonus requires actual frost and slow, is target-cooled and reduced on bosses", () => {
  const { g } = fixture(),
    e = g.enemy(0, 2),
    a = { heavy: true };
  e.slowTime = 2;
  assert.equal(g.links.swordMultiplier(a, e), 1);
  g.links.onMagicHit(e, "frost");
  assert.equal(g.links.swordMultiplier(a, e), 1.45);
  assert.equal(g.links.swordMultiplier(a, e), 1);
  const boss = g.enemy(0, 3);
  boss.kind = 4;
  boss.slowTime = 2;
  g.links.onMagicHit(boss, "frost");
  assert.equal(g.links.swordMultiplier(a, boss), 1.25);
  g._state.elapsed = 5.1;
  assert.equal(g.links.swordMultiplier(a, e), 1);
  g.magic.dispose();
});
test("fire-sword explosion is finite, blocked by walls and cannot repeatedly consume one ignition", () => {
  const { g, hits } = fixture(),
    e = g.enemy(0, 1);
  for (let i = 0; i < 12; i++) g.enemy((i % 3) * 0.5, 1 + (i % 4) * 0.3);
  g.links.onMagicHit(e, "fireball");
  g.links.afterSword(e, 100, e.group.position.clone());
  assert.equal(hits.length, 6);
  assert.ok(
    hits.every((h) => h.source === "link" && Math.abs(h.damage - 55) < 1e-8),
  );
  assert.equal(g.links.afterSword(e, 100, e.group.position), false);
  g._state.elapsed = 6;
  g.links.onMagicHit(e, "fireball");
  g.combatLineClear = () => false;
  g.links.afterSword(e, 100, e.group.position);
  assert.equal(hits.length, 6);
  assert.equal(g.links.triggers.ignite, 2);
  g.magic.dispose();
});
test("parry magic changes actual spell damage exactly once without consuming the sword counter", () => {
  const { g, hits } = fixture();
  g.enemy(0, 2);
  g.links.onParry();
  assert.equal(g.links.prepareCast("frost").damageMultiplier, 1.25);
  assert.equal(g.magic.castManual("frost"), true);
  assert.equal(hits[0].damage, 137.5);
  assert.equal(g.links.triggers.parryMagic, 1);
  assert.equal(g.links.prepareCast("frost").damageMultiplier, 1);
  assert.equal(g.parry.counterTime, 2);
  assert.equal(g.magic.damage("frost"), 20);
  g.magic.dispose();
});
test("dash lightning pierces without double-hitting chain targets and uncast windows simply expire", () => {
  const { g, hits } = fixture();
  for (const z of [4, 7, 10, 14]) g.enemy(0, z);
  g.links.onDash();
  g.magic.castManual("lightning", new THREE.Vector3(0, 0, 1));
  assert.equal(g.links.triggers.dashLightning, 1);
  for (const e of g.enemies)
    assert.equal(hits.filter((h) => h.e === e).length, 1);
  const total = hits.length;
  g.links.onParry();
  g._state.elapsed += 3;
  assert.equal(g.links.prepareCast("fireball").damageMultiplier, 1);
  assert.equal(hits.length, total);
  g.magic.dispose();
});
