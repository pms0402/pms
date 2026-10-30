import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const errors = [];
try {
  const page = await manualPage(browser,{ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174');
  await page.waitForFunction(() => window.__game?.frames > 1);
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => {
    const g = window.__game; cancelAnimationFrame(g.raf);
    const angle = (a, b) => ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    const setup = () => {
      g.start(); g.spawnTimer = g.attackTimer = g.nextChestTime = g.nextEliteTime = g.nextGoldenTime = g.nextAltarTime = 1e6;
      g.stats.spells = {};g.actions.syncSlots(); g.stats.critChance = 0; g.invulnerable = 1e6; g._state.xpNeeded = 1e9; g.setPlaybackSpeed(1);
    };
    const advance = (seconds, hz = 60) => { for (let i = 0; i < Math.round(seconds * hz); i++) g.advanceSimulation(1 / hz); };
    const pose = () => [g.legLeft.rotation.x, g.legRight.rotation.x, g.kneeLeft.rotation.x, g.kneeRight.rotation.x, g.rightShoulder.rotation.x];
    const rates = [];
    for (const hz of [30, 60, 120]) {
      setup(); g.setMoveInput(1, 0); advance(.4, hz);
      rates.push({ hz, phase: g.playerMotion.phase, stride: g.playerMotion.stride, facing: g.playerMotion.facing, pose: pose(), x: g.player.position.x, z: g.player.position.z });
    }
    setup(); g.setMoveInput(1, 0); advance(.4);
    const walking = pose(); g.setMoveInput(0, 0); advance(1 / 60);
    const stopped = pose(), releaseStride = g.playerMotion.stride;
    advance(.8); const settled = { stride: g.playerMotion.stride, leg: g.legLeft.rotation.x };
    const beforeFacing = g.player.rotation.y + g.playerVisual.rotation.y;
    g.player.rotation.y += Math.PI / 2; const logicalFacing = g.player.rotation.y; advance(1 / 60);
    const turnStep = Math.abs(angle(beforeFacing, g.player.rotation.y + g.playerVisual.rotation.y));
    const combatFacingUnchanged = g.player.rotation.y === logicalFacing;
    const enemy = g.spawnEnemy(g.player.position.x, g.player.position.z + 2, 0); enemy.speed = 0; enemy.hp = enemy.maxHp = 1e6;
    const stats = JSON.stringify(g.stats), hpBefore = enemy.hp;
    window.testStrike(g); const immediateHit = enemy.hp < hpBefore, hpAfter = enemy.hp;
    const duration = g.attackAnimTotal; advance(.4);
    const noExtraHits = enemy.hp === hpAfter, sameStats = JSON.stringify(g.stats) === stats;
    g.stats.swordEvolution = 'twinblade'; g.applyLoadoutAppearance();
    enemy.group.position.set(g.player.position.x, g.player.position.y, g.player.position.z + 2); enemy.stagger.set(0, 0, 0); g.spatialDirty = true;
    const twinAttack = window.testStrike(g); advance(.1);
    const twinYaw = g.leftShoulder.rotation.y;
    advance(.7); const recoveredTwinYaw = g.leftShoulder.rotation.y;
    g.dash(); advance(1 / 60); const dashLean = g.playerVisual.rotation.x; advance(.8); const restLean = g.playerVisual.rotation.x;
    setup();g.setViewMode('overhead'); // Retain the original full-crowd visibility fixture.
    for (let i = 0; i < 160; i++) {
      const a = i * 2.399, r = 6 + i % 10;
      const e = g.spawnEnemy(Math.cos(a) * r, Math.sin(a) * r, [0, 1, 2, 3, 5, 6, 7, 8, 9][i % 9]); e.hp = e.maxHp = 1e6;
    }
    advance(.3); g.renderer.render(g.scene, g.camera);
    const batch = g.enemyRenderer.getDebugState(), calls = g.renderer.info.render.calls;
    const finiteCrowd = g.enemies.every(e => [...e.visual.position.toArray(), ...e.visual.rotation.toArray().slice(0, 3), ...e.visual.scale.toArray()].every(Number.isFinite));
    const slime = g.enemies.find(e => e.kind === 7), old = slime.group; g.removeEnemyWithoutReward(slime);
    const reused = g.spawnEnemy(12, 3, 7), cleanPool = reused.group === old && !reused.motion && reused.visual.rotation.y === 0 && reused.visual.scale.x === 1;
    advance(.1);
    const speeds = [];
    for (const speed of [1, 2, 3]) { g.setPlaybackSpeed(speed); const elapsed = g.state.elapsed; g.advanceSimulation(.05); speeds.push(g.state.elapsed - elapsed); }
    g.pause(); const frozenPose = pose(); g.advanceSimulation(.05); const paused = JSON.stringify(pose()) === JSON.stringify(frozenPose);
    setup(); const reset = g.playerMotion.stride === 0 && g.playerMotion.phase === 0;
    return { rates, stopStep: Math.max(...walking.map((n, i) => Math.abs(n - stopped[i]))), releaseStride, settled, turnStep, combatFacingUnchanged, immediateHit, noExtraHits, sameStats, duration, twinAttack, twinYaw, recoveredTwinYaw, dashLean, restLean, finiteCrowd, cleanPool, calls, batch, speeds, paused, reset };
  });
  for (const rate of result.rates) {
    assert.ok(Math.abs(rate.phase - result.rates[0].phase) < 1e-8);
    assert.ok(Math.abs(rate.stride - result.rates[0].stride) < 1e-8);
    assert.ok(Math.max(...rate.pose.map((v, i) => Math.abs(v - result.rates[0].pose[i]))) < .07, 'high refresh and normal refresh retain the same gait');
  }
  assert.ok(result.stopStep < .13 && result.releaseStride > .6, 'release blends out rather than snapping legs to idle');
  assert.ok(result.settled.stride < .001 && Math.abs(result.settled.leg) < .003);
  assert.ok(result.turnStep > 0 && result.turnStep < .5 && result.combatFacingUnchanged);
  assert.ok(result.immediateHit && result.noExtraHits && result.sameStats && result.duration === .54);
  assert.ok(result.twinAttack && Math.abs(result.twinYaw) > .05 && Math.abs(result.recoveredTwinYaw) < .001, JSON.stringify({twinAttack:result.twinAttack,yaw:result.twinYaw,recovered:result.recoveredTwinYaw}));
  assert.ok(result.dashLean > .01 && result.dashLean < .15 && Math.abs(result.restLean) < .003);
  assert.ok(result.finiteCrowd && result.cleanPool && result.batch.instances > 500 && result.calls < 300);
  result.speeds.forEach((v, i) => assert.ok(Math.abs(v - .05 * (i + 1)) < 1e-8));
  assert.ok(result.paused && result.reset); assert.deepEqual(errors, []);
  console.log('PASS smooth gait/release, 30/60/120Hz, shortest turns, sword/twinblade recovery, dash, 160 instanced actors, pool reset and unchanged combat', JSON.stringify(result));
} finally { await browser.close(); }
