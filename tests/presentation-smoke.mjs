import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({
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
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5184");
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  const result = await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.start();
    g.spawnTimer =
      g.attackTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e6;
    g.stats.spells = {};
    g.stats.critChance = 0;
    g.invulnerable = 0;
    g._state.xpNeeded = 1e9;
    const stats = JSON.stringify(g.stats),
      e = g.spawnEnemy(0, 2, 0, { noMutations: true });
    e.speed = 0;
    e.hp = e.maxHp = 1e9;
    g.attackTimer = 0.1;
    g.advanceSimulation(1 / 60);
    const ready = g.swordReady > 0;
    const before = e.hp;
    g.attack();
    const contact = 1 - g.attackAnim / g.attackAnimTotal,
      hit = e.hp < before;
    e.hp = 1;
    const kills = g.state.kills;
    g.hitEnemy(e, 1000, e.group.position.clone().set(0, 0, 1), false, "sword");
    const death = {
      removed: !g.enemies.includes(e),
      reward: g.state.kills === kills + 1,
      copies: g.defeats.slots.filter((s) => s.life > 0).length,
    };
    g.defeats.update(1);
    death.finished = g.defeats.slots.every((s) => !s.root.visible);
    for (let i = 0; i < 3; i++) {
      const e = g.spawnEnemy(3 + i, 3, i, { noMutations: true });
      e[["slowTime", "freezeTime", "burnTime"][i]] = 1;
    }
    g.enemyStates.sync();
    const statuses = g.enemyStates.mesh.count,
      regions = [];
    for (const id of ["volcano", "tundra", "forest", "ruins", "void"]) {
      g.regionId = id;
      g.regionSystem.setRegion(id);
      g.landscape.update(0);
      g.atmosphere.update(0);
      g.updateCamera(100);
      g.renderer.render(g.scene, g.camera);
      regions.push({
        id,
        sky: g.atmosphere.id,
        structures: g.landscape.batches
          .filter((b) => b.mesh.visible)
          .map((b) => b.mesh.count),
      });
    }
    const tiers = [];
    for (const q of ["low", "medium", "high"]) {
      g.setQuality(q);
      tiers.push({
        q,
        shadows: g.renderer.shadowMap.enabled,
        particles: g.combatArt.limit,
        corpses: g.defeats.limit,
        detail: g.landscape.detail,
        lod: g.enemyRenderer.lod.quality,
      });
    }
    g.parry.reset();
    g.takeDamage(
      10,
      g.player.position.clone().add(g.player.position.clone().set(1, 0, 0)),
      "presentation fixture",
    );
    g.advanceSimulation(0.01);
    const hitReaction = g.playerHitTime > 0 && g.playerVisual.visible;
    const unchanged = stats === JSON.stringify(g.stats);
    g.start();
    g.renderer.render(g.scene, g.camera);
    return {
      ready,
      contact,
      hit,
      death,
      statuses,
      regions,
      tiers,
      hitReaction,
      unchanged,
      reset:
        g.defeats.slots.every((s) => !s.life) && g.enemyStates.mesh.count === 0,
    };
  });
  assert.ok(
    result.ready && result.hit && Math.abs(result.contact - 0.42) < 1e-8,
  );
  assert.ok(
    result.death.removed &&
      result.death.reward &&
      result.death.copies === 1 &&
      result.death.finished,
  );
  assert.equal(result.statuses, 3);
  for (const r of result.regions) {
    assert.equal(r.id, r.sky);
    assert.ok(r.structures.length > 0 && r.structures.every((n) => n > 0));
  }
  assert.equal(result.tiers[0].shadows, false);
  assert.deepEqual(
    result.tiers.map((t) => t.particles),
    [96, 176, 256],
  );
  assert.deepEqual(
    result.tiers.map((t) => t.lod),
    ["low", "medium", "high"],
  );
  assert.ok(result.hitReaction && result.unchanged && result.reset);
  const mobile = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(process.env.BASE_URL || "http://127.0.0.1:5184");
  await mobile.waitForFunction(() => window.__game?.artReady);
  await mobile.locator("#start-button").click();
  const touch = await mobile.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnBoss();
    g.emit();
    const b = document.querySelector("#guard-button").getBoundingClientRect();
    return {
      width: innerWidth,
      height: innerHeight,
      scroll: document.documentElement.scrollWidth,
      scrollHeight: document.documentElement.scrollHeight,
      parryHeight: b.height,
      parryWidth: b.width,
    };
  });
  assert.ok(
    touch.scroll <= touch.width &&
      touch.scrollHeight <= touch.height &&
      touch.parryHeight >= 44 &&
      touch.parryWidth >= 44,
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS ready/contact, actual defeat rewards and bounded copies, status rings, all regional render paths, graphics tiers, hit reaction, reset and mobile viewport",
    JSON.stringify(result),
  );
} finally {
  await browser.close();
}
