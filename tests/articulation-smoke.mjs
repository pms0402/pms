import {manualPage} from './manual-fixtures.mjs';
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
  const page = await manualPage(browser,{
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/GL_INVALID|Shader Error|THREE.WebGLProgram:/.test(m.text()))
      errors.push(m.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await page.waitForFunction(() => window.__game?.artReady);
  await page.locator("#start-button").click();
  await page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.motionFixture = () => {
      g.start();
      g.spawnTimer =
        g.attackTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e6;
      g.stats.spells = {};g.actions.syncSlots();
      g.invulnerable = 1e6;
      g._state.xpNeeded = 1e9;
      g.stats.critChance = 0;
      g.setPlaybackSpeed(1);
      return g;
    };
  });
  const actions = await page.evaluate(() => {
    const g = window.motionFixture(),
      kinds = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const advance = (n) => {
      for (let i = 0; i < n; i++) g.advanceSimulation(1 / 60);
    };
    const models = kinds.map((kind, i) => {
      const e = g.spawnEnemy(7 + (i % 5) * 2, 7 + Math.floor(i / 5) * 3, kind, {
        noMutations: true,
      });
      e.hp = e.maxHp = 1e6;
      e.actionTimer = e.shootTimer = 100;
      if (kind === 4) e.mode = "chase";
      return e;
    });
    advance(18);
    g.renderer.render(g.scene, g.camera);
    const anatomy = models.map((e) => ({
      kind: e.kind,
      stride: e.motion.pose[1],
      joints: [
        ...new Set(
          e.visual.children.flatMap((m) =>
            Array.from(m.geometry.attributes.vrJoint.array),
          ),
        ),
      ],
      pose: Array.from(e.motion.pose),
    }));
    const melee = models[0];
    melee.group.position.copy(g.player.position);
    melee.group.position.z += 0.8;
    melee.visualAttackCooldown = 0;
    g.spatialDirty = true;
    melee.tactics={phase:'circle',timer:0,angle:0};g.updateEnemies(1/60);
    const warned=melee.action==='melee-warning';for(let i=0;i<70&&!melee.visualAttack;i++)g.updateEnemies(.01);
    const contact = warned && melee.visualAttack > 0;
    advance(6);
    const strike = Math.abs(melee.motion.pose[2]);
    const caster = models[3];
    caster.windup = 0.01;
    caster.aim.set(-1, 0, 0);
    const count = g.enemyProjectiles.length;
    g.updateEnemies(0.02);
    advance(5);
    const cast = caster.motion.pose[4],
      fired = g.enemyProjectiles.length > count;
    const charger = models[5];
    charger.action = "charge-warning";
    charger.actionTimer = 1;
    advance(8);
    const warning = charger.motion.pose[3];
    const saved = Array.from(melee.motion.pose);
    melee.freezeTime = 1;
    advance(5);
    const frozen =
      JSON.stringify(saved) === JSON.stringify(Array.from(melee.motion.pose));
    g.pause();
    const all = models.map((e) => Array.from(e.motion.pose));
    g.advanceSimulation(0.05);
    const paused = models.every(
      (e, i) =>
        JSON.stringify(all[i]) === JSON.stringify(Array.from(e.motion.pose)),
    );
    g.resume();
    const old = melee.group;
    g.removeEnemyWithoutReward(melee);
    const reused = g.spawnEnemy(10, 4, 0, { noMutations: true }),
      clean =
        old === reused.group &&
        !reused.motion &&
        !reused.visualAttack &&
        !reused.visualCast;
    return {
      anatomy,
      contact,
      strike,
      cast,
      fired,
      warning,
      frozen,
      paused,
      clean,
    };
  });
  for (const e of actions.anatomy) {
    assert.ok(e.pose.every(Number.isFinite));
    if ([0, 1, 2, 4, 5, 6].includes(e.kind))
      assert.ok(e.stride > 0.2, JSON.stringify(e));
    if ([0, 2, 4, 8].includes(e.kind))
      assert.ok([1, 2, 3, 4, 5].every((j) => e.joints.includes(j)));
    if ([1, 5].includes(e.kind))
      assert.ok([1, 4, 5, 6, 7].every((j) => e.joints.includes(j)));
    if (e.kind === 6)
      assert.ok([2, 3, 4, 5, 6, 7].every((j) => e.joints.includes(j)));
  }
  assert.ok(
    actions.contact &&
      actions.strike > 0.01 &&
      actions.cast > 0.05 &&
      actions.fired &&
      actions.warning > 0.5 &&
      actions.frozen &&
      actions.paused &&
      actions.clean,
    JSON.stringify(actions),
  );
  console.log(
    "PASS ten articulated species, real contact/cast/charge poses, freeze/pause holds and clean pooled respawn",
  );
  const sword = await page.evaluate(() => {
    const g = window.motionFixture(),
      e = g.spawnEnemy(0, 2, 0, { noMutations: true });
    e.speed = 0;
    e.hp = e.maxHp = 1e7;
    const stats = JSON.stringify(g.stats),
      hp = e.hp;
    g.actions.setAim(g.player.position.clone().set(0,0,1));g.attack();
    const yaws=[];for(let i=0;i<10;i++){g.advanceSimulation(1/120);yaws.push(g.rightShoulder.rotation.y);}
    const anticipation=e.hp===hp&&g.actions.current?.elapsed<g.actions.current?.duration*.42;
    g.advanceSimulation(.05);g.advanceSimulation(.05);g.advanceSimulation(.05);
    const immediate=e.hp<hp,after=e.hp;
    let peak = 0,
      aligned = true;
    for (let i = 0; i < 22; i++) {
      const previousSample=g.swordTrail.sampleTime[0];
      g.advanceSimulation(1 / 120);
      const trail = g.swordTrail;
      peak = Math.max(peak, trail.geometry.drawRange.count);
      const p = trail.paths[0].at(-1);
      if (p&&trail.sampleTime[0]!==previousSample) {
        const tip = g.player.position
          .clone()
          .set(0, 0, 1)
          .applyMatrix4(g.blade.matrixWorld);
        // The steel supplies the cut direction; the visible energy edge ends
        // at the committed attack range, including heavy/range upgrades.
        const action = g.actions.current;
        if (action?.type === 'sword' && action.style !== 'wave') {
          const dx = tip.x - g.player.position.x, dz = tip.z - g.player.position.z;
          const radius = Math.hypot(dx, dz);
          tip.x = g.player.position.x + dx * action.profile.range / radius;
          tip.z = g.player.position.z + dz * action.profile.range / radius;
        }
        aligned &&= p.tip.distanceTo(tip) < 1e-5;
      }
      yaws.push(g.rightShoulder.rotation.y);
      g.renderer.render(g.scene, g.camera);
    }
    const noExtraDamage = e.hp === after,
      unchanged = stats === JSON.stringify(g.stats),
      sweep = g.effects.find((e) => e.type === "slash"),
      sector = sweep
        ? {
            count: sweep.mesh.geometry.drawRange.count,
            total: sweep.mesh.geometry.index.count,
          }
        : null;
    g.stats.swordEvolution = "twinblade";
    g.applyLoadoutAppearance();
    e.group.position.set(0, 0, 2);
    e.stagger.set(0, 0, 0);
    g.spatialDirty = true;
    g.actions.cancel();g.attackAnim = 0;
    window.testStrike(g);
    for (let i = 0; i < 13; i++) g.advanceSimulation(1 / 120);
    const twin = g.swordTrail.paths[1].length;
    g.parry.counterTime = 2;
    e.group.position.set(0, 0, 2);
    e.stagger.set(0, 0, 0);
    g.spatialDirty = true;
    window.testStrike(g);
    for (let i = 0; i < 16; i++) g.advanceSimulation(1 / 120);
    const counter = g.swordTrail.paths[0].some((p) => p.counter);
    g.renderer.render(g.scene, g.camera);
    g.start();
    const reset =
      !g.swordTrail.mesh.visible &&
      g.swordTrail.paths.every((p) => p.length === 0);
    return {
      peak,
      aligned,
      immediate,
      anticipation,
      noExtraDamage,
      unchanged,
      sector,
      twin,
      counter,
      reset,
      yaws,
    };
  });
  assert.ok(
    sword.peak > 12 &&
      sword.peak <= 204 &&
      sword.aligned &&
      sword.immediate &&
      sword.anticipation &&
      sword.noExtraDamage &&
      sword.unchanged &&
      sword.reset,
    JSON.stringify(sword),
  );
  assert.ok(
    sword.twin > 1 && sword.counter && sword.sector.count < sword.sector.total,
    JSON.stringify(sword),
  );
  assert.ok(Math.min(...sword.yaws) < -0.1 && Math.max(...sword.yaws) > 0.1);
  console.log(
    "PASS blade-directed energy ribbons at committed reach, alternating cuts, twin blades/counter and bounded/reset buffers",
  );
  const crowd = await page.evaluate(() => {
    const g = window.motionFixture();
    for (let i = 0; i < 160; i++) {
      const a = i * 2.399,
        r = 5 + (i % 11),
        e = g.spawnEnemy(
          Math.cos(a) * r,
          Math.sin(a) * r,
          [0, 1, 2, 3, 5, 6, 7, 8, 9][i % 9],
          { noMutations: true },
        );
      e.hp = e.maxHp = 1e9;
    }
    for (let i = 0; i < 12; i++) g.advanceSimulation(1 / 60);
    g.renderer.setSize(640, 448, false);
    g.camera.aspect = 640 / 448;
    g.camera.updateProjectionMatrix();
    g.camera.position.set(20, 26, 25);
    g.camera.lookAt(0, 0.5, 0);
    g.world.updateOcclusion(g.player.position, g.camera.position, 100);
    const gl = g.renderer.getContext(),
      snapshot = (enabled) => {
        g.enemyRenderer.enabled = enabled;
        g.renderer.render(g.scene, g.camera);
        const data = new Uint8Array(
          gl.drawingBufferWidth * gl.drawingBufferHeight * 4,
        );
        gl.readPixels(
          0,
          0,
          gl.drawingBufferWidth,
          gl.drawingBufferHeight,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          data,
        );
        return {
          calls: g.renderer.info.render.calls,
          triangles: g.renderer.info.render.triangles,
          data,
        };
      };
    const cpu = snapshot(false),
      gpu = snapshot(true);
    let error = 0,
      changed = 0;
    for (let i = 0; i < cpu.data.length; i += 4) {
      let max = 0;
      for (let c = 0; c < 3; c++) {
        const d = Math.abs(cpu.data[i + c] - gpu.data[i + c]);
        error += d;
        max = Math.max(max, d);
      }
      if (max > 3) changed++;
    }
    const batch = g.enemyRenderer.getDebugState(),
      attributes = [...g.enemyRenderer.batches.values()].every(
        (b) =>
          b.mesh.geometry.attributes.vrPose0 &&
          b.mesh.customDepthMaterial &&
          b.mesh.customDistanceMaterial,
      ),
      bones = (models) => models.map((e) => Array.from(e.motion.pose));
    return {
      cpuCalls: cpu.calls,
      gpuCalls: gpu.calls,
      trianglesEqual: cpu.triangles === gpu.triangles,
      meanError: error / ((cpu.data.length / 4) * 3),
      changed: changed / (cpu.data.length / 4),
      batch,
      attributes,
      poses: bones(g.enemies),
      textures: g.renderer.info.memory.textures,
    };
  });
  assert.ok(
    crowd.gpuCalls < 300 &&
      crowd.gpuCalls < crowd.cpuCalls * 0.4 &&
      crowd.trianglesEqual &&
      crowd.attributes,
  );
  assert.ok(
    crowd.meanError < 0.1 && crowd.changed < 0.002,
    JSON.stringify(crowd),
  );
  assert.ok(
    crowd.poses.every((p) => p.every(Number.isFinite)) && crowd.textures < 32,
  );
  console.log(
    "PASS animated 160-crowd CPU/GPU pixel parity, full geometry and matching rigged shadows",
    JSON.stringify({ ...crowd, poses: undefined }),
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const g = window.__game;
      g.resize();
      g.renderer.render(g.scene, g.camera);
    });
    assert.ok(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth + 1 &&
          document.documentElement.scrollHeight <= innerHeight + 1,
      ),
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
