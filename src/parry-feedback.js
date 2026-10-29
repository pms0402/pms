import * as THREE from "three";
/** Four cached meshes and one bounded light. Cosmetic randomness uses CombatArt's own RNG. */
export class ParryFeedback {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = "Parry feedback";
    game.scene.add(this.root);
    this.geometries = {
      ring: new THREE.RingGeometry(0.94, 1, 64, 1),
      disc: new THREE.RingGeometry(0, 1, 48, 5),
      sector: new THREE.RingGeometry(0.1, 1, 64, 6, -Math.PI / 2, Math.PI),
    };
    this.materials = [];
    this.groundGeometries = [];
    const add = (geo, color, ground = false) => {
      const m = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      this.materials.push(m);
      const geometry = ground
        ? this.geometries[geo].clone()
        : this.geometries[geo];
      const mesh = new THREE.Mesh(geometry, m);
      if (ground) {
        this.groundGeometries.push(geometry);
        mesh.userData.groundBase = geometry.attributes.position.array.slice();
      }
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      this.root.add(mesh);
      return mesh;
    };
    this.wave = add("ring", "#bdefff", true);
    this.disc = add("disc", "#c4eaff", true);
    this.counter = add("sector", "#ffe6ad", true);
    this.flash = add("ring", "#f4ffff");
    this.light = new THREE.PointLight("#c2edff", 0, 7, 2);
    this.root.add(this.light);
    this.time = 0;
    this.reset();
  }
  reset() {
    this.waveTime = this.counterTime = this.flashTime = 0;
    for (const m of [this.wave, this.disc, this.counter, this.flash])
      if (m) m.visible = false;
    if (this.light) this.light.intensity = 0;
  }
  success(source, radius) {
    const g = this.game,
      p = g.player.position,
      e = g.effectIntensity ?? 1;
    this.origin = p.clone();
    this.radius = radius;
    this.waveTime = 0.32;
    this.flashTime = 0.14;
    this.wave.position.copy(p);
    this.wave.position.y = g.groundHeight(p.x, p.z) + 0.15;
    this.disc.position.copy(this.wave.position);
    this.disc.scale.setScalar(radius);
    this.refit(this.disc, 0.15);
    this.flash.position
      .copy(p)
      .addScaledVector(source.clone().sub(p).setY(0).normalize(), 0.8);
    this.flash.position.y += 1.15;
    this.flash.rotation.x = 0;
    this.flash.quaternion.copy(g.camera.quaternion);
    this.light.position.copy(p);
    this.light.position.y += 1.6;
    g.combatArt.emit(
      this.flash.position,
      "parry",
      e === 0 ? 3 : Math.round(8 + e * 20),
    );
    g.callbacks.onParry?.();
  }
  strike(direction, profile) {
    const g = this.game;
    this.counterTime = 0.28;
    this.counter.position.copy(g.player.position);
    this.counter.position.y =
      g.groundHeight(g.player.position.x, g.player.position.z) + 0.24;
    this.counter.scale.setScalar(profile.range);
    this.counter.rotation.z =
      Math.atan2(direction.x, direction.z) - Math.PI / 2;
    this.refit(this.counter, 0.24);
  }
  refit(mesh, offset) {
    if (!this.game.fitGroundMesh) return;
    mesh.geometry.attributes.position.array.set(mesh.userData.groundBase);
    this.game.fitGroundMesh(mesh, offset);
  }
  update(dt) {
    this.waveTime = Math.max(0, this.waveTime - dt);
    this.flashTime = Math.max(0, this.flashTime - dt);
    this.counterTime = Math.max(0, this.counterTime - dt);
    const e = this.game.effectIntensity ?? 1,
      t = 1 - this.waveTime / 0.32;
    this.wave.visible = this.disc.visible = this.waveTime > 0;
    this.wave.scale.setScalar(
      Math.min(this.radius || 4, (this.radius || 4) * (0.08 + t * 0.92)),
    );
    if (this.waveTime > 0) this.refit(this.wave, 0.15);
    this.wave.material.opacity = (1 - t) * (0.25 + e * 0.45);
    this.disc.material.opacity = (1 - t) * (0.035 + e * 0.045);
    this.flash.visible = this.flashTime > 0 && e > 0;
    this.flash.scale.setScalar(0.15 + (1 - this.flashTime / 0.14) * 1.2);
    this.flash.material.opacity = (this.flashTime / 0.14) * 0.65 * e;
    this.light.intensity = (this.flashTime / 0.14) * 3 * e;
    this.counter.visible = this.counterTime > 0;
    this.counter.material.opacity =
      (this.counterTime / 0.28) * (0.28 + e * 0.42);
  }
  dispose() {
    this.reset();
    this.root.removeFromParent();
    Object.values(this.geometries).forEach((g) => g.dispose());
    this.groundGeometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
