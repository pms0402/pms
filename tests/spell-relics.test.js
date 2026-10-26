import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicSystem } from '../src/magic.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-12), `${actual} ≈ ${expected}`);

function fixture(bonuses = {}, evolvedSpell = null) {
  const hits = [];
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3() },
    enemies: [], _state: { phase: 'playing' },
    stats: {
      damage: 18, spellDamage: 18, spellRate: 1.5, spellAreaMultiplier: 1,
      spells: { fireball: 1, frost: 1, lightning: 1, orbit: 1 }, evolutions: {}, ...bonuses,
    },
    hitEnemy(enemy, damage, _direction, source) { hits.push({ enemy, damage, source }); enemy.hp -= damage; },
  };
  if (evolvedSpell) { game.stats.spells[evolvedSpell] = 5; game.stats.evolutions[evolvedSpell] = true; }
  const enemy = x => {
    const group = new THREE.Group(); group.position.x = x;
    const target = { hp: 1e15, group, size: 1 }; game.enemies.push(target); game.scene.add(group); return target;
  };
  return { game, magic: new MagicSystem(game), hits, enemy };
}

function actualHit(spell, bonuses = {}) {
  const { magic, enemy, hits } = fixture(bonuses);
  enemy(spell === 'orbit' ? 3.5 : 2);
  if (spell === 'fireball') { magic.castFireball(); magic.updateProjectiles(.1); }
  else if (spell === 'frost') magic.castFrost();
  else if (spell === 'lightning') magic.castLightning();
  else { magic.syncOrbit(); magic.updateOrbit(.01); }
  assert.ok(hits.length > 0, `${spell} must actually hit the target`);
  assert.equal(hits[0].source, 'magic');
  const dealt = hits[0].damage;
  magic.dispose();
  return dealt;
}

test('each specialist relic adds 25% to its own real spell hits without increasing another spell', () => {
  for (const spell of ['fireball', 'frost', 'lightning', 'orbit']) {
    const bonuses = { [`${spell}Bonus`]: .25 };
    const baseline = actualHit(spell);
    close(actualHit(spell, bonuses), baseline * 1.25);
    const other = spell === 'fireball' ? 'lightning' : 'fireball';
    close(actualHit(other, bonuses), actualHit(other));
  }
});

test('evolved fireball embers and frost blizzards inherit the specialist bonus exactly once', () => {
  for (const spell of ['fireball', 'frost']) {
    const results = [];
    for (const bonus of [0, .25]) {
      const { magic, enemy, hits } = fixture({ [`${spell}Bonus`]: bonus }, spell);
      enemy(2);
      if (spell === 'fireball') { magic.castFireball(); magic.updateProjectiles(.1); }
      else magic.castFrost();
      const initial = hits[0].damage;
      hits.length = 0;
      magic.updateZones(spell === 'fireball' ? .33 : .5);
      assert.ok(hits.length > 0, `${spell}'s actual lingering zone must hit`);
      const lingering = hits[0].damage;
      close(lingering, initial * (spell === 'fireball' ? .55 : .25));
      results.push({ initial, lingering });
      magic.dispose();
    }
    close(results[1].initial, results[0].initial * 1.25);
    close(results[1].lingering, results[0].lingering * 1.25);
  }
});

test('purchased area and the expansion relic reach enemies beyond the former area cap', () => {
  const { game, magic, enemy, hits } = fixture({ spellAreaMultiplier: 1.4 });
  const target = enemy(9.5);
  assert.equal(magic.castFrost(), false, 'base purchased area cannot yet reach this target');
  game.stats.spellAreaMultiplier *= 1.18;
  close(magic.area(), 1.652);
  assert.equal(magic.castFrost(), true);
  assert.ok(hits.some(hit => hit.enemy === target), 'the additional purchased/relic range must cause a real hit');
  game.stats.spellAreaMultiplier = 1e9;
  assert.equal(magic.area(), 2.5, 'corrupted stats do not create an unbounded map-wide query');
  magic.dispose();
});

test('higher permanent casting speed and the hourglass both apply within the bounded cast rate', () => {
  const { game, magic } = fixture();
  const baseline = magic.maxCooldown('fireball');
  const permanent = 1.025 ** 40;
  game.stats.spellRate = 1.5 * permanent;
  close(magic.maxCooldown('fireball'), baseline / permanent);
  game.stats.spellRate *= 1.2;
  close(magic.maxCooldown('fireball'), baseline / (permanent * 1.2));
  assert.ok(magic.maxCooldown('fireball') < baseline / 2.5, 'the old hidden haste cap no longer swallows purchased growth');
  game.stats.spellRate = 1e9;
  close(magic.maxCooldown('fireball'), baseline / 12);
  magic.dispose();
});

test('large damage growth stays finite and remains independent of sword damage', () => {
  const spellDamage = 18 * 1.12 ** 50 * 3.2 ** 4;
  const baseline = actualHit('fireball', { spellDamage, damage: 1 });
  close(baseline, spellDamage * 1.1);
  close(actualHit('fireball', { spellDamage, damage: 1e12, fireballBonus: .25 }), baseline * 1.25);
  assert.ok(Number.isFinite(baseline) && baseline > 1e5);
});
