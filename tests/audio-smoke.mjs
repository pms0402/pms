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
try {
  const p = await browser.newPage({ viewport: { width: 1000, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(process.env.BASE_URL || "http://127.0.0.1:5184");
  await p.waitForFunction(() => window.__game?.artReady);
  await p.locator("#sound-toggle").click();
  await p.locator("#start-button").click();
  const result = await p.evaluate(async () => {
    const g = window.__game,
      s = g.soundscape;
    cancelAnimationFrame(g.raf);
    g.initAudio();
    await s.context.resume();
    s.reset();
    s.setVolumes(0.7, 0);
    const analyser = s.context.createAnalyser();
    analyser.fftSize = 2048;
    s.master.connect(analyser);
    const samples = new Float32Array(analyser.fftSize);
    const played = s.play("perfect-parry");
    await new Promise((r) => setTimeout(r, 55));
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(
        samples.reduce((a, v) => a + v * v, 0) / samples.length,
      ),
      peak = Math.max(...samples.map(Math.abs));
    const cooldown = !s.play("perfect-parry");
    s.reset();
    const types = [
      "attack",
      "hit",
      "critical",
      "guard",
      "guard-hit",
      "perfect-parry",
      "counter",
      "fireball",
      "frost",
      "lightning",
      "orbit",
      "hurt",
      "dash",
      "coin",
      "equip",
      "upgrade",
      "start",
      "stage",
      "win",
      "over",
      "combo",
      "step",
      "boss",
      "fire-impact",
      "frost-impact",
      "lightning-impact",
      "orbit-impact",
    ];
    for (let i = 0; i < 80; i++)
      s.play(types[i % types.length], { x: 4, y: 0, z: 3 });
    const cap = s.voices.size,
      peakVoices = s.peakVoices;
    await new Promise((r) => setTimeout(r, 850));
    const released = s.voices.size;
    s.setRegion("tundra");
    await new Promise((r) => setTimeout(r, 70));
    const region = s.region,
      freq = s.windFilter.frequency.value;
    g.setMuted(true);
    await new Promise((r) => setTimeout(r, 160));
    analyser.getFloatTimeDomainData(samples);
    const mutedPeak = Math.max(...samples.map(Math.abs)),
      mutedBlocked = !s.play("hit");
    g.setMuted(false);
    s.setVolumes(0, 0.4);
    const effectsZero = !s.play("hit");
    s.reset();
    analyser.disconnect();
    return {
      played,
      rms,
      peak,
      cooldown,
      cap,
      peakVoices,
      released,
      region,
      freq,
      mutedPeak,
      mutedBlocked,
      effectsZero,
    };
  });
  assert.ok(result.played && result.rms > 0.001 && result.peak < 1);
  assert.ok(result.cooldown && result.cap <= 16 && result.peakVoices <= 16);
  assert.equal(result.released, 0);
  assert.equal(result.region, "tundra");
  assert.ok(
    result.freq > 420 &&
      result.mutedPeak < 0.001 &&
      result.mutedBlocked &&
      result.effectsZero,
  );
  await p.locator("#pause-button").click();
  await p.locator("#pause-settings").click();
  for (const [id, v] of [
    ["effects-volume", ".25"],
    ["background-volume", ".55"],
  ])
    await p.locator("#" + id).evaluate((e, v) => {
      e.value = v;
      e.dispatchEvent(new Event("input", { bubbles: true }));
    }, v);
  await p.reload();
  await p.waitForFunction(() => window.__game?.artReady);
  const stored = await p.evaluate(() => ({
    e: window.__game.soundscape.effectsVolume,
    b: window.__game.soundscape.backgroundVolume,
  }));
  assert.deepEqual(stored, { e: 0.25, b: 0.55 });
  assert.deepEqual(errors, []);
  console.log(
    "PASS native Web Audio signal, independent mix, region ambience, bounded voices, cleanup, mute and saved sliders",
    JSON.stringify(result),
  );
} finally {
  await browser.close();
}
