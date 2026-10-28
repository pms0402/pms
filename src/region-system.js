import * as THREE from 'three';
import { getStageStats } from './balance.js';
import { getRegion } from './regions.js';

const MAX_HAZARDS = 4, MAX_MARKERS = 160, TAU = Math.PI * 2;
const tint = (material, color) => material?.color?.set(color);

/** Fixed render batches and warned hazards; no regional action changes saved player stats. */
export class RegionSystem {
  constructor(game) {
    this.game = game; this.scene = game.scene; this.region = getRegion(); this.time = 0;
    this.hazards = []; this.slowRemaining = 0; this.poisonRemaining = 0; this.poisonTick = 0;
    this.hazardTimer = 10; this.blinkTimer = 8; this.disposed = false;
    this.hazardsTriggered = 0; this.blinks = 0; this.damageEvents = 0;
    this.dummy = new THREE.Object3D(); this.color = new THREE.Color();
    this.geometry = { ring: new THREE.RingGeometry(.87, 1, 36), disc: new THREE.CircleGeometry(1, 36), shard: new THREE.ConeGeometry(.28, 1.5, 7), crack: new THREE.PlaneGeometry(1, .12) };
    this.geometry.ring.rotateX(-Math.PI / 2); this.geometry.disc.rotateX(-Math.PI / 2); this.geometry.crack.rotateX(-Math.PI / 2);
    this.material = {
      warning: new THREE.MeshBasicMaterial({ vertexColors: false, transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide }),
      area: new THREE.MeshBasicMaterial({ transparent: true, opacity: .18, depthWrite: false, side: THREE.DoubleSide }),
      marker: new THREE.MeshBasicMaterial({ transparent: true, opacity: .65, depthWrite: false, side: THREE.DoubleSide }),
      accent: new THREE.MeshStandardMaterial({ color: '#a8dcff', emissive: '#6093b5', emissiveIntensity: .4, roughness: .35, metalness: .2 }),
      crack: new THREE.MeshBasicMaterial({ color: '#ff8855', transparent: true, opacity: .7, depthWrite: false, side: THREE.DoubleSide }),
    };
    const batch = (geometry, material, capacity) => {
      const mesh = new THREE.InstancedMesh(geometry, material, capacity);
      mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.userData.noStaticBatch = true; this.scene.add(mesh); return mesh;
    };
    // Hazard vertices sample the same terrain height as actors, including hills.
    // Four fixed slots share one ring draw and one fill draw; no spawn allocations.
    const groundBatch = (filled, material) => {
      const vertices = filled ? 37 : 72, indices = [];
      for (let slot = 0; slot < MAX_HAZARDS; slot++) for (let i = 0; i < 36; i++) {
        const base = slot * vertices, next = (i + 1) % 36;
        if (filled) indices.push(base, base + 1 + i, base + 1 + next);
        else indices.push(base + i * 2, base + next * 2, base + i * 2 + 1, base + next * 2, base + next * 2 + 1, base + i * 2 + 1);
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices * MAX_HAZARDS * 3), 3).setUsage(THREE.DynamicDrawUsage)); geometry.setIndex(indices); geometry.setDrawRange(0, 0);
      this.geometry[filled ? 'hazardFill' : 'hazardRing'] = geometry;
      const mesh = new THREE.Mesh(geometry, material); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.userData.noStaticBatch = true; this.scene.add(mesh); return mesh;
    };
    this.warningMesh = groundBatch(false, this.material.warning);
    this.areaMesh = groundBatch(true, this.material.area);
    this.markerMesh = batch(this.geometry.ring, this.material.marker, MAX_MARKERS);
    this.accentMesh = batch(this.geometry.shard, this.material.accent, 48);
    const points = new Float32Array(64 * 3), seeds = new Float32Array(64 * 3);
    // Cosmetics use a local deterministic sequence, leaving reward/spawn rolls untouched.
    let seed = 19177;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < seeds.length; i++) seeds[i] = random();
    this.ambientSeeds = seeds;
    this.ambientGeometry = new THREE.BufferGeometry(); this.ambientGeometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
    this.ambientMaterial = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { color: { value: new THREE.Color('#ffb16e') }, size: { value: 3 } }, vertexShader: 'uniform float size;void main(){vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*35.0/max(5.0,-p.z),1.0,5.0);}', fragmentShader: 'uniform vec3 color;void main(){float r=length(gl_PointCoord-.5)*2.0;float a=pow(max(0.0,1.0-r),2.0)*.65;gl_FragColor=vec4(color,a);}' });
    this.ambient = new THREE.Points(this.ambientGeometry, this.ambientMaterial); this.ambient.visible = false; this.ambient.frustumCulled = false; this.scene.add(this.ambient);
    this.surfaceUniforms = { color: { value: new THREE.Color('#ffffff') }, blend: { value: 0 } };
    const material = game.world?.ground?.material;
    if (material) {
      const compile = material.onBeforeCompile, key = material.customProgramCacheKey.bind(material);
      material.onBeforeCompile = (shader, renderer) => {
        compile.call(material, shader, renderer);
        shader.uniforms.uRegionColor = this.surfaceUniforms.color; shader.uniforms.uRegionBlend = this.surfaceUniforms.blend;
        shader.fragmentShader = 'uniform vec3 uRegionColor;uniform float uRegionBlend;\n' + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nfloat regionLuma=dot(diffuseColor.rgb,vec3(.299,.587,.114));diffuseColor.rgb=mix(diffuseColor.rgb,uRegionColor*(.48+regionLuma*.8),uRegionBlend);');
      };
      material.customProgramCacheKey = () => `${key()}:regions-v1`; material.needsUpdate = true;
    }
  }

  setRegion(id) {
    this.reset(); this.region = getRegion(id);
    this.game.moodTarget = this.region.palette.map(color => new THREE.Color(color));
    this.game.updateMood?.(100);
    const colors = { volcano: ['#503e33', '#966f6c'], tundra: ['#c0d7d9', '#cfedf6'], forest: ['#60714a', '#95b875'], ruins: ['#706342', '#bcab97'], void: ['#66506f', '#a78ec4'], throne: ['#665064', '#ba96c1'], sanctum: ['#58624e', '#b0c2cc'] };
    tint(this.game.mats?.ruinGrass, colors[this.region.id][0]); tint(this.game.mats?.groundMist, colors[this.region.id][1]);
    const mix = { volcano: .34, tundra: .79, forest: .23, ruins: .14, void: .29 }[this.region.id] || 0;
    this.surfaceUniforms.blend.value = mix; this.surfaceUniforms.color.value.set(this.region.palette[0]);
    for (const material of [this.material.warning, this.material.area, this.material.marker, this.material.crack]) material.color.set(this.region.color);
    this.material.accent.color.set(this.region.color); this.material.accent.emissive.set(this.region.color); this.ambientMaterial.uniforms.color.value.set(this.region.color);
    this.ambient.visible = !['sanctum', 'throne'].includes(this.region.id);
    this.configureAccents();
    for (const enemy of this.game.enemies || []) this.decorateEnemy(enemy);
    this.updateVisuals();
  }

  configureAccents() {
    const id = this.region.id, active = ['volcano', 'tundra', 'ruins', 'void'].includes(id), crack = id === 'volcano';
    this.accentMesh.visible = active; this.accentMesh.geometry = crack ? this.geometry.crack : id === 'ruins' ? this.geometry.ring : this.geometry.shard;
    this.accentMesh.material = crack ? this.material.crack : this.material.accent;
    this.accentMesh.count = 0;
    if (!active) return;
    for (let i = 0; i < 48; i++) {
      const a = i * 2.399, r = 8 + (i % 12) * 5.6, x = Math.sin(a) * r, z = Math.cos(a) * r;
      if (this.game.world && !this.game.world.isWalkable(x, z, .65)) continue;
      const y = this.game.groundHeight?.(x, z) || 0;
      this.dummy.position.set(x, y + (crack || id === 'ruins' ? .04 : .35), z); this.dummy.rotation.set(0, a, crack || id === 'ruins' ? 0 : .15);
      this.dummy.scale.set(crack ? 2.3 : .55 + i % 4 * .2, crack ? 1 : .7 + i % 3 * .3, crack ? 1 : .65);
      this.dummy.updateMatrix(); this.accentMesh.setMatrixAt(this.accentMesh.count++, this.dummy.matrix);
    }
    this.accentMesh.instanceMatrix.needsUpdate = true;
  }

  decorateEnemy(enemy) {
    enemy.regionElement = ''; enemy.regionTeleporter = false;
    if (enemy.kind === 4 || enemy.minion || enemy.splitChild) return;
    const id = this.region.id;
    if (id === 'volcano' && [3, 6].includes(enemy.kind)) enemy.regionElement = 'fire';
    if (id === 'tundra' && [1, 3, 8].includes(enemy.kind)) enemy.regionElement = 'frost';
    if (id === 'forest' && [3, 7].includes(enemy.kind)) enemy.regionElement = 'poison';
    if (id === 'void' && [3, 7, 8].includes(enemy.kind) && !enemy.guard && !enemy.golden) { enemy.regionElement = 'void'; enemy.regionTeleporter = true; }
  }

  onEnemyPlayerHit(enemy) {
    if (this.game._state.phase !== 'playing') return;
    if (enemy?.regionElement === 'frost') this.slowRemaining = Math.max(this.slowRemaining, .9);
    if (enemy?.regionElement === 'poison') {
      // A single short, refreshable poison; damage never procs another status.
      if (this.poisonRemaining <= 0) this.poisonTick = .9;
      this.poisonRemaining = 2.7;
    }
  }
  movementMultiplier() { return this.slowRemaining > 0 ? .82 : 1; }
  damageMultiplier(enemy, spellId) { return this.region.id === 'tundra' && spellId === 'frost' && enemy?.slowTime > 0 ? 1.1 : 1; }

  /** Public deterministic seam also used by gameplay tests; all hazards share the cap. */
  spawnHazard(type, position, enemy = null) {
    if (this.hazards.length >= MAX_HAZARDS || !position) return false;
    const hazard = { type, position: new THREE.Vector3(position.x, this.game.groundHeight?.(position.x, position.z) || 0, position.z), elapsed: 0, nextHit: 0, enemy,
      warning: type === 'poison' ? 1.6 : type === 'blink' ? 1.2 : 1.4, duration: type === 'poison' ? 4 : .22, radius: type === 'poison' ? 3 : type === 'blink' ? 1.1 : 2.6, fired: false };
    if (enemy) enemy.regionBlinkPending = true;
    this.hazards.push(hazard); this.hazardsTriggered++; return hazard;
  }

  startBlink() {
    const enemy = this.game.enemies.find(enemy => enemy.hp > 0 && enemy.regionTeleporter && !enemy.regionBlinkPending && !(enemy.action || '').endsWith('-warning'));
    if (!enemy) return false;
    const destination = this.game.spawnPosition?.(6, 10);
    if (!destination || Math.hypot(destination.x - this.game.player.position.x, destination.z - this.game.player.position.z) < 5 || (this.game.world && !this.game.world.isWalkable(destination.x, destination.z, Math.min(1.2, enemy.size * .4)))) return false;
    return !!this.spawnHazard('blink', destination, enemy);
  }

  update(dt) {
    if (this.disposed || this.game._state.phase !== 'playing') return;
    dt = Math.max(0, Math.min(.1, Number(dt) || 0)); this.time += dt;
    this.slowRemaining = Math.max(0, this.slowRemaining - dt);
    if (this.poisonRemaining > 0) {
      this.poisonRemaining = Math.max(0, this.poisonRemaining - dt); this.poisonTick -= dt;
      if (this.poisonTick <= 0) { this.poisonTick += .9; this.hurt(.14, this.game.player.position, '오염된 숲 · 잔류 독'); }
    }
    if (['volcano', 'forest'].includes(this.region.id)) {
      this.hazardTimer -= dt;
      if (this.hazardTimer <= 0) { this.hazardTimer = this.region.id === 'volcano' ? 14 : 18; this.spawnHazard(this.region.id === 'volcano' ? 'lava' : 'poison', this.game.player.position); }
    }
    if (this.region.id === 'void') { this.blinkTimer -= dt; if (this.blinkTimer <= 0) { this.blinkTimer = 8; this.startBlink(); } }
    for (let i = this.hazards.length - 1; i >= 0; i--) {
      const hazard = this.hazards[i]; hazard.elapsed += dt;
      if (hazard.elapsed >= hazard.warning) {
        const distance = Math.hypot(hazard.position.x - this.game.player.position.x, hazard.position.z - this.game.player.position.z);
        if (hazard.type === 'blink') {
          const enemy = hazard.enemy;
          if (!hazard.fired && enemy?.hp > 0 && (this.game.activeEnemies?.has(enemy) ?? this.game.enemies.includes(enemy)) && distance >= 5 && (!this.game.world || this.game.world.isWalkable(hazard.position.x, hazard.position.z, Math.min(1.2, enemy.size * .4)))) {
            enemy.group.position.copy(hazard.position); enemy.regionBlinkPending = false; this.game.spatialDirty = true; this.blinks++;
          }
        } else if (distance < hazard.radius && hazard.elapsed >= hazard.nextHit) {
          this.hurt(hazard.type === 'lava' ? .9 : .28, hazard.position, hazard.type === 'lava' ? '화산 지대 · 용암 분출' : '오염된 숲 · 독 지대'); hazard.nextHit = hazard.elapsed + .9;
        }
        hazard.fired = true;
      }
      if (hazard.elapsed >= hazard.warning + hazard.duration) { if (hazard.enemy) hazard.enemy.regionBlinkPending = false; this.hazards.splice(i, 1); }
    }
    this.updateVisuals();
  }
  hurt(factor, position, cause) { if (this.game.takeDamage(getStageStats(this.game._state.stage).enemyDamage * factor, position, cause)) this.damageEvents++; }

  updateVisuals() {
    const draw = (mesh, index, position, size, lift = .055) => { this.dummy.position.set(position.x, (this.game.groundHeight?.(position.x, position.z) || 0) + lift, position.z); this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(size, 1, size); this.dummy.updateMatrix(); mesh.setMatrixAt(index, this.dummy.matrix); };
    const drawGround = (mesh, index, hazard, filled) => {
      const positions = mesh.geometry.attributes.position, vertices = filled ? 37 : 72, offset = index * vertices;
      const set = (vertex, x, z) => positions.setXYZ(vertex, x, (this.game.groundHeight?.(x, z) || 0) + (filled ? .05 : .065), z);
      if (filled) set(offset, hazard.position.x, hazard.position.z);
      for (let i = 0; i < 36; i++) {
        const a = i / 36 * TAU, dx = Math.sin(a) * hazard.radius, dz = Math.cos(a) * hazard.radius;
        if (filled) set(offset + i + 1, hazard.position.x + dx, hazard.position.z + dz);
        else { set(offset + i * 2, hazard.position.x + dx * .87, hazard.position.z + dz * .87); set(offset + i * 2 + 1, hazard.position.x + dx, hazard.position.z + dz); }
      }
      positions.needsUpdate = true;
    };
    let warnings = 0, areas = 0;
    for (const hazard of this.hazards) {
      drawGround(this.warningMesh, warnings++, hazard, false);
      if (hazard.elapsed >= hazard.warning && hazard.type !== 'blink') drawGround(this.areaMesh, areas++, hazard, true);
    }
    this.warningMesh.geometry.setDrawRange(0, warnings * 36 * 6); this.areaMesh.geometry.setDrawRange(0, areas * 36 * 3);
    this.warningMesh.count = warnings; this.areaMesh.count = areas;
    let markers = 0;
    for (const enemy of this.game.enemies || []) if (enemy.hp > 0 && enemy.regionElement && markers < MAX_MARKERS) draw(this.markerMesh, markers++, enemy.group.position, enemy.size * .75, .075);
    this.markerMesh.count = markers;
    for (const mesh of [this.warningMesh, this.areaMesh, this.markerMesh]) { mesh.visible = mesh.count > 0; if (mesh.instanceMatrix) mesh.instanceMatrix.needsUpdate = true; }
    if (!this.ambient.visible) return;
    const attribute = this.ambientGeometry.attributes.position, p = this.game.player.position, snow = this.region.id === 'tundra';
    for (let i = 0; i < 64; i++) { const a = this.ambientSeeds[i * 3] * TAU, r = 2 + this.ambientSeeds[i * 3 + 1] * 28, x = p.x + Math.cos(a) * r, z = p.z + Math.sin(a) * r, height = (this.ambientSeeds[i * 3 + 2] * 8 + this.time * (snow ? -.8 : .6) % 8 + 8) % 8; attribute.setXYZ(i, x, (this.game.groundHeight?.(x, z) || 0) + .4 + height, z); }
    attribute.needsUpdate = true;
  }

  reset() {
    for (const hazard of this.hazards) if (hazard.enemy) hazard.enemy.regionBlinkPending = false;
    this.hazards.length = 0; this.time = 0; this.hazardTimer = 10; this.blinkTimer = 8; this.slowRemaining = 0; this.poisonRemaining = 0; this.poisonTick = 0;
    this.hazardsTriggered = 0; this.blinks = 0; this.damageEvents = 0;
    for (const mesh of [this.warningMesh, this.areaMesh, this.markerMesh]) { mesh.count = 0; mesh.visible = false; }
  }
  getDebugState() { return { id: this.region.id, hazards: this.hazards.length, hazardDetails: this.hazards.map(h => ({ type: h.type, warning: h.warning, elapsed: h.elapsed, radius: h.radius, position: h.position.toArray() })), hazardsTriggered: this.hazardsTriggered, blinks: this.blinks, damageEvents: this.damageEvents, slowRemaining: this.slowRemaining, poisonRemaining: this.poisonRemaining, markers: this.markerMesh.count, accents: this.accentMesh.count, ambient: this.ambient.visible ? 64 : 0, renderBatchLimit: 5, maxHazards: MAX_HAZARDS }; }
  dispose() {
    if (this.disposed) return; this.reset(); this.disposed = true;
    for (const mesh of [this.warningMesh, this.areaMesh, this.markerMesh, this.accentMesh, this.ambient]) { mesh.removeFromParent(); mesh.dispose?.(); }
    for (const geometry of Object.values(this.geometry)) geometry.dispose();
    for (const material of Object.values(this.material)) material.dispose();
    this.ambientGeometry.dispose(); this.ambientMaterial.dispose();
  }
}
