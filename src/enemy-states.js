import * as THREE from "three";
/** Persistent status cues; hazard outlines render above these rings. */
export class EnemyStates {
  constructor(game) {
    this.game = game;
    this.geometry = new THREE.RingGeometry(0.85, 1, 24);
    this.geometry.rotateX(-Math.PI / 2);
    this.material = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, 160);
    this.mesh.name = "Actual slow freeze and burn states";
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.count = 0;
    this.mesh.renderOrder = 2;
    game.scene.add(this.mesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
  }
  sync() {
    let count = 0;
    for (const e of this.game.enemies) {
      if (
        e.hp <= 0 ||
        !(e.slowTime > 0 || e.freezeTime > 0 || e.burnTime > 0) ||
        count >= 160
      )
        continue;
      this.dummy.position.copy(e.group.position);
      this.dummy.position.y += 0.09;
      this.dummy.scale.setScalar(Math.max(0.5, Math.min(2, e.size * 0.55)));
      this.dummy.rotation.y =
        e.freezeTime > 0 ? 0 : this.game._state.elapsed * 0.4;
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(count, this.dummy.matrix);
      this.color.set(
        e.freezeTime > 0 ? "#e7fbff" : e.slowTime > 0 ? "#78c6de" : "#d8874b",
      );
      this.mesh.setColorAt(count++, this.color);
    }
    this.mesh.count = count;
    this.mesh.visible = count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  reset() {
    this.mesh.count = 0;
    this.mesh.visible = false;
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
