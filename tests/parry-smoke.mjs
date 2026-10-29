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
const errors = [],
  gl = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error|THREE.WebGLProgram:/.test(m.text()))
      gl.push(m.text());
  });
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.fixture = () => {
      document.querySelector("#modal-backdrop").classList.add("hidden");
      g.camp.leave();
      g._state.phase = "menu";
      g.mode = "normal";
      g.setPermanentBonuses({});
      g.start();
      cancelAnimationFrame(g.raf);
      g.spawnTimer =
        g.attackTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e6;
      g.stats.spells = {};
      g.stats.critChance = 0;
      g._state.xpNeeded = 1e9;
      g.invulnerable = 0;
      g.player.rotation.y = 0;
      return g;
    };
    window.fixture();
  });
  await p.keyboard.press("f");
  const input = await p.evaluate(() => ({
    active: window.__game.parry.active,
    pose: window.__game.rightShoulder.rotation.x,
    fullscreen: document.body.classList.contains("theater-mode"),
    attempts: window.__game.analytics.parryAttempts,
  }));
  assert.ok(input.active > 0 && input.pose <= -1);
  assert.equal(input.fullscreen, false);
  assert.equal(input.attempts, 1);
  const koreanKeys=await p.evaluate(()=>{
    const samples=[];
    for(const [key,code] of [['ㅍ','KeyF'],['Process','KeyF'],['ㅎ','KeyG']]){
      const g=window.fixture();
      const send=(type,extra={})=>window.dispatchEvent(new KeyboardEvent(type,{key,code,isComposing:true,keyCode:229,bubbles:true,cancelable:true,...extra}));
      send('keydown');send('keydown',{repeat:true});send('keyup');
      samples.push({active:g.parry.active,attempts:g.analytics.parryAttempts,released:!g.keys.has(code.slice(3).toLowerCase())});
    }
    const g=window.fixture(),field=document.createElement('input');document.body.append(field);field.focus();
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'ㅍ',code:'KeyF',bubbles:true}));
    const typing=g.parry.active;field.remove();
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'f',code:'KeyF',ctrlKey:true,bubbles:true}));
    const shortcut=g.parry.active;
    window.dispatchEvent(new KeyboardEvent('keydown',{key:'ㅈ',code:'KeyW',isComposing:true,bubbles:true}));
    const moving=g.keys.has('w');
    window.dispatchEvent(new KeyboardEvent('keyup',{key:'Process',code:'KeyW',isComposing:true,bubbles:true}));
    return {samples,typing,shortcut,moving,released:!g.keys.has('w')};
  });
  assert.ok(koreanKeys.samples.every(s=>s.active>0&&s.attempts===1&&s.released));
  assert.equal(koreanKeys.typing,0);assert.equal(koreanKeys.shortcut,0);assert.ok(koreanKeys.moving&&koreanKeys.released);
  await p.keyboard.press("Shift+F");
  assert.equal(
    await p.evaluate(() => document.body.classList.contains("theater-mode")),
    true,
  );
  await p.keyboard.press("Shift+F");
  const defend = await p.evaluate(() => {
    const g = window.fixture(),
      a = g.spawnEnemy(0, 2, 5, { noMutations: true }),
      b = g.spawnEnemy(2, 0, 0, { elite: true, noMutations: true }),
      outside = g.spawnEnemy(4.1, 0, 0, { noMutations: true });
    a.action = "charge-warning";
    a.actionTimer = 0.4;
    g.parry.press();
    g.takeDamage(20, { x: 0, y: 0, z: 1 }, "contact", a);
    g.emit();
    return {
      hp: g._state.hp,
      blocked: g.analytics.parryBlocked,
      attempt: g.analytics.parryAttempts,
      success: g.analytics.parrySuccesses,
      stun: a.parryStun,
      elite: b.parryStun,
      outside: outside.parryStun || 0,
      cancel: a.action,
      counter: g.parry.counterTime,
      stop: g.parry.hitStop,
      radius: g.parry.feedback.radius,
      notice: !document
        .querySelector("#parry-callout")
        .classList.contains("hidden"),
    };
  });
  assert.equal(defend.hp, 100);
  near(defend.blocked, 20);
  assert.equal(defend.attempt, 1);
  assert.equal(defend.success, 1);
  assert.ok(defend.stun > defend.elite && defend.elite > 0);
  assert.equal(defend.outside, 0);
  assert.equal(defend.cancel, "chase");
  assert.equal(defend.counter, 2);
  near(defend.stop, 0.1);
  assert.equal(defend.radius, 4);
  assert.ok(defend.notice);
  const stop = await p.evaluate(() => {
    const g = window.__game,
      positions = g.enemies.map((e) => e.group.position.clone()),
      before = g._state.elapsed;
    g.advanceSimulation(0.05);
    const held =
      g._state.elapsed === before &&
      g.enemies.every((e, i) => e.group.position.equals(positions[i]));
    const wave = g.parry.feedback.wave.scale.x;
    g.pause();
    g.advanceSimulation(0.05);
    const pause = g.parry.hitStop;
    g.resume();
    g.advanceSimulation(0.05);
    g.advanceSimulation(0.02);
    return {
      held,
      wave,
      pause,
      advanced: g._state.elapsed - before,
      moved: g.enemies[0].group.position.distanceTo(positions[0]),
      remaining: g.parry.hitStop,
    };
  });
  assert.ok(stop.held && stop.wave > 0);
  near(stop.pause, 0.05);
  assert.ok(stop.advanced > 0 && stop.moved > 0);
  near(stop.remaining, 0);
  console.log(
    "PASS physical F/G including Korean IME/Process and repeat/typing guards, Shift+F fullscreen, perfect nullification, 4m crowd interrupt/elite resistance and real-time nonblocking hit-stop with pause/resume",
  );
  const failures = await p.evaluate(() => {
    const samples = [];
    for (const kind of ["rear", "late", "expired", "terrain"]) {
      const g = window.fixture();
      g.parry.press();
      if (kind === "late") g.parry.update(0.2);
      if (kind === "expired") g.parry.update(0.5);
      g.takeDamage(10, { x: 0, z: kind === "rear" ? -1 : 1 }, "test", null, {
        unblockable: kind === "terrain",
      });
      samples.push({
        kind,
        hp: g._state.hp,
        blocked: g.analytics.parryBlocked,
        success: g.analytics.parrySuccesses,
        stop: g.parry.hitStop,
      });
    }
    return samples;
  });
  for (const f of failures) {
    near(f.hp, f.kind === "late" ? 96.5 : 90);
    near(f.blocked, f.kind === "late" ? 6.5 : 0);
    assert.equal(f.success, 0);
    assert.equal(f.stop, 0);
  }
  const counters = await p.evaluate(() => {
    const g = window.fixture();
    g.parry.counterTime = 2;
    const noTarget = g.attack(),
      still = g.parry.counterTime;
    const locations = [
        [0, 2],
        [1.5, 2.5],
        [0, -2],
        [0, 3.6],
      ],
      targets = locations.map(([x, z]) =>
        g.spawnEnemy(x, z, 0, { noMutations: true }),
      );
    for (const e of targets) e.hp = e.maxHp = 10000;
    g.attack();
    const damage = targets.map((e) => 10000 - e.hp),
      record = g.analytics.damage.counter;
    g.attack();
    return {
      noTarget,
      still,
      damage,
      record,
      consumed: g.parry.counterTime,
      normal: 10000 - targets[0].hp - damage[0],
      counterAnim: g.counterAnim,
    };
  });
  assert.equal(counters.noTarget, false);
  assert.equal(counters.still, 2);
  near(counters.damage[0], 56.25);
  near(counters.damage[1], 56.25);
  near(counters.damage[2], 0);
  near(counters.damage[3], 0);
  near(counters.record, 112.5);
  assert.equal(counters.consumed, 0);
  near(counters.normal, 22.5);
  assert.ok(counters.counterAnim > 0);
  const cap = await p.evaluate(() => {
    const g = window.fixture();
    g.parry.counterTime = 2;
    for (let i = 0; i < 40; i++) {
      const e = g.spawnEnemy(
        ((i % 5) - 0.5) * 0.1,
        2 + Math.floor(i / 5) * 0.1,
        0,
        { noMutations: true },
      );
      e.hp = e.maxHp = 10000;
    }
    g.attack();
    return {
      hit: g.enemies.filter((e) => e.hp < 10000).length,
      actual: g.analytics.damage.counter,
    };
  });
  assert.equal(cap.hit, 24);
  near(cap.actual, 24 * 56.25);
  const bossCounter = await p.evaluate(() => {
    const g = window.fixture(),
      b = g.spawnBoss();
    b.group.position.set(0, 0, 2);
    b.hp = b.maxHp = 10000;
    g.parry.counterTime = 2;
    g.attack();
    return 10000 - b.hp;
  });
  near(bossCounter, 67.5);
  const modifiers = await p.evaluate(() => {
    const g = window.fixture();
    g.stats.characterId = "assassin";
    g.stats.swordEvolution = "broadsword";
    g.equipment.add({
      id: "counter-gear",
      slot: "weapon",
      title: "강화 검",
      grade: "rare",
      level: 0,
      power: 0.2,
      options: ["dash"],
    });
    g.equipment.equip("counter-gear");
    const e = g.spawnEnemy(0, 2, 0, { noMutations: true });
    e.hp = e.maxHp = 10000;
    g.dash();
    g.parry.counterTime = 2;
    g.attack();
    const first = 10000 - e.hp;
    g.attack();
    return { first, second: 10000 - e.hp - first };
  });
  near(modifiers.first, 18 * 1.2 * 1.25 * 1.35 * 2.5 * 1.25 * 1.2);
  near(modifiers.second, 18 * 1.2 * 1.25 * 1.35);
  console.log(
    "PASS miss preserves counter; one automatic 180° 250% strike, exact sector/range, 24-target cap, boss bonus and separate non-overlapping counter statistics",
  );
  const bossRows = await p.evaluate(() => {
    const rows = [];
    for (let stage = 1; stage <= 6; stage++) {
      const g = window.fixture();
      g._state.stage = stage;
      const b = g.spawnBoss();
      b.group.position.set(0, 0, 1.9);
      const hazard = g.bossSystem.zone(
        g.player.position,
        3,
        1,
        0.5,
        10,
        "pulse",
      );
      g.bossSystem.schedule(b, 1, g.player.position.clone().set(0, 0, -1), {
        count: 3,
      });
      if (stage === 1) {
        b.mode = "charge";
        b.chargeDirection.set(0, 0, -1);
        b.actionTimer = 0.6;
      }
      g.parry.press();
      g.updateBoss(b, 0.01);
      const initial = b.parryStun,
        hp = g._state.hp,
        stuns = g.analytics.parryBossStuns,
        canceled = g.bossSystem.pendingShots.length === 0,
        kept = g.bossSystem.zones.includes(hazard),
        position = b.group.position.clone();
      g.updateBoss(b, 0.2);
      const still = b.group.position.equals(position);
      g.parry.reset();
      g.parry.press();
      g.invulnerable = 0;
      b.parryStun = 0;
      g._state.elapsed = 4;
      g.takeDamage(10, b.group.position, "boss", b);
      const resisted = g.analytics.parryBossStuns === stuns;
      g.parry.reset();
      g.invulnerable = 1e6;
      b.parryStun = 0;
      b.hp = b.maxHp * 0.3;
      g.bossPhases.sync(b);
      b.phaseCooldown = 0;
      for (let i = 0; i < 60; i++) {
        g.updateBoss(b, 0.05);
        g.bossSystem.updateEffects(0.05);
      }
      rows.push({
        stage,
        initial,
        hp,
        stuns,
        canceled,
        kept,
        still,
        resisted,
        phase: b.combatPhase,
        patterns: g.bossPhases.patterns,
      });
    }
    return rows;
  });
  for (const r of bossRows) {
    assert.equal(r.hp, 100);
    near(r.initial, 0.6);
    assert.equal(r.stuns, 1);
    assert.ok(r.canceled && r.kept && r.still && r.resisted);
    assert.equal(r.phase, 3);
    assert.ok(r.patterns > 0);
  }
  const hidden = await p.evaluate(() => {
    const g = window.fixture();
    g.story.progress.records.push("royalOath");
    g.story.progress.normalBossStages.push(2);
    g.sideAreas.enter("king");
    g.boss.group.position.set(0, 0, 2);
    g.player.position.set(0, 0, 0);
    g.player.rotation.y = 0;
    g.invulnerable = 0;
    g.sideAreas.hidden.prepare(g.boss);
    g.parry.press();
    g.sideAreas.hidden.resolve(g.boss);
    g.emit();
    return {
      hp: g._state.hp,
      stun: g.boss.parryStun,
      pending: g.boss.hiddenPending,
      warning: g.bossSystem.zones.length,
      ui: !document.querySelector("#boss-stagger").classList.contains("hidden"),
    };
  });
  assert.equal(hidden.hp, 100);
  near(hidden.stun, 0.6);
  assert.equal(hidden.pending, null);
  assert.equal(hidden.warning, 0);
  assert.ok(hidden.ui);
  console.log(
    "PASS all six guardian attacks stagger/cancel once, preserve unblockable zones and resume third-phase patterns; hidden king sword collision and compact stagger UI",
  );
  const projectileDeath = await p.evaluate(() => {
    const g = window.fixture(),
      b = g.spawnBoss();
    b.group.position.set(0, 0, 2);
    b.hp = 1;
    g.stats.relics = ["shockwave"];
    g.bossSystem.fire(b, g.player.position.clone().set(0, 0, -1), { count: 3 });
    for (const shot of g.enemyProjectiles) shot.mesh.position.set(0, 0, 0.4);
    const other = g.spawnEnemy(20, 0, 0, { noMutations: true });
    g.shootEnemyProjectile(other, g.player.position.clone().set(1, 0, 0));
    const survivor = g.enemyProjectiles.at(-1);
    survivor.mesh.position.set(30, 0, 0);
    const x = survivor.mesh.position.x;
    g.parry.press();
    g.updateEnemyProjectiles(0.001);
    return {
      step: survivor.mesh.position.x - x,
      alive: b.hp > 0,
      shots: g.enemyProjectiles.length,
      hp: g._state.hp,
      relic: g.analytics.damage.relic,
    };
  });
  assert.equal(projectileDeath.alive, false);
  assert.equal(projectileDeath.shots, 1);
  near(projectileDeath.step, 0.009);
  assert.equal(projectileDeath.hp, 100);
  near(projectileDeath.relic, 1);
  console.log(
    "PASS lethal parry relic during a boss projectile loop cleans the volley safely",
  );

  const terrainFx = await p.evaluate(() => {
    const g = window.fixture(),
      hill = g.world.hills[0];
    g.player.position.set(hill.x + hill.radius * 0.45, 0, hill.z);
    g.player.position.y = g.groundHeight(
      g.player.position.x,
      g.player.position.z,
    );
    g.parry.press();
    g.takeDamage(10, { x: g.player.position.x, z: g.player.position.z + 1 });
    g.parry.feedback.update(0.04);
    g.updateCamera(100);
    g.renderer.render(g.scene, g.camera);
    const d = g.parry.feedback.disc,
      a = d.geometry.attributes.position,
      point = g.player.position.clone();
    let error = 0;
    d.updateWorldMatrix(true, false);
    for (let i = 0; i < a.count; i++) {
      point.fromBufferAttribute(a, i).applyMatrix4(d.matrixWorld);
      error = Math.max(
        error,
        Math.abs(point.y - g.groundHeight(point.x, point.z) - 0.15),
      );
    }
    return { error, scale: d.scale.x, visible: g.parry.feedback.flash.visible };
  });
  assert.ok(terrainFx.error < 1e-4 && terrainFx.visible);
  assert.equal(terrainFx.scale, 4);
  console.log(
    "PASS shockwave geometry follows hill height while retaining its exact 4m radius",
  );
  const collision = await p.evaluate(() => {
    const g = window.fixture(),
      c = g.world.colliders.find((c) => c.type === "rect"),
      r = 0.5;
    g.player.position.set(c.x + c.hx + 2, 0, c.z);
    const e = g.spawnEnemy(c.x + c.hx + 0.55, c.z, 0, { noMutations: true });
    g.parry.control(e);
    for (let i = 0; i < 20; i++) g.parry.moveControlled(e, 0.05);
    const radius = Math.min(1.2, e.size * 0.4),
      wall = e.group.position.x >= c.x + c.hx + radius - 0.01,
      walkable = g.world.isWalkable(
        e.group.position.x,
        e.group.position.z,
        radius - 1e-6,
      );
    g.player.position.set(87, 0, 0);
    const edge = g.spawnEnemy(89, 0, 0, { noMutations: true });
    g.parry.control(edge);
    for (let i = 0; i < 20; i++) g.parry.moveControlled(edge, 0.05);
    return {
      wall,
      walkable,
      radius: Math.hypot(edge.group.position.x, edge.group.position.z),
    };
  });
  assert.ok(collision.wall && collision.walkable);
  assert.ok(collision.radius <= 90);
  const stress = await p.evaluate(() => {
    const g = window.fixture();
    for (let i = 0; i < 160; i++)
      g.spawnEnemy(Math.sin(i) * 3, Math.cos(i) * 3, 0, { noMutations: true });
    const start = performance.now();
    for (let n = 0; n < 8; n++) {
      g._state.elapsed = n * 6;
      g.parry.reset();
      g.parry.press();
      g.parry.defend({ x: 0, z: 1 });
      g.parry.feedback.update(0.03);
      g.renderer.render(g.scene, g.camera);
      for (let k = 0; k < 10; k++) g.advanceSimulation(0.05);
      g.renderer.render(g.scene, g.camera);
    }
    const state = g.getDebugState();
    const result = {
      ms: performance.now() - start,
      enemies: g.enemies.length,
      particles: g.combatArt.count,
      geometries: state.resources.geometries,
      textures: state.resources.textures,
      fx: g.parry.feedback.root.children.length,
    };
    g.start();
    result.clean =
      g.parry.hitStop === 0 &&
      g.parry.counterTime === 0 &&
      g.enemies.length === 0 &&
      !g.parry.feedback.wave.visible;
    return result;
  });
  assert.equal(stress.enemies, 160);
  assert.ok(
    stress.particles <= 256 &&
      stress.geometries < 220 &&
      stress.textures < 36 &&
      stress.fx === 5 &&
      stress.clean,
  );
  console.log(
    "PASS collision-safe wall/boundary knockback, 160-monster repeated parries, bounded cached effects and clean restart",
    JSON.stringify(stress),
  );
  await p.locator("#settings").click();
  await p.locator('[data-camera-shake="0"]').click();
  await p.locator('[data-parry-effects="0"]').click();
  await p.locator("#modal-close").click();
  const reduced = await p.evaluate(() => {
    const g = window.__game;
    g.parry.press();
    g.invulnerable = 0;
    g.player.rotation.y = 0;
    g.takeDamage(10, { x: 0, z: 1 });
    g.parry.feedback.update(0.02);
    return {
      shake: g.cameraShake,
      intensity: g.effectIntensity,
      light: g.parry.feedback.light.intensity,
      flash: g.parry.feedback.flash.visible,
      block: g._state.hp,
    };
  });
  assert.equal(reduced.shake, 0);
  assert.equal(reduced.intensity, 0);
  assert.equal(reduced.light, 0);
  assert.equal(reduced.flash, false);
  assert.equal(reduced.block, 100);
  await p.reload();
  await p.waitForFunction(() => window.__game?.artReady);
  await p.evaluate(() => cancelAnimationFrame(window.__game.raf));
  assert.deepEqual(
    await p.evaluate(() => [
      window.__game.cameraShake,
      window.__game.effectIntensity,
    ]),
    [0, 0],
  );
  const savedParry = await p.evaluate(() => {
    const g = window.__game;
    g.start();
    cancelAnimationFrame(g.raf);
    g.stats.critChance = 0;
    g.stats.spells = {};
    g.invulnerable = 0;
    g.player.rotation.y = 0;
    const b = g.spawnBoss();
    b.group.position.set(0, 0, 1.9);
    b.mode = "charge";
    b.chargeDirection.set(0, 0, -1);
    b.actionTimer = 0.6;
    g.parry.press();
    g.updateBoss(b, 0.01);
    g.attack();
    g.endRun();
    return JSON.parse(localStorage.getItem("voidrun.history"))[0].analytics;
  });
  assert.equal(savedParry.parryAttempts, 1);
  assert.equal(savedParry.parrySuccesses, 1);
  assert.equal(savedParry.parrySuccessRate, 1);
  assert.equal(savedParry.parryBossStuns, 1);
  assert.ok(savedParry.parryBlocked > 0 && savedParry.damage.counter > 0);
  assert.match(
    await p.locator("[data-analytics]").textContent(),
    /패링 성공률/,
  );
  console.log(
    "PASS parry rate, blocked damage, boss staggers and actual counter damage persist in the run report",
  );
  const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      reducedMotion: "reduce",
    }),
    phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await phone.waitForFunction(() => window.__game?.artReady);
  await phone.evaluate(() => cancelAnimationFrame(window.__game.raf));
  assert.deepEqual(
    await phone.evaluate(() => [
      window.__game.cameraShake,
      window.__game.effectIntensity,
    ]),
    [0, 0.35],
  );
  await phone.locator("#start-button").click();
  await phone.evaluate(() => cancelAnimationFrame(window.__game.raf));
  await phone.locator("#guard-button").tap();
  assert.ok(await phone.evaluate(() => window.__game.parry.active > 0));
  const rect = await phone.locator("#guard-button").boundingBox();
  assert.ok(rect.height >= 44 && rect.x >= 0 && rect.x + rect.width <= 390);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await phone.setViewportSize(viewport);
    assert.ok(
      await phone.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
  }
  await mobile.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(gl, []);
  console.log(
    "PASS persistent shake/flash accessibility, reduced-motion defaults, mobile parry controls and clean browser/WebGL state",
  );
} finally {
  await browser.close();
}
