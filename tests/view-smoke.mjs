import assert from "node:assert/strict";
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const errors = [];
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error/.test(m.text())) errors.push(m.text());
  });
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5181");
  await p.waitForFunction(() => window.__game?.artReady);
  assert.equal(await p.locator("#camera-mode").textContent(), "3인칭");
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer =
      g.attackTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e6;
    g.stats.spells = {};
    g.invulnerable = 1e6;
    g._state.xpNeeded = 1e9;
  });
  const result = await p.evaluate(() => {
    const g = window.__game,
      stats = JSON.stringify(g.stats),
      gold = g.state.gold,
      hp = g.state.hp,
      results = [];
    for (const mode of ["third", "first", "overhead"]) {
      g.setViewMode(mode);
      g.updateCamera(100);
      const delta = g.camera.position.clone().sub(g.player.position),
        before = g.player.position.clone();
      g.setMove(0, -1);
      for (let i = 0; i < 6; i++) g.advanceSimulation(1 / 60);
      g.setMove(0, 0);
      results.push({
        mode,
        distance: delta.length(),
        height: delta.y,
        moved: g.player.position.distanceTo(before),
        fov: g.camera.fov,
        finite: g.camera.matrixWorld.elements.every(Number.isFinite),
      });
    }
    g.setViewMode("third");
    g.view.yaw = 0;
    g.keys.add("w");
    const forward = g.inputDirection().toArray();
    g.keys.clear();
    g.view.yaw = Math.PI / 2;
    g.keys.add("w");
    const east = g.inputDirection().toArray();
    g.keys.clear();
    g.setViewMode("first");
    g.view.yaw = 0;
    const e = g.spawnEnemy(g.player.position.x, g.player.position.z + 2, 0, {
      noMutations: true,
    });
    e.hp = e.maxHp = 1e6;
    e.speed = 0;
    const before = e.hp;
    g.attack();
    for (let i = 0; i < 10; i++) g.advanceSimulation(1 / 60);
    const facing = g.player.rotation.y,
      counterPose = g.swordTrail.paths[0].length;
    let headHidden = false;
    const after = g.scene.onAfterRender;
    g.scene.onAfterRender = (...args) => {
      headHidden = !g.playerHead.visible;
      after(...args);
    };
    g.renderer.render(g.scene, g.camera);
    g.scene.onAfterRender = after;
    const restored = g.playerHead.visible;
    g.parry.reset();
    g.parry.press();
    g.invulnerable = 0;
    g.takeDamage(
      20,
      g.player.position.clone().add(g.player.position.clone().set(0, 0, 1)),
      "view test",
    );
    const parry = g.analytics.parrySuccesses === 1;
    g.setViewMode("third");
    g.renderer.render(g.scene, g.camera);
    return {
      results,
      forward,
      east,
      hit: e.hp < before,
      facing,
      counterPose,
      headHidden,
      restored,
      parry,
      unchanged:
        stats === JSON.stringify(g.stats) &&
        g.state.hp === hp &&
        g.state.gold === gold,
    };
  });
  assert.ok(result.results.every((v) => v.finite && v.moved > 0.5));
  assert.ok(result.results[0].height > 2 && result.results[0].height < 8);
  assert.ok(result.results[1].height > 3 && result.results[1].height < 3.5);
  assert.ok(result.results[2].height > 25);
  assert.ok(result.forward[2] > 0.99 && result.east[0] > 0.99);
  assert.ok(
    result.hit &&
      Math.abs(result.facing) < 0.01 &&
      result.headHidden &&
      result.restored &&
      result.parry &&
      result.unchanged,
    JSON.stringify(result),
  );
  console.log(
    "PASS real three camera modes, view-relative movement, scaled eye height, first-person blade/combat/parry and render-only self-occlusion",
    JSON.stringify(result),
  );
  const box = await p.locator("#game-canvas").boundingBox(),
    x = box.x + box.width * 0.75,
    y = box.y + box.height * 0.52;
  const orbit = await p.evaluate(() => ({
    yaw: window.__game.view.yaw,
    distance: window.__game.view.distance,
  }));
  await p.mouse.move(x, y);
  await p.mouse.down({ button: "right" });
  await p.mouse.move(x + 90, y + 12, { steps: 5 });
  await p.mouse.up({ button: "right" });
  await p.mouse.wheel(0, 250);
  assert.ok(
    await p.evaluate(
      (before) =>
        Math.abs(window.__game.view.yaw - before.yaw) > 0.2 &&
        window.__game.view.distance > before.distance,
      orbit,
    ),
  );
  await p.locator("#camera-mode").click();
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "game-canvas",
  );
  await p.keyboard.press("Space");
  assert.ok(await p.evaluate(() => window.__game.dashTime > 0));
  await p.locator("#settings").focus();
  await p.mouse.click(x, y);
  assert.equal(
    await p.evaluate(() => document.activeElement.id),
    "game-canvas",
  );
  await p.waitForFunction(
    () => document.pointerLockElement === window.__game.renderer.domElement,
  );
  const lockedYaw = await p.evaluate(() => window.__game.view.yaw);
  await p.mouse.move(x + 40, y + 10);
  assert.ok(
    await p.evaluate((yaw) => window.__game.view.yaw !== yaw, lockedYaw),
  );
  await p.keyboard.press("Escape");
  await p.waitForFunction(() => !document.pointerLockElement);
  if (await p.locator("#modal-close").isVisible())
    await p.locator("#modal-close").click();
  console.log(
    "PASS native mouse drag/orbit, wheel zoom, camera-button focus/dash and real pointer-lock movement/Escape release",
  );
  const collision = await p.evaluate(() => {
    const g = window.__game,
      wall = g.world.colliders.find((c) => c.id === "chapel");
    g.setViewMode("third");
    g.view.yaw = Math.PI / 2;
    g.view.pitch.third = 0.24;
    g.player.position.set(
      wall.x + 0.9,
      g.groundHeight(wall.x + 0.9, wall.z),
      wall.z,
    );
    g.view.snap = true;
    g.updateCamera(1);
    const blocked = g.camera.position.x > wall.x + 0.4;
    g.player.position.set(46, g.groundHeight(46, -37), -37);
    g.view.yaw = 0.3;
    g.view.pitch.third = 0;
    g.updateCamera(1);
    const terrain =
      g.camera.position.y >=
      g.groundHeight(g.camera.position.x, g.camera.position.z) + 0.23;
    g.camp.enter();
    g.updateCamera(1);
    const camp = g.camera.position.toArray().every(Number.isFinite);
    g.camp.leave();
    g.start();
    g.setViewMode("first");
    g.updateCamera(1);
    return {
      blocked,
      terrain,
      camp,
      restart:
        g.view.mode === "first" &&
        g.camera.position.distanceTo(g.player.position) < 4,
    };
  });
  assert.ok(Object.values(collision).every(Boolean), JSON.stringify(collision));
  console.log(
    "PASS wall/terrain camera clearance, camp and restart without changing combat colliders",
  );
  await p.keyboard.press("v");
  assert.equal(await p.locator("#camera-mode").textContent(), "항공");
  await p.evaluate(() =>
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ㅍ",
        code: "KeyV",
        bubbles: true,
        cancelable: true,
      }),
    ),
  );
  assert.equal(await p.locator("#camera-mode").textContent(), "3인칭");
  await p.locator("#settings").click();
  await p.locator('[data-view-mode="first"]').click();
  await p.locator("#modal-close").click();
  await p.reload();
  await p.waitForFunction(() => window.__game?.artReady);
  assert.equal(await p.locator("#camera-mode").textContent(), "1인칭");
  assert.equal(
    await p.evaluate(() => window.__game.view.effectiveMode()),
    "third",
  );
  await p.locator("#start-button").click();
  await p.evaluate(() => cancelAnimationFrame(window.__game.raf));
  await p.locator("#pause-button").click();
  assert.equal(await p.evaluate(() => document.pointerLockElement), null);
  await p.locator("#modal-close").click();
  console.log(
    "PASS V and Korean physical V, settings mode selection, saved preference, menu hero preview and pause mouse release",
  );
  const context = await b.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mobile = await context.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(process.env.BASE_URL || "http://127.0.0.1:5181");
  await mobile.waitForFunction(() => window.__game?.artReady);
  await mobile.locator("#start-button").click();
  const touch = await mobile.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    const c = g.renderer.domElement,
      r = c.getBoundingClientRect(),
      before = g.view.yaw;
    const send = (type, id, x, y) =>
      c.dispatchEvent(
        new PointerEvent(type, {
          pointerId: id,
          pointerType: "touch",
          clientX: r.left + x * r.width,
          clientY: r.top + y * r.height,
          bubbles: true,
          cancelable: true,
        }),
      );
    c.setPointerCapture = () => {};
    send("pointerdown", 11, 0.2, 0.55);
    send("pointerdown", 12, 0.8, 0.55);
    send("pointermove", 11, 0.2, 0.4);
    send("pointermove", 12, 0.95, 0.6);
    const moving = g.touchMove.y < 0,
      look = g.view.yaw !== before;
    send("pointerup", 12, 0.95, 0.6);
    const independent = g.touchMove.y < 0;
    send("pointerup", 11, 0.2, 0.4);
    return { moving, look, independent, released: g.touchMove.y === 0 };
  });
  assert.ok(Object.values(touch).every(Boolean), JSON.stringify(touch));
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await mobile.setViewportSize(size);
    assert.ok(await mobile.locator("#camera-mode").isVisible());
    assert.ok(
      await mobile.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
  }
  await context.close();
  assert.deepEqual(errors, []);
  console.log(
    "PASS independent two-touch movement/look and portrait/landscape view controls without scrolling",
  );
} finally {
  await b.close();
}
