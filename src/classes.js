import * as THREE from "three";
export const NEW_CLASSES = Object.freeze([
  {
    id: "assassin",
    name: "암살자",
    icon: "target",
    cost: 250,
    damageMultiplier: 1,
    spellDamageMultiplier: 1,
    maxHpMultiplier: 0.85,
    speedMultiplier: 1.15,
    critBonus: 0.06,
    description:
      "속도 +15% · 체력 -15% · 치명타 +6%p. 대시 후 첫 검격 +20%, 처치 후 1.5초 이동 +15%.",
    passive: "살의의 잔향 · 대시 강화 3초, 처치 가속 1.5초",
    color: "#9f89e9",
  },
  {
    id: "summoner",
    name: "소환술사",
    icon: "orbit",
    cost: 300,
    damageMultiplier: 0.75,
    spellDamageMultiplier: 1.18,
    maxHpMultiplier: 1,
    speedMultiplier: 1,
    description:
      "마법 +18% · 검 -25%. 소환수 1마리. 직접 마법 적중 8회로 다음 소환수 공격 강화.",
    passive: "계약수 · 1.2초 공격 주기, 마법 8회 적중 시 다음 공격 ×1.8",
    color: "#77d5c9",
  },
  {
    id: "paladin",
    name: "성기사",
    icon: "shield",
    cost: 300,
    damageMultiplier: 1,
    spellDamageMultiplier: 1,
    maxHpMultiplier: 1.2,
    speedMultiplier: 0.9,
    armorBonus: 0.05,
    description:
      "체력 +20% · 방어 +5%p · 속도 -10%. 패링 성공 시 체력 3% 회복, 12초마다 보호막.",
    passive: "신성 수호 · 패링 회복 4초 간격, 보호막 12초 간격·4초 지속",
    color: "#e2c780",
  },
  {
    id: "warlock",
    name: "흑마법사",
    icon: "fire",
    cost: 350,
    damageMultiplier: 1,
    spellDamageMultiplier: 1.25,
    maxHpMultiplier: 0.8,
    speedMultiplier: 1,
    description: "마법 +25% · 체력 -20%. 처치 6회 후 다음 직접 마법 타격 +60%.",
    passive: "공허의 갈증 · 6처치 충전, 추가 타격은 중첩을 만들지 않음",
    color: "#c779d9",
  },
]);
export const classDefinition = (id) => NEW_CLASSES.find((c) => c.id === id);
export class ClassSystem {
  constructor(game) {
    this.game = game;
    this.geometry = {
      body: new THREE.SphereGeometry(0.28, 12, 10),
      wing: new THREE.ConeGeometry(0.2, 0.6, 8),
      halo: new THREE.TorusGeometry(0.38, 0.025, 6, 24),
    };
    this.material = new THREE.MeshStandardMaterial({
      color: "#74d4ca",
      emissive: "#498f9a",
      emissiveIntensity: 0.4,
      roughness: 0.5,
    });
    this.pet = new THREE.Group();
    this.pet.add(new THREE.Mesh(this.geometry.body, this.material));
    for (const side of [-1, 1]) {
      const m = new THREE.Mesh(this.geometry.wing, this.material);
      m.position.x = side * 0.35;
      m.rotation.z = side * 1.1;
      this.pet.add(m);
    }
    game.scene.add(this.pet);
    this.signature = "";
    this.reset();
  }
  id() {
    return this.game.stats.characterId;
  }
  reset() {
    this.hasteUntil =
      this.dashUntil =
      this.nextHeal =
      this.shield =
      this.shieldUntil =
        0;
    this.nextShield = 12;
    this.petTimer = 0;
    this.magicHits = this.stacks = 0;
    this.pet.visible = false;
    this.magicHitCooldown = new WeakMap();
    this.nextStack = 0;
    this.effects = 0;
  }
  onKill() {
    const t = this.game._state.elapsed;
    if (this.id() === "assassin") this.hasteUntil = t + 1.5;
    if (this.id() === "warlock") this.stacks = Math.min(6, this.stacks + 1);
  }
  onDash() {
    if (this.id() === "assassin") this.dashUntil = this.game._state.elapsed + 3;
  }
  swordBonus() {
    if (this.id() === "assassin" && this.dashUntil > this.game._state.elapsed) {
      this.dashUntil = 0;
      return 1.2;
    }
    return 1;
  }
  spellBonus(source) {
    if (this.id() === "warlock" && source === "magic" && this.stacks >= 6) {
      this.stacks = 0;
      this.effects++;
      return 1.6;
    }
    return 1;
  }
  onMagic(enemy) {
    if (this.id() !== "summoner") return;
    const t = this.game._state.elapsed;
    if ((this.magicHitCooldown.get(enemy) || 0) > t) return;
    this.magicHitCooldown.set(enemy, t + 0.2);
    this.magicHits = Math.min(8, this.magicHits + 1);
  }
  onParry() {
    const g = this.game,
      t = g._state.elapsed;
    if (this.id() === "paladin" && t >= this.nextHeal) {
      this.nextHeal = t + 4;
      g.heal(g.combatStats.maxHp * 0.03);
    }
  }
  absorb(d) {
    if (this.id() !== "paladin" || this.game._state.elapsed >= this.shieldUntil)
      this.shield = 0;
    const used = Math.min(d, this.shield);
    this.shield -= used;
    return used;
  }
  update(dt) {
    const g = this.game,
      t = g._state.elapsed;
    if (t >= this.shieldUntil) this.shield = 0;
    this.pet.visible = this.id() === "summoner";
    if (this.pet.visible) {
      const target = g
        .queryEnemies(g.player.position, 12)
        .reduce(
          (best, e) =>
            !best ||
            e.group.position.distanceToSquared(g.player.position) <
              best.group.position.distanceToSquared(g.player.position)
              ? e
              : best,
          null,
        );
      const wanted = target ? target.group.position : g.player.position;
      this.pet.position.lerp(
        new THREE.Vector3(
          wanted.x + 1,
          g.groundHeight(wanted.x, wanted.z) + 1.2,
          wanted.z + 1,
        ),
        1 - Math.exp(-dt * 5),
      );
      this.pet.rotation.y = t;
      this.petTimer -= dt;
      if (target && this.petTimer <= 0) {
        this.petTimer = 1.2;
        const boost = this.magicHits >= 8 ? 1.8 : 1;
        if (boost > 1) this.magicHits = 0;
        g.magic.lightningLine(
          this.pet.position,
          target.group.position,
          0.25,
          0.65,
        );
        g.hitEnemy(
          target,
          g.combatStats.spellDamage * 0.45 * boost,
          undefined,
          "pet",
          null,
          { knockbackScale: 0, hitStun: 0 },
        );
      }
    }
    if (this.id() === "paladin" && t >= this.nextShield) {
      this.nextShield = t + 12;
      this.shield = g.combatStats.maxHp * 0.08;
      this.shieldUntil = t + 4;
      g.puff(g.player.position, "#e2c780", 1.4, 0.3);
    }
  }
  appearance() {
    const g = this.game,
      id = this.id();
    if (this.signature === id) return;
    this.signature = id;
    this.accessory?.removeFromParent();
    this.accessory = new THREE.Group();
    const def = classDefinition(id);
    if (!def) return;
    const material =
      this.classMaterials?.[id] ||
      new THREE.MeshStandardMaterial({
        color: def.color,
        emissive: def.color,
        emissiveIntensity: 0.25,
        roughness: 0.5,
      });
    this.classMaterials ||= {};
    this.classMaterials[id] = material;
    const add = (geo, x, y, z, scale) => {
      const m = new THREE.Mesh(this.geometry[geo], material);
      m.position.set(x, y, z);
      m.scale.setScalar(scale);
      this.accessory.add(m);
    };
    if (id === "assassin") {
      add("wing", -0.42, 1.5, 0, 0.55);
      add("wing", 0.42, 1.5, 0, 0.55);
    } else if (id === "summoner") {
      add("halo", 0, 2.25, 0, 1);
    } else if (id === "paladin") {
      add("body", -0.4, 1.3, 0.22, 1.4);
      add("halo", 0, 2.25, 0, 0.8);
    } else {
      for (const s of [-1, 1]) add("wing", s * 0.2, 2.2, 0, 0.7);
    }
    g.playerVisual.add(this.accessory);
  }
  state() {
    const c = classDefinition(this.id()),
      t = this.game._state.elapsed;
    return {
      id: this.id(),
      name: c?.name || "",
      passive: c?.passive || "",
      magicHits: this.magicHits,
      stacks: this.stacks,
      haste: Math.max(0, this.hasteUntil - t),
      dashBoost: Math.max(0, this.dashUntil - t),
      shield: this.shield,
      shieldCooldown: Math.max(0, this.nextShield - t),
      healCooldown: Math.max(0, this.nextHeal - t),
    };
  }
  dispose() {
    this.pet.removeFromParent();
    this.accessory?.removeFromParent();
    Object.values(this.geometry).forEach((x) => x.dispose());
    this.material.dispose();
    Object.values(this.classMaterials || {}).forEach((m) => m.dispose());
  }
}
