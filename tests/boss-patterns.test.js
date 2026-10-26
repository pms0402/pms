import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossSystem } from '../src/bosses.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≈ ${expected}`);
function fixture(archetype, stage = 2) {
  const hits = [], shots = [], summons = [];
  const group = new THREE.Group(), visual = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#615061' });
  visual.add(new THREE.Mesh(new THREE.BoxGeometry(), material)); group.add(visual);
  group.position.set(12, 0, 0);
  const boss = { archetype, group, visual, hp: 1000, maxHp: 1000, speed: 2.6, kind: 4 };
  const game = {
    scene: new THREE.Scene(), player: { position: new THREE.Vector3() },
    _state: { phase: 'playing', stage, hp: 1e12 }, enemies: [boss], enemyProjectiles: [], invulnerable: 0,
    takeDamage(damage, position) {
      if (this._state.phase !== 'playing' || this.invulnerable > 0) return false;
      this._state.hp -= damage; this.invulnerable = .75; hits.push({ damage, position: position.clone() }); return true;
    },
    shootEnemyProjectile(source, direction, options) {
      const accepted = Math.min(options.count || 1, 80 - this.enemyProjectiles.length);
      if (!accepted) return;
      shots.push({ source, direction: direction.clone(), options, accepted });
      for (let i = 0; i < accepted; i++) this.enemyProjectiles.push({ mesh: new THREE.Mesh(), direction: direction.clone() });
    },
    spawnEnemy(x, z, kind, options) {
      const group = new THREE.Group(); group.position.set(x, 0, z);
      const enemy = { group, hp: 55, maxHp: 55, kind, minion: options.minion, rewardMultiplier: .25 };
      this.enemies.push(enemy); summons.push(enemy); return enemy;
    },
    burst() {}, puff() {},
  };
  game.scene.add(group);
  const system = new BossSystem(game); system.begin(boss);
  const advance = seconds => {
    for (let time = 0; time < seconds - 1e-9; time += .01) {
      game.invulnerable = Math.max(0, game.invulnerable - .01);
      system.update(boss, .01); system.updateEffects(.01);
    }
  };
  const prepare = () => { boss.mode = 'chase'; boss.actionTimer = 0; advance(.01); };
  return { game, boss, system, hits, shots, summons, material, advance, prepare };
}

test('artillery retreats, warns first and fires three volleys at its locked aim', () => {
  const f = fixture('artillery');
  f.boss.group.position.set(5, 0, 0);
  f.advance(.1);
  assert.ok(f.boss.group.position.x > 5, 'ranged guardian opens distance instead of charging');
  f.prepare();
  assert.equal(f.boss.mode, 'barrage-warning');
  assert.ok(f.system.zones.length > 0);
  assert.equal(f.shots.length, 0);
  const aim = f.boss.aimDirection.clone();
  f.game.player.position.set(0, 0, 15);
  f.advance(.8); assert.equal(f.shots.length, 0, 'the warning is safe before it expires');
  f.advance(.8);
  assert.equal(f.shots.length, 3);
  assert.ok(f.shots.every(shot => shot.direction.distanceTo(aim) < 1e-8), 'movement after the warning can dodge the fixed target');
  assert.equal(f.game.enemyProjectiles.length, 9);
  f.system.dispose();
});

test('plague pools warn before damage, can be escaped, and freeze with paused play', () => {
  const f = fixture('plague', 3); f.prepare();
  assert.equal(f.boss.mode, 'poison-warning'); assert.equal(f.system.zones.length, 3);
  f.advance(.95); assert.equal(f.hits.length, 0);
  f.game.player.position.set(25, 0, 25);
  f.advance(.4);
  assert.ok(f.system.zones.every(zone => zone.active));
  assert.equal(f.hits.length, 0, 'moving outside the marked pools prevents damage');
  f.game.player.position.set(0, 0, 0); f.advance(.1);
  assert.equal(f.hits.length, 1, 'returning to a live pool applies actual damage');
  const lives = f.system.zones.map(zone => zone.life);
  f.game._state.phase = 'paused'; f.advance(3);
  assert.deepEqual(f.system.zones.map(zone => zone.life), lives);
  assert.equal(f.hits.length, 1);
  f.system.clear(); f.game._state.phase = 'playing'; f.advance(3);
  assert.equal(f.system.zones.length, 0); assert.equal(f.hits.length, 1, 'cleared hazards cannot hit after the encounter');
  f.system.dispose();
});

test('brood summons respect the horde cap and a finite encounter reward budget', () => {
  const f = fixture('brood', 4);
  while (f.game.enemies.length < 158) f.game.enemies.push({ hp: 1 });
  f.prepare(); f.advance(1.15);
  assert.equal(f.game.enemies.length, 160);
  assert.equal(f.summons.length, 2, 'a nearly full horde leaves room for only two minions');
  assert.ok(f.summons.every(enemy => enemy.minion && enemy.rewardMultiplier === .25));
  for (let wave = 0; wave < 9; wave++) {
    f.game.enemies = [f.boss]; f.prepare(); f.advance(1.15);
  }
  assert.equal(f.summons.length, 18, 'waiting cannot create an endless gold/experience farm');
  assert.equal(f.system.getDebugState().summoned, 18);
  f.system.dispose();
});

test('storm fires slow rings with a usable gap and alternates with a warned nova', () => {
  const f = fixture('storm', 5); f.prepare(); f.advance(.9);
  assert.equal(f.shots.length, 0);
  f.advance(.25);
  assert.equal(f.shots.length, 10);
  const angles = f.shots.map(shot => (Math.atan2(shot.direction.x, shot.direction.z) + Math.PI * 2) % (Math.PI * 2)).sort((a, b) => a - b);
  const gaps = angles.map((angle, i) => (angles[(i + 1) % angles.length] - angle + Math.PI * 2) % (Math.PI * 2));
  assert.ok(Math.max(...gaps) > 1, 'the radial attack leaves a broad escape opening');
  assert.ok(f.shots.every(shot => shot.options.speed < 8));
  f.advance(.5); assert.equal(f.shots.length, 20, 'a second offset ring is delayed instead of spawning on top of the first');
  f.boss.group.position.set(10, 0, 0); f.game.player.position.set(6, 0, 0);
  f.prepare(); assert.equal(f.boss.mode, 'nova-warning');
  const before = f.hits.length;
  f.advance(.95); assert.equal(f.hits.length, before);
  f.advance(.2); assert.equal(f.hits.length, before + 1);
  f.system.dispose();
});

test('reaper marks a fixed landing point before blinking and delays the crossfire', () => {
  const f = fixture('reaper', 6); f.prepare();
  assert.equal(f.boss.mode, 'blink-warning');
  const target = f.boss.blinkTarget.clone(), start = f.boss.group.position.clone();
  assert.ok(target.distanceTo(f.game.player.position) >= 6.49, 'blink does not land directly on the player');
  f.game.player.position.set(-12, 0, -12);
  f.advance(.9); assert.ok(f.boss.group.position.distanceTo(start) < 1e-8); assert.equal(f.shots.length, 0);
  f.advance(.2); assert.ok(f.boss.group.position.distanceTo(target) < .2);
  assert.equal(f.shots.length, 0, 'the arrival pulse has its own warning');
  f.advance(.9);
  assert.equal(f.shots.length, 4); assert.equal(f.game.enemyProjectiles.length, 12);
  assert.equal(f.hits.length, 0, 'moving away from the locked landing point safely avoids the attack');
  f.system.dispose();
});

test('each boss silhouette differs while cached materials and temporary resources stay bounded', () => {
  const f = fixture('artillery');
  const baseColor = f.material.color.getHex(), shapes = [];
  for (const archetype of ['artillery', 'plague', 'brood', 'storm', 'reaper']) {
    f.boss.archetype = archetype; f.system.begin(f.boss);
    shapes.push(f.system.decorations[0].group.children.map(mesh => `${mesh.geometry.type}:${mesh.position.toArray().join(',')}`).join('|'));
  }
  assert.equal(new Set(shapes).size, 5);
  assert.equal(f.material.color.getHex(), baseColor, 'private recolouring never changes a shared monster material');
  f.boss.archetype = 'plague'; f.system.begin(f.boss);
  const materialCount = f.system.materials.size;
  for (let i = 0; i < 100; i++) { f.prepare(); f.system.resolve(f.boss); }
  assert.ok(f.system.zones.length <= 12);
  f.system.begin(f.boss); assert.equal(f.system.materials.size, materialCount, 'restarting an archetype reuses its cached materials');
  f.boss.archetype = 'artillery'; f.system.begin(f.boss); f.prepare(); f.advance(1.6);
  const ordinaryBolt = { mesh: new THREE.Mesh() }; f.game.enemyProjectiles.push(ordinaryBolt);
  assert.ok(f.game.enemyProjectiles.length > 1);
  f.system.clear();
  assert.deepEqual(f.game.enemyProjectiles, [ordinaryBolt], 'cleanup removes boss bullets and leaves ordinary monster bullets alone');
  assert.equal(f.boss.visual.children[0].material, f.material);
  assert.deepEqual(f.system.getDebugState(), { archetype: null, mode: null, zones: 0, markers: 0, pendingShots: 0, summoned: 0, actions: 0 });
  f.system.dispose();
});

test('later guardians add warned attacks and different minions instead of only changing names', () => {
  const artillery = fixture('artillery', 7); artillery.prepare(); artillery.advance(1.9);
  assert.equal(artillery.shots.length, 4, 'later artillery fires an additional aimed volley');
  artillery.prepare();
  const groundBlast = artillery.system.zones.find(zone => zone.type === 'pulse' && zone.damage > 0);
  assert.ok(groundBlast && groundBlast.warning >= 1, 'extra artillery ground blast is marked before it hits');
  artillery.system.dispose();

  const plague = fixture('plague', 8); plague.prepare();
  assert.equal(plague.system.zones.length, 5, 'later plague covers more ground with separately warned pools');
  plague.advance(1.2); plague.prepare();
  assert.equal(plague.boss.mode, 'fan-warning');
  const shotsBefore = plague.shots.length;
  plague.advance(1); assert.equal(plague.shots.length, shotsBefore);
  plague.advance(.2); assert.equal(plague.shots.length, shotsBefore + 1);
  assert.equal(plague.shots.at(-1).accepted, 7, 'poison guardian also uses its advertised needle fan');
  plague.system.dispose();

  const brood = fixture('brood', 9); brood.prepare(); brood.advance(1.2);
  assert.ok(brood.summons.some(enemy => enemy.kind === 3), 'late summoner mixes a ranged minion into the wave');
  assert.ok(brood.summons.some(enemy => enemy.kind === 2 || enemy.kind === 5), 'late summoner also adds a heavy or charging minion');
  assert.ok(brood.summons.every(enemy => enemy.minion)); brood.system.dispose();

  const storm = fixture('storm', 10); storm.prepare(); storm.advance(1.95);
  assert.equal(storm.shots.length, 30, 'the final guardian sends a third delayed ring while retaining gaps');
  storm.prepare();
  const nova = storm.system.zones.find(zone => zone.type === 'pulse' && zone.damage > 0);
  assert.ok(nova.radius > 9 && nova.warning > 1.1, 'larger final nova provides a longer escape warning');
  storm.system.dispose();
});

test('reaper contact damage uses its landing position rather than the position before teleport', () => {
  const f = fixture('reaper', 6);
  f.boss.group.position.set(1, 0, 0);
  f.boss.blinkTarget.set(6.5, 0, 0);
  f.boss.mode = 'blink-warning'; f.boss.actionTimer = 0;
  f.advance(.01);
  assert.equal(f.hits.length, 0, 'the departing boss cannot cause a phantom contact hit');
  assert.equal(f.boss.mode, 'cross-warning');
  close(f.boss.group.position.x, 6.5);
  f.system.dispose();
});
