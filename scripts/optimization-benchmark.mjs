import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.BASE_URL || "http://127.0.0.1:5200",
  output =
    process.env.BENCH_OUTPUT || "/workspace/artifacts/voidrun-opt/before";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--enable-precise-memory-info",
  ],
});
const errors = [];
async function prepare(base) {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(e.message));
  await p.addInitScript(() => {
    let seed = 88213;
    window.seedBench = () => (seed = 88213);
    Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  });
  await p.goto(base, { timeout: 60000 });
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.perfFixture = (count) => {
      seedBench();
      g.start();
      g.frames = 0;
      g.enemySerial = 0;
      g.setQuality("high");
      g.spawnTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e9;
      g.stats.critChance = 0;
      g._state.xpNeeded = 1e12;
      g.invulnerable = 1e9;
      g.stats.spells = { fireball: 3, frost: 3, lightning: 3, orbit: 3 };
      g.stats.skillSlots = ["fireball", "frost", "orbit"];
      g.actions.syncSlots();
      g.setViewMode("overhead");
      g.player.rotation.y = 0;
      g.actions.hasAim = false;
      for (let i = 0; i < count; i++) {
        const a = i * 2.399,
          r = 6 + (i % 10),
          e = g.spawnEnemy(
            Math.sin(a) * r,
            Math.cos(a) * r,
            [0, 1, 2, 3, 5, 7, 8, 9][i % 8],
            { mutations: [] },
          );
        e.hp = e.maxHp = 1e9;
      }
      g.camera.position.set(20, 26, 25);
      g.camera.lookAt(0, 0.5, 0);
      g.renderer.setSize(640, 360, false);
      g.camera.aspect = 640 / 360;
      g.camera.updateProjectionMatrix();
      g.world.updateOcclusion(g.player.position, g.camera.position, 100);
      g.emit();
    };
  });
  return p;
}
try {
  const p = await prepare(base);
  if (process.env.COMPARE_BASE_URL) {
    const prior = await prepare(process.env.COMPARE_BASE_URL),
      pages = [prior, p],
      cases = [];
    for (const count of [15, 25, 160]) {
      const samples = [[], []],
        states = [[], []];
      for (let round = 0; round < 7; round++)
        for (const side of round % 2 ? [1, 0] : [0, 1]) {
          const sample = await pages[side].evaluate((count) => {
            perfFixture(count);
            const g = window.__game;
            const step = (i) => {
              g.frames++;
              if (i % 36 === 0) g.actions.press("light");
              if (i % 90 === 0)
                g.actions.press("skill" + (Math.floor(i / 90) % 3));
              g.advanceSimulation(1 / 60);
              g.aimVisual.update();
              g.scene.updateMatrixWorld(true);
              g.scene.onBeforeRender(g.renderer, g.scene, g.camera);
              if (i % 6 === 0) g.emit();
            };
            for (let i = 0; i < 60; i++) step(i);
            const start = performance.now();
            for (let i = 0; i < 360; i++) step(i);
            const total = performance.now() - start;
            return {
              ms: total,
              actors: g.enemies.length,
              positions: g.enemies.map((e) => [
                e.group.position.x,
                e.group.position.z,
                e.hp,
              ]),
              hp: g.state.hp,
            };
          }, count);
          states[side].push(
            JSON.stringify({
              actors: sample.actors,
              positions: sample.positions,
              hp: sample.hp,
            }),
          );
          if (round >= 2) samples[side].push(sample.ms / 360);
        }
      if (!states[0].every((s, i) => s === states[1][i])) {
        await writeFile(
          `${output}/diverged.json`,
          JSON.stringify(
            {
              count,
              samples,
              states: states.map((a) => a.map((s) => JSON.parse(s))),
            },
            null,
            2,
          ),
        );
        throw Error("comparison simulation diverged");
      }
      const medians = samples.map((a) => [...a].sort((a, b) => a - b)[2]);
      cases.push({
        actors: count,
        before: samples[0],
        after: samples[1],
        beforeMedianMs: medians[0],
        afterMedianMs: medians[1],
        reductionPercent: 100 * (1 - medians[1] / medians[0]),
        identicalSimulation: true,
      });
    }
    const report = {
      cases,
      errors,
      method:
        "Alternating before/after CPU preparation without CDP sampling or timing wrappers. Each of 7 rounds restarts a seeded 15/25/160-actor scene, warms 60 full steps, times 360 simulation/aim/matrix/batch steps and HUD every sixth step; first 2 rounds discarded, median of remaining 5. No rasterization inside timed work. Exact final positions, HP and surviving count compared across both builds. Same high-quality settings. CPU timings are not GPU FPS.",
    };
    if (errors.length) throw new Error(errors.join("\n"));
    await writeFile(
      `${output}/compare-cpu.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  } else {
    const c = await p.context().newCDPSession(p);
    await c.send("Profiler.enable");
    await c.send("Profiler.setSamplingInterval", { interval: 200 });
    const cases = [];
    for (const count of [15, 25, 160]) {
      await p.evaluate((count) => {
        perfFixture(count);
        const g = window.__game;
        for (let i = 0; i < 60; i++) g.advanceSimulation(1 / 60);
        g.renderer.render(g.scene, g.camera);
      }, count);
      await c.send("Profiler.start");
      const cpu = await p.evaluate((count) => {
        const g = window.__game,
          measured = {},
          restore = [];
        for (const [name, obj, key] of [
          ["simulate", g, "advanceSimulation"],
          ["collision", g.world, "resolve"],
          ["steering", g.world, "steer"],
          ["batch", g.enemyRenderer, "sync"],
          ["aim", g.aimVisual, "update"],
          ["hud", g, "emit"],
        ]) {
          const original = obj[key];
          measured[name] = { calls: 0, ms: 0 };
          obj[key] = function (...args) {
            const t = performance.now();
            try {
              return original.apply(this, args);
            } finally {
              measured[name].calls++;
              measured[name].ms += performance.now() - t;
            }
          };
          restore.push(() => (obj[key] = original));
        }
        const observer = new MutationObserver(() => {});
        observer.observe(document.getElementById("arena"), {
          subtree: true,
          childList: true,
          attributes: true,
          characterData: true,
        });
        const start = performance.now(),
          frames = 360;
        for (let i = 0; i < frames; i++) {
          g.frames++;
          if (i % 36 === 0) g.actions.press("light");
          if (i % 90 === 0) g.actions.press("skill" + (Math.floor(i / 90) % 3));
          g.advanceSimulation(1 / 60);
          g.aimVisual.update();
          g.scene.updateMatrixWorld(true);
          g.scene.onBeforeRender(g.renderer, g.scene, g.camera);
          if (i % 6 === 0) g.emit();
        }
        const total = performance.now() - start,
          records = observer.takeRecords();
        observer.disconnect();
        restore.forEach((f) => f());
        return {
          actors: count,
          remaining: g.enemies.length,
          frames,
          totalMs: total,
          perFrameMs: total / frames,
          measured,
          domMutations: records.length,
          domChildren: records.filter((r) => r.type === "childList").length,
        };
      }, count);
      const profile = await c.send("Profiler.stop");
      await writeFile(
        `${output}/cpu-${count}.json`,
        JSON.stringify(profile.profile),
      );
      const functions = new Map(
        profile.profile.nodes.map((n) => [n.id, n.callFrame]),
      );
      const samples = {};
      for (let i = 0; i < (profile.profile.samples || []).length; i++) {
        const f = functions.get(profile.profile.samples[i]),
          name =
            (f?.functionName || "(anonymous)") +
            " " +
            (f?.url?.split("/").at(-1) || "");
        samples[name] =
          (samples[name] || 0) + (profile.profile.timeDeltas?.[i] || 0);
      }
      cpu.sampledHot = Object.entries(samples)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12);
      cases.push(cpu);
    }
    const staticFrame = await p.evaluate(async () => {
      perfFixture(160);
      const g = window.__game;
      for (const e of g.enemies) {
        e.speed = 0;
        e.actionTimer = e.shootTimer = 1e9;
      }
      for (let i = 0; i < 12; i++) g.advanceSimulation(1 / 60);
      const frame = [],
        cpu = [];
      let previous;
      for (let i = 0; i < 28; i++)
        await new Promise((resolve) =>
          requestAnimationFrame((now) => {
            const t = performance.now();
            g.renderer.render(g.scene, g.camera);
            if (i >= 4) {
              cpu.push(performance.now() - t);
              if (previous !== undefined) frame.push(now - previous);
            }
            previous = now;
            resolve();
          }),
        );
      const sort = (a) => a.sort((a, b) => a - b),
        f = sort(frame),
        u = sort(cpu),
        info = g.renderer.info,
        gl = g.renderer.getContext(),
        ext = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        hardware: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "",
        frames: f.length,
        frameMedianMs: f[Math.floor(f.length / 2)],
        frameP95Ms: f[Math.floor(f.length * 0.95)],
        submitMedianMs: u[Math.floor(u.length / 2)],
        calls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        image: g.renderer.domElement.toDataURL(),
      };
    });
    await writeFile(
      `${output}/crowd.png`,
      Buffer.from(staticFrame.image.split(",")[1], "base64"),
    );
    delete staticFrame.image;
    const report = {
      cases,
      staticFrame,
      errors,
      method:
        "Chromium/SwiftShader, fixed seed, high quality unchanged, 640×360 backing buffer. 360 real simulation/aim/batch preparation frames with manual action commands and HUD every sixth frame; no render inside CPU loop. Named timings are nested, not additive. Separate 4 warmup + 24 RAF static crowd frames include software rasterization. Profiler instrumentation is test-only.",
    };
    if (errors.length) throw new Error(errors.join("\n"));
    await writeFile(
      `${output}/metrics.json`,
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(JSON.stringify(report));
  }
} finally {
  await browser.close();
}
