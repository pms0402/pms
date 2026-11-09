import { chromium } from "playwright";
import {writeFile,mkdir} from "node:fs/promises";
import {dirname} from 'node:path';
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
      // Identical three-entry cache at every sample: mixed layouts legitimately
      // own different numbers of meshes, so a random snapshot is not a leak test.
      for(const region of ['volcano','forest','ruins']){g.world.setRegion(region,0);g.world.topology.navigationFor(1.4,7.5);g.renderer.render(g.scene,g.camera);}
    }, i);
    await c.send("HeapProfiler.collectGarbage");
    // Drain pending renderer work, then measure live heap and backing separately.
    await p.evaluate(()=>new Promise(resolve=>setTimeout(resolve,0)));
    await c.send("HeapProfiler.collectGarbage");
    const usage=await c.send('Runtime.getHeapUsage');
    samples.push({heap:usage.usedSize,backing:usage.backingStorageSize,
      ...await p.evaluate(() => ({
        reportedHeap: performance.memory.usedJSHeapSize,
        ...window.__game.renderer.info.memory,
        batches: window.__game.enemyRenderer.batches.size,
        lodSources: window.__game.enemyRenderer.lod.cache.size,
        owned: window.__game.ownedGeometries.size,
        cpuParts: window.__game.enemyRenderer.cpuParts.size,
        terrainCache:window.__game.world.topology.cache.size,
        terrainKeys:[...window.__game.world.topology.cache.keys()].sort(),
        terrainBossKeys:[...window.__game.world.topology.cache.values()].filter(c=>c.baseBossNavigation).map(c=>c.key).sort(),
      }))});
  }
  const result = {
    cycles: 16,
    samples,
    errors,
    method:
      "Chromium/SwiftShader, rotate all five regions, spawn 24 mixed species including bosses and all forced mutation marker types, render then restart, normalize BOTH player and boss navigation caches for volcano/forest/ruins variant-0, drain renderer work and force test-only GC twice; CDP Runtime.getHeapUsage retained heap/backing storage plus performance.memory; verify geometry/texture/heap plateau and cache cap after 8 warmup cycles",
  };
  const output=process.env.STRESS_OUTPUT||(process.env.SMOKE_OUTPUT?process.env.SMOKE_OUTPUT+'/verification.json':null);
  if(output){await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(result,null,2)+'\n');}
  const tail = samples.slice(8);
  assert.ok(tail.at(-1).geometries <= tail[0].geometries + 2);
  assert.ok(tail.at(-1).textures <= tail[0].textures + 1);
  assert.ok(tail.at(-1).heap < tail[0].heap + 1000000);
  assert.ok(tail.at(-1).backing <= tail[0].backing + 500000);
  assert.ok(tail.every(s=>s.cpuParts===0&&s.batches===tail[0].batches&&s.lodSources===tail[0].lodSources&&s.owned===tail[0].owned));
  assert.deepEqual(errors, []);
  assert.ok(tail.every(s=>s.terrainCache===3&&JSON.stringify(s.terrainKeys)===JSON.stringify(['forest:0','ruins:0','volcano:0'])));
  assert.ok(tail.every(s=>JSON.stringify(s.terrainBossKeys)===JSON.stringify(['forest:0','ruins:0','volcano:0'])));
  console.log(
    "PASS 16 mixed-region restarts, warm GPU/LOD cache plateau, retained heap and empty CPU pose cache",
    JSON.stringify(result),
  );
} finally {
  await b.close();
}
