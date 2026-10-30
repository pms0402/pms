import * as THREE from "three";
import { getSwordProfile } from "./sword.js";
import { counterProfile } from "./parry.js";
export const SKILL_IDS = Object.freeze([
  "fireball",
  "frost",
  "lightning",
  "orbit",
]);
export const SKILL_TIMINGS = Object.freeze({
  fireball: { cooldown: 12, cast: 0.42, movement: 0.4 },
  frost: { cooldown: 14, cast: 0.5, movement: 0.65 },
  lightning: { cooldown: 10, cast: 0.3, movement: 0.35 },
  orbit: { cooldown: 18, cast: 0.62, movement: 0.25 },
  ultimate: { cooldown: 45, cast: 0.85, movement: 0.15 },
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/** Every authored hit marker crosses the same blade-contact pose (.42). */
export function swordPoseProgress(action) {
  const t = clamp(action.elapsed / action.duration, 0, 1),
    markers = action.markers;
  const i = markers.findIndex(
      (m, j) => j === markers.length - 1 || t < (m + markers[j + 1]) / 2,
    ),
    hit = markers[i],
    start = i ? (markers[i - 1] + hit) / 2 : 0,
    end = i < markers.length - 1 ? (hit + markers[i + 1]) / 2 : 1;
  return t <= hit
    ? (0.42 * (t - start)) / Math.max(0.001, hit - start)
    : 0.42 + (0.58 * (t - hit)) / Math.max(0.001, end - hit);
}
export function weaponStyle(stats) {
  return stats.swordEvolution === "wave"
    ? "wave"
    : stats.swordEvolution === "twinblade" || stats.weaponId === "tempest"
      ? "twinblade"
      : stats.swordEvolution === "broadsword" || stats.weaponId === "greatsword"
        ? "broadsword"
        : "default";
}
export function swordAction(
  stats,
  combat,
  type,
  index = 0,
  charge = 0,
  counter = false,
) {
  const base = counter ? counterProfile(stats) : getSwordProfile(stats),
    style = weaponStyle(stats),
    max = style === "twinblade" ? 5 : 3,
    finisher = index === max - 1;
  const speed = clamp(
      Math.pow(
        Math.max(0.1, combat.attackRate / 1.5) * base.attackRateMultiplier,
        0.35,
      ),
      0.75,
      1.65,
    ),
    heavy = type === "heavy";
  const duration =
    (counter
      ? 0.56
      : heavy
        ? style === "broadsword"
          ? 1.05
          : 0.82
        : style === "twinblade"
          ? finisher
            ? 0.62
            : 0.37
          : style === "broadsword"
            ? finisher
              ? 1.04
              : 0.84
            : finisher
              ? 0.7
              : 0.54) / speed;
  return {
    style,
    max,
    finisher,
    heavy,
    counter,
    duration,
    markers: counter
      ? [0.42]
      : !heavy && finisher && style === "twinblade"
        ? [0.34, 0.46, 0.58]
        : [heavy ? 0.56 : 0.42],
    profile: {
      ...base,
      mode: counter ? base.mode : style,
      range: base.range * (heavy ? 1.3 : style === "broadsword" ? 1.15 : 1),
      arc: counter
        ? Math.PI
        : heavy
          ? Math.PI
          : style === "broadsword"
            ? Math.PI
            : style === "twinblade"
              ? (Math.PI * 100) / 180
              : base.arc,
      damageMultiplier:
        base.damageMultiplier *
        (counter
          ? 2.5
          : heavy
            ? 2.1 + clamp(charge, 0, 1) * 1.8
            : finisher
              ? style === "twinblade"
                ? 0.68
                : 1.65
              : 1),
      targets: heavy ? 12 : base.targets,
      color: counter ? "#ffe6ad" : heavy ? "#ffd18b" : base.color,
    },
  };
}
export function normalizedSlots(stats) {
  const known = SKILL_IDS.filter((id) => stats.spells?.[id] > 0),
    result = [];
  for (const id of Array.isArray(stats.skillSlots) ? stats.skillSlots : known) {
    if (result.length === 3) break;
    if (known.includes(id) && !result.includes(id)) result.push(id);
    else result.push(null);
  }
  while (result.length < 3) result.push(null);
  return result;
}
/** All attacks start at player input and commit once at their animation marker. */
export class ActionCombat {
  constructor(game) {
    this.game = game;
    this.aim = new THREE.Vector3(0, 0, 1);
    this.point = new THREE.Vector3();
    this.reset();
  }
  reset() {
    this.current = null;
    this.buffer = null;
    this.charging = false;
    this.charge = 0;
    this.combo = 0;
    this.comboTime = 0;
    this.heavyCooldown = 0;
    this.ultimateCooldown = 0;
    this.hasAim = false;
    this.time = 0;
    this.attackSerial = 0;
    this.lastInput = -Infinity;
    this.manualCommands = 0;
  }
  syncSlots() {
    const g = this.game,
      slots = normalizedSlots(g.stats);
    for (const id of SKILL_IDS)
      if (g.stats.spells?.[id] > 0 && !slots.includes(id)) {
        const free = slots.indexOf(null);
        if (free >= 0) slots[free] = id;
      }
    g.stats.skillSlots = slots;
    return slots;
  }
  equip(index, id) {
    const g = this.game;
    if (
      !["paused", "menu", "camp", "over", "won", "skill-swap"].includes(
        g._state.phase,
      ) ||
      !Number.isInteger(index) ||
      index < 0 ||
      index > 2 ||
      !SKILL_IDS.includes(id) ||
      !(g.stats.spells?.[id] > 0)
    )
      return false;
    const slots = this.syncSlots(),
      other = slots.indexOf(id);
    if (other >= 0) [slots[other], slots[index]] = [slots[index], slots[other]];
    else slots[index] = id;
    g.stats.skillSlots = slots;
    g.emit();
    return true;
  }
  direction() {
    const g = this.game;
    return this.hasAim
      ? this.aim
      : this.aim.set(
          Math.sin(g.player.rotation.y),
          0,
          Math.cos(g.player.rotation.y),
        );
  }
  setAim(direction, distance = 12) {
    if (
      !direction ||
      !Number.isFinite(direction.x + direction.z) ||
      direction.lengthSq() < 1e-8
    )
      return;
    this.hasAim = true;
    this.aim.copy(direction).setY(0).normalize();
    if (!this.current)
      this.game.player.rotation.y = Math.atan2(this.aim.x, this.aim.z);
    this.aimDistance = clamp(distance, 2, 18);
  }
  ready() {
    const g = this.game;
    return (
      g._state.phase === "playing" &&
      !g.callbacks.isUIBlocked?.() &&
      !(g.dashTime > 0) &&
      !(g.parry.active > 0)
    );
  }
  press(type) {
    const g = this.game;
    if (!this.ready()) return false;
    if (
      (type === "ultimate" && this.ultimateCooldown > 0) ||
      (type === "heavy" && this.heavyCooldown > 0)
    )
      return false;
    if (type.startsWith("skill")) {
      const id = this.syncSlots()[Number(type.slice(5))];
      if (!id || g.magic.cooldowns[id] > 0) return false;
    }
    if (
      type === "heavy" &&
      weaponStyle(g.stats) === "broadsword" &&
      !this.current &&
      this.heavyCooldown <= 0
    ) {
      this.charging = true;
      this.charge = 0;
      return true;
    }
    if (this.charging) return false;
    if (this.current) {
      if (this.current.duration - this.current.elapsed > 0.18) return false;
      if (!this.buffer) this.buffer = { type, life: 0.18 };
      return !!this.buffer;
    }
    return this.begin(type);
  }
  releaseHeavy() {
    if (!this.charging) return false;
    const charge = this.charge;
    this.charging = false;
    this.charge = 0;
    return this.ready() && this.begin("heavy", charge);
  }
  clearInput() {
    this.buffer = null;
    this.charging = false;
    this.charge = 0;
  }
  cancel() {
    this.clearInput();
    this.current = null;
    this.combo = 0;
    this.comboTime = 0;
    this.game.attackAnim = this.game.counterAnim = this.game.playerCastTime = 0;
  }
  begin(type, charge = 0) {
    const g = this.game;
    if (!this.ready()) return false;
    let action;
    const skill = type.startsWith("skill")
      ? this.syncSlots()[Number(type.slice(5))]
      : type === "ultimate"
        ? "ultimate"
        : null;
    if (type === "light" || type === "heavy") {
      if (type === "heavy" && this.heavyCooldown > 0) return false;
      const counter = g.parry.counterTime > 0;
      action = {
        ...swordAction(
          g.stats,
          g.combatStats,
          type,
          this.combo,
          charge,
          counter,
        ),
        type: "sword",
        elapsed: 0,
        nextMarker: 0,
        origin: g.player.position.clone(),
        direction: this.direction().clone(),
      };
      action.comboIndex = this.combo;
      if (
        action.style === "twinblade" &&
        g.manualDashUntil > g._state.elapsed
      ) {
        action.duration *= 0.85;
        g.manualDashUntil = 0;
      }
      if (counter) g.parry.consume();
      if (type === "heavy") this.heavyCooldown = 4;
      if (type === "light" && !counter) {
        this.combo = (this.combo + 1) % action.max;
        this.comboTime = 0.8;
      } else this.combo = 0;
      g.swingSide = -(g.swingSide || -1);
      g.attackAnimTotal = action.duration;
      g.attackAnim = action.duration;
      g.counterAnim = 0;
      g.swordTrail?.reset();
      g.sound("attack");
    } else if (skill) {
      if (
        skill === "ultimate"
          ? this.ultimateCooldown > 0
          : !g.magic.rank(skill) || g.magic.cooldowns[skill] > 0
      )
        return false;
      const timing = SKILL_TIMINGS[skill],
        speed = clamp(
          Math.pow(Math.max(0.1, g.stats.spellRate / 1.5), 0.3),
          0.8,
          1.6,
        ),
        cast = timing.cast / speed;
      if (skill === "ultimate") this.ultimateCooldown = 45;
      else g.magic.cooldowns[skill] = g.magic.maxCooldown(skill);
      action = {
        type: "skill",
        id: skill,
        duration: cast + 0.24,
        cast,
        elapsed: 0,
        nextMarker: 0,
        markers: [cast / (cast + 0.24)],
        movement: timing.movement,
        direction: this.direction().clone(),
      };
      action.target = g.player.position
        .clone()
        .addScaledVector(action.direction, this.aimDistance || 12);
      g.resolvePosition(action.target, 0.2);
      g.playerCastTime = 0.3;
      g.lastCastSpell = skill;
    } else return false;
    this.current = action;
    this.lastInput = this.time;
    this.manualCommands++;
    this.attackSerial++;
    g.analytics.actionInputs = (g.analytics.actionInputs || 0) + 1;
    g.emit();
    return true;
  }
  update(dt) {
    this.time += dt;
    this.heavyCooldown = Math.max(0, this.heavyCooldown - dt);
    const beforeUlt = this.ultimateCooldown;
    this.ultimateCooldown = Math.max(0, beforeUlt - dt);
    if (beforeUlt > 0 && this.ultimateCooldown === 0) {
      this.game.sound("skill-ready");
      this.game.callbacks.onLoot?.("궁극기 준비");
    }
    if (this.charging) this.charge = Math.min(1, this.charge + dt / 1.2);
    if (this.buffer) {
      this.buffer.life -= dt;
      if (this.buffer.life < 0) this.buffer = null;
    }
    const a = this.current,
      g = this.game;
    if (!a) {
      this.comboTime = Math.max(0, this.comboTime - dt);
      if (!this.comboTime) this.combo = 0;
      return;
    }
    a.elapsed = Math.min(a.duration, a.elapsed + dt);
    if (a.type === "sword") {
      g.attackAnimTotal = a.duration;
      g.attackAnim = Math.max(0, a.duration - a.elapsed);
      g.player.rotation.y = Math.atan2(a.direction.x, a.direction.z);
    } else
      g.playerCastTime = Math.max(
        0,
        Math.sin(Math.min(1, a.elapsed / a.duration) * Math.PI) * 0.3,
      );
    while (
      a.nextMarker < a.markers.length &&
      a.elapsed + 1e-9 >= a.duration * a.markers[a.nextMarker]
    ) {
      a.nextMarker++;
      if (a.type === "sword") g.resolveSwordAction(a);
      else {
        g.magic.castManual(a.id, a.direction, a.target, true);
        g.classes.command?.(a.direction);
      }
      if (this.current !== a) return;
    }
    if (a.elapsed >= a.duration) {
      this.current = null;
      g.attackAnim = g.counterAnim = 0;
      this.comboTime = 0.7;
      const buffered = this.buffer;
      this.buffer = null;
      if (buffered) this.begin(buffered.type);
    }
  }
  movementScale() {
    return this.charging
      ? 0.6
      : this.current?.type === "skill"
        ? this.current.movement
        : this.current
          ? this.current.duration - this.current.elapsed > 0.182
            ? 0.42
            : 0.72
          : 1;
  }
  exposed() {
    return (
      !!this.current && this.current.elapsed / this.current.duration > 0.62
    );
  }
  state() {
    const a = this.current;
    return {
      active: a?.type || "",
      skill: a?.id || "",
      phase: this.charging
        ? "charging"
        : a
          ? a.elapsed / a.duration < (a.markers[0] || 0.42)
            ? "windup"
            : a.elapsed / a.duration < 0.65
              ? "active"
              : "recovery"
          : "ready",
      combo: this.combo,
      comboMax: weaponStyle(this.game.stats) === "twinblade" ? 5 : 3,
      charge: this.charging ? this.charge : 0,
      heavyCooldown: this.heavyCooldown,
      ultimateCooldown: this.ultimateCooldown,
      slots: this.syncSlots(),
      buffered: !!this.buffer,
      commands: this.manualCommands,
    };
  }
}
