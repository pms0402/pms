import * as THREE from "three";
export const EQUIPMENT_SLOTS = Object.freeze({
  weapon: "무기",
  armor: "방어구",
  ring: "반지",
  necklace: "목걸이",
});
export const EQUIPMENT_GRADES = Object.freeze([
  { id: "common", name: "일반", color: "#abb3b8", options: 0, power: 1 },
  { id: "rare", name: "희귀", color: "#75b7ff", options: 1, power: 1.25 },
  { id: "epic", name: "영웅", color: "#c695ff", options: 2, power: 1.55 },
  { id: "legendary", name: "전설", color: "#ffb266", options: 3, power: 1.9 },
]);
export const EQUIPMENT_OPTIONS = Object.freeze([
  { id: "crit", name: "치명타 확률 +4%p" },
  { id: "criticalDamage", name: "치명타 배율 +0.2" },
  { id: "haste", name: "검 공격 속도 +8%" },
  { id: "arcane", name: "마법 공격력 +12%" },
  { id: "guard", name: "피해 감소 +3%p" },
  { id: "vital", name: "최대 체력 +10%" },
  { id: "blast", name: "직접 처치 시 15% 폭발 · 2초 간격 · 5명" },
  { id: "dash", name: "대시 후 3초 안 다음 검격 +25%" },
  { id: "desperate", name: "체력 35% 이하 피해 감소 +6%p" },
  { id: "boss", name: "보스 피해 +12%" },
  { id: "element", name: "지정 속성 마법 +18%" },
  { id: "bolt", name: "직접 처치 시 12% 추적 파편 · 3초 간격 · 1명" },
]);
const roll = (random) =>
  Math.max(0, Math.min(0.999999999, Number(random()) || 0));
let serial = 0;
export function rollEquipment(
  stage = 1,
  region = "sanctum",
  random = Math.random,
  minimum = 0,
) {
  const floor = Math.max(1, Math.min(100, Number(stage) || 1)),
    gradeRoll = roll(random),
    boost =
      Math.min(0.09, floor * 0.004) +
      (region === "void" || region === "ruins" ? 0.025 : 0);
  const index = Math.max(
      minimum,
      gradeRoll < 0.015 + boost * 0.2
        ? 3
        : gradeRoll < 0.1 + boost
          ? 2
          : gradeRoll < 0.4 + boost
            ? 1
            : 0,
    ),
    grade = EQUIPMENT_GRADES[Math.min(3, index)];
  const slot = Object.keys(EQUIPMENT_SLOTS)[Math.floor(roll(random) * 4)],
    pool = [...EQUIPMENT_OPTIONS],
    options = [];
  for (let i = 0; i < grade.options; i++)
    options.push(pool.splice(Math.floor(roll(random) * pool.length), 1)[0].id);
  const element =
    region === "volcano"
      ? "fireball"
      : region === "tundra"
        ? "frost"
        : ["fireball", "frost", "lightning", "orbit"][
            Math.floor(roll(random) * 4)
          ];
  return {
    id: `gear-${++serial}`,
    slot,
    grade: grade.id,
    title: `${{ volcano: "잿불", tundra: "서리", forest: "고목", ruins: "고대", void: "공허" }[region] || "별철"} ${EQUIPMENT_SLOTS[slot]}`,
    power: (0.06 + Math.min(20, floor) * 0.008) * grade.power,
    options,
    element,
    level: 0,
    unique: grade.id === "legendary" ? "resonance" : "",
  };
}
export function equipmentBonuses(items = []) {
  const b = {
    damage: 1,
    maxHp: 1,
    spellDamage: 1,
    attackRate: 1,
    crit: 0,
    criticalDamage: 0,
    armor: 0,
    boss: 0,
    combo: 1,
    desperate: 0,
    dash: 0,
    blast: 0,
    bolt: 0,
    element: {},
  };
  for (const item of items.filter(Boolean)) {
    const power = item.power * (1 + 0.12 * Math.min(5, item.level || 0));
    const key = {
      weapon: "damage",
      armor: "maxHp",
      ring: "spellDamage",
      necklace: "maxHp",
    }[item.slot];
    if (key) b[key] *= 1 + power;
    for (const id of item.options) {
      if (id === "crit") b.crit += 0.04;
      if (id === "criticalDamage") b.criticalDamage += 0.2;
      if (id === "haste") b.attackRate *= 1.08;
      if (id === "arcane") b.spellDamage *= 1.12;
      if (id === "guard") b.armor += 0.03;
      if (id === "vital") b.maxHp *= 1.1;
      if (id === "desperate") b.desperate += 0.06;
      if (id === "boss") b.boss += 0.12;
      if (["dash", "blast", "bolt"].includes(id)) b[id]++;
      if (id === "element")
        b.element[item.element] = (b.element[item.element] || 0) + 0.18;
    }
    if (item.unique === "resonance") b.combo += 0.12;
  }
  return b;
}
export class EquipmentSystem {
  constructor(game) {
    this.game = game;
    this.geometry = new THREE.OctahedronGeometry(0.3, 0);
    this.materials = EQUIPMENT_GRADES.map(
      (g) => new THREE.MeshBasicMaterial({ color: g.color }),
    );
    this.reset();
  }
  get equipped() {
    return Object.keys(EQUIPMENT_SLOTS)
      .map((slot) => this.bag.find((item) => item.id === this.slots[slot]))
      .filter(Boolean);
  }
  invalidate() {
    this._bonuses = null;
  }
  bonuses() {
    return (this._bonuses ||= equipmentBonuses(this.equipped));
  }
  add(item) {
    if (
      this.bag.length >= 16 ||
      !item ||
      this.bag.some((x) => x.id === item.id)
    )
      return false;
    this.bag.push(item); this.game.analytics?.equipment(item);
    this.game.callbacks.onLoot?.(
      `${item.title} · 장비 가방에 보관 · E로 비교/장착`,
    );
    return true;
  }
  equip(id) {
    if (!["playing", "paused", "equipment"].includes(this.game._state.phase))
      return false;
    const item = this.bag.find((x) => x.id === id);
    if (!item) return false;
    this.slots[item.slot] = id;
    this.invalidate();
    this.clampHealth();
    return true;
  }
  discard(id) {
    if (!["playing", "paused", "equipment"].includes(this.game._state.phase))
      return false;
    const item = this.bag.find((x) => x.id === id);
    if (!item) return false;
    if (this.slots[item.slot] === id) delete this.slots[item.slot];
    this.bag = this.bag.filter((x) => x.id !== id);
    this.invalidate();
    this.clampHealth();
    return true;
  }
  clampHealth() {
    this.game._state.hp = Math.min(
      this.game._state.hp,
      this.game.combatStats.maxHp,
    );
  }
  drop(position, item) {
    if (this.drops.length >= 12) {
      const old = this.drops.shift();
      old.mesh.removeFromParent();
    }
    const grade = EQUIPMENT_GRADES.findIndex((g) => g.id === item.grade),
      mesh = new THREE.Mesh(this.geometry, this.materials[Math.max(0, grade)]);
    mesh.position.copy(position);
    mesh.position.y = this.game.groundHeight(position.x, position.z) + 0.7;
    this.game.scene.add(mesh);
    this.drops.push({ mesh, item, age: 0 });
  }
  onKill(enemy, position, source) {
    if (enemy.kind === 4) {
      this.rewardQueue.push(
        Array.from({ length: 3 }, () =>
          rollEquipment(
            this.game._state.stage,
            this.game.regionId,
            Math.random,
            1,
          ),
        ),
      );
      return;
    }
    if (enemy.minion || enemy.splitChild) return;
    const chance = enemy.elite
      ? 0.35
      : enemy.mutationElite
        ? 0.12
        : enemy.mutations?.length
          ? 0.05
          : 0.012;
    if (Math.random() < chance)
      this.drop(
        position,
        rollEquipment(
          this.game._state.stage,
          this.game.regionId,
          Math.random,
          enemy.elite ? 1 : 0,
        ),
      );
    if (!["sword", "magic"].includes(source)) return;
    const b = this.bonuses(),
      now = this.game._state.elapsed;
    if (b.blast && now >= this.nextBlast && Math.random() < 0.15) {
      this.nextBlast = now + 2;
      this.game.puff(position, "#ffb266", 2.8, 0.35);
      for (const e of this.game
        .queryEnemies(position, 2.8)
        .filter((e) => e !== enemy)
        .slice(0, 5))
        this.game.hitEnemy(
          e,
          this.game.combatStats.damage * 0.35,
          undefined,
          "equipment",
        );
    }
    if (b.bolt && now >= this.nextBolt && Math.random() < 0.12) {
      this.nextBolt = now + 3;
      const e = this.game.queryEnemies(position, 10).find((e) => e !== enemy);
      if (e) {
        this.game.magic.lightningLine(position, e.group.position, 0.25, 0.6);
        this.game.hitEnemy(
          e,
          this.game.combatStats.spellDamage * 0.5,
          undefined,
          "equipment",
        );
      }
    }
  }
  update(dt) {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.age += dt;
      drop.mesh.rotation.y += dt;
      if (
        drop.mesh.position.distanceTo(this.game.player.position) < 2 &&
        this.add(drop.item)
      ) {
        drop.mesh.removeFromParent();
        this.drops.splice(i, 1);
      }
    }
  }
  nextReward() {
    if (this.game._state.phase !== "playing" || !this.rewardQueue.length)
      return false;
    this.choices = this.rewardQueue.shift();
    this.game._state.phase = "equipment";
    this.game.keys.clear();
    this.game.touchMove = { x: 0, y: 0 };
    this.game.callbacks.onEquipmentReward?.(this.choices);
    this.game.emit();
    return true;
  }
  choose(id) {
    if (
      this.game._state.phase !== "equipment" ||
      (id !== "skip" && !this.choices.some((x) => x.id === id))
    )
      return false;
    if (id !== "skip" && !this.add(this.choices.find((x) => x.id === id)))
      return false;
    this.choices = [];
    this.game._state.phase = "playing";
    this.game.lastTime = performance.now();
    this.game.emit();
    return true;
  }
  clearFloor() {
    for (const d of this.drops || []) d.mesh.removeFromParent();
    this.drops = [];
  }
  reset() {
    this.clearFloor?.();
    this.bag = [];
    this.slots = {};
    this.invalidate();
    this.drops = [];
    this.rewardQueue = [];
    this.choices = [];
    this.nextBlast = this.nextBolt = 0;
  }
  getState() {
    return {
      bag: structuredClone(this.bag),
      slots: { ...this.slots },
      bonuses: this.bonuses(),
      drops: this.drops.length,
      pending: this.rewardQueue.length,
    };
  }
  dispose() {
    this.reset();
    this.geometry.dispose();
    this.materials.forEach((m) => m.dispose());
  }
}
