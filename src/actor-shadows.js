import * as THREE from 'three';

/** Cheap grounding for the entire crowd, including actors without shadow-map casters. */
export class ActorShadows {
  constructor(scene, enemies, map, capacity = 160) {
    this.enemies = enemies; this.capacity = capacity;
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.material = new THREE.MeshBasicMaterial({ map, transparent: true, opacity: .42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = -1;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.matrix = new THREE.Matrix4(); this.position = new THREE.Vector3(); this.scale = new THREE.Vector3(); this.rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0)); scene.add(this.mesh);
  }
  sync() {
    let count = 0;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || !enemy.group.visible || count >= this.capacity) continue;
      this.position.copy(enemy.group.position); this.position.y += .035;
      const size = enemy.size * 1.05; this.scale.set(size, size * .82, 1); this.matrix.compose(this.position, this.rotation, this.scale); this.mesh.setMatrixAt(count++, this.matrix);
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    if (count) { this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, count * 16); this.mesh.instanceMatrix.needsUpdate = true; }
  }
  reset() { this.mesh.count = 0; this.mesh.visible = false; }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
