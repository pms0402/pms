import * as THREE from 'three';
import { SPELLS } from './balance.js';

const TAU = Math.PI * 2;
const COLORS = { fireball: '#ff9c54', frost: '#89e8ff', lightning: '#a7f5ff', orbit: '#c39bff', steam: '#defff4' };
const SPELL_IDS = ['fireball', 'frost', 'lightning', 'orbit'];
const MAX_EFFECTS = 100;
const MAX_PROJECTILES = 40;

/** Four independent spell behaviours, with owned rendering resources and cooldowns. */
export class MagicSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.projectiles = [];
    this.effects = [];
    this.zones = [];
    this.orbs = [];
    this.orbitHitTimes = new WeakMap();
    this.meshPools = new Map();
    this.projectilePool = [];
    this.scratch = new THREE.Vector3();
    this.hitDirection = new THREE.Vector3();
    this.synergyCooldown = 0;
    this.synergyHits = 0;
    this.time = 0;
    this.disposed = false;
    this.orbitSignature = '';
    this.cooldowns = { fireball: 0.2, frost: 0.2, lightning: 0.2, orbit: 0 };
    this.spellsCast = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    this.hits = 0;
    this.geometry = {
      fireball: new THREE.IcosahedronGeometry(0.32, 1),
      core: new THREE.IcosahedronGeometry(0.18, 0),
      rune: new THREE.OctahedronGeometry(0.38, 0),
      ring: new THREE.RingGeometry(0.9, 1, 40),
      spark: new THREE.IcosahedronGeometry(0.09, 0),
    };
    this.material = Object.fromEntries(Object.keys(COLORS).map(id => [id, new THREE.MeshBasicMaterial({ color: COLORS[id], transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false })]));
    this.material.core = new THREE.MeshBasicMaterial({ color: '#fff3bf', transparent: true, opacity: 0.95, depthWrite: false });
  }

  rank(id) { return Math.max(0, Math.min(5, Number(this.game.stats.spells?.[id]) || 0)); }
  evolved(id) { return this.rank(id) >= 5 && !!this.game.stats.evolutions?.[id]; }
  isAlive(enemy) { return enemy?.hp > 0; }
  query(position, radius) { return this.game.queryEnemies?.(position, radius) || this.game.enemies; }
  damage() {
    const base = Number(this.game.stats.spellDamage ?? this.game.stats.damage);
    const synergy = this.rank('lightning') && this.rank('orbit') ? Math.max(0, Math.min(0.12, this.game.stats.runeSynergyBonus || 0)) : 0;
    return (Number.isFinite(base) ? Math.max(0, base) : 18) * (1 + synergy);
  }
  area() { return Math.max(1, Math.min(1.5, Number(this.game.stats.spellAreaMultiplier) || 1)); }
  distanceSquared(a, b) { const x = a.x - b.x, z = a.z - b.z; return x * x + z * z; }
  maxCooldown(id) {
    const rank = this.rank(id);
    const haste = Math.max(0.7, Math.min(2.5, this.game.stats.spellRate / 1.5 || 1));
    if (id === 'fireball') return (1.5 - Math.max(0, rank - 1) * 0.1) / haste;
    if (id === 'frost') return (5 - Math.max(0, rank - 1) * 0.3) / haste;
    if (id === 'lightning') return (3 - Math.max(0, rank - 1) * 0.18) / haste;
    return 0.6 / haste;
  }

  nearest(position, range, excluded = null) {
    let result = null, distance = range * range;
    for (const enemy of this.query(position, range)) {
      if (enemy.hp <= 0 || excluded?.has(enemy)) continue;
      const next = this.distanceSquared(position, enemy.group.position);
      if (next < distance) { distance = next; result = enemy; }
    }
    return result;
  }

  hit(enemy, damage, origin, slowTime = 0, slowFactor = 0.5) {
    if (!this.isAlive(enemy)) return;
    if (slowTime > 0) {
      enemy.slowTime = Math.max(enemy.slowTime || 0, slowTime);
      enemy.slowFactor = Math.min(enemy.slowFactor || 1, slowFactor);
    }
    const direction = this.hitDirection.copy(enemy.group.position).sub(origin).setY(0);
    if (direction.lengthSq() < 0.001) direction.set(0, 0, 1);
    direction.normalize();
    this.hits++;
    this.game.hitEnemy(enemy, damage, direction, 'magic');
  }

  update(dt) {
    if (this.disposed || this.game._state.phase !== 'playing') return;
    dt = Math.max(0, Math.min(0.1, dt));
    this.time += dt;
    this.synergyCooldown = Math.max(0, this.synergyCooldown - dt);
    for (const id of SPELL_IDS) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - dt);
    this.syncOrbit();
    if (this.rank('fireball') && this.cooldowns.fireball <= 0) this.castFireball();
    if (this.rank('frost') && this.cooldowns.frost <= 0) this.castFrost();
    if (this.rank('lightning') && this.cooldowns.lightning <= 0) this.castLightning();
    this.updateProjectiles(dt);
    this.updateOrbit(dt);
    this.updateRuneSynergy();
    this.updateZones(dt);
    this.updateEffects(dt);
  }

  castFireball() {
    const origin = this.game.player.position;
    const target = this.nearest(origin, 22);
    if (!target || this.projectiles.length >= MAX_PROJECTILES) return false;
    const rank = this.rank('fireball'), evolved = this.evolved('fireball');
    const count = evolved ? 3 : rank >= 4 ? 2 : 1;
    const chosen = new Set();
    for (let index = 0; index < count && this.projectiles.length < MAX_PROJECTILES; index++) {
      const next = this.nearest(origin, 22, chosen) || target;
      chosen.add(next);
      const direction = next.group.position.clone().sub(origin).setY(0).normalize();
      const mesh = this.projectilePool.pop() || this.createFireballMesh();
      const shell = mesh.children[0];
      mesh.rotation.set(0, 0, 0); shell.scale.setScalar(evolved ? 1.35 : 1);
      mesh.position.copy(origin); mesh.position.y = 1;
      this.scene.add(mesh);
      this.projectiles.push({ mesh, target: next, direction, life: 1.8, trailTimer: 0, rank, evolved, damage: this.damage() * 1.1 * (1 + 0.16 * (rank - 1)), radius: (3.3 + 0.35 * (rank - 1)) * this.area() });
    }
    this.spellsCast.fireball++;
    this.cooldowns.fireball = this.maxCooldown('fireball');
    return true;
  }

  createFireballMesh() {
    const mesh = new THREE.Group();
    const shell = new THREE.Mesh(this.geometry.fireball, this.material.fireball);
    const core = new THREE.Mesh(this.geometry.core, this.material.core);
    core.scale.setScalar(1.2); mesh.add(shell, core); return mesh;
  }
  releaseProjectile(projectile) {
    projectile.mesh.removeFromParent();
    if (this.projectilePool.length < MAX_PROJECTILES) this.projectilePool.push(projectile.mesh);
  }

  explode(position, radius, damage, evolved, secondary = false) {
    this.ring(position, radius, 'fireball', 0.4, 0.55);
    this.particles(position, 'fireball', evolved ? 10 : 6);
    // Select the nearest capped targets in one pass instead of sorting the horde.
    const nearby = [], distances = [], limit = evolved ? 12 : 7;
    for (const enemy of this.query(position, radius + 3)) {
      if (!this.isAlive(enemy)) continue;
      const distance = this.distanceSquared(position, enemy.group.position);
      if (distance > (radius + Math.max(0, (enemy.size || 1) - 1)) ** 2) continue;
      let index = distances.length;
      while (index > 0 && distances[index - 1] > distance) index--;
      if (index >= limit) continue;
      nearby.splice(index, 0, enemy); distances.splice(index, 0, distance);
      if (nearby.length > limit) { nearby.pop(); distances.pop(); }
    }
    let steamed = false;
    for (const enemy of nearby) {
      const bonus = enemy.slowTime > 0 ? Math.max(0, Math.min(0.2, this.game.stats.frostfireBonus || 0)) : 0;
      this.hit(enemy, damage * (1 + bonus), position);
      if (bonus) { steamed = true; this.synergyHits++; }
    }
    if (steamed) { this.ring(position, radius * 0.8, 'steam', 0.55, 0.45); this.particles(position, 'steam', 6, radius * 0.25); }
    if (evolved && !secondary && this.zones.length < 12) {
      this.zones.push({ type: 'ember', position: position.clone(), radius: radius * 1.1, damage: damage * 0.55, life: 0.33, tick: 0.32 });
    }
  }

  updateProjectiles(dt) {
    for (let index = this.projectiles.length - 1; index >= 0; index--) {
      const projectile = this.projectiles[index];
      projectile.life -= dt; projectile.trailTimer -= dt;
      if (this.isAlive(projectile.target)) {
        const desired = this.scratch.copy(projectile.target.group.position).sub(projectile.mesh.position).setY(0).normalize();
        projectile.direction.lerp(desired, 1 - Math.exp(-dt * 9)).normalize();
      }
      projectile.mesh.position.addScaledVector(projectile.direction, dt * 20);
      projectile.mesh.rotation.z += dt * 6; projectile.mesh.rotation.y += dt * 4;
      if (projectile.trailTimer <= 0) {
        this.spark(projectile.mesh.position, 'fireball', 0.18, 0.75);
        projectile.trailTimer = 0.09;
      }
      let contact = false;
      for (const enemy of this.query(projectile.mesh.position, 3)) {
        if (enemy.hp <= 0) continue;
        if (this.distanceSquared(projectile.mesh.position, enemy.group.position) < (0.85 + Math.max(0, (enemy.size || 1) - 1) * 0.8) ** 2) { contact = true; break; }
      }
      if (contact || projectile.life <= 0) {
        // A missed projectile still visibly erupts, but never searches beyond its AoE.
        this.explode(projectile.mesh.position.clone(), projectile.radius, projectile.damage, projectile.evolved);
        this.releaseProjectile(projectile); this.projectiles.splice(index, 1);
      }
    }
  }

  castFrost() {
    const rank = this.rank('frost'), evolved = this.evolved('frost');
    const radius = (6 + (rank - 1) * 0.5 + (evolved ? 1.5 : 0)) * this.area();
    const origin = this.game.player.position;
    if (!this.nearest(origin, radius + 0.5)) return false;
    const damage = this.damage() * 0.8 * (1 + 0.18 * (rank - 1));
    this.ring(origin, radius, 'frost', 0.65, 0.8);
    this.ring(origin, radius * 0.8, 'frost', 0.45, 0.35);
    this.particles(origin, 'frost', 10, radius * 0.6);
    for (const enemy of this.query(origin, radius)) {
      if (!this.isAlive(enemy)) continue;
      if (this.distanceSquared(origin, enemy.group.position) <= radius ** 2) this.hit(enemy, damage, origin, evolved ? 3 : 2, evolved ? 0.3 : 0.5);
    }
    if (evolved && this.zones.length < 12) {
      const marker = new THREE.Mesh(this.geometry.ring, this.material.frost);
      marker.rotation.x = -Math.PI / 2; marker.position.copy(origin); marker.position.y = 0.15; marker.scale.setScalar(radius);
      this.scene.add(marker);
      this.zones.push({ type: 'blizzard', position: origin.clone(), radius, damage: damage * 0.25, life: 3.5, tick: 0.5, marker });
    }
    this.spellsCast.frost++;
    this.cooldowns.frost = this.maxCooldown('frost');
    return true;
  }

  castLightning() {
    const origin = this.game.player.position;
    const first = this.nearest(origin, 15 * this.area());
    if (!first) return false;
    const rank = this.rank('lightning'), evolved = this.evolved('lightning');
    const count = 3 + Math.floor((rank - 1) / 2) + (evolved ? 3 : 0);
    const damage = this.damage() * 1.1 * (1 + 0.18 * (rank - 1));
    const hit = new Set();
    let previous = origin.clone(), target = first;
    for (let index = 0; index < count && target; index++) {
      const point = target.group.position.clone(); point.y = 1;
      this.lightningLine(previous, point, evolved ? 0.4 : 0.26, index === 0 ? 1 : 0.8);
      hit.add(target); this.hit(target, damage * Math.max(0.65, 1 - index * 0.05), previous);
      if (evolved && index > 0) this.lightningLine(origin, point, 0.2, 0.35);
      previous = point;
      target = this.nearest(point, (evolved ? 11 : 8) * this.area(), hit);
    }
    this.spellsCast.lightning++;
    this.cooldowns.lightning = this.maxCooldown('lightning');
    return true;
  }

  syncOrbit() {
    const rank = this.rank('orbit'), evolved = this.evolved('orbit');
    const signature = `${rank}:${evolved}`;
    if (signature === this.orbitSignature) return;
    this.orbitSignature = signature;
    for (const orb of this.orbs) orb.removeFromParent();
    this.orbs.length = 0;
    if (!rank) return;
    const count = 2 + Math.floor((rank - 1) / 2) + (evolved ? 3 : 0);
    for (let index = 0; index < count; index++) {
      const orb = new THREE.Group();
      const rune = new THREE.Mesh(this.geometry.rune, this.material.orbit);
      const core = new THREE.Mesh(this.geometry.core, this.material.core);
      core.scale.setScalar(0.7); orb.add(rune, core); this.scene.add(orb); this.orbs.push(orb);
    }
  }

  updateOrbit(dt) {
    const rank = this.rank('orbit');
    if (!rank || !this.orbs.length) return;
    const evolved = this.evolved('orbit');
    const radius = (3.5 + (rank - 1) * 0.2 + (evolved ? 1.2 : 0)) * this.area();
    for (let index = 0; index < this.orbs.length; index++) {
      const angle = this.time * (evolved ? 2 : 1.7) + index / this.orbs.length * TAU;
      const orb = this.orbs[index];
      orb.position.copy(this.game.player.position); orb.position.x += Math.cos(angle) * radius; orb.position.z += Math.sin(angle) * radius;
      orb.position.y = 0.95 + Math.sin(this.time * 3 + index) * 0.12;
      orb.rotation.y += dt * 2.4; orb.rotation.z += dt * 1.4;
    }
    let hitAny = false;
    for (const enemy of this.query(this.game.player.position, radius + 3.5)) {
      if (!this.isAlive(enemy)) continue;
      if ((this.orbitHitTimes.get(enemy) || 0) > this.time) continue;
      const near = this.orbs.find(orb => this.distanceSquared(orb.position, enemy.group.position) < (1.1 + Math.max(0, (enemy.size || 1) - 1) * 0.7) ** 2);
      const centerPulse = evolved && this.cooldowns.orbit <= 0 && this.distanceSquared(this.game.player.position, enemy.group.position) < (4.5 * this.area()) ** 2;
      if (!near && !centerPulse) continue;
      this.orbitHitTimes.set(enemy, this.time + this.maxCooldown('orbit'));
      this.hit(enemy, this.damage() * 0.55 * (1 + (rank - 1) * 0.15), near?.position || this.game.player.position);
      this.spark(enemy.group.position, 'orbit', 0.22, 1.3); hitAny = true;
    }
    if (hitAny && this.cooldowns.orbit <= 0) {
      this.spellsCast.orbit++;
      this.cooldowns.orbit = this.maxCooldown('orbit');
      if (evolved) this.ring(this.game.player.position, radius, 'orbit', 0.35, 0.25);
    }
  }

  updateRuneSynergy() {
    if (!this.game.stats.runeSynergyBonus || !this.rank('lightning') || !this.rank('orbit') || this.synergyCooldown > 0) return;
    for (const orb of this.orbs) {
      const target = this.nearest(orb.position, 5 * this.area());
      if (!target) continue;
      this.lightningLine(orb.position, target.group.position, 0.32, 0.8);
      this.ring(orb.position, 0.9, 'orbit', 0.3, 0.6);
      this.hit(target, this.damage() * 0.2, orb.position);
      this.synergyHits++; this.synergyCooldown = 4; return;
    }
  }

  updateZones(dt) {
    for (let index = this.zones.length - 1; index >= 0; index--) {
      const zone = this.zones[index]; zone.life -= dt; zone.tick -= dt;
      if (zone.type === 'ember' && zone.tick <= 0) {
        this.explode(zone.position, zone.radius, zone.damage, true, true); zone.life = 0;
      } else if (zone.type === 'blizzard' && zone.tick <= 0) {
        for (const enemy of this.query(zone.position, zone.radius)) {
          if (!this.isAlive(enemy)) continue;
          if (this.distanceSquared(zone.position, enemy.group.position) <= zone.radius ** 2) this.hit(enemy, zone.damage, zone.position, 1, 0.3);
        }
        this.ring(zone.position, zone.radius, 'frost', 0.45, 0.22); zone.tick = 0.65;
      }
      if (zone.marker) zone.marker.rotation.z += dt * 0.1;
      if (zone.life <= 0) { zone.marker?.removeFromParent(); this.zones.splice(index, 1); }
    }
  }

  addEffect(effect) {
    if (this.effects.length >= MAX_EFFECTS) this.removeEffect(0);
    this.effects.push(effect); this.scene.add(effect.mesh);
  }
  removeEffect(index) {
    const effect = this.effects[index];
    effect.mesh.removeFromParent();
    const pool = effect.poolKey ? this.meshPools.get(effect.poolKey) || [] : null;
    if (pool && pool.length < 24) {
      pool.push(effect.mesh); this.meshPools.set(effect.poolKey, pool);
    } else {
      if (effect.ownedGeometry) effect.mesh.geometry.dispose();
      if (effect.ownedMaterial) effect.mesh.material.dispose();
    }
    this.effects.splice(index, 1);
  }
  ring(position, radius, id, life = 0.4, opacity = 0.7) {
    const poolKey = `ring:${id}`;
    const mesh = this.meshPools.get(poolKey)?.pop() || new THREE.Mesh(this.geometry.ring, this.material[id].clone());
    mesh.material.opacity = opacity;
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(position); mesh.position.y = 0.16;
    mesh.scale.setScalar(radius * 0.2);
    this.addEffect({ mesh, type: 'ring', life, total: life, radius, opacity, ownedMaterial: true, poolKey });
  }
  spark(position, id, life = 0.2, scale = 1) {
    const poolKey = `spark:${id}`;
    const mesh = this.meshPools.get(poolKey)?.pop() || new THREE.Mesh(this.geometry.spark, this.material[id]);
    mesh.position.copy(position); mesh.position.y = Math.max(0.5, position.y || 0); mesh.scale.setScalar(scale);
    this.addEffect({ mesh, type: 'spark', life, total: life, baseScale: scale, poolKey });
  }
  particles(position, id, count = 6, spread = 0.2) {
    for (let index = 0; index < count; index++) {
      const poolKey = `spark:${id}`;
      const mesh = this.meshPools.get(poolKey)?.pop() || new THREE.Mesh(this.geometry.spark, this.material[id]);
      const angle = index / count * TAU;
      mesh.scale.setScalar(1);
      mesh.position.copy(position); mesh.position.x += Math.cos(angle) * spread; mesh.position.z += Math.sin(angle) * spread; mesh.position.y = 0.6;
      this.addEffect({ mesh, type: 'particle', life: 0.45, total: 0.45, velocity: new THREE.Vector3(Math.cos(angle) * 5, 2 + index % 3, Math.sin(angle) * 5), poolKey });
    }
  }
  lightningLine(start, end, life, opacity) {
    let mesh = this.meshPools.get('line')?.pop();
    if (!mesh) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(27), 3));
      const material = new THREE.LineBasicMaterial({ color: COLORS.lightning, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });
      mesh = new THREE.Line(geometry, material);
    }
    const positions = mesh.geometry.attributes.position;
    for (let index = 0; index <= 8; index++) {
      const point = this.scratch.copy(start).lerp(end, index / 8);
      point.y = 1 + Math.sin(index * 1.7) * 0.2;
      if (index && index < 8) { point.x += Math.sin(index * 13.7 + this.time) * 0.5; point.z += Math.cos(index * 9.1 + this.time) * 0.5; }
      positions.setXYZ(index, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; mesh.geometry.computeBoundingSphere(); mesh.material.opacity = opacity;
    this.addEffect({ mesh, type: 'line', life, total: life, opacity, ownedGeometry: true, ownedMaterial: true, poolKey: 'line' });
  }
  updateEffects(dt) {
    for (let index = this.effects.length - 1; index >= 0; index--) {
      const effect = this.effects[index]; effect.life -= dt;
      const progress = Math.max(0, 1 - effect.life / effect.total);
      if (effect.ownedMaterial) effect.mesh.material.opacity = (effect.opacity || 1) * (1 - progress);
      if (effect.type === 'ring') effect.mesh.scale.setScalar(effect.radius * (0.2 + 0.8 * progress));
      else if (effect.type === 'spark') effect.mesh.scale.setScalar(effect.baseScale * Math.max(0.1, 1 - progress));
      else if (effect.type === 'particle') { effect.mesh.position.addScaledVector(effect.velocity, dt); effect.velocity.y -= dt * 9; effect.mesh.scale.setScalar(1 - progress); }
      if (effect.life <= 0) this.removeEffect(index);
    }
  }

  getState() {
    return SPELL_IDS.map(id => {
      const definition = SPELLS.find(spell => spell.id === id);
      return { id, name: this.evolved(id) ? definition?.evolutionName || definition?.name || id : definition?.name || id, rank: this.rank(id), evolved: this.evolved(id), cooldown: Math.max(0, this.cooldowns[id]), maxCooldown: this.maxCooldown(id), color: COLORS[id] };
    });
  }
  getDebugState() { return { spellsCast: { ...this.spellsCast }, hits: this.hits, synergyHits: this.synergyHits, projectiles: this.projectiles.length, activeOrbit: this.orbs.length, effects: this.effects.length, zones: this.zones.length, pooledEffects: [...this.meshPools.values()].reduce((count, meshes) => count + meshes.length, 0), pooledProjectiles: this.projectilePool.length }; }
  reset() {
    for (const projectile of this.projectiles) this.releaseProjectile(projectile);
    while (this.effects.length) this.removeEffect(0);
    for (const zone of this.zones) zone.marker?.removeFromParent();
    for (const orb of this.orbs) orb.removeFromParent();
    this.projectiles.length = 0; this.zones.length = 0; this.orbs.length = 0;
    this.cooldowns = { fireball: 0.2, frost: 0.2, lightning: 0.2, orbit: 0 };
    this.spellsCast = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    this.hits = 0; this.synergyHits = 0; this.synergyCooldown = 0; this.time = 0; this.orbitSignature = ''; this.orbitHitTimes = new WeakMap();
  }
  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    for (const [key, meshes] of this.meshPools) {
      for (const mesh of meshes) {
        if (key === 'line') mesh.geometry.dispose();
        if (key === 'line' || key.startsWith('ring:')) mesh.material.dispose();
      }
    }
    this.meshPools.clear(); this.projectilePool.length = 0;
    for (const geometry of Object.values(this.geometry)) geometry.dispose();
    for (const material of Object.values(this.material)) material.dispose();
  }
}
