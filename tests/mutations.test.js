import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MUTATIONS, getMutationChance, rollMutations, MutationSystem } from '../src/mutations.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≈ ${expected}`);
const rng = seed => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32);

function fixture(stage = 1, capacity = 160) {
  const game = {
    _state: { stage, phase: 'playing' }, regionId: 'sanctum', scene: new THREE.Scene(), enemies: [],
    player: { position: new THREE.Vector3() }, damage: [], spawnOptions: [],
    groundHeight: () => 0,
    takeDamage(damage, position, cause) { this.damage.push({ damage, position: position.clone(), cause }); return true; },
    spawnEnemy(x, z, kind, options = {}) {
      const group = new THREE.Group(); group.position.set(x, 0, z);
      const enemy = { group, kind, hp: 100, maxHp: 100, speed: 4, rewardMultiplier: 1, baseDamageMultiplier: 1, size: 1,
        minion: !!options.minion, splitChild: !!options.splitChild };
      game.enemies.push(enemy); game.spawnOptions.push(options); system.apply(enemy, options); return enemy;
    },
  };
  const system = new MutationSystem(game, capacity);
  return { game, system, spawn: (ids, kind = 0) => game.spawnEnemy(0, 0, kind, { mutations: ids }) };
}

test('mutation chances rise gradually, regional weights bias different traits, and early floors never roll dual elites', () => {
  near(getMutationChance(1), .03); near(getMutationChance(10), .246);
  for (let stage = 2; stage <= 10; stage++) assert.ok(getMutationChance(stage) > getMutationChance(stage - 1));
  assert.ok(getMutationChance(10, 'void') > getMutationChance(10, 'forest'));
  assert.deepEqual(rollMutations(1, 'sanctum', () => 0), ['vampire']);
  assert.equal(rollMutations(8, 'void', () => 0).length, 2);
  assert.deepEqual(rollMutations(10, 'void', () => 1), []);
  const sample = (region, stage) => {
    const random = rng(741), counts = { total: 0, dual: 0, explosive: 0, splitter: 0 };
    for (let index = 0; index < 20000; index++) {
      const ids = rollMutations(stage, region, random);
      if (ids.length) counts.total++;
      if (ids.length === 2) counts.dual++;
      for (const id of ['explosive', 'splitter']) if (ids.includes(id)) counts[id]++;
      assert.equal(new Set(ids).size, ids.length); assert.ok(ids.length <= 2);
    }
    return counts;
  };
  const early = sample('sanctum', 1), late = sample('sanctum', 10), volcanic = sample('volcano', 10), forest = sample('forest', 10), voidRegion = sample('void', 10);
  assert.ok(early.total > 450 && early.total < 750); assert.equal(early.dual, 0);
  assert.ok(late.total > 4500 && late.total < 5300);
  assert.ok(volcanic.explosive > late.explosive * 1.8); assert.ok(forest.splitter > late.splitter * 1.7);
  assert.ok(voidRegion.dual > late.dual * 2);
});

test('mutations apply once, preserve shared monster resources, and exclude bosses, minions, split children and menu', () => {
  const { game, system, spawn } = fixture();
  const e = spawn(['steel', 'swift', 'steel', 'invalid']);
  assert.deepEqual(e.mutations, ['steel', 'swift']); assert.equal(e.mutationElite, true);
  near(e.maxHp, 135); near(e.rewardMultiplier, 2.25); near(e.mutationXpMultiplier, 1.9); near(e.speed, 3.9);
  const material = new THREE.MeshBasicMaterial({ color: 'red' }), visual = new THREE.Mesh(new THREE.BoxGeometry(), material); e.group.add(visual);
  system.apply(e, { mutations: ['vampire'] }); near(e.hp, 135); assert.deepEqual(e.mutations, ['steel', 'swift']);
  system.sync(); assert.equal(visual.material, material); assert.equal(material.color.getHexString(), 'ff0000');
  assert.deepEqual(spawn(['vampire'], 4).mutations, []);
  assert.deepEqual(game.spawnEnemy(0, 0, 1, { minion: true, mutations: ['splitter'] }).mutations, []);
  assert.deepEqual(game.spawnEnemy(0, 0, 1, { splitChild: true, mutations: ['splitter'] }).mutations, []);
  assert.deepEqual(game.spawnEnemy(0, 0, 1, { noMutations: true, mutations: ['splitter'] }).mutations, []);
  game._state.phase = 'menu'; assert.deepEqual(spawn(['vampire']).mutations, []);
  assert.equal(system.getDebugState().applied, 1);
  material.dispose(); visual.geometry.dispose(); system.dispose();
});

test('steel mitigation, low-health rage and actual-damage vampire healing obey bounded combat rules', () => {
  const { system, spawn } = fixture();
  const steel = spawn(['steel']); near(steel.speed, 3); near(steel.maxHp, 110);
  near(system.mitigateDamage(steel, 100), 70); assert.equal(system.mitigateDamage(steel, -1), 0); assert.equal(system.mitigateDamage(steel, NaN), 0);
  const rage = spawn(['berserker', 'swift']); rage.hp = rage.maxHp * .34; system.updateEnemy(rage);
  near(rage.speed, 4 * 1.3 * 1.3); near(rage.mutationAttackRate, 1.45);
  rage.mutationContactCooldown = 1.15 / rage.mutationAttackRate;
  system.updateEnemy(rage, .5); assert.ok(rage.mutationContactCooldown > 0);
  system.updateEnemy(rage, .3); near(rage.mutationContactCooldown, 0);
  for (let index = 0; index < 100; index++) system.updateEnemy(rage);
  near(rage.speed, 4 * 1.3 * 1.3);
  rage.hp = rage.maxHp; system.updateEnemy(rage); near(rage.speed, 4 * 1.3); near(rage.mutationAttackRate, 1);
  const vampire = spawn(['vampire']); vampire.hp = 20;
  near(system.onPlayerHit(vampire, 10), 4.5); near(vampire.hp, 24.5);
  near(system.onPlayerHit(vampire, 1e6), 8.8); near(system.onPlayerHit(vampire, 0), 0);
  vampire.hp = vampire.maxHp - 1; near(system.onPlayerHit(vampire, 10), 1); near(vampire.hp, vampire.maxHp);
  vampire.hp = 0; near(system.onPlayerHit(vampire, 10), 0);
  system.dispose();
});

test('explosive deaths have a full warning, pause correctly, respect radius and keep at most twelve queued blasts', () => {
  const { game, system, spawn } = fixture();
  const enemy = spawn(['explosive']); enemy.hp = 0;
  system.onDeath(enemy); system.onDeath(enemy); assert.equal(system.explosions.length, 1);
  system.update(.9); assert.equal(game.damage.length, 0); assert.equal(system.warningMesh.count, 1);
  game._state.phase = 'paused'; system.update(10); assert.equal(system.explosions.length, 1); assert.equal(game.damage.length, 0);
  game._state.phase = 'playing'; system.update(.11); assert.equal(game.damage.length, 1); assert.equal(system.explosions.length, 0);
  for (let index = 0; index < 30; index++) { const target = spawn(['explosive']); target.hp = 0; system.onDeath(target); }
  assert.equal(system.explosions.length, 12); game.player.position.set(3, 0, 0); system.update(1.01);
  assert.equal(game.damage.length, 1, 'walking outside the marked radius avoids all queued blasts');
  assert.equal(system.getDebugState().explosions, 13); system.dispose();
});

test('splitting creates only weak, nonmutating children, does not duplicate natural splitters and respects stage enemy limits', () => {
  const { game, system, spawn } = fixture();
  const enemy = spawn(['splitter']); enemy.hp = 0; game.enemies.splice(game.enemies.indexOf(enemy), 1);
  system.onDeath(enemy); system.onDeath(enemy);
  assert.equal(game.enemies.length, 2); assert.equal(system.getDebugState().children, 2);
  for (const child of game.enemies) { assert.ok(child.minion && child.splitChild); assert.deepEqual(child.mutations, []); system.onDeath(child); }
  assert.equal(game.enemies.length, 2);
  const natural = spawn(['splitter'], 7); natural.hp = 0; system.onDeath(natural);
  assert.equal(system.getDebugState().children, 2, 'native splitter death stays owned by the original death hook');
  while (game.enemies.length < 56) spawn([]);
  const last = game.enemies[0]; last.mutations = ['splitter']; last.minion = last.splitChild = false; last.mutationDeathHandled = false;
  system.onDeath(last); assert.equal(game.enemies.length, 56); assert.equal(system.getDebugState().children, 2);
  system.dispose();
});

test('mutation visual instances remain bounded, distinguish every trait and dispose without touching original actors', () => {
  const { game, system, spawn } = fixture(10);
  for (let index = 0; index < 180; index++) spawn([MUTATIONS[index % 6].id, MUTATIONS[(index + 1) % 6].id]);
  const random = Math.random;
  try { Math.random = () => { throw new Error('visual sync must not consume gameplay randomness'); }; system.sync(); } finally { Math.random = random; }
  assert.equal(system.getDebugState().markers, 320); assert.equal(game.scene.children.length, 7);
  assert.ok([...system.markers.values()].every(marker => marker.mesh.count <= 160));
  const meshes = [...system.markers.values()].map(marker => marker.mesh); let disposed = 0;
  for (const mesh of meshes) mesh.geometry.addEventListener('dispose', () => disposed++);
  system.reset(); assert.equal(system.getDebugState().markers, 0); assert.equal(system.getDebugState().warningCount, 0);
  system.dispose(); system.dispose(); assert.equal(game.scene.children.length, 0); assert.equal(disposed, 6);
  assert.equal(game.enemies.length, 180);
});

test('death explosion warnings follow sloped terrain at every vertex and release their batch on reset', () => {
  const { game, system, spawn } = fixture();
  game.groundHeight = (x, z) => x * .4 + z * .2;
  const foe = spawn(['explosive']); foe.hp = 0; system.onDeath(foe); system.sync();
  const geometry = system.warningMesh.geometry, positions = geometry.attributes.position;
  assert.ok(geometry.drawRange.count > 0);
  for (let vertex = 0; vertex < geometry.drawRange.count; vertex++) {
    assert.ok(Math.abs(positions.getY(vertex) - game.groundHeight(positions.getX(vertex), positions.getZ(vertex)) - .17) < 1e-6);
  }
  system.reset(); assert.equal(geometry.drawRange.count, 0); assert.equal(system.warningMesh.visible, false);
  system.dispose();
});
