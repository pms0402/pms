import * as THREE from "three";
import {keyLabel} from "./control-bindings.js";
import { MutationSystem } from "./mutations.js";
import { MagicSystem } from "./magic.js";
import { BossSystem } from "./bosses.js";
import { BossPhases } from "./boss-phases.js";
import { SceneContext, clearCosmetics } from "./scene-context.js";
import { HiddenBossSystem } from "./hidden-bosses.js";
import { rollEquipment } from "./equipment.js";
export const ROOM_TYPES = Object.freeze({
  treasure: "보물의 방",
  trial: "시련의 방",
  curse: "저주의 방",
  ancient: "고대의 방",
  dungeon: "매몰된 비밀 던전",
});
const ARRAY_KEYS = [
  "enemies",
  "projectiles",
  "enemyProjectiles",
  "pickups",
  "chests",
];
const FIELD_KEYS = [
  "boss",
  "bossSpawned",
  "bossDefeated",
  "spawnTimer",
  "nextChestTime",
  "nextEliteTime",
  "nextGoldenTime",
  "nextAltarTime",
  "stageChestCount",
  "altar",
  "attackTimer",
  "bossSystem",
  "bossPhases",
  "magic",
  "mutationSystem",
];
export class SideAreaSystem {
  constructor(game) {
    this.game = game;
    this.context = new SceneContext(game);
    this.hidden = new HiddenBossSystem(game);
    this.active = null;
    this.snapshot = null;
    this.portal = null;
    this.hiddenUsed = new Set();
    this.geometry = {
      floor: new THREE.CylinderGeometry(13, 13, 0.3, 64),
      rim: new THREE.TorusGeometry(12, 0.25, 8, 64),
      pillar: new THREE.CylinderGeometry(0.35, 0.45, 3, 12),
      gate: new THREE.TorusGeometry(1, 0.1, 8, 40),
      box: new THREE.BoxGeometry(1.5, 0.8, 1),
      orb: new THREE.OctahedronGeometry(0.4, 0),
    };
    this.materials = {
      stone: new THREE.MeshStandardMaterial({
        color: "#777d85",
        map: game.presentation.stoneMap,
        roughness: 0.85,
      }),
      glow: new THREE.MeshBasicMaterial({ color: "#a3d5ed" }),
      gold: new THREE.MeshStandardMaterial({
        color: "#d7b268",
        metalness: 0.6,
        roughness: 0.4,
      }),
    };
  }
  spawnPortal() {
    const g = this.game;
    if (this.portal || this.active) return false;
    const p = g.spawnPosition(7, 11),
      group = new THREE.Group();
    group.position.set(p.x, g.groundHeight(p.x, p.z) + 1.2, p.z);
    group.add(new THREE.Mesh(this.geometry.gate, this.materials.glow));
    g.scene.add(group);
    const options = ["ancient", "treasure", "trial", "curse", "dungeon"];
    const type =
      g.regionId === "void"
        ? "dungeon"
        : options[
            Math.max(0, Math.floor(g._state.stage / 2) - 1) % options.length
          ];
    this.portal = { group, type, used: false };
    g.callbacks.onLoot?.(`희미한 균열 발견 · 근처에서 ${keyLabel(g.bindings.interact)} / 비밀 입구`);
    return true;
  }
  offers() {
    const choices = [
      {
        id: this.portal.type,
        title: ROOM_TYPES[this.portal.type],
        description:
          this.portal.type === "ancient"
            ? "고대 기록을 발견하세요. 적을 처치하지 않고 돌아갈 수 있습니다."
            : this.portal.type === "treasure"
              ? "특별 상자에서 희귀 이상 장비와 추가 골드를 선택합니다."
              : "제한된 공간의 시련입니다. 보상 없이 언제든 복귀할 수 있습니다.",
      },
    ];
    if (
      this.game.story.progress.records.includes("royalOath") &&
      this.portal.type !== "dungeon"
    )
      choices.push({
        id: "dungeon",
        title: ROOM_TYPES.dungeon,
        description: "강화 병력과 미니보스 · 영웅 장비와 매몰된 진실 기록",
      });
    for (const boss of this.game.story.state().bosses)
      if (boss.unlocked && !this.hiddenUsed.has(boss.id))
        choices.push({
          id: boss.id,
          title: boss.name,
          description: `선택형 히든 보스 · ${boss.hint}`,
        });
    return choices;
  }
  interact() {
    const g = this.game;
    if (g._state.phase !== "playing") return false;
    if (this.active) {
      const p = g.player.position;
      if (Math.hypot(p.x, p.z - 10) < 3.2) return this.leave();
      if (Math.hypot(p.x, p.z + 3) < 3.2) {
        if (this.active.type === "ancient") {
          g.story.find("royalOath");
          this.active.claimed = true;
          g.callbacks.onLoot?.(`왕의 맹세를 읽었습니다 · 입구에서 ${keyLabel(g.bindings.interact)}로 복귀`);
          return true;
        }
        if (
          this.active.type === "curse" &&
          !this.active.accepted &&
          !this.active.claimed
        ) {
          g._state.phase = "room-choice";
          g.callbacks.onRoomChoice?.();
          g.emit();
          return true;
        }
        if (this.active.complete && !this.active.claimed) return this.claim();
      }
      return false;
    }
    if (
      !this.portal ||
      this.portal.used ||
      this.portal.group.position.distanceTo(g.player.position) > 3.5
    )
      return false;
    g._state.phase = "portal";
    g.keys.clear();
    g.touchMove = { x: 0, y: 0 };
    g.callbacks.onPortal?.(this.offers());
    g.emit();
    return true;
  }
  choose(id) {
    const g = this.game;
    if (g._state.phase !== "portal") return false;
    if (id === "skip") {
      g._state.phase = "playing";
      g.emit();
      return true;
    }
    if (!this.offers().some((o) => o.id === id)) return false;
    if (
      g.enemies.length > 136 ||
      g.enemyProjectiles.length > 56 ||
      g.magic.projectiles.length > 24
    ) {
      g.callbacks.onLoot?.(
        "균열이 불안정합니다 · 주변 적과 탄막을 정리한 뒤 입장하세요",
      );
      return false;
    }
    g._state.phase = "playing";
    return this.enter(id);
  }
  enter(type) {
    const g = this.game;
    if (
      this.active ||
      g._state.phase !== "playing" ||
      g.enemies.length > 136 ||
      g.enemyProjectiles.length > 56 ||
      g.magic.projectiles.length > 24 ||
      (!Object.hasOwn(ROOM_TYPES, type) && !g.story.canBoss(type))
    )
      return false;
    clearCosmetics(g);
    const s = {
      arrays: {},
      fields: {},
      position: g.player.position.clone(),
      rotation: g.player.rotation.y,
      stageTime: g._state.stageTime,
      elapsed: g._state.elapsed,
      equipmentDrops: g.equipment.drops.splice(0),
      slow: g.regionSystem.slowRemaining,
      poison: g.regionSystem.poisonRemaining,
    };
    for (const key of ARRAY_KEYS) s.arrays[key] = g[key].splice(0);
    for (const key of FIELD_KEYS) s.fields[key] = g[key];
    this.snapshot = s;
    g.activeEnemies.clear();
    g.spatialBuckets.clear();
    g.spatialDirty = true;
    if (this.portal) {
      this.portal.used = true;
      this.portal.group.visible = false;
    }
    this.context.hide();
    this.active = {
      type,
      targets: new Set(),
      complete: ["treasure", "ancient"].includes(type),
      claimed: false,
      accepted: false,
    };
    this.context.mood(
      type === "treasure"
        ? ["#514736", "#211c24", "#d9cda7", "#d7b268"]
        : type === "ancient"
          ? ["#394d4c", "#10292d", "#b8d9dc", "#93dad4"]
          : ["#453548", "#20142d", "#d5c5e8", "#c89adc"],
    );
    g.mutationSystem = new MutationSystem(g);
    g.magic = new MagicSystem(g);g.magic.cooldowns={...s.fields.magic.cooldowns};
    g.magic.unlockedSynergies = new Set(s.fields.magic.unlockedSynergies);
    g.bossSystem = new BossSystem(g);
    g.bossPhases = new BossPhases(g);
    g.boss = null;
    g.bossSpawned = false;
    g.bossDefeated = false;
    g.altar = null;
    g.regionSystem.slowRemaining = g.regionSystem.poisonRemaining = 0;
    g.player.position.set(0, 0, 9);
    g.player.rotation.y = Math.PI;
    g.classes.pet.position.copy(g.player.position);
    g.dashTime = 0;
    g.invulnerable = 1;
    this.buildRoom();
    if (["trial", "dungeon"].includes(type))
      this.spawnWave(
        type === "dungeon" ? 6 : 4,
        type === "dungeon" ? 1.35 : 1.2,
      );
    if (type === "dungeon") {
      const boss = g.spawnBoss();
      if (boss) {
        boss.hp *= 0.35;
        boss.maxHp *= 0.35;
        boss.name = "매몰된 감시자";
        this.active.targets.add(boss);
      }
    }
    if (["king", "observer", "primordial"].includes(type)) {
      this.hiddenUsed.add(type);
      const boss = this.hidden.spawn(type);
      if(boss)g.story.encounterHidden(type);
      if (boss) this.active.targets.add(boss);
    }
    g.callbacks.onLoot?.(
      `${ROOM_TYPES[type] || g.boss?.name} · 위쪽 제단과 아래쪽 복귀 문 · 원래 층 시간은 정지`,
    );
    g.emit();
    return true;
  }
  buildRoom() {
    const g = this.game,
      root = new THREE.Group();
    this.room = root;
    const mesh = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(this.geometry[geo], this.materials[mat]);
      m.position.set(x, y, z);
      m.receiveShadow = true;
      m.castShadow = true;
      root.add(m);
      return m;
    };
    mesh("floor", "stone", 0, -0.15, 0);
    const rim = mesh("rim", "stone", 0, 0.1, 0);
    rim.rotation.x = Math.PI / 2;
    for (const x of [-9, 9])
      for (const z of [-6, 6]) mesh("pillar", "stone", x, 1.5, z);
    mesh("box", this.active.type === "treasure" ? "gold" : "stone", 0, 0.5, -3);
    mesh("orb", "glow", 0, 1.6, -3);
    mesh("gate", "gold", 0, 1.2, 10);
    g.scene.add(root);
  }
  spawnWave(count, factor) {
    const g = this.game;
    for (
      let i = 0;
      i < count && g.enemies.length + this.snapshot.arrays.enemies.length < 160;
      i++
    ) {
      const a = (i / count) * Math.PI * 2,
        e = g.spawnEnemy(Math.sin(a) * 7, Math.cos(a) * 7, [2, 5, 3][i % 3], {
          elite: true,
          noMutations: true,
        });
      if (e) {
        e.hp *= factor;
        e.maxHp *= factor;
        e.damageMultiplier *= factor;
        this.active.targets.add(e);
      }
    }
  }
  chooseCurse(accept) {
    const g = this.game;
    if (
      g._state.phase !== "room-choice" ||
      this.active?.type !== "curse" ||
      this.active.accepted
    )
      return false;
    g._state.phase = "playing";
    if (!accept) {
      this.active.claimed = true;
      g.emit();
      return true;
    }
    this.active.accepted = true;
    this.spawnWave(3, 1.3);
    this.active.complete = false;
    g.callbacks.onLoot?.(
      "저주의 시련 수락 · 강화 정예 3마리 · 처치 후 제단에서 영웅 보상",
    );
    g.emit();
    return true;
  }
  onKill(enemy) {
    if (!this.active) {
      if (enemy.elite && !this.portal) this.spawnPortal();
      return;
    }
    if (!this.active.targets.delete(enemy)) return;
    if (enemy.hiddenBoss) this.game.story.defeat(enemy.hiddenBoss);
    if (this.active.targets.size === 0) {
      this.active.complete = true;
      if (this.active.type === "dungeon") this.game.story.find("buriedTruth");
      this.game.callbacks.onLoot?.(
        `비밀 공간 시련 완료 · 중앙 제단에서 ${keyLabel(this.game.bindings.interact)}로 보상`,
      );
    }
  }
  claim() {
    const g = this.game,
      a = this.active;
    if (!a || a.claimed || !a.complete) return false;
    a.claimed = true;
    const grade = a.type === "treasure" ? 1 : a.type === "primordial" ? 3 : 2;
    const rewardSet = {
      king: "abyss",
      observer: "stalker",
      primordial: "storm",
    }[a.type];
    const rewardName = {
      king: "왕의 유산",
      observer: "관측자의 유산",
      primordial: "태초의 유산",
      dungeon: "매몰된 유산",
    }[a.type];
    g.equipment.rewardQueue.push(
      Array.from({ length: 3 }, () => {
        const item = rollEquipment(
          g._state.stage,
          g.regionId,
          Math.random,
          grade,
        );
        if (rewardSet) item.setId = rewardSet;
        if (rewardName) item.title = `${rewardName} · ${item.title}`;
        return item;
      }),
    );
    g.collectPickup(
      {
        type: "gold",
        value: g.stageStats().coinValue * (a.type === "treasure" ? 20 : 35),
        mesh: null,
      },
      false,
    );
    g.equipment.nextReward();
    return true;
  }
  resolve(p, r = 0.65) {
    const bound = 12 - r,
      d = Math.hypot(p.x, p.z);
    if (d > bound) {
      p.x *= bound / d;
      p.z *= bound / d;
    }
    for (const x of [-9, 9])
      for (const z of [-6, 6]) {
        const dx = p.x - x,
          dz = p.z - z,
          l = Math.hypot(dx, dz),
          min = r + 0.4;
        if (l > 0 && l < min) {
          p.x = x + (dx / l) * min;
          p.z = z + (dz / l) * min;
        }
      }
    p.y = 0;
    return p;
  }
  leave({ silent = false } = {}) {
    if (!this.active) return false;
    const g = this.game,
      s = this.snapshot,
      phase = g._state.phase,
      spent = g._state.elapsed - s.elapsed;
    g.enemyRenderer.reset();
    for (const e of [...g.enemies]) g.releaseEnemy(e);
    g.activeEnemies.clear();
    g.enemies.length = 0;
    g.clearEnemyProjectiles();
    for (const p of g.projectiles) {
      g.removeGroup(p.mesh);
      p.mesh.geometry.dispose();
    }
    g.projectiles.length = 0;
    for (const p of g.pickups) g.removeGroup(p.mesh);
    g.pickups.length = 0;
    for (const c of g.chests) g.removeGroup(c.group);
    g.chests.length = 0;
    clearCosmetics(g);
    for (const drop of g.equipment.drops) drop.mesh.removeFromParent();
    g.equipment.drops.length = 0;
    g.equipment.drops.push(...s.equipmentDrops);
    g.mutationSystem.dispose();
    const roomCooldowns={...g.magic.cooldowns};g.magic.dispose();
    g.bossSystem.dispose();
    g.bossPhases.dispose();
    this.hidden.clear();
    this.room.removeFromParent();
    this.room = null;
    for (const key of FIELD_KEYS) g[key] = s.fields[key];
    for(const id of Object.keys(roomCooldowns))g.magic.cooldowns[id]=Math.max(g.magic.cooldowns[id],roomCooldowns[id]);
    for (const key of ARRAY_KEYS) g[key].push(...s.arrays[key]);
    for (const e of g.enemies) g.activeEnemies.add(e);
    g.player.position.copy(s.position);
    g.player.rotation.y = s.rotation;
    g._state.stageTime = s.stageTime;
    if (g.exploration.trial) g.exploration.trial.until += spent;
    if (g.exploration.buffUntil > s.elapsed) g.exploration.buffUntil += spent;
    g.regionSystem.slowRemaining = s.slow;
    g.regionSystem.poisonRemaining = s.poison;
    this.context.restore();
    this.active = null;
    this.snapshot = null;
    g.spatialBuckets.clear();
    g.spatialDirty = true;
    g.classes.pet.position.copy(g.player.position);
    g._state.phase = silent ? phase : "playing";
    g.dashTime = 0;
    g.invulnerable = 1;
    g.lastTime = performance.now();
    if (!silent) {
      g.callbacks.onLoot?.("원래 전장으로 복귀 · 진행 상태와 보스 체력 유지");
      g.emit();
    }
    return true;
  }
  update(dt) {
    if (this.active) return;
    if (
      !this.portal &&
      this.game._state.stageTime >= 40 &&
      (this.game._state.stage % 2 === 0 || this.game.regionId === "void")
    )
      this.spawnPortal();
    if (this.portal && !this.portal.used)
      this.portal.group.rotation.y += dt * 0.3;
  }
  clearFloor() {
    if (this.active) this.leave({ silent: true });
    this.portal?.group.removeFromParent();
    this.portal = null;
  }
  reset() {
    this.clearFloor();
    this.hiddenUsed.clear();
  }
  state() {
    return {
      active: this.active
        ? {
            type: this.active.type,
            title: ROOM_TYPES[this.active.type] || this.game.boss?.name,
            complete: this.active.complete,
            claimed: this.active.claimed,
            remaining: this.active.targets.size,
            returnDistance: Math.hypot(
              this.game.player.position.x,
              this.game.player.position.z - 10,
            ),
            altarDistance: Math.hypot(
              this.game.player.position.x,
              this.game.player.position.z + 3,
            ),
          }
        : null,
      portal: this.portal
        ? {
            type: this.portal.type,
            used: this.portal.used,
            distance: this.portal.group.position.distanceTo(
              this.game.player.position,
            ),
          }
        : null,
      reserved: this.snapshot?.arrays.enemies.length || 0,
    };
  }
  dispose() {
    this.reset();
    this.hidden.dispose();
    Object.values(this.geometry).forEach((x) => x.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
