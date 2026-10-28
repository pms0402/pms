import * as THREE from 'three';
import { getStageStats } from './balance.js';
import { getRegion } from './regions.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const stageNumber = stage => clamp(Math.floor(Number(stage) || 1), 1, 10);
const sample = random => clamp(Number(typeof random === 'function' ? random() : 0) || 0, 0, .999999999);

/** Shared by combat and the codex. Mutation rewards multiply the existing enemy rewards once. */
export const MUTATIONS = Object.freeze([
  { id: 'vampire', title: '흡혈형', icon: 'heart', color: '#ed6387', description: '플레이어에게 실제로 준 피해의 45%를 회복합니다. 한 번에 자신의 최대 체력 8%까지.', counterplay: '공격을 회피하면 회복하지 못합니다.' },
  { id: 'explosive', title: '폭발형', icon: 'fire', color: '#ff9a59', description: '처치 후 1초 예고 뒤 반경 2.8m에 폭발합니다. 폭발은 다른 적을 폭발시키지 않습니다.', counterplay: '처치 후 주황색 원에서 벗어나세요.' },
  { id: 'steel', title: '강철형', icon: 'shield', color: '#c4d5e2', description: '받는 피해 30% 감소 · 이동 속도 25% 감소. 검과 마법 모두 방어합니다.', counterplay: '느린 이동을 이용해 거리를 유지하세요.' },
  { id: 'berserker', title: '광전사형', icon: 'sword', color: '#f57360', description: '체력 35% 이하에서 이동 속도 ×1.3 · 근접 재공격 1.15초 → 0.79초 · 원거리·특수 공격 준비 속도 ×1.45. 위험 예고 시간은 유지됩니다.', counterplay: '체력이 낮아져 붉은 표식이 커지면 빠르게 마무리하세요.' },
  { id: 'splitter', title: '분열형', icon: 'orbit', color: '#98e981', description: '처치 시 약한 분열체 2마리가 나옵니다. 분열체는 변이·재분열하지 않으며 기존 분열 적과 중복되지 않습니다.', counterplay: '분열체는 범위 공격으로 함께 처치하세요.' },
  { id: 'swift', title: '신속형', icon: 'move', color: '#74e7ed', description: '이동과 돌진 속도 ×1.3. 돌진 예고 시간은 유지됩니다.', counterplay: '접근 경로를 옆으로 피하고 대시를 남겨 두세요.' },
].map(Object.freeze));

export const MUTATION_ELITE = Object.freeze({ id: 'elite', title: '정예 변이형', icon: 'skull', color: '#d4a6ff', description: '서로 다른 변이 2개 · 최대 체력 ×1.35 · 골드 ×2.25 · 경험치 ×1.9. 일반 단일 변이는 최대 체력 ×1.1 · 골드 ×1.45 · 경험치 ×1.3.', counterplay: '두 표식의 능력을 함께 확인하세요. 변이는 보스와 소환된 하위 개체에게 적용되지 않습니다.' });

const byId = new Map(MUTATIONS.map(item => [item.id, item]));
const regionalWeights = Object.freeze({
  volcano: { explosive: 3, berserker: 1.5 },
  tundra: { steel: 2, swift: 1.5 },
  forest: { splitter: 3, vampire: 2 },
  ruins: { steel: 2, swift: 1.5 },
  void: { swift: 2, berserker: 2 },
  throne: { swift: 1.5, berserker: 1.5 },
});

export function getMutationChance(stage = 1, regionId = 'sanctum') {
  return Math.min(.36, .03 + (stageNumber(stage) - 1) * .024 + (regionId === 'void' ? .1 : 0));
}

export function rollMutations(stage = 1, regionId = 'sanctum', random = Math.random) {
  const floor = stageNumber(stage);
  if (sample(random) >= getMutationChance(floor, regionId)) return [];
  const pool = [...MUTATIONS];
  const pick = () => {
    const bias = getRegion(regionId).mutationBias;
    const weights = pool.map(item => regionalWeights[regionId]?.[item.id] || (bias.includes(item.id) ? 2 : 1));
    let value = sample(random) * weights.reduce((sum, weight) => sum + weight, 0);
    let index = 0;
    for (; index < pool.length - 1; index++) { value -= weights[index]; if (value < 0) break; }
    return pool.splice(index, 1)[0].id;
  };
  const result = [pick()];
  const dualChance = floor < 4 && regionId !== 'void' ? 0 : Math.min(.35, .06 + Math.max(0, floor - 4) * .012 + (regionId === 'void' ? .2 : 0));
  if (sample(random) < dualChance) result.push(pick());
  return result;
}

function makeRuneGeometry(id) {
  // Distinct silhouettes remain readable when colors are hard to distinguish.
  const points = { vampire: 3, explosive: 8, steel: 6, berserker: 4, splitter: 5, swift: 3 }[id];
  const geometry = new THREE.RingGeometry(id === 'swift' ? .55 : .7, 1, points, 1,
    id === 'swift' ? Math.PI / 6 : Math.PI / 2, id === 'swift' ? Math.PI * 1.65 : Math.PI * 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** Bounded combat additions; original model materials/geometry never change. */
export class MutationSystem {
  constructor(game, capacity = 160) {
    this.game = game;
    this.capacity = clamp(Math.floor(capacity) || 160, 1, 160);
    this.explosions = [];
    this.maxExplosions = 12;
    this.time = 0;
    this.disposed = false;
    this.counts = { applied: 0, dual: 0, vampireHealed: 0, explosions: 0, children: 0 };
    this.position = new THREE.Vector3(); this.scale = new THREE.Vector3();
    this.rotation = new THREE.Quaternion(); this.matrix = new THREE.Matrix4();
    this.markers = new Map();
    for (const mutation of MUTATIONS) {
      const geometry = makeRuneGeometry(mutation.id);
      const material = new THREE.MeshBasicMaterial({ color: mutation.color, transparent: true, opacity: .78, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      mesh.name = `Mutation rune ${mutation.id}`; mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); game.scene.add(mesh);
      this.markers.set(mutation.id, { mesh, count: 0 });
    }
    const geometry = new THREE.BufferGeometry();
    this.warningVertices = 32 * 4 * 6;
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxExplosions * this.warningVertices * 3), 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setDrawRange(0, 0);
    const material = new THREE.MeshBasicMaterial({ color: '#ff8049', transparent: true, opacity: .28, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    this.warningMesh = new THREE.Mesh(geometry, material);
    this.warningMesh.name = 'Mutation death blast warnings'; this.warningMesh.count = 0; this.warningMesh.visible = false; this.warningMesh.frustumCulled = false;
    game.scene.add(this.warningMesh); this.warningDirty = true;
  }

  apply(enemy, options = {}) {
    if (this.disposed || !enemy || enemy._mutationsApplied) return [];
    enemy._mutationsApplied = true;
    enemy.mutations = []; enemy.mutationElite = false; enemy.mutationAttackRate = 1; enemy.mutationXpMultiplier = 1;
    if (this.game._state.phase !== 'playing' || enemy.kind === 4 || enemy.minion || enemy.splitChild || options.noMutations) return [];
    const ids = Array.isArray(options.mutations)
      ? [...new Set(options.mutations.filter(id => byId.has(id)))].slice(0, 2)
      : rollMutations(this.game._state.stage, this.game.regionId, options.random || Math.random);
    enemy.mutations = ids;
    if (!ids.length) return [];
    enemy.mutationElite = ids.length === 2;
    const health = enemy.mutationElite ? 1.35 : 1.1;
    enemy.hp *= health; enemy.maxHp *= health;
    enemy.rewardMultiplier *= enemy.mutationElite ? 2.25 : 1.45;
    enemy.mutationXpMultiplier = enemy.mutationElite ? 1.9 : 1.3;
    enemy.mutationBaseSpeed = enemy.speed * (ids.includes('steel') ? .75 : 1) * (ids.includes('swift') ? 1.3 : 1);
    enemy.speed = enemy.mutationBaseSpeed;
    enemy.mutationDeathHandled = false;
    this.counts.applied++; if (enemy.mutationElite) this.counts.dual++;
    return ids;
  }

  mitigateDamage(enemy, damage) {
    if (!Number.isFinite(damage)) return 0;
    return Math.max(0, damage) * (enemy?.mutations?.includes('steel') ? .7 : 1);
  }

  onPlayerHit(enemy, actualDamage) {
    if (this.disposed || !enemy || enemy.hp <= 0 || !enemy.mutations?.includes('vampire') || !Number.isFinite(actualDamage) || actualDamage <= 0) return 0;
    const healed = Math.max(0, Math.min(enemy.maxHp - enemy.hp, actualDamage * .45, enemy.maxHp * .08));
    enemy.hp += healed; this.counts.vampireHealed += healed;
    return healed;
  }

  updateEnemy(enemy, dt = 0) {
    if (!enemy?.mutations?.length) return;
    if (Number.isFinite(dt) && dt > 0) enemy.mutationContactCooldown = Math.max(0, (enemy.mutationContactCooldown || 0) - dt);
    const enraged = enemy.mutations.includes('berserker') && enemy.hp > 0 && enemy.hp <= enemy.maxHp * .35;
    enemy.mutationEnraged = enraged;
    enemy.speed = enemy.mutationBaseSpeed * (enraged ? 1.3 : 1);
    enemy.mutationAttackRate = enraged ? 1.45 : 1;
  }

  onDeath(enemy) {
    if (this.disposed || !enemy?.mutations?.length || enemy.mutationDeathHandled || enemy.kind === 4 || enemy.minion || enemy.splitChild) return;
    enemy.mutationDeathHandled = true;
    if (enemy.mutations.includes('explosive') && this.explosions.length < this.maxExplosions) {
      const position = enemy.group.position.clone(); position.y = (this.game.groundHeight?.(position.x, position.z) ?? position.y) + .17;
      this.warningDirty = true;
      this.explosions.push({ position, remaining: 1, radius: 2.8, damage: getStageStats(this.game._state.stage).enemyDamage * .95 * (enemy.baseDamageMultiplier || 1) });
    }
    // Natural splitters retain their existing two-child death hook, without doubling it.
    if (enemy.mutations.includes('splitter') && enemy.kind !== 7) {
      const limit = Math.min(this.capacity, getStageStats(this.game._state.stage).maxEnemies);
      for (const side of [-1, 1]) {
        if (this.game.enemies.length >= limit) break;
        const position = enemy.group.position.clone(); position.x += side * .7;
        this.game.world?.resolve(position, .25);
        const child = this.game.spawnEnemy(position.x, position.z, 1, { minion: true, splitChild: true, noMutations: true });
        if (child) this.counts.children++;
      }
    }
  }

  update(dt) {
    if (this.disposed || this.game._state.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.time += dt;
    for (let index = this.explosions.length - 1; index >= 0; index--) {
      const blast = this.explosions[index]; blast.remaining -= dt;
      if (blast.remaining > 0) continue;
      this.explosions.splice(index, 1); this.warningDirty = true;
      const player = this.game.player.position;
      if (Math.hypot(player.x - blast.position.x, player.z - blast.position.z) < blast.radius) {
        this.game.takeDamage(blast.damage, blast.position, '폭발형 변이의 사후 폭발');
      }
      this.game.puff?.(blast.position, '#ff985e', blast.radius, .3);
      this.counts.explosions++;
    }
    this.sync();
  }

  sync() {
    if (this.disposed) return;
    for (const marker of this.markers.values()) marker.count = 0;
    let enemies = 0;
    for (const enemy of this.game.enemies) {
      if (enemy.hp <= 0 || !enemy.group.visible || !enemy.mutations?.length) continue;
      if (enemies++ >= this.capacity) break;
      for (let index = 0; index < enemy.mutations.length; index++) {
        const id = enemy.mutations[index], marker = this.markers.get(id);
        if (!marker || marker.count >= this.capacity) continue;
        this.position.copy(enemy.group.position); this.position.y += .11 + index * .015;
        const size = Math.max(.65, enemy.size || 1) * (index === 0 ? .95 : 1.3) * (id === 'berserker' && enemy.mutationEnraged ? 1.15 : 1);
        this.scale.set(size, 1, size);
        this.rotation.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, id === 'swift' ? enemy.group.rotation.y : this.time * (index ? -.18 : .18));
        this.matrix.compose(this.position, this.rotation, this.scale); marker.mesh.setMatrixAt(marker.count++, this.matrix);
      }
    }
    for (const marker of this.markers.values()) this.upload(marker.mesh, marker.count);
    if (this.warningDirty) {
      const attribute = this.warningMesh.geometry.attributes.position;
      let vertex = 0;
      for (const blast of this.explosions) {
        const put = (angle, radius) => {
          const x = blast.position.x + Math.cos(angle) * radius;
          const z = blast.position.z + Math.sin(angle) * radius;
          const y = (this.game.groundHeight?.(x, z) ?? blast.position.y - .17) + .17;
          attribute.setXYZ(vertex++, x, y, z);
        };
        for (let band = 0; band < 4; band++) for (let segment = 0; segment < 32; segment++) {
          const a = segment / 32 * Math.PI * 2, b = (segment + 1) / 32 * Math.PI * 2;
          const inner = blast.radius * (.07 + .93 * band / 4), outer = blast.radius * (.07 + .93 * (band + 1) / 4);
          put(a, inner); put(a, outer); put(b, outer);
          put(a, inner); put(b, outer); put(b, inner);
        }
      }
      attribute.needsUpdate = true; this.warningMesh.geometry.setDrawRange(0, vertex);
      this.warningDirty = false;
    }
    this.warningMesh.material.opacity = .25 + Math.sin(this.time * 13) * .06;
    this.warningMesh.count = this.explosions.length; this.warningMesh.visible = this.explosions.length > 0;
  }

  upload(mesh, count) {
    mesh.count = count; mesh.visible = count > 0;
    if (count) { mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16); mesh.instanceMatrix.needsUpdate = true; }
  }

  reset() {
    this.explosions.length = 0; this.time = 0;
    this.counts = { applied: 0, dual: 0, vampireHealed: 0, explosions: 0, children: 0 };
    for (const marker of this.markers.values()) this.upload(marker.mesh, 0);
    this.warningMesh.count = 0; this.warningMesh.visible = false; this.warningDirty = true; this.warningMesh.geometry.setDrawRange(0, 0);
  }

  getDebugState() {
    return { ...this.counts, active: this.game.enemies.filter(enemy => enemy.hp > 0 && enemy.mutations?.length).length, markers: [...this.markers.values()].reduce((sum, marker) => sum + marker.mesh.count, 0), warningCount: this.explosions.length, maxWarnings: this.maxExplosions, capacity: this.capacity };
  }

  dispose() {
    if (this.disposed) return;
    this.reset(); this.disposed = true;
    for (const mesh of [...this.markers.values()].map(marker => marker.mesh).concat(this.warningMesh)) {
      mesh.removeFromParent(); mesh.dispose?.(); mesh.geometry.dispose(); mesh.material.dispose();
    }
    this.markers.clear();
  }
}
