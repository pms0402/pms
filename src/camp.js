import * as THREE from "three";
import { SceneContext } from "./scene-context.js";
export const CAMP_FACILITIES = Object.freeze([
  { id: "smith", name: "대장간", x: -8, z: -6, color: "#dfad75" },
  { id: "training", name: "훈련장", x: 8, z: -6, color: "#b3d797" },
  { id: "laboratory", name: "마법 연구소", x: 0, z: -11, color: "#b498e4" },
  { id: "archive", name: "기록관", x: 0, z: 10, color: "#8bc6dc" },
  { id: "altar", name: "강화 제단", x: -9, z: 6, color: "#c4e68e" },
  { id: "gate", name: "탐험의 문", x: 9, z: 6, color: "#e5b9dd" },
]);
export class CampSystem {
  constructor(game) {
    this.game = game;
    this.context = new SceneContext(game);
    this.active = false;
    this.practice = false;
    this.practiceTimer = 2;
    this.geometry = {
      floor: new THREE.CylinderGeometry(18, 18, 1, 64),
      pillar: new THREE.CylinderGeometry(0.22, 0.28, 3, 12),
      roof: new THREE.ConeGeometry(2, 1.3, 8),
      body: new THREE.CylinderGeometry(1.5, 1.7, 1.8, 16),
      ring: new THREE.TorusGeometry(1.5, 0.15, 8, 32),
      orb: new THREE.SphereGeometry(0.45, 16, 12),
      anvil: new THREE.BoxGeometry(1.4, 0.45, 0.6),
    };
    this.materials = [];
    this.group = new THREE.Group();
    this.group.visible = false;
    game.scene.add(this.group);
    const stone = new THREE.MeshStandardMaterial({
      color: "#85898b",
      map: game.presentation.stoneMap,
      roughness: 0.85,
    });
    this.materials.push(stone);
    const add = (geo, mat, p, s = 1) => {
      const m = new THREE.Mesh(this.geometry[geo], mat);
      m.position.copy(p);
      m.scale.setScalar(s);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    add("floor", stone, new THREE.Vector3(0, -0.52, 0));
    this.markers = new Map();
    for (const f of CAMP_FACILITIES) {
      const glow = new THREE.MeshStandardMaterial({
        color: f.color,
        emissive: f.color,
        emissiveIntensity: 0.6,
        roughness: 0.6,
      });
      this.materials.push(glow);
      add("body", stone, new THREE.Vector3(f.x, 0.9, f.z));
      if (f.id === "gate") {
        const m = add("ring", glow, new THREE.Vector3(f.x, 2.3, f.z));
        m.scale.setScalar(1.2);
      } else if (f.id === "smith") {
        add("anvil", glow, new THREE.Vector3(f.x, 2, f.z));
      } else if (f.id === "training") {
        add("pillar", stone, new THREE.Vector3(f.x, 2, f.z), 0.6);
        add("orb", glow, new THREE.Vector3(f.x, 3.1, f.z), 0.6);
      } else {
        add("roof", stone, new THREE.Vector3(f.x, 2.4, f.z));
      }
      // Reuse the detailed expedition NPC models; each facility has a keeper.
      const keeper = game.exploration.model(
        f.id === "smith"
          ? "smith"
          : f.id === "training"
            ? "knight"
            : "merchant",
      );
      keeper.position.set(f.x - 1.8, 0, f.z + 1.4);
      this.group.add(keeper);
      if (["laboratory", "archive", "altar"].includes(f.id)) {
        const arch = add(
          "ring",
          glow,
          new THREE.Vector3(f.x, 1.5, f.z + 1.2),
          0.65,
        );
        arch.rotation.y = -0.3;
        for (const side of [-1, 1])
          add(
            "pillar",
            stone,
            new THREE.Vector3(f.x + side * 1.8, 1.5, f.z),
            0.65,
          );
      }
      this.markers.set(
        f.id,
        add("orb", glow, new THREE.Vector3(f.x, 3.8, f.z), 0.35),
      );
    }
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      add(
        "pillar",
        stone,
        new THREE.Vector3(Math.sin(a) * 16, 1.5, Math.cos(a) * 16),
      );
    }
  }
  enter() {
    const g = this.game;
    if (!["menu", "over", "won"].includes(g._state.phase)) return false;
    g.clearDynamic();
    g.stats = g.freshStats();
    g.applyLoadoutAppearance();
    g._state.hp = g.combatStats.maxHp;
    this.context.hide();
    this.context.mood(["#4b4d48", "#19252b", "#c4dce2", "#dcc395"]);
    this.group.visible = true;
    g.player.position.set(0, 0, 0);
    g.player.rotation.y = 0;
    g._state.phase = "camp";
    this.active = true;
    this.suspended = false;
    this.practice = false;
    g.keys.clear();
    g.touchMove = { x: 0, y: 0 };
    g.emit();
    return true;
  }
  leave() {
    if (!this.active) return;
    this.group.visible = false;
    this.context.restore();
    this.active = false;
    this.practice = false;
  }
  refresh() {
    if (!this.active) return;
    const g = this.game;
    g.stats = g.freshStats();
    g.applyLoadoutAppearance();
    g._state.hp = g.combatStats.maxHp;
  }
  nearest() {
    const p = this.game.player.position;
    return CAMP_FACILITIES.map((f) => ({
      ...f,
      distance: Math.hypot(p.x - f.x, p.z - f.z),
    })).sort((a, b) => a.distance - b.distance)[0];
  }
  use(id) {
    if (!this.active || !CAMP_FACILITIES.some((f) => f.id === id)) return false;
    this.game.callbacks.onCampFacility?.(id);
    return true;
  }
  focus(id) {
    const f = CAMP_FACILITIES.find((f) => f.id === id);
    if (!this.active || !f) return false;
    this.game.player.position.set(f.x, 0, f.z + 2.8);
    this.game.emit();
    return this.use(id);
  }
  interact() {
    const f = this.nearest();
    return f.distance <= 3.4 ? this.use(f.id) : false;
  }
  train() {
    if (!this.active) return false;
    this.practice = true;
    this.practiceTimer = 2;
    const f = CAMP_FACILITIES.find((f) => f.id === "training");
    this.game.player.position.set(f.x, 0, f.z + 3);
    this.game.player.rotation.y = Math.PI;
    this.game.callbacks.onLoot?.(
      "훈련 · 푸른 구체가 켜진 뒤 G. 체력과 런 통계는 변하지 않습니다.",
    );
    return true;
  }
  counter() {
    if (!this.practice || this.game.parry.counterTime <= 0) return false;
    this.game.parry.consume();
    this.game.attackAnim = this.game.attackAnimTotal = 0.3;
    this.game.slash(new THREE.Vector3(0, 0, -1));
    this.game.callbacks.onLoot?.("훈련 반격 성공");
    return true;
  }
  update(dt) {
    if (this.suspended) return;
    const g = this.game,
      d = g.inputDirection();
    g.player.position.addScaledVector(d, g.combatStats.speed * dt);
    const r = Math.hypot(g.player.position.x, g.player.position.z);
    if (r > 16) g.player.position.multiplyScalar(16 / r);
    g.player.position.y = 0;
    if (d.lengthSq() > 0.01)
      g.player.rotation.y = g.lerpAngle(
        g.player.rotation.y,
        Math.atan2(d.x, d.z),
        dt * 13,
      );
    this.time = (this.time || 0) + dt;
    for (const f of CAMP_FACILITIES)
      this.markers.get(f.id).position.y =
        3.8 + Math.sin(this.time * 2 + f.x) * 0.12;
    g.parry.update(dt);
    if (this.practice) {
      this.practiceTimer -= dt;
      const m = this.markers.get("training");
      m.scale.setScalar(this.practiceTimer < 0.8 ? 1.8 : 1);
      if (this.practiceTimer <= 0) {
        const f = CAMP_FACILITIES.find((f) => f.id === "training");
        const blocked = g.parry.defend(new THREE.Vector3(f.x, 0, f.z));
        g.callbacks.onLoot?.(
          blocked === 0
            ? "패링 연습 성공 · G로 반격"
            : blocked < 1
              ? "기본 방어 성공 · 더 늦게 G를 눌러 보세요"
              : "훈련 공격 · 실제 체력 피해 없음",
        );
        this.practiceTimer = 3;
      }
    }
  }
  state() {
    return {
      active: this.active,
      practice: this.practice,
      nearest: this.active ? this.nearest() : null,
    };
  }
  dispose() {
    this.leave();
    this.group.removeFromParent();
    Object.values(this.geometry).forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
