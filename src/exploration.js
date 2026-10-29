import * as THREE from "three";
import { rollEquipment, EQUIPMENT_OPTIONS } from "./equipment.js";
export const NPC_TYPES = Object.freeze({
  merchant: "떠돌이 상인",
  contractor: "수상한 계약자",
  knight: "타락한 기사",
  smith: "잊혀진 대장장이",
  shrine: "신비한 제단",
});
export const NPC_WEIGHTS = Object.freeze({
  volcano: [2, 1, 2, 5, 1],
  tundra: [2, 2, 1, 2, 5],
  forest: [2, 4, 1, 1, 4],
  ruins: [5, 1, 2, 4, 1],
  void: [1, 5, 4, 1, 2],
});
export function chooseNpc(region, random = Math.random) {
  const weights = NPC_WEIGHTS[region] || [2, 2, 2, 2, 2];
  let n =
    Math.max(0, Math.min(0.99999, Number(random()) || 0)) *
    weights.reduce((a, b) => a + b, 0);
  return (
    Object.keys(NPC_TYPES).find((_, i) => (n -= weights[i]) < 0) || "shrine"
  );
}
export class ExplorationSystem {
  constructor(game) {
    this.game = game;
    this.geometry = {
      robe: new THREE.CylinderGeometry(0.35, 0.7, 1.7, 12),
      head: new THREE.SphereGeometry(0.25, 12, 10),
      staff: new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8),
      orb: new THREE.OctahedronGeometry(0.18, 0),
      base: new THREE.CylinderGeometry(0.9, 1, 0.2, 20),
    };
    this.materials = [
      new THREE.MeshStandardMaterial({ color: "#687c93", roughness: 0.7 }),
      new THREE.MeshStandardMaterial({ color: "#d5c5b0" }),
      new THREE.MeshStandardMaterial({ color: "#68503b" }),
      new THREE.MeshBasicMaterial({ color: "#ffcf7c" }),
    ];
    this.reset();
  }
  model(type) {
    const group = new THREE.Group();
    const add = (geo, mat, x, y, z) => {
      const m = new THREE.Mesh(this.geometry[geo], this.materials[mat]);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
      return m;
    };
    add("base", 2, 0, 0.1, 0);
    add("robe", 0, 0, 1, 0);
    add("head", 1, 0, 2.05, 0);
    add("staff", 2, 0.75, 1.3, 0);
    add("orb", 3, 0.75, 2.6, 0);
    if (type === "smith" || type === "knight")
      add("base", 2, -0.5, 1, 0.4).scale.set(0.5, 0.5, 0.8);
    return group;
  }
  spawn(type = chooseNpc(this.game.regionId)) {
    if (this.npc || !NPC_TYPES[type]) return false;
    const p = this.game.spawnPosition(5, 8),
      group = this.model(type);
    group.position.set(p.x, this.game.groundHeight(p.x, p.z), p.z);
    this.game.scene.add(group);
    this.npc = { type, group, used: false };
    this.game.callbacks.onLoot?.(
      `${NPC_TYPES[type]} 출현 · 가까이에서 R / 교류`,
    );
    return this.npc;
  }
  modifiers() {
    return {
      damage:
        (this.blood ? 1.15 : 1) *
        (this.buffUntil > this.game._state.elapsed ? 1.2 : 1),
      maxHp: this.blood ? 0.9 : 1,
      healing: this.healingLimited ? 0.7 : 1,
    };
  }
  threat() {
    return this.monsterPact
      ? { health: 1.15, damage: 1.1, gold: 1.25 }
      : this.trial
        ? { health: 1.15, damage: 1.1, gold: 1 }
        : { health: 1, damage: 1, gold: 1 };
  }
  offers() {
    const g = this.game,
      c = g.stageStats().coinValue;
    const offer = (id, title, description, cost = 0) => ({
      id,
      title,
      description,
      cost,
    });
    const type = this.npc.type;
    if (type === "merchant")
      return [
        offer(
          "buyGear",
          "희귀 장비 구매",
          "미보유 희귀 이상 장비 1개를 가방에 보관합니다.",
          c * 12,
        ),
        offer(
          "buyRelic",
          "유물 선택권 구매",
          "다음 레벨업에 유물 카드가 추가됩니다.",
          c * 8,
        ),
        offer(
          "potion",
          "회복약 구매",
          "최대 체력의 40% 회복. 회복 제한이 적용됩니다.",
          c * 4,
        ),
      ];
    if (type === "contractor")
      return [
        offer(
          "blood",
          "혈서 계약",
          "이번 런 최대 체력 -10%, 검·마법 피해 +15%. 즉시 회복되지 않습니다.",
        ),
        offer(
          "pact",
          "군세 계약",
          "적 체력 ×1.15·피해 ×1.1, 이후 골드 ×1.25. 기존 적도 강화됩니다.",
        ),
        offer(
          "scar",
          "상처의 대가",
          "이번 런 회복량 30% 감소. 영웅 이상 장비 1개.",
        ),
        offer(
          "trial",
          "20초 생존 계약",
          "20초 동안 적 체력 ×1.15·피해 ×1.1. 살아남으면 영웅 이상 장비. 대화·일시정지 시간 제외.",
        ),
      ].filter(
        (o) =>
          !(
            (o.id === "blood" && this.blood) ||
            (o.id === "pact" && this.monsterPact) ||
            (o.id === "scar" && this.healingLimited) ||
            (o.id === "trial" && this.trial)
          ),
      );
    if (type === "knight")
      return [
        offer(
          "duel",
          "결투 신청",
          "강화된 타락한 기사와 실제 전투. 승리하면 영웅 장비와 유물 선택권.",
        ),
        offer(
          "pay",
          "통행료 지불",
          "수집한 런 골드를 내고 기사의 축복: 30초 피해 +20%.",
          c * 3,
        ),
      ];
    if (type === "smith") {
      const items = g.equipment.equipped;
      return [
        ...items.flatMap((item) => [
          offer(
            `forge:${item.id}`,
            `${item.title} 강화 ${item.level}/5`,
            "장비 기본 효과 +12%. 최대 5회.",
            c * 8,
          ),
          ...(item.options.length
            ? [
                offer(
                  `reroll:${item.id}`,
                  `${item.title} 옵션 재설정`,
                  "첫 번째 특수 옵션 하나를 다른 옵션으로 바꿉니다.",
                  c * 6,
                ),
              ]
            : []),
        ]),
        offer(
          "craft",
          "희귀 장비 제작",
          "희귀 이상 장비를 하나 제작합니다.",
          c * 10,
        ),
      ];
    }
    return [
      offer("heal", "생명의 잔", "최대 체력의 35% 회복. 회복 제한 적용."),
      offer("bless", "전쟁의 축복", "30초 동안 검·마법 피해 +20%."),
      offer(
        "risk",
        "시련의 봉헌",
        "강화 정예 2마리 처치 시 영웅 장비. 적중당하지 않도록 주의.",
      ),
    ];
  }
  interact() {
    const g = this.game;
    if (
      g._state.phase !== "playing" ||
      !this.npc ||
      this.npc.used ||
      this.npc.group.position.distanceTo(g.player.position) > 3.2
    )
      return false;
    this.choices = this.offers();
    g._state.phase = "npc";
    g.keys.clear();
    g.touchMove = { x: 0, y: 0 };
    g.callbacks.onNpc?.(this.npc.type, this.choices);
    g.emit();
    return true;
  }
  choose(id) {
    const g = this.game;
    if (g._state.phase !== "npc" || !this.npc || this.npc.used) return false;
    const option = this.choices.find((x) => x.id === id);
    if (id !== "skip" && (!option || g._state.gold < option.cost)) return false;
    if (
      ["buyGear", "scar", "craft"].includes(id) &&
      g.equipment.bag.length >= 16
    )
      return false;
    const item = id.includes(":")
      ? g.equipment.bag.find((i) => i.id === id.split(":")[1])
      : null;
    if (id.startsWith("forge:") && (!item || item.level >= 5)) return false;
    if (id.startsWith("reroll:") && (!item || !item.options.length))
      return false;
    if (
      (id === "risk" && g.enemies.length > 158) ||
      (id === "duel" && g.enemies.length >= 160)
    )
      return false;
    if (option) g._state.gold = Math.max(0, g._state.gold - option.cost);
    const add = () =>
      g.equipment.add(
        rollEquipment(
          g._state.stage,
          g.regionId,
          Math.random,
          ["scar", "risk", "trial"].includes(id) ? 2 : 1,
        ),
      );
    if (["buyGear", "scar", "craft"].includes(id)) add();
    if (id === "scar") this.healingLimited = true;
    if (id === "buyRelic") g.pendingRelicSources.push("상인 구매");
    if (id === "potion" || id === "heal")
      g.heal(g.combatStats.maxHp * (id === "heal" ? 0.35 : 0.4));
    if (id === "blood") {
      this.blood = true;
      g._state.hp = Math.min(g._state.hp, g.combatStats.maxHp);
    }
    if (id === "pact") {
      this.monsterPact = true;
      for (const e of g.enemies) {
        e.hp *= 1.15;
        e.maxHp *= 1.15;
      }
    }
    if (id === "trial") {
      this.trial = { until: g._state.elapsed + 20 };
      for (const e of g.enemies) {
        e.hp *= 1.15;
        e.maxHp *= 1.15;
      }
    }
    if (id === "bless" || id === "pay") this.buffUntil = g._state.elapsed + 30;
    if (id.startsWith("forge:")) item.level++;
    if (id.startsWith("reroll:")) {
      const pool = EQUIPMENT_OPTIONS.filter(
        (o) => !item.options.includes(o.id),
      );
      item.options[0] = pool[Math.floor(Math.random() * pool.length)].id;
    }
    if (id === "duel" || id === "risk") {
      this.challenge = { targets: new Set(), rewarded: false };
      for (let i = 0; i < (id === "duel" ? 1 : 2); i++) {
        const p = g.spawnPosition(8, 11),
          e = g.spawnEnemy(p.x, p.z, 2, { elite: true, noMutations: true });
        e.hp *= id === "duel" ? 1.8 : 1.1;
        e.maxHp = e.hp;
        this.challenge.targets.add(e);
        if (id === "duel") {
          e.name = "타락한 기사";
          e.duelist = true;
          e.visual.visible = false;
          e.npcModel = this.model("knight");
          e.group.add(e.npcModel);
        }
      }
    }
    if (g.regionId === "void" && id !== "skip") g.story?.find("voidLens");
    g.equipment.invalidate();
    this.npc.used = true;
    this.npc.group.visible = false;
    this.choices = [];
    g._state.phase = "playing";
    g.lastTime = performance.now();
    g.emit();
    return true;
  }
  onKill(enemy) {
    const c = this.challenge;
    if (!c || c.rewarded || !c.targets.delete(enemy) || c.targets.size) return;
    c.rewarded = true;
    const item = rollEquipment(
      this.game._state.stage,
      this.game.regionId,
      Math.random,
      2,
    );
    if (!this.game.equipment.add(item))
      this.game.equipment.drop(this.game.player.position, item);
    this.game.pendingRelicSources.push("탐험 결투 승리");
  }
  update(dt) {
    const g = this.game;
    if (g._state.phase !== "playing") return;
    if (!this.npc && g._state.stageTime >= 35) this.spawn();
    if (this.npc && !this.npc.used) {
      const orb = this.npc.group.children.find(
        (x) => x.geometry === this.geometry.orb,
      );
      if (orb) {
        orb.rotation.y += dt;
        orb.position.y = 2.6 + Math.sin(g._state.elapsed * 2) * 0.08;
      }
    }
    if (this.trial && g._state.elapsed >= this.trial.until) {
      this.trial = null;
      for (const e of g.enemies) {
        e.hp /= 1.15;
        e.maxHp /= 1.15;
      }
      const item = rollEquipment(g._state.stage, g.regionId, Math.random, 2);
      if (!g.equipment.add(item)) g.equipment.drop(g.player.position, item);
      g.callbacks.onLoot?.("생존 계약 완료 · 영웅 장비 획득");
    }
  }
  clearFloor() {
    this.npc?.group.removeFromParent();
    this.npc = null;
    this.choices = [];
    this.challenge = null;
  }
  reset() {
    this.clearFloor();
    this.blood = false;
    this.monsterPact = false;
    this.healingLimited = false;
    this.buffUntil = 0;
    this.trial = null;
  }
  getState() {
    return {
      npc: this.npc
        ? {
            type: this.npc.type,
            name: NPC_TYPES[this.npc.type],
            used: this.npc.used,
            distance: this.npc.group.position.distanceTo(
              this.game.player.position,
            ),
          }
        : null,
      blood: this.blood,
      monsterPact: this.monsterPact,
      healingLimited: this.healingLimited,
      buffRemaining: Math.max(0, this.buffUntil - this.game._state.elapsed),
      trialRemaining: this.trial
        ? Math.max(0, this.trial.until - this.game._state.elapsed)
        : 0,
    };
  }
  dispose() {
    this.reset();
    Object.values(this.geometry).forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
  }
}
