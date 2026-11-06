import * as THREE from "three";
import {rigMaterial} from "./monster-motion.js";

/** Cosmetic copies only: defeated actors leave queries, rewards and pools immediately. */
export class DeathPresentation {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = "Bounded defeat silhouettes";
    game.scene.add(this.root);
    this.slots = [];
    this.limit = 10;
  }
  capture(enemy, direction) {
    if (!enemy?.group || this.game.effectIntensity === 0) return;
    const source = enemy.specialModel || enemy.npcModel || enemy.visual;
    if (!source) return;
    const key = `${enemy.visualKind ?? enemy.kind}:${enemy.archetype || ""}:${enemy.hiddenBoss || enemy.duelist || ""}`;
    const active = this.slots.filter((s) => s.life > 0);
    let entry =
      active.length >= this.limit
        ? active.filter((s) => !s.boss).sort((a, b) => a.life - b.life)[0]
        : this.slots.find((s) => !s.life && s.key === key) ||
          this.slots.find((s) => !s.life);
    if (active.length >= this.limit && !entry) return;
    if (!entry && this.slots.length < this.limit) {
      entry = { root: new THREE.Group(), materials: [], life: 0 };
      this.root.add(entry.root);
      this.slots.push(entry);
    }
    if (!entry)
      entry = this.slots
        .filter((s) => !s.boss)
        .sort((a, b) => a.life - b.life)[0];
    if (!entry) return;
    if (entry.key !== key) {
      entry.materials.forEach((m) => m.dispose());
      entry.materials = [];
      entry.root.clear();
      entry.pose=Array.from({length:4},()=>new THREE.Vector4());
      const copy = source.clone(true),
        materials = new Map();
      const original = [];
      source.traverse((o) => {
        if (o.isMesh) original.push(o);
      });
      let index = 0;
      copy.traverse((o) => {
        if (!o.isMesh) return;
        const real = original[index++],
          posed = this.game.enemyRenderer?.cpuParts.get(real);
        if (posed) o.geometry = posed.original;
        o.visible = true;
        o.castShadow = false;
        o.receiveShadow = true;
        const clone = (m) => {
          if (!materials.has(m)) {
            const c = o.geometry.attributes.vrJoint?rigMaterial(m,entry.pose):m.clone();
            c.transparent = true;
            c.depthWrite = false;
            materials.set(m, c);
            entry.materials.push(c);
          }
          return materials.get(m);
        };
        o.material = Array.isArray(real.material)
          ? real.material.map(clone)
          : clone(real.material);
      });
      copy.position.set(0, 0, 0);
      copy.rotation.set(0, 0, 0);
      copy.scale.setScalar(1);
      copy.visible = true;
      entry.root.add(copy);entry.copy=copy;
      entry.key = key;
    }
    entry.boss = enemy.kind === 4;
    entry.total = entry.life = entry.boss ? 1.15 : .95;
    const pose=enemy.motion?.pose||new Float32Array(16);for(let i=0;i<4;i++)entry.pose[i].fromArray(pose,i*4);
    entry.baseDeath=entry.pose[3].z;entry.visualY=enemy.visual?.position.y||0;entry.initialX=enemy.visual?.rotation.x||0;entry.initialZ=enemy.visual?.rotation.z||0;entry.copy.position.y=entry.visualY;
    entry.pose[3].w=1;entry.pose[0].y=0;entry.pose[0].z=0;entry.pose[0].w=0;entry.pose[1].x=0;
    entry.root.visible = true;
    entry.root.position.copy(enemy.group.position);
    entry.root.scale.copy(enemy.group.scale);
    entry.scale = enemy.group.scale.y;
    entry.y = enemy.group.position.y;
    entry.yaw = enemy.group.rotation.y + (enemy.visual?.rotation.y || 0);
    entry.root.rotation.set(entry.initialX,entry.yaw,entry.initialZ);
    const dx = direction?.x || Math.sin(entry.yaw),
      dz = direction?.z || Math.cos(entry.yaw);
    entry.dx = dx;
    entry.dz = dz;
    entry.fallX = Math.cos(entry.yaw) * dz + Math.sin(entry.yaw) * dx;
    entry.fallZ = -Math.cos(entry.yaw) * dx + Math.sin(entry.yaw) * dz;
    for (const m of entry.materials) m.opacity = 1;
  }
  update(dt) {
    for (const e of this.slots) {
      if (!e.life) continue;
      e.life = Math.max(0, e.life - dt);
      const t = 1 - e.life / e.total,
        fall = t * t * (3 - 2 * t);
      e.root.position.y = e.y + Math.sin(Math.PI*Math.min(1,t*2))*.08*e.scale;
      e.pose[3].z=Math.max(e.baseDeath,Math.min(1,t*1.6));e.pose[2].w=(1-t)*.5;
      e.root.position.x += e.dx * dt * 0.45 * (1 - t);
      e.root.position.z += e.dz * dt * 0.45 * (1 - t);
      this.game.resolvePosition?.(e.root.position,e.boss?1.2:.45,e.boss?7.5:2);
      e.root.rotation.x = e.initialX+(e.fallX*1.2-e.initialX)*fall;
      e.root.rotation.z = e.initialZ+(e.fallZ*.85-e.initialZ)*fall;e.copy.position.y=e.visualY*(1-fall)+.08*fall;
      e.root.scale.y=e.scale;
      for (const m of e.materials)
        m.opacity = Math.max(0, 1 - Math.max(0,t-.58)/.42);
      e.root.visible = e.life > 0;
    }
  }
  setLimit(limit) {
    this.limit = limit;
    const active = this.slots
      .filter((s) => s.life > 0)
      .sort((a, b) => Number(b.boss) - Number(a.boss) || b.life - a.life);
    for (const e of active.slice(limit)) {
      e.life = 0;
      e.root.visible = false;
    }
  }
  reset() {
    for (const e of this.slots) {
      e.life = 0;
      e.root.visible = false;
    }
  }
  dispose() {
    this.reset();
    for (const e of this.slots) e.materials.forEach((m) => m.dispose());
    this.root.removeFromParent();
    this.slots.length = 0;
  }
}
