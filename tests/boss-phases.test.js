import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossPhases, bossPhase, PHASE_PATTERNS } from '../src/boss-phases.js';
const fixture = type => {
  const zones = [], shots = [], notices = [], game = { player: new THREE.Group(), enemies: [], callbacks: { onLoot: s => notices.push(s) }, bossStats: () => ({ damage: 10 }), clearTelegraph() {}, createBossTelegraph() {}, spawnPosition: () => ({ x: 12, z: 0 }), spawnEnemy: () => { const e = { hp: 10, maxHp: 10 }; game.enemies.push(e); return e; }, bossSystem: { zones, pendingShots: shots, summoned: 0, cancelAttacks() { zones.length = shots.length = 0; }, zone(p,r,w,l,d,t) { zones.push({p,r,w,l,d,t}); }, warningLine() {}, schedule(b,delay,direction,options) { shots.push({delay,options}); } } };
  const boss = { group: new THREE.Group(), hp: 100, maxHp: 100, archetype: type, name: type, mode: 'chase', actionTimer: 0 };
  const system = new BossPhases(game); system.begin(boss); return { game, boss, system, zones, shots, notices };
};
test('boss thresholds change immediately once, clear prior attacks and never heal', () => {
  assert.equal(bossPhase(70,100),1); assert.equal(bossPhase(35,100),2);
  const { boss, system, zones, notices } = fixture('storm'); zones.push({}); boss.hp = 69; system.sync();
  assert.equal(boss.hp,69); assert.equal(boss.combatPhase,2); assert.equal(zones.length,0);
  boss.hp = 34; system.sync(); system.sync(); assert.deepEqual(system.transitions,[2,3]); assert.equal(notices.length,2); assert.equal(boss.maxHp,100);
  system.dispose();
});
test('six guardian phase specials differ and every damaging zone has a reaction window', () => {
  const signatures = new Set();
  for (const type of Object.keys(PHASE_PATTERNS)) { const f=fixture(type); f.boss.hp=30; f.system.sync(); f.system.special(f.boss); signatures.add(JSON.stringify({type,rush:!!f.system.rush,z:f.zones.map(z=>[z.r,z.w,z.t]),s:f.shots.length,n:f.game.enemies.length})); for(const z of f.zones) if(z.d>0) assert.ok(z.w>=1); assert.ok(f.zones.length<=4 && f.shots.length<=1 && f.game.enemies.length<=6); f.system.dispose(); }
  assert.equal(signatures.size,6);
});
