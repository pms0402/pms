import * as THREE from 'three';

/** Draw identical opaque monster parts together, keeping their exact geometry and materials. */
export class EnemyRenderer {
  constructor(scene, enemies, capacity = 160) {
    this.scene = scene;
    this.enemies = enemies;
    this.capacity = capacity;
    this.enabled = true;
    this.batches = new Map();
    this.hidden = new Set();
    this.visibility = new WeakMap();
    this.frustum = new THREE.Frustum();
    this.projection = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.previousHook = scene.onBeforeRender;
    this.hook = (...args) => { this.previousHook?.apply(scene, args); this.sync(args[2]); };
    scene.onBeforeRender = this.hook;
  }

  restore() {
    for (const mesh of this.hidden) mesh.visible = this.visibility.get(mesh);
    this.hidden.clear();
  }

  batchFor(part) {
    const key = `${part.geometry.uuid}:${part.material.uuid}:${part.castShadow}:${part.receiveShadow}:${part.layers.mask}`;
    let batch = this.batches.get(key);
    if (!batch) {
      const mesh = new THREE.InstancedMesh(part.geometry, part.material, this.capacity);
      mesh.name = 'Monster instances';
      mesh.count = 0; mesh.visible = false;
      mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
      mesh.layers.mask = part.layers.mask;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.matrixAutoUpdate = false; mesh.matrixWorldAutoUpdate = false;
      this.scene.add(mesh);
      batch = { mesh, count: 0 }; this.batches.set(key, batch);
    }
    return batch;
  }

  sync(camera) {
    this.restore();
    for (const batch of this.batches.values()) { batch.count = 0; batch.mesh.count = 0; batch.mesh.visible = false; }
    if (!this.enabled || !camera) return;
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    for (const enemy of this.enemies) {
      // Boss materials and attachments can change independently during an encounter.
      if (enemy.kind === 4 || enemy.hp <= 0 || !enemy.group.visible || !enemy.visual.visible) continue;
      for (const part of enemy.visual.children) {
        const material = part.material;
        if (!part.isMesh || !part.visible || Array.isArray(material) || material.transparent || material.opacity < 1 || part.isSkinnedMesh) continue;
        if (!this.visibility.has(part)) this.visibility.set(part, part.visible);
        if (!part.geometry.boundingSphere) part.geometry.computeBoundingSphere();
        this.sphere.copy(part.geometry.boundingSphere).applyMatrix4(part.matrixWorld);
        // Off-screen casters remain so their shadows still reach visible terrain.
        const visible = this.frustum.intersectsSphere(this.sphere);
        if (!visible && !part.castShadow) { part.visible = false; this.hidden.add(part); continue; }
        const batch = this.batchFor(part);
        // Debug fixtures can exceed the gameplay cap: render overflow individually.
        if (batch.count >= this.capacity) continue;
        batch.mesh.setMatrixAt(batch.count++, part.matrixWorld);
        part.visible = false; this.hidden.add(part);
      }
    }
    for (const batch of this.batches.values()) {
      const { mesh, count } = batch;
      if (!count) continue;
      mesh.count = count; mesh.visible = true;
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }

  reset() {
    this.restore();
    for (const batch of this.batches.values()) { batch.mesh.count = 0; batch.mesh.visible = false; }
  }

  getDebugState() {
    return { enabled: this.enabled, batches: this.batches.size, activeBatches: [...this.batches.values()].filter(b => b.mesh.visible).length, instances: [...this.batches.values()].reduce((n, b) => n + b.mesh.count, 0) };
  }

  dispose() {
    this.reset();
    if (this.scene.onBeforeRender === this.hook) this.scene.onBeforeRender = this.previousHook;
    for (const { mesh } of this.batches.values()) { mesh.removeFromParent(); mesh.dispose(); }
    this.batches.clear();
  }
}
