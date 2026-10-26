import * as THREE from 'three';
import { STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES, ARENA_RADIUS, getStageStats, getBossStats, getSpawnInterval, getXpRequired, getUpgradeChoices, getShopOffers, applyUpgrade } from './balance.js';
import { MagicSystem } from './magic.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const rnd = (a, b) => a + Math.random() * (b - a);

/** The rendering, input and simulation for VOIDRUN. All artwork is procedural. */
export class Game {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.enemies = [];
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.boss = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.pickups = [];
    this.effects = [];
    this.floatingTexts = [];
    this.frames = 0;
    this.muted = false;
    this.disposed = false;
    this.quality = 'high';
    this._state = this.freshState('menu');
    this.stats = this.freshStats();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#111a15');
    this.scene.fog = new THREE.FogExp2('#111a15', 0.011);
    this.camera = new THREE.PerspectiveCamera(43, 1, 0.1, 180);
    this.camera.position.set(20, 26, 25);
    this.camera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    this.renderer.setSize(container.clientWidth || 900, container.clientHeight || 650);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.16;
    this.renderer.domElement.setAttribute('aria-label', 'VOIDRUN 3D 전장. WASD 또는 방향키 이동, 스페이스 회피.');
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);
    this.createMaterials();
    this.createWorld();
    this.createPlayer();
    this.magic = new MagicSystem(this);
    this.setupInput();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(container);
    this.resize();
    this.attractEnemies();
    this.lastTime = performance.now();
    this.lastUpdate = 0;
    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  freshStats() { return { maxHp: 100, damage: 18, attackRate: 1.5, speed: 7.5, magnet: 5.5, projectiles: 1, critChance: 0.08, armor: 0, regen: 0, spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 }, evolutions: {}, passiveLevels: {} }; }
  freshState(phase) { return { phase, hp: 100, xp: 0, xpNeeded: getXpRequired(1), level: 1, stage: 1, stageTime: 0, elapsed: 0, kills: 0, gold: 0, combo: 0, weaponName: '공허의 검' }; }
  get state() {
    return { ...this._state, maxHp: this.stats.maxHp, damage: this.stats.damage, attackRate: this.stats.attackRate, speed: this.stats.speed, dashCooldown: Math.max(0, this.dashCooldown || 0), dashReady: !(this.dashCooldown > 0), enemyCount: this.enemies.length, arenaRadius: ARENA_RADIUS, stageDuration: STAGE_DURATION, bossSpawnTime: BOSS_SPAWN_TIME, bossSpawned: this.bossSpawned, bossDefeated: this.bossDefeated, boss: this.boss ? { name: this.boss.name, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp, alive: this.boss.hp > 0, spawned: this.bossSpawned, defeated: this.bossDefeated, phase: this.boss.mode } : null, spellState: this.magic?.getState() || [], playerStats: { ...this.stats, spells: { ...this.stats.spells }, evolutions: { ...this.stats.evolutions }, passiveLevels: { ...this.stats.passiveLevels } } };
  }
  emit() { this.callbacks.onUpdate?.(this.state); }

  createMaterials() {
    const standard = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    this.mats = {
      ground: standard('#2c352b'), edge: standard('#171d1b'), rock: standard('#3a433a'), rockDark: standard('#252c29'), trunk: standard('#303b30'),
      player: standard('#e1e5b8', 0.6), armor: standard('#404947', 0.45, { metalness: 0.5 }), dark: standard('#141c1a'), cape: standard('#b5f45d', 0.8),
      lime: standard('#c1ff66', 0.3, { emissive: '#9edb32', emissiveIntensity: 1.5 }), crystal: standard('#a8ea4f', 0.5, { emissive: '#74a82d', emissiveIntensity: 0.6 }),
      enemy: standard('#634b57'), enemyDark: standard('#332a36'), enemy2: standard('#8d5840'), enemy3: standard('#54416e'), eye: standard('#ffa060', 0.5, { emissive: '#ff4e20', emissiveIntensity: 2 }),
      ranged: standard('#5c658e'), rangedGlow: new THREE.MeshBasicMaterial({ color: '#ee759a' }), boss: standard('#5d343b', 0.5, { metalness: 0.2 }), bossGlow: standard('#ef785c', 0.4, { emissive: '#f74435', emissiveIntensity: 1.4 }), enemyBolt: new THREE.MeshBasicMaterial({ color: '#ff7294' }),
      gold: standard('#ffd06b', 0.4, { emissive: '#c89d24', emissiveIntensity: 0.6 }), xp: standard('#b2ff67', 0.3, { emissive: '#88c43e', emissiveIntensity: 1 }),
      white: new THREE.MeshBasicMaterial({ color: '#e7ffc9' }),
    };
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.IcosahedronGeometry(1, 0), smallSphere: new THREE.IcosahedronGeometry(0.14, 0),
      monster: new THREE.IcosahedronGeometry(0.7, 0), cone: new THREE.ConeGeometry(0.26, 0.7, 4), xp: new THREE.OctahedronGeometry(0.15),
      enemyBolt: new THREE.IcosahedronGeometry(0.26, 0), rangedHood: new THREE.ConeGeometry(0.7, 1.3, 5),
      coin: new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8),
    };
  }

  box(material, x, y, z, sx, sy, sz, parent = this.scene) {
    const mesh = new THREE.Mesh(this.geo.box, material);
    mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  }

  createWorld() {
    this.hemi = new THREE.HemisphereLight('#d5e8c7', '#262923', 2.7);
    this.scene.add(this.hemi);
    const sunlight = this.sunlight = new THREE.DirectionalLight('#f2f2ce', 3.6);
    sunlight.position.set(-15, 35, 12); sunlight.castShadow = true;
    sunlight.shadow.mapSize.set(1024, 1024);
    Object.assign(sunlight.shadow.camera, { left: -28, right: 28, top: 28, bottom: -28, near: 0.5, far: 100 });
    sunlight.shadow.bias = -0.001;
    sunlight.shadow.normalBias = 0.05;
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight('#a5cf79', 1.1); fill.position.set(12, 8, -20); this.scene.add(fill);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(68, 62, 5, 24), this.mats.edge);
    island.position.y = -2.65; island.receiveShadow = true; this.scene.add(island);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(68.05, 68.05, 0.25, 24), this.mats.ground);
    ground.position.y = -0.08; ground.receiveShadow = true; this.scene.add(ground);
    const grid = new THREE.GridHelper(128, 64, '#63704b', '#576348');
    grid.position.y = 0.06; grid.material.transparent = true; grid.material.opacity = 0.15; this.scene.add(grid);
    this.floorGrid = grid;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(65.7, 0.06, 3, 24), new THREE.MeshBasicMaterial({ color: '#9ac967', transparent: true, opacity: 0.32 }));
    rim.rotation.x = Math.PI / 2; rim.position.y = 0.1; this.scene.add(rim);
    const center = new THREE.Group();
    for (let r = 0; r < 3; r++) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(3.4 + r * 0.35, 3.42 + r * 0.35, 6), new THREE.MeshBasicMaterial({ color: '#9ec96b', transparent: true, opacity: r === 0 ? 0.2 : 0.08, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08 + r * 0.001; center.add(ring);
    }
    this.scene.add(center);
    // Fixed pseudo-random scenery keeps restarts recognisable.
    let seed = 72;
    const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < 150; i++) {
      const angle = random() * TAU, radius = 6 + random() * 56;
      const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
      if (i < 70) {
        const rock = new THREE.Mesh(this.geo.sphere, i % 3 ? this.mats.rock : this.mats.rockDark);
        rock.position.set(x, 0.12, z); rock.scale.set(0.25 + random() * 0.9, 0.3 + random() * 0.8, 0.25 + random() * 0.8);
        rock.rotation.set(random(), random() * TAU, random()); rock.castShadow = i < 14; this.scene.add(rock);
      } else if (i < 120) {
        const tile = this.box(this.mats.rockDark, x, 0.07, z, 0.5 + random(), 0.1, 0.6 + random()); tile.rotation.y = random() * TAU;
      } else {
        this.createGrass(x, z, random);
      }
    }
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * TAU + 0.13, r = i < 8 ? 29 + (i % 2) * 2 : 60 + (i % 2) * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const height = 1.8 + (i % 3) * 0.9;
      const pillar = this.box(this.mats.rock, x, height / 2, z, 1.3, height, 1.3);
      pillar.rotation.y = a; pillar.castShadow = true;
      this.box(this.mats.rockDark, x, height + 0.05, z, 1.6, 0.22, 1.6).rotation.y = a;
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), this.mats.crystal);
      c.position.set(x, height + 0.7, z); c.scale.y = 1.6; this.scene.add(c);
      const pool = new THREE.Mesh(new THREE.CircleGeometry(2.2, 20), new THREE.MeshBasicMaterial({ color: '#a7e860', transparent: true, opacity: 0.055, depthWrite: false }));
      pool.rotation.x = -Math.PI / 2; pool.position.set(x, 0.065, z); this.scene.add(pool);
      if (i % 3 === 0) this.createDeadTree(x + 2, z - 2, 2.3 + i * 0.1);
    }
    // Drifting dust subtly establishes depth without texture downloads.
    const vertices = [];
    for (let i = 0; i < 110; i++) vertices.push(rnd(-68, 68), rnd(0.3, 9), rnd(-68, 68));
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.setStageMood(1, true);
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#bcce82', size: 0.055, transparent: true, opacity: 0.45, sizeAttenuation: true }));
    this.scene.add(this.dust);
  }

  createGrass(x, z, random) {
    for (let j = 0; j < 3; j++) {
      const grass = this.box(this.mats.trunk, x + j * 0.13, 0.22, z, 0.07, 0.35 + random() * 0.4, 0.07);
      grass.rotation.z = (random() - 0.5) * 0.9;
    }
  }
  createDeadTree(x, z, height) {
    const group = new THREE.Group(); group.position.set(x, 0, z);
    this.box(this.mats.trunk, 0, height / 2, 0, 0.3, height, 0.3, group).rotation.z = -0.14;
    const branch = this.box(this.mats.trunk, 0.35, height * 0.7, 0, 0.17, height * 0.6, 0.17, group); branch.rotation.z = -0.95;
    const branch2 = this.box(this.mats.trunk, -0.4, height * 0.65, 0, 0.14, height * 0.5, 0.14, group); branch2.rotation.z = 0.95;
    this.scene.add(group);
  }

  createPlayer() {
    this.player = new THREE.Group();
    this.player.position.set(0, 0, 0); this.player.scale.setScalar(1.65); this.scene.add(this.player);
    this.playerVisual = new THREE.Group(); this.player.add(this.playerVisual);
    const body = this.box(this.mats.armor, 0, 0.9, 0, 0.7, 0.8, 0.45, this.playerVisual); body.castShadow = true;
    this.box(this.mats.player, 0, 1.5, 0, 0.58, 0.58, 0.5, this.playerVisual).castShadow = true;
    this.box(this.mats.dark, 0, 1.53, 0.26, 0.6, 0.19, 0.06, this.playerVisual);
    this.box(this.mats.lime, 0.16, 1.54, 0.305, 0.17, 0.045, 0.03, this.playerVisual);
    this.box(this.mats.lime, -0.16, 1.54, 0.305, 0.17, 0.045, 0.03, this.playerVisual);
    const hood = this.box(this.mats.cape, 0, 1.85, -0.04, 0.66, 0.16, 0.62, this.playerVisual); hood.rotation.z = -0.1;
    this.cape = this.box(this.mats.cape, 0, 0.99, -0.33, 0.73, 1.2, 0.07, this.playerVisual); this.cape.rotation.x = -0.2;
    this.legLeft = this.box(this.mats.dark, -0.21, 0.28, 0, 0.23, 0.5, 0.27, this.playerVisual);
    this.legRight = this.box(this.mats.dark, 0.21, 0.28, 0, 0.23, 0.5, 0.27, this.playerVisual);
    this.box(this.mats.armor, -0.46, 1.05, 0, 0.27, 0.48, 0.35, this.playerVisual);
    this.swordArm = new THREE.Group(); this.swordArm.position.set(0.48, 1.02, 0.06); this.playerVisual.add(this.swordArm);
    this.box(this.mats.player, 0, -0.1, 0, 0.2, 0.4, 0.2, this.swordArm);
    this.box(this.mats.dark, 0.05, -0.1, 0.35, 0.17, 0.17, 0.45, this.swordArm);
    this.box(this.mats.cape, 0.05, -0.1, 0.6, 0.5, 0.1, 0.1, this.swordArm);
    this.box(this.mats.lime, 0.05, -0.1, 1.1, 0.13, 0.06, 0.95, this.swordArm);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.71, 32), new THREE.MeshBasicMaterial({ color: '#b9f76c', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.1; this.player.add(marker);
    this.playerLight = new THREE.PointLight('#c3ff68', 2.5, 8, 2); this.playerLight.position.set(0, 2.5, 0); this.player.add(this.playerLight);
    this.player.rotation.y = -0.65;
    this.resetTimers();
  }

  resetTimers() {
    this.lastGoldText = 0; this.pendingGoldText = 0;
    this.attackTimer = 0.2; this.spawnTimer = 1.3; this.bossSpawned = false; this.bossDefeated = false; this.boss = null; this.dashCooldown = 0; this.dashTime = 0; this.invulnerable = 0; this.shake = 0; this.comboTimer = 0; this.attackAnim = 0;
    this.dashDirection = new THREE.Vector3(0.707, 0, 0.707);
  }
  attractEnemies() {
    for (let i = 0; i < 19; i++) {
      const angle = i * 2.399, distance = 8 + (i % 5) * 2.7;
      this.spawnEnemy(Math.sin(angle) * distance, Math.cos(angle) * distance, i % 3);
    }
  }

  spawnEnemy(x, z, kind) {
    if (kind == null) {
      const roll = Math.random();
      kind = this._state.stage >= 3 && roll < 0.18 + (this._state.stage - 3) * 0.06 ? 3 : roll < 0.39 ? 2 : Math.random() < 0.38 ? 1 : 0;
    }
    const group = new THREE.Group(); group.position.set(x, 0, z);
    const visual = new THREE.Group(); group.add(visual);
    const material = kind === 4 ? this.mats.boss : kind === 3 ? this.mats.ranged : kind === 2 ? this.mats.enemy3 : kind === 1 ? this.mats.enemy2 : this.mats.enemy;
    const size = kind === 4 ? 3.1 : kind === 3 ? 1.02 : kind === 2 ? 1.18 : kind === 1 ? 0.88 : 0.96;
    const body = new THREE.Mesh(this.geo.monster, material); body.position.y = 0.72; body.scale.set(1, kind === 2 || kind === 4 ? 1.35 : 0.95, 0.85); visual.add(body); body.castShadow = this.enemies.length < 30;
    this.box(this.mats.enemyDark, -0.29, 0.15, 0, 0.24, 0.3, 0.28, visual);
    this.box(this.mats.enemyDark, 0.29, 0.15, 0, 0.24, 0.3, 0.28, visual);
    this.box(this.mats.eye, -0.2, 0.85, 0.45, 0.14, kind >= 2 ? 0.16 : 0.1, 0.08, visual);
    this.box(this.mats.eye, 0.2, 0.85, 0.45, 0.14, kind >= 2 ? 0.16 : 0.1, 0.1, visual);
    if (kind === 2 || kind === 4) {
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(this.geo.cone, kind === 4 ? this.mats.bossGlow : this.mats.enemyDark); horn.position.set(side * 0.4, 1.55, 0); horn.rotation.z = side * -0.35; visual.add(horn);
      }
      this.box(material, -0.72, 0.8, 0, 0.3, 0.62, 0.3, visual);
      this.box(material, 0.72, 0.8, 0, 0.3, 0.62, 0.3, visual);
      if (kind === 4) {
        this.box(this.mats.bossGlow, 0, 0.95, 0.55, 0.4, 0.45, 0.12, visual);
        const crown = this.box(this.mats.bossGlow, 0, 1.75, 0, 0.85, 0.14, 0.5, visual); crown.rotation.z = 0.08;
      }
    } else if (kind === 3) {
      const hood = new THREE.Mesh(this.geo.rangedHood, material); hood.position.y = 1.3; visual.add(hood);
      this.box(this.mats.enemyDark, 0.75, 0.9, 0, 0.12, 1.8, 0.12, visual);
      const gem = new THREE.Mesh(this.geo.sphere, this.mats.rangedGlow); gem.scale.setScalar(0.23); gem.position.set(0.75, 1.9, 0); visual.add(gem);
    } else if (kind === 1) {
      const horn = new THREE.Mesh(this.geo.cone, this.mats.enemyDark); horn.position.set(0, 1.4, 0); horn.rotation.z = 0.12; visual.add(horn);
    }
    group.scale.setScalar(size); this.scene.add(group);
    const stageStats = getStageStats(this._state.stage);
    const hp = kind === 4 ? getBossStats(this._state.stage).health : stageStats.enemyHealth * (kind === 2 ? 2.2 : kind === 1 ? 0.8 : kind === 3 ? 1.15 : 1);
    const enemy = { group, visual, hp, maxHp: hp, kind, size, speed: (kind === 4 ? 2.6 : kind === 3 ? 3 : kind === 2 ? 2.25 : kind === 1 ? 4.1 : 2.95) * (1 + this._state.stage * 0.055), hitTime: 0, slowTime: 0, slowFactor: 1, stagger: new THREE.Vector3(), seed: Math.random() * TAU, shootTimer: rnd(1.2, 2.6), windup: 0, aim: new THREE.Vector3() };
    this.enemies.push(enemy); return enemy;
  }

  spawnPosition(radiusMin = 12, radiusMax = 22) {
    let x, z;
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * TAU, radius = rnd(radiusMin, radiusMax);
      x = this.player.position.x + Math.sin(angle) * radius; z = this.player.position.z + Math.cos(angle) * radius;
      if (Math.hypot(x, z) < ARENA_RADIUS - 2) return { x, z };
    }
    const towardCenter = this.player.position.clone().setY(0).normalize().multiplyScalar(-14);
    return { x: this.player.position.x + towardCenter.x, z: this.player.position.z + towardCenter.z };
  }

  spawnBoss() {
    if (this.bossSpawned) return this.boss;
    const position = this.spawnPosition(15, 20);
    const boss = this.spawnEnemy(position.x, position.z, 4);
    const info = getBossStats(this._state.stage);
    Object.assign(boss, { name: info.name, mode: 'chase', actionTimer: 2.2, actionIndex: 0, telegraph: null, chargeDirection: new THREE.Vector3() });
    this.boss = boss; this.bossSpawned = true; this.bossDefeated = false;
    this.burst(boss.group.position, '#fb745b', 20); this.sound('stage');
    this.callbacks.onBoss?.(this.state.boss); this.emit(); return boss;
  }

  clearTelegraph(enemy) {
    if (!enemy?.telegraph) return;
    this.removeGroup(enemy.telegraph); enemy.telegraph.geometry.dispose(); enemy.telegraph.material.dispose(); enemy.telegraph = null;
  }

  createBossTelegraph(boss, kind) {
    this.clearTelegraph(boss);
    const geometry = kind === 'charge' ? new THREE.PlaneGeometry(3.2, 19) : new THREE.RingGeometry(0.1, 7.5, 48);
    const material = new THREE.MeshBasicMaterial({ color: '#ff725d', transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(boss.group.position); mesh.position.y = 0.15;
    if (kind === 'charge') {
      mesh.rotation.z = Math.atan2(boss.chargeDirection.x, boss.chargeDirection.z);
      mesh.position.addScaledVector(boss.chargeDirection, 8);
    }
    this.scene.add(mesh); boss.telegraph = mesh;
  }

  setupInput() {
    this.onKeyDown = (event) => {
      if (this._state.phase !== 'playing' || event.target?.closest?.('input,textarea,select')) return;
      const key = event.key.toLowerCase();
      if (key === ' ' && event.target?.closest?.('button,a')) return;
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
      // Escape is owned by the UI so its pause dialog always follows game state.
      if (key === 'escape') return;
      this.keys.add(key);
      if (key === ' ' && !event.repeat) this.dash();
    };
    this.onKeyUp = (event) => this.keys.delete(event.key.toLowerCase());
    this.onBlur = () => { this.keys.clear(); this.touchMove = { x: 0, y: 0 }; if (this._state.phase === 'playing') this.pause(); };
    this.onVisibility = () => { if (document.hidden) this.onBlur(); this.lastTime = performance.now(); };
    window.addEventListener('keydown', this.onKeyDown); window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur); document.addEventListener('visibilitychange', this.onVisibility);
    this.onPointerDown = (event) => { if (event.pointerType !== 'touch') return; this.touchStart = { x: event.clientX, y: event.clientY, id: event.pointerId }; this.renderer.domElement.setPointerCapture(event.pointerId); };
    this.onPointerMove = (event) => { if (!this.touchStart || this.touchStart.id !== event.pointerId) return; this.setMove((event.clientX - this.touchStart.x) / 55, (event.clientY - this.touchStart.y) / 55); };
    this.onPointerUp = () => { this.touchStart = null; this.setMove(0, 0); };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointerDown); this.renderer.domElement.addEventListener('pointermove', this.onPointerMove); this.renderer.domElement.addEventListener('pointerup', this.onPointerUp); this.renderer.domElement.addEventListener('pointercancel', this.onPointerUp);
  }

  setMove(x, y) { this.touchMove = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) }; }
  setMoveInput(x, y) { this.setMove(x, y); }
  inputDirection() {
    let x = (this.keys.has('d') || this.keys.has('arrowright') ? 1 : 0) - (this.keys.has('a') || this.keys.has('arrowleft') ? 1 : 0) + this.touchMove.x;
    let y = (this.keys.has('s') || this.keys.has('arrowdown') ? 1 : 0) - (this.keys.has('w') || this.keys.has('arrowup') ? 1 : 0) + this.touchMove.y;
    const length = Math.hypot(x, y); if (length > 1) { x /= length; y /= length; }
    return new THREE.Vector3((x + y) * Math.SQRT1_2, 0, (y - x) * Math.SQRT1_2);
  }
  dash() {
    if (this._state.phase !== 'playing' || this.dashCooldown > 0) return false;
    const direction = this.inputDirection();
    if (direction.lengthSq() > 0.01) this.dashDirection.copy(direction).normalize();
    else this.dashDirection.set(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    this.dashTime = 0.2; this.dashCooldown = 3; this.invulnerable = 0.4;
    this.sound('dash'); this.emit(); return true;
  }

  start() {
    this.clearDynamic(); this.stats = this.freshStats(); this._state = this.freshState('playing');
    this.player.position.set(0, 0, 0); this.player.rotation.y = -0.65; this.resetTimers(); this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.setStageMood(1, true);
    this.camera.position.set(20, 26, 25); this.camera.lookAt(this.player.position);
    this.initAudio(); this.sound('start'); this.emit();
  }
  restart() { this.start(); }
  pause() { if (this._state.phase === 'playing') { this._state.phase = 'paused'; this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.emit(); } }
  resume() { if (this._state.phase === 'paused') { this._state.phase = 'playing'; this.lastTime = performance.now(); this.emit(); } }
  chooseUpgrade(id) {
    if (this._state.phase !== 'upgrade' || !this.upgradeChoices?.some((choice) => choice.id === id)) return false;
    const before = this.stats.maxHp;
    if (!applyUpgrade(this.stats, id)) return false;
    this._state.hp = Math.min(this.stats.maxHp, this._state.hp + Math.max(0, this.stats.maxHp - before));
    this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this._state.phase = 'playing'; this.sound('upgrade'); this.emit(); return true;
  }
  purchaseUpgrade(id) {
    if (!['playing', 'paused'].includes(this._state.phase)) return false;
    const offer = getShopOffers(this.stats, this._state.stage).find(item => item.id === id);
    if (!offer || !Number.isFinite(offer.price) || offer.price <= 0 || this._state.gold < offer.price) return false;
    const before = this.stats.maxHp;
    if (!applyUpgrade(this.stats, id)) return false;
    this._state.gold -= offer.price;
    this._state.hp = Math.min(this.stats.maxHp, this._state.hp + Math.max(0, this.stats.maxHp - before));
    this.sound('upgrade'); this.emit(); return true;
  }

  openLevelUp() {
    if (this._state.phase !== 'playing' || this._state.xp < this._state.xpNeeded) return false;
    const s = this._state;
    s.xp -= s.xpNeeded; s.level++; s.xpNeeded = getXpRequired(s.level);
    this.upgradeChoices = getUpgradeChoices(this.stats);
    if (!this.upgradeChoices.length) return false;
    s.phase = 'upgrade'; this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.sound('upgrade'); this.callbacks.onLevelUp?.(this.upgradeChoices); this.emit(); return true;
  }

  setMuted(value) { this.muted = !!value; if (!this.muted) this.initAudio(); }
  setQuality(value) { this.quality = value; this.renderer.setPixelRatio(value === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.6)); this.renderer.shadowMap.enabled = value !== 'low'; this.resize(); }

  loop(time) {
    if (this.disposed) return;
    const dt = Math.min(Math.max((time - this.lastTime) / 1000, 0), 0.05); this.lastTime = time; this.frames++;
    if (this._state.phase === 'playing') this.tick(dt);
    else if (this._state.phase === 'menu') this.animateAttract(time / 1000);
    this.animateEffects(dt);
    this.updateMood(dt);
    if (this.dust) this.dust.rotation.y += dt * 0.002;
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
    if (time - this.lastUpdate > 100) { this.lastUpdate = time; this.emit(); }
    this.raf = requestAnimationFrame(this.loop);
  }

  animateAttract(time) {
    this.playerVisual.position.y = Math.sin(time * 2) * 0.035;
    this.cape.rotation.x = -0.25 + Math.sin(time * 2.5) * 0.06;
    for (const e of this.enemies) { e.visual.position.y = Math.sin(time * 2.8 + e.seed) * 0.07; e.group.rotation.y = Math.atan2(-e.group.position.x, -e.group.position.z); }
  }

  tick(dt) {
    const s = this._state; s.elapsed += dt; s.stageTime = Math.min(STAGE_DURATION, s.stageTime + dt);
    this.dashCooldown -= dt; this.invulnerable -= dt; this.dashTime -= dt; this.attackAnim = Math.max(0, this.attackAnim - dt);
    this.comboTimer -= dt; if (this.comboTimer <= 0) s.combo = 0;
    if (this.stats.regen > 0) s.hp = Math.min(this.stats.maxHp, s.hp + this.stats.maxHp * this.stats.regen / 100 * dt);
    const direction = this.inputDirection();
    const moving = direction.lengthSq() > 0.01;
    if (this.dashTime > 0) {
      this.player.position.addScaledVector(this.dashDirection, dt * 32);
      if (this.frames % 2 === 0) this.puff(this.player.position, '#b9f76c', 0.45, 0.22);
    } else this.player.position.addScaledVector(direction, this.stats.speed * dt);
    const distance = Math.hypot(this.player.position.x, this.player.position.z);
    if (distance > ARENA_RADIUS) { this.player.position.x *= ARENA_RADIUS / distance; this.player.position.z *= ARENA_RADIUS / distance; }
    this.playerVisual.position.y = moving ? Math.abs(Math.sin(s.elapsed * 13)) * 0.1 : Math.sin(s.elapsed * 3) * 0.025;
    this.legLeft.rotation.x = moving ? Math.sin(s.elapsed * 13) * 0.65 : 0; this.legRight.rotation.x = -this.legLeft.rotation.x;
    this.cape.rotation.x = -0.2 - (moving ? 0.3 : 0) + Math.sin(s.elapsed * 8) * 0.06;
    this.playerVisual.visible = this.invulnerable > 0.4 ? Math.floor(s.elapsed * 20) % 2 === 0 : true;
    this.swordArm.rotation.y = this.attackAnim > 0 ? Math.sin(this.attackAnim / 0.3 * Math.PI) * -2 : 0;
    if (moving) this.player.rotation.y = this.lerpAngle(this.player.rotation.y, Math.atan2(direction.x, direction.z), dt * 13);
    this.spawnTimer -= dt;
    if (!this.bossSpawned && s.stageTime >= BOSS_SPAWN_TIME) this.spawnBoss();
    const maxEnemies = Math.min(160, getStageStats(s.stage).maxEnemies || 145);
    if (this.spawnTimer <= 0 && this.enemies.length < maxEnemies) {
      const burst = s.stage >= 3 && s.stageTime > STAGE_DURATION * 0.45 ? 2 : 1;
      for (let n = 0; n < burst && this.enemies.length < maxEnemies; n++) {
        const position = this.spawnPosition(s.stage === 1 && s.stageTime < 15 ? 10 : 13, s.stage === 1 && s.stageTime < 15 ? 17 : 24);
        this.spawnEnemy(position.x, position.z);
      }
      this.spawnTimer = getSpawnInterval(s.stage, s.stageTime);
    }
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) { this.attack(); this.attackTimer = 1 / Math.max(0.2, this.stats.attackRate); }
    this.magic.update(dt);
    this.updateEnemies(dt);
    this.updateEnemyProjectiles(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    if (s.hp <= 0) { s.hp = 0; s.phase = 'over'; this.playerVisual.visible = true; this.sound('over'); this.callbacks.onGameOver?.(this.state); this.emit(); return; }
    if (this.openLevelUp()) return;
    if (s.stageTime >= STAGE_DURATION && this.bossDefeated) this.nextStage();
  }

  nextStage() {
    const s = this._state;
    if (!this.bossDefeated || s.stageTime < STAGE_DURATION) return false;
    for (const p of this.pickups) this.collectPickup(p, false);
    this.pickups.length = 0;
    if (s.stage >= MAX_STAGES) { s.phase = 'won'; this.sound('win'); this.callbacks.onWin?.(this.state); this.emit(); return true; }
    s.stage++; s.stageTime = 0; this.setStageMood(s.stage);
    this.stats.damage *= 1.8; this.stats.maxHp = Math.round(this.stats.maxHp * 2); s.hp = this.stats.maxHp;
    for (const enemy of this.enemies) { this.clearTelegraph(enemy); this.removeGroup(enemy.group); }
    this.enemies.length = 0;
    this.projectiles.forEach((p) => this.removeGroup(p.mesh)); this.projectiles.length = 0;
    this.clearEnemyProjectiles(); this.magic.reset(); this.boss = null; this.bossSpawned = false; this.bossDefeated = false;
    this.spawnTimer = 0.8; this.invulnerable = 1.5;
    this.burst(this.player.position, '#beff6e', 25); this.sound('stage'); this.callbacks.onStage?.(s.stage); this.emit(); return true;
  }

  takeDamage(rawDamage, source) {
    if (this._state.phase !== 'playing' || this.invulnerable > 0 || this._state.hp <= 0) return false;
    const damage = Math.max(1, rawDamage * (1 - Math.min(0.5, this.stats.armor)));
    this._state.hp -= damage; this.invulnerable = 0.75; this.shake = 0.22;
    this.floatText(`-${Math.round(damage)}`, this.player.position, '#ff8974', 1.1, 3);
    this.burst(this.player.position, '#ff996c', 6); this.sound('hurt'); return true;
  }

  updateEnemies(dt) {
    const pos = this.player.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]; if (!e || e.hp <= 0) continue;
      if (e.kind === 4) { this.updateBoss(e, dt); continue; }
      const dx = pos.x - e.group.position.x, dz = pos.z - e.group.position.z, distance = Math.hypot(dx, dz);
      const stagger = Math.max(0, e.hitTime); e.hitTime -= dt;
      e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
      const slow = e.slowTime > 0 ? Math.max(0.15, e.slowFactor || 0.5) : 1;
      let movement = 1;
      if (e.kind === 3) {
        movement = distance < 9 ? -0.8 : distance > 15 ? 1 : 0;
        e.shootTimer -= dt;
        if (e.windup > 0) {
          e.windup -= dt; movement *= 0.2;
          if (e.warning) e.warning.scale.setScalar(0.18 + (0.65 - e.windup) * 0.45);
          if (e.windup <= 0) {
            const spread = this._state.stage >= 5 ? 3 : 1;
            this.shootEnemyProjectile(e, e.aim, { count: spread, spread: 0.14 });
            this.removeGroup(e.warning); e.warning = null; e.shootTimer = Math.max(1.6, 3.4 - this._state.stage * 0.18);
          }
        } else if (e.shootTimer <= 0 && distance < 27) {
          e.windup = 0.65; e.aim.set(dx, 0, dz).normalize();
          e.warning = new THREE.Mesh(this.geo.sphere, this.mats.rangedGlow); e.warning.position.set(0, 1.7, 0.4); e.warning.scale.setScalar(0.18); e.group.add(e.warning);
        }
      }
      if (distance > 0.01) {
        const speed = e.speed * slow * (stagger > 0 ? 0.22 : 1) * movement;
        e.group.position.x += dx / distance * speed * dt + e.stagger.x * dt;
        e.group.position.z += dz / distance * speed * dt + e.stagger.z * dt;
        e.group.rotation.y = Math.atan2(dx, dz);
      }
      const boundary = Math.hypot(e.group.position.x, e.group.position.z);
      if (boundary > ARENA_RADIUS) e.group.position.multiplyScalar(ARENA_RADIUS / boundary);
      e.stagger.multiplyScalar(Math.max(0, 1 - dt * 9));
      e.visual.position.y = Math.abs(Math.sin(this._state.elapsed * (e.kind === 1 ? 13 : 7) + e.seed)) * 0.12;
      e.visual.scale.setScalar(stagger > 0 ? 1 + stagger * 0.6 : 1);
      if (distance < 1.2) {
        const rawDamage = getStageStats(this._state.stage).enemyDamage * (e.kind === 2 ? 1.4 : 1);
        if (this.takeDamage(rawDamage, e.group.position)) e.stagger.set(-dx / Math.max(distance, 0.01) * 8, 0, -dz / Math.max(distance, 0.01) * 8);
      }
      if (i % 2 === this.frames % 2) for (let j = Math.max(0, i - 6); j < i; j++) {
        const other = this.enemies[j]; if (!other || other.hp <= 0 || other.kind === 4) continue;
        const sx = e.group.position.x - other.group.position.x, sz = e.group.position.z - other.group.position.z, squared = sx * sx + sz * sz;
        if (squared > 0.0001 && squared < 0.9) { const force = dt * 1.8 / Math.sqrt(squared); e.group.position.x += sx * force; e.group.position.z += sz * force; }
      }
    }
  }

  updateBoss(boss, dt) {
    const dx = this.player.position.x - boss.group.position.x, dz = this.player.position.z - boss.group.position.z, distance = Math.hypot(dx, dz);
    boss.actionTimer -= dt; boss.hitTime = Math.max(0, boss.hitTime - dt); boss.slowTime = Math.max(0, (boss.slowTime || 0) - dt);
    const slow = boss.slowTime > 0 ? Math.max(0.55, boss.slowFactor || 0.5) : 1;
    const enraged = boss.hp / boss.maxHp < 0.5;
    if (boss.mode === 'chase') {
      if (distance > 2.5) { boss.group.position.x += dx / distance * boss.speed * slow * dt; boss.group.position.z += dz / distance * boss.speed * slow * dt; }
      boss.group.rotation.y = Math.atan2(dx, dz);
      if (boss.actionTimer <= 0) {
        boss.actionIndex++;
        if (boss.actionIndex % 2 === 1) {
          boss.mode = 'charge-warning'; boss.actionTimer = 0.95; boss.chargeDirection.set(dx, 0, dz).normalize(); this.createBossTelegraph(boss, 'charge');
        } else { boss.mode = 'pulse-warning'; boss.actionTimer = 1.05; this.createBossTelegraph(boss, 'pulse'); }
      }
    } else if (boss.mode === 'charge-warning') {
      if (boss.telegraph) boss.telegraph.material.opacity = 0.15 + (0.95 - boss.actionTimer) * 0.28;
      if (boss.actionTimer <= 0) { this.clearTelegraph(boss); boss.mode = 'charge'; boss.actionTimer = 0.65; }
    } else if (boss.mode === 'charge') {
      boss.group.position.addScaledVector(boss.chargeDirection, dt * (enraged ? 30 : 25));
      if (boss.actionTimer <= 0) { boss.mode = 'chase'; boss.actionTimer = enraged ? 2 : 2.8; }
    } else if (boss.mode === 'pulse-warning') {
      if (boss.telegraph) boss.telegraph.material.opacity = 0.12 + (1.05 - boss.actionTimer) * 0.32;
      if (boss.actionTimer <= 0) {
        this.clearTelegraph(boss);
        if (distance < 7.5) this.takeDamage(getBossStats(this._state.stage).damage * 1.3, boss.group.position);
        const wave = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.5, 48), new THREE.MeshBasicMaterial({ color: '#ff876c', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        wave.position.copy(boss.group.position); wave.position.y = 0.2; wave.rotation.x = -Math.PI / 2; this.scene.add(wave); this.effects.push({ mesh: wave, life: 0.5, total: 0.5, type: 'slash' });
        if (this._state.stage >= 3) this.shootEnemyProjectile(boss, new THREE.Vector3(dx, 0, dz).normalize(), { count: enraged ? 9 : 7, spread: 0.27, damage: getBossStats(this._state.stage).damage });
        boss.mode = 'chase'; boss.actionTimer = enraged ? 1.8 : 2.6;
      }
    }
    const radius = Math.hypot(boss.group.position.x, boss.group.position.z);
    if (radius > ARENA_RADIUS - 2) boss.group.position.multiplyScalar((ARENA_RADIUS - 2) / radius);
    boss.visual.position.y = Math.abs(Math.sin(this._state.elapsed * 5)) * 0.055;
    boss.visual.scale.setScalar(1 + (boss.hitTime > 0 ? 0.04 : 0));
    if (distance < 2.8) this.takeDamage(getBossStats(this._state.stage).damage * (boss.mode === 'charge' ? 1.5 : 1), boss.group.position);
  }

  shootEnemyProjectile(source, direction, options = {}) {
    const position = source.group?.position || source.position || source;
    const aim = direction?.clone?.() || this.player.position.clone().sub(position);
    aim.y = 0; aim.normalize();
    const count = Math.min(12, options.count || 1);
    for (let i = 0; i < count && this.enemyProjectiles.length < 80; i++) {
      const angle = Math.atan2(aim.x, aim.z) + (i - (count - 1) / 2) * (options.spread || 0);
      const velocity = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(options.speed || 9);
      const mesh = new THREE.Mesh(this.geo.enemyBolt, this.mats.enemyBolt); mesh.position.copy(position); mesh.position.y = 0.9; mesh.scale.setScalar(source.kind === 4 ? 1.35 : 1); this.scene.add(mesh);
      this.enemyProjectiles.push({ mesh, velocity, life: options.life || 5, damage: options.damage || getStageStats(this._state.stage).enemyDamage * 0.8 });
    }
  }

  updateEnemyProjectiles(dt) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.rotation.y += dt * 4;
      const dx = p.mesh.position.x - this.player.position.x, dz = p.mesh.position.z - this.player.position.z;
      if (dx * dx + dz * dz < 1) { this.takeDamage(p.damage, p.mesh.position); p.life = 0; }
      if (p.life <= 0 || Math.hypot(p.mesh.position.x, p.mesh.position.z) > 72) { this.removeGroup(p.mesh); this.enemyProjectiles.splice(i, 1); }
    }
  }

  clearEnemyProjectiles() { for (const p of this.enemyProjectiles) this.removeGroup(p.mesh); this.enemyProjectiles.length = 0; }

  attack() {
    let nearest = null, minDist = Infinity;
    for (const e of this.enemies) {
      const distance = e.group.position.distanceToSquared(this.player.position);
      if (e.hp > 0 && distance < minDist) { minDist = distance; nearest = e; }
    }
    if (!nearest || minDist > 6.8 * 6.8) return;
    const delta = nearest.group.position.clone().sub(this.player.position).setY(0).normalize();
    this.player.rotation.y = Math.atan2(delta.x, delta.z); this.attackAnim = 0.3;
    // The blade cleaves nearby enemies; acquired spells own ranged attacks.
    this.slash(delta);
    for (const e of [...this.enemies]) {
      if (e.hp <= 0) continue;
      const d = e.group.position.clone().sub(this.player.position); const length = d.length();
      if (length < 5.5 && (length < 1.5 || d.normalize().dot(delta) > -0.35)) this.hitEnemy(e, this.stats.damage * 1.25, delta);
    }
    this.sound('attack');
  }

  slash(direction) {
    const material = new THREE.MeshBasicMaterial({ color: '#c6ff89', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(3.9, 4.18, 26, 1, -Math.PI * 0.75, Math.PI * 1.5), material);
    mesh.rotation.x = -Math.PI / 2; mesh.rotation.z = -Math.atan2(direction.x, direction.z) - Math.PI / 2;
    mesh.position.copy(this.player.position); mesh.position.y = 0.38; this.scene.add(mesh);
    this.effects.push({ mesh, life: 0.26, total: 0.26, type: 'slash' });
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.direction, dt * 25);
      for (const e of [...this.enemies]) {
        if (e.hp <= 0 || p.hit.has(e)) continue;
        const dx = p.mesh.position.x - e.group.position.x, dz = p.mesh.position.z - e.group.position.z;
        if (dx * dx + dz * dz < (e.kind === 2 ? 1.2 : 0.85)) {
          this.hitEnemy(e, p.damage, p.direction); p.hit.add(e); p.pierce--; if (p.pierce <= 0) { p.life = 0; break; }
        }
      }
      if (p.life <= 0) { this.removeGroup(p.mesh); p.mesh.geometry.dispose(); this.projectiles.splice(i, 1); }
    }
  }

  hitEnemy(enemy, damage, direction = new THREE.Vector3()) {
    if (!enemy || enemy.hp <= 0 || !this.enemies.includes(enemy)) return false;
    const critical = Math.random() < this.stats.critChance;
    const dealt = damage * (critical ? 2 : 1);
    this.floatText(`${critical ? '✦ ' : ''}${Math.round(dealt).toLocaleString('en-US')}`, enemy.group.position, critical ? '#eeffad' : '#f1f4dc', critical ? 1.35 : 1, 1.65);
    enemy.hp -= dealt; enemy.hitTime = 0.16;
    enemy.stagger.copy(direction).multiplyScalar(enemy.kind === 4 ? 0.4 : critical ? 12 : 7);
    this.puff(enemy.group.position, critical ? '#fff6ba' : '#c3f788', critical ? 0.7 : 0.35, 0.22);
    if (enemy.hp <= 0) {
      const position = enemy.group.position.clone();
      this._state.kills++; this._state.combo++; this.comboTimer = 3;
      const bossReward = enemy.kind === 4 ? getBossStats(this._state.stage) : null;
      this.dropPickup(position, 'xp', bossReward ? bossReward.xpValue : enemy.kind === 2 ? 3 : enemy.kind === 3 ? 2 : 1);
      this.dropPickup(position, 'gold', bossReward ? bossReward.coinValue : getStageStats(this._state.stage).coinValue * (enemy.kind === 2 ? 3 : enemy.kind === 3 ? 2 : 1));
      if (enemy.kind === 4) {
        this.bossDefeated = true; this.clearTelegraph(enemy); this.sound('win');
        this.floatText('BOSS DEFEATED', position, '#ffcf86', 1.8, 5);
        this.callbacks.onBossDefeat?.(this.state.boss);
      }
      if (Math.random() < 0.03) this.dropPickup(position, 'heal', this.stats.maxHp * 0.12);
      this.burst(position, enemy.kind === 1 ? '#cb8a53' : '#987392', 4);
      this.removeGroup(enemy.group);
      const index = this.enemies.indexOf(enemy); if (index >= 0) this.enemies.splice(index, 1);
      if (critical) this.shake = Math.max(this.shake, 0.06);
    }
  }

  dropPickup(position, type, value) {
    if (this.pickups.length > 240) { const oldest = this.pickups.shift(); this.collectPickup(oldest, false); }
    const mesh = new THREE.Mesh(type === 'gold' ? this.geo.coin : this.geo.xp, type === 'gold' ? this.mats.gold : type === 'heal' ? this.mats.player : this.mats.xp);
    mesh.position.copy(position); mesh.position.x += rnd(-0.6, 0.6); mesh.position.z += rnd(-0.6, 0.6); mesh.position.y = 0.4;
    if (type === 'heal') mesh.scale.setScalar(1.7);
    this.scene.add(mesh); this.pickups.push({ mesh, type, value, age: 0, seed: Math.random() * TAU, collecting: false });
  }
  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]; p.age += dt; p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = 0.35 + Math.sin(p.age * 4 + p.seed) * 0.09;
      const dx = this.player.position.x - p.mesh.position.x, dz = this.player.position.z - p.mesh.position.z, distance = Math.hypot(dx, dz);
      if (distance < this.stats.magnet) p.collecting = true;
      if (p.collecting && distance > 0) {
        const amount = Math.min(distance, (12 + p.age * 0.3) * dt);
        p.mesh.position.x += dx / distance * amount; p.mesh.position.z += dz / distance * amount;
      }
      if (distance < 0.7 || p.age > 35) { this.collectPickup(p); this.pickups.splice(i, 1); }
    }
  }
  collectPickup(p, audio = true) {
    if (p.type === 'gold') {
      this._state.gold += p.value;
      if (audio) {
        this.pendingGoldText += p.value;
        if (this._state.elapsed - this.lastGoldText > 0.18) {
          this.floatText(`+${this.pendingGoldText.toLocaleString('en-US')} G`, this.player.position, '#ffd67c', 1.15, 3.7);
          this.pendingGoldText = 0; this.lastGoldText = this._state.elapsed;
        }
      }
    }
    else if (p.type === 'xp') this._state.xp += p.value;
    else this._state.hp = Math.min(this.stats.maxHp, this._state.hp + p.value);
    if (audio && p.type === 'gold' && this.frames % 4 === 0) this.sound('coin');
    this.removeGroup(p.mesh);
  }

  /** Camera-facing text keeps crits and the expanding currency easy to feel. */
  floatText(text, position, color, size = 1, height = 1.65) {
    if (this.floatingTexts.length >= 35) this.removeFloatingText(0);
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
    const context = canvas.getContext('2d'); if (!context) return;
    context.font = '800 64px Arial, sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.lineJoin = 'round'; context.strokeStyle = 'rgba(12,20,15,.95)'; context.lineWidth = 9;
    context.strokeText(text, 192, 66); context.fillStyle = color; context.fillText(text, 192, 66);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
    const sprite = new THREE.Sprite(material); sprite.position.copy(position); sprite.position.y += height;
    sprite.position.x += rnd(-0.3, 0.3); sprite.scale.set(4 * size, 1.333 * size, 1); sprite.renderOrder = 5;
    this.scene.add(sprite);
    this.floatingTexts.push({ sprite, texture, life: 0.9, total: 0.9, drift: rnd(-0.3, 0.3), size });
  }
  removeFloatingText(index) {
    const entry = this.floatingTexts[index]; if (!entry) return;
    this.removeGroup(entry.sprite); entry.texture.dispose(); entry.sprite.material.dispose(); this.floatingTexts.splice(index, 1);
  }
  setStageMood(stage, immediate = false) {
    const palettes = [
      ['#2c352b', '#111a15', '#d5e8c7', '#92be65'],
      ['#383128', '#1b1813', '#eed6ae', '#d7ae71'],
      ['#302a37', '#17131e', '#c9b8e7', '#ad91df'],
      ['#382b2b', '#1c1314', '#e7b8ae', '#d7957f'],
      ['#252f3a', '#101722', '#b4cde8', '#82c6dd'],
    ];
    const palette = palettes[clamp(stage - 1, 0, palettes.length - 1)];
    this.moodTarget = palette.map((hex) => new THREE.Color(hex));
    if (immediate) this.updateMood(100);
  }
  updateMood(dt) {
    if (!this.moodTarget || !this.hemi) return;
    const amount = 1 - Math.exp(-dt * 1.2), [ground, fog, sky, accent] = this.moodTarget;
    this.mats.ground.color.lerp(ground, amount); this.scene.fog.color.lerp(fog, amount); this.scene.background.lerp(fog, amount);
    this.hemi.color.lerp(sky, amount); this.mats.crystal.emissive.lerp(accent, amount); this.mats.crystal.color.lerp(accent, amount);
    this.floorGrid?.material.color.lerp(accent, amount);
  }

  puff(position, color, size, life) {
    const mesh = new THREE.Mesh(this.geo.sphere, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.7, wireframe: true, depthWrite: false }));
    mesh.position.copy(position); mesh.position.y += 0.7; mesh.scale.setScalar(size); this.scene.add(mesh);
    this.effects.push({ mesh, life, total: life, type: 'puff' });
  }
  burst(position, color, count) {
    if (this.effects.length > 100) return;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.geo.smallSphere, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }));
      mesh.position.copy(position); mesh.position.y += 0.5; this.scene.add(mesh);
      this.effects.push({ mesh, life: rnd(0.3, 0.6), total: 0.6, type: 'particle', velocity: new THREE.Vector3(rnd(-4, 4), rnd(2, 6), rnd(-4, 4)) });
    }
  }
  animateEffects(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const text = this.floatingTexts[i]; text.life -= dt;
      text.sprite.position.y += dt * 2.1; text.sprite.position.x += dt * text.drift;
      text.sprite.material.opacity = Math.min(1, Math.max(0, text.life / 0.3));
      if (text.life <= 0) this.removeFloatingText(i);
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.life -= dt;
      if (e.mesh.material.opacity !== undefined) e.mesh.material.opacity = Math.max(0, e.life / e.total) * (e.type === 'slash' ? 0.8 : 1);
      if (e.type === 'particle') { e.mesh.position.addScaledVector(e.velocity, dt); e.velocity.y -= dt * 14; }
      else e.mesh.scale.multiplyScalar(1 + dt * (e.type === 'slash' ? 2 : 4));
      if (e.life <= 0) { this.removeGroup(e.mesh); e.mesh.material.dispose(); if (e.type === 'slash') e.mesh.geometry.dispose(); this.effects.splice(i, 1); }
    }
    this.shake = Math.max(0, this.shake - dt);
  }

  updateCamera(dt) {
    const target = this.player.position.clone();
    target.y = 0.5;
    // A broad arena view makes the crowd readable while retaining true perspective.
    const menuOffset = this._state.phase === 'menu' ? 3.5 : 0;
    const cameraTarget = new THREE.Vector3(target.x + 20 - menuOffset, 26, target.z + 25 + menuOffset);
    this.camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
    if (this.shake > 0) { this.camera.position.x += rnd(-1, 1) * this.shake * 1.4; this.camera.position.z += rnd(-1, 1) * this.shake; }
    const lookTarget = new THREE.Vector3(target.x - menuOffset, 0.5, target.z + menuOffset);
    this.camera.lookAt(lookTarget);
    if (this.sunlight) { this.sunlight.position.set(target.x - 15, 35, target.z + 12); this.sunlight.target.position.set(target.x, 0, target.z); this.sunlight.target.updateMatrixWorld(); }
  }
  lerpAngle(a, b, t) { let difference = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + difference * Math.min(1, t); }
  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.9 ? 56 : 43; this.camera.updateProjectionMatrix();
  }
  removeGroup(group) { if (!group) return; group.parent?.remove(group); }
  clearDynamic() {
    while (this.floatingTexts.length) this.removeFloatingText(0);
    for (const e of this.enemies) { this.clearTelegraph(e); this.removeGroup(e.group); }
    this.clearEnemyProjectiles(); this.magic?.reset(); this.boss = null; this.bossSpawned = false; this.bossDefeated = false;
    for (const p of this.projectiles) { this.removeGroup(p.mesh); p.mesh.geometry.dispose(); }
    for (const p of this.pickups) this.removeGroup(p.mesh);
    for (const e of this.effects) { this.removeGroup(e.mesh); e.mesh.material.dispose(); if (e.type === 'slash') e.mesh.geometry.dispose(); }
    this.enemies.length = 0; this.projectiles.length = 0; this.pickups.length = 0; this.effects.length = 0;
    this.playerVisual.visible = true;
  }

  initAudio() {
    if (this.muted) return;
    try {
      if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audio.state === 'suspended') this.audio.resume().catch(() => {});
    } catch { /* Audio is optional; rendering and play never depend on it. */ }
  }
  sound(type) {
    if (this.muted || !this.audio || this.audio.state !== 'running') return;
    const now = this.audio.currentTime;
    if (type === 'attack' && now - (this.lastAttackSound || 0) < 0.15) return;
    if (type === 'attack') this.lastAttackSound = now;
    const frequencies = { attack: 190, hurt: 100, coin: 960, dash: 240, upgrade: 660, start: 440, stage: 580, win: 880, over: 110 };
    const osc = this.audio.createOscillator(), gain = this.audio.createGain();
    const duration = ['start', 'stage', 'win', 'upgrade'].includes(type) ? 0.25 : 0.08;
    osc.type = type === 'hurt' || type === 'over' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(frequencies[type] || 400, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, (frequencies[type] || 400) * (type === 'attack' ? 0.3 : type === 'over' ? 0.4 : 1.5)), now + duration);
    gain.gain.setValueAtTime(type === 'attack' ? 0.025 : 0.045, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(this.audio.destination); osc.start(now); osc.stop(now + duration);
  }

  getDebugState() { return { ...this.state, player: this.player.position.toArray(), enemies: this.enemies.length, pickups: this.pickups.length, floatingTexts: this.floatingTexts.length, projectiles: this.projectiles.length, enemyProjectiles: this.enemyProjectiles.length, rangedEnemies: this.enemies.filter(e => e.kind === 3).length, magic: this.magic?.getDebugState?.(), frames: this.frames, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, renderer: this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL', canvas: { width: this.renderer.domElement.width, height: this.renderer.domElement.height } }; }
  /** Deterministic-time simulation hook for smoke tests; respects pause and choices. */
  stepForTest(seconds) { for (let t = 0; t < seconds && this._state.phase === 'playing'; t += 1 / 60) { this.frames++; this.tick(1 / 60); this.animateEffects(1 / 60); } this.emit(); return this.getDebugState(); }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.observer.disconnect();
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.onBlur); document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown); this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove); this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp); this.renderer.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.clearDynamic(); this.magic?.dispose();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse((object) => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m)); });
    Object.values(this.geo).forEach((geometry) => geometries.add(geometry)); Object.values(this.mats).forEach((material) => materials.add(material));
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove(); this.audio?.close().catch(() => {});
  }
}
