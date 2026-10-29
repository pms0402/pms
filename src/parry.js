import * as THREE from "three";
export class ParrySystem {
  constructor(game) {
    this.game = game;
    this.reset();
    this.geometry = new THREE.RingGeometry(
      0.8,
      1,
      24,
      1,
      -Math.PI / 3,
      (Math.PI * 2) / 3,
    );
    this.material = new THREE.MeshBasicMaterial({
      color: "#8bdcff",
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    this.mesh.visible = false;
    game.scene.add(this.mesh);
  }
  reset() {
    this.relicCooldown = 0;
    this.active = 0;
    this.age = 0;
    this.cooldown = 0;
    this.counterTime = 0;
    this.successes = 0;
    if (this.mesh) this.mesh.visible = false;
  }
  press() {
    const g = this.game;
    if (g._state.phase !== "playing" && !(g._state.phase === "camp" && g.camp.practice && !g.camp.suspended)) return false;
    if (this.counterTime > 0) {
      if (g.camp?.active) g.camp.counter(); else g.attack();
      return true;
    }
    if (this.cooldown > 0) return false;
    if (g._state.phase === "playing" && g.analytics) g.analytics.parryAttempts++;
    this.age = 0;
    this.active = 0.5;
    this.cooldown = 3;
    g.sound("dash");
    return true;
  }
  update(dt) {
    this.age += dt;
    this.active = Math.max(0, this.active - dt);
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.counterTime = Math.max(0, this.counterTime - dt);
    this.mesh.visible = this.active > 0;
    this.mesh.position.copy(this.game.player.position);
    this.mesh.position.y += 0.18;
    this.mesh.rotation.z = this.game.player.rotation.y - Math.PI / 2;
    this.mesh.scale.setScalar(2);
  }
  defend(source, options = {}) {
    const g = this.game;
    if (!this.active || options.unblockable || !source) return 1;
    const dx = options.incomingDirection
        ? -options.incomingDirection.x
        : source.x - g.player.position.x,
      dz = options.incomingDirection
        ? -options.incomingDirection.z
        : source.z - g.player.position.z,
      d = Math.hypot(dx, dz);
    if (
      d < 0.01 ||
      (dx * Math.sin(g.player.rotation.y) +
        dz * Math.cos(g.player.rotation.y)) /
        d <
        0.5
    )
      return 1;
    if (this.age <= 0.18) {
      this.active = 0;
      this.counterTime = 2;
      if (g._state.phase === "playing") { this.successes++; g.setSystem?.onParry(); g.classes?.onParry(); if(g.analytics)g.analytics.parrySuccesses++; }
      g.puff(g.player.position, "#b1edff", 2, 0.3);
      g.sound("critical");
      g.callbacks.onLoot?.(
        "완벽한 패링 · 2초 안 다음 검격은 단일 대상 2배 반격",
      );
      if (g._state.phase === "playing" && g.stats.relics?.includes("shockwave") && !(this.relicCooldown > 0)) {
        this.relicCooldown = 6;
        for (const e of g.queryEnemies(g.player.position, 2.4).slice(0, 4))
          g.hitEnemy(e, g.combatStats.damage * 0.2, undefined, "parry");
      }
      return 0;
    }
    return 0.35;
  }
  consume() {
    if (this.counterTime <= 0) return 1;
    this.counterTime = 0;
    this.game.puff(this.game.player.position, "#c7edff", 2.8, 0.25);
    return 2;
  }
  getState() {
    return {
      active: this.active,
      perfect: this.active > 0 && this.age <= 0.18,
      cooldown: this.cooldown,
      counterTime: this.counterTime,
      successes: this.successes,
    };
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
