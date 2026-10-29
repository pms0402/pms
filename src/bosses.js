import * as THREE from 'three';
import { ARENA_RADIUS, getBossStats } from './balance.js';

const TAU = Math.PI * 2;
const COLORS = { artillery: '#e7b06d', plague: '#a4d86d', brood: '#c89ad7', storm: '#8bdaf4', reaper: '#e5a1d0' };
const MAX_ZONES = 12;
const MAX_SUMMONS = 18;

/** Owns the later guardians' attacks and every temporary resource they create. */
export class BossSystem {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.boss = null;
    this.zones = [];
    this.pendingShots = [];
    this.decorations = [];
    this.materials = new Map();
    this.geometry = {
      disc: new THREE.RingGeometry(0, 1, 40, 5),
      ring: new THREE.RingGeometry(.94, 1, 40),
      plane: new THREE.PlaneGeometry(1, 1, 1, 24),
      crystal: new THREE.OctahedronGeometry(.35, 0),
      horn: new THREE.ConeGeometry(.24, .9, 5),
      box: new THREE.BoxGeometry(1, 1, 1),
      halo: new THREE.TorusGeometry(.85, .09, 5, 16),
    };
    this.direction = new THREE.Vector3();
    this.actions = 0;
    this.summoned = 0;
    this.time = 0;
  }

  stage() { return this.game._state.stage || 1; }
  playing() { return this.game._state.phase === 'playing' && this.boss?.hp > 0; }
  damage() { return (this.game.bossStats?.() || getBossStats(this.stage())).damage; }

  begin(boss) {
    this.clear();
    this.boss = boss;
    const info = this.game.bossStats?.() || getBossStats(this.stage());
    boss.archetype ||= info.archetype || 'warden';
    boss.variant = info.variant || boss.variant || 1;
    boss.mode = 'chase'; boss.actionTimer = 1.6; boss.actionIndex = 0;
    boss.aimDirection = new THREE.Vector3(0, 0, 1);
    boss.blinkTarget = new THREE.Vector3(); boss.ringAngle = 0;
    this.bodyColor = info.color || COLORS[boss.archetype] || '#ee896b';
    this.color = info.secondary || COLORS[boss.archetype] || '#ee896b';
    if (boss.archetype !== 'warden') this.decorate(boss);
    return boss;
  }

  material(key, color, basic = false) {
    if (!this.materials.has(key)) this.materials.set(key, basic
      ? new THREE.MeshBasicMaterial({ color })
      : new THREE.MeshStandardMaterial({ color, roughness: .55, metalness: .2, emissive: color, emissiveIntensity: .22 }));
    return this.materials.get(key);
  }

  decorate(boss) {
    const type = boss.archetype;
    const material = this.material(type, this.bodyColor);
    const glow = this.material(`${type}:glow`, this.color, true);
    const group = new THREE.Group();
    const add = (geometry, x, y, z, sx = 1, sy = sx, sz = sx) => {
      const mesh = new THREE.Mesh(this.geometry[geometry], geometry === 'crystal' || geometry === 'halo' ? glow : material);
      mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); mesh.castShadow = true; group.add(mesh); return mesh;
    };
    // Colour copies are cached by archetype; shared enemy/world materials stay intact.
    for (const mesh of boss.visual?.children || []) {
      if (!mesh.material) continue;
      mesh.userData.originalBossMaterial ||= mesh.material;
      const original = mesh.userData.originalBossMaterial;
      const recolor = base => {
        const key = `${type}:body:${base.uuid}`;
        if (!this.materials.has(key)) {
          const copy = base.clone();
          copy.color?.lerp(new THREE.Color(this.bodyColor), .65);
          if (copy.emissive) copy.emissive.lerp(new THREE.Color(this.color), .3);
          this.materials.set(key, copy);
        }
        return this.materials.get(key);
      };
      mesh.material = Array.isArray(original) ? original.map(recolor) : recolor(original);
    }
    if (type === 'artillery') {
      for (const side of [-1, 1]) add('box', side * .65, 1.05, .35, .35, .35, 1.25);
      add('crystal', 0, 1.85, .15, .8);
    } else if (type === 'plague') {
      for (let i = 0; i < 3; i++) add('crystal', (i - 1) * .55, 1.45 + (i % 2) * .3, -.4, .9, 1.5, .9);
      add('halo', 0, .22, 0, 1.3).rotation.x = Math.PI / 2;
    } else if (type === 'brood') {
      add('box', 0, 1.05, -.6, 1.15, 1.2, .9);
      for (const side of [-1, 1]) {
        add('horn', side * .85, .95, -.3, 1.2).rotation.z = side * -1.1;
        add('crystal', side * .62, 1.4, -.8, .7);
      }
    } else if (type === 'storm') {
      add('halo', 0, 1.9, 0, 1.1).rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) add('crystal', Math.sin(i * Math.PI / 2) * 1.05, 1.25, Math.cos(i * Math.PI / 2) * 1.05, .65, 1.6, .65);
    } else if (type === 'reaper') {
      add('box', .9, 1.1, 0, .12, 2.25, .12);
      const blade = add('horn', .45, 2.05, 0, 1.6, 1, .6); blade.rotation.z = -Math.PI / 2;
      add('halo', 0, 1.3, -.35, 1.35, 1.35, .5);
    }
    if (boss.variant > 1) {
      for (const side of [-1, 1]) add('crystal', side * .7, 2.2, -.25, .7, 1.6, .7);
    }
    boss.group.add(group); this.decorations.push({ boss, group });
  }

  marker(position, radius, { type = 'disc', direction, length = 19 } = {}) {
    const group = new THREE.Group(); group.position.copy(position); group.position.y = (this.game.groundHeight?.(position.x, position.z) ?? position.y ?? 0) + .13;
    const material = new THREE.MeshBasicMaterial({ color: type === 'line' ? '#8bdcff' : '#ff7065', transparent: true, opacity: .18, side: THREE.DoubleSide, depthWrite: false });
    const fill = new THREE.Mesh((type === 'line' ? this.geometry.plane : this.geometry.disc).clone(), material);
    fill.rotation.x = -Math.PI / 2;
    if (type === 'line') {
      fill.scale.set(radius, length, 1); fill.rotation.z = Math.atan2(direction.x, direction.z);
      group.position.addScaledVector(direction, length / 2);
    } else fill.scale.setScalar(radius);
    group.add(fill);
    if (type !== 'line') {
      const rim = new THREE.Mesh(this.geometry.ring.clone(), material.clone());
      rim.material.opacity = .7; rim.rotation.x = -Math.PI / 2; rim.scale.setScalar(radius); group.add(rim);
    }
    this.scene.add(group); for (const child of group.children) this.game.fitGroundMesh?.(child, .13); return group;
  }

  zone(position, radius, warning, life, damage = 0, type = 'pool') {
    if (this.zones.length >= MAX_ZONES) return null;
    const owner = this.boss?.name || getBossStats(this.stage()).name;
    const cause = `${owner} · ${type === 'pool' ? '독 장판' : '충격파'}`;
    const groundPosition = position.clone(); groundPosition.y = this.game.groundHeight?.(position.x, position.z) ?? position.y ?? 0;
    const zone = { position: groundPosition, radius, warning, life, damage, type, cause, active: false, tick: 0, marker: this.marker(position, radius) };
    this.zones.push(zone); return zone;
  }

  warningLine(boss, duration) {
    if (this.zones.length >= MAX_ZONES) return;
    this.zones.push({ position: boss.group.position.clone(), radius: 0, warning: duration, life: .01, damage: 0, type: 'aim', active: false, marker: this.marker(boss.group.position, 1.8, { type: 'line', direction: boss.aimDirection, length: 24 }) });
  }

  removeMarker(marker) {
    if (!marker) return;
    marker.removeFromParent();
    const materials = new Set();
    marker.traverse(mesh => { if (mesh.material) materials.add(mesh.material); if (mesh.geometry) mesh.geometry.dispose(); });
    materials.forEach(material => material.dispose());
  }

  fire(boss, direction, options = {}) {
    if (boss.parryStun > 0) return;
    const bolts = this.game.enemyProjectiles || [];
    const before = bolts.length;
    const attack = { artillery: '포격', plague: '독침', storm: '전격 탄막', reaper: '십자 탄막' }[boss.archetype] || '원거리 공격';
    const cause = `${boss.name || getBossStats(this.stage()).name} · ${attack}`;
    this.game.shootEnemyProjectile(boss, direction, { speed: 8, damage: this.damage() * .8, cause, ...options });
    for (let i = before; i < bolts.length; i++) bolts[i].bossOwner = boss;
  }

  radial(boss, angle, count = 12, gap = 2) {
    for (let i = gap; i < count; i++) {
      const a = angle + i / count * TAU;
      this.direction.set(Math.sin(a), 0, Math.cos(a));
      this.fire(boss, this.direction, { count: 1, speed: 6.8, life: 6 });
    }
  }

  schedule(boss, delay, direction, options = {}) {
    if (boss.parryStun > 0 || this.pendingShots.length >= 12) return;
    this.pendingShots.push({ boss, delay, direction: direction?.clone(), ...options });
  }

  prepare(boss) {
    const origin = boss.group.position, target = this.game.player.position;
    this.game.sound?.('boss',origin);
    boss.aimDirection.copy(target).sub(origin).setY(0).normalize();
    if (boss.aimDirection.lengthSq() === 0) boss.aimDirection.set(0, 0, 1);
    boss.actionIndex++; this.actions++;
    const enraged = boss.hp < boss.maxHp * .5;
    switch (boss.archetype) {
      case 'artillery':
        boss.mode = boss.actionIndex % 2 ? 'barrage-warning' : 'fan-warning'; boss.actionTimer = .95;
        this.warningLine(boss, .95);
        if (boss.variant > 1 && boss.mode === 'fan-warning') this.zone(target, 3.4, 1.1, .16, this.damage() * .8, 'pulse');
        break;
      case 'plague': {
        boss.mode = boss.actionIndex % 2 ? 'poison-warning' : 'fan-warning'; boss.actionTimer = 1.15;
        if (boss.mode === 'fan-warning') this.warningLine(boss, 1.15);
        else {
          const offsets = [[0, 0], [3.3, 2.4], [-3.3, -2.4]];
          if (boss.variant > 1) offsets.push([4.4, -3.4], [-4.4, 3.4]);
          for (const [dx, dz] of offsets) {
            const point = target.clone().add(new THREE.Vector3(dx, 0, dz));
            this.zone(point, 3.1, 1.15, 2.6, this.damage() * .7, 'pool');
          }
        }
        break;
      }
      case 'brood':
        boss.mode = boss.actionIndex % 2 ? 'summon-warning' : 'pulse-warning'; boss.actionTimer = 1.1;
        this.zone(origin, boss.mode === 'pulse-warning' ? 7.2 : 6.2, 1.1, .16, this.damage() * .95, 'pulse'); break;
      case 'storm': {
        boss.mode = boss.actionIndex % 2 ? 'radial-warning' : 'nova-warning';
        boss.actionTimer = boss.variant > 1 && boss.mode === 'nova-warning' ? 1.25 : 1.05;
        const radius = boss.mode === 'nova-warning' ? (boss.variant > 1 ? 9.5 : 8.2) : 4.2;
        this.zone(origin, radius, boss.actionTimer, .16, boss.mode === 'nova-warning' ? this.damage() * 1.15 : 0, 'pulse'); break;
      }
      case 'reaper': {
        boss.mode = 'blink-warning'; boss.actionTimer = 1.05;
        const angle = Math.atan2(origin.x - target.x, origin.z - target.z) + Math.PI / 2;
        boss.blinkTarget.copy(target).add(new THREE.Vector3(Math.sin(angle) * 6.5, 0, Math.cos(angle) * 6.5));
        const radius = Math.hypot(boss.blinkTarget.x, boss.blinkTarget.z);
        if (radius > ARENA_RADIUS - 4) boss.blinkTarget.multiplyScalar((ARENA_RADIUS - 4) / radius);
        this.zone(boss.blinkTarget, 4.8, 1.05, .05, 0, 'blink'); break;
      }
    }
    boss.enraged = enraged;
  }

  resolve(boss) {
    const mode = boss.mode, enraged = boss.hp < boss.maxHp * .5;
    if (mode === 'barrage-warning') {
      for (let i = 0; i < (boss.variant > 1 ? 4 : 3); i++) this.schedule(boss, i * .26, boss.aimDirection, { count: 3, spread: .11, speed: 11 });
    } else if (mode === 'fan-warning') {
      this.fire(boss, boss.aimDirection, { count: boss.archetype === 'plague' ? (boss.variant > 1 || enraged ? 7 : 5) : (enraged || boss.variant > 1 ? 9 : 7), spread: boss.archetype === 'plague' ? .2 : .18, speed: 8.5 });
    } else if (mode === 'summon-warning') {
      const wanted = Math.min(enraged ? 6 : 4, MAX_SUMMONS - this.summoned, Math.max(0, 160 - this.game.enemies.length));
      for (let i = 0; i < wanted; i++) {
        const angle = i / Math.max(1, wanted) * TAU + boss.actionIndex;
        const pos = boss.group.position;
        const kind = boss.variant > 1 ? [2, 3, 5, 1][i % 4] : i % 2 ? 1 : 0;
        const minion = this.game.spawnEnemy(pos.x + Math.sin(angle) * 4.2, pos.z + Math.cos(angle) * 4.2, kind, { minion: true });
        if (minion) this.summoned++;
      }
      this.game.burst?.(boss.group.position, this.color, 10);
    } else if (mode === 'radial-warning') {
      boss.ringAngle += .58;
      this.radial(boss, boss.ringAngle);
      this.schedule(boss, .4, null, { radial: true, angle: boss.ringAngle + .2 });
      if (enraged || boss.variant > 1) this.schedule(boss, .8, null, { radial: true, angle: boss.ringAngle + .4 });
      if (enraged && boss.variant > 1) this.schedule(boss, 1.2, null, { radial: true, angle: boss.ringAngle + .6 });
    } else if (mode === 'blink-warning') {
      this.game.puff?.(boss.group.position, this.color, 2, .4);
      boss.group.position.copy(boss.blinkTarget);
      this.game.puff?.(boss.group.position, this.color, 2, .4);
      this.zone(boss.group.position, 4.8, .85, .16, this.damage(), 'pulse');
      for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2 + boss.actionIndex * .35;
        this.direction.set(Math.sin(angle), 0, Math.cos(angle));
        this.schedule(boss, .85, this.direction, { count: 3, spread: .1, speed: 9.5 });
      }
      boss.mode = 'cross-warning'; boss.actionTimer = .85;
      return;
    }
    boss.mode = 'chase';
    boss.actionTimer = (boss.archetype === 'plague' ? 3.2 : boss.archetype === 'brood' ? 4.2 : 2.7) * (enraged ? .78 : 1) * (boss.combatPhase === 3 ? .82 : 1);
  }

  update(boss, dt) {
    if (!this.playing() || boss !== this.boss) return;
    const target = this.game.player.position, pos = boss.group.position;
    const dx = target.x - pos.x, dz = target.z - pos.z, distance = Math.hypot(dx, dz);
    boss.hitTime = Math.max(0, (boss.hitTime || 0) - dt);
    boss.slowTime = Math.max(0, (boss.slowTime || 0) - dt);
    const slow = boss.slowTime > 0 ? Math.max(.55, boss.slowFactor || .5) : 1;
    const wanted = boss.archetype === 'artillery' ? 15 : boss.archetype === 'plague' ? 11 : boss.archetype === 'brood' ? 9 : 5.5;
    if (boss.mode === 'chase' && distance > .01) {
      const movement = distance < wanted - 2 ? -.65 : distance > wanted + 1 ? 1 : 0;
      const speed = (boss.speed || 2.6) * slow * movement * dt;
      const steer = movement > 0 && this.game.world && !this.game.sideAreas?.active ? this.game.world.steer(pos, dx, dz, 1.4, 0) : { x: dx / distance, z: dz / distance };
      pos.x += steer.x * speed; pos.z += steer.z * speed;
    }
    boss.group.rotation.y = Math.atan2(dx, dz);
    boss.actionTimer -= dt;
    if (boss.actionTimer <= 0) {
      if (boss.mode === 'chase') this.prepare(boss);
      else this.resolve(boss);
    }
    const radius = Math.hypot(pos.x, pos.z);
    if (radius > ARENA_RADIUS - 2) pos.multiplyScalar((ARENA_RADIUS - 2) / radius);
    const contactDistance = Math.hypot(target.x - pos.x, target.z - pos.z);
    if (contactDistance < 2.3) this.game.takeDamage(this.damage(), pos, `${boss.name || getBossStats(this.stage()).name} · 접촉`, boss);
  }

  updateEffects(dt) {
    if (!this.playing()) return;
    dt = Math.max(0, Math.min(.1, dt)); this.time += dt;
    for (let i = this.pendingShots.length - 1; i >= 0; i--) {
      const shot = this.pendingShots[i]; shot.delay -= dt;
      if (shot.delay <= 0) {
        if (shot.boss.hp > 0) {
          if (shot.radial) this.radial(shot.boss, shot.angle);
          else this.fire(shot.boss, shot.direction, shot);
        }
        this.pendingShots.splice(i, 1);
      }
    }
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const zone = this.zones[i];
      if (zone.warning > 0) {
        zone.warning -= dt;
        zone.marker.children[0].material.opacity = .14 + Math.sin(this.time * 15) * .035;
        if (zone.warning > 0) continue;
        zone.active = true; zone.tick = 0;
        zone.marker.children[0].material.opacity = zone.type === 'pool' ? .34 : .55;
      }
      zone.life -= dt; zone.tick -= dt;
      const player = this.game.player.position;
      const dx = player.x - zone.position.x, dz = player.z - zone.position.z;
      if (zone.damage > 0 && zone.tick <= 0 && dx * dx + dz * dz < zone.radius * zone.radius && dx * dx + dz * dz >= (zone.innerRadius || 0) ** 2) {
        this.game.takeDamage(zone.damage, zone.position, zone.cause, null, { unblockable: true }); zone.tick = .6;
        if (zone.type === 'pulse') zone.damage = 0;
      }
      if (zone.life <= 0) { this.removeMarker(zone.marker); this.zones.splice(i, 1); }
    }
  }

  cancelParryable(boss) {
    this.pendingShots = this.pendingShots.filter(shot=>shot.boss !== boss);
    for (let i=this.zones.length-1;i>=0;i--) if(this.zones[i].type==='aim'||this.zones[i].parryable) {this.removeMarker(this.zones[i].marker);this.zones.splice(i,1);}
    // Mark instead of splice: a parry can occur inside the projectile iteration.
    for (const p of this.game.enemyProjectiles || []) if ((p.bossOwner===boss||p.attacker===boss)&&p.parryable!==false) {p.life=0;p.mesh.visible=false;}
  }

  cancelAttacks() {
    for (const zone of this.zones) this.removeMarker(zone.marker);
    this.zones.length = 0; this.pendingShots.length = 0;
    const bolts = this.game.enemyProjectiles || [];
    for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].bossOwner === this.boss) { bolts[i].mesh?.removeFromParent(); bolts.splice(i, 1); }
  }

  clear() {
    for (const zone of this.zones) this.removeMarker(zone.marker);
    this.zones.length = 0; this.pendingShots.length = 0;
    for (const { boss, group } of this.decorations) {
      group.removeFromParent();
      for (const mesh of boss.visual?.children || []) if (mesh.userData.originalBossMaterial) mesh.material = mesh.userData.originalBossMaterial;
    }
    this.decorations.length = 0;
    const bolts = this.game.enemyProjectiles || [];
    for (let i = bolts.length - 1; i >= 0; i--) if (bolts[i].bossOwner === this.boss) { bolts[i].mesh?.removeFromParent(); bolts.splice(i, 1); }
    this.boss = null; this.actions = 0; this.summoned = 0; this.time = 0;
  }

  getDebugState() { return { archetype: this.boss?.archetype || null, mode: this.boss?.mode || null, zones: this.zones.length, markers: this.zones.length, pendingShots: this.pendingShots.length, summoned: this.summoned, actions: this.actions }; }
  dispose() { this.clear(); Object.values(this.geometry).forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.materials.clear(); }
}
