import * as THREE from "three";
import { isSwordHit } from "./sword.js";
export function encounterBudget(stage, time, mode = "normal", spawnRate = 1) {
  const ordinary = Math.min(
    15,
    6 +
      Math.floor(Math.min(10, stage) * 0.5) +
      Math.floor(Math.min(120, time) / 25),
  );
  return Math.min(
    25,
    ordinary +
      (mode === "abyss" ? 8 : 0) +
      Math.min(8, Math.ceil(Math.max(0, spawnRate - 1) * 3)),
  );
}
/** Decisions observe positions, released attacks and public recovery poses, never input keys. */
export class TacticalAI {
  constructor(game) {
    this.game = game;
    this.vector = new THREE.Vector3();
  }
  beginFrame() {
    const g = this.game;
    this.attackers = g.enemies.filter(
      (e) => e.hp > 0 && (e.action?.endsWith("warning") || e.windup > 0),
    ).length;
    this.limit = g._state.stage < 4 ? 2 : g.mode === "abyss" ? 4 : 3;
  }
  admit() {
    if (this.attackers >= this.limit) return false;
    this.attackers++;
    return true;
  }
  move(e, x, z, dt, rate = 1) {
    const g = this.game,
      slow = e.slowTime > 0 ? Math.max(0.15, e.slowFactor || 0.5) : 1;
    let dx = x - e.group.position.x,
      dz = z - e.group.position.z,
      d = Math.hypot(dx, dz);
    if (d > 0.1 && e.speed > 0) {
      if (g.world && !g.sideAreas.active) {
        const steer = g.world.steer(
          e.group.position,
          dx,
          dz,
          Math.min(1.2, e.size * 0.4),
          e.seed,
        );
        dx = steer.x;
        dz = steer.z;
        d = 1;
      }
      const step = e.speed * slow * (e.hitTime > 0 ? 0.25 : 1) * rate * dt;
      e.group.position.x += (dx / d) * step;
      e.group.position.z += (dz / d) * step;
    }
    e.group.position.addScaledVector(e.stagger, dt);
    e.stagger.multiplyScalar(Math.max(0, 1 - dt * 9));
    g.resolvePosition(e.group.position, Math.min(1.2, e.size * 0.4));
  }
  melee(e, dt) {
    if (e.golden || ![0, 1, 2, 7].includes(e.kind)) return false;
    const g = this.game,
      p = g.player.position,
      pos = e.group.position,
      s = (e.tactics ||= {
        phase: "circle",
        timer: 0.25 + (e.seed % 1) * 0.8,
        angle: e.seed,
      });
    e.hitTime = Math.max(0, e.hitTime - dt);
    e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
    s.timer -= dt;
    const dx = p.x - pos.x,
      dz = p.z - pos.z,
      d = Math.hypot(dx, dz),
      range = e.kind === 2 ? 3.2 : e.kind === 1 ? 2.55 : 2.3,
      arc = e.kind === 2 ? (Math.PI * 5) / 6 : (Math.PI * 2) / 3;
    if (e.elite) {
      const dashing = g.dashTime > 0;
      if (s.sawDash && !dashing) s.timer = Math.min(s.timer, 0.25);
      s.sawDash = dashing;
    }
    if (
      s.phase === "windup" &&
      e.hitTime > 0.1 &&
      (s.nextInterrupt || 0) <= g._state.elapsed
    ) {
      g.clearTelegraph(e);
      s.phase = "recover";
      s.timer = 0.5;
      s.nextInterrupt = g._state.elapsed + 2;
      e.action = "melee-recovery";
    }
    if (s.phase === "windup" && e.action !== "melee-warning") {
      s.phase = "recover";
      s.timer = 0.6;
    }
    if (s.phase === "windup") {
      e.actionTimer = s.timer;
      this.move(e, pos.x, pos.z, dt, 0);
      if (e.telegraph) {
        e.telegraph.position.copy(pos);
        g.fitGroundMesh(e.telegraph, 0.14);
      }
      if (s.timer <= 0) {
        g.clearTelegraph(e);
        s.phase = "recover";
        s.timer = Math.max(
          0.55,
          ((e.kind === 2 ? 1.55 : 1.1) / (e.mutationAttackRate || 1)) *
            (e.elite ? 0.82 : 1),
        );
        e.action = "melee-recovery";
        e.visualAttack = 0.36;
        if (
          isSwordHit(
            { range, arc },
            p.x - pos.x,
            p.z - pos.z,
            e.aim.x,
            e.aim.z,
            0.25,
          )
        )
          g.takeDamage(
            g.stageStats().enemyDamage *
              e.baseDamageMultiplier *
              e.damageMultiplier *
              (e.kind === 2 ? 1.15 : 1),
            pos,
            `${e.name} 예고 검격`,
            e,
          );
      }
      return true;
    }
    if (s.phase === "recover") {
      e.actionTimer = s.timer;
      this.move(e, pos.x, pos.z, dt, 0);
      if (s.timer <= 0) {
        s.phase = "circle";
        e.action = "chase";
        s.timer = 0.2;
      }
      return true;
    }
    if (e.guardHome && (d > 11 || pos.distanceToSquared(e.guardHome) > 49)) {
      this.move(e, e.guardHome.x, e.guardHome.z, dt);
      return true;
    }
    if (d > 42 && !g.sideAreas.active) {
      const point = g.spawnPosition(20, 27);
      pos.set(point.x, g.groundHeight(point.x, point.z), point.z);
      return true;
    }
    if (d < range + 0.1 && s.timer <= 0 && this.admit()) {
      e.aim.set(dx, 0, dz).normalize();
      if (!e.aim.lengthSq()) e.aim.set(0, 0, 1);
      e.group.rotation.y = Math.atan2(e.aim.x, e.aim.z);
      s.phase = "windup";
      s.timer =
        (e.kind === 2 ? 0.86 : e.kind === 1 ? 0.52 : 0.66) -
        (e.elite ? 0.08 : 0);
      e.action = "melee-warning";
      e.actionTimer = s.timer;
      g.createMeleeTelegraph(e, range, arc);
      return true;
    }
    // A fixed flanking side and a visible recovery opportunity keep approaches varied.
    const side = e.spawnSerial % 2 ? 1 : -1,
      opening = g.actions.exposed() && e.kind === 1,
      flank =
        (d > 7 ? side * 1.5 : side * Math.min(2.2, d * 0.4)) *
        (e.elite && g.parry.active > 0 ? 1.5 : 1),
      desired =
        this.attackers >= this.limit ? range + 1 : opening ? 0 : range - 0.65;
    const nx = dx / Math.max(0.01, d),
      nz = dz / Math.max(0.01, d),
      goalX = p.x - nx * desired - nz * flank,
      goalZ = p.z - nz * desired + nx * flank;
    this.move(e, goalX, goalZ, dt, opening ? 1.12 : 1);
    e.group.rotation.y = Math.atan2(dx, dz);
    e.action = "chase";
    for (let j = e.spawnSerial % 4; j < g.enemies.length; j += 4) {
      const other = g.enemies[j];
      if (other === e || other.hp <= 0) continue;
      const x = pos.x - other.group.position.x,
        z = pos.z - other.group.position.z,
        sq = x * x + z * z;
      if (sq > 0.001 && sq < 1.1) {
        pos.x += (x * dt) / sq;
        pos.z += (z * dt) / sq;
      }
    }
    g.resolvePosition(pos, Math.min(1.2, e.size * 0.4));
    return true;
  }
}
export function chooseBossAction(archetype, distance, last = "") {
  const options = {
    artillery: ["fan-warning", "barrage-warning"],
    plague: ["poison-warning", "fan-warning"],
    brood: ["pulse-warning", "summon-warning"],
    storm: ["nova-warning", "radial-warning"],
    reaper: ["cross-warning", "blink-warning"],
  }[archetype] || ["pulse-warning", "charge-warning"];
  const chosen =
    distance <
    (archetype === "artillery" ? 10 : archetype === "reaper" ? 12 : 7)
      ? options[0]
      : options[1];
  return chosen === last ? options.find((id) => id !== last) : chosen;
}
