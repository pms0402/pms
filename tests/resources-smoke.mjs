import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--enable-precise-memory-info",
  ],
});
try {
  const p = await b.newPage({ viewport: { width: 1000, height: 760 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5182");
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => cancelAnimationFrame(window.__game.raf));
  const c = await p.context().newCDPSession(p),
    samples = [];
  for (let i = 0; i < 16; i++) {
    await p.evaluate((i) => {
      const g = window.__game;
      g.start();
      g.regionId = ["volcano", "tundra", "forest", "ruins", "void"][i % 5];
      g.regionSystem.setRegion(g.regionId);
      g.landscape.update(0);
      g.atmosphere.update(0);
      g.renderer.setSize(640, 400, false);
      for (let n = 0; n < 24; n++)
        g.spawnEnemy(Math.sin(n) * 8, Math.cos(n) * 8, n % 10, {
          mutations: [
            ["vampire", "explosive", "steel", "berserker", "splitter", "swift"][
              n % 6
            ],
            ["vampire", "explosive", "steel", "berserker", "splitter", "swift"][
              (n + 1) % 6
            ],
          ],
        });
      g.renderer.render(g.scene, g.camera);
      g.start();
      g.renderer.render(g.scene, g.camera);
    }, i);
    await c.send("HeapProfiler.collectGarbage");
    samples.push(
      await p.evaluate(() => ({
        heap: performance.memory.usedJSHeapSize,
        ...window.__game.renderer.info.memory,
        batches: window.__game.enemyRenderer.batches.size,
        lodSources: window.__game.enemyRenderer.lod.cache.size,
        owned: window.__game.ownedGeometries.size,
        cpuParts: window.__game.enemyRenderer.cpuParts.size,
      })),
    );
  }
  const tail = samples.slice(8);
  assert.ok(tail.at(-1).geometries <= tail[0].geometries + 2);
  assert.ok(tail.at(-1).textures <= tail[0].textures + 1);
  assert.ok(tail.at(-1).heap < tail[0].heap + 1000000);
  assert.ok(tail.every(s=>s.cpuParts===0&&s.batches===tail[0].batches&&s.lodSources===tail[0].lodSources&&s.owned===tail[0].owned));
  assert.deepEqual(errors, []);
  const result = {
    cycles: 16,
    samples,
    errors,
    method:
      "Chromium/SwiftShader, rotate all five regions, spawn 24 mixed species including bosses and all forced mutation marker types, render then restart and force test-only GC each cycle; verify retained resource plateau after 8 warmup cycles",
  };
  if (process.env.STRESS_OUTPUT)
    await writeFile(
      process.env.STRESS_OUTPUT,
      JSON.stringify(result, null, 2) + "\n",
    );
  console.log(
    "PASS 16 mixed-region restarts, warm GPU/LOD cache plateau, retained heap and empty CPU pose cache",
    JSON.stringify(result),
  );
} finally {
  await b.close();
}
