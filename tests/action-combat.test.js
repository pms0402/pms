import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  ActionCombat,
  normalizedSlots,
  swordAction,
  SKILL_TIMINGS,
  swordPoseProgress,
} from "../src/action-combat.js";
import {
  DEFAULT_BINDINGS,
  normalizeBindings,
  rebind,
  controlKey,
} from "../src/control-bindings.js";
function fixture(style = "default") {
  const hits = [],
    casts = [],
    g = {
      stats: {
        attackRate: 1.5,
        weaponId: "voidblade",
        swordEvolution: style === "default" ? "" : style,
        spells: { fireball: 1, frost: 1, lightning: 1, orbit: 1 },
        spellRate: 1.5,
      },
      combatStats: { attackRate: 1.5 },
      player: new THREE.Group(),
      _state: { phase: "playing" },
      callbacks: {},
      parry: {
        active: 0,
        counterTime: 0,
        consume() {
          this.counterTime = 0;
        },
      },
      analytics: {},
      swordTrail: { reset() {} },
      classes: { command() {} },
      resolvePosition() {},
      emit() {},
      sound() {},
      resolveSwordAction(a) {
        hits.push({ time: a.elapsed, index: a.nextMarker, profile: a.profile, direction: a.direction.clone() });
      },
    };
  g.magic = {
    rank: (id) => g.stats.spells[id],
    cooldowns: { fireball: 0, frost: 0, lightning: 0, orbit: 0 },
    maxCooldown: (id) => SKILL_TIMINGS[id].cooldown,
    castManual: (id) => casts.push(id),
  };
  g.actions = new ActionCombat(g);
  const advance = (seconds) => {
    for (let i = 0; i < Math.ceil(seconds / 0.005); i++)
      g.actions.update(0.005);
  };
  return { g, hits, casts, advance };
}
test("no input never starts an attack or a spell; input wind-up has no damage until contact", () => {
  const f = fixture();
  f.advance(3);
  assert.equal(f.hits.length, 0);
  assert.equal(f.casts.length, 0);
  assert.ok(f.g.actions.press("light"));
  const a = f.g.actions.current;
  f.advance(a.duration * 0.3);
  assert.equal(f.hits.length, 0);
  f.advance(a.duration * 0.15);
  assert.equal(f.hits.length, 1);
  f.advance(2);
  assert.equal(f.hits.length, 1);
});
test("aim steers the ongoing stroke immediately without skipping recovery or adding attacks", () => {
  const f = fixture();
  f.g.actions.setAim(new THREE.Vector3(1, 0, 0));
  f.g.actions.press("light");
  const a = f.g.actions.current;
  f.g.actions.setAim(new THREE.Vector3(-1, 0, 0));
  assert.equal(a.direction.x, -1);
  assert.equal(f.g.player.rotation.y, -Math.PI / 2);
  for (let i = 0; i < 30; i++) assert.equal(f.g.actions.press("light"), false);
  f.advance(a.duration - 0.1);
  assert.ok(f.g.actions.press("light"));
  f.g.actions.press("light");
  f.advance(0.12);
  assert.equal(f.g.actions.manualCommands, 2);
  assert.equal(f.hits.length, 1);
  assert.equal(f.hits[0].direction.x, -1);
});
test("ordinary combo ends at three and twinblade finisher commits exactly three bounded hits", () => {
  for (const style of ["default", "twinblade"]) {
    const f = fixture(style),
      max = style === "twinblade" ? 5 : 3;
    for (let i = 0; i < max; i++) {
      assert.ok(f.g.actions.press("light"));
      f.advance(f.g.actions.current.duration + 0.005);
    }
    assert.equal(f.g.actions.combo, 0);
    assert.equal(f.hits.length, style === "twinblade" ? 7 : 3);
    assert.ok(f.hits.at(-1).profile.damageMultiplier > 0);
  }
});
test('turning a twinblade finisher changes each authored contact without duplicating hits', () => {
  const f=fixture('twinblade');f.g.actions.combo=4;f.g.actions.press('light');
  const a=f.g.actions.current,directions=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(-1,0,0)];
  assert.equal(a.markers.length,3);
  for(let i=0;i<3;i++){
    f.g.actions.setAim(directions[i]);
    f.g.actions.update(a.duration*a.markers[i]-a.elapsed+1e-8);
    assert.equal(f.hits.length,i+1);assert.ok(f.hits[i].direction.equals(directions[i]));
  }
  for(let i=0;i<20;i++)f.g.actions.setAim(new THREE.Vector3(Math.sin(i),0,Math.cos(i)));
  const facing=f.g.player.rotation.y;f.advance(a.duration-a.elapsed+.02);
  assert.equal(f.hits.length,3);assert.equal(f.g.actions.manualCommands,1);assert.equal(f.g.player.rotation.y,facing);
});
test('a charged heavy stays freely steerable through holding, release and recovery', () => {
  const f=fixture('broadsword');f.g.actions.press('heavy');
  f.g.actions.setAim(new THREE.Vector3(1,0,0));f.advance(1.2);assert.equal(f.hits.length,0);
  f.g.actions.releaseHeavy();const a=f.g.actions.current;
  f.g.actions.setAim(new THREE.Vector3(0,0,-1));assert.equal(a.direction.z,-1);
  f.advance(a.duration+.02);assert.equal(f.hits.length,1);assert.equal(f.hits[0].direction.z,-1);
  assert.equal(f.g.player.rotation.y,Math.PI);assert.ok(f.g.actions.heavyCooldown>2);
});
test('looking during a spell does not freeze the camera or move an already chosen cast target', () => {
  const f=fixture();f.g.actions.setAim(new THREE.Vector3(1,0,0));f.g.actions.press('skill0');
  const a=f.g.actions.current,target=a.target.clone();f.g.actions.setAim(new THREE.Vector3(-1,0,0));
  assert.equal(f.g.player.rotation.y,-Math.PI/2);assert.ok(a.target.equals(target));
  f.advance(a.duration+.02);assert.equal(f.g.player.rotation.y,-Math.PI/2);assert.equal(f.casts.length,1);
});
test("charge deals no damage on hold or cancellation; release consumes a four-second heavy cooldown", () => {
  const f = fixture("broadsword");
  assert.ok(f.g.actions.press("heavy"));
  f.advance(2);
  assert.equal(f.hits.length, 0);
  assert.equal(f.g.actions.charge, 1);
  f.g.actions.clearInput();
  assert.equal(f.g.actions.releaseHeavy(), false);
  assert.ok(f.g.actions.press("heavy"));
  f.advance(1.2);
  assert.ok(f.g.actions.releaseHeavy());
  assert.equal(f.g.actions.heavyCooldown, 4);
  const charged = f.g.actions.current.profile.damageMultiplier;
  f.advance(2);
  assert.equal(f.hits.length, 1);
  assert.ok(
    charged >
      swordAction(f.g.stats, f.g.combatStats, "heavy", 0, 0).profile
        .damageMultiplier,
  );
  assert.equal(f.g.actions.press("heavy"), false);
});
test("counter is spent once on manual input and never resumes attacking by itself", () => {
  const f = fixture();
  f.g.parry.counterTime = 2;
  f.advance(0.5);
  assert.equal(f.hits.length, 0);
  f.g.actions.press("light");
  assert.equal(f.g.parry.counterTime, 0);
  f.advance(2);
  assert.equal(f.hits.length, 1);
  assert.equal(f.hits[0].profile.damageMultiplier, 2.5);
});
test("skills reserve cooldown on press, commit after cast time and cancellation never refunds it", () => {
  const f = fixture();
  assert.ok(f.g.actions.press("skill0"));
  assert.equal(f.g.magic.cooldowns.fireball, 12);
  f.advance(0.2);
  assert.equal(f.casts.length, 0);
  f.g.actions.cancel();
  assert.equal(f.g.magic.cooldowns.fireball, 12);
  assert.equal(f.g.actions.press("skill0"), false);
  f.g.magic.cooldowns.fireball = 0;
  assert.ok(f.g.actions.press("skill0"));
  f.advance(1);
  assert.deepEqual(f.casts, ["fireball"]);
});
test("only three unique learned spells can be equipped and swaps preserve per-spell cooldowns", () => {
  const f = fixture();
  assert.deepEqual(f.g.actions.syncSlots(), ["fireball", "frost", "lightning"]);
  assert.equal(f.g.actions.equip(2, "orbit"), false);
  f.g._state.phase = "paused";
  f.g.magic.cooldowns.fireball = 11;
  assert.ok(f.g.actions.equip(2, "orbit"));
  assert.deepEqual(f.g.stats.skillSlots, ["fireball", "frost", "orbit"]);
  assert.ok(f.g.actions.equip(1, "fireball"));
  assert.deepEqual(f.g.stats.skillSlots, ["frost", "fireball", "orbit"]);
  assert.equal(f.g.magic.cooldowns.fireball, 11);
  assert.deepEqual(
    normalizedSlots({
      spells: { frost: 1 },
      skillSlots: ["frost", "frost", "fake"],
    }),
    ["frost", null, null],
  );
});
test("ultimate has a separate input, paid cooldown and long interruptible cast", () => {
  const f = fixture();
  f.g.actions.press("ultimate");
  assert.equal(f.g.actions.ultimateCooldown, 45);
  f.advance(0.6);
  assert.equal(f.casts.length, 0);
  f.advance(0.4);
  assert.deepEqual(f.casts, ["ultimate"]);
  assert.equal(f.g.actions.press("ultimate"), false);
});
test("high legacy haste still preserves readable actions and bounded hit markers", () => {
  const stats = { weaponId: "tempest", swordEvolution: "twinblade" },
    spec = swordAction(stats, { attackRate: 1e9 }, "light", 4);
  assert.ok(spec.duration > 0.3);
  assert.equal(spec.markers.length, 3);
  assert.ok(spec.markers.every((v) => v > 0 && v < 1));
});
test("bindings are physical/IME safe, unique and corrupt old preferences fall back without touching saves", () => {
  assert.equal(controlKey({ type: "keydown", key: "ㅂ", code: "KeyQ" }), "q");
  assert.equal(controlKey({ type: "pointerdown", button: 2 }), "mouse2");
  assert.deepEqual(normalizeBindings({ dash: "q" }), DEFAULT_BINDINGS);
  assert.equal(rebind(DEFAULT_BINDINGS, "dash", "q").ok, false);
  const changed = rebind(DEFAULT_BINDINGS, "dash", " ");
  assert.equal(changed.ok, true);
  assert.equal(normalizeBindings(changed.bindings).dash, " ");
});

test("heavy and twin multi-hit artwork cross the contact pose at every damage marker", () => {
  for (const [style, type, index] of [
    ["default", "light", 0],
    ["broadsword", "heavy", 2],
    ["twinblade", "light", 4],
  ]) {
    const a = swordAction(
      { swordEvolution: style },
      { attackRate: 1.5 },
      type,
      index,
    );
    for (const marker of a.markers) {
      a.elapsed = marker * a.duration;
      assert.ok(Math.abs(swordPoseProgress(a) - 0.42) < 1e-10);
    }
    for (let i = 0; i <= 100; i++) {
      a.elapsed = (a.duration * i) / 100;
      const pose = swordPoseProgress(a);
      assert.ok(Number.isFinite(pose) && pose >= -1e-10 && pose <= 1 + 1e-10);
    }
  }
});
test("twinblade rewards a completed dash with a single faster follow-up without bypassing recovery", () => {
  const f = fixture("twinblade");
  f.g._state.elapsed = 1;
  f.g.manualDashUntil = 1.5;
  f.g.actions.press("light");
  const first = f.g.actions.current.duration;
  f.advance(first + 0.01);
  f.g.actions.press("light");
  assert.ok(f.g.actions.current.duration > first);
  assert.equal(f.g.manualDashUntil, 0);
});

test("new run clears a previous dash follow-up and placement distance", () => {
  const f = fixture("twinblade");
  f.g.manualDashUntil = 100;
  f.g.actions.aimDistance = 2;
  f.g.actions.reset();
  assert.equal(f.g.manualDashUntil, 0);
  assert.equal(f.g.actions.aimDistance, 12);
});

test("a frame that crosses recovery preserves an input queued at the buffer boundary", () => {
  const f = fixture();
  f.g.actions.press("light");
  const a = f.g.actions.current;
  f.g.actions.update(a.duration - 0.179);
  assert.ok(f.g.actions.press("light"));
  f.g.actions.update(0.2);
  assert.equal(f.g.actions.manualCommands, 2);
  assert.ok(f.g.actions.current);
});

test("a prepared counter uses one counter profile even from charged/heavy or twin finisher inputs", () => {
  for (const style of ["broadsword", "twinblade"]) {
    const f = fixture(style);
    f.g.actions.combo = 4;
    f.g.actions.heavyCooldown = 3;
    f.g.parry.counterTime = 2;
    assert.ok(f.g.actions.press("heavy"));
    const a = f.g.actions.current;
    assert.ok(a.counter && !a.heavy && !a.finisher);
    assert.equal(a.profile.targets, 24);
    assert.equal(a.markers.length, 1);
    assert.equal(f.g.actions.charging, false);
    assert.equal(f.g.actions.heavyCooldown, 3);
    assert.equal(a.profile.range, style === "broadsword" ? 3.5 : 3.4);
  }
});

test("a single late-dash input starts after the dash and never creates automatic follow-up attacks",()=>{
 const f=fixture();f.g.dashTime=.1;assert.ok(f.g.actions.press('light'));assert.equal(f.g.actions.current,null);
 f.g.dashTime=0;f.g.actions.update(.02);assert.equal(f.g.actions.current.type,'sword');f.advance(2);assert.equal(f.hits.length,1);assert.equal(f.g.actions.current,null);
 f.g.dashTime=.19;assert.equal(f.g.actions.press('light'),false);
});
test("contact cannot be cancelled mid-swing but wind-up and weapon recovery have explicit escape windows",()=>{
 const f=fixture('broadsword');f.g.actions.press('light');const a=f.g.actions.current;assert.equal(f.g.actions.canCancel(),true);
 a.elapsed=a.duration*a.markers[0];assert.equal(f.g.actions.canCancel(),false);
 a.elapsed=a.duration*a.markers.at(-1)+.081;assert.equal(f.g.actions.canCancel(),true);assert.equal(f.g.actions.bufferWindow(),.24);
});
