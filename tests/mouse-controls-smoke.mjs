import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5301",
  out = process.env.SMOKE_OUTPUT;
if (out) await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const errors = [],
  result = {};
const locked = (p) =>
  p.waitForFunction(
    () => document.pointerLockElement === window.__game.renderer.domElement,
  );
const unlocked = (p) => p.waitForFunction(() => !document.pointerLockElement);
const watch = (p) => {
  p.setDefaultTimeout(15000);
  p.on("pageerror", (e) => errors.push(e.message));
};
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  watch(p);
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await locked(p);
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e9;
    g._state.xpNeeded = 1e12;
  });
  result.start = await p.evaluate(() => ({
    locked: !!document.pointerLockElement,
    input: window.__game.view.getState().inputMode,
    commands: window.__game.actions.manualCommands,
  }));
  assert.deepEqual(result.start, { locked: true, input: "mouse", commands: 0 });
  result.movement = [];
  for (const mode of ["third", "first"]) {
    if (mode === "first") {
      await p.keyboard.press("v");
      await locked(p);
    }
    const row = await p.evaluate(() => {
      const g = window.__game,
        yaw = g.player.rotation.y,
        start = g.player.position.clone();
      g.keys.add("d");
      for (let i = 0; i < 60; i++) {
        g.advanceSimulation(1 / 120);
        g.updateCamera(1 / 120);
      }
      const moved = g.player.position.clone().sub(start).setY(0),
        f = start.clone().set(Math.sin(yaw), 0, Math.cos(yaw));
      g.keys.clear();
      return {
        mode: g.view.mode,
        yawChange: Math.abs(g.player.rotation.y - yaw),
        distance: moved.length(),
        side: Math.abs(moved.normalize().dot(f)),
        camera: g.camera
          .getWorldDirection(f.clone())
          .setY(0)
          .normalize()
          .dot(f),
      };
    });
    assert.ok(
      row.yawChange < 1e-10 &&
        row.distance > 2 &&
        row.side < 1e-8 &&
        row.camera > 0.999999,
      JSON.stringify(row),
    );
    result.movement.push(row);
    const before = await p.evaluate(() => window.__game.player.rotation.y);
    await p.mouse.move(650, 450);
    await p.mouse.move(720, 470);
    assert.ok(
      await p.evaluate(
        (yaw) => Math.abs(window.__game.player.rotation.y - yaw) > 0.05,
        before,
      ),
    );
  }
  console.log(
    "PASS run-start pointer lock, no acquisition attack, mouse-only first/third look and fixed-heading strafing",
  );
  // The game must release for choices and recapture on that same click/key.
  for (const kind of ["click", "keyboard"]) {
    await p.evaluate(() => {
      const g = window.__game;
      g._state.xp = g._state.xpNeeded;
      g.openLevelUp();
    });
    await unlocked(p);
    assert.ok(await p.locator("[data-upgrade]").first().isVisible());
    if (kind === "click") await p.locator("[data-upgrade]").first().click();
    else await p.keyboard.press("1");
    await locked(p);
    assert.equal(await p.evaluate(() => window.__game.state.phase), "playing");
  }
  // A fourth spell opens another mandatory menu: don't steal its cursor.
  await p.evaluate(() => {
    const g = window.__game;
    g.stats.spells = { fireball: 1, frost: 1, lightning: 1 };
    g.actions.syncSlots();
    g._state.phase = "upgrade";
    g.upgradeChoices = [
      {
        id: "spell_orbit",
        category: "spell",
        spellId: "orbit",
        title: "룬",
        description: "네 번째 스킬",
      },
    ];
    g.callbacks.onLevelUp(g.upgradeChoices);
  });
  await unlocked(p);
  await p.locator('[data-upgrade="spell_orbit"]').click();
  assert.equal(await p.evaluate(() => window.__game.state.phase), "skill-swap");
  assert.equal(await p.evaluate(() => !!document.pointerLockElement), false);
  await p.locator('[data-skill-swap="-1"]').click();
  await locked(p);
  // The real opened chest takes its chosen relic and resumes pointer lock.
  await p.evaluate(() => {
    const g = window.__game;
    g._state.xp = 0;
    g._state.xpNeeded = 1e12;
    const chest = g.spawnChest(g.player.position.x, g.player.position.z);
    for (const e of chest.guards) g.hitEnemy(e, e.maxHp * 1000);
    g.tick(0.01);
  });
  await unlocked(p);
  await p.locator("[data-chest-relic]").first().click();
  await locked(p);
  // Exercise the boss equipment -> route -> region transition without another canvas click.
  await p.evaluate(() => {
    const g = window.__game;
    const b = g.spawnBoss();
    g.hitEnemy(b, b.maxHp * 1000);
    g.equipment.nextReward();
  });
  await unlocked(p);
  await p.locator('[data-equipment-choice="skip"]').click();
  await locked(p);
  await p.evaluate(() => {
    const g = window.__game;
    g._state.stageTime = 120;
    if (!g.nextStage() || g.state.phase !== "route")
      throw Error(
        "route fixture " +
          JSON.stringify({
            phase: g.state.phase,
            stage: g.state.stage,
            goal: g.state.objective,
            boss: g.state.bossDefeated,
            spawned: g.state.bossSpawned,
          }),
      );
  });
  await unlocked(p);
  await p.locator('[data-route="standard"]').click();
  assert.equal(await p.evaluate(() => !!document.pointerLockElement), false);
  await p.locator("[data-region]").first().click();
  await locked(p);
  result.choices = {
    mouse: true,
    keyboard: true,
    skillSwap: true,
    chest: true,
    equipment: true,
    region: true,
    commands: await p.evaluate(() => window.__game.actions.manualCommands),
  };
  assert.equal(result.choices.commands, 0);
  console.log(
    "PASS native click/number reward selection, chained skill swap, chest, equipment and route/region recapture with no accidental attack",
  );
  await p.evaluate(() => {
    const g = window.__game,
      y = g.player.rotation.y;
    const e = g.spawnEnemy(
      g.player.position.x + Math.sin(y) * 2,
      g.player.position.z + Math.cos(y) * 2,
      0,
      { noMutations: true },
    );
    e.speed = 0;
    e.hp = e.maxHp = 1e8;
    window.lockedAttackTarget = e;
  });
  await p.mouse.click(640, 450);
  result.lockedAttack = await p.evaluate(() => {
    const g = window.__game,
      accepted = g.actions.manualCommands === 1;
    g.actions.update(g.actions.current.duration + 0.01);
    return {
      accepted,
      hit: window.lockedAttackTarget.hp < 1e8,
      locked: !!document.pointerLockElement,
    };
  });
  assert.ok(Object.values(result.lockedAttack).every(Boolean));
  await p.mouse.click(640, 450, { button: "middle" });
  // ESC is an intentional unlock; never immediately fight it by reacquiring.
  await p.keyboard.press("Escape");
  await unlocked(p);
  assert.ok(await p.locator("#resume").isVisible());
  await p.waitForTimeout(1100); // Chromium's user-initiated escape cooldown.
  assert.equal(await p.evaluate(() => !!document.pointerLockElement), false);
  await p.locator("#resume").click();
  await locked(p);
  await p.keyboard.press("v");
  await unlocked(p);
  assert.equal(await p.evaluate(() => window.__game.view.mode), "overhead");
  await p.keyboard.press("v");
  await locked(p);
  assert.equal(await p.evaluate(() => window.__game.view.mode), "third");
  await p.keyboard.press("Escape");
  await unlocked(p);
  await p.waitForTimeout(1100);
  // Rejected embedded/browser pointer lock must retain a usable middle-drag fallback.
  await p.evaluate(() => {
    const g = window.__game;
    g.renderer.domElement.requestPointerLock = () =>
      Promise.reject(new DOMException("Unavailable", "NotAllowedError"));
  });
  await p.locator("#resume").click();
  assert.equal(await p.evaluate(() => window.__game.state.phase), "playing");
  const box = await p.locator("#game-canvas").boundingBox(),
    x = box.x + box.width * 0.65,
    y = box.y + box.height * 0.5;
  const yaw = await p.evaluate(() => window.__game.player.rotation.y);
  await p.mouse.move(x, y);
  await p.mouse.down({ button: "middle" });
  await p.mouse.move(x + 80, y + 10);
  await p.mouse.up({ button: "middle" });
  assert.ok(
    await p.evaluate(
      (before) => Math.abs(window.__game.player.rotation.y - before) > 0.1,
      yaw,
    ),
  );
  result.escapeAndFallback = true;
  await p.close();
  const m = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(m);
  await m.addInitScript(() => {
    window.captureRequests = 0;
    const original = Element.prototype.requestPointerLock;
    Element.prototype.requestPointerLock = function (...args) {
      window.captureRequests++;
      return original?.apply(this, args);
    };
  });
  await m.goto(base);
  await m.waitForFunction(() => window.__game?.artReady);
  await m.locator("#start-button").tap();
  assert.equal(
    await m.evaluate(() => window.__game.view.getState().inputMode),
    "touch",
  );
  await m.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e9;
    g._state.xpNeeded = 1e12;
  });
  const cdp = await m.context().newCDPSession(m),
    right = await m.locator('[data-move="1,0"]').boundingBox();
  const before = await m.evaluate(() => window.__game.player.rotation.y);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: right.x + right.width / 2, y: right.y + right.height / 2, id: 1 },
    ],
  });
  await m.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 48; i++) {
      g.advanceSimulation(1 / 120);
      g.updateCamera(1 / 120);
    }
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  result.touch = await m.evaluate(
    (yaw) => ({
      turn: Math.abs(
        Math.atan2(
          Math.sin(window.__game.player.rotation.y - yaw),
          Math.cos(window.__game.player.rotation.y - yaw),
        ),
      ),
      locked: !!document.pointerLockElement,
      requests: window.captureRequests,
    }),
    before,
  );
  assert.ok(
    result.touch.turn > 0.3 &&
      result.touch.turn < 0.8 &&
      !result.touch.locked &&
      result.touch.requests === 0,
    JSON.stringify(result.touch),
  );
  await m.evaluate(() => {
    const g = window.__game;
    g._state.xp = g._state.xpNeeded;
    g.openLevelUp();
  });
  await m.locator("[data-upgrade]").first().tap();
  assert.equal(await m.evaluate(() => window.captureRequests), 0);
  // A mouse attached to a touch-capable device changes policy on real pointer input.
  await m.mouse.move(200, 400);
  assert.equal(
    await m.evaluate(() => window.__game.view.getState().inputMode),
    "mouse",
  );
  result.hybrid = await m.evaluate(() => {
    const g = window.__game,
      y = g.player.rotation.y;
    g.keys.add("d");
    for (let i = 0; i < 48; i++) g.advanceSimulation(1 / 120);
    g.keys.clear();
    return {
      yawChange: Math.abs(g.player.rotation.y - y),
      steeringSpeed: g.view.movement.speed,
    };
  });
  assert.ok(
    result.hybrid.yawChange < 1e-10 && result.hybrid.steeringSpeed === 0,
  );
  assert.ok(
    await m.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.documentElement.scrollHeight <= innerHeight,
    ),
  );
  if (out) await m.screenshot({ path: out + "/mobile.png" });
  assert.deepEqual(errors, []);
  if (out)
    await writeFile(
      out + "/verification.json",
      JSON.stringify({ ...result, errors }, null, 2) + "\n",
    );
  console.log(
    "PASS native touch steering, touch reward choices without lock requests, real attached-mouse switch, ESC and rejected-lock fallback",
  );
} finally {
  await browser.close();
}
