import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicSystem } from '../src/magic.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
function fixture(t, stats = {}) {
  const hits = [];
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3() },
    enemies: [], _state: { phase: 'playing' },
    stats: { damage: 100, spellDamage: 100, spellRate: 1.5, spells: { frost: 1 }, evolutions: {}, passiveLevels: {}, ...stats },
    hitEnemy(enemy, damage, direction, source, spellId, impact) {
      hits.push({ enemy, damage, direction: direction.clone(), source, spellId, impact });
      enemy.hp -= damage;
    },
  };
  const magic = new MagicSystem(game);
  t.after(() => magic.dispose());
  function enemy(x = 0, z = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); game.scene.add(group);
    const target = { hp: 1e6, group, size: 1, spawnSerial: 1, slowTime: 0, slowFactor: 1 };
    game.enemies.push(target); return target;
  }
  return { game, magic, enemy, hits };
}

const noImpact = hit => assert.deepEqual(hit.impact, { knockbackScale: 0, hitStun: 0 }, 'ice damage must not repeatedly push or stun a target');

test('frost rank and haste upgrades leave a real recovery interval at every rank', t => {
  const { game, magic } = fixture(t);
  near(magic.maxCooldown('frost'), 6);
  game.stats.spells.frost = 5;
  near(magic.maxCooldown('frost'), 5);
  game.stats.spellRate = 3;
  near(magic.maxCooldown('frost'), 2.75);
  game.stats.spellRate = 180;
  near(magic.maxCooldown('frost'), 2.75);
  for (let rank = 1; rank <= 5; rank++) {
    game.stats.spells.frost = rank;
    for (const rate of [1.5, 1.8, 3, 18, 180]) {
      game.stats.spellRate = rate;
      assert.ok(magic.maxCooldown('frost') >= 2.75, `rank ${rank} at rate ${rate} cannot continuously pulse`);
    }
  }
});

test('the frost haste limit does not slow down the other learned spells', t => {
  const { game, magic } = fixture(t, { spells: { fireball: 1, frost: 5, lightning: 1, orbit: 1 } });
  near(magic.maxCooldown('fireball'), 1.5);
  near(magic.maxCooldown('lightning'), 3);
  near(magic.maxCooldown('orbit'), .6);
  game.stats.spellRate = 18;
  near(magic.maxCooldown('fireball'), .125);
  near(magic.maxCooldown('lightning'), .25);
  near(magic.maxCooldown('orbit'), .05);
  near(magic.maxCooldown('frost'), 2.75);
});

test('normal frost keeps its damage and radius but applies only a short slow with no impact', t => {
  const { magic, enemy, hits } = fixture(t);
  const edge = enemy(6), outside = enemy(6.001);
  assert.equal(magic.castFrost(), true);
  assert.equal(hits.length, 1); assert.equal(hits[0].enemy, edge);
  near(hits[0].damage, 80); noImpact(hits[0]);
  assert.equal(hits[0].source, 'magic'); assert.equal(hits[0].spellId, 'frost');
  near(edge.slowTime, 1.4); near(edge.slowFactor, .6);
  assert.equal(outside.hp, 1e6); assert.equal(magic.zones.length, 0);
});

test('evolved frost remains a stronger damage wave without adding a push or stun', t => {
  const { magic, enemy, hits } = fixture(t, { spells: { frost: 5 }, evolutions: { frost: true } });
  const edge = enemy(9.5), outside = enemy(9.501);
  assert.equal(magic.castFrost(), true);
  assert.equal(hits.length, 1); assert.equal(hits[0].enemy, edge);
  near(hits[0].damage, 137.6); noImpact(hits[0]);
  near(edge.slowTime, 1.8); near(edge.slowFactor, .45);
  assert.equal(outside.hp, 1e6); assert.equal(magic.zones.length, 1);
});

test('a lingering blizzard has finite ticks and cannot prolong the pulse slow or apply impact', t => {
  const { magic, enemy, hits } = fixture(t, { spells: { frost: 5 }, evolutions: { frost: true } });
  const target = enemy(3); magic.castFrost(); hits.length = 0;
  near(magic.zones[0].life, 2.4);
  target.slowTime = 1.3;
  magic.updateZones(.5);
  near(target.slowTime, 1.3); near(target.slowFactor, .45);
  target.slowTime = .4;
  magic.updateZones(.9);
  near(target.slowTime, .4); near(target.slowFactor, .45);
  target.slowTime = 0;
  magic.updateZones(.9);
  near(target.slowTime, .7); near(target.slowFactor, .7);
  assert.equal(hits.length, 3);
  for (const hit of hits) { near(hit.damage, 34.4); noImpact(hit); }
  magic.updateZones(.2);
  assert.equal(magic.zones.length, 0);
  assert.equal(hits.length, 3, 'expired ground effects cannot keep hitting');
});

test('expired strong slows do not contaminate later weak applications, and weak ticks do not refresh active strong slows', t => {
  const { magic, enemy } = fixture(t);
  const target = enemy(1);
  target.slowTime = 0; target.slowFactor = .3;
  magic.hit(target, 1, new THREE.Vector3(), 1.4, .6, 'magic', 'frost');
  near(target.slowTime, 1.4); near(target.slowFactor, .6);
  target.slowTime = .2; target.slowFactor = .45;
  magic.hit(target, 1, new THREE.Vector3(), .7, .7, 'magic', 'frost');
  near(target.slowTime, .2); near(target.slowFactor, .45);
  target.slowTime = 0;
  magic.hit(target, 1, new THREE.Vector3(), .7, .7, 'magic', 'frost');
  near(target.slowTime, .7); near(target.slowFactor, .7);
});

test('ice shatter cannot inherit sword knockback while the separate fire combo retains its normal impact', t => {
  const { game, magic, enemy, hits } = fixture(t, { passiveLevels: { blade_range: 2 } });
  const struck = enemy(1), nearby = enemy(2);
  struck.slowTime = 1;
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 1); assert.equal(hits[0].enemy, nearby);
  assert.equal(hits[0].source, 'combo'); assert.equal(hits[0].spellId, null);
  near(hits[0].damage, 35); noImpact(hits[0]);
  hits.length = 0;
  game.stats.spells = { fireball: 1 }; game.stats.swordEvolution = 'wave';
  struck.slowTime = 0; struck.burnTime = 4;
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 1); near(hits[0].damage, 30);
  assert.equal(hits[0].impact, undefined, 'the frost fix is scoped to ice effects');
});
