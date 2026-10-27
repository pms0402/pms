import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { STAGE_DURATION, BOSS_SPAWN_TIME, MAX_STAGES, ARENA_RADIUS, getStageStats, getBossStats, getXpDropMultiplier, getSpawnInterval, getXpRequired, getUpgradeChoices, applyUpgrade } from './balance.js';
import { MagicSystem } from './magic.js';
import { BossSystem } from './bosses.js';
import { ENEMY_TYPES, getEnemyDefinition, chooseEnemyKind, getStageDefinition, getBossDefinition } from './encounters.js';
import { RISK_PACTS, getThreatModifiers, getRelicChoices, applyRelic, getBossReward, applyBossReward } from './content.js';
import { getSwordProfile, isSwordHit } from './sword.js';
import { CURSES, ROUTES, getRunModifiers, getCurseChoices } from './run-events.js';
import { getActiveSynergies } from './synergies.js';
import { createTerrainWorld } from './world.js';
import { buildMonster, createPlayerModel, animatePlayerModel, animateEnemyModel } from './creatures.js';
import { createActorMotion } from './motion.js';
import { EnemyRenderer } from './enemy-renderer.js';
import { createPresentationAssets } from './presentation.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;
const rnd = (a, b) => a + Math.random() * (b - a);
const permanentValue = (value, fallback, min, max) => Number.isFinite(Number(value)) ? clamp(Number(value), min, max) : fallback;

function normalizePermanentBonuses(bonuses = {}) {
  const source = bonuses && typeof bonuses === 'object' ? bonuses : {};
  return {
    damageMultiplier: permanentValue(source.damageMultiplier, 1, 0.6, 512),
    spellDamageMultiplier: permanentValue(source.spellDamageMultiplier, 1, 0.82, 400),
    maxHpMultiplier: permanentValue(source.maxHpMultiplier, 1, 0.85, 128),
    attackRateMultiplier: permanentValue(source.attackRateMultiplier, 1, 0.72, 4),
    spellRateMultiplier: permanentValue(source.spellRateMultiplier, 1, 1, 3),
    swordRangeMultiplier: permanentValue(source.swordRangeMultiplier, 1, 1, 2),
    spellAreaMultiplier: permanentValue(source.spellAreaMultiplier, 1, 1, 1.5),
    armorBonus: permanentValue(source.armorBonus, 0, 0, 0.3),
    magnetMultiplier: permanentValue(source.magnetMultiplier, 1, 1, 1.9),
    goldMultiplier: permanentValue(source.goldMultiplier, 1, 1, 2.5),
    characterId: ['wanderer', 'arcanist', 'berserker'].includes(source.characterId) ? source.characterId : 'wanderer',
    weaponId: ['voidblade', 'tempest', 'greatsword'].includes(source.weaponId) ? source.weaponId : 'voidblade',
  };
}

/** The rendering, input and simulation for VOIDRUN. All artwork is procedural. */
export class Game {
  constructor(container, callbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.keys = new Set();
    this.touchMove = { x: 0, y: 0 };
    this.enemies = [];
    this.activeEnemies = new Set();
    this.projectiles = [];
    this.enemyProjectiles = [];
    this.boss = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.pickups = [];
    this.effects = [];
    this.floatingTexts = [];
    this.textPool = [];
    this.effectPool = [];
    this.enemyPools = new Map();
    this.enemyTemplates = new Map();
    this.ownedGeometries = new Set();
    this.chests = [];
    this.altar = null;
    this.activeCurses = [];
    this.routeId = 'standard';
    this.enemySerial = 0;
    this.spatialBuckets = new Map();
    this.spatialDirty = true;
    this.selectedRisk = 'none';
    this.runRisk = 'none';
    this.frames = 0;
    this.muted = false;
    this.disposed = false;
    this.quality = 'high';
    this.playbackSpeed = 1;
    this.permanentBonuses = normalizePermanentBonuses();
    this.runCounter = 0;
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
    this.presentation = createPresentationAssets(this.renderer);
    this.scene.environment = this.presentation.environment; this.scene.environmentIntensity = .3;
    for (const material of [this.mats.rock, this.mats.rockDark]) { material.map = this.presentation.stoneMap; material.normalMap = this.presentation.stoneNormal; material.normalScale.set(.22, .22); }
    this.createWorld();
    this.createPlayer();
    this.magic = new MagicSystem(this);
    this.bossSystem = new BossSystem(this);
    this.scene.onBeforeRender = () => this.updateContactShadow();
    this.enemyRenderer = new EnemyRenderer(this.scene, this.enemies);
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

  freshStats() {
    const bonus = normalizePermanentBonuses(this.permanentBonuses);
    return { maxHp: 100 * bonus.maxHpMultiplier, damage: 18 * bonus.damageMultiplier, spellDamage: 18 * bonus.spellDamageMultiplier, attackRate: 1.5 * bonus.attackRateMultiplier, spellRate: 1.5 * bonus.spellRateMultiplier, swordRangeMultiplier: bonus.swordRangeMultiplier, spellAreaMultiplier: bonus.spellAreaMultiplier, characterId: bonus.characterId, weaponId: bonus.weaponId, speed: 7.5, magnet: 5.5 * bonus.magnetMultiplier, projectiles: 1, critChance: 0.08, armor: bonus.armorBonus, regen: 0, goldMultiplier: bonus.goldMultiplier, xpMultiplier: 1, reviveCharges: 0, eliteDamageBonus: 0, relics: [], bossRewards: [], spells: { fireball: 1, frost: 0, lightning: 0, orbit: 0 }, evolutions: {}, passiveLevels: {}, swordEvolution: '' };
  }
  freshState(phase) { return { phase, runId: null, hp: 100, xp: 0, xpNeeded: getXpRequired(1), level: 1, stage: 1, stageTime: 0, elapsed: 0, kills: 0, gold: 0, combo: 0, weaponName: '공허의 검' }; }
  getThreat() {
    const base = getThreatModifiers(this.stats, this.runRisk);
    const run = getRunModifiers(this.activeCurses, this.routeId);
    return { ...base, enemyHealth: base.enemyHealth * run.enemyHealth,
      enemyDamage: base.enemyDamage * run.enemyDamage, goldMultiplier: base.goldMultiplier * run.goldMultiplier,
      spawnRate: base.spawnRate * run.spawnMultiplier };
  }
  freshRunReport() {
    return { damageBySource: { sword: 0, fireball: 0, frost: 0, lightning: 0, orbit: 0, combo: 0, other: 0 },
      damageTaken: 0, deathCause: '', peakCombo: 0, curseIds: [], routeHistory: [{ stage: 1, id: 'standard' }], synergyTriggers: {} };
  }
  recordSynergy(id) {
    if (!this.runReport) return;
    this.runReport.synergyTriggers[id] = (this.runReport.synergyTriggers[id] || 0) + 1;
    if (this._state.elapsed >= (this.nextSynergyToast || 0)) {
      const combo = getActiveSynergies(this.stats).find(item => item.id === id);
      this.callbacks.onLoot?.(`${combo?.title || '조합'} 발동`);
      this.nextSynergyToast = this._state.elapsed + 5;
    }
  }
  get state() {
    const enemyKinds = Object.fromEntries(ENEMY_TYPES.map(type => [type.id, 0]));
    for (const enemy of this.enemies) if (enemy.definition) enemyKinds[enemy.definition.id]++;
    return { ...this._state, playbackSpeed: this.playbackSpeed, world: { hills: this.world?.hills.length || 0, structures: this.world?.structures.length || 0, elevation: this.player?.position.y || 0 }, enemyKinds, sword: getSwordProfile(this.stats), activeSynergies: getActiveSynergies(this.stats), activeCurses: [...this.activeCurses], routeId: this.routeId, runModifiers: getRunModifiers(this.activeCurses, this.routeId), runReport: this.runReport ? structuredClone(this.runReport) : this.freshRunReport(), pendingChests: this.pendingChestRewards?.length || 0, altar: this.altar ? { x: this.altar.group.position.x, z: this.altar.group.position.z, opened: this.altar.opened } : null, rewardTokens: this.pendingRelicSources?.length || 0, pendingBossRewards: (this.pendingBossRewards || []).map(reward => ({ ...reward })), maxHp: this.stats.maxHp, damage: this.stats.damage, attackRate: this.stats.attackRate, spellDamage: this.stats.spellDamage, spellRate: this.stats.spellRate, speed: this.stats.speed, risk: this.getThreat(), selectedRisk: this.selectedRisk, chests: this.chests.map(chest => ({ x: chest.group.position.x, z: chest.group.position.z, remaining: chest.guards.filter(guard => guard.hp > 0).length, opened: chest.opened })), eliteEnemies: this.enemies.filter(enemy => enemy.elite).length, goldenEnemies: this.enemies.filter(enemy => enemy.golden).length, dashCooldown: Math.max(0, this.dashCooldown || 0), dashReady: !(this.dashCooldown > 0), enemyCount: this.enemies.length, arenaRadius: ARENA_RADIUS, stageDuration: STAGE_DURATION, bossSpawnTime: BOSS_SPAWN_TIME, bossSpawned: this.bossSpawned, bossDefeated: this.bossDefeated, boss: this.boss ? { archetype: this.boss.archetype, hint: this.boss.hint, name: this.boss.name, hp: Math.max(0, this.boss.hp), maxHp: this.boss.maxHp, alive: this.boss.hp > 0, spawned: this.bossSpawned, defeated: this.bossDefeated, phase: this.boss.mode } : null, spellState: this.magic?.getState() || [], playerStats: { ...this.stats, relics: [...(this.stats.relics || [])], bossRewards: [...(this.stats.bossRewards || [])], spells: { ...this.stats.spells }, evolutions: { ...this.stats.evolutions }, passiveLevels: { ...this.stats.passiveLevels } } };
  }
  emit() { this.callbacks.onUpdate?.(this.state); }

  createMaterials() {
    const standard = (color, roughness = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });
    this.mats = {
      bone: standard('#c9bea0'), organ: standard('#763848', .65),
      ground: standard('#2c352b'), edge: standard('#171d1b'), rock: standard('#3a433a'), rockDark: standard('#252c29'), trunk: standard('#303b30'),
      player: standard('#e1e5b8', 0.6), armor: standard('#404947', 0.45, { metalness: 0.5 }), dark: standard('#141c1a'), cape: standard('#b5f45d', 0.8),
      lime: standard('#c1ff66', 0.3, { emissive: '#9edb32', emissiveIntensity: 1.5 }), crystal: standard('#a8ea4f', 0.5, { emissive: '#74a82d', emissiveIntensity: 0.6 }),
      enemy: standard('#55724c'), enemyDark: standard('#332a36'), enemy2: standard('#8d5840'), enemy3: standard('#54416e'), eye: standard('#ffa060', 0.5, { emissive: '#ff4e20', emissiveIntensity: 2 }),
      ranged: standard('#5c658e'), rangedGlow: new THREE.MeshBasicMaterial({ color: '#ee759a' }), boss: standard('#5d343b', 0.5, { metalness: 0.2 }), bossGlow: standard('#ef785c', 0.4, { emissive: '#f74435', emissiveIntensity: 1.4 }), enemyBolt: new THREE.MeshBasicMaterial({ color: '#ff7294' }),
      gold: standard('#ffd06b', 0.4, { emissive: '#c89d24', emissiveIntensity: 0.6 }), xp: standard('#b2ff67', 0.3, { emissive: '#88c43e', emissiveIntensity: 1 }),
      white: new THREE.MeshBasicMaterial({ color: '#e7ffc9' }),
      eliteAura: new THREE.MeshBasicMaterial({ color: '#d99aff', transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
      goldAura: new THREE.MeshBasicMaterial({ color: '#ffcf65', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
      charger: standard('#b67843'), bomber: standard('#749b3e'), splitter: standard('#3d8e89'), sniper: standard('#7993ae'), shaman: standard('#8b64ab'),
      healGlow: new THREE.MeshBasicMaterial({ color: '#b5ffc3', transparent: true, opacity: .8, depthWrite: false }),
    };
    this.geo = {
      box: new THREE.BoxGeometry(1, 1, 1), sphere: new THREE.IcosahedronGeometry(1, 0), smallSphere: new THREE.IcosahedronGeometry(0.14, 0),
      monster: new THREE.SphereGeometry(0.7, 12, 8), cone: new THREE.ConeGeometry(0.26, 0.7, 10), xp: new THREE.OctahedronGeometry(0.15),
      enemyBolt: new THREE.IcosahedronGeometry(0.26, 0), rangedHood: new THREE.ConeGeometry(0.7, 1.3, 5),
      aura: new THREE.RingGeometry(0.8, 0.89, 20),
      slash: new THREE.RingGeometry(0.12, 1, 40, 1, -Math.PI / 3, Math.PI * 2 / 3),
      coin: new THREE.CylinderGeometry(0.17, 0.17, 0.07, 8),
    };
    Object.assign(this.geo, {
      round: new THREE.SphereGeometry(1, 12, 8), roundSmall: new THREE.SphereGeometry(1, 8, 6), heroRound: new THREE.SphereGeometry(1, 20, 14),
      roundCylinder: new THREE.CylinderGeometry(1, 1, 1, 10), roundTaper: new THREE.CylinderGeometry(.15, 1, 1, 10), roundCone: new THREE.ConeGeometry(1, 1, 12),
      roundTorus: new THREE.TorusGeometry(1, .12, 6, 20), robe: new THREE.CylinderGeometry(.54, 1, 1, 16),
      capsule: new THREE.CapsuleGeometry(.5, 1, 4, 12), helmet: new THREE.SphereGeometry(1, 20, 14, 0, Math.PI * 2, 0, Math.PI * .47),
      brow: new THREE.TorusGeometry(.244, .023, 6, 24, Math.PI),
      torso: new THREE.LatheGeometry([new THREE.Vector2(0, -.3), new THREE.Vector2(.23, -.3), new THREE.Vector2(.26, -.12), new THREE.Vector2(.33, .12), new THREE.Vector2(.30, .28), new THREE.Vector2(.17, .35), new THREE.Vector2(0, .35)], 20),
    });
    const bladeShape = new THREE.Shape(); bladeShape.moveTo(-.6, 0); bladeShape.lineTo(.6, 0); bladeShape.lineTo(1, .14); bladeShape.lineTo(.65, .83); bladeShape.lineTo(0, 1); bladeShape.lineTo(-.65, .83); bladeShape.lineTo(-1, .14); bladeShape.closePath();
    this.geo.blade = new THREE.ExtrudeGeometry(bladeShape, { depth: .65, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .04, bevelThickness: .12 });
    this.geo.blade.rotateX(Math.PI / 2); this.geo.blade.translate(0, .325, 0); this.geo.blade.computeVertexNormals();
    this.swordGeometries = new Map([['default', this.geo.slash]]);
    for (const mode of ['broadsword', 'twinblade', 'wave']) {
      const profile = getSwordProfile({ swordEvolution: mode });
      const geometry = new THREE.RingGeometry(0.12, 1, 40, 1, -profile.arc / 2, profile.arc);
      this.swordGeometries.set(mode, geometry); this.ownedGeometries.add(geometry);
    }
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
    sunlight.shadow.normalBias = 0.03;
    this.scene.add(sunlight);
    const fill = new THREE.DirectionalLight('#a5cf79', 1.1); fill.position.set(12, 8, -20); this.scene.add(fill);
    this.world = createTerrainWorld(this);
    // Drifting dust subtly establishes depth without texture downloads.
    const vertices = [];
    for (let i = 0; i < 160; i++) { const x = rnd(-90, 90), z = rnd(-90, 90); vertices.push(x, this.groundHeight(x, z) + rnd(1, 12), z); }
    const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.batchStaticScenery();
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
    createPlayerModel(this);
    const contactGeometry = new THREE.PlaneGeometry(1, 1); this.ownedGeometries.add(contactGeometry);
    this.mats.playerContact = new THREE.MeshBasicMaterial({ map: this.presentation.contactMap, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
    this.playerShadow = new THREE.Mesh(contactGeometry, this.mats.playerContact); this.playerShadow.scale.set(1.5, 1.15, 1); this.scene.add(this.playerShadow);
    this._groundNormal = new THREE.Vector3(); this._planeNormal = new THREE.Vector3(0, 0, 1);
    const marker = new THREE.Mesh(new THREE.RingGeometry(0.66, 0.71, 32), new THREE.MeshBasicMaterial({ color: '#b9f76c', transparent: true, opacity: 0.6, side: THREE.DoubleSide }));
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.1; this.player.add(marker);
    this.playerLight = new THREE.PointLight('#c3ff68', 2.5, 8, 2); this.playerLight.position.set(0, 2.5, 0); this.player.add(this.playerLight);
    this.player.rotation.y = -0.65; this.applyLoadoutAppearance();
    this.resetTimers();
  }

  updateContactShadow() {
    const { x, z } = this.player.position;
    const dx = (this.groundHeight(x + .25, z) - this.groundHeight(x - .25, z)) * 2;
    const dz = (this.groundHeight(x, z + .25) - this.groundHeight(x, z - .25)) * 2;
    this._groundNormal.set(-dx, 1, -dz).normalize();
    this.playerShadow.position.set(x, this.groundHeight(x, z) + .028, z);
    this.playerShadow.quaternion.setFromUnitVectors(this._planeNormal, this._groundNormal);
    this.playerShadow.visible = this.playerVisual.visible;
    this.playerShadow.updateMatrixWorld();
  }

  applyLoadoutAppearance() {
    const colors = {
      wanderer: ['#708665', '#596571', '#b8d99c'],
      arcanist: ['#b292f0', '#46405d', '#c7abff'],
      berserker: ['#ef795f', '#5b3e3b', '#ffb477'],
    }[this.stats.characterId] || ['#708665', '#596571', '#b8d99c'];
    this.playerHood.material.color.set(colors[0]); this.playerBody.material.color.set(colors[1]);
    this.blade.material.color.set(colors[2]); this.blade.material.emissive.set(colors[2]);
    const weapon = this.stats.weaponId;
    this.blade.scale.set(weapon === 'greatsword' ? .16 : weapon === 'tempest' ? .075 : .11, .045, weapon === 'greatsword' ? 1.45 : weapon === 'tempest' ? 1.05 : 1.15);
    this.blade.position.set(0, 0, .30);
    const profile = getSwordProfile(this.stats);
    const reach = Math.min(1.8, Math.sqrt(Math.max(1, this.stats.swordRangeMultiplier || 1)));
    this.blade.scale.z *= reach;
    if (profile.mode === 'broadsword') this.blade.scale.x *= 2;
    if (profile.mode !== 'default') {
      this.blade.material.color.set(profile.color); this.blade.material.emissive.set(profile.color);
    }
    if (!this.offhandBlade) {
      this.offhandBlade = this.blade.clone(); this.offhandBlade.position.set(0, 0, .30);
      this.offhandGrip.add(this.offhandBlade);
    }
    this.offhandBlade.visible = profile.mode === 'twinblade';
    this.offhandParts?.forEach(mesh => { mesh.visible = profile.mode === 'twinblade'; });
    this.offhandBlade.scale.copy(this.blade.scale); this.offhandBlade.rotation.y = -0.4;
  }

  resetTimers() {
    this.lastGoldText = 0; this.pendingGoldText = 0;
    this.nextChestTime = 20; this.nextEliteTime = 30; this.nextGoldenTime = 40;
    this.nextAltarTime = 45; this.activeCurses = []; this.routeId = 'standard'; this.runReport = this.freshRunReport(); this.nextSynergyToast = 0;
    this.pendingChestRewards = []; this.chestChoices = []; this.activeChestReward = null; this.curseChoices = []; this.routeChoices = []; this.pendingRouteStage = null;
    this.stageChestCount = 0; this.eliteKills = 0; this.pendingRelicSources = []; this.pendingBossRewards = []; this.relicChoices = []; this.upgradeChoices = [];
    this.attackTimer = 0.2; this.spawnTimer = 1.3; this.bossSpawned = false; this.bossDefeated = false; this.boss = null; this.dashCooldown = 0; this.dashTime = 0; this.invulnerable = 0; this.shake = 0; this.comboTimer = 0; this.attackAnim = 0;
    this.playerMotion = createActorMotion(this.player);
    this.playerVisual.position.set(0, 0, 0); this.playerVisual.rotation.set(0, 0, 0);
    this.dashDirection = new THREE.Vector3(0.707, 0, 0.707);
  }
  attractEnemies() {
    for (let i = 0; i < 19; i++) {
      const angle = i * 2.399, distance = 8 + (i % 5) * 2.7;
      this.spawnEnemy(Math.sin(angle) * distance, Math.cos(angle) * distance, i % 3);
    }
  }

  createEnemyTemplate(kind) {
    const visual = new THREE.Group();
    const material = ({ 5: this.mats.charger, 6: this.mats.bomber, 7: this.mats.splitter, 8: this.mats.sniper, 9: this.mats.shaman })[kind] || (kind === 4 ? this.mats.boss : kind === 3 ? this.mats.ranged : kind === 2 ? this.mats.enemy3 : kind === 1 ? this.mats.enemy2 : this.mats.enemy);
    buildMonster(this, visual, kind, material);
    // Geometry is baked once per material and shared by every enemy of this kind.
    const byMaterial = new Map();
    visual.updateMatrixWorld(true);
    for (const mesh of visual.children) {
      const entries = byMaterial.get(mesh.material) || [];
      // Box/cone geometry is indexed while the faceted body is non-indexed.
      // Normalize the layout before merging so arms and the body stay intact.
      const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
      entries.push(geometry.applyMatrix4(mesh.matrix));
      byMaterial.set(mesh.material, entries);
    }
    visual.clear();
    for (const [material, geometries] of byMaterial) {
      const geometry = mergeGeometries(geometries, false);
      geometries.forEach(entry => entry.dispose());
      if (!geometry) continue;
      this.ownedGeometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = true; mesh.receiveShadow = true;
      visual.add(mesh);
    }
    this.enemyTemplates.set(kind, visual);
    return visual;
  }

  spawnEnemy(x, z, kind, options = {}) {
    if (kind == null) kind = chooseEnemyKind(this._state.stage);
    const definition = kind === 4 ? null : getEnemyDefinition(kind);
    if (kind !== 4 && !definition) return null;
    const poolKey = options.splitChild ? 'splitling' : kind;
    const visualKind = options.splitChild ? 7 : kind;
    const pooled = this.enemyPools.get(poolKey)?.pop();
    const group = pooled?.group || new THREE.Group();
    const visual = pooled?.visual || (this.enemyTemplates.get(visualKind) || this.createEnemyTemplate(visualKind)).clone();
    if (!visual.parent) group.add(visual);
    visual.position.set(0, 0, 0); visual.rotation.set(0, 0, 0); visual.scale.setScalar(1); visual.visible = true;
    group.position.set(x, this.groundHeight(x, z), z); group.rotation.set(0, 0, 0);
    const elite = !!options.elite, golden = !!options.golden;
    const size = (kind === 4 ? 3.1 : definition.size) * (elite ? 1.3 : golden ? 1.12 : options.splitChild ? .65 : options.minion ? .8 : 1);
    group.scale.setScalar(size); this.scene.add(group);
    for (const mesh of visual.children) mesh.castShadow = kind === 4 || this.enemies.length < 30;
    const stageStats = getStageStats(this._state.stage), threat = this.getThreat();
    const hp = (kind === 4 ? getBossStats(this._state.stage).health : stageStats.enemyHealth * definition.healthMultiplier) * threat.enemyHealth * (elite ? 2.8 : golden ? 2 : options.guard ? 1.6 : options.minion ? .55 : 1);
    const enemy = { poolKey, visualKind, spawnSerial: ++this.enemySerial, group, visual, hp, maxHp: hp, kind, definition, name: definition?.name || '수호자', size, elite, golden, minion: !!options.minion, splitChild: !!options.splitChild, guard: !!options.guard,
      rewardMultiplier: (elite ? 4 : golden ? 8 : options.guard ? 1.6 : options.minion ? .25 : 1),
      damageMultiplier: (elite ? 1.5 : golden || options.guard ? 1.2 : options.minion ? .65 : 1),
      baseDamageMultiplier: definition?.damageMultiplier || 1,
      escapeTime: golden ? 16 : Infinity,
      speed: (kind === 4 ? 2.6 : definition.speed) * (1 + Math.min(this._state.stage, 6) * 0.055) * threat.enemySpeed * (golden ? 1.25 : 1),
      hitTime: 0, slowTime: 0, slowFactor: 1, stagger: new THREE.Vector3(), seed: Math.random() * TAU,
      shootTimer: rnd(1.2, 2.6), windup: 0, aim: new THREE.Vector3(), action: 'chase', actionTimer: rnd(1.5, 3), specialCasts: 0 };
    if (elite || golden || options.guard) {
      const ring = new THREE.Mesh(this.geo.aura, golden ? this.mats.goldAura : this.mats.eliteAura);
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.09; group.add(ring); enemy.aura = ring;
    }
    enemy.guardHome = options.guard ? new THREE.Vector3(x, 0, z) : null;
    this.magic?.resetEnemyStatus(enemy);
    this.enemies.push(enemy); this.activeEnemies.add(enemy); this.spatialDirty = true;
    return enemy;
  }

  releaseEnemy(enemy) {
    this.activeEnemies.delete(enemy);
    this.clearTelegraph(enemy); this.removeGroup(enemy.warning); this.removeGroup(enemy.aura); this.removeGroup(enemy.group);
    enemy.warning = null; enemy.aura = null;
    const pool = this.enemyPools.get(enemy.poolKey ?? enemy.kind) || [];
    if (pool.length < 48) pool.push({ group: enemy.group, visual: enemy.visual });
    this.enemyPools.set(enemy.poolKey ?? enemy.kind, pool); this.spatialDirty = true;
  }

  batchStaticScenery() {
    this.scene.updateMatrixWorld(true);
    const groups = new Map();
    this.scene.traverse(mesh => {
      if (!mesh.isMesh || mesh.isInstancedMesh || mesh.userData.noStaticBatch) return;
      const key = `${mesh.geometry.uuid}:${mesh.material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}`;
      const entries = groups.get(key) || []; entries.push(mesh); groups.set(key, entries);
    });
    for (const meshes of groups.values()) {
      if (meshes.length < 2) continue;
      const first = meshes[0], batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow;
      meshes.forEach((mesh, index) => batch.setMatrixAt(index, mesh.matrixWorld));
      batch.computeBoundingSphere(); this.scene.add(batch);
      meshes.forEach(mesh => mesh.removeFromParent());
    }
  }

  rebuildSpatialIndex() {
    this.spatialBuckets.clear();
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      const key = `${Math.floor(enemy.group.position.x / 6)},${Math.floor(enemy.group.position.z / 6)}`;
      const bucket = this.spatialBuckets.get(key) || [];
      bucket.push(enemy); this.spatialBuckets.set(key, bucket);
    }
    this.spatialDirty = false;
  }

  queryEnemies(position, radius) {
    const result = [], squared = radius * radius;
    const test = enemy => {
      const dx = enemy.group.position.x - position.x, dz = enemy.group.position.z - position.z;
      if (enemy.hp > 0 && dx * dx + dz * dz <= squared) result.push(enemy);
    };
    // Direct manipulation in tools/tests also remains safe before the next index rebuild.
    if (this.spatialDirty) { this.enemies.forEach(test); return result; }
    const minX = Math.floor((position.x - radius) / 6), maxX = Math.floor((position.x + radius) / 6);
    const minZ = Math.floor((position.z - radius) / 6), maxZ = Math.floor((position.z + radius) / 6);
    for (let x = minX; x <= maxX; x++) for (let z = minZ; z <= maxZ; z++) {
      const bucket = this.spatialBuckets.get(`${x},${z}`);
      if (bucket) bucket.forEach(test);
    }
    return result;
  }

  groundHeight(x, z) { return this.world?.height(x, z) || 0; }

  fitGroundMesh(mesh, offset = .14) {
    if (!this.world) return;
    mesh.updateWorldMatrix(true, false);
    const positions = mesh.geometry.attributes.position;
    const point = new THREE.Vector3(), inverse = mesh.matrixWorld.clone().invert();
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      point.y = this.groundHeight(point.x, point.z) + offset;
      point.applyMatrix4(inverse); positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true; mesh.geometry.computeBoundingSphere();
  }

  spawnPosition(radiusMin = 12, radiusMax = 22) {
    let x, z;
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * TAU, radius = rnd(radiusMin, radiusMax);
      x = this.player.position.x + Math.sin(angle) * radius; z = this.player.position.z + Math.cos(angle) * radius;
      if (Math.hypot(x, z) < ARENA_RADIUS - 2 && (!this.world || this.world.isWalkable(x, z, 1.8))) return { x, z };
    }
    const towardCenter = this.player.position.clone().setY(0).normalize().multiplyScalar(-14);
    const fallback = this.player.position.clone().add(towardCenter); this.world?.resolve(fallback, 1.8);
    return { x: fallback.x, z: fallback.z };
  }

  spawnBoss() {
    if (this.bossSpawned) return this.boss;
    const position = this.spawnPosition(15, 20);
    const boss = this.spawnEnemy(position.x, position.z, 4);
    const info = getBossStats(this._state.stage);
    const aspect = info.aspect || [1, 1, 1], scale = info.scale || 3.1;
    boss.group.scale.set(scale * aspect[0], scale * aspect[1], scale * aspect[2]);
    boss.size = scale; boss.speed *= info.speedMultiplier || 1;
    Object.assign(boss, { name: info.name, archetype: info.archetype || getBossDefinition(this._state.stage).archetype, hint: info.hint || getBossDefinition(this._state.stage).hint, mode: 'chase', actionTimer: 2.2, actionIndex: 0, telegraph: null, chargeDirection: new THREE.Vector3() });
    this.boss = boss; this.bossSpawned = true; this.bossDefeated = false;
    this.bossSystem.begin(boss);
    this.burst(boss.group.position, '#fb745b', 20); this.sound('stage');
    this.callbacks.onBoss?.(this.state.boss); this.emit(); return boss;
  }

  clearTelegraph(enemy) {
    if (!enemy?.telegraph) return;
    this.removeGroup(enemy.telegraph); enemy.telegraph.geometry.dispose(); enemy.telegraph.material.dispose(); enemy.telegraph = null;
  }

  createBossTelegraph(boss, kind) {
    this.clearTelegraph(boss);
    const geometry = kind === 'charge' ? new THREE.PlaneGeometry(3.2, 19, 1, 20) : new THREE.RingGeometry(0.1, 7.5, 48, 6);
    const material = new THREE.MeshBasicMaterial({ color: '#ff725d', transparent: true, opacity: 0.24, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material); mesh.rotation.x = -Math.PI / 2;
    mesh.position.copy(boss.group.position); mesh.position.y += 0.15;
    if (kind === 'charge') {
      mesh.rotation.z = Math.atan2(boss.chargeDirection.x, boss.chargeDirection.z);
      mesh.position.addScaledVector(boss.chargeDirection, 8);
    }
    this.scene.add(mesh); this.fitGroundMesh(mesh, .15); boss.telegraph = mesh;
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
    this.onBlur = () => { this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.touchStart = null; };
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
    if (this.stats.dashShockwave) {
      this.puff(this.player.position, '#a4e8ff', 3, 0.35);
      for (const enemy of this.queryEnemies(this.player.position, 5)) this.hitEnemy(enemy, this.stats.damage * 0.8, this.dashDirection, 'explosion');
    }
    this.sound('dash'); this.emit(); return true;
  }

  start() {
    this.clearDynamic(); this.runRisk = this.selectedRisk; this.stats = this.freshStats(); this._state = this.freshState('playing');
    this._state.weaponName = { voidblade: '공허의 검', tempest: '질풍의 검', greatsword: '파쇄 대검' }[this.stats.weaponId];
    this.applyLoadoutAppearance();
    this._state.hp = this.stats.maxHp;
    this.runCounter++;
    this._state.runId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${this.runCounter}`;
    this.player.position.set(0, 0, 0); this.player.rotation.y = -0.65; this.resetTimers(); this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.setStageMood(1, true);
    this.camera.position.set(20, 26, 25); this.camera.lookAt(this.player.position);
    this.initAudio(); this.sound('start'); this.emit();
  }
  restart() { this.start(); }
  endRun() {
    if (!['playing', 'paused'].includes(this._state.phase)) return false;
    this._state.phase = 'over'; this._state.endedReason = 'abandoned';
    this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.callbacks.onGameOver?.(this.state); this.emit(); return true;
  }
  pause() { if (this._state.phase === 'playing') { this._state.phase = 'paused'; this.keys.clear(); this.touchMove = { x: 0, y: 0 }; this.emit(); } }
  resume() { if (this._state.phase === 'paused') { this._state.phase = 'playing'; this.lastTime = performance.now(); this.emit(); } }
  chooseUpgrade(id) {
    if (this._state.phase !== 'upgrade') return false;
    const choice = this.upgradeChoices?.find(candidate => candidate.id === id);
    if (!choice) return false;
    const before = this.stats.maxHp;
    let applied = false;
    if (choice.category === 'relic') {
      if (!this.pendingRelicSources.length || id !== `relic_${choice.rewardId}`) return false;
      applied = applyRelic(this.stats, choice.rewardId);
      if (applied) this.pendingRelicSources.shift();
    } else if (choice.category === 'boss') {
      const index = this.pendingBossRewards.findIndex(reward => reward.id === choice.rewardId && reward.stage === choice.sourceStage);
      if (index < 0 || id !== `boss_${choice.rewardId}`) return false;
      applied = applyBossReward(this.stats, this.pendingBossRewards[index].stage);
      if (applied) this.pendingBossRewards.splice(index, 1);
    } else applied = applyUpgrade(this.stats, id);
    if (!applied) return false;
    this._state.hp = Math.min(this.stats.maxHp, this._state.hp + Math.max(0, this.stats.maxHp - before));
    this.upgradeChoices = []; this.relicChoices = [];
    this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this._state.phase = 'playing'; this.lastTime = performance.now();
    this.applyLoadoutAppearance();
    if (choice.category === 'relic' || choice.category === 'boss') this.callbacks.onLoot?.(`${choice.title} 선택 완료`);
    this.sound('upgrade'); this.emit(); return true;
  }
  setPermanentBonuses(bonuses = {}) {
    if (!['menu', 'over', 'won'].includes(this._state.phase)) return false;
    this.permanentBonuses = normalizePermanentBonuses(bonuses);
    return true;
  }

  setRiskPact(id) {
    if (!['menu', 'over', 'won'].includes(this._state.phase) || !RISK_PACTS.some(pact => pact.id === id)) return false;
    this.selectedRisk = id; this.emit(); return true;
  }

  /** Elite rewards are kept until an earned level-up; guarded chests open immediately. */
  openRelic(source = '보물상자') {
    if (this._state.phase !== 'playing') return false;
    this.pendingRelicSources.push(typeof source === 'string' && source.trim() ? source : '보물상자');
    this.callbacks.onLoot?.('유물 선택권 획득 · 다음 레벨업에서 선택할 수 있습니다');
    this.emit(); return true;
  }

  chooseRelic(id) {
    if (this._state.phase !== 'upgrade' || !this.upgradeChoices?.some(choice => choice.id === `relic_${id}` && choice.category === 'relic')) return false;
    return this.chooseUpgrade(`relic_${id}`);
  }

  openChestReward(source = '수호 보물상자', metadata = {}) {
    if (!['playing', 'relic'].includes(this._state.phase)) return false;
    this.pendingChestRewards.push({ source, gold: Math.max(0, Number(metadata.gold) || 0) });
    if (this._state.phase === 'playing') this.openNextChestReward();
    return true;
  }

  openNextChestReward() {
    if (this._state.phase !== 'playing' || !this.pendingChestRewards.length) return false;
    this.activeChestReward = this.pendingChestRewards.shift();
    this.chestChoices = getRelicChoices(this.stats);
    if (!this.chestChoices.length) {
      this.activeChestReward = null;
      this.callbacks.onLoot?.('유물 수집 완료 · 보물상자 골드를 획득했습니다');
      return this.pendingChestRewards.length ? this.openNextChestReward() : false;
    }
    this._state.phase = 'relic'; this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.callbacks.onChestReward?.(this.chestChoices, { ...this.activeChestReward }); this.emit(); return true;
  }

  chooseChestReward(id) {
    if (this._state.phase !== 'relic' || !this.activeChestReward || !this.chestChoices.some(item => item.id === id)) return false;
    const hpBefore = this.stats.maxHp;
    if (!applyRelic(this.stats, id)) return false;
    this._state.hp = Math.min(this.stats.maxHp, this._state.hp + Math.max(0, this.stats.maxHp - hpBefore));
    this.chestChoices = []; this.activeChestReward = null;
    this._state.phase = 'playing'; this.lastTime = performance.now();
    this.applyLoadoutAppearance(); this.sound('upgrade'); this.emit(); return true;
  }

  spawnAltar() {
    if (this.altar || !getCurseChoices(this.activeCurses).length) return null;
    const position = this.spawnPosition(8, 12), group = new THREE.Group();
    group.position.set(position.x, this.groundHeight(position.x, position.z), position.z);
    this.box(this.mats.dark, 0, 0.25, 0, 1.6, 0.5, 1.6, group);
    this.box(this.mats.bossGlow, 0, 0.85, 0, 0.5, 1, 0.5, group).rotation.y = Math.PI / 4;
    const marker = new THREE.Mesh(this.geo.aura, this.mats.eliteAura);
    marker.rotation.x = -Math.PI / 2; marker.position.y = 0.12; marker.scale.setScalar(2.5); group.add(marker);
    this.scene.add(group); this.altar = { group, marker, opened: false };
    this.callbacks.onLoot?.('저주 제단 출현 · 다가가면 위험과 보상을 선택합니다'); return this.altar;
  }

  openCurseAltar() {
    if (this._state.phase !== 'playing') return false;
    this.curseChoices = getCurseChoices(this.activeCurses);
    if (!this.curseChoices.length) return false;
    if (this.altar?.opened) return false;
    if (this.altar) this.altar.opened = true;
    this._state.phase = 'curse'; this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.callbacks.onCurse?.(this.curseChoices, { stage: this._state.stage }); this.emit(); return true;
  }

  chooseCurse(id) {
    if (this._state.phase !== 'curse' || (id !== 'skip' && !this.curseChoices.some(item => item.id === id))) return false;
    if (id !== 'skip') {
      const before = this.getThreat().enemyHealth;
      this.activeCurses.push(id); this.runReport.curseIds = [...this.activeCurses];
      const ratio = this.getThreat().enemyHealth / before;
      for (const enemy of this.enemies) {
        enemy.maxHp *= ratio; enemy.hp *= ratio;
      }
      this.callbacks.onLoot?.(`${CURSES.find(item => item.id === id).title} · 위험과 보상 증가`);
    }
    if (this.altar) { this.altar.opened = true; this.altar.marker.visible = false; }
    this.curseChoices = []; this._state.phase = 'playing'; this.lastTime = performance.now(); this.emit(); return true;
  }

  rewardUpgradeChoice() {
    const candidates = [];
    if (this.pendingRelicSources.length) {
      for (const relic of getRelicChoices(this.stats)) candidates.push({
        ...relic, id: `relic_${relic.id}`, rewardId: relic.id,
        category: 'relic', source: this.pendingRelicSources[0],
      });
    }
    for (const pending of this.pendingBossRewards) {
      if (this.stats.bossRewards?.includes(pending.id)) continue;
      const reward = getBossReward(pending.stage);
      if (!reward || reward.id !== pending.id) continue;
      candidates.push({ ...reward, id: `boss_${reward.id}`, rewardId: reward.id,
        sourceStage: pending.stage, source: `${pending.stage}층 수호자 보상`, category: 'boss' });
    }
    if (!candidates.length) return null;
    const roll = Number(Math.random());
    const index = Math.floor((Number.isFinite(roll) ? clamp(roll, 0, .999999) : 0) * candidates.length);
    return candidates[index];
  }

  spawnChest(x, z) {
    const position = x == null ? this.spawnPosition(14, 22) : { x, z };
    const group = new THREE.Group(); group.position.set(position.x, this.groundHeight(position.x, position.z), position.z);
    this.box(this.mats.dark, 0, 0.42, 0, 1.45, 0.8, 1.05, group);
    this.box(this.mats.gold, 0, 0.86, 0, 1.5, 0.18, 1.1, group);
    this.box(this.mats.gold, 0, 0.43, 0.54, 0.22, 0.44, 0.08, group);
    const marker = new THREE.Mesh(this.geo.aura, this.mats.goldAura); marker.rotation.x = -Math.PI / 2; marker.position.y = 0.08; marker.scale.setScalar(2.2); group.add(marker);
    this.scene.add(group);
    const guards = [];
    for (let i = 0; i < 3; i++) {
      const angle = i * TAU / 3;
      guards.push(this.spawnEnemy(position.x + Math.cos(angle) * 2.3, position.z + Math.sin(angle) * 2.3, i === 0 ? 2 : 0, { guard: true }));
    }
    const chest = { group, guards, marker, opened: false };
    this.chests.push(chest); this.stageChestCount++;
    this.callbacks.onLoot?.('수호병 셋을 처치하고 보물상자를 여세요');
    return chest;
  }

  updateAdventure(dt) {
    const s = this._state, limit = getStageStats(s.stage).maxEnemies;
    const route = getRunModifiers(this.activeCurses, this.routeId);
    if (s.stageTime >= this.nextChestTime && this.stageChestCount < 2 + route.chestBonus && this.enemies.length < limit - 4) {
      this.spawnChest(); this.nextChestTime += route.chestBonus ? 35 : 50;
    }
    if (s.stageTime >= this.nextEliteTime && this.enemies.length < limit) {
      const position = this.spawnPosition(13, 19);
      this.spawnEnemy(position.x, position.z, 2, { elite: true });
      this.nextEliteTime += 45 / route.eliteMultiplier; this.callbacks.onLoot?.('정예 출현 · 강한 적을 잡고 유물 획득');
    }
    if (s.stageTime >= this.nextGoldenTime && this.enemies.length < limit) {
      const position = this.spawnPosition(10, 16);
      this.spawnEnemy(position.x, position.z, 1, { golden: true });
      this.nextGoldenTime += 60; this.callbacks.onLoot?.('황금 도망자 출현 · 16초 안에 처치');
    }
    for (const chest of this.chests) {
      if (chest.opened) continue;
      const ready = chest.guards.every(guard => guard.hp <= 0);
      chest.marker.rotation.z += dt * (ready ? 1 : 0.3);
      const dx = chest.group.position.x - this.player.position.x, dz = chest.group.position.z - this.player.position.z;
      if (ready && dx * dx + dz * dz < 3.5 ** 2) {
        chest.opened = true; chest.group.visible = false;
        const beforeGold = s.gold;
        this.collectPickup({ type: 'gold', value: getStageStats(s.stage).coinValue * 8, mesh: null });
        this.openChestReward('수호 보물상자', { gold: Math.round((s.gold - beforeGold) * 100) / 100 });
        this.burst(chest.group.position, '#ffd577', 12); this.sound('coin');
      }
    }
    // Immediate rewards take priority over level-ups, altars and floor transitions.
    if (s.phase !== 'playing') return;
    if (s.stageTime >= this.nextAltarTime) { this.nextAltarTime = Infinity; this.spawnAltar(); }
    if (this.altar && !this.altar.opened) {
      this.altar.marker.rotation.z += dt * 0.5;
      if (this.altar.group.position.distanceToSquared(this.player.position) < 3.2 ** 2) this.openCurseAltar();
    }
  }

  openLevelUp() {
    if (this._state.phase !== 'playing' || this._state.xp < this._state.xpNeeded) return false;
    const s = this._state;
    s.xp -= s.xpNeeded; s.level++; s.xpNeeded = getXpRequired(s.level);
    this.upgradeChoices = getUpgradeChoices(this.stats);
    const reward = this.rewardUpgradeChoice();
    if (reward) this.upgradeChoices.push(reward);
    if (!this.upgradeChoices.length) return false;
    s.phase = 'upgrade'; this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.sound('upgrade'); this.callbacks.onLevelUp?.(this.upgradeChoices); this.emit(); return true;
  }

  setMuted(value) { this.muted = !!value; if (!this.muted) this.initAudio(); }
  setQuality(value) { this.quality = value; this.renderer.setPixelRatio(value === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.6)); this.renderer.shadowMap.enabled = value !== 'low'; this.resize(); }

  setPlaybackSpeed(value) {
    if (![1, 2, 3].includes(value)) return false;
    this.playbackSpeed = value; this.emit(); return true;
  }

  advanceSimulation(realDt) {
    let remaining = Math.max(0, Math.min(0.05, realDt)) * this.playbackSpeed;
    let advanced = 0;
    while (remaining > 1e-9 && this._state.phase === 'playing') {
      const step = Math.min(1 / 60, remaining);
      this.tick(step); this.animateEffects(step);
      remaining -= step; advanced += step;
    }
    return advanced;
  }

  loop(time) {
    if (this.disposed) return;
    const dt = Math.min(Math.max((time - this.lastTime) / 1000, 0), 0.05); this.lastTime = time; this.frames++;
    if (this._state.phase === 'playing') this.advanceSimulation(dt);
    else { if (this._state.phase === 'menu') this.animateAttract(time / 1000, dt); this.animateEffects(dt); }
    this.updateMood(dt);
    if (this.dust) this.dust.rotation.y += dt * 0.002;
    this.updateCamera(dt);
    this.world?.updateOcclusion(this.player.position, this.camera.position, dt);
    this.renderer.render(this.scene, this.camera);
    if (time - this.lastUpdate > 100) { this.lastUpdate = time; this.emit(); }
    this.raf = requestAnimationFrame(this.loop);
  }

  animateAttract(time, dt) {
    animatePlayerModel(this, time, false, dt);
    for (const e of this.enemies) { e.group.rotation.y = Math.atan2(-e.group.position.x, -e.group.position.z); animateEnemyModel(e, time, dt); }
  }

  tick(dt) {
    if (this._state.phase !== 'playing' || this.openNextChestReward()) return;
    const s = this._state; s.elapsed += dt; s.stageTime = Math.min(STAGE_DURATION, s.stageTime + dt);
    const threat = this.getThreat();
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
    this.world?.resolve(this.player.position, .65);
    this.playerVisual.visible = this.invulnerable > 0.4 ? Math.floor(s.elapsed * 20) % 2 === 0 : true;

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
      this.spawnTimer = getSpawnInterval(s.stage, s.stageTime) / threat.spawnRate;
    }
    this.rebuildSpatialIndex();
    this.attackTimer -= dt;
    if (this.attackTimer <= 0) { this.attack(); this.attackTimer = 1 / Math.max(0.2, this.stats.attackRate * getSwordProfile(this.stats).attackRateMultiplier); }
    this.magic.update(dt);
    this.world?.updateNavigation(this.player.position, s.elapsed);
    this.updateEnemies(dt);
    this.updateEnemyProjectiles(dt);
    this.bossSystem.updateEffects(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    animatePlayerModel(this, s.elapsed, moving, dt);
    if (s.hp <= 0 && this.stats.reviveCharges > 0) {
      this.stats.reviveCharges = Math.max(0, Math.floor(this.stats.reviveCharges) - 1);
      s.hp = this.stats.maxHp * 0.35; this.invulnerable = 1.5; this.playerVisual.visible = true;
      this.burst(this.player.position, '#a7e8ff', 18); this.sound('upgrade');
      this.callbacks.onLoot?.('불굴의 불씨 · 부활! 최대 체력의 35% 회복');
    }
    if (s.hp <= 0) { s.hp = 0; s.phase = 'over'; this.playerVisual.visible = true; this.sound('over'); this.callbacks.onGameOver?.(this.state); this.emit(); return; }
    this.updateAdventure(dt);
    if (s.phase !== 'playing' || this.pendingChestRewards.length) return;
    if (this.openLevelUp()) return;
    if (s.stageTime >= STAGE_DURATION && this.bossDefeated) this.nextStage();
  }

  nextStage() {
    const s = this._state;
    if (s.phase !== 'playing' || this.pendingChestRewards.length || !this.bossDefeated || s.stageTime < STAGE_DURATION) return false;
    // Uncollected healing must not become a free recovery on a floor change.
    for (const p of this.pickups) { if (p.type !== 'heal') this.collectPickup(p, false); else this.removeGroup(p.mesh); }
    this.pickups.length = 0;
    if (s.stage >= MAX_STAGES) { s.phase = 'won'; this.sound('win'); this.callbacks.onWin?.(this.state); this.emit(); return true; }
    // Swept XP must still produce an explicit earned choice before entering a new floor.
    if (this.openLevelUp()) return true;
    this.pendingRouteStage = s.stage + 1;
    this.routeChoices = ROUTES.map(route => ({ ...route }));
    s.phase = 'route'; this.keys.clear(); this.touchMove = { x: 0, y: 0 };
    this.callbacks.onRoute?.(this.routeChoices, { stage: this.pendingRouteStage }); this.emit(); return true;
  }

  chooseRoute(id) {
    const s = this._state;
    if (s.phase !== 'route' || !this.routeChoices.some(route => route.id === id) || this.pendingRouteStage !== s.stage + 1) return false;
    this.routeId = id; s.stage = this.pendingRouteStage; s.stageTime = 0; this.setStageMood(s.stage);
    this.runReport.routeHistory.push({ stage: s.stage, id });
    this.routeChoices = []; this.pendingRouteStage = null;
    this.bossSystem.clear();
    for (const enemy of this.enemies) this.releaseEnemy(enemy);
    this.enemies.length = 0;
    this.projectiles.forEach((p) => this.removeGroup(p.mesh)); this.projectiles.length = 0;
    this.clearEnemyProjectiles(); this.magic.reset(); this.boss = null; this.bossSpawned = false; this.bossDefeated = false;
    for (const chest of this.chests) this.removeGroup(chest.group);
    this.removeGroup(this.altar?.group); this.altar = null;
    this.chests.length = 0; this.stageChestCount = 0;
    this.nextChestTime = 20; this.nextEliteTime = 30 / getRunModifiers(this.activeCurses, this.routeId).eliteMultiplier; this.nextGoldenTime = 40; this.nextAltarTime = 45;
    this.spawnTimer = 0.8; this.invulnerable = 1.5;
    s.phase = 'playing'; this.lastTime = performance.now();
    this.burst(this.player.position, '#beff6e', 25); this.sound('stage'); this.callbacks.onStage?.(s.stage); this.emit(); return true;
  }

  takeDamage(rawDamage, source, cause = '적의 공격') {
    if (this._state.phase !== 'playing' || this.invulnerable > 0 || this._state.hp <= 0) return false;
    const damage = Math.max(1, rawDamage * this.getThreat().enemyDamage * (1 - Math.min(0.6, this.stats.armor)));
    this.runReport.damageTaken += Math.min(this._state.hp, damage);
    this.runReport.deathCause = typeof cause === 'string' ? cause : '적의 공격';
    this._state.hp -= damage; this.invulnerable = 0.75; this.shake = 0.22;
    this.floatText(`-${Math.round(damage)}`, this.player.position, '#ff8974', 1.1, 3);
    this.burst(this.player.position, '#ff996c', 6); this.sound('hurt'); return true;
  }

  createEnemyTelegraph(enemy, shape, extent, color) {
    this.clearTelegraph(enemy);
    const line = shape === 'line';
    const geometry = line ? new THREE.PlaneGeometry(enemy.kind === 8 ? .32 : 1.8, extent, 1, Math.ceil(extent / 1.5)) : new THREE.RingGeometry(.1, extent, 32, 5);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .24, side: THREE.DoubleSide, depthWrite: false });
    const marker = new THREE.Mesh(geometry, material); marker.rotation.x = -Math.PI / 2;
    marker.position.copy(enemy.group.position); marker.position.y += .14;
    if (line) { marker.rotation.z = Math.atan2(enemy.aim.x, enemy.aim.z); marker.position.addScaledVector(enemy.aim, extent * .5); }
    this.scene.add(marker); this.fitGroundMesh(marker, .14); enemy.telegraph = marker;
  }

  removeEnemyWithoutReward(enemy) {
    if (!this.activeEnemies.has(enemy)) return;
    enemy.hp = 0; this.releaseEnemy(enemy);
    const index = this.enemies.indexOf(enemy); if (index >= 0) this.enemies.splice(index, 1);
  }

  updateEnemies(dt) {
    const pos = this.player.position;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i]; if (!e || e.hp <= 0) continue;
      e.burnTime = Math.max(0, (e.burnTime || 0) - dt);
      if (e.kind === 4) { this.updateBoss(e, dt); this.world?.resolve(e.group.position, 1.4); animateEnemyModel(e, this._state.elapsed, dt); continue; }
      const dx = pos.x - e.group.position.x, dz = pos.z - e.group.position.z, distance = Math.hypot(dx, dz);
      if (e.golden) {
        e.escapeTime -= dt;
        if (e.escapeTime <= 0) {
          e.hp = 0; this.releaseEnemy(e); this.enemies.splice(i, 1);
          this.callbacks.onLoot?.('황금 도망자가 달아났습니다'); continue;
        }
      }
      if (distance > 42 && !e.guard && !e.golden) {
        const replacement = this.spawnPosition(20, 27);
        e.group.position.set(replacement.x, this.groundHeight(replacement.x, replacement.z), replacement.z);
        continue;
      }
      const stagger = Math.max(0, e.hitTime); e.hitTime -= dt;
      e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
      const slow = e.slowTime > 0 ? Math.max(0.15, e.slowFactor || 0.5) : 1;
      let movement = e.golden && distance < 18 ? -1 : 1;
      if (e.kind >= 5) {
        e.actionTimer -= dt;
        if (e.telegraph) e.telegraph.material.opacity = .18 + Math.sin(this._state.elapsed * 15) * .06;
      }
      if (e.kind === 5) {
        if (e.action === 'charge-warning') {
          movement = 0;
          if (e.actionTimer <= 0) { this.clearTelegraph(e); e.action = 'rush'; e.actionTimer = .48; }
        } else if (e.action === 'rush') {
          movement = 0; e.group.position.addScaledVector(e.aim, e.speed * 4 * slow * dt);
          e.group.rotation.y = Math.atan2(e.aim.x, e.aim.z);
          if (e.actionTimer <= 0) { e.action = 'chase'; e.actionTimer = 3; }
        } else if (e.actionTimer <= 0 && distance > 2 && distance < 16) {
          e.aim.set(dx, 0, dz).normalize(); e.action = 'charge-warning'; e.actionTimer = .75; movement = 0; e.specialCasts++;
          this.createEnemyTelegraph(e, 'line', 10, '#ffb66b');
        }
      } else if (e.kind === 6) {
        if (e.action === 'detonate-warning') {
          movement = 0;
          if (e.actionTimer <= 0) {
            if (distance < 3.6) this.takeDamage(getStageStats(this._state.stage).enemyDamage * 1.65 * e.baseDamageMultiplier * e.damageMultiplier, e.group.position, `${e.name} 자폭`);
            this.puff(e.group.position, '#c5ef6c', 3.6, .45); this.burst(e.group.position, '#d4f48b', 10);
            this.removeEnemyWithoutReward(e); continue;
          }
        } else if (distance < 3.8 && e.actionTimer <= 0) {
          e.action = 'detonate-warning'; e.actionTimer = 1; movement = 0; e.specialCasts++;
          this.createEnemyTelegraph(e, 'circle', 3.6, '#b8e968');
        }
      } else if (e.kind === 8) {
        movement = distance < 16 ? -.7 : distance > 24 ? 1 : 0;
        e.shootTimer -= dt;
        if (e.action === 'snipe-warning') {
          movement = 0;
          if (e.actionTimer <= 0) {
            this.clearTelegraph(e);
            this.shootEnemyProjectile(e, e.aim, { speed: 17, life: 3, damage: getStageStats(this._state.stage).enemyDamage * 1.15 * e.baseDamageMultiplier });
            e.action = 'chase'; e.shootTimer = 3.8; e.specialCasts++;
          }
        } else if (e.shootTimer <= 0 && distance < 32 && distance > 3) {
          e.aim.set(dx, 0, dz).normalize(); e.action = 'snipe-warning'; e.actionTimer = 1.2;
          this.createEnemyTelegraph(e, 'line', 30, '#b9dfff');
        }
      } else if (e.kind === 9) {
        movement = distance < 13 ? -.6 : distance > 19 ? 1 : .1;
        if (e.action === 'heal-warning') {
          movement *= .2;
          if (e.actionTimer <= 0) {
            this.clearTelegraph(e);
            let healed = 0;
            for (const target of this.queryEnemies(e.group.position, 10)) {
              if (target === e || target.kind === 4 || target.hp >= target.maxHp) continue;
              target.hp = Math.min(target.maxHp, target.hp + target.maxHp * .05);
              this.puff(target.group.position, '#c0ffd0', .7, .3);
              if (++healed >= 5) break;
            }
            this.puff(e.group.position, '#c5e4ff', 1.8, .4); e.action = 'chase'; e.actionTimer = 4; e.specialCasts++;
          }
        } else if (e.actionTimer <= 0 && distance < 30) {
          e.action = 'heal-warning'; e.actionTimer = .8;
          this.createEnemyTelegraph(e, 'circle', 2, '#b7f2d0');
        }
      }
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
      const lockedWarning = e.kind >= 5 && e.action.endsWith('-warning');
      if (lockedWarning) movement = 0;
      if (distance > 0.01) {
        const speed = e.speed * slow * (stagger > 0 ? 0.22 : 1) * movement;
        let moveX = dx, moveZ = dz, moveDistance = distance;
        if (e.guardHome && (distance > 11 || e.group.position.distanceToSquared(e.guardHome) > 49)) {
          moveX = e.guardHome.x - e.group.position.x; moveZ = e.guardHome.z - e.group.position.z;
          moveDistance = Math.hypot(moveX, moveZ);
        }
        if (moveDistance > 0.1) {
          if (this.world && !lockedWarning) { const steer = this.world.steer(e.group.position, moveX, moveZ, Math.min(1.2, e.size * .4), e.seed); moveX = steer.x; moveZ = steer.z; moveDistance = 1; }
          e.group.position.x += moveX / moveDistance * speed * dt + (lockedWarning ? 0 : e.stagger.x * dt);
          e.group.position.z += moveZ / moveDistance * speed * dt + (lockedWarning ? 0 : e.stagger.z * dt);
          e.group.rotation.y = Math.atan2(moveX, moveZ);
        }
      }
      const boundary = Math.hypot(e.group.position.x, e.group.position.z);
      if (boundary > ARENA_RADIUS) e.group.position.multiplyScalar(ARENA_RADIUS / boundary);
      this.world?.resolve(e.group.position, Math.min(1.2, e.size * .4));
      e.stagger.multiplyScalar(Math.max(0, 1 - dt * 9));
      if (distance < 1.2) {
        const rawDamage = getStageStats(this._state.stage).enemyDamage * e.baseDamageMultiplier * e.damageMultiplier * (e.kind === 5 && e.action === 'rush' ? 1.35 : 1);
        if (this.takeDamage(rawDamage, e.group.position, `${e.name} ${e.action === 'rush' ? '돌진' : '접촉'}`)) e.stagger.set(-dx / Math.max(distance, 0.01) * 8, 0, -dz / Math.max(distance, 0.01) * 8);
      }
      if (!lockedWarning && i % 2 === this.frames % 2) for (let j = Math.max(0, i - 6); j < i; j++) {
        const other = this.enemies[j]; if (!other || other.hp <= 0 || other.kind === 4) continue;
        const sx = e.group.position.x - other.group.position.x, sz = e.group.position.z - other.group.position.z, squared = sx * sx + sz * sz;
        if (squared > 0.0001 && squared < 0.9) { const force = dt * 1.8 / Math.sqrt(squared); e.group.position.x += sx * force; e.group.position.z += sz * force; }
      }
      animateEnemyModel(e, this._state.elapsed, dt);
    }
    this.spatialDirty = true;
  }

  updateBoss(boss, dt) {
    if (boss.archetype && boss.archetype !== 'warden') { this.bossSystem.update(boss, dt); return; }
    const dx = this.player.position.x - boss.group.position.x, dz = this.player.position.z - boss.group.position.z, distance = Math.hypot(dx, dz);
    boss.actionTimer -= dt; boss.hitTime = Math.max(0, boss.hitTime - dt); boss.slowTime = Math.max(0, (boss.slowTime || 0) - dt);
    const slow = boss.slowTime > 0 ? Math.max(0.55, boss.slowFactor || 0.5) : 1;
    const enraged = boss.hp / boss.maxHp < 0.5;
    if (boss.mode === 'chase') {
      if (distance > 2.5) { const steer = this.world ? this.world.steer(boss.group.position, dx, dz, 1.4, 0) : { x: dx / distance, z: dz / distance }; boss.group.position.x += steer.x * boss.speed * slow * dt; boss.group.position.z += steer.z * boss.speed * slow * dt; }
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
        if (distance < 7.5) this.takeDamage(getBossStats(this._state.stage).damage * 1.3, boss.group.position, `${boss.name} 충격파`);
        const wave = new THREE.Mesh(new THREE.RingGeometry(6.9, 7.5, 48), new THREE.MeshBasicMaterial({ color: '#ff876c', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
        wave.position.copy(boss.group.position); wave.position.y = 0.2; wave.rotation.x = -Math.PI / 2; this.scene.add(wave); this.effects.push({ mesh: wave, life: 0.5, total: 0.5, type: 'slash' });
        if (this._state.stage >= 3) this.shootEnemyProjectile(boss, new THREE.Vector3(dx, 0, dz).normalize(), { count: enraged ? 9 : 7, spread: 0.27, damage: getBossStats(this._state.stage).damage });
        boss.mode = 'chase'; boss.actionTimer = enraged ? 1.8 : 2.6;
      }
    }
    const radius = Math.hypot(boss.group.position.x, boss.group.position.z);
    if (radius > ARENA_RADIUS - 2) boss.group.position.multiplyScalar((ARENA_RADIUS - 2) / radius);
    if (distance < 2.3) this.takeDamage(getBossStats(this._state.stage).damage * (boss.mode === 'charge' ? 1.5 : 1), boss.group.position, `${boss.name} ${boss.mode === 'charge' ? '돌진' : '접촉'}`);
  }

  shootEnemyProjectile(source, direction, options = {}) {
    const position = source.group?.position || source.position || source;
    const aim = direction?.clone?.() || this.player.position.clone().sub(position);
    aim.y = 0; aim.normalize();
    const count = Math.min(12, options.count || 1);
    for (let i = 0; i < count && this.enemyProjectiles.length < 80; i++) {
      const angle = Math.atan2(aim.x, aim.z) + (i - (count - 1) / 2) * (options.spread || 0);
      const velocity = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).multiplyScalar(options.speed || 9);
      const mesh = new THREE.Mesh(this.geo.enemyBolt, this.mats.enemyBolt); mesh.position.copy(position); mesh.position.y += 0.9; mesh.scale.setScalar(source.kind === 4 ? 1.35 : 1); this.scene.add(mesh);
      this.enemyProjectiles.push({ mesh, velocity, life: options.life || 5, cause: options.cause || `${source.name || '원거리 적'} ${source.kind === 8 ? '저격' : '투사체'}`, damage: (options.damage || getStageStats(this._state.stage).enemyDamage * 0.8) * (source.damageMultiplier || 1) });
    }
  }

  updateEnemyProjectiles(dt) {
    for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
      const p = this.enemyProjectiles[i]; p.life -= dt; p.mesh.position.addScaledVector(p.velocity, dt); p.mesh.position.y = this.groundHeight(p.mesh.position.x, p.mesh.position.z) + .9; p.mesh.rotation.y += dt * 4;
      if (this.world && !this.world.isWalkable(p.mesh.position.x, p.mesh.position.z, .12)) p.life = 0;
      const dx = p.mesh.position.x - this.player.position.x, dz = p.mesh.position.z - this.player.position.z;
      if (p.life > 0 && dx * dx + dz * dz < 1) { this.takeDamage(p.damage, p.mesh.position, p.cause); p.life = 0; }
      if (p.life <= 0 || Math.hypot(p.mesh.position.x, p.mesh.position.z) > ARENA_RADIUS + 10) { this.removeGroup(p.mesh); this.enemyProjectiles.splice(i, 1); }
    }
  }

  clearEnemyProjectiles() { for (const p of this.enemyProjectiles) this.removeGroup(p.mesh); this.enemyProjectiles.length = 0; }

  attack() {
    const profile = getSwordProfile(this.stats);
    const candidates = this.queryEnemies(this.player.position, profile.range);
    candidates.sort((a, b) => a.group.position.distanceToSquared(this.player.position) - b.group.position.distanceToSquared(this.player.position));
    const nearest = candidates[0];
    if (!nearest) return false;
    const delta = nearest.group.position.clone().sub(this.player.position).setY(0);
    if (delta.lengthSq() < 0.0001) delta.set(Math.sin(this.player.rotation.y), 0, Math.cos(this.player.rotation.y));
    delta.normalize(); this.player.rotation.y = Math.atan2(delta.x, delta.z); this.attackAnimTotal = Math.min(.3, .8 / Math.max(1, this.stats.attackRate * profile.attackRateMultiplier)); this.attackAnim = this.attackAnimTotal;
    this.slash(delta, profile);
    let remaining = profile.targets;
    for (const enemy of candidates) {
      if (enemy.hp <= 0 || remaining <= 0) continue;
      const dx = enemy.group.position.x - this.player.position.x, dz = enemy.group.position.z - this.player.position.z;
      if (isSwordHit(profile, dx, dz, delta.x, delta.z)) {
        this.hitEnemy(enemy, this.stats.damage * 1.25 * profile.damageMultiplier, delta, 'sword'); remaining--;
      }
    }
    this.sound('attack'); return true;
  }

  slash(direction, profile = getSwordProfile(this.stats)) {
    if (this.effects.length >= 120) return;
    const effect = this.acquireEffect('slash', profile.color);
    const mesh = effect.mesh;
    const template = this.swordGeometries.get(profile.mode) || this.geo.slash;
    effect.groundGeometries ||= new Map();
    if (!effect.groundGeometries.has(profile.mode)) { const geometry = template.clone(); geometry.parameters = { ...template.parameters }; effect.groundGeometries.set(profile.mode, geometry); this.ownedGeometries.add(geometry); }
    mesh.geometry = effect.groundGeometries.get(profile.mode);
    mesh.geometry.attributes.position.copy(template.attributes.position);
    // Ring theta=0 points along local +X. This transform maps it to the attack
    // direction in world X/Z, with exactly the same radius and arc as collision.
    mesh.rotation.set(-Math.PI / 2, 0, Math.atan2(direction.x, direction.z) - Math.PI / 2);
    mesh.position.copy(this.player.position); mesh.position.y += 0.38;
    mesh.scale.setScalar(profile.range); this.fitGroundMesh(mesh, .38);
    Object.assign(effect, { life: 0.22, total: 0.22, type: 'slash', fixedScale: true }); this.effects.push(effect);
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

  hitEnemy(enemy, damage, direction = UP, source = 'sword', spellId = null, impact = null) {
    if (!enemy || enemy.hp <= 0 || !this.activeEnemies.has(enemy)) return false;
    const comboBonus = source === 'sword' && this._state.combo >= 10 ? this.stats.comboCritBonus || 0 : 0;
    const critical = source !== 'explosion' && Math.random() < Math.min(0.65, this.stats.critChance + comboBonus);
    const lowHealth = this._state.hp <= this.stats.maxHp * 0.35 ? 1 + (this.stats.lowHealthDamageBonus || 0) : 1;
    const eliteBonus = enemy.elite || enemy.kind === 4 ? 1 + Math.max(0, this.stats.eliteDamageBonus || 0) : 1;
    const dealt = Math.max(0, damage) * (critical ? 2 : 1) * lowHealth * eliteBonus;
    this.floatText(`${critical ? '✦ ' : ''}${Math.round(dealt).toLocaleString('en-US')}`, enemy.group.position, critical ? '#eeffad' : '#f1f4dc', critical ? 1.35 : 1, 1.65);
    const bucket = ['fireball', 'frost', 'lightning', 'orbit'].includes(spellId) ? spellId : ['sword', 'combo'].includes(source) ? source : 'other';
    this.runReport.damageBySource[bucket] += Math.min(enemy.hp, dealt);
    enemy.hp -= dealt;
    const hitStun = Number.isFinite(impact?.hitStun) ? clamp(impact.hitStun, 0, 0.16) : 0.16;
    const knockbackScale = Number.isFinite(impact?.knockbackScale) ? clamp(impact.knockbackScale, 0, 1) : 1;
    enemy.hitTime = Math.max(enemy.hitTime || 0, hitStun);
    // Frost controls movement through its timed slow. Its repeated area hits
    // must not restart hit stun or add a push; an earlier sword hit still decays.
    if (knockbackScale > 0) enemy.stagger.copy(direction).setY(0).multiplyScalar((enemy.kind === 4 ? 0.4 : critical ? 12 : 7) * knockbackScale);
    this.puff(enemy.group.position, critical ? '#fff6ba' : '#c3f788', critical ? 0.7 : 0.35, 0.22);
    if (critical) { this.shake = Math.max(this.shake, 0.045); this.sound('critical'); }
    if (enemy.hp > 0) {
      if (source === 'sword') this.magic.onSwordHit(enemy, damage);
      return true;
    }
    const position = enemy.group.position.clone();
    this._state.kills++; this._state.combo++; this.comboTimer = 3;
    this.runReport.peakCombo = Math.max(this.runReport.peakCombo, this._state.combo);
    const bossReward = enemy.kind === 4 ? getBossStats(this._state.stage) : null;
    const rewardMultiplier = enemy.rewardMultiplier || 1;
    const definition = enemy.definition || getEnemyDefinition(enemy.kind);
    this.dropPickup(position, 'xp', (bossReward ? bossReward.xpValue : definition?.xp || 1) * (enemy.elite ? 2 : 1) * (enemy.minion ? .25 : 1) * getXpDropMultiplier(this._state.stage));
    this.dropPickup(position, 'gold', (bossReward ? bossReward.coinValue : getStageStats(this._state.stage).coinValue * (definition?.goldMultiplier || 1)) * rewardMultiplier);
    if (enemy.kind === 4) {
      this.bossDefeated = true; this.clearTelegraph(enemy); this.bossSystem.clear(); this.sound('win');
      this.floatText('BOSS DEFEATED', position, '#ffcf86', 1.8, 5);
      const reward = getBossReward(this._state.stage);
      if (reward && !this.stats.bossRewards.includes(reward.id) && !this.pendingBossRewards.some(pending => pending.id === reward.id)) {
        this.pendingBossRewards.push({ ...reward });
        this.callbacks.onLoot?.(`${reward.title} 선택권 · 다음 레벨업에서 선택하세요`);
      }
      this.callbacks.onBossDefeat?.(this.state.boss);
    }
    if (enemy.elite) {
      this.eliteKills++; this.openRelic('정예 처치 보상');
      this.floatText('ELITE DEFEATED', position, '#d9b0ff', 1.25, 3.4);
    }
    if (enemy.golden) this.floatText('GOLD RUSH!', position, '#ffda6d', 1.7, 3.4);
    if (this._state.combo > 0 && this._state.combo % 10 === 0) {
      this.floatText(`${this._state.combo} COMBO`, this.player.position, '#c6ffa2', 1.45, 4.8); this.sound('combo');
    }
    this._state.hp = Math.min(this.stats.maxHp, this._state.hp + (this.stats.lifeOnKill || 0));
    if (Math.random() < 0.03) this.dropPickup(position, 'heal', this.stats.maxHp * 0.12);
    this.burst(position, enemy.golden ? '#ffcd62' : enemy.elite ? '#d69aff' : enemy.kind === 1 ? '#cb8a53' : '#987392', 4);
    // Remove a dead target from queries before a combo can cause nested explosions,
    // but retain its original position until the sword hook has finished.
    this.activeEnemies.delete(enemy);
    const index = this.enemies.indexOf(enemy); if (index >= 0) this.enemies.splice(index, 1);
    this.spatialDirty = true;
    if (source === 'sword') this.magic.onSwordHit(enemy, damage);
    this.releaseEnemy(enemy);
    if (enemy.kind === 7 && !enemy.minion && !enemy.splitChild) {
      const limit = Math.min(160, getStageStats(this._state.stage).maxEnemies);
      for (const side of [-1, 1]) if (this.enemies.length < limit) this.spawnEnemy(position.x + side * .7, position.z, 1, { minion: true, splitChild: true });
      this.puff(position, '#81e4c5', 1, .3);
    }
    if (source !== 'explosion' && (this.stats.killExplosion || this.stats.poisonExplosion)) {
      const poison = !!this.stats.poisonExplosion, radius = poison ? 3.2 : 2.8;
      this.puff(position, poison ? '#a5d96c' : '#ffac6b', radius * 0.6, 0.4);
      const damage = Math.max(this.stats.damage, this.stats.spellDamage) * (poison ? 0.34 : 0.28);
      for (const target of this.queryEnemies(position, radius).slice(0, 6)) this.hitEnemy(target, damage, direction, 'explosion');
    }
    return true;
  }

  dropPickup(position, type, value) {
    if (this.pickups.length > 240) { const oldest = this.pickups.shift(); this.collectPickup(oldest, false); }
    const mesh = new THREE.Mesh(type === 'gold' ? this.geo.coin : this.geo.xp, type === 'gold' ? this.mats.gold : type === 'heal' ? this.mats.player : this.mats.xp);
    mesh.position.copy(position); mesh.position.x += rnd(-0.6, 0.6); mesh.position.z += rnd(-0.6, 0.6); mesh.position.y = this.groundHeight(mesh.position.x, mesh.position.z) + 0.4;
    if (type === 'heal') mesh.scale.setScalar(1.7);
    this.scene.add(mesh); this.pickups.push({ mesh, type, value, goldFactor: type === 'gold' ? this.stats.goldMultiplier * this.getThreat().goldMultiplier : null, age: 0, seed: Math.random() * TAU, collecting: false });
  }
  updatePickups(dt) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i]; p.age += dt; p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = this.groundHeight(p.mesh.position.x, p.mesh.position.z) + 0.35 + Math.sin(p.age * 4 + p.seed) * 0.09;
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
      const factor = p.goldFactor ?? (this.stats.goldMultiplier * this.getThreat().goldMultiplier);
      const earned = Math.round(p.value * factor * 100) / 100;
      this._state.gold = Math.round((this._state.gold + earned) * 100) / 100;
      if (audio) {
        this.pendingGoldText = Math.round((this.pendingGoldText + earned) * 100) / 100;
        if (this._state.elapsed - this.lastGoldText > 0.18) {
          this.floatText(`+${this.pendingGoldText.toLocaleString('en-US')} G`, this.player.position, '#ffd67c', 1.15, 3.7);
          this.pendingGoldText = 0; this.lastGoldText = this._state.elapsed;
        }
      }
    }
    else if (p.type === 'xp') this._state.xp += p.value * (this.stats.xpMultiplier || 1);
    else this._state.hp = Math.min(this.stats.maxHp, this._state.hp + p.value);
    if (audio && p.type === 'gold' && this.frames % 4 === 0) this.sound('coin');
    this.removeGroup(p.mesh);
  }

  /** Camera-facing text keeps crits and the expanding currency easy to feel. */
  floatText(text, position, color, size = 1, height = 1.65) {
    if (this.floatingTexts.length >= 35) this.removeFloatingText(0);
    let entry = this.textPool.pop();
    if (!entry) {
      const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
      const context = canvas.getContext('2d'); if (!context) return;
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.minFilter = THREE.LinearFilter; texture.generateMipmaps = false;
      const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
      entry = { sprite: new THREE.Sprite(material), texture, canvas, context };
    }
    const { context, sprite, texture } = entry;
    context.clearRect(0, 0, 384, 128);
    context.font = '800 64px Arial, sans-serif';
    const fontSize = Math.min(64, Math.max(22, Math.floor(350 / Math.max(1, context.measureText(text).width) * 64)));
    context.font = `800 ${fontSize}px Arial, sans-serif`; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.lineJoin = 'round'; context.strokeStyle = 'rgba(12,20,15,.95)'; context.lineWidth = 9;
    context.strokeText(text, 192, 66); context.fillStyle = color; context.fillText(text, 192, 66);
    texture.needsUpdate = true; sprite.material.opacity = 1;
    sprite.position.copy(position); sprite.position.y += height;
    sprite.position.x += rnd(-0.3, 0.3); sprite.scale.set(4 * size, 1.333 * size, 1); sprite.renderOrder = 5;
    this.scene.add(sprite);
    Object.assign(entry, { life: 0.9, total: 0.9, drift: rnd(-0.3, 0.3), size });
    this.floatingTexts.push(entry);
  }
  removeFloatingText(index) {
    const entry = this.floatingTexts[index]; if (!entry) return;
    this.removeGroup(entry.sprite); this.floatingTexts.splice(index, 1);
    if (this.textPool.length < 35) this.textPool.push(entry);
    else { entry.texture.dispose(); entry.sprite.material.dispose(); }
  }

  setStageMood(stage, immediate = false) {
    const palette = getStageDefinition(stage).palette;
    this.moodTarget = palette.map((hex) => new THREE.Color(hex));
    if (immediate) this.updateMood(100);
  }
  updateMood(dt) {
    if (!this.moodTarget || !this.hemi) return;
    const amount = 1 - Math.exp(-dt * 1.2), [ground, fog, sky, accent] = this.moodTarget;
    this.mats.ground.color.lerp(ground, amount); this.scene.fog.color.lerp(fog, amount); this.scene.background.lerp(fog, amount);
    this.hemi.color.lerp(sky, amount); this.mats.crystal.emissive.lerp(accent, amount); this.mats.crystal.color.lerp(accent, amount);
    this.floorGrid?.material.color.lerp(accent, amount);
    if (this.world) { this.world.tint.copy(ground).lerp(this.world.white, .68); this.world.ground.material.color.lerp(this.world.tint, amount); }
  }

  acquireEffect(type, color) {
    const index = this.effectPool.findIndex(effect => effect.type === type);
    let effect = index < 0 ? null : this.effectPool.splice(index, 1)[0];
    if (!effect) {
      const geometry = type === 'slash' ? this.geo.slash : type === 'particle' ? this.geo.smallSphere : this.geo.sphere;
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, wireframe: type === 'puff', side: type === 'slash' ? THREE.DoubleSide : THREE.FrontSide, depthWrite: false });
      effect = { mesh: new THREE.Mesh(geometry, material), type, pooled: true, velocity: new THREE.Vector3() };
    }
    effect.mesh.material.color.set(color); effect.mesh.material.opacity = type === 'puff' ? 0.7 : 0.85;
    effect.mesh.position.set(0, 0, 0); effect.mesh.scale.setScalar(1); effect.mesh.rotation.set(0, 0, 0);
    this.scene.add(effect.mesh);
    return effect;
  }

  releaseEffect(effect) {
    this.removeGroup(effect.mesh);
    if (effect.pooled && this.effectPool.length < 150) this.effectPool.push(effect);
    else {
      effect.mesh.material.dispose();
      if (effect.groundGeometries) for (const geometry of effect.groundGeometries.values()) { geometry.dispose(); this.ownedGeometries.delete(geometry); }
      if (!effect.pooled && effect.type === 'slash') effect.mesh.geometry.dispose();
    }
  }

  puff(position, color, size, life) {
    if (this.effects.length >= 120) return;
    const effect = this.acquireEffect('puff', color), mesh = effect.mesh;
    mesh.position.copy(position); mesh.position.y += 0.7; mesh.scale.setScalar(size);
    Object.assign(effect, { life, total: life }); this.effects.push(effect);
  }
  burst(position, color, count) {
    for (let i = 0; i < count && this.effects.length < 120; i++) {
      const effect = this.acquireEffect('particle', color), mesh = effect.mesh;
      mesh.position.copy(position); mesh.position.y += 0.5;
      Object.assign(effect, { life: rnd(0.3, 0.6), total: 0.6 });
      effect.velocity.set(rnd(-4, 4), rnd(2, 6), rnd(-4, 4)); this.effects.push(effect);
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
      else if (!e.fixedScale) e.mesh.scale.multiplyScalar(1 + dt * (e.type === 'slash' ? 2 : 4));
      if (e.life <= 0) { this.releaseEffect(e); this.effects.splice(i, 1); }
    }
    this.shake = Math.max(0, this.shake - dt);
  }

  updateCamera(dt) {
    const target = this._cameraPosition || (this._cameraPosition = new THREE.Vector3());
    target.copy(this.player.position); target.y += 0.5;
    // A broad arena view makes the crowd readable while retaining true perspective.
    const menuOffset = this._state.phase === 'menu' ? 3.5 : 0;
    const cameraTarget = this._cameraTarget || (this._cameraTarget = new THREE.Vector3());
    cameraTarget.set(target.x + 20 - menuOffset, target.y + 25.5, target.z + 25 + menuOffset);
    this.camera.position.lerp(cameraTarget, 1 - Math.exp(-dt * 4));
    if (this.shake > 0) { this.camera.position.x += rnd(-1, 1) * this.shake * 1.4; this.camera.position.z += rnd(-1, 1) * this.shake; }
    const lookTarget = this._lookTarget || (this._lookTarget = new THREE.Vector3());
    lookTarget.set(target.x - menuOffset, target.y, target.z + menuOffset);
    this.camera.lookAt(lookTarget);
    if (this.sunlight) { this.sunlight.position.set(target.x - 15, target.y + 34.5, target.z + 12); this.sunlight.target.position.set(target.x, target.y - .5, target.z); this.sunlight.target.updateMatrixWorld(); }
  }
  lerpAngle(a, b, t) { let difference = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI; return a + difference * Math.min(1, t); }
  resize() {
    const width = Math.max(1, this.container.clientWidth), height = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(width, height); this.camera.aspect = width / height;
    this.camera.fov = width / height < 0.9 ? 56 : 43; this.camera.updateProjectionMatrix();
  }
  removeGroup(group) { if (!group) return; group.parent?.remove(group); }
  clearDynamic() {
    this.enemyRenderer?.reset();
    this.bossSystem?.clear();
    while (this.floatingTexts.length) this.removeFloatingText(0);
    for (const e of this.enemies) this.releaseEnemy(e);
    this.clearEnemyProjectiles(); this.magic?.reset(); this.boss = null; this.bossSpawned = false; this.bossDefeated = false;
    for (const p of this.projectiles) { this.removeGroup(p.mesh); p.mesh.geometry.dispose(); }
    for (const p of this.pickups) this.removeGroup(p.mesh);
    for (const e of this.effects) this.releaseEffect(e);
    for (const chest of this.chests) this.removeGroup(chest.group);
    this.removeGroup(this.altar?.group); this.altar = null;
    this.chests.length = 0; this.spatialBuckets.clear(); this.spatialDirty = true;
    this.enemies.length = 0; this.activeEnemies.clear(); this.projectiles.length = 0; this.pickups.length = 0; this.effects.length = 0;
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
    if (type === 'critical' && now - (this.lastCriticalSound || 0) < 0.12) return;
    if (type === 'critical') this.lastCriticalSound = now;
    if (type === 'attack') this.lastAttackSound = now;
    const frequencies = { attack: 190, hurt: 100, coin: 960, dash: 240, upgrade: 660, start: 440, stage: 580, win: 880, over: 110, critical: 1380, combo: 1120 };
    const osc = this.audio.createOscillator(), gain = this.audio.createGain();
    const duration = ['start', 'stage', 'win', 'upgrade'].includes(type) ? 0.25 : 0.08;
    osc.type = type === 'hurt' || type === 'over' ? 'sawtooth' : 'sine';
    osc.frequency.setValueAtTime(frequencies[type] || 400, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, (frequencies[type] || 400) * (type === 'attack' ? 0.3 : type === 'over' ? 0.4 : 1.5)), now + duration);
    gain.gain.setValueAtTime(type === 'attack' ? 0.025 : 0.045, now); gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain); gain.connect(this.audio.destination); osc.start(now); osc.stop(now + duration);
  }

  getDebugState() { return { ...this.state, enemyRender: this.enemyRenderer?.getDebugState(), permanentBonuses: { ...this.permanentBonuses }, player: this.player.position.toArray(), enemies: this.enemies.length, pickups: this.pickups.length, floatingTexts: this.floatingTexts.length, effects: this.effects.length, pools: { enemies: [...this.enemyPools.values()].reduce((sum, pool) => sum + pool.length, 0), effects: this.effectPool.length, texts: this.textPool.length }, resources: { geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures }, projectiles: this.projectiles.length, enemyProjectiles: this.enemyProjectiles.length, rangedEnemies: this.enemies.filter(e => e.kind === 3 || e.kind === 8).length, bossSystem: this.bossSystem?.getDebugState(), magic: this.magic?.getDebugState?.(), frames: this.frames, drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, renderer: this.renderer.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL', canvas: { width: this.renderer.domElement.width, height: this.renderer.domElement.height } }; }
  /** Deterministic-time simulation hook for smoke tests; respects pause and choices. */
  stepForTest(seconds) { for (let t = 0; t < seconds && this._state.phase === 'playing'; t += 1 / 60) { this.frames++; this.tick(1 / 60); this.animateEffects(1 / 60); } this.emit(); return this.getDebugState(); }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.raf); this.observer.disconnect();
    window.removeEventListener('keydown', this.onKeyDown); window.removeEventListener('keyup', this.onKeyUp); window.removeEventListener('blur', this.onBlur); document.removeEventListener('visibilitychange', this.onVisibility);
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointerDown); this.renderer.domElement.removeEventListener('pointermove', this.onPointerMove); this.renderer.domElement.removeEventListener('pointerup', this.onPointerUp); this.renderer.domElement.removeEventListener('pointercancel', this.onPointerUp);
    this.clearDynamic(); this.enemyRenderer?.dispose(); this.presentation?.dispose(); this.magic?.dispose(); this.bossSystem?.dispose();
    const geometries = new Set(), materials = new Set();
    this.scene.traverse((object) => { if (object.geometry) geometries.add(object.geometry); if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((m) => materials.add(m)); });
    this.ownedGeometries.forEach(geometry => geometries.add(geometry));
    this.effectPool.forEach(effect => materials.add(effect.mesh.material));
    this.textPool.forEach(entry => { entry.texture.dispose(); materials.add(entry.sprite.material); });
    Object.values(this.geo).forEach((geometry) => geometries.add(geometry)); Object.values(this.mats).forEach((material) => materials.add(material));
    geometries.forEach((geometry) => geometry.dispose()); materials.forEach((material) => material.dispose());
    this.renderer.dispose(); this.renderer.domElement.remove(); this.audio?.close().catch(() => {});
  }
}
