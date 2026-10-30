import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.BASE_URL || "http://127.0.0.1:5191",
  browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: [
      "--no-sandbox",
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
  });
const errors = [];
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/Shader Error|GL_INVALID|THREE.WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    window.actionFixture = () => {
      const g = window.__game;
      g.start();
      cancelAnimationFrame(g.raf);
      g.spawnTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e6;
      g.invulnerable = 1e6;
      g.stats.critChance = 0;
      g._state.xpNeeded = 1e9;
      g.setViewMode("overhead");
      g.player.rotation.y = 0;
      g.actions.hasAim = false;
      g.updateCamera(100);
      g.renderer.render(g.scene, g.camera);
      return g;
    };
    window.advanceAction = (seconds) => {
      const g = window.__game;
      for (let i = 0; i < Math.ceil(seconds / 0.01); i++)
        g.advanceSimulation(0.01);
      g.emit();
    };
    window.actionFixture();
  });
  const target = await p.evaluate(() => {
    const g = window.__game;
    g.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 };
    g.stats.evolutions = {
      fireball: true,
      frost: true,
      lightning: true,
      orbit: true,
    };
    g.actions.syncSlots();
    window.front = g.spawnEnemy(0, 2, 0, { noMutations: true });
    window.rear = g.spawnEnemy(0, -1, 0, { noMutations: true });
    for (const e of [front, rear]) {
      e.hp = e.maxHp = 1e9;
      e.speed = 0;
      e.tactics = { phase: "circle", timer: 1e6, angle: 0 };
    }
    window.advanceAction(12);
    const point = g.player.position.clone().set(0, 0, 8).project(g.camera),
      r = g.renderer.domElement.getBoundingClientRect();
    return {
      idle: front.hp === 1e9 && rear.hp === 1e9,
      casts: { ...g.magic.spellsCast },
      orbs: g.magic.orbs.length,
      x: r.x + ((point.x + 1) * r.width) / 2,
      y: r.y + ((1 - point.y) * r.height) / 2,
    };
  });
  assert.ok(
    target.idle &&
      Object.values(target.casts).every((n) => n === 0) &&
      target.orbs === 0,
  );
  await p.mouse.click(target.x, target.y);
  const strike = await p.evaluate(() => {
    const g = window.__game,
      before = front.hp;
    window.advanceAction(0.1);
    const windup = front.hp;
    window.advanceAction(0.15);
    return {
      before,
      windup,
      after: front.hp,
      rear: rear.hp,
      commands: g.actions.manualCommands,
    };
  });
  assert.equal(strike.before, 1e9);
  assert.equal(strike.windup, 1e9);
  assert.ok(strike.after < 1e9 && strike.rear === 1e9 && strike.commands === 1);
  console.log(
    "PASS no-input never attacks/casts/orbits; actual left click commits at contact toward aim, not nearer rear enemy",
    JSON.stringify(strike),
  );
  await p.evaluate(() => {
    window.advanceAction(0.5);
  });
  await p.keyboard.press("q");
  const castBefore = await p.evaluate(() => ({
    count: window.__game.magic.spellsCast.fireball,
    cd: window.__game.magic.cooldowns.fireball,
  }));
  assert.equal(castBefore.count, 0);
  assert.ok(castBefore.cd > 8);
  await p.evaluate(() => window.advanceAction(0.7));
  assert.equal(
    await p.evaluate(() => window.__game.magic.spellsCast.fireball),
    1,
  );
  await p.keyboard.press("q");
  await p.evaluate(() => window.advanceAction(0.5));
  assert.equal(
    await p.evaluate(() => window.__game.magic.spellsCast.fireball),
    1,
  );
  await p.keyboard.press("e");
  await p.evaluate(() => window.advanceAction(0.8));
  assert.equal(await p.evaluate(() => window.__game.magic.spellsCast.frost), 1);
  assert.equal(await p.locator("#modal-backdrop").isVisible(), false);
  await p.keyboard.press("r");
  await p.evaluate(() => window.advanceAction(0.8));
  assert.equal(
    await p.evaluate(() => window.__game.magic.spellsCast.lightning),
    1,
  );
  console.log(
    "PASS Q/E/R manual casts, preparation, long per-spell cooldowns and no E inventory/R interaction conflicts",
  );
  await p.keyboard.press("b");
  assert.equal(await p.locator(".modal-skills").isVisible(), true);
  const preserved = await p.evaluate(
    () => window.__game.magic.cooldowns.fireball,
  );
  await p.locator('[data-skill-equip="2"]').selectOption("orbit");
  assert.equal(
    await p.evaluate(() => window.__game.stats.skillSlots[2]),
    "orbit",
  );
  assert.equal(
    await p.evaluate(() => window.__game.magic.cooldowns.fireball),
    preserved,
  );
  await p.keyboard.press("Escape");
  await p.keyboard.press("r");
  await p.evaluate(() => window.advanceAction(0.9));
  assert.ok(
    await p.evaluate(() =>
      window.__game.magic.zones.some((z) => z.type === "rune"),
    ),
  );
  await p.keyboard.press("x");
  await p.evaluate(() => window.advanceAction(1.2));
  assert.ok(
    await p.evaluate(() => window.__game.actions.ultimateCooldown > 40),
  );
  console.log(
    "PASS three active slots, bench preservation, manually installed rune field and independent ultimate",
  );
  for (const mode of ["third", "first", "overhead"]) {
    await p.evaluate((mode) => {
      const g = window.actionFixture();
      g.setViewMode(mode);
      g.player.rotation.y = 0;
      g.actions.hasAim = false;
      const e = g.spawnEnemy(0, 2, 0, { noMutations: true });
      e.hp = e.maxHp = 1e6;
      e.speed = 0;
      e.tactics = { phase: "circle", timer: 1e6 };
      window.modeTarget = e;
    }, mode);
    await p.keyboard.press("q");
    await p.evaluate(() => window.advanceAction(0.8));
    assert.equal(
      await p.evaluate(() => window.__game.magic.spellsCast.fireball),
      1,
    );
  }
  console.log("PASS direct skill inputs in all three retained camera modes");
  await p.evaluate(() => window.actionFixture());
  await p.keyboard.press("Tab");
  assert.equal(await p.locator(".modal-inventory").isVisible(), true);
  await p.keyboard.press("Escape");
  await p.locator("#settings").click();
  await p.locator('[data-bind="light"]').click();
  await p.keyboard.press("z");
  assert.equal(await p.evaluate(() => window.__game.bindings.light), "z");
  await p.keyboard.press("Escape");
  await p.evaluate(() => window.actionFixture());
  await p.keyboard.press("z");
  assert.equal(await p.evaluate(() => window.__game.actions.manualCommands), 1);
  await p.reload();
  await p.waitForFunction(() => window.__game?.artReady);
  assert.equal(await p.evaluate(() => window.__game.bindings.light), "z");
  console.log(
    "PASS Tab inventory, configurable physical key, exclusive binding and persisted controls",
  );
  await p.close();
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.__game?.artReady);
  await mobile.locator("#start-button").click();
  await mobile.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer = 1e6;
  });
  const b = await mobile.locator("#mobile-light").boundingBox();
  await mobile.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
  assert.equal(
    await mobile.evaluate(() => window.__game.actions.manualCommands),
    1,
  );
  await mobile.evaluate(() => {
    const g = window.__game;
    g.actions.update(g.actions.current.duration - 0.12);
  });
  await mobile.locator("#mobile-heavy").tap();
  assert.ok(await mobile.evaluate(() => window.__game.actions.buffer));
  await mobile.evaluate(() => {
    const g = window.__game;
    g.actions.update(0.14);
    if (!g.actions.current?.heavy)
      throw Error("Touch heavy must follow the buffered light");
    g.actions.update(g.actions.current.duration + 0.01);
  });
  await mobile.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 80; i++) g.advanceSimulation(0.01);
    g.emit();
  });
  const q = await mobile.locator('[data-action-slot="0"]').boundingBox();
  await mobile.touchscreen.tap(q.x + q.width / 2, q.y + q.height / 2);
  assert.equal(
    await mobile.evaluate(() => window.__game.actions.current.id),
    "fireball",
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await mobile.setViewportSize(viewport);
    const ui = await mobile.evaluate(() => {
      const ids = [
          "mobile-light",
          "mobile-heavy",
          "mobile-parry",
          "touch-dash",
        ],
        rects = ids.map((id) =>
          document.getElementById(id).getBoundingClientRect().toJSON(),
        );
      return {
        rects,
        w: innerWidth,
        h: innerHeight,
        sw: document.documentElement.scrollWidth,
        sh: document.documentElement.scrollHeight,
      };
    });
    assert.ok(ui.sw <= ui.w + 1 && ui.sh <= ui.h + 1);
    assert.ok(
      ui.rects.every(
        (r) =>
          r.width >= 43 &&
          r.height >= 43 &&
          r.x >= 0 &&
          r.y >= 0 &&
          r.right <= ui.w + 1 &&
          r.bottom <= ui.h + 1,
      ),
      JSON.stringify(ui),
    );
  }
  console.log(
    "PASS actual mobile attack/skill taps, reachable action controls, portrait/landscape without page scroll",
  );
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
