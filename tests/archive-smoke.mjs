import assert from "node:assert/strict";
import { chromium } from "playwright";
const b = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
try {
  const p = await b.newPage({ viewport: { width: 1180, height: 820 } }),
    errors = [],
    requests = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("request", (r) => {
    if (r.url().startsWith("http")) requests.push(r.url());
  });
  const url = new URL(
    "versions/v0.16.0.html",
    (process.env.BASE_URL || "http://127.0.0.1:5182").replace(/\/?$/, "/"),
  ).href;
  await p.goto(url);
  await p.waitForFunction(() => window.__game?.artReady);
  assert.equal(await p.locator(".build-label b").textContent(), "v0.16.0");
  assert.equal(await p.locator("#camera-mode").count(), 0);
  await p.locator("#start-button").click();
  assert.equal(await p.evaluate(() => window.__game.state.phase), "playing");
  const before = await p.evaluate(() => {
    cancelAnimationFrame(window.__game.raf);
    return window.__game.player.position.toArray();
  });
  await p.keyboard.down("d");
  await p.evaluate(() => window.__game.stepForTest(0.2));
  await p.keyboard.up("d");
  const after = await p.evaluate(() => window.__game.player.position.toArray());
  assert.ok(Math.hypot(after[0] - before[0], after[2] - before[2]) > 1);
  assert.deepEqual(requests, [url]);
  assert.deepEqual(errors, []);
  console.log(
    "PASS archived v0.16.0 original UI, WebGL, real keyboard movement and self-contained assets at its fixed URL",
  );
} finally {
  await b.close();
}
