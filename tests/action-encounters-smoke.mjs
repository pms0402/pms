import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { normalizeProgress } from "../src/progression.js";
const base = process.env.BASE_URL || "http://127.0.0.1:5191";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const errors = [];
const saved = normalizeProgress({
  bank: 123456789,
  upgrades: { power: 12, haste: 6, arcana: 10, focus: 5, vitality: 8 },
  unlocks: {
    characters: ["wanderer", "arcanist"],
    weapons: ["voidblade", "greatsword"],
  },
  loadout: { character: "arcanist", weapon: "greatsword" },
  settledRunIds: ["legacy-run"],
  lifetimeGold: 234567890,
});
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript((save) => {
    localStorage.setItem("voidrun.progression", JSON.stringify(save));
    localStorage.setItem(
      "voidrun.preferences",
      JSON.stringify({
        muted: true,
        quality: "low",
        risk: "none",
        viewMode: "third",
        shakeStrength: 0,
      }),
    );
  }, saved);
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  assert.deepEqual(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("voidrun.progression")),
    ),
    saved,
  );
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.encounterFixture = () => {
      g.start();
      g.spawnTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e6;
      g.stats.spells = {};
      g.actions.syncSlots();
      g._state.xpNeeded = 1e9;
      g._state.hp = 100;
      g.stats.regen = 0;
      g.stats.lifeOnKill = 0;
      g.stats.armor = 0;
      g.stats.critChance = 0;
      g.invulnerable = 0;
      return g;
    };
    window.encounterFixture();
  });
  const pressure = await p.evaluate(() => {
    const g = window.encounterFixture(),
      e = g.spawnEnemy(0, 6, 2, { noMutations: true });
    e.hp = e.maxHp = 1e6;
    const hp = g.state.hp;
    let warned = false,
      firstHit = 0;
    for (let i = 0; i < 1200; i++) {
      g._state.elapsed += 0.01;
      g.updateEnemies(0.01);
      warned ||= e.action === "melee-warning";
      if (g.state.hp < hp) {
        firstHit = i * 0.01;
        break;
      }
    }
    return {
      warned,
      hit: g.state.hp < hp,
      firstHit,
      recovery: e.action === "melee-recovery",
    };
  });
  assert.ok(
    pressure.warned &&
      pressure.hit &&
      pressure.recovery &&
      pressure.firstHit > 1,
    JSON.stringify(pressure),
  );
  const dodge = await p.evaluate(() => {
    const g = window.encounterFixture(),
      e = g.spawnEnemy(0, 2, 0, { noMutations: true });
    e.speed = 0;
    e.tactics = { phase: "circle", timer: 0 };
    g.updateEnemies(0.01);
    const warned = e.action === "melee-warning",
      hp = g.state.hp;
    g.player.position.x = 6;
    for (let i = 0; i < 80; i++) g.updateEnemies(0.01);
    return {
      warned,
      hp: g.state.hp === hp,
      recovery: e.action === "melee-recovery",
    };
  });
  assert.ok(Object.values(dodge).every(Boolean));
  const group = await p.evaluate(() => {
    const g = window.encounterFixture();
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4,
        e = g.spawnEnemy(Math.sin(angle) * 2, Math.cos(angle) * 2, 0, {
          noMutations: true,
        });
      e.speed = 0;
      e.tactics = { phase: "circle", timer: 0 };
    }
    g.updateEnemies(0.01);
    return g.enemies.filter((e) => e.action === "melee-warning").length;
  });
  assert.equal(group, 2);
  console.log(
    "PASS actual brute approaches and attacks after warning, locked cone can be dodged, group pressure admits two attacks",
    JSON.stringify(pressure),
  );
  await p.evaluate(() => {
    const g = window.encounterFixture();
    g.stats.spells = { fireball: 1, frost: 1, lightning: 1, orbit: 0 };
    g.stats.skillSlots = ["fireball", "frost", "lightning"];
    g.magic.cooldowns.fireball = 7;
    g._state.phase = "upgrade";
    g.upgradeChoices = [
      { id: "spell_orbit", category: "spell", spellId: "orbit" },
    ];
    g.chooseUpgrade("spell_orbit");
  });
  assert.equal(await p.evaluate(() => window.__game.state.phase), "skill-swap");
  assert.ok(await p.locator(".modal-skill-swap").isVisible());
  await p.locator('[data-skill-swap="0"]').click();
  assert.deepEqual(
    await p.evaluate(() => ({
      slots: window.__game.stats.skillSlots,
      fire: window.__game.stats.spells.fireball,
      cd: window.__game.magic.cooldowns.fireball,
      phase: window.__game.state.phase,
    })),
    {
      slots: ["orbit", "frost", "lightning"],
      fire: 1,
      cd: 7,
      phase: "playing",
    },
  );
  const passive = await p.evaluate(() => {
    const g = window.__game;
    g._state.phase = "upgrade";
    g.upgradeChoices = [{ id: "spell_area", category: "spell" }];
    return {
      chosen: g.chooseUpgrade("spell_area"),
      phase: g._state.phase,
      area: g.stats.spellAreaMultiplier,
    };
  });
  assert.ok(passive.chosen && passive.phase === "playing" && passive.area > 1);
  console.log(
    "PASS fourth learned skill opens a real replacement choice; benched ranks and cooldowns persist; magic passives cannot open an empty swap",
  );
  const heavy = await p.evaluate(() => {
    const g = window.encounterFixture();
    g.stats.weaponId = "greatsword";
    g.actions.setAim(g.player.position.clone().set(0, 0, 1));
    const e = g.spawnEnemy(0, 2, 0, { noMutations: true });
    e.speed = 0;
    e.hp = e.maxHp = 1e6;
    g.actions.press("heavy");
    g.actions.update(1.2);
    const held = e.hp === 1e6;
    g.actions.releaseHeavy();
    const a = g.actions.current;
    g.actions.update(a.duration * a.markers[0] - 0.001);
    const early = e.hp === 1e6;
    g.actions.update(0.002);
    const struck = e.hp < 1e6,
      stun = e.parryStun;
    return { held, early, struck, stun, cd: g.actions.heavyCooldown };
  });
  assert.ok(
    heavy.held && heavy.early && heavy.struck && heavy.stun > 0 && heavy.cd > 2,
  );
  console.log(
    "PASS native combat resolver: heavy charge holds damage until released contact and breaks ordinary posture",
    JSON.stringify(heavy),
  );
  const actionCanvas = await p.locator("#game-canvas").boundingBox(),
    cx = actionCanvas.x + actionCanvas.width * 0.6,
    cy = actionCanvas.y + actionCanvas.height * 0.45;
  await p.evaluate(() => {
    const g = window.encounterFixture();
    g.stats.weaponId = "voidblade";
    g.setViewMode("overhead");
  });
  await p.mouse.click(cx, cy);
  await p.evaluate(() => {
    const g = window.__game;
    g.actions.update(g.actions.current.duration - 0.12);
  });
  await p.mouse.click(cx, cy);
  await p.waitForTimeout(60);
  assert.ok(await p.evaluate(() => window.__game.actions.buffer));
  await p.evaluate(() => window.__game.actions.update(0.14));
  assert.equal(await p.evaluate(() => window.__game.actions.manualCommands), 2);
  await p.evaluate(() => {
    const g = window.encounterFixture();
    g.stats.weaponId = "greatsword";
    g.setViewMode("third");
  });
  await p.mouse.move(cx, cy);
  await p.mouse.down({ button: "right" });
  await p.waitForFunction(() => !!document.pointerLockElement);
  await p.evaluate(() => window.__game.actions.update(0.6));
  assert.ok(
    await p.evaluate(
      () =>
        window.__game.actions.charging && window.__game.actions.charge > 0.45,
    ),
  );
  await p.mouse.up({ button: "right" });
  assert.ok(await p.evaluate(() => window.__game.actions.current?.heavy));
  await p.keyboard.press("Escape");
  console.log(
    "PASS native click-release recovery buffer survives normal capture release; held/released right mouse charges a real heavy under pointer lock",
  );
  await p.evaluate(() => {
    const g = window.encounterFixture();
    window.oldControls = { ...g.bindings };
    g.setViewMode("overhead");
    g.setBindings({ ...g.bindings, light: "w", forward: "mouse0" });
    window.startPoint = g.player.position.clone();
  });
  const moveCanvas = await p.locator("#game-canvas").boundingBox();
  await p.mouse.move(
    moveCanvas.x + moveCanvas.width * 0.6,
    moveCanvas.y + moveCanvas.height * 0.45,
  );
  await p.mouse.down();
  const mouseMove = await p.evaluate(() => {
    const g = window.__game;
    g.stepForTest(0.25);
    return g.player.position.distanceTo(window.startPoint);
  });
  await p.mouse.up();
  assert.ok(mouseMove > 1);
  assert.ok(await p.evaluate(() => !window.__game.keys.has("mouse0")));
  await p.evaluate(() => {
    const g = window.__game;
    g.setBindings({ ...window.oldControls, parry: "arrowup" });
    window.startPoint = g.player.position.clone();
  });
  await p.keyboard.press("ArrowUp");
  assert.ok(
    await p.evaluate(() => {
      const g = window.__game;
      g.stepForTest(0.05);
      return (
        g.parry.active > 0 &&
        g.player.position.distanceTo(window.startPoint) < 1e-8
      );
    }),
  );
  await p.evaluate(() => window.__game.setBindings(window.oldControls));
  console.log(
    "PASS native held mouse movement binding releases cleanly; rebound arrow action does not also move the player",
  );
  await p.evaluate(() => {
    const g = window.encounterFixture();
    g.setViewMode("third");
    g.view.yaw = 0;
    g.view.pitch.third = 0.6;
    g.aimFromView();
    window.closeAim = g.actions.aimDistance;
    g.view.pitch.third = 0.1;
    g.aimFromView();
  });
  assert.ok(
    await p.evaluate(() => window.__game.actions.aimDistance > window.closeAim),
  );
  const canvas = await p.locator("#game-canvas").boundingBox();
  await p.mouse.click(
    canvas.x + canvas.width * 0.62,
    canvas.y + canvas.height * 0.45,
  );
  await p.waitForFunction(
    () => document.pointerLockElement === window.__game.renderer.domElement,
  );
  const yaw = await p.evaluate(() => window.__game.view.yaw);
  await p.mouse.move(650, 450);
  assert.notEqual(await p.evaluate(() => window.__game.view.yaw), yaw);
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => window.__game._state.phase === "paused");
  assert.deepEqual(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("voidrun.progression")),
    ),
    saved,
  );
  console.log(
    "PASS third-person pointer lock, pitch chooses placement distance, native Escape pauses and legacy saved wealth/upgrades/unlocks remain byte-equivalent",
  );
  await mkdir("/workspace/artifacts/voidrun-action/screenshots", {
    recursive: true,
  });
  await p.keyboard.press("Escape");
  await p.evaluate(() => {
    const g = window.encounterFixture();
    g.stats.spells = { fireball: 3, frost: 2, lightning: 2 };
    g.actions.syncSlots();
    g.setViewMode("third");
    g.view.yaw = 0.3;
    g.view.pitch.third = 0.35;
    for (let i = 0; i < 7; i++)
      g.spawnEnemy(Math.sin(i) * 5, Math.cos(i) * 5, [0, 1, 2, 3, 5, 7, 8][i], {
        mutations: i === 2 ? ["steel"] : [],
      });
    g.updateCamera(100);
    g.renderer.render(g.scene, g.camera);
    g.emit();
  });
  await p.screenshot({
    path: "/workspace/artifacts/voidrun-action/screenshots/manual-third.png",
  });
  await p.evaluate(() => {
    const g = window.__game;
    g.camp.enter();
    g.camp.practice = true;
    g.camp.suspended = false;
    g.parry.reset();
    g.emit();
  });
  assert.equal(await p.locator("#guard-button").isEnabled(), true);
  await p.locator("#guard-button").click();
  assert.ok(await p.evaluate(() => window.__game.parry.active > 0));
  console.log(
    "PASS camp parry practice remains usable from the visible touch/button control",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
