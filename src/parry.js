import * as THREE from "three";
import { getSwordProfile } from "./sword.js";
import { ParryFeedback } from "./parry-feedback.js";
export const PARRY = Object.freeze({
  window: 0.45,
  perfect: 0.16,
  cooldown: 4,
  counterWindow: 2,
  hitStop: 0.1,
  radius: 4,
  stun: 0.32,
  eliteStun: 0.14,
  bossStun: 0.6,
  bossResistance: 5,
  controlResistance: 1.5,
  counterMultiplier: 2.5,
  counterBossMultiplier: 1.2,
  counterTargets: 24,
});
export function counterProfile(stats) {
  const base = getSwordProfile(stats);
  return {
    ...base,
    range: Math.min(7, Math.max(3.4, base.range * 1.25)),
    arc: Math.PI,
    targets: PARRY.counterTargets,
    color: "#ffe6ad",
  };
}
export class ParrySystem {
  constructor(game) {
    this.game = game;
    this.geometry = new THREE.RingGeometry(
      0.8,
      1,
      32,
      1,
      -Math.PI / 3,
      (Math.PI * 2) / 3,
    );
    this.material = new THREE.MeshBasicMaterial({
      color: "#8bdcff",
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.x = -Math.PI / 2;
    game.scene.add(this.mesh);
    this.feedback = new ParryFeedback(game);
    this.reset();
  }
  reset() {
    this.active =
      this.age =
      this.cooldown =
      this.counterTime =
      this.successes =
      this.relicCooldown =
      this.hitStop =
      this.nextHitStop =
        0;
    if (this.mesh) this.mesh.visible = false;
    this.feedback?.reset();
  }
  press() {
    const g = this.game;
    if (
      g._state.phase !== "playing" &&
      !(g._state.phase === "camp" && g.camp.practice && !g.camp.suspended)
    )
      return false;
    if (this.counterTime > 0) {
      if (g.camp?.active) g.camp.counter();
      else return g.attack();
      return true;
    }
    if (this.cooldown > 0) return false;
    if (g._state.phase === "playing" && g.analytics)
      g.analytics.parryAttempts++;
    this.age = 0;
    g.actions?.cancel();if(g.actions){const aim=g.actions.direction();g.player.rotation.y=Math.atan2(aim.x,aim.z);}else if(g.view?.firstPerson?.())g.player.rotation.y=g.view.yaw;
    this.active = PARRY.window;
    this.cooldown = PARRY.cooldown;
    g.sound("guard");
    // Immediate guard pose; the regular animation system blends its release.
    if (g.rightShoulder) {
      g.rightShoulder.rotation.x = -1.1;
      g.rightShoulder.rotation.y = -0.3;
      g.rightElbow.rotation.x = -1.5;
    }
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
    this.material.opacity = this.age <= PARRY.perfect ? 0.7 : 0.3;
  }
  defend(source, options = {}) {
    const g = this.game;
    if (
      !this.active ||
      options.unblockable ||
      options.parryable === false ||
      !source
    )
      return 1;
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
    if (this.age > PARRY.perfect) {
      g.sound("guard-hit");
      return 0.35;
    }
    this.active = 0;
    this.counterTime = PARRY.counterWindow;
    this.feedback.success(
      new THREE.Vector3(source.x, source.y || 0, source.z),
      PARRY.radius,
    );
    g.sound("perfect-parry");
    if (g._state.phase === "playing") {
      this.successes++;
      g.setSystem?.onParry();
      g.classes?.onParry();
      if (g.analytics) g.analytics.parrySuccesses++;
      g.invulnerable = Math.max(g.invulnerable || 0, 0.18);
      g.shake = Math.max(g.shake || 0, 0.13);
      if (g._state.elapsed >= this.nextHitStop) {
        this.hitStop = PARRY.hitStop;
        this.nextHitStop = g._state.elapsed + 0.75;
      }
      this.shockwave();
      this.stunBoss(options.attacker, options);
      if (g.stats.relics?.includes("shockwave") && !(this.relicCooldown > 0)) {
        this.relicCooldown = 6;
        for (const e of g.queryEnemies(g.player.position, 2.4).slice(0, 4))
          g.hitEnemy(e, g.combatStats.damage * 0.2, undefined, "parry");
      }
    }
    return 0;
  }
  shockwave() {
    this.game.spatialDirty = true;
    for (const e of this.game.queryEnemies(
      this.game.player.position,
      PARRY.radius,
    ))
      this.control(e, false);
  }
  control(enemy, counter = false) {
    const g = this.game,
      t = g._state.elapsed;
    if (
      !enemy ||
      enemy.hp <= 0 ||
      enemy.kind === 4 ||
      (enemy.nextParryControl || 0) > t
    )
      return false;
    const elite = enemy.elite || enemy.mutationElite,
      steel = enemy.mutations?.includes("steel");
    enemy.nextParryControl = t + PARRY.controlResistance;
    enemy.parryStun = counter
      ? elite
        ? 0.08
        : 0.18
      : elite
        ? PARRY.eliteStun
        : PARRY.stun;
    const p = enemy.group.position,
      dx = p.x - g.player.position.x,
      dz = p.z - g.player.position.z,
      d = Math.hypot(dx, dz),
      force = (counter ? 9 : 20) * (elite ? 0.4 : 1) * (steel ? 0.65 : 1);
    enemy.parryPush = new THREE.Vector3(
      d > 0.001 ? dx / d : Math.sin(enemy.seed || 1),
      0,
      d > 0.001 ? dz / d : Math.cos(enemy.seed || 1),
    ).multiplyScalar(force);
    enemy.stagger?.set(0, 0, 0);
    enemy.action = "chase";
    enemy.actionTimer = Math.max(1.2, enemy.actionTimer || 0);
    enemy.shootTimer = Math.max(1.2, enemy.shootTimer || 0);
    enemy.windup = 0;
    g.clearTelegraph(enemy);
    g.removeGroup(enemy.warning);
    enemy.warning = null;
    return true;
  }
  moveControlled(enemy, dt) {
    const push = enemy.parryPush;
    if (!push) return;
    const travel = Math.min(2, push.length() * Math.max(0, dt)),
      steps = Math.max(1, Math.ceil(travel / 0.18)),
      step = push
        .clone()
        .normalize()
        .multiplyScalar(travel / steps),
      p = enemy.group.position;
    for (let i = 0; i < steps; i++) {
      const before = p.clone();
      p.add(step);
      this.game.resolvePosition(p, Math.min(1.2, enemy.size * 0.4));
      if (
        !this.game.sideAreas?.active &&
        this.game.world &&
        !this.game.world.isWalkable(p.x, p.z, Math.min(1.2, enemy.size * 0.4))
      ) {
        p.copy(before);
        break;
      }
    }
    push.multiplyScalar(Math.max(0, 1 - dt * 8));
    this.game.spatialDirty = true;
  }
  stunBoss(boss, options = {}) {
    const g = this.game,
      t = g._state.elapsed;
    if (
      !boss ||
      boss.kind !== 4 ||
      boss.hp <= 0 ||
      options.unblockable ||
      (boss.nextParryStun || 0) > t
    )
      return false;
    boss.nextParryStun = t + PARRY.bossResistance;
    boss.parryStun = boss.combatPhase === 3 ? 0.45 : PARRY.bossStun;
    g.clearTelegraph(boss);
    if (g.bossPhases.boss === boss) g.bossPhases.rush = null;
    g.bossSystem.cancelParryable?.(boss);
    boss.hiddenPending = null;
    boss.hiddenTimer = Math.max(1.2, boss.hiddenTimer || 0);
    boss.mode = "chase";
    boss.actionTimer = Math.max(1.2, boss.actionTimer || 0);
    boss.phaseCooldown = Math.max(1.2, boss.phaseCooldown || 0);
    if (g.analytics) g.analytics.parryBossStuns++;
    g.combatArt.emit(
      boss.group.position,
      "parry",
      Math.round(6 + 12 * (g.effectIntensity ?? 1)),
    );
    return true;
  }
  consume() {
    if (this.counterTime <= 0) return 1;
    this.counterTime = 0;
    return PARRY.counterMultiplier;
  }
  getState() {
    return {
      active: this.active,
      perfect: this.active > 0 && this.age <= PARRY.perfect,
      cooldown: this.cooldown,
      maxCooldown: PARRY.cooldown,
      counterTime: this.counterTime,
      successes: this.successes,
      hitStop: this.hitStop,
      radius: PARRY.radius,
    };
  }
  dispose() {
    this.feedback.dispose();
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
