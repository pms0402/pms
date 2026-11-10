import * as THREE from "three";
import { HIDDEN_BOSSES } from "./story.js";
import { buildSculptedMonster, sculptedGeometry } from './sculpted-models.js';
import {annulusWarning,BOSS_COMBAT} from './boss-combat.js';
export class HiddenBossSystem {
  constructor(game) {
    this.game = game;
    this.geometry = {
      sphere: new THREE.SphereGeometry(1, 20, 14),
      ring: new THREE.TorusGeometry(1, 0.07, 8, 40),
      shard: new THREE.OctahedronGeometry(0.4, 0),
      blade: new THREE.BoxGeometry(0.18, 3, 0.12),
      crown: new THREE.ConeGeometry(0.17, 0.7, 8),
    };
    this.materials = {
      gold: new THREE.MeshStandardMaterial({
        color: "#cab474",
        metalness: 0.7,
        roughness: 0.35,
      }),
      void: new THREE.MeshStandardMaterial({
        color: "#342041",
        emissive: "#6d378f",
        emissiveIntensity: 0.6,
        roughness: 0.5,
      }),
      eye: new THREE.MeshBasicMaterial({ color: "#e1a5ef" }),
      red: new THREE.MeshStandardMaterial({
        color: "#68313e",
        emissive: "#932f51",
        emissiveIntensity: 0.5,
        roughness: 0.6,
      }),
    };
    this.boss = null;
  }
  model(id) {
    const g = this.game,
      root = new THREE.Group(),
      mat =
        id === "king"
          ? this.materials.gold
          : id === "observer"
            ? this.materials.void
            : this.materials.red;
    if(id==='observer'||id==='primordial'){
      buildSculptedMonster(g,root,4,mat,'hidden_'+id);
      root.userData.design='hidden_'+id;
      return root;
    }
    const add = (geo, x, y, z, sx = 1, sy = sx, sz = sx, m = mat) => {
      const mesh = new THREE.Mesh(this.geometry[geo], m);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      root.add(mesh);
      return mesh;
    };
    if (id === "king") {
      const body = g.playerVisual.clone(true);
      body.scale.setScalar(2);
      body.rotation.set(0, 0, 0);
      root.add(body);
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        add("crown", Math.sin(a) * 0.45, 4.5, Math.cos(a) * 0.45);
      }
      this.sword = new THREE.Mesh(sculptedGeometry(g,'weapon_cleaver'),mat);
      this.sword.position.set(1,2.3,.8);this.sword.scale.set(.30,.13,3.4);
      this.sword.rotation.x=-Math.PI/2;root.add(this.sword);
    } else if (id === "observer") {
      add("sphere", 0, 2, 0, 1.9, 1.35, 1.25);
      add("sphere", 0, 2, 1.1, 0.72, 0.8, 0.25, this.materials.eye);
      add("shard", 0, 2, 1.38, 0.4, 1.4, 0.3);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        add(
          "shard",
          Math.sin(a) * 2.5,
          2 + Math.cos(a) * 0.5,
          Math.cos(a) * 2.5,
          0.8,
          1.6,
          0.8,
        );
      }
      add("ring", 0, 2, 0, 2.3, 2.3, 2.3);
    } else {
      add("sphere", 0, 2.2, 0, 2.3, 1.6, 2);
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4;
        const ring = add(
          "ring",
          Math.sin(a) * 1.8,
          1 + Math.cos(a) * 0.5,
          Math.cos(a) * 1.8,
          1,
          1.6,
          1,
        );
        ring.rotation.z = a;
        add("shard", Math.sin(a) * 2.8, 2.5, Math.cos(a) * 2.8, 1, 2, 1);
      }
      add("sphere", 0, 2.5, 1.9, 0.6, 0.8, 0.25, this.materials.eye);
    }
    return root;
  }
  spawn(id) {
    const g = this.game,
      info = HIDDEN_BOSSES.find((b) => b.id === id);
    if (!info) return null;
    const e = g.spawnEnemy(0, -5, 4, { noMutations: true });
    if (!e) return null;
    e.hiddenBoss = id;
    e.archetype = id;
    e.name = info.name;
    e.hint = info.hint;
    e.hp = e.maxHp =
      g.bossStats().health *
      (id === "primordial" ? 1.6 : 1.2) *
      g.getThreat().enemyHealth;
    e.group.scale.setScalar(1);
    e.size = 3;
    e.speed = 2.8;
    e.visual.visible = false;
    e.specialModel = this.model(id);
    e.group.add(e.specialModel);
    e.group.updateWorldMatrix(true,true);
    const bounds=new THREE.Box3(),partBounds=new THREE.Box3();
    e.specialModel.traverseVisible(part=>{if(!part.isMesh)return;part.geometry.computeBoundingBox();partBounds.copy(part.geometry.boundingBox).applyMatrix4(part.matrixWorld);bounds.union(partBounds);});
    e.hurtHeight=Math.max(.75,bounds.max.y-bounds.min.y);
    e.mode = "chase";
    e.hiddenTimer = 1.5;
    e.hiddenAction = 0;
    e.hiddenComboRemaining=0;
    e.aimDirection = new THREE.Vector3(0, 0, 1);
    g.boss = e;
    g.bossSpawned = true;
    g.bossDefeated = false;
    g.bossSystem.boss = e;
    g.bossSystem.color = info.color;
    g.bossPhases.begin(e);g.bossArena?.begin(e);
    this.boss = e;
    g.callbacks.onBoss?.(g.state.boss);
    return e;
  }
  zone(p, r, w, l, d, type = "pulse", inner = 0) {
    const g = this.game,
      z = g.bossSystem.zone(p, r, w, l, d, type);
    if (z && inner) {
      z.terrainPulse=true;
      z.innerRadius = inner;
      const mesh = z.marker.children[0];
      mesh.geometry.dispose();
      mesh.geometry = new THREE.RingGeometry(inner / r, 1, 48, 6);
      g.fitGroundMesh(mesh, 0.13);
      const rim = new THREE.Mesh(
        new THREE.RingGeometry(inner / r - 0.012, inner / r, 48),
        mesh.material.clone(),
      );
      rim.material.opacity = 0.8;
      rim.rotation.x = -Math.PI / 2;
      rim.scale.setScalar(r);
      z.marker.add(rim);
      g.fitGroundMesh(rim, 0.14);
    }
    return z;
  }
  update(e, dt) {
    const g = this.game,
      p = g.player.position,
      prev = e.combatPhase;
    g.bossPhases.sync(e);
    if (prev !== e.combatPhase) {
      e.hiddenPending = null;
      e.hiddenTimer = 1.5;
    }
    e.hiddenTimer -= dt;
    if(e.hiddenBoss==='king'&&g.bossPhases.rush){g.bossPhases.update(e,dt);return;}
    e.slowTime = Math.max(0, (e.slowTime || 0) - dt);
    const phase = e.combatPhase,
      t = g._state.elapsed;
    const direction = p.clone().sub(e.group.position).setY(0),
      distance = direction.length();
    direction.normalize();
    if (e.specialModel && e.hiddenBoss !== "king") {
      e.specialModel.rotation.y = 0;
      e.specialModel.position.y = Math.sin(t * 2) * 0.2;
    }
    if (e.hiddenBoss === "king" && !e.hiddenPending && distance > 4) {
      const step=g.bossArena?.active?g.bossArena.terrain.steer(e.group.position,direction.x*distance,direction.z*distance,1.4,0):direction;
      e.group.position.addScaledVector(
        new THREE.Vector3(step.x,0,step.z),
        e.speed * (e.slowTime > 0 ? 0.65 : 1) * dt,
      );
      e.group.rotation.y = Math.atan2(direction.x, direction.z);
    }
    if (this.sword)
      this.sword.rotation.z = e.hiddenPending ? Math.sin(t * 8) * 0.5 : -0.2;
    if (e.hiddenTimer <= 0) {
      if (e.hiddenPending) this.resolve(e);
      else if (!g.bossSystem.zones.length && !g.bossSystem.pendingShots.length)
        this.prepare(e);
    }
    if (e.hiddenBoss === "king" && distance < 1.8)
      g.takeDamage(
        g.bossStats().damage * 0.55,
        e.group.position,
        `${e.name} 근접`,
        e,
      );
    g.resolvePosition(e.group.position, 1.4,7.5);
  }
  prepare(e) {
    const g = this.game,
      p = g.player.position.clone(),
      phase = e.combatPhase,
      d = g.bossStats().damage;
    e.hiddenAction++;e.visualCast=.35;
    const dir = p.clone().sub(e.group.position).setY(0).normalize();
    e.aimDirection.copy(dir);
    if (e.hiddenBoss === "king") {
      const distance=e.group.position.distanceTo(p);
      if(distance>9&&!e.hiddenComboRemaining){g.bossPhases.startRush(e,phase===3?2:1);e.attackCue='왕의 돌진 · 푸른 직선에서 이탈/패링';e.hiddenTimer=.5;return;}
      if(!e.hiddenComboRemaining){e.hiddenComboRemaining=phase===3?3:phase===2?2:1;e.comboTotal=e.hiddenComboRemaining;}
      e.comboStep=e.comboTotal-e.hiddenComboRemaining+1;e.attackCue=`왕의 검격 ${e.comboStep}/${e.comboTotal} · 마지막 베기 뒤 반격`;
      const z = this.zone(
        e.group.position,
        6,
        phase === 3 ? 0.85 : 1.1,
        0.18,
        0,
        "blade",
      );
      if (z) {
        z.parryable = true;
        const m = z.marker.children[0];
        m.geometry.dispose();
        m.geometry = new THREE.RingGeometry(
          0.03,
          1,
          48,
          5,
          -Math.PI / 3,
          (Math.PI * 2) / 3,
        );
        m.rotation.z = Math.atan2(dir.x, dir.z) - Math.PI / 2;
        m.material.color.set("#8bdcff");
        g.fitGroundMesh(m, 0.13);
        if (z.marker.children[1]) z.marker.children[1].visible = false;
      }
      e.hiddenPending = {
        type: "blade",
        position: e.group.position.clone(),
        direction: dir,
      };
      e.hiddenTimer = phase === 3 ? 0.85 : 1.1;
    } else if (e.hiddenBoss === "observer") {
      e.attackCue='균열 도약 → 부채꼴 탄막 · 조준선 옆으로';
      const dest = p
        .clone()
        .add(
          new THREE.Vector3(
            Math.sin(e.hiddenAction * 2) * 6,
            0,
            Math.cos(e.hiddenAction * 2) * 6,
          ),
        );
      const rift=g.bossArena?.blinkTarget();if(rift)dest.copy(rift);g.resolvePosition(dest, 1.4,7.5);
      if (dest.distanceTo(p) < 4)
        dest.copy(p).setY(0).normalize().multiplyScalar(-7);
      this.zone(dest, 2, 1.2, 0.18, 0, "blink");
      e.hiddenPending = { type: "blink", destination: dest };
      e.hiddenTimer = 1.2;
    } else {
      if (e.hiddenAction % 3 === 1) {
        const inner=g.bossArena?.active?7:4,outer=g.bossArena?.active?28:12,warning=annulusWarning(Math.hypot(p.x,p.z),g.combatStats?.speed,inner);
        e.attackCue=`외곽 파문 · 중앙 ${inner}m 안전`;
        this.zone(
          new THREE.Vector3(),
          outer,
          warning,
          0.18,
          d * 1.1,
          "primordial",
          inner,
        );
        e.hiddenPending = { type: "annulus" };
        e.hiddenTimer = warning;
      } else if(e.hiddenAction%3===2){
        const radius=g.bossArena?.active?9:6,warning=Math.max(1.25,(radius-Math.hypot(p.x,p.z)+1)/Math.max(3,g.combatStats?.speed||7.5)+.5);
        const z=this.zone(new THREE.Vector3(),radius,warning,.2,d*1.05,'core');if(z)z.terrainPulse=true;e.hiddenPending={type:'core'};e.hiddenTimer=warning;e.attackCue=`중앙 붕괴 · ${radius}m 밖으로 이동`;
      } else {
        e.attackCue='추적 손아귀 · 붉은 표식에서 이동';
        for (const side of [0, 1])
          this.zone(
            p.clone().add(new THREE.Vector3(side * 4, 0, 0)),
            3.4,
            1.2,
            0.2,
            d * 0.8,
            "grasp",
          );
        e.hiddenPending = { type: "grasp" };
        e.hiddenTimer = 1.2;
      }
    }
  }
  resolve(e) {
    e.visualAttack=.36;this.game.bossArena?.attack(e.hiddenPending?.type);
    const g = this.game,
      d = g.bossStats().damage,
      phase = e.combatPhase,
      a = e.hiddenPending;
    e.hiddenPending = null;
    if (a.type === "blade") {
      const delta = g.player.position.clone().sub(a.position).setY(0),
        length = delta.length();
      if (
        length < 6 &&
        (length < 0.001 || delta.normalize().dot(a.direction) >= 0.5)
      )
        g.takeDamage(
          d * (phase === 3 ? 1.2 : 1),
          a.position,
          `${e.name} 왕의 검격`,
          e,
        );
      g.puff(e.group.position, "#cdbb83", 2, 0.3);
      if (phase >= 2 && e.hiddenAction % 2 === 0)
        g.bossSystem.fire(e, e.aimDirection, {
          count: phase === 3 ? 5 : 3,
          spread: 0.22,
          speed: 7,
        });
    } else if (a.type === "blink") {
      e.group.position.copy(a.destination);
      const dir = g.player.position
        .clone()
        .sub(e.group.position)
        .setY(0)
        .normalize();
      g.bossSystem.warningLine({...e,aimDirection:dir},.45);
      g.bossSystem.schedule(e,.45,dir,{
        count: phase === 3 ? 9 : phase === 2 ? 7 : 5,
        spread: 0.22,
        speed: 8.5,
      });
      if(phase===3){const follow=dir.clone().applyAxisAngle(new THREE.Vector3(0,1,0),e.hiddenAction%2?.28:-.28);g.bossSystem.warningLine({...e,aimDirection:follow},.9);g.bossSystem.schedule(e,.9,follow,{count:5,spread:.18,speed:8.5});}
      if (phase >= 2)
        this.zone(g.player.position, 2.5, 1.3, 0.18, d * 0.75, "rift");
    } else if (a.type === "grasp" && phase >= 2)
      g.bossSystem.radial(e, e.hiddenAction * 0.6, 12, 3);
    if(e.hiddenBoss==='king'&&a.type==='blade'&&--e.hiddenComboRemaining>0){e.recoveryTime=0;e.hiddenTimer=BOSS_COMBAT.link;return;}
    e.chainRemaining=Math.max(0,...g.bossSystem.pendingShots.map(s=>s.delay||0),...g.bossSystem.zones.filter(z=>z.damage>0).map(z=>z.warning||0));e.recoveryTime=e.chainRemaining+(phase===3?.9:1.1);e.hiddenTimer=phase===3?.5:.75;e.attackCue=e.chainRemaining>0?'후속 공격 · 예고 종료 뒤 반격':'공격 종료 · 반격 기회';
  }
  clear() {
    this.boss = null;
    this.sword = null;
  }
  dispose() {
    this.clear();
    Object.values(this.geometry).forEach((x) => x.dispose());
    Object.values(this.materials).forEach((m) => m.dispose());
  }
}
