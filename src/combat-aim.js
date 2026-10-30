import * as THREE from "three";
import { swordAction } from "./action-combat.js";
/** A fixed line buffer shares the live sword heading and action radii with collision. */
export class CombatAim {
  constructor(game) {
    this.game = game;
    this.geometry = new THREE.BufferGeometry();
    this.points = new Float32Array(360);
    this.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.points, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.material = new THREE.LineBasicMaterial({
      color: "#b9d1df",
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    });
    this.mesh = new THREE.LineSegments(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 3;
    game.scene.add(this.mesh);
  }
  update() {
    const g = this.game,
      a = g.actions.current;
    this.mesh.visible = g._state.phase === "playing";
    if (!this.mesh.visible) return;
    const dir = a?.direction || g.actions.direction(),
      yaw = Math.atan2(dir.x, dir.z);
    let at = 0;
    const point = (x, z) => {
      this.points[at++] = x;
      this.points[at++] = g.groundHeight(x, z) + 0.12;
      this.points[at++] = z;
    };
    const line = (x, z, u, v) => {
      point(x, z);
      point(u, v);
    };
    const sector = (origin, range, arc) => {
      const put = (angle) => {
        const desired=new THREE.Vector3(origin.x+Math.sin(angle)*range,origin.y,origin.z+Math.cos(angle)*range),end=g.aimTarget?.(origin,desired)||desired;
        point(end.x,end.z);
      };
      for (let i = 0; i < 44; i++) {
        put(yaw - arc / 2 + (arc * i) / 44);
        put(yaw - arc / 2 + (arc * (i + 1)) / 44);
      }
      if (arc < Math.PI * 2) {
        put(yaw - arc / 2);
        point(origin.x, origin.z);
        point(origin.x, origin.z);
        put(yaw + arc / 2);
      }
    };
    const corridor = (range, width) => {
      const p = g.player.position,
        end = p.clone().addScaledVector(dir, range),
        x = dir.z * width,
        z = -dir.x * width;
      line(p.x + x, p.z + z, end.x + x, end.z + z);
      line(end.x + x, end.z + z, end.x - x, end.z - z);
      line(end.x - x, end.z - z, p.x - x, p.z - z);
    };
    if (a?.type === "skill") {
      const target=g.aimTarget?.(g.player.position,a.target)||a.target;
      if (a.id === "lightning") corridor(22, 2.2);
      else {
        sector(
          a.id === "frost" ? g.player.position : target,
          g.magic.radius(a.id),
          Math.PI * 2,
        );
        if (a.id === "fireball")
          line(
            g.player.position.x,
            g.player.position.z,
            target.x,
            target.z,
          );
      }
    } else {
      const profile =
        a ||
        swordAction(
          g.stats,
          g.combatStats,
          g.actions.charging ? "heavy" : "light",
          g.actions.combo,
        );
      if (profile.style === "wave" && !profile.counter)
        corridor(profile.profile.range, profile.heavy ? 1.8 : 0.75);
      else
        sector(g.player.position, profile.profile.range, profile.profile.arc);
    }
    this.geometry.setDrawRange(0, at / 3);
    this.geometry.attributes.position.needsUpdate = true;
    this.material.color.set(
      g.actions.charging
        ? "#efc276"
        : a?.type === "skill"
          ? "#c69fe6"
          : "#b9d1df",
    );
  }
  dispose() {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
