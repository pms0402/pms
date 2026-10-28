import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { REGIONS, getRegion, getRegionModifiers, getRegionChoices, getRegionalEnemyPool, chooseRegionalEnemyKind, getRegionRelicChoices } from '../src/regions.js';
import { RELICS } from '../src/content.js';
import { RegionSystem } from '../src/region-system.js';
import { getEnemyPool } from '../src/encounters.js';

function fixture() {
  const scene = new THREE.Scene(), player = new THREE.Group(), damage = [];
  const game = { scene, player, _state: { phase: 'playing', stage: 3 }, enemies: [], stats: { damage: 18 }, groundHeight: () => 0, world: { isWalkable: () => true }, takeDamage: (...args) => { damage.push(args); return true; }, spawnPosition: () => ({ x: 8, z: 0 }) };
  const regions = new RegionSystem(game); return { game, regions, damage };
}
function step(system, seconds) { for (let t = 0; t < seconds - .00001; t += .05) system.update(.05); }
function enemy(kind, x = 0) { const group = new THREE.Group(); group.position.x = x; return { kind, group, size: 1, hp: 100, maxHp: 100, action: 'chase' }; }

test('region offers are three distinct alternatives, final floor stays unique and neutral', () => {
  for (const random of [() => 0, () => .999, () => NaN, () => Infinity]) for (const previous of [undefined, ...REGIONS.map(r => r.id)]) {
    const choices = getRegionChoices(3, previous, random);
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(r => r.id)).size, 3); assert.ok(choices.every(r => r.id !== previous));
  }
  assert.deepEqual(getRegionChoices(10, 'volcano').map(r => r.id), ['throne']);
  for (const id of ['sanctum', 'throne', 'invalid']) assert.deepEqual(getRegionModifiers(id), { enemyHealth: 1, enemyDamage: 1, goldMultiplier: 1, spawnMultiplier: 1, eliteMultiplier: 1, chestBonus: 0 });
  for (const region of REGIONS) { assert.ok(region.goldMultiplier > 1 && region.enemyHealth > 1 && region.enemyDamage > 1); assert.ok(region.hazard && region.reward && region.counterplay); }
});

test('regional pools retain basic enemies, unlock themed specialists deliberately and never spawn bosses', () => {
  assert.deepEqual(getRegionalEnemyPool(1, 'sanctum'), getEnemyPool(1));
  assert.ok(getRegionalEnemyPool(2, 'volcano').some(e => e.kind === 6));
  assert.ok(getRegionalEnemyPool(2, 'tundra').some(e => e.kind === 3));
  assert.ok(getRegionalEnemyPool(3, 'forest').some(e => e.kind === 7));
  for (const region of REGIONS) for (let floor = 1; floor <= 10; floor++) {
    const pool = getRegionalEnemyPool(floor, region.id);
    assert.ok(pool.some(e => e.kind === 0));
    for (const value of [-1, 0, .5, 1, Infinity, NaN]) assert.ok(pool.some(e => e.kind === chooseRegionalEnemyKind(floor, region.id, () => value) && e.kind !== 4));
  }
});

test('chest relic affinity guarantees an unowned themed offer without awarding or duplicating relics', () => {
  for (const region of REGIONS) for (const value of [0, .4, .999]) {
    const stats = { relics: [], damage: 18 }, before = JSON.stringify(stats), choices = getRegionRelicChoices(stats, region.id, () => value);
    assert.equal(choices.length, 3); assert.equal(new Set(choices.map(c => c.id)).size, 3); assert.equal(JSON.stringify(stats), before);
    assert.ok(choices.some(choice => region.id === 'ruins' ? ['epic', 'legendary'].includes(choice.rarity) : region.relicAffinity.includes(choice.id)));
  }
  assert.deepEqual(getRegionRelicChoices({ relics: RELICS.map(r => r.id) }, 'ruins'), []);
  const one = RELICS.at(-1); assert.deepEqual(getRegionRelicChoices({ relics: RELICS.slice(0, -1).map(r => r.id) }, 'tundra').map(r => r.id), [one.id]);
});

test('lava and poison are delayed, avoidable, capped, phase frozen and cleared on region change', () => {
  const { game, regions, damage } = fixture();
  regions.setRegion('volcano'); regions.hazardTimer = 1e6;
  regions.spawnHazard('lava', game.player.position); step(regions, 1.35); assert.equal(damage.length, 0);
  game._state.phase = 'region'; step(regions, 2); assert.equal(regions.hazards[0].elapsed.toFixed(2), '1.35');
  game._state.phase = 'playing'; game.player.position.x = 5; step(regions, .5); assert.equal(damage.length, 0);
  regions.spawnHazard('lava', game.player.position); step(regions, 1.5); assert.equal(damage.length, 1);
  step(regions, .5); assert.equal(damage.length, 1);
  regions.setRegion('forest'); regions.hazardTimer = 1e6;
  for (let i = 0; i < 10; i++) regions.spawnHazard('poison', new THREE.Vector3(20 + i, 0, 0));
  assert.equal(regions.hazards.length, 4); step(regions, 1.7); assert.equal(damage.length, 1); assert.equal(regions.areaMesh.count, 4);
  regions.setRegion('sanctum'); assert.equal(regions.hazards.length, 0); assert.equal(regions.ambient.visible, false); assert.equal(regions.accentMesh.visible, false); assert.equal(regions.markerMesh.count, 0);
  regions.dispose(); assert.equal(game.scene.children.length, 0);
});

test('regional hit effects are temporary, nonstacking, and never alter player base stats', () => {
  const { game, regions, damage } = fixture(), foe = enemy(3), original = JSON.stringify(game.stats);
  regions.setRegion('tundra'); regions.decorateEnemy(foe); assert.equal(foe.regionElement, 'frost'); regions.onEnemyPlayerHit(foe);
  assert.equal(regions.movementMultiplier(), .82); step(regions, 1); assert.equal(regions.movementMultiplier(), 1);
  foe.slowTime = 1; assert.equal(regions.damageMultiplier(foe, 'frost'), 1.1); assert.equal(regions.damageMultiplier(foe, 'fireball'), 1);
  regions.setRegion('forest'); regions.decorateEnemy(foe); regions.onEnemyPlayerHit(foe); regions.onEnemyPlayerHit(foe); step(regions, 2.8);
  assert.equal(damage.length, 3); assert.equal(JSON.stringify(game.stats), original); assert.equal(regions.poisonRemaining, 0); regions.dispose();
});

test('void blink respects telegraph, safe radius, walls, enemy death and render budgets', () => {
  const { game, regions } = fixture(), foe = enemy(3, 15); game.enemies.push(foe);
  regions.setRegion('void'); regions.decorateEnemy(foe); regions.blinkTimer = 1e6;
  assert.equal(regions.startBlink(), true); step(regions, 1.15); assert.equal(foe.group.position.x, 15);
  step(regions, .1); assert.equal(foe.group.position.x, 8); assert.equal(regions.blinks, 1);
  step(regions, .3); foe.group.position.x = 15; regions.startBlink(); game.player.position.x = 8; step(regions, 1.5); assert.equal(foe.group.position.x, 15);
  game.player.position.x = 0; game.world.isWalkable = () => false; assert.equal(regions.startBlink(), false);
  game.world.isWalkable = () => true; regions.startBlink(); foe.hp = 0; step(regions, 1.5); assert.equal(foe.group.position.x, 15);
  for (let i = 0; i < 200; i++) { const e = enemy(3, i); regions.decorateEnemy(e); game.enemies.push(e); }
  regions.update(.05); assert.equal(regions.markerMesh.count, 160); assert.equal(regions.getDebugState().renderBatchLimit, 5); regions.dispose();
});

test('regional danger boundaries follow hills while sharing fixed terrain batches', () => {
  const { game, regions } = fixture();
  game.groundHeight = (x, z) => .3 * x + .5 * z;
  regions.setRegion('volcano'); regions.spawnHazard('lava', new THREE.Vector3(4, 0, 2)); regions.update(.05);
  const geometry = regions.warningMesh.geometry, positions = geometry.attributes.position;
  assert.ok(geometry.drawRange.count > 0);
  for (let vertex = 0; vertex < 72; vertex++) {
    assert.ok(Math.abs(positions.getY(vertex) - game.groundHeight(positions.getX(vertex), positions.getZ(vertex)) - .065) < 1e-6);
  }
  assert.equal(regions.getDebugState().renderBatchLimit, 5); regions.dispose();
});
