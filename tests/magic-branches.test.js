import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicSystem } from '../src/magic.js';
import { applyUpgrade, getUpgradeChoices } from '../src/balance.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
function fixture() {
  const hits = [];
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3(),rotation:{y:Math.PI/2} },
    _state: { phase: 'playing' }, enemies: [],
    stats: { damage: 18, spellDamage: 18, attackRate: 1.5, spellRate: 1.5, maxHp: 100, speed: 7.5, magnet: 5.5, armor: 0, critChance: .08, regen: 0, spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 }, evolutions: {}, passiveLevels: {} },
    hitEnemy(enemy, damage, direction, source) { hits.push({ enemy, damage, direction: direction.clone(), source }); enemy.hp -= damage; },
  };
  function enemy(x, z = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); game.scene.add(group);
    const target = { hp: 1e6, group, size: 1 }; game.enemies.push(target); return target;
  }
  return { game, magic: new MagicSystem(game), hits, enemy };
}

test('sword damage and magic damage upgrades affect separate real attack outputs', () => {
  const { game, magic, enemy } = fixture(); enemy(5);
  magic.castFireball(); const baseline = magic.projectiles.at(-1).damage;
  assert.equal(applyUpgrade(game.stats, 'power'), true);
  magic.castFireball(); close(magic.projectiles.at(-1).damage, baseline);
  close(game.stats.damage, 18 * 1.2); close(game.stats.spellDamage, 18);
  assert.equal(applyUpgrade(game.stats, 'spell_power'), true);
  magic.castFireball(); close(magic.projectiles.at(-1).damage, baseline * 1.2);
  close(game.stats.damage, 18 * 1.2);
  magic.dispose();
});

test('sword speed cannot accelerate magic; independent magic speed does', () => {
  const { game, magic } = fixture();
  const baseline = magic.maxCooldown('fireball');
  applyUpgrade(game.stats, 'haste'); close(magic.maxCooldown('fireball'), baseline);
  applyUpgrade(game.stats, 'spell_haste'); close(magic.maxCooldown('fireball'), baseline / 1.08**.12);
  close(game.stats.attackRate, 1.5 * 1.08);
  for (let i = 1; i < 12; i++) assert.equal(applyUpgrade(game.stats, 'spell_haste'), true);
  assert.equal(applyUpgrade(game.stats, 'spell_haste'), false);
  magic.dispose();
});

test('level-up keeps usable spells and utility while offering separate attack branches', () => {
  const seen = new Set();
  for (let index = 0; index < 20; index++) {
    const { game, magic } = fixture();
    const choices = getUpgradeChoices(game.stats, () => index / 20);
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(choice => choice.id)).size, 3);
    assert.ok(choices.some(choice => choice.spellId));
    assert.ok(choices.some(choice => choice.branch === 'core'));
    for (const choice of choices) { seen.add(choice.id); assert.equal(applyUpgrade(game.stats, choice.id), true); }
    magic.dispose();
  }
  assert.ok(seen.has('power') && seen.has('spell_power') && seen.has('spell_haste'));
});

test('frostfire requires both the relic and slowed target, with a visible steam burst', () => {
  const { game, magic, enemy, hits } = fixture();
  const normal = enemy(1), frozen = enemy(2); frozen.slowTime = 2;
  magic.explode(new THREE.Vector3(), 3, 100, false);
  assert.deepEqual(hits.map(hit => hit.damage), [100, 100]);
  hits.length = 0; game.stats.frostfireBonus = .2;
  magic.explode(new THREE.Vector3(), 3, 100, false);
  close(hits.find(hit => hit.enemy === normal).damage, 100);
  close(hits.find(hit => hit.enemy === frozen).damage, 120);
  assert.ok(hits.every(hit => hit.source === 'magic'));
  assert.ok(magic.effects.some(effect => effect.poolKey === 'ring:steam'));
  assert.equal(magic.getDebugState().synergyHits, 1);
  magic.dispose();
});

test('lightning-rune synergy needs both spells and obeys a four-second discharge limit', () => {
  const { game, magic, enemy, hits } = fixture(); enemy(3.5);
  game.stats.runeSynergyBonus = .12; game.stats.spells.orbit = 1;
  close(magic.damage(), 18);
  magic.castOrbit(new THREE.Vector3()); magic.updateOrbit(.01); hits.length = 0;
  magic.updateRuneSynergy(); assert.equal(hits.length, 0);
  game.stats.spells.lightning = 1;
  close(magic.damage(), 18 * 1.12);
  magic.updateRuneSynergy(); assert.equal(hits.length, 1);
  close(hits[0].damage, 18 * 1.12 * .2);
  magic.updateRuneSynergy(); assert.equal(hits.length, 1);
  assert.ok(magic.effects.some(effect => effect.type === 'line'));
  magic.dispose();
});

test('spell visuals retain reusable meshes and bounded active effects under repeated casts', () => {
  const { magic, enemy } = fixture(); enemy(5);
  magic.castFireball(); const projectileMesh = magic.projectiles[0].mesh;
  magic.reset(); magic.castFireball(); assert.equal(magic.projectiles[0].mesh, projectileMesh);
  magic.ring(new THREE.Vector3(), 3, 'fireball'); const ringMesh = magic.effects.at(-1).mesh;
  magic.updateEffects(1); magic.ring(new THREE.Vector3(), 3, 'fireball');
  assert.equal(magic.effects.at(-1).mesh, ringMesh);
  magic.lightningLine(new THREE.Vector3(), new THREE.Vector3(5, 0, 0), .1, 1);
  const lineMesh = magic.effects.at(-1).mesh;
  magic.updateEffects(1);
  magic.lightningLine(new THREE.Vector3(), new THREE.Vector3(0, 0, 5), .1, 1);
  assert.equal(magic.effects.at(-1).mesh, lineMesh);
  for (let i = 0; i < 1000; i++) magic.spark(new THREE.Vector3(), 'orbit');
  assert.ok(magic.effects.length <= 100);
  magic.reset(); assert.equal(magic.effects.length, 0); assert.equal(magic.projectiles.length, 0);
  assert.ok(magic.getDebugState().pooledEffects > 0);
  magic.dispose(); assert.equal(magic.meshPools.size, 0);
});
