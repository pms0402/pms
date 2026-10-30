import * as THREE from "three";
import { combatLineClear } from "./combat-collision.js";

const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
export const LOCK_RANGE = 26;
/** Selection changes only on a command, death, distance, or prolonged occlusion. */
export class LockOnSystem {
  constructor(game) {
    this.game = game;
    this.target = null;
    this.occluded = 0;
    this.serial = 0;
    this.marker = new THREE.Mesh(
      new THREE.TorusGeometry(0.55, 0.025, 5, 28),
      new THREE.MeshBasicMaterial({
        color: "#f2d692",
        transparent: true,
        opacity: 0.9,
        depthTest: false,
        depthWrite: false,
      }),
    );
    this.marker.renderOrder = 10;
    this.marker.visible = false;
    game.scene.add(this.marker);
  }
  available() {
    return (
      this.game._state.phase === "playing" &&
      !this.game.callbacks.isUIBlocked?.()
    );
  }
  alive(e) {
    return (
      !!e &&
      e.hp > 0 &&
      (this.game.activeEnemies?.has(e) ?? this.game.enemies.includes(e))
    );
  }
  candidates() {
    const g = this.game,
      p = g.player.position,
      yaw = g.player.rotation.y;
    return (g.queryEnemies?.(p, LOCK_RANGE) || g.enemies)
      .filter(
        (e) =>
          this.alive(e) &&
          p.distanceTo(e.group.position) <= LOCK_RANGE &&
          combatLineClear(g, p, e.group.position),
      )
      .map((e) => {
        const delta = e.group.position.clone().sub(p),
          angle = Math.atan2(delta.x, delta.z),
          distance = Math.hypot(delta.x, delta.z);
        return {
          enemy: e,
          angle,
          score:
            distance +
            Math.abs(angleDifference(angle, yaw)) * 6 -
            (e.kind === 4 ? 6 : 0),
        };
      });
  }
  set(enemy) {
    this.target = enemy || null;
    this.occluded = 0;
    this.serial++;
    this.game.view?.movement.reset();
    this.game.emit?.();
    return !!enemy;
  }
  toggle() {
    if (!this.available()) return false;
    if (this.target) {
      this.set(null);
      return true;
    }
    const chosen = this.candidates().sort(
      (a, b) =>
        a.score - b.score ||
        (a.enemy.spawnSerial || 0) - (b.enemy.spawnSerial || 0),
    )[0];
    if (!chosen) {
      this.game.callbacks.onLoot?.("보이는 적이 가까이에 없습니다");
      return false;
    }
    return this.set(chosen.enemy);
  }
  cycle(step = 1) {
    if (!this.available()) return false;
    if (!this.target) return this.toggle();
    const list = this.candidates().sort(
      (a, b) =>
        a.angle - b.angle ||
        (a.enemy.spawnSerial || 0) - (b.enemy.spawnSerial || 0),
    );
    const i = list.findIndex((e) => e.enemy === this.target);
    if (!list.length) {
      this.reset();
      return false;
    }
    return this.set(
      list[(i + (step < 0 ? -1 : 1) + list.length) % list.length].enemy,
    );
  }
  update(dt) {
    if (!this.target) return;
    const g = this.game,
      p = g.player.position,
      e = this.target;
    if (
      !this.alive(e) ||
      p.distanceTo(e.group.position) > 34 ||
      ["camp", "menu", "over", "won"].includes(g._state.phase)
    ) {
      this.reset();
      return;
    }
    if (g._state.phase !== "playing") return;
    this.occluded = combatLineClear(g, p, e.group.position)
      ? 0
      : this.occluded + dt;
    if (this.occluded > 0.7) {
      this.reset();
      return;
    }
    const dx = e.group.position.x - p.x,
      dz = e.group.position.z - p.z;
    // At point-blank range keep the last heading instead of spinning over a tiny delta.
    if (dx * dx + dz * dz < 1.1 ** 2) return;
    const desired = Math.atan2(dx, dz),
      difference = angleDifference(desired, g.player.rotation.y);
    const amount = Math.max(
      -3.2 * dt,
      Math.min(3.2 * dt, difference * (1 - Math.exp(-dt * 12))),
    );
    const yaw =
      g.player.rotation.y + (Math.abs(difference) > 0.012 ? amount : 0);
    g.actions.setAim(
      new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      Math.min(18, Math.hypot(dx, dz)),
    );
  }
  movement(x, y, out = new THREE.Vector3()) {
    const yaw = this.game.player.rotation.y;
    return out.set(
      -Math.cos(yaw) * x - Math.sin(yaw) * y,
      0,
      Math.sin(yaw) * x - Math.cos(yaw) * y,
    );
  }
  syncMarker() {
    const g = this.game,
      e = this.target;
    this.marker.visible = this.alive(e) && g._state.phase === "playing";
    if (!this.marker.visible) return;
    this.marker.position.copy(e.group.position);
    this.marker.position.y += Math.min(3.8, Math.max(1.1, e.size * 1.1));
    this.marker.quaternion.copy(g.camera.quaternion);
    this.marker.scale.setScalar(e.kind === 4 ? 1.5 : 1);
  }
  state() {
    const e = this.target;
    return {
      active: this.alive(e),
      name: e?.name || "",
      serial: this.serial,
      distance: e ? this.game.player.position.distanceTo(e.group.position) : 0,
      boss: e?.kind === 4,
    };
  }
  reset() {
    this.target = null;
    this.occluded = 0;
    this.marker.visible = false;
  }
  dispose() {
    this.reset();
    this.marker.removeFromParent();
    this.marker.geometry.dispose();
    this.marker.material.dispose();
  }
}
