import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
const errors = [], gpuErrors = [], badResponses = [];
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (/GL_INVALID|Shader Error|VALIDATE_STATUS|THREE.WebGLProgram:/.test(message.text())) gpuErrors.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) badResponses.push(response.url()); });
  await page.goto(process.env.BASE_URL || 'http://127.0.0.1:5174');
  await page.waitForFunction(() => window.__game?.artReady);
  await page.locator('#start-button').click();
  const result = await page.evaluate(() => {
    const g = window.__game; cancelAnimationFrame(g.raf);
    g.spawnTimer = g.attackTimer = g.nextChestTime = g.nextEliteTime = g.nextGoldenTime = g.nextAltarTime = 1e6;
    g.stats.spells = {}; g.stats.critChance = 0; g.invulnerable = 1e6; g._state.xpNeeded = 1e9;
    const assets = { ...g.presentation.status, color: g.presentation.terrainMap.image.width, normal: g.presentation.terrainNormal.image.width, environment: g.scene.environment.image.width };
    const probe = g.scene.clone(false), camera = g.camera.clone();
    probe.add(g.world.ground.clone(), g.hemi.clone()); const light = g.sunlight.clone(); light.castShadow = false; probe.add(light);
    camera.position.set(0, 6, .001); camera.lookAt(0, 0, 0); camera.aspect = 1; camera.updateProjectionMatrix();
    g.renderer.setSize(128, 128, false); g.renderer.render(probe, camera);
    const gl = g.renderer.getContext(), pixels = new Uint8Array(128 * 128 * 4); gl.readPixels(0, 0, 128, 128, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let sum = 0, square = 0;
    for (let i = 0; i < pixels.length; i += 4) { const value = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3; sum += value; square += value * value; }
    const variance = square / 16384 - (sum / 16384) ** 2;
    const highGrass = g.world.art.grass.count, mistBefore = g.world.art.mist.instanceMatrix.array[12];
    g.world.art.update(.5); const drifting = g.world.art.mist.instanceMatrix.array[12] !== mistBefore;
    g.setQuality('low'); const low = { grass: g.world.art.grass.count, mist: g.world.art.mist.visible, shadows: g.renderer.shadowMap.enabled };
    g.setQuality('high'); const restored = g.world.art.grass.count === highGrass && g.world.art.mist.visible && g.renderer.shadowMap.enabled;
    g.renderer.setSize(800, 560, false); g.camera.aspect = 800 / 560; g.camera.updateProjectionMatrix(); g.camera.position.set(20, 26, 25); g.camera.lookAt(0, .5, 0);
    for (let i = 0; i < 160; i++) { const a = i * 2.399, r = 4 + i % 13, enemy = g.spawnEnemy(Math.cos(a) * r, Math.sin(a) * r, [0, 1, 2, 3, 5, 6, 7, 8, 9][i % 9], { mutations: [] }); enemy.hp = enemy.maxHp = 1e6; enemy.speed = 0; }
    const target = g.enemies[0], hp = target.hp, stats = JSON.stringify(g.stats);
    g.hitEnemy(target, 10); g.animateEffects(.03); g.world.updateOcclusion(g.player.position, g.camera.position, 100); g.renderer.render(g.scene, g.camera);
    const hit = { damage: hp - target.hp, particles: g.combatArt.count, shadowCount: g.actorShadows.mesh.count, unchanged: stats === JSON.stringify(g.stats), calls: g.renderer.info.render.calls, geometries: g.renderer.info.memory.geometries, textures: g.renderer.info.memory.textures };
    for (let i = 0; i < 1000; i++) g.combatArt.hit(g.player.position, 'sword'); const capped = g.combatArt.count === g.combatArt.capacity;
    g.start(); g.renderer.render(g.scene, g.camera); const reset = g.combatArt.count === 0 && g.actorShadows.mesh.count === 0;
    return { assets, variance, highGrass, low, drifting, restored, hit, capped, reset };
  });
  assert.equal(result.assets.failed, 0); assert.equal(result.assets.loaded, 7); assert.equal(result.assets.color, 1024); assert.equal(result.assets.normal, 512); assert.equal(result.assets.environment, 512);
  assert.ok(result.variance > 12, 'the actual GPU image contains stone texture detail, not a flat fallback');
  assert.ok(result.highGrass > 1000 && result.low.grass < result.highGrass && !result.low.mist && !result.low.shadows && result.restored && result.drifting);
  assert.equal(result.hit.damage, 10); assert.ok(result.hit.particles > 0 && result.hit.unchanged); assert.equal(result.hit.shadowCount, 160);
  assert.ok(result.hit.calls < 300 && result.hit.geometries < 180 && result.hit.textures < 32); assert.ok(result.capped && result.reset);
  for (const viewport of [{ width: 390, height: 844 }, { width: 1180, height: 820 }]) {
    await page.setViewportSize(viewport); const dimensions = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]); assert.ok(dimensions.every(n => n <= 1));
  }
  assert.deepEqual(errors, []); assert.deepEqual(gpuErrors, []); assert.deepEqual(badResponses, []);
  console.log('PASS local PBR/HDR assets, actual textured GPU pixels, shader compilation, wind/mist quality modes, 160 grounded actors, bounded impact batch and unchanged combat', JSON.stringify(result));
} finally { await browser.close(); }
