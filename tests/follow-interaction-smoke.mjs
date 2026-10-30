import assert from "node:assert/strict";
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
const output = process.env.SMOKE_OUTPUT;
if (output) await mkdir(output, { recursive: true });
const base = process.env.BASE_URL || "http://127.0.0.1:5201";
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
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error/.test(m.text())) errors.push(m.text());
  });
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.optFixture = () => {
      g.start();
      g.spawnTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e9;
      g.invulnerable = 1e9;
      g._state.xpNeeded = 1e12;
      g.setViewMode("overhead");
      g.cameraShake = 0;
      g.emit();
      return g;
    };
    window.optFixture();
  });
  const stable = await p.evaluate(() => {
    const g = window.__game,
      root = document.getElementById("spell-loadout"),
      before = [...root.querySelectorAll(".spell-slot-icon")].map(
        (n) => n.firstChild,
      ),
      o = new MutationObserver(() => {});
    o.observe(root, { childList: true, subtree: true, attributes: true });
    for (let i = 0; i < 40; i++) g.emit();
    const records = o.takeRecords();
    o.disconnect();
    return {
      mutations: records.length,
      same: before.every(
        (n, i) => n === root.querySelectorAll(".spell-slot-icon")[i].firstChild,
      ),
    };
  });
  assert.deepEqual(stable, { mutations: 0, same: true });
  const cooldown = await p.evaluate(() => {
    const g = window.__game,
      slot = document.querySelector('[data-action-slot="0"]'),
      icon = slot.querySelector(".spell-slot-icon").firstChild;
    g.actions.press("skill0");
    const paid = slot.querySelector(".spell-slot-rank").textContent;
    g.actions.update(0.7);
    for (let i = 0; i < 70; i++) g.magic.update(0.01);
    g.emit();
    const ticking = slot.querySelector(".spell-slot-rank").textContent;
    for (let i = 0; i < 1200; i++) g.magic.update(0.01);
    g.emit();
    return {
      paid,
      ticking,
      ready: slot.classList.contains("skill-ready"),
      same: icon === slot.querySelector(".spell-slot-icon").firstChild,
    };
  });
  assert.equal(cooldown.paid, "12.0s");
  assert.equal(cooldown.ticking, "11.3s");
  assert.ok(cooldown.ready && cooldown.same);
  console.log(
    "PASS unchanged HUD emits create no slot mutations; actual paid/ticking/ready cooldowns preserve icon nodes",
  );
  await p.evaluate(() => {
    const g = optFixture();
    g.setBindings({ ...g.bindings, interact: "t" });
    const npc = g.exploration.spawn("merchant");
    g.player.position.copy(npc.group.position);
    g.player.position.x += 3.21;
    g.emit();
  });
  assert.equal(await p.locator("#interaction-prompt").isVisible(), false);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.x -= 0.12;
    g.emit();
  });
  assert.equal(await p.locator("#interaction-prompt").isVisible(), true);
  assert.equal(await p.locator("#interact-npc kbd").textContent(), "T");
  assert.match(await p.locator("#interact-npc").textContent(), /떠돌이 상인/);
  if (output) await p.screenshot({ path: `${output}/desktop-interaction.png` });
  await p.keyboard.press("c");
  assert.equal(await p.evaluate(() => window.__game.state.phase), "playing");
  await p.keyboard.press("t");
  assert.equal(await p.evaluate(() => window.__game.state.phase), "npc");
  assert.equal(await p.locator("#interaction-prompt").isVisible(), false);
  await p.evaluate(() => {
    const g = optFixture();
    g._state.phase = "menu";
    if (!g.camp.enter()) throw Error("camp entry");
    g.player.position.set(-8, 0, -3.1);
    g.emit();
  });
  assert.match(await p.locator("#interact-npc").textContent(), /대장간/);
  await p.keyboard.press("t");
  assert.equal(await p.locator("#modal-backdrop").isVisible(), true);
  assert.ok(await p.evaluate(() => window.__game.camp.suspended));
  await p.keyboard.press("Escape");
  await p.evaluate(() => {
    const g = optFixture();
    g.sideAreas.spawnPortal();
    g.player.position.copy(g.sideAreas.portal.group.position);
    g.emit();
  });
  assert.match(
    await p.locator("#interact-npc").textContent(),
    /비밀 공간 입구/,
  );
  await p.locator("#interact-npc").click();
  assert.equal(await p.evaluate(() => window.__game.state.phase), "portal");
  await p.evaluate(() => {
    const g = optFixture();
    if (!g.sideAreas.enter("ancient")) throw Error("room entry");
    g.player.position.set(0, 0, -3);
    g.emit();
  });
  assert.match(await p.locator("#interact-npc").textContent(), /고대 기록/);
  await p.keyboard.press("t");
  await p.evaluate(() => window.__game.emit());
  assert.ok(await p.evaluate(() => window.__game.sideAreas.active.claimed));
  assert.equal(await p.locator("#interaction-prompt").isVisible(), false);
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 10);
    g.emit();
  });
  assert.match(await p.locator("#interact-npc").textContent(), /원래 전장/);
  await p.keyboard.press("t");
  assert.equal(await p.evaluate(() => window.__game.sideAreas.active), null);
  console.log(
    "PASS exact proximity and configured key for actual NPC dialogue, camp facility, portal, room record and exit; used and modal targets hide",
  );
  await p.evaluate(() => {
    const g = optFixture();
    if (!g.sideAreas.enter("trial")) throw Error("trial entry");
    g.player.position.set(0, 0, -3);
    for (const enemy of [...g.sideAreas.active.targets])
      g.hitEnemy(enemy, enemy.hp + 1);
    g.emit();
  });
  assert.ok(await p.evaluate(() => window.__game.sideAreas.active.complete));
  assert.match(await p.locator("#interact-npc").textContent(), /보상 받기/);
  await p.keyboard.press("t");
  assert.ok(await p.evaluate(() => window.__game.sideAreas.active.claimed));
  assert.equal(await p.evaluate(() => window.__game.state.phase), "equipment");
  await p.locator('[data-equipment-choice="skip"]').click();
  assert.equal(await p.locator("#interaction-prompt").isVisible(), false);
  console.log(
    "PASS actual room enemy deaths unlock the reward prompt and configured key claims the equipment reward exactly once",
  );
  const cameras = await p.evaluate(() => {
    const g = optFixture(),
      results = [];
    const measure = () => {
      g.updateCamera(1 / 60);
      const d = g.camera
          .getWorldDirection(g.player.position.clone())
          .setY(0)
          .normalize(),
        f = g.player.position
          .clone()
          .set(Math.sin(g.player.rotation.y), 0, Math.cos(g.player.rotation.y));
      return d.dot(f);
    };
    for (const mode of ["third", "first"]) {
      g.setViewMode(mode);
      g.player.rotation.y = 1.1;
      g.actions.hasAim = false;
      g.view.snap = true;
      const start = measure();
      g.view.rotate(85, 16);
      const turned = measure(),
        yaw = g.player.rotation.y;
      g.keys.add("w");
      for (let i = 0; i < 8; i++) {
        g.advanceSimulation(1 / 60);
        measure();
      }
      g.keys.clear();
      let stable = g.player.rotation.y === yaw;
      g.keys.add("a");
      const side = g.inputDirection().clone(),
        forward = side.clone().set(Math.sin(yaw), 0, Math.cos(yaw));
      const strafe = Math.abs(side.dot(forward)) < 1e-8;
      for (let i = 0; i < 8; i++) {
        g.advanceSimulation(1 / 60);
        measure();
      }
      g.keys.clear();
      stable = stable && g.player.rotation.y === yaw;
      g.actions.press("light");
      const a = g.actions.current,
        locked = g.player.rotation.y,
        attackDirection = a.direction.clone();
      g.view.rotate(90, 0);
      const active = measure(),
        held =
          g.player.rotation.y === locked && a.direction.equals(attackDirection);
      g.actions.update(a.duration + 0.01);
      const after = measure(),
        pending = g.player.rotation.y !== locked;
      g.renderer.render(g.scene, g.camera);
      results.push({
        mode,
        start,
        turned,
        active,
        after,
        stable,
        strafe,
        held,
        pending,
        following: g.view.getState().following,
      });
    }
    return results;
  });
  assert.ok(
    cameras.every(
      (c) =>
        [c.start, c.turned, c.active, c.after].every((n) => n > 0.999999) &&
        c.stable &&
        c.strafe &&
        c.held &&
        c.pending &&
        c.following,
    ),
    JSON.stringify(cameras),
  );
  console.log(
    "PASS first/third camera matches character heading through turning, movement, locked attack and buffered facing changes",
    JSON.stringify(cameras),
  );
  if (output)
    for (const mode of ["third", "first"]) {
      await p.evaluate((mode) => {
        const g = window.__game;
        g.setViewMode(mode);
        g.view.snap = true;
        g.updateCamera(1);
        g.renderer.render(g.scene, g.camera);
      }, mode);
      await p.screenshot({ path: `${output}/desktop-${mode}.png` });
    }
  const wall = await p.evaluate(() => {
    const g = window.__game,
      c = g.world.colliders.find((c) => c.id === "chapel");
    g.setViewMode("third");
    g.player.position.set(c.x + 0.9, g.groundHeight(c.x + 0.9, c.z), c.z);
    g.player.rotation.y = Math.PI / 2;
    g.view.snap = true;
    g.updateCamera(1);
    const x = g.camera.position.x;
    g.pause();
    const pos = g.player.position.clone();
    g.stepForTest(0.3);
    const paused = g.player.position.equals(pos);
    g.resume();
    return { clear: x > c.x + 0.4, paused };
  });
  assert.ok(wall.clear && wall.paused);
  await p.close();
  const m = await b.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  m.setDefaultTimeout(60000);
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto(base);
  await m.waitForFunction(() => window.__game?.artReady);
  await m.locator("#start-button").tap();
  await m.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer = 1e9;
    const npc = g.exploration.spawn("merchant");
    g.player.position.copy(npc.group.position);
    g.emit();
  });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await m.setViewportSize(viewport);
    await m.evaluate(() => {
      const g = window.__game;
      g.resize();
      g.view.snap = true;
      g.updateCamera(1);
      g.renderer.render(g.scene, g.camera);
    });
    const layout = await m.evaluate(() => {
      const prompt = document
          .getElementById("interact-npc")
          .getBoundingClientRect(),
        controls = [
          document.querySelector(".dpad"),
          document.getElementById("mobile-actions"),
        ].map((n) => n.getBoundingClientRect()),
        overlaps = controls.some(
          (r) =>
            prompt.left < r.right &&
            prompt.right > r.left &&
            prompt.top < r.bottom &&
            prompt.bottom > r.top,
        );
      return {
        overlaps,
        inside:
          prompt.left >= 0 &&
          prompt.top >= 0 &&
          prompt.right <= innerWidth &&
          prompt.bottom <= innerHeight,
        scroll:
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight,
      };
    });
    if (output)
      await m.screenshot({ path: `${output}/mobile-${viewport.width}.png` });
    assert.ok(
      layout.inside && layout.scroll && !layout.overlaps,
      JSON.stringify({ viewport, layout }),
    );
  }
  await m.locator("#interact-npc").tap();
  assert.equal(await m.evaluate(() => window.__game.state.phase), "npc");
  assert.deepEqual(errors, []);
  console.log(
    "PASS camera collision/pause retained and actual mobile interaction tap, no control overlap or document scroll in portrait/landscape",
  );
} finally {
  await b.close();
}
