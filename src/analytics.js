export const DAMAGE_SOURCES = Object.freeze({
  sword: "검",ultimate:"궁극기",
  fireball: "화염구",
  frost: "서리 파동",
  lightning: "연쇄 번개",
  orbit: "설치 룬",
  combo: "숨겨진 조합",link:"전투 연계",
  equipment: "장비 효과",
  counter: "반격",
  pet: "소환수",
  set: "세트 효과",
  relic: "유물",
  other: "기타",
});
const value = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(1e18, n)) : 0);
export function damageCategory(source, spell, impact) {
  return DAMAGE_SOURCES[impact?.analyticsSource]
    ? impact.analyticsSource
    : DAMAGE_SOURCES[spell]
      ? spell
      : source === "explosion" || source === "parry"
        ? "relic"
        : DAMAGE_SOURCES[source]
          ? source
          : "other";
}
/** Fixed budget time bins and recent floor rows; no render objects or combat references. */
export class RunAnalytics {
  constructor() {
    this.reset();
  }
  reset() {
    this.damage = Object.fromEntries(
      Object.keys(DAMAGE_SOURCES).map((id) => [id, 0]),
    );
    this.overkill = 0;
    this.received = 0;
    this.healed = 0;
    this.dashes = 0;
    this.parryAttempts = 0;
    this.parrySuccesses = 0;
    this.parryBlocked = 0; this.parryBossStuns = 0;
    this.kills = { normal: 0, elite: 0, boss: 0 };
    this.floors = new Map();
    this.bins = [];
    this.binSeconds = 10;
    this.gear = [];
    this.gearCount = 0;
    this.gearIds = new Set();
  }
  floor(stage) {
    if (!this.floors.has(stage)) {
      if (this.floors.size >= 200)
        this.floors.delete(this.floors.keys().next().value);
      this.floors.set(stage, { stage, kills: 0, damage: 0, taken: 0 });
    }
    return this.floors.get(stage);
  }
  hit(source, requested, hp, time, stage) {
    const actual = Math.min(value(requested), value(hp));
    this.damage[source in this.damage ? source : "other"] += actual;
    this.overkill += Math.max(0, value(requested) - actual);
    this.floor(stage).damage += actual;
    while (time / this.binSeconds >= 180) {
      this.bins = Array.from(
        { length: Math.ceil(this.bins.length / 2) },
        (_, i) => (this.bins[i * 2] || 0) + (this.bins[i * 2 + 1] || 0),
      );
      this.binSeconds *= 2;
    }
    const i = Math.min(179, Math.floor(value(time) / this.binSeconds));
    this.bins[i] = (this.bins[i] || 0) + actual;
    return actual;
  }
  hurt(amount, stage) {
    this.received += value(amount);
    this.floor(stage).taken += value(amount);
  }
  kill(enemy, stage) {
    this.kills[
      enemy.kind === 4 || enemy.hiddenBoss
        ? "boss"
        : enemy.elite || enemy.mutationElite
          ? "elite"
          : "normal"
    ]++;
    this.floor(stage).kills++;
  }
  equipment(item) {
    if (this.gearIds.has(item.id)) return;
    this.gearIds.add(item.id);
    if (this.gearIds.size > 512)
      this.gearIds.delete(this.gearIds.values().next().value);
    this.gearCount++;
    this.gear.push({
      title: item.title,
      grade: item.grade,
      slot: item.slot,
      setId: item.setId || "",
    });
    if (this.gear.length > 32) this.gear.shift();
  }
  snapshot(game) {
    const s = game._state,
      stats = game.combatStats;
    return {
      version: 1,
      mode: game.mode,
      time: s.elapsed,
      stage: s.stage,
      character: game.stats.characterId,
      weapon: game.stats.weaponId,
      kills: { ...this.kills },
      damage: { ...this.damage },
      overkill: this.overkill,
      received: this.received,
      healed: this.healed,
      dashes: this.dashes,
      parryAttempts: this.parryAttempts,
      parrySuccesses: this.parrySuccesses,
      parrySuccessRate: this.parryAttempts ? Math.min(1,this.parrySuccesses / this.parryAttempts) : 0,
      parryBlocked: this.parryBlocked, parryBossStuns: this.parryBossStuns,
      gold: s.grossGold ?? s.gold,
      netGold: s.gold,
      gearCount: this.gearCount,
      gear: this.gear.map((i) => ({ ...i })),
      binSeconds: this.binSeconds,
      dps: Array.from({ length: this.bins.length }, (_, i) => ({
        time: i * this.binSeconds,
        damage: this.bins[i] || 0,
        dps:
          (this.bins[i] || 0) /
          Math.max(
            1,
            Math.min(this.binSeconds, s.elapsed - i * this.binSeconds),
          ),
      })),
      floors: [...this.floors.values()].map((i) => ({ ...i })),
      finalStats: Object.fromEntries(
        [
          "damage",
          "spellDamage",
          "maxHp",
          "attackRate",
          "spellRate",
          "critChance",
          "armor",
          "speed",
        ].map((key) => [key, value(stats[key])]),
      ),
      build: {
        spells: { ...game.stats.spells },
        evolutions: { ...game.stats.evolutions },
        sword: game.stats.swordEvolution || "",
        relics: [...game.stats.relics],
        equipment: game.equipment.equipped.map((i) => structuredClone(i)),
      },
    };
  }
}
export function normalizeRunHistory(history) {
  return Array.isArray(history)
    ? history.filter((r) => r && typeof r === "object").slice(0, 30)
    : [];
}
