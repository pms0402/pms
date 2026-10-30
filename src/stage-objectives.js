import * as THREE from "three";
import { STAGE_DURATION, BOSS_SPAWN_TIME } from "./balance.js";

export const OBJECTIVE_TYPES = Object.freeze({
  survival: {
    name: "성역 생존",
    hint: "보스 출현에 대비하고 생존 목표와 수호자 처치를 마치세요.",
    reward: 0,
  },
  elite: {
    name: "정예 사냥",
    hint: "표식이 있는 정예 2마리를 처치하세요.",
    reward: 8,
  },
  defense: {
    name: "결계 방어",
    hint: "장치에서 교류해 방어 시작 · 습격자의 예고 공격을 저지하세요.",
    reward: 10,
  },
  crossing: {
    name: "균열 돌파",
    hint: "붉은 분출 예고를 피하며 순서대로 표식 3개를 통과하세요.",
    reward: 10,
  },
  seals: {
    name: "봉인 해제",
    hint: "각 수호자를 처치한 뒤 장치에서 교류하세요 · 3개.",
    reward: 9,
  },
  hunt: {
    name: "추적 사냥",
    hint: "표식을 따라 강화 돌격수를 찾아 처치하세요.",
    reward: 9,
  },
  ritual: {
    name: "소환 의식",
    hint: "장치에서 교류 후 주변 12m 안에서 적 5마리를 처치하세요.",
    reward: 8,
  },
});
const ids = Object.keys(OBJECTIVE_TYPES).filter((id) => id !== "survival");
export function objectiveFor(stage, region, runId = "") {
  if (stage === 1 || stage === 10) return "survival";
  let hash = 0;
  for (const c of `${runId}:${region}`)
    hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
  return ids[(hash + stage - 2) % ids.length];
}
/** One floor owns at most three landmarks and three live objective raiders. */
export class StageObjectives {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.geometry = {
      ring: new THREE.RingGeometry(1.5, 1.7, 32),
      crystal: new THREE.OctahedronGeometry(0.65, 0),
    };
    this.materials = {
      gold: new THREE.MeshBasicMaterial({
        color: "#d9c18c",
        transparent: true,
        opacity: 0.72,
        side: THREE.DoubleSide,
      }),
      danger: new THREE.MeshBasicMaterial({
        color: "#ff746b",
        transparent: true,
        opacity: 0.38,
        side: THREE.DoubleSide,
      }),
      crystal: new THREE.MeshStandardMaterial({
        color: "#91cbd4",
        emissive: "#2c5060",
        roughness: 0.4,
      }),
    };
    this.reset();
  }
  reset() {
    this.root.clear();
    this.points = [];
    this.targets = new Set();
    this.raiders = new Set();
    this.goal = null;
    this.spawnClock = 0;
  }
  begin(
    stage,
    region,
    type = objectiveFor(stage, region, this.game._state.runId),
  ) {
    this.reset();
    if (!OBJECTIVE_TYPES[type]) return false;
    const g = this.game;
    this.goal = {
      type,
      stage,
      complete: false,
      rewarded: false,
      progress: 0,
      target:
        type === "elite"
          ? 2
          : ["seals", "crossing"].includes(type)
            ? 3
            : type === "ritual"
              ? 5
              : type === "defense"
                ? 28
                : 1,
      armed: false,
      broken: false,
      defended: 0,
      hp: 0,
      maxHp: 0,
    };
    if (type === "survival") return true;
    const count = ["seals", "crossing"].includes(type) ? 3 : 1;
    for (let i = 0; i < count; i++) {
      const pos = g.player.position
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(i * 2.3 + 0.7) * (12 + i * 7),
            0,
            Math.cos(i * 2.3 + 0.7) * (12 + i * 7),
          ),
        );
      g.resolvePosition(pos, 1.5);
      pos.y = g.groundHeight(pos.x, pos.z);
      const group = new THREE.Group(),
        ring = new THREE.Mesh(this.geometry.ring, this.materials.gold),
        crystal = new THREE.Mesh(this.geometry.crystal, this.materials.crystal);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      crystal.position.y = 1.5;
      group.add(ring, crystal);
      group.position.copy(pos);
      this.root.add(group);
      this.points.push({
        id: i,
        position: pos,
        group,
        ring,
        crystal,
        done: false,
        guard: null,
      });
    }
    if (type === "defense") {
      this.goal.maxHp = g.stageStats().enemyDamage * 12;
      this.goal.hp = this.goal.maxHp;
    }
    return true;
  }
  spawn(kind, point, options = {}) {
    const g = this.game;
    if (g.enemies.length >= 160) return null;
    const pos = point.clone();
    g.resolvePosition(pos, 1);
    const e = g.spawnEnemy(pos.x, pos.z, kind, options);
    if (e) e.objectiveEnemy = true;
    return e;
  }
  finish() {
    const a = this.goal,
      g = this.game;
    if (!a || a.complete) return;
    a.complete = true;
    for (const p of this.points) {
      p.ring.material = this.materials.gold;
      p.ring.scale.setScalar(1);
    }
    if (!a.rewarded && OBJECTIVE_TYPES[a.type].reward) {
      a.rewarded = true;
      g.collectPickup(
        {
          type: "gold",
          value: g.stageStats().coinValue * OBJECTIVE_TYPES[a.type].reward,
          mesh: null,
        },
        false,
      );
      g.runReport.objectives ||= [];
      g.runReport.objectives.push({
        stage: a.stage,
        type: a.type,
        time: g._state.stageTime,
      });
      g.callbacks.onLoot?.(
        `${OBJECTIVE_TYPES[a.type].name} 완료 · 골드 보상 · 수호자 소환 준비`,
      );
    }
  }
  canSummon() {
    return !this.goal || this.goal.type === "survival"
      ? this.game._state.stageTime >= BOSS_SPAWN_TIME
      : this.goal.complete && this.game._state.stageTime >= 20;
  }
  canAdvance() {
    return !this.goal || this.goal.type === "survival"
      ? this.game._state.stageTime >= STAGE_DURATION
      : !!this.goal.complete;
  }
  targetFor(enemy) {
    return this.goal?.type === "defense" &&
      this.goal.armed &&
      !this.goal.complete &&
      this.raiders.has(enemy)
      ? this.points[0].position
      : null;
  }
  damageDevice(enemy, amount) {
    const a = this.goal;
    if (!this.targetFor(enemy)) return false;
    a.hp = Math.max(0, a.hp - amount * this.game.getThreat().enemyDamage);
    this.game.combatArt.hit(this.points[0].position, "sword");
    if (!a.hp) {
      a.armed = false;
      a.broken = true;
      a.defended = 0;
      this.game.callbacks.onLoot?.(
        "결계 파괴 · 장치에서 교류해 재시도할 수 있습니다",
      );
    }
    return true;
  }
  onKill(enemy, position) {
    const a = this.goal,
      g = this.game;
    if (!a || a.complete || g.sideAreas.active || g.training?.active) return;
    this.raiders.delete(enemy);
    if (this.targets.delete(enemy)) {
      a.progress++;
      if (a.progress >= a.target) this.finish();
    }
    if (
      a.type === "ritual" &&
      a.armed &&
      !enemy.minion &&
      enemy.kind !== 4 &&
      position.distanceTo(this.points[0].position) <= 12
    ) {
      a.progress++;
      if (a.progress >= a.target) this.finish();
    }
  }
  interactionTarget() {
    const a = this.goal,
      g = this.game;
    if (
      !a ||
      a.complete ||
      a.type === "survival" ||
      g.sideAreas.active ||
      g.training?.active
    )
      return null;
    for (const p of this.points) {
      if (
        p.done ||
        p.position.distanceTo(g.player.position) > 3 ||
        p.guard?.hp > 0
      )
        continue;
      if (a.type === "seals" && !p.guard) continue;
      if (a.type === "seals")
        return {
          kind: "objective",
          id: p.id,
          name: "봉인 장치",
          verb: "활성화",
        };
      if (["ritual", "defense"].includes(a.type) && !a.armed)
        return {
          kind: "objective",
          id: p.id,
          name: OBJECTIVE_TYPES[a.type].name,
          verb: a.broken ? "장치 복구 · 재시도" : "시작하기",
        };
    }
    return null;
  }
  interact(id) {
    const target = this.interactionTarget();
    if (!target || target.id !== id) return false;
    const a = this.goal,
      p = this.points[id];
    if (a.type === "seals") {
      p.done = true;
      p.crystal.visible = false;
      a.progress++;
      if (a.progress >= 3) this.finish();
    } else {
      a.armed = true;
      this.spawnClock = 0;
      a.broken = false;
      a.hp = a.maxHp;
    }
    this.game.emit();
    return true;
  }
  update(dt) {
    const g = this.game,
      a = this.goal;
    if (!a || a.complete || g.sideAreas.active || g.training?.active) return;
    if (a.type === "survival") {
      if (g._state.stageTime >= STAGE_DURATION) a.complete = true;
      return;
    }
    this.spawnClock -= dt;
    for (const p of this.points) p.crystal.rotation.y += dt * 0.6;
    if (this.spawnClock <= 0) {
      this.spawnClock = 1;
      if (
        ["elite", "hunt"].includes(a.type) &&
        a.progress + this.targets.size < a.target
      ) {
        const e = this.spawn(
          a.type === "hunt" ? 5 : (a.progress + this.targets.size) % 2 ? 1 : 2,
          this.points[0].position,
          { elite: true },
        );
        if (e) {
          e.speed *= a.type === "hunt" ? 1.15 : 1;
          this.targets.add(e);
        }
      }
      if (a.type === "seals")
        for (const p of this.points)
          if (!p.done && !p.guard)
            p.guard = this.spawn(2, p.position, { guard: true });
      if (a.type === "defense" && a.armed) {
        for (const e of this.raiders) if (e.hp <= 0) this.raiders.delete(e);
        if (this.raiders.size < 3) {
          const p = this.points[0].position
              .clone()
              .add(
                new THREE.Vector3(
                  Math.sin(g._state.elapsed) * 10,
                  0,
                  Math.cos(g._state.elapsed) * 10,
                ),
              ),
            e = this.spawn(0, p, { minion: true, noMutations: true });
          if (e) this.raiders.add(e);
        }
        this.spawnClock = 5;
      }
    }
    if (["elite", "hunt"].includes(a.type)) {
      const e = [...this.targets].find((e) => e.hp > 0);
      if (e) this.points[0].group.position.copy(e.group.position);
    }
    if (a.type === "defense" && a.armed) {
      a.defended += dt;
      a.progress = a.defended;
      a.target = 28;
      if (a.defended >= 28) this.finish();
    }
    if (a.type === "crossing") {
      const p = this.points[a.progress];
      if (!p) return;
      const clock = g._state.stageTime % 3.6;
      p.ring.material = this.materials.danger;
      p.ring.scale.setScalar(2);
      p.ring.visible = clock < 2.3;
      if (
        clock >= 1.3 &&
        clock < 2.3 &&
        g.player.position.distanceTo(p.position) < 3.2
      )
        g.takeDamage(
          g.stageStats().enemyDamage * 0.65,
          p.position,
          "균열 돌파 · 지면 분출",
          null,
          { unblockable: true },
        );
      if (g.player.position.distanceTo(p.position) < 1.8) {
        p.done = true;
        p.crystal.visible = false;
        p.ring.visible = false;
        a.progress++;
        if (a.progress >= 3) this.finish();
      }
    }
  }
  state() {
    const a = this.goal,
      g = this.game;
    if (!a) return null;
    const p = this.points.find((p) => !p.done),
      target = [...this.targets].find((e) => e.hp > 0),
      distance = p
        ? g.player.position.distanceTo(target?.group.position || p.position)
        : 0;
    return {
      type: a.type,
      name: OBJECTIVE_TYPES[a.type].name,
      hint: OBJECTIVE_TYPES[a.type].hint,
      complete: a.complete,
      progress: a.type === "survival" ? g._state.stageTime : a.progress,
      target: a.type === "survival" ? STAGE_DURATION : a.target,
      armed: a.armed,
      broken: a.broken,
      hp: a.hp,
      maxHp: a.maxHp,
      distance,
      reward: OBJECTIVE_TYPES[a.type].reward,
      canSummon: this.canSummon(),
    };
  }
  dispose() {
    this.reset();
    this.root.removeFromParent();
    Object.values(this.geometry).forEach((g) => g.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
