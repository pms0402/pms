import * as THREE from "three";
import {BOSS_COMBAT,chargeTravel} from "./boss-combat.js";
export const bossPhase = (hp, maxHp) =>
  hp / Math.max(1, maxHp) < 0.35 ? 3 : hp / Math.max(1, maxHp) < 0.7 ? 2 : 1;
export const PHASE_PATTERNS = Object.freeze({
  king: "왕의 검격과 연계 탄막",
  observer: "예고 순간이동과 다중 탄막",
  primordial: "안전 원과 심연의 파문",
  warden: "연속 돌진과 충격파",
  artillery: "추적 포격과 지연 폭격",
  plague: "독의 고리 · 중앙 안전지대",
  brood: "강화 군단과 진형 공격",
  storm: "회전 탄막과 지연 낙뢰",
  reaper: "다중 잔상과 교차 파동",
});
export class BossPhases {
  constructor(game) {
    this.game = game;
    this.geometry = new THREE.TorusGeometry(1.1, 0.035, 6, 40);
    this.material = new THREE.MeshBasicMaterial({
      color: "#ffba67",
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    this.clear();
  }
  begin(boss) {
    this.clear();
    this.boss = boss;
    boss.aimDirection ||= new THREE.Vector3(0, 0, 1);
    boss.combatPhase = 1;
    boss.phaseCooldown = 7;
    this.aura = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const ring = new THREE.Mesh(this.geometry, this.material);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.15 + i * 1.8;
      this.aura.add(ring);
    }
    this.aura.visible = false;
    boss.group.add(this.aura);
  }
  sync(boss = this.boss) {
    if (!boss || boss.hp <= 0 || boss !== this.boss) return;
    const phase = bossPhase(boss.hp, boss.maxHp);
    if (phase <= boss.combatPhase) return;
    for (let next = boss.combatPhase + 1; next <= phase; next++)
      this.transitions.push(next);
    this.game.bossArena?.phase(boss,phase);
    boss.combatPhase = phase;boss.recoveryTime=0;boss.chainRemaining=0;boss.transitionTime=BOSS_COMBAT.transition;boss.comboPlan=[];boss.comboPattern=null;boss.attackCue="페이즈 전환 · 보호 해제 후 공격";
    boss.phaseCooldown = 2;
    if (boss.hiddenBoss) { boss.hiddenPending = null; boss.hiddenRush=null;boss.hiddenComboRemaining=0; boss.hiddenTimer = .5; }
    this.game.clearTelegraph?.(boss);
    this.game.bossSystem.cancelAttacks();
    this.rush = null;
    boss.mode = "chase";
    boss.actionTimer = .4;
    this.aura.visible = true;
    this.aura.children[1].visible = phase === 3;
    this.aura.scale.setScalar(phase === 3 ? 1.18 : 1);
    this.material.color.set(phase === 3 ? "#ff755f" : "#f5ca81");
    this.game.burst?.(
      boss.group.position,
      phase === 3 ? "#ff755f" : "#f5ca81",
      12,
    );
    this.game.callbacks.onLoot?.(
      `${boss.name} · ${phase}페이즈 · ${PHASE_PATTERNS[boss.archetype]}`,
    );
  }
  update(boss, dt) {
    this.sync(boss);
    if (!boss || boss !== this.boss || boss.hp <= 0) return false;
    this.aura?.rotateY(dt * 0.7);
    if (this.rush) {
      const r = this.rush;
      r.time -= dt;
      if (r.warning) {
        if (r.time <= 0) {
          this.game.clearTelegraph(boss);
          r.warning = false;boss.mode="phase-charge";boss.visualAttack=.36;this.game.bossArena?.attack("charge");
          r.time = r.duration;
        }
      } else {
        const before=boss.group.position.clone();boss.group.position.addScaledVector(r.direction, dt * 24);
        if(this.game.bossArena?.crush(before,boss.group.position,boss))return true;
        this.game.resolvePosition?.(boss.group.position, 1.4,7.5);
        if (boss.group.position.distanceTo(this.game.player.position) < 2.3)
          this.game.takeDamage(
            this.game.bossStats().damage,
            boss.group.position,
            `${boss.name} 연속 돌진`,
            boss,
          );
        if (boss.parryStun > 0) return true;
        if (r.time <= 0) {
          if (--r.left > 0) this.startRush(boss, r.left);
          else {
            this.rush = null;
            boss.mode = "recovery";boss.chainRemaining=1.1;boss.recoveryTime=1.1+BOSS_COMBAT.recovery;boss.attackCue="마지막 충격파 · 예고 종료 뒤 반격";
            boss.actionTimer = 2;
            this.game.bossSystem.zone(
              boss.group.position,
              6,
              1.1,
              0.18,
              this.game.bossStats().damage,
              "pulse",
            );
          }
        }
      }
      return true;
    }
    boss.phaseCooldown -= dt;
    if (
      boss.combatPhase >= 2 &&
      boss.phaseCooldown <= 0 &&
      boss.mode === "chase" &&
      !this.game.bossSystem.zones.length &&
      !this.game.bossSystem.pendingShots.length
    ) {
      this.special(boss);
      boss.phaseCooldown = boss.combatPhase === 3 ? 6.5 : 8.5;
      boss.actionTimer = Math.max(boss.actionTimer, 3.2);
      return true;
    }
    return false;
  }
  startRush(boss, left) {
    const direction = this.game.player.position
      .clone()
      .sub(boss.group.position)
      .setY(0)
      .normalize();
    if (!direction.lengthSq()) direction.set(0, 0, 1);
    boss.chargeDirection = direction;
    const distance=boss.group.position.distanceTo(this.game.player.position);boss.chargeTravel=chargeTravel(distance);
    boss.mode = "phase-charge-warning";boss.attackCue=`연속 돌진 ${left}회 · 마지막 타격 뒤 반격`;
    this.game.createBossTelegraph(boss, "charge");
    this.rush = { left, direction, time: .9, duration:boss.chargeTravel/24, warning: true };
  }
  special(boss) {
    const g = this.game,
      sys = g.bossSystem,
      damage = g.bossStats().damage,
      target = g.player.position.clone(),
      final = boss.combatPhase === 3;
    this.patterns++;
    boss.comboPlan=[];boss.comboPattern=null;boss.attackCue=PHASE_PATTERNS[boss.archetype]||'특수 연계 · 예고 확인';
    sys.color = final ? "#ff655e" : "#f5ba74";
    if (boss.archetype === "warden") {
      this.startRush(boss, final ? 3 : 2);
      return;
    }
    if (boss.archetype === "artillery") {
      const direction = target
        .clone()
        .sub(boss.group.position)
        .setY(0)
        .normalize();
      boss.aimDirection.copy(direction);
      const count = final ? 5 : 3;
      for (let i = 0; i < count && sys.zones.length < 12; i++) {
        const a =
          Math.atan2(direction.x, direction.z) + (i - (count - 1) / 2) * 0.22;
        const aim = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
        if (sys.marker)
          sys.zones.push({
            position: boss.group.position.clone(),
            radius: 0,
            warning: 1.1,
            life: 0.01,
            damage: 0,
            type: "aim",
            active: false,
            marker: sys.marker(boss.group.position, 0.5, {
              type: "line",
              direction: aim,
              length: 24,
            }),
          });
      }
      sys.schedule(boss, 1.1, direction, {
        count: final ? 5 : 3,
        spread: 0.22,
        speed: 7,
        tracking: 1,
      });
      sys.zone(target, 2.6, 1.8, 0.18, damage * 0.85, "pulse");
    } else if (boss.archetype === "plague") {
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        sys.zone(
          target
            .clone()
            .add(new THREE.Vector3(Math.sin(a) * 7, 0, Math.cos(a) * 7)),
          final ? 3.4 : 2.8,
          1.5,
          final ? 4 : 3,
          damage * 0.6,
          "pool",
        );
      }
    } else if (boss.archetype === "brood") {
      for (
        let i = 0;
        i < (final ? 6 : 4) && g.enemies.length < 160 && (sys.summonCapacity?sys.summonCapacity(boss)>0:sys.summoned<18);
        i++
      ) {
        const pos = g.bossArena?.minionPosition(i)||g.spawnPosition(9, 13),
          child = g.spawnEnemy(pos.x, pos.z, [2, 5, 3][i % 3], {
            minion: true,
          });
        if (child) {
          child.hp *= 1.25;
          child.maxHp *= 1.25;
          if(sys.registerSummon)sys.registerSummon(child,boss);else sys.summoned++;
        }
      }
      for (const side of [-1, 1])
        sys.zone(
          target.clone().add(new THREE.Vector3(side * 5, 0, 0)),
          3,
          1.4,
          0.2,
          damage * 0.85,
          "pulse",
        );
    } else if (boss.archetype === "storm") {
      sys.zone(boss.group.position, 2, 1.2, 0.16, 0, "pulse");
      sys.schedule(boss, 1.2, null, {
        radial: true,
        angle: this.patterns * 0.7,
      });
      for (const side of [-1, 1])
        sys.zone(
          target.clone().add(new THREE.Vector3(side * 4, 0, side * 2)),
          2.3,
          final ? 1.8 : 2.1,
          0.18,
          damage * 0.9,
          "lightning",
        );
    } else {
      for (const side of [-1, 1])
        sys.zone(
          target.clone().add(new THREE.Vector3(side * 5, 0, 0)),
          2.8,
          1.4,
          0.18,
          damage * 0.8,
          "echo",
        );
      if (final || boss.variant > 1)
        sys.zone(
          target.clone().add(new THREE.Vector3(0, 0, 5)),
          2.8,
          2.1,
          0.18,
          damage,
          "echo",
        );
    }
    if(!this.rush){const warning=Math.max(0,...(sys.pendingShots||[]).map(s=>s.delay||0),...(sys.zones||[]).map(z=>z.warning||z.w||0));boss.chainRemaining=warning;boss.recoveryTime=warning+BOSS_COMBAT.recovery;boss.mode='recovery';}
  }
  clear() {
    this.aura?.removeFromParent();
    this.aura = null;
    this.boss = null;
    this.rush = null;
    this.transitions = [];
    this.patterns = 0;
  }
  getState() {
    return {
      phase: this.boss?.combatPhase || 0,
      transitions: [...this.transitions],
      patterns: this.patterns,
      rush: !!this.rush,
    };
  }
  dispose() {
    this.clear();
    this.geometry.dispose();
    this.material.dispose();
  }
}
