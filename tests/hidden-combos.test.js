import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MagicSystem } from '../src/magic.js';
import { getActiveSynergies } from '../src/synergies.js';

function fixture(t, stats = {}) {
  const hits = [], notices = [], triggers = [];
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3(),rotation:{y:Math.PI/2} }, enemies: [],
    _state: { phase: 'playing' },
    stats: { damage: 100, spellDamage: 100, spellRate: 1.5, spells: {}, evolutions: {}, relics: [], ...stats },
    callbacks: { onLoot(message) { notices.push(message); } },
    recordSynergy(id) { triggers.push(id); },
    hitEnemy(enemy, damage, _direction, source, spellId, impact) {
      hits.push({ enemy, damage, source, spellId, impact }); enemy.hp -= damage;
    },
  };
  const magic = new MagicSystem(game); t.after(() => magic.dispose());
  const enemy = (x = 0, z = 0, kind = 0) => {
    const group = new THREE.Group(); group.position.set(x, 0, z); game.scene.add(group);
    const target = { hp: 1e6, group, size: 1, spawnSerial: game.enemies.length + 1, slowTime: 0, slowFactor: 1, kind };
    game.enemies.push(target); return target;
  };
  return { game, magic, enemy, hits, notices, triggers };
}

const comboBuild = {
  firestorm: { spells: { fireball: 5 }, evolutions: { fireball: true }, swordEvolution: 'twinblade' },
  absoluteZero: { spells: { frost: 5 }, evolutions: { frost: true }, relics: ['glacier'] },
  thunderJudgment: { spells: { lightning: 5 }, evolutions: { lightning: true }, swordEvolution: 'wave' },
  voidBurst: { spells: { orbit: 5 }, evolutions: { orbit: true }, relics: ['arcanePrism'] },
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≈ ${b}`);
const onlySafeComboHits = hits => {
  assert.ok(hits.length);
  for (const hit of hits) {
    assert.equal(hit.source, 'combo'); assert.equal(hit.spellId, null);
    assert.deepEqual(hit.impact, { knockbackScale: 0, hitStun: 0 });
  }
};

test('hidden combos require an earned evolution and the named blade or relic without stat mutation', () => {
  for (const [id, source] of Object.entries(comboBuild)) {
    const build = structuredClone(source), before = structuredClone(build);
    assert.deepEqual(getActiveSynergies(build).filter(combo => combo.hidden).map(combo => combo.id), [id]);
    assert.deepEqual(build, before);
    build.evolutions = {};
    assert.equal(getActiveSynergies(build).some(combo => combo.id === id), false);
    build.evolutions = source.evolutions; build.spells = Object.fromEntries(Object.keys(source.spells).map(key => [key, 4]));
    assert.equal(getActiveSynergies(build).some(combo => combo.id === id), false);
  }
  assert.ok(getActiveSynergies({ ...comboBuild.absoluteZero, relics: ['frostfire'] }).some(combo => combo.id === 'absoluteZero'));
  assert.ok(getActiveSynergies({ ...comboBuild.voidBurst, relics: ['blast'] }).some(combo => combo.id === 'voidBurst'));
});

test('unlock notifications appear once per run, survive floor cleanup and reset for a new run', t => {
  const { game, magic, notices } = fixture(t, comboBuild.firestorm);
  const before = JSON.stringify(game.stats);
  magic.refreshSynergies(); magic.refreshSynergies(); magic.update(.01);
  assert.equal(notices.length, 1); assert.match(notices[0], /조합 해금.*화염 폭풍/);
  assert.equal(JSON.stringify(game.stats), before);
  magic.reset({ preserveUnlocks: true }); magic.refreshSynergies();
  assert.equal(notices.length, 1);
  magic.reset(); magic.refreshSynergies();
  assert.equal(notices.length, 2);
});

test('firestorm chance, four timed ticks, radius, target cap and cooldown apply to actual sword hooks', t => {
  const { magic, enemy, hits, triggers } = fixture(t, comboBuild.firestorm);
  const struck = enemy(); for (let i = 0; i < 10; i++) enemy(.5 + i * .1);
  const outside = enemy(3.21);
  const random = t.mock.method(Math, 'random', () => .9);
  assert.equal(magic.onSwordHit(struck, 100), false);
  random.mock.mockImplementation(() => .24);
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(magic.zones.length, 1); assert.equal(hits.length, 0);
  assert.equal(magic.onSwordHit(struck, 100), false);
  for (let tick = 1; tick <= 4; tick++) {
    magic.time = tick * .6; magic.updateZones(.6);
    assert.equal(hits.length, tick * 6);
  }
  magic.updateZones(.01); assert.equal(magic.zones.length, 0);
  assert.equal(outside.hp, 1e6); assert.ok(hits.every(hit => hit.damage === 35));
  onlySafeComboHits(hits); assert.deepEqual(triggers, ['firestorm']);
  magic.time = 3.99; assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 4; assert.equal(magic.onSwordHit(struck, 100), true);
});

test('absolute zero requires continuous slowing, freezes briefly, respects per-target recovery and leaves bosses mobile', t => {
  const { magic, enemy, hits } = fixture(t, comboBuild.absoluteZero);
  const normal = enemy(), boss = enemy(1, 0, 4), active = getActiveSynergies(magic.game.stats);
  normal.slowTime = boss.slowTime = 2;
  magic.updateAbsoluteZero(.5, active); assert.equal(hits.length, 0);
  normal.slowTime = 0; magic.updateAbsoluteZero(.1, active);
  normal.slowTime = 2; magic.updateAbsoluteZero(.5, active);
  assert.equal(hits.length, 1); assert.equal(hits[0].enemy, boss);
  assert.equal(boss.freezeTime, undefined);
  magic.updateAbsoluteZero(.5, active);
  assert.equal(hits.length, 2); close(normal.freezeTime, .45);
  onlySafeComboHits(hits); assert.ok(hits.every(hit => hit.damage === 65));
  magic.time = 5.99; magic.updateAbsoluteZero(1, active); assert.equal(hits.length, 2);
  magic.time = 6; magic.updateAbsoluteZero(.01, active); assert.equal(hits.length, 4);
});

test('absolute zero caps mass freezing and resets status when a pooled enemy begins a new life', t => {
  const { magic, enemy, hits } = fixture(t, comboBuild.absoluteZero);
  const active = getActiveSynergies(magic.game.stats);
  for (let i = 0; i < 20; i++) enemy(i).slowTime = 10;
  magic.updateAbsoluteZero(1, active); assert.equal(hits.length, 6);
  magic.updateAbsoluteZero(1, active); assert.equal(hits.length, 6);
  magic.time = 2; magic.updateAbsoluteZero(.1, active); assert.equal(hits.length, 12);
  const target = hits[0].enemy;
  magic.resetEnemyStatus(target); assert.equal(target.freezeTime, 0);
  magic.time = 4; target.slowTime = 10; target.spawnSerial++;
  magic.updateAbsoluteZero(1, active);
  assert.ok(hits.filter(hit => hit.enemy === target).length === 2);
});

test('thunder judgment has global and per-target recovery with a strict radius and five-target cap', t => {
  const { magic, enemy, hits, triggers } = fixture(t, comboBuild.thunderJudgment);
  const struck = enemy(); for (let i = 0; i < 10; i++) enemy(1 + i * .1);
  const outside = enemy(3.401);
  assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 5); assert.ok(hits.every(hit => hit.damage === 75));
  assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 2.999; assert.equal(magic.onSwordHit(struck, 100), false);
  magic.time = 3; assert.equal(magic.onSwordHit(struck, 100), true);
  assert.equal(hits.length, 10); assert.equal(outside.hp, 1e6);
  onlySafeComboHits(hits); assert.deepEqual(triggers, ['thunderJudgment', 'thunderJudgment']);
});

test('void burst is fed by real direct orbit hits, limits repeated target counts and cannot recurse from its explosion', t => {
  const { magic, enemy, hits, triggers } = fixture(t, comboBuild.voidBurst);
  const target = enemy(1), outside = enemy(10);
  magic.castOrbit(new THREE.Vector3());
  for (let i = 0; i < 8; i++) {
    magic.time=i*.81;magic.updateZones(i===0?.001:.81);
  }
  const burstHits = hits.filter(hit => hit.source === 'combo');
  assert.equal(burstHits.length, 1); close(burstHits[0].damage, 120);
  assert.equal(burstHits[0].enemy, target); assert.equal(outside.hp, 1e6);
  onlySafeComboHits(burstHits); assert.deepEqual(triggers, ['voidBurst']);
  assert.equal(magic.voidHitCount, 0);
  for (let i = 0; i < 100; i++) magic.onOrbitHit(target, target.group.position);
  assert.equal(magic.voidHitCount, 0, 'cooldown hits cannot precharge the next explosion');
  magic.time += 3.5;
  for (let i = 0; i < 100; i++) magic.onOrbitHit(target, target.group.position);
  assert.equal(magic.voidHitCount, 1, 'same-target count requires 0.4 seconds');
});

test('new combo cooldowns and effects stay frozen while paused, bounded under repeated procs and removable on reset', t => {
  const { game, magic, enemy } = fixture(t, comboBuild.firestorm);
  const target = enemy(); t.mock.method(Math, 'random', () => 0);
  magic.onSwordHit(target, 1);
  const before = magic.getDebugState(); game._state.phase = 'paused'; magic.update(1);
  assert.deepEqual(magic.getDebugState(), before);
  assert.equal(magic.onSwordHit(target, 1), false);
  game._state.phase = 'playing';
  for (let i = 0; i < 100; i++) { magic.time += 4; magic.onSwordHit(target, 1); }
  assert.equal(magic.zones.length, 12);
  assert.ok(magic.effects.length <= 100);
  magic.reset(); assert.equal(magic.zones.length, 0); assert.equal(magic.effects.length, 0);
  assert.deepEqual(magic.getDebugState().unlockedSynergies, []);
  assert.equal(magic.voidHitCount, 0);
});
