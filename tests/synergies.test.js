import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicSystem } from '../src/magic.js';
import { SYNERGIES, getActiveSynergies } from '../src/synergies.js';

function fixture(stats = {}) {
  const hits = [], triggers = [];
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3(),rotation:{y:Math.PI/2} },
    enemies: [], _state: { phase: 'playing' },
    stats: { damage: 100, spellDamage: 100, spellRate: 1.5, spells: {}, passiveLevels: {}, ...stats },
    hitEnemy(enemy, damage, _direction, source, spellId) { hits.push({ enemy, damage, source, spellId }); enemy.hp -= damage; },
    recordSynergy(id) { triggers.push(id); },
  };
  const magic = new MagicSystem(game);
  function enemy(x = 0, z = 0) {
    const group = new THREE.Group(); group.position.set(x, 0, z); game.scene.add(group);
    const target = { hp: 1000, group, size: 1, spawnSerial: 1 }; game.enemies.push(target); return target;
  }
  return { game, magic, enemy, hits, triggers };
}

test('combos require chosen build prerequisites and never mutate the build', () => {
  assert.equal(SYNERGIES.length, 7);
  assert.deepEqual(getActiveSynergies(), []);
  assert.deepEqual(getActiveSynergies(null), []);
  assert.deepEqual(getActiveSynergies({ stage: 10, level: 99 }), []);
  const stats = { spells: { fireball: 1, frost: 1, lightning: 1, orbit: 1 }, passiveLevels: { blade_range: 2 }, swordEvolution: 'wave' };
  const before = structuredClone(stats);
  assert.deepEqual(getActiveSynergies(stats).map(combo => combo.id), ['shatter', 'flamewave', 'runelight']);
  assert.deepEqual(stats, before);
  stats.passiveLevels.blade_range = 1;
  stats.swordEvolution = 'broadsword';
  stats.spells.lightning = 0;
  assert.deepEqual(getActiveSynergies(stats), []);
});

test('a sword strike shatters a slowed enemy within a strict bounded radius and cooldown', () => {
  const { magic, enemy, hits, triggers } = fixture({ spells: { frost: 1 }, passiveLevels: { blade_range: 2 } });
  const struck = enemy(); struck.slowTime = 2;
  const nearby = enemy(2.2), outside = enemy(2.2001);
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.deepEqual(hits.map(hit => [hit.enemy === nearby, hit.damage, hit.source]), [[true, 35, 'combo']]);
  assert.equal(struck.hp, 1000, 'a splash cannot double-hit its direct sword target');
  assert.equal(outside.hp, 1000);
  assert.deepEqual(triggers, ['shatter']);
  assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 0.999;
  assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 1;
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 2);
  assert.ok(magic.effects.some(effect => effect.poolKey === 'ring:frost'));
  magic.dispose();
});

test('shatter needs both an actual slow and an earned second range upgrade', () => {
  const { game, magic, enemy, hits } = fixture({ spells: { frost: 1 }, passiveLevels: { blade_range: 1 } });
  const struck = enemy(); enemy(1);
  struck.slowTime = 1;
  assert.equal(magic.onSwordHit(struck, 100), false);
  game.stats.passiveLevels.blade_range = 2;
  struck.slowTime = 0;
  assert.equal(magic.onSwordHit(struck, 100), false);
  assert.equal(hits.length, 0);
  magic.dispose();
});

test('fireball marks targets, and the earned sword-wave branch spreads fire without recursive explosions', () => {
  const { game, magic, enemy, hits, triggers } = fixture({ spells: { fireball: 1 }, swordEvolution: 'wave' });
  const struck = enemy(), nearby = enemy(2.6), outside = enemy(2.6001);
  magic.explode(struck.group.position, 0.5, 10, false);
  assert.equal(struck.burnTime, 4);
  assert.equal(nearby.burnTime, undefined);
  hits.length = 0;
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.deepEqual(hits.map(hit => [hit.enemy === nearby, hit.damage, hit.source]), [[true, 30, 'combo']]);
  assert.equal(outside.hp, 1000);
  assert.deepEqual(triggers, ['flamewave']);
  assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 1;
  struck.burnTime = 0;
  assert.equal(magic.onSwordHit(struck, 100), false);
  struck.burnTime = 3;
  game.stats.swordEvolution = 'twinblade';
  assert.equal(magic.onSwordHit(struck, 100), false);
  magic.dispose();
});

test('native lightning-rune discharge works without its relic and remains independent of the relic timer', () => {
  const { game, magic, enemy, hits, triggers } = fixture({ spells: { lightning: 1, orbit: 1 } });
  enemy(3.5);
  magic.castOrbit(new THREE.Vector3()); magic.updateZones(.01); hits.length = 0;
  assert.equal(magic.updateBuildSynergy(), true);
  assert.equal(hits.length, 1); assert.equal(hits[0].damage, 35); assert.equal(hits[0].source, 'combo');
  assert.equal(magic.updateBuildSynergy(), false);
  assert.equal(magic.buildSynergyCooldown, 3);
  assert.equal(magic.synergyCooldown, 0, 'the relic retains its own independent timer');
  game.stats.runeSynergyBonus = .12;
  magic.updateRuneSynergy();
  assert.equal(hits.length, 2);
  assert.ok(Math.abs(hits[1].damage - 100 * 1.12 * .2) < 1e-9);
  assert.equal(magic.synergyCooldown, 4);
  assert.deepEqual(triggers, ['runelight']);
  magic.dispose();
});

test('combo cooldowns freeze while paused, clear between enemy lives and reset for a new run', () => {
  const { game, magic, enemy, hits } = fixture({ spells: { frost: 1 }, passiveLevels: { blade_range: 2 } });
  const struck = enemy(); struck.slowTime = 1; enemy(1);
  magic.onSwordHit(struck, 100);
  game._state.phase = 'paused'; magic.update(1);
  assert.equal(magic.time, 0);
  assert.equal(magic.onSwordHit(struck, 100), false);
  game._state.phase = 'playing';
  struck.spawnSerial++;
  assert.equal(magic.onSwordHit(struck, 100), true, 'a pooled object cannot retain its previous life cooldown');
  struck.burnTime = 4;
  magic.resetEnemyStatus(struck);
  assert.equal(struck.burnTime, 0);
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 3);
  magic.reset();
  assert.deepEqual(magic.getDebugState().comboTriggers, Object.fromEntries(SYNERGIES.map(combo => [combo.id, 0])));
  assert.equal(magic.onSwordHit(struck, 100), true);
  magic.dispose();
});

test('dense packs and repeated combo triggers retain bounded targets and effects', () => {
  const { magic, enemy, hits } = fixture({ spells: { frost: 1 }, passiveLevels: { blade_range: 2 } });
  const struck = enemy(); struck.slowTime = 1;
  for (let i = 0; i < 100; i++) enemy(1 + i * .001);
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 6);
  for (let i = 0; i < 100; i++) { magic.time += 1; magic.onSwordHit(struck, 1); }
  assert.ok(magic.effects.length <= 100);
  assert.ok(hits.length <= 606);
  assert.equal(magic.onSwordHit(struck, Infinity), false);
  assert.equal(magic.onSwordHit(struck, 0), false);
  magic.dispose();
});

test('actual spell and lingering impacts identify their spell while preserving magic as their source', () => {
  for (const id of ['fireball', 'frost', 'lightning', 'orbit']) {
    const { game, magic, enemy, hits } = fixture({ spells: { [id]: 5 }, evolutions: { [id]: true } });
    enemy(id === 'orbit' ? 5.5 : 2);
    if (id === 'fireball') magic.explode(new THREE.Vector3(), 4, 10, true);
    else if (id === 'frost') magic.castFrost();
    else if (id === 'lightning') magic.castLightning();
    else { magic.castOrbit(new THREE.Vector3()); magic.updateZones(.01); }
    assert.ok(hits.length > 0, `${id} has an actual impact`);
    assert.ok(hits.every(hit => hit.source === 'magic' && hit.spellId === id));
    if (id === 'fireball' || id === 'frost') {
      hits.length = 0;
      magic.updateZones(id === 'fireball' ? .35 : .8);
      assert.ok(hits.length > 0);
      assert.ok(hits.every(hit => hit.source === 'magic' && hit.spellId === id));
    }
    game.stats.spells = {};
    magic.dispose();
  }
});
