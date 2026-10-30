export const COMBAT_LINKS = Object.freeze(
  [
    {
      id: "shatter",
      name: "균열 분쇄",
      condition: "서리 적중 후 3초 안에 강공격",
      effect: "그 적에게 강공격 피해 +45% · 보스 +25% · 대상별 4초",
    },
    {
      id: "ignite",
      name: "점화 베기",
      condition: "화염 적중 후 3초 안에 검 적중",
      effect: "2.7m 폭발 · 검 피해 55% · 최대 6명 · 전체 1.5초/대상 4초",
    },
    {
      id: "dashLightning",
      name: "섬광 관통",
      condition: "대시 후 0.8초 안에 번개 발동",
      effect: "같은 사선의 적을 최대 3명 관통한 뒤 연쇄 · 4초",
    },
    {
      id: "parryMagic",
      name: "반전 시전",
      condition: "완벽한 패링 후 2초 안에 마법 발동",
      effect: "그 시전의 피해 +25% · 1회 · 검 반격 충전과 별도",
    },
  ].map(Object.freeze),
);

/** Finite input-order windows, separate from evolution/relic synergies. */
export class CombatLinks {
  constructor(game) {
    this.game = game;
    this.reset();
  }
  now() {
    return this.game._state.elapsed || 0;
  }
  reset() {
    this.dashAt = -Infinity;
    this.parryUntil = 0;
    this.nextLightning = 0;
    this.nextExplosion = 0;
    this.targets = new WeakMap();
    this.triggers = Object.fromEntries(COMBAT_LINKS.map((l) => [l.id, 0]));
    this.last = "";
    this.lastUntil = 0;
  }
  times(enemy) {
    let t = this.targets.get(enemy);
    if (!t) {
      t = { frost: 0, fire: 0, shatter: 0, ignite: 0 };
      this.targets.set(enemy, t);
    }
    return t;
  }
  onDash() {
    this.dashAt = this.now();
  }
  onParry() {
    this.parryUntil = this.now() + 2;
  }
  onMagicHit(enemy, id) {
    if (id === "frost") this.times(enemy).frost = this.now() + 3;
    if (id === "fireball") this.times(enemy).fire = this.now() + 3;
  }
  announce(id) {
    this.triggers[id]++;
    this.last = id;
    this.lastUntil = this.now() + 2;
    this.game.runReport &&
      (this.game.runReport.linkTriggers = { ...this.triggers });
  }
  swordMultiplier(action, enemy) {
    const t = this.times(enemy),
      now = this.now();
    if (
      action.heavy &&
      enemy.slowTime > 0 &&
      t.frost > now &&
      t.shatter <= now
    ) {
      t.shatter = now + 4;
      this.announce("shatter");
      return enemy.kind === 4 ? 1.25 : 1.45;
    }
    return 1;
  }
  afterSword(enemy, damage, position) {
    const t = this.times(enemy),
      now = this.now();
    if (t.fire <= now || t.ignite > now || this.nextExplosion > now)
      return false;
    t.fire = 0;
    t.ignite = now + 4;
    this.nextExplosion = now + 1.5;
    this.announce("ignite");
    const g = this.game;
    g.magic.ring(position, 2.7, "fireball", 0.35, 0.7);
    let count = 0;
    for (const other of g.queryEnemies(position, 4)) {
      if (count >= 6) break;
      if (
        other.hp <= 0 ||
        position.distanceToSquared(other.group.position) > 2.7 ** 2 ||
        !g.combatLineClear(position, other.group.position)
      )
        continue;
      g.hitEnemy(
        other,
        damage * 0.55,
        other.group.position.clone().sub(position).setY(0).normalize(),
        "link",
        null,
        { analyticsSource: "link", hitStun: 0, knockbackScale: 0 },
      );
      count++;
    }
    return true;
  }
  prepareCast(id) {
    const now = this.now();
    return {
      damageMultiplier: this.parryUntil > now ? 1.25 : 1,
      pierce:
        id === "lightning" &&
        now - this.dashAt <= 0.8 &&
        this.nextLightning <= now,
      parry: this.parryUntil > now,
    };
  }
  commitCast(id, context) {
    if (context.parry) {
      this.parryUntil = 0;
      this.announce("parryMagic");
    }
    if (id === "lightning" && context.pierce) {
      this.dashAt = -Infinity;
      this.nextLightning = this.now() + 4;
      this.announce("dashLightning");
    }
  }
  state() {
    return {
      last:
        this.lastUntil > this.now()
          ? COMBAT_LINKS.find((l) => l.id === this.last)?.name
          : "",
      parryWindow: Math.max(0, this.parryUntil - this.now()),
      dashWindow: Math.max(0, 0.8 - (this.now() - this.dashAt)),
      triggers: { ...this.triggers },
    };
  }
}
