import * as THREE from "three";
import { SceneContext, clearCosmetics } from "./scene-context.js";
import { ActionCombat } from "./action-combat.js";
import { MagicSystem } from "./magic.js";
import { ParrySystem } from "./parry.js";
import { BossSystem } from "./bosses.js";
import { BossPhases } from "./boss-phases.js";
import { MutationSystem } from "./mutations.js";
import { RegionSystem } from "./region-system.js";
import { EquipmentSystem } from "./equipment.js";
import { ClassSystem } from "./classes.js";
import { SetSystem } from "./sets.js";
import { RunAnalytics } from "./analytics.js";
import { CombatLinks } from "./combat-links.js";
import { HiddenBossSystem } from "./hidden-bosses.js";
import { HIDDEN_BOSSES } from "./story.js";
import { getBossDefinition } from "./encounters.js";
import { createActorMotion } from "./motion.js";

export const TRAINING_MODES = Object.freeze({
  combo: "기본 콤보",
  heavy: "강공격·차징",
  spells: "마법 범위·연계",
  dash: "대시 회피",
  parry: "실전 패링",
  monster: "몬스터 패턴",
  boss: "만난 보스",
});
const OWNERS = [
  "magic",
  "parry",
  "bossSystem",
  "bossPhases",
  "mutationSystem",
  "regionSystem",
  "equipment",
  "classes",
  "setSystem",
];
const FIELDS = [
  ...OWNERS,
  "actions",
  "links",
  "stats",
  "_state",
  "analytics",
  "runReport",
  "mode",
  "runRisk",
  "regionId",
  "routeId",
  "activeCurses",
  "boss",
  "bossSpawned",
  "bossDefeated",
  "playerMotion",
  "dashTime",
  "dashCooldown",
  "invulnerable",
  "equipmentDashUntil",
  "manualDashUntil",
  "attackAnim",
  "counterAnim",
  "playerCastTime",
  "comboTimer",
  "spawnTimer",
  "nextChestTime",
  "nextEliteTime",
  "nextGoldenTime",
  "nextAltarTime",
  "stageChestCount",
  "pendingChestRewards",
  "pendingRelicSources",
  "pendingBossRewards",
  "pendingSkill",
  "eliteKills",
  "altar",
];
const ARRAYS = [
  "enemies",
  "projectiles",
  "enemyProjectiles",
  "pickups",
  "chests",
];

/** A reversible simulation. No adventure owner or reward callback is reused. */
export class TrainingSystem {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.context = new SceneContext(game);
    this.root = new THREE.Group();
    this.root.visible = false;
    game.scene.add(this.root);
    this.floorGeometry = new THREE.CylinderGeometry(18, 18, 0.4, 64);
    this.material = new THREE.MeshStandardMaterial({
      color: "#6a7478",
      map: game.presentation.stoneMap,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(this.floorGeometry, this.material);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    this.root.add(floor);
    this.colliders = [];
    this.cameraSolids = [];
  }
  seenBosses() {
    const p = this.game.story.progress;
    return [
      ...new Set([...(p.encounteredBossStages || []), ...p.normalBossStages]),
    ]
      .sort((a, b) => a - b)
      .map((stage) => ({ stage, name: getBossDefinition(stage).name }))
      .concat(
        HIDDEN_BOSSES.filter((b) =>
          (p.encounteredHidden || p.defeated).includes(b.id),
        ).map((b) => ({ hidden: b.id, name: b.name })),
      );
  }
  start(mode = "combo", options = {}) {
    const g = this.game;
    if (this.active) this.leave({ silent: true });
    if (!g.camp.active || g._state.phase !== "camp" || !TRAINING_MODES[mode])
      return false;
    const stage = mode === "boss" ? Math.floor(Number(options.stage) || 1) : 1;
    if (
      mode === "boss" &&
      !this.seenBosses().some((b) =>
        options.hidden
          ? b.hidden === options.hidden
          : !b.hidden && b.stage === stage,
      )
    )
      return false;
    clearCosmetics(g);
    const snapshot = {
      fields: Object.fromEntries(FIELDS.map((k) => [k, g[k]])),
      arrays: {},
      position: g.player.position.clone(),
      rotation: g.player.rotation.y,
      campSuspended: g.camp.suspended,
      visible: new Map(),
    };
    for (const key of ARRAYS) snapshot.arrays[key] = g[key].splice(0);
    this.context.hide();
    for (const mesh of [
      g.classes.pet,
      g.classes.accessory,
      g.setSystem.mesh,
      g.parry.mesh,
      g.parry.feedback.root,
    ]) {
      if (mesh) {
        snapshot.visible.set(mesh, mesh.visible);
        mesh.visible = false;
      }
    }
    this.snapshot = snapshot;
    this.active = true;
    this.mode = mode;
    this.options = { ...options, stage };
    this.hits = this.damage = this.received = this.downs = this.kills = 0;
    this.lastDamage = 0;
    this.respawnAt = 0;
    g.camp.active = false;
    g.camp.suspended = false;
    g.activeEnemies.clear();
    g.spatialBuckets.clear();
    g.spatialDirty = true;
    g.stats = structuredClone(g.stats);
    g._state = g.freshState("playing");
    g._state.stage = stage;
    g._state.runId = "training";
    g._state.xpNeeded = 1e18;
    g.mode = "normal";
    g.runRisk = "none";
    g.routeId = "standard";
    g.regionId = "sanctum";
    g.activeCurses = [];
    if (["voidblade", "greatsword", "tempest"].includes(options.weapon))
      g.stats.weaponId = options.weapon;
    const rank = [1, 3, 5].includes(+options.rank) ? +options.rank : 1;
    g.stats.spells = {
      fireball: rank,
      frost: rank,
      lightning: rank,
      orbit: rank,
    };
    g.stats.skillSlots = ["fireball", "frost", "lightning"];
    g.stats.evolutions =
      rank === 5
        ? { fireball: true, frost: true, lightning: true, orbit: true }
        : {};
    g.analytics = new RunAnalytics();
    g.runReport = g.freshRunReport();
    g.actions = new ActionCombat(g);
    g.links = new CombatLinks(g);
    g.equipment = new EquipmentSystem(g);
    g.equipment.bag = structuredClone(snapshot.fields.equipment.bag);
    g.equipment.slots = { ...snapshot.fields.equipment.slots };
    g.parry = new ParrySystem(g);
    g.classes = new ClassSystem(g);
    g.setSystem = new SetSystem(g);
    g.magic = new MagicSystem(g);
    g.bossSystem = new BossSystem(g);
    g.bossPhases = new BossPhases(g);
    g.mutationSystem = new MutationSystem(g);
    g.regionSystem = new RegionSystem(g, { surface: false });
    this.hidden = new HiddenBossSystem(g);
    g.boss = null;
    g.bossSpawned = g.bossDefeated = false;
    g.altar = null;
    g.pendingChestRewards = [];
    g.pendingRelicSources = [];
    g.pendingBossRewards = [];
    g.pendingSkill = null;
    g.dashTime =
      g.dashCooldown =
      g.invulnerable =
      g.attackAnim =
      g.counterAnim =
      g.playerCastTime =
      g.comboTimer =
        0;
    g.spawnTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e9;
    g.stageChestCount = g.eliteKills = 0;
    g.player.position.set(0, 0, 0);
    g.player.rotation.y = 0;
    g.playerMotion = createActorMotion(g.player);
    g.applyLoadoutAppearance();
    g._state.hp = g.combatStats.maxHp;
    g.keys.clear();
    g.touchMove = { x: 0, y: 0 };
    g.view.reset();
    this.root.visible = true;
    this.context.mood(["#4b5559", "#202b35", "#c4dce2", "#ddc890"]);
    this.spawn();
    g.emit();
    return true;
  }
  spawn() {
    const g = this.game;
    this.respawnAt = 0;
    if (this.mode === "boss") {
      if (this.options.hidden) this.hidden.spawn(this.options.hidden);
      else g.spawnBoss();
      return;
    }
    const kinds = {
        dash: 5,
        parry: 0,
        monster: Math.max(0, Math.min(9, +this.options.kind || 0)),
      },
      kind = kinds[this.mode] ?? (this.mode === "heavy" ? 2 : 0);
    const positions =
      this.mode === "spells"
        ? [
            [-3, 5],
            [0, 8],
            [3, 11],
          ]
        : [[0, ["dash", "monster"].includes(this.mode) ? 11 : 3]];
    for (const [x, z] of positions) {
      const e = g.spawnEnemy(x, z, kind === 4 ? 0 : kind, {
        noMutations: true,
      });
      if (!e) continue;
      if (["combo", "heavy", "spells"].includes(this.mode)) {
        e.trainingDummy = true;
        e.hp = e.maxHp = Math.min(
          1e15,
          Math.max(1e6, g.combatStats.damage * 1e5),
        );
        e.speed = 0;
        e.tactics = { phase: "circle", timer: 1e9, angle: 0 };
        e.shootTimer = e.actionTimer = 1e9;
      }
    }
  }
  update() {
    if (!this.active) return;
    const g = this.game;
    if (this.respawnAt && g._state.elapsed >= this.respawnAt) this.spawn();
  }
  hit(amount) {
    this.hits++;
    this.damage += amount;
    this.lastDamage = amount;
  }
  onKill(enemy) {
    const g = this.game;
    const split = enemy.kind === 7 && !enemy.minion && !enemy.splitChild;
    const position = enemy.group.position.clone();
    this.kills++;
    g.analytics.kill(enemy, g._state.stage);
    g._state.kills++;
    g.activeEnemies.delete(enemy);
    const i = g.enemies.indexOf(enemy);
    if (i >= 0) g.enemies.splice(i, 1);
    g.releaseEnemy(enemy);
    g.spatialDirty = true;
    // Practice the real death pattern too, with the same one-generation limit.
    if (split)
      for (const side of [-1, 1])
        if (g.enemies.length < 8)
          g.spawnEnemy(position.x + side * 0.7, position.z, 1, {
            minion: true,
            splitChild: true,
            noMutations: true,
          });
    if (enemy.kind === 4) {
      g.bossSystem.clear();
      g.bossPhases.clear();
      g.boss = null;
      g.bossSpawned = false;
    }
    if (!g.enemies.length) this.respawnAt = g._state.elapsed + 1.2;
  }
  recover() {
    this.downs++;
    const g = this.game;
    g._state.hp = g.combatStats.maxHp;
    g.player.position.set(0, 0, 0);
    g.invulnerable = 1.5;
    g.actions.cancel();
    g.lockOn.reset();
    g.view.reset();
    g.callbacks.onLoot?.("훈련 재개 · 모험 기록과 재화는 바뀌지 않습니다");
  }
  refill() {
    if (!this.active) return false;
    const g = this.game;
    for (const id of Object.keys(g.magic.cooldowns)) g.magic.cooldowns[id] = 0;
    g.actions.heavyCooldown = g.actions.ultimateCooldown = 0;
    g.parry.reset();
    g._state.hp = g.combatStats.maxHp;
    g.emit();
    return true;
  }
  resolve(p, r = 0.65) {
    const length = Math.hypot(p.x, p.z),
      bound = 17.5 - r;
    if (length > bound) {
      p.x *= bound / length;
      p.z *= bound / length;
    }
    p.y = 0;
    return p;
  }
  state() {
    return this.active
      ? {
          active: true,
          mode: this.mode,
          name: TRAINING_MODES[this.mode],
          hits: this.hits,
          damage: this.damage,
          lastDamage: this.lastDamage,
          dps: this.damage / Math.max(1, this.game._state.elapsed),
          received: this.received,
          downs: this.downs,
          kills: this.kills,
        }
      : null;
  }
  leave({ silent = false } = {}) {
    if (!this.active) return false;
    const g = this.game,
      s = this.snapshot;
    clearCosmetics(g);
    g.enemyRenderer.reset();
    for (const e of [...g.enemies]) g.releaseEnemy(e);
    g.activeEnemies.clear();
    g.clearEnemyProjectiles();
    for (const p of g.projectiles) {
      g.removeGroup(p.mesh);
      p.mesh.geometry.dispose();
    }
    for (const p of g.pickups) g.removeGroup(p.mesh);
    for (const c of g.chests) g.removeGroup(c.group);
    for (const key of ARRAYS) g[key].length = 0;
    for (const name of OWNERS) g[name].dispose();
    this.hidden.dispose();
    this.hidden = null;
    for (const key of FIELDS) g[key] = s.fields[key];
    for (const key of ARRAYS) g[key].push(...s.arrays[key]);
    for (const e of g.enemies) g.activeEnemies.add(e);
    g.camp.active = true;
    g.camp.suspended = s.campSuspended;
    this.root.visible = false;
    this.active = false;
    this.snapshot = null;
    this.context.restore();
    for (const [mesh, visible] of s.visible) mesh.visible = visible;
    g.player.position.copy(s.position);
    g.player.rotation.y = s.rotation;
    g.applyLoadoutAppearance();
    g.view.reset();
    g.keys.clear();
    g.touchMove = { x: 0, y: 0 };
    g.spatialBuckets.clear();
    g.spatialDirty = true;
    g.lastTime = performance.now();
    if (!silent) g.emit();
    return true;
  }
  dispose() {
    this.leave({ silent: true });
    this.root.removeFromParent();
    this.floorGeometry.dispose();
    this.material.dispose();
  }
}
