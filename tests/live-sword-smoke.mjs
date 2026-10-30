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
  rows = [];
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.setDefaultTimeout(20000);
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error/.test(m.text())) errors.push(m.text());
  });
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#start-button").click();
  await p.waitForFunction(() => !!document.pointerLockElement);
  await p.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.steps = (t) => {
      for (let i = 0; i < Math.ceil(t * 120); i++) g.advanceSimulation(1 / 120);
    };
  });
  for (const mode of ["third", "first"]) {
    if (mode === "first") {
      await p.keyboard.press("v");
      await p.waitForFunction(() => !!document.pointerLockElement);
    }
    for (const style of ["default", "broadsword", "twinblade"]) {
      await p.mouse.move(1200, 450);
      await p.evaluate((style) => {
        const g = window.__game;
        g.actions.cancel();
        g.actions.reset();
        g.parry.reset();
        g.lockOn.reset();
        for (const e of [...g.enemies]) g.removeEnemyWithoutReward(e);
        g.spawnTimer =
          g.nextChestTime =
          g.nextEliteTime =
          g.nextGoldenTime =
          g.nextAltarTime =
            1e9;
        g.invulnerable = 1e9;
        g._state.xpNeeded = 1e18;
        g.stats.critChance = 0;
        g.stats.spells = {};
        g.stats.swordEvolution = style === "default" ? "" : style;
        g.stats.weaponId = style === "broadsword" ? "greatsword" : "voidblade";
        g.applyLoadoutAppearance();
        g.player.position.set(0, g.groundHeight(0, 0), 0);
        g.actions.setAim(g.player.position.clone().set(0, 0, 1));
        g.updateCamera(1);
        if (style === "twinblade") g.actions.combo = 4;
        const enemy = (z) => {
          const e = g.spawnEnemy(0, z, 0, { noMutations: true });
          e.speed = 0;
          e.hp = e.maxHp = 1e8;
          e.tactics = { phase: "circle", timer: 1e9, angle: 0 };
          return e;
        };
        window.oldTarget = enemy(2);
        window.newTarget = enemy(-2);
        window.tracking = [];
      }, style);
      if (style === "broadsword") {
        await p.mouse.down({ button: "right" });
        await p.evaluate(() => steps(1.2));
        await p.mouse.up({ button: "right" });
      } else await p.mouse.click(1200, 450);
      await p.evaluate(() => {
        window.stroke = window.__game.actions.current;
        if (!stroke) throw Error("missing native attack");
      });
      for (let i = 1; i <= 12; i++) {
        await p.mouse.move(1200 - i * 93, 450);
        await p.evaluate(() => {
          const g = window.__game,
            a = stroke,
            before = a.elapsed,
            forward = g.player.position
              .clone()
              .set(
                Math.sin(g.player.rotation.y),
                0,
                Math.cos(g.player.rotation.y),
              );
          g.updateCamera(1 / 120);
          const immediate = g.camera
              .getWorldDirection(forward.clone())
              .setY(0)
              .normalize()
              .dot(forward),
            aim = a.direction.dot(forward);
          g.advanceSimulation(1 / 120);
          g.updateCamera(1 / 120);
          const camera = g.camera
            .getWorldDirection(forward.clone())
            .setY(0)
            .normalize()
            .dot(forward);
          tracking.push({
            immediate,
            aim,
            camera,
            same: g.actions.current === a,
            advanced: a.elapsed > before,
          });
        });
      }
      const row = await p.evaluate(
        ({ mode, style }) => {
          const g = window.__game,
            a = stroke,
            early = oldTarget.hp === 1e8 && newTarget.hp === 1e8;
          steps(Math.max(0, a.duration * a.markers[0] - a.elapsed + 0.002));
          const turnedHit = newTarget.hp < 1e8,
            oldMiss = oldTarget.hp === 1e8,
            heading = g.player.rotation.y;
          let maxSnap = 0;
          for (let i = 0; i < 200; i++) {
            const before = g.player.rotation.y;
            g.advanceSimulation(1 / 120);
            g.updateCamera(1 / 120);
            maxSnap = Math.max(
              maxSnap,
              Math.abs(
                Math.atan2(
                  Math.sin(g.player.rotation.y - before),
                  Math.cos(g.player.rotation.y - before),
                ),
              ),
            );
          }
          g.renderer.render(g.scene, g.camera);
          return {
            mode,
            style,
            early,
            turnedHit,
            oldMiss,
            maxSnap,
            heading,
            commands: g.actions.manualCommands,
            markers: a.nextMarker,
            expectedMarkers: a.markers.length,
            tracking,
          };
        },
        { mode, style },
      );
      assert.ok(
        row.early &&
          row.turnedHit &&
          row.oldMiss &&
          row.maxSnap < 1e-10 &&
          row.commands === 1 &&
          row.markers === row.expectedMarkers &&
          row.tracking.every(
            (f) =>
              f.immediate > 0.999999 &&
              f.camera > 0.999999 &&
              f.aim > 0.999999 &&
              f.same &&
              f.advanced,
          ),
        JSON.stringify(row),
      );
      rows.push(row);
    }
  }
  console.log(
    "PASS native mouse turning throughout light/charged-heavy/twin finisher in first/third person; live blade direction, corrected real hits, original timing and no recovery snap",
  );
  // Once launched, a sword wave keeps its own velocity despite further aiming.
  const wave = await p.evaluate(() => {
    const g = window.__game;
    g.actions.reset();
    g.stats.swordEvolution = "wave";
    g.actions.setAim(g.player.position.clone().set(1, 0, 0));
    g.actions.press("light");
    steps(0.3);
    const projectile = g.projectiles[0];
    if (!projectile) throw Error("wave not launched");
    const initial = projectile.direction.clone();
    g.actions.setAim(g.player.position.clone().set(-1, 0, 0));
    return {
      independent: projectile.direction.equals(initial),
      live: g.actions.current.direction.x === -1,
    };
  });
  assert.ok(wave.independent && wave.live);
  await p.keyboard.press("v");
  await p.waitForFunction(() => !document.pointerLockElement);
  const positions = await p.evaluate(() => {
    const g = window.__game;
    g.actions.cancel();
    g.stats.swordEvolution = "";
    g.updateCamera(1);
    const r = g.renderer.domElement.getBoundingClientRect(),
      point = (z) => {
        const v = g.player.position.clone();
        v.z += z;
        v.project(g.camera);
        return {
          x: r.x + ((v.x + 1) * r.width) / 2,
          y: r.y + ((1 - v.y) * r.height) / 2,
        };
      };
    return { front: point(4), back: point(-4) };
  });
  await p.mouse.move(positions.front.x, positions.front.y);
  await p.mouse.click(positions.front.x, positions.front.y);
  const initial = await p.evaluate(() => {
    window.aerialAction = window.__game.actions.current;
    return aerialAction.direction.toArray();
  });
  await p.mouse.move(positions.back.x, positions.back.y);
  const overhead = await p.evaluate((initial) => {
    const g = window.__game,
      a = g.actions.current;
    return {
      same: a === aerialAction,
      turn: a.direction.dot(g.player.position.clone().fromArray(initial)),
      aligned: a.direction.dot(
        g.player.position
          .clone()
          .set(Math.sin(g.player.rotation.y), 0, Math.cos(g.player.rotation.y)),
      ),
    };
  }, initial);
  assert.ok(
    overhead.same && overhead.turn < -0.95 && overhead.aligned > 0.999999,
    JSON.stringify(overhead),
  );
  await p.close();
  const m = await browser.newPage({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  m.on("pageerror", (e) => errors.push(e.message));
  await m.goto(base);
  await m.waitForFunction(() => window.__game?.artReady);
  await m.locator("#start-button").tap();
  await m.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e9;
    g._state.xpNeeded = 1e18;
  });
  await m.locator("#mobile-light").tap();
  const cdp = await m.context().newCDPSession(m),
    box = await m.locator("canvas").boundingBox(),
    x = box.x + box.width * 0.7,
    y = box.y + box.height * 0.5;
  const before = await m.evaluate(() => window.__game.player.rotation.y);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ id: 1, x, y }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ id: 1, x: x + 50, y: y + 10 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const touch = await m.evaluate((before) => {
    const g = window.__game,
      a = g.actions.current;
    g.updateCamera(1 / 120);
    const manualTurn = Math.abs(
        Math.atan2(
          Math.sin(g.player.rotation.y - before),
          Math.cos(g.player.rotation.y - before),
        ),
      ),
      yaw = g.player.rotation.y;
    g.setMove(1, 0);
    for (let i = 0; i < 12; i++) g.advanceSimulation(1 / 120);
    g.setMove(0, 0);
    return {
      manualTurn,
      moveTurn: Math.abs(g.player.rotation.y - yaw),
      same: g.actions.current === a,
      alignment: a.direction.dot(
        g.player.position
          .clone()
          .set(Math.sin(g.player.rotation.y), 0, Math.cos(g.player.rotation.y)),
      ),
    };
  }, before);
  assert.ok(
    touch.manualTurn > 0.2 &&
      touch.moveTurn > 0.05 &&
      touch.same &&
      touch.alignment > 0.999999,
    JSON.stringify(touch),
  );
  assert.deepEqual(errors, []);
  if (out)
    await writeFile(
      out + "/live-sword-verification.json",
      JSON.stringify({ rows, wave, overhead, touch, errors }, null, 2) + "\n",
    );
  console.log(
    "PASS independent launched sword wave, overhead live aim and right-touch/steering during mobile attacks; no browser errors",
  );
} finally {
  await browser.close();
}
