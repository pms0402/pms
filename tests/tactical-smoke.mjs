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
  results = {};
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error|VALIDATE_STATUS/.test(m.text()))
      errors.push(m.text());
  });
  await p.goto(base, { timeout: 90000 });
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.freshTactical = () => {
      g.start();
      g.spawnTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e9;
      g._state.xpNeeded = 1e18;
      g.stats.critChance = 0;
      g.invulnerable = 1e9;
      g.setViewMode("overhead");
      g.actions.setAim(g.player.position.clone().set(0, 0, 1));
      return g;
    };
    window.runSteps = (t) => {
      for (let i = 0; i < Math.ceil(t * 120); i++) g.advanceSimulation(1 / 120);
      g.emit();
    };
    window.targetEnemy = (x, z, kind = 0) => {
      const e = g.spawnEnemy(x, z, kind, { noMutations: true });
      e.speed = 0;
      e.hp = e.maxHp = 1e8;
      e.tactics = { phase: "circle", timer: 1e9, angle: 0 };
      e.shootTimer = e.actionTimer = 1e9;
      return e;
    };
    freshTactical();
    targetEnemy(0, 6);
    targetEnemy(5, 8);
    g.emit();
  });
  await p.keyboard.press("l");
  assert.equal(
    await p.locator("#lock-toggle").getAttribute("aria-pressed"),
    "true",
  );
  const selected = await p.evaluate(
    () => window.__game.lockOn.target.spawnSerial,
  );
  await p.keyboard.press("k");
  assert.notEqual(
    await p.evaluate(() => window.__game.lockOn.target.spawnSerial),
    selected,
  );
  await p.keyboard.press("j");
  assert.equal(
    await p.evaluate(() => window.__game.lockOn.target.spawnSerial),
    selected,
  );
  results.lock = await p.evaluate(() => {
    const g = window.__game,
      e = g.lockOn.target,
      serial = e.spawnSerial;
    for (let i = 0; i < 120; i++) targetEnemy((i % 9) - 4, 4 + (i % 7));
    const rows = [];
    for (const mode of ["third", "first", "overhead"]) {
      g.setViewMode(mode);
      g.keys.add("d");
      const pos = g.player.position.clone();
      let step = 0,
        dot = 1;
      for (let i = 0; i < 24; i++) {
        const yaw = g.player.rotation.y;
        g.advanceSimulation(1 / 120);
        g.updateCamera(1 / 120);
        step = Math.max(
          step,
          Math.abs(
            Math.atan2(
              Math.sin(g.player.rotation.y - yaw),
              Math.cos(g.player.rotation.y - yaw),
            ),
          ),
        );
        if (mode !== "overhead")
          dot = Math.min(
            dot,
            g.camera
              .getWorldDirection(pos.clone())
              .setY(0)
              .normalize()
              .dot(
                pos
                  .clone()
                  .set(
                    Math.sin(g.player.rotation.y),
                    0,
                    Math.cos(g.player.rotation.y),
                  ),
              ),
          );
      }
      const direction = g.inputDirection(),
        forward = pos
          .clone()
          .set(Math.sin(g.player.rotation.y), 0, Math.cos(g.player.rotation.y));
      g.keys.clear();
      g.keys.add("s");
      const back = g.inputDirection().dot(forward);
      g.keys.clear();
      g.renderer.render(g.scene, g.camera);
      rows.push({
        mode,
        step,
        dot,
        side: Math.abs(direction.dot(forward)),
        back,
        moved: pos.distanceTo(g.player.position),
        same: g.lockOn.target.spawnSerial === serial,
      });
    }
    if (
      g.actions.manualCommands ||
      Object.values(g.magic.spellsCast).some((n) => n > 0)
    )
      throw Error("lock started an automatic action");
    return rows;
  });
  assert.ok(
    results.lock.every(
      (r) =>
        r.same &&
        r.step <= 3.2 / 120 + 1e-8 &&
        r.dot > 0.999999 &&
        r.side < 1e-8 &&
        r.back < -0.999 &&
        r.moved > 0.5,
    ),
    JSON.stringify(results.lock),
  );
  await p.keyboard.press("l");
  assert.equal(
    await p.locator("#lock-toggle").getAttribute("aria-pressed"),
    "false",
  );
  console.log(
    "PASS actual L/K/J lock, explicit switching, stable 122-actor target, strafe/backward movement and bounded camera heading in all modes",
  );
  results.collision = await p.evaluate(() => {
    const g = freshTactical(),
      rows = [];
    for (const mode of ["first", "third", "overhead"]) {
      freshTactical();
      g.setViewMode(mode);
      g.actions.setAim(g.player.position.clone().set(0, 0, 1));
      const front = targetEnemy(0, 2),
        rear = targetEnemy(0, -2),
        outside = targetEnemy(0, 4.3),
        touching = targetEnemy(0.05, 0.1);
      g.actions.press("light");
      runSteps(0.12);
      const early = front.hp;
      runSteps(0.18);
      rows.push({
        mode,
        early,
        front: front.hp,
        rear: rear.hp,
        outside: outside.hp,
        close: touching.hp,
      });
    }
    freshTactical();
    const wall = g.world.colliders.find(
      (c) => c.id === "chapel" && c.type === "rect" && c.hz > 2,
    );
    const z = wall.z;
    g.player.position.set(wall.x - 1.1, g.groundHeight(wall.x - 1.1, z), z);
    const e = targetEnemy(wall.x + 1.1, z);
    g.actions.setAim(g.player.position.clone().set(1, 0, 0));
    g.actions.press("light");
    runSteps(0.7);
    const blocked = e.hp === 1e8;
    g.actions.cancel();
    g.stats.spells.orbit = 1;
    const desired = g.player.position.clone().set(wall.x + 5, 0, z);
    g.magic.castManual(
      "orbit",
      g.player.position.clone().set(1, 0, 0),
      desired,
    );
    const zone = g.magic.zones.find((z) => z.type === "rune"),
      clipped = zone.position.x < wall.x;
    return { rows, blocked, clipped };
  });
  assert.ok(
    results.collision.rows.every(
      (r) =>
        r.early === 1e8 &&
        r.front < 1e8 &&
        r.close < 1e8 &&
        r.rear === 1e8 &&
        r.outside === 1e8,
    ),
    JSON.stringify(results.collision),
  );
  assert.ok(
    results.collision.blocked && results.collision.clipped,
    JSON.stringify(results.collision),
  );
  console.log(
    "PASS delayed contact, near-body hits, forward-only bounded sectors, actual wall blocking and clipped rune placement in all three views",
  );
  results.links = await p.evaluate(() => {
    const g = freshTactical(),
      enemy = targetEnemy(0, 2);
    g.stats.spells = { fireball: 1, frost: 1, lightning: 1, orbit: 1 };
    g.actions.syncSlots();
    g.magic.castManual("frost");
    g.actions.press("heavy");
    runSteps(0.8);
    const shatter = g.links.triggers.shatter;
    g.actions.cancel();
    g.magic.cooldowns.fireball = 0;
    g.magic.castManual(
      "fireball",
      g.player.position.clone().set(0, 0, 1),
      enemy.group.position.clone(),
    );
    runSteps(0.5);
    g.actions.press("light");
    runSteps(0.7);
    const ignite = g.links.triggers.ignite;
    g.actions.cancel();
    g.dashCooldown = 0;
    g.dash();
    runSteps(0.22);
    g.magic.castManual(
      "lightning",
      enemy.group.position.clone().sub(g.player.position).setY(0).normalize(),
    );
    const dash = g.links.triggers.dashLightning;
    g.parry.reset();
    g.actions.cancel();
    g.actions.setAim(g.player.position.clone().set(0, 0, 1));
    g.invulnerable = 0;
    g.parry.press();
    g.takeDamage(
      20,
      g.player.position.clone().add(g.player.position.clone().set(0, 0, 1)),
      "link fixture",
    );
    g.magic.castManual("frost");
    return {
      shatter,
      ignite,
      dash,
      parry: g.links.triggers.parryMagic,
      counter: g.parry.counterTime,
      damage: g.analytics.damage.link,
      total: enemy.maxHp - enemy.hp,
    };
  });
  assert.ok(
    results.links.shatter &&
      results.links.ignite &&
      results.links.dash &&
      results.links.parry &&
      results.links.counter > 0 &&
      results.links.damage > 0 &&
      results.links.total > 0,
    JSON.stringify(results.links),
  );
  console.log(
    "PASS actual frost-heavy, fire-sword explosion, dash-lightning pierce and perfect-parry spell damage with separate counter charge",
  );
  results.goals = await p.evaluate(() => {
    const rows = [];
    for (const type of [
      "elite",
      "hunt",
      "seals",
      "crossing",
      "ritual",
      "defense",
    ]) {
      const g = freshTactical();
      const statsBefore = JSON.stringify(g.stats);
      g._state.stage = 2;
      g._state.stageTime = 0;
      g.objectives.begin(2, "sanctum", type);
      g.tick(0.01);
      const a = g.objectives.goal;
      if (["elite", "hunt"].includes(type)) {
        for (let i = 0; i < 3; i++) g.objectives.update(1.1);
        for (const e of [...g.objectives.targets])
          g.hitEnemy(e, e.maxHp * 1000);
      }
      if (type === "seals")
        for (const point of g.objectives.points) {
          g.hitEnemy(point.guard, point.guard.maxHp * 1000);
          g.player.position.copy(point.position);
          if (!g.interact())
            throw Error(
              "seal interaction " +
                JSON.stringify({
                  hp: point.guard.hp,
                  phase: g.state.phase,
                  target: g.interactionTarget(),
                  own: g.objectives.interactionTarget(),
                }),
            );
        }
      if (type === "crossing") {
        g._state.stageTime = 0.2;
        for (const point of g.objectives.points) {
          g.player.position.copy(point.position);
          g.objectives.update(0.01);
        }
      }
      if (type === "ritual") {
        g.player.position.copy(g.objectives.points[0].position);
        g.interact();
        for (let i = 0; i < 5; i++) {
          const e = g.spawnEnemy(
            g.player.position.x + 1,
            g.player.position.z + i * 0.1,
            0,
            { noMutations: true },
          );
          g.hitEnemy(e, e.maxHp * 1000);
        }
      }
      if (type === "defense") {
        g.player.position.copy(g.objectives.points[0].position);
        g.interact();
        g.objectives.update(0.01);
        const raider = [...g.objectives.raiders][0],
          point = g.objectives.points[0].position;
        raider.group.position.copy(point).add(point.clone().set(0, 0, 1));
        raider.tactics = { phase: "circle", timer: 0, angle: 0 };
        g.updateEnemies(0.01);
        g.updateEnemies(1);
        if (!(a.hp < a.maxHp)) throw Error("raider did not attack device");
        for (let i = 0; i < 3370 && g._state.phase === "playing"; i++) {
          for (const e of [...g.objectives.raiders])
            g.hitEnemy(e, e.maxHp * 1000);
          g.advanceSimulation(1 / 120);
        }
      }
      const complete = a.complete,
        rewarded = a.rewarded,
        coin = g.state.gold;
      g._state.stageTime = Math.max(20, g._state.stageTime);
      g.tick(0.01);
      const summoned = g.bossSpawned;
      g.hitEnemy(g.boss, g.boss.maxHp * 1000);
      g.equipment.nextReward();
      document.querySelector('[data-equipment-choice="skip"]')?.click();
      const advanced =
        g.nextStage() &&
        g.state.phase === "route" &&
        g.chooseRoute("standard") &&
        g.chooseRegion(g.regionChoices[0].id) &&
        g.state.phase === "playing" &&
        g.state.stage === 3;
      rows.push({
        type,
        complete,
        rewarded,
        coin,
        summoned,
        advanced,
        noFreeGrowth: JSON.stringify(g.stats) === statsBefore,
      });
    }
    return rows;
  });
  assert.ok(
    results.goals.every(
      (g) =>
        g.complete &&
        g.rewarded &&
        g.coin > 0 &&
        g.summoned &&
        g.advanced &&
        g.noFreeGrowth,
    ),
    JSON.stringify(results.goals),
  );
  console.log(
    "PASS all six real floor goals, guardian-gated interactions, actual raider hits on the defense crystal, finite gold and boss summon gating",
  );
  // Practice is entered and exited through the real camp UI. Source owners must survive.
  await p.evaluate(() => {
    const g = freshTactical();
    g._state.phase = "menu";
    g.emit();
  });
  await p.locator("#enter-camp").click();
  await p.evaluate(() => {
    const g = window.__game;
    g.magic.cooldowns.fireball = 7.25;
    g.actions.heavyCooldown = 3;
    g.parry.cooldown = 2;
    window.practiceSource = {
      magic: g.magic,
      stats: g.stats,
      analytics: g.analytics,
      parry: g.parry,
      actions: g.actions,
      story: JSON.stringify(g.story.progress),
      progress: localStorage.getItem("voidrun.progression"),
      history: localStorage.getItem("voidrun.history"),
      shader: g.world.ground.material.onBeforeCompile,
    };
  });
  await p.locator('#camp-navigation [data-camp-facility="training"]').click();
  await p.locator("#training-open").click();
  await p.locator("#training-weapon").selectOption("greatsword");
  await p.locator("#training-rank").selectOption("3");
  await p.locator('[data-training-mode="spells"]').click();
  assert.ok(await p.locator("#training-controls").isVisible());
  await p.keyboard.press("q");
  await p.evaluate(() => runSteps(1));
  assert.ok(await p.evaluate(() => window.__game.training.damage > 0));
  await p.locator("#training-refill").click();
  assert.equal(
    await p.evaluate(() => window.__game.magic.cooldowns.fireball),
    0,
  );
  await p.locator("#training-exit").click();
  results.training = await p.evaluate(() => {
    const g = window.__game,
      s = practiceSource;
    return {
      same:
        g.magic === s.magic &&
        g.stats === s.stats &&
        g.analytics === s.analytics &&
        g.parry === s.parry &&
        g.actions === s.actions,
      phase: g.state.phase,
      cd: g.magic.cooldowns.fireball,
      heavy: g.actions.heavyCooldown,
      parry: g.parry.cooldown,
      story: JSON.stringify(g.story.progress) === s.story,
      progress: localStorage.getItem("voidrun.progression") === s.progress,
      history: localStorage.getItem("voidrun.history") === s.history,
      shader: g.world.ground.material.onBeforeCompile === s.shader,
    };
  });
  assert.deepEqual(results.training, {
    same: true,
    phase: "camp",
    cd: 7.25,
    heavy: 3,
    parry: 2,
    story: true,
    progress: true,
    history: true,
    shader: true,
  });
  results.practiceCycles = await p.evaluate(() => {
    const g = window.__game,
      s = practiceSource,
      counts = [];
    g.story.encounterBoss(1);
    for (let i = 0; i < 8; i++) {
      g.training.start(i % 2 ? "boss" : "spells", {
        stage: 1,
        weapon: i % 2 ? "tempest" : "greatsword",
        rank: 5,
      });
      if (!g.training.active) throw Error("practice unavailable");
      g.magic.castManual(
        "orbit",
        g.player.position.clone().set(0, 0, 1),
        g.player.position.clone().set(0, 0, 4),
      );
      runSteps(0.2);
      g.updateCamera(1);
      g.renderer.render(g.scene, g.camera);
      g.training.leave();
      g.renderer.render(g.scene, g.camera);
      counts.push({ ...g.renderer.info.memory });
    }
    return {
      counts,
      same: g.magic === s.magic && g.magic.cooldowns.fireball === 7.25,
      shader: g.world.ground.material.onBeforeCompile === s.shader,
    };
  });
  assert.ok(results.practiceCycles.same && results.practiceCycles.shader);
  const tail = results.practiceCycles.counts.slice(4);
  assert.ok(
    tail.at(-1).geometries <= tail[0].geometries + 2 &&
      tail.at(-1).textures <= tail[0].textures + 1,
    JSON.stringify(tail),
  );
  console.log(
    "PASS real practice UI, casts/refill, exact parent cooldown/stat/history/progression restoration, already-met boss admission and eight stable training arena cycles",
  );
  results.practicePatterns = await p.evaluate(() => {
    const g = window.__game;
    const unseenRejected = !g.training.start("boss", { stage: 10 });
    g.training.start("monster", { kind: 7 });
    const splitter = g.enemies[0];
    g.hitEnemy(splitter, splitter.maxHp * 1000);
    const split =
      g.enemies.length === 2 &&
      g.enemies.every((e) => e.splitChild && e.minion);
    for (const e of [...g.enemies]) g.hitEnemy(e, e.maxHp * 1000);
    const finite = g.enemies.length === 0;
    g.training.leave();
    g.story.encounterHidden("king");
    const story = JSON.stringify(g.story.progress);
    const admitted = g.training.start("boss", { hidden: "king" });
    const hidden = g.boss.hiddenBoss === "king";
    runSteps(3);
    g.renderer.render(g.scene, g.camera);
    g.hitEnemy(g.boss, g.boss.maxHp * 1000);
    g.training.leave();
    return {
      unseenRejected,
      split,
      finite,
      admitted,
      hidden,
      preserved:
        story === JSON.stringify(g.story.progress) &&
        g.magic === practiceSource.magic &&
        g.magic.cooldowns.fireball === 7.25,
    };
  });
  assert.ok(
    Object.values(results.practicePatterns).every(Boolean),
    JSON.stringify(results.practicePatterns),
  );
  await p.close();
  const m = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  m.setDefaultTimeout(60000);
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto(base, { timeout: 90000 });
  await m.waitForFunction(() => window.__game?.artReady);
  await m.locator("#start-button").tap();
  await m.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    const e = g.spawnEnemy(0, 6, 0, { noMutations: true });
    e.speed = 0;
    e.hp = 1e8;
    e.tactics = { phase: "circle", timer: 1e9 };
    g.emit();
  });
  await m.locator("#lock-toggle").tap();
  assert.equal(
    await m.locator("#lock-toggle").getAttribute("aria-pressed"),
    "true",
  );
  await m.locator("#lock-next").tap();
  await m.evaluate(() => {
    const g = window.__game;
    for (let i = 0; i < 120; i++) {
      g.advanceSimulation(1 / 120);
      g.updateCamera(1 / 120);
    }
    g.emit();
  });
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await m.setViewportSize(size);
    await m.evaluate(() => {
      const g = window.__game;
      g.resize();
      g.updateCamera(1);
      g.renderer.render(g.scene, g.camera);
    });
    assert.ok(
      await m.evaluate(() => {
        const r = document
          .getElementById("lock-toggle")
          .getBoundingClientRect();
        return (
          r.width >= 44 &&
          r.height >= 40 &&
          r.left >= 0 &&
          r.right <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight &&
          document.documentElement.scrollWidth <= innerWidth
        );
      }),
    );
    if (out) await m.screenshot({ path: `${out}/lock-${size.width}.png` });
  }
  await m.evaluate(() => {
    const g = window.__game;
    g.objectives.begin(2, g.regionId, "ritual");
    g.emit();
  });
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await m.setViewportSize(size);
    await m.evaluate(() => {
      const g = window.__game;
      g.resize();
      g.updateCamera(1);
      g.renderer.render(g.scene, g.camera);
    });
    assert.ok(await m.locator("#objective-panel").isVisible());
    assert.ok(
      await m.evaluate(() => {
        const a = document
            .querySelector("#objective-panel")
            .getBoundingClientRect(),
          b = document.querySelector("#lock-toggle").getBoundingClientRect();
        return (
          a.x >= 0 &&
          a.right <= innerWidth &&
          a.y >= 0 &&
          a.bottom <= innerHeight &&
          (a.bottom <= b.y ||
            a.y >= b.bottom ||
            a.right <= b.x ||
            a.x >= b.right)
        );
      }),
    );
    if (out) await m.screenshot({ path: `${out}/objective-${size.width}.png` });
  }
  await m.evaluate(() => {
    const g = window.__game;
    g._state.phase = "menu";
    g.emit();
  });
  await m.locator("#enter-camp").tap();
  await m.locator('#camp-navigation [data-camp-facility="training"]').tap();
  await m.locator("#training-open").tap();
  await m.locator('[data-training-mode="parry"]').tap();
  assert.match(await m.locator("#area-name").textContent(), /훈련장/);
  assert.equal(
    await m.locator("#xp-value").textContent(),
    "모험 경험치 미적용",
  );
  await m.locator("#mobile-parry").tap();
  assert.ok(await m.evaluate(() => window.__game.parry.active > 0));
  for (const size of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await m.setViewportSize(size);
    await m.evaluate(() => {
      const g = window.__game;
      g.resize();
      g.updateCamera(1);
      g.renderer.render(g.scene, g.camera);
    });
    assert.ok(await m.locator("#training-controls").isVisible());
    assert.ok(
      await m.evaluate(() => {
        const r = document
          .querySelector("#training-controls")
          .getBoundingClientRect();
        return (
          r.x >= 0 &&
          r.right <= innerWidth &&
          r.y >= 0 &&
          r.bottom <= innerHeight &&
          document.documentElement.scrollHeight <= innerHeight
        );
      }),
    );
    if (out) await m.screenshot({ path: `${out}/training-${size.width}.png` });
  }
  await m.locator("#training-exit").tap();
  assert.equal(await m.evaluate(() => window.__game.state.phase), "camp");
  assert.deepEqual(errors, []);
  if (out)
    await writeFile(
      `${out}/verification.json`,
      JSON.stringify({ ...results, errors }, null, 2) + "\n",
    );
  console.log(
    "PASS native mobile lock/switch buttons and bounded portrait/landscape layout; no browser or shader errors",
  );
} finally {
  await browser.close();
}
