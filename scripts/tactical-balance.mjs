import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { getPermanentBonuses, normalizeProgress } from "../src/progression.js";
// Isolated fixed-build duels, not a claim of human/full-run clear rates.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: 960, height: 700 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5191");
  await page.waitForFunction(() => window.__game?.artReady);
  await page.locator("#start-button").click();
  const permanent = Object.fromEntries(
    [1, 5, 10, 20, 40].map((f) => [
      f,
      getPermanentBonuses(
        normalizeProgress({
          upgrades: {
            power: f === 1 ? 0 : f === 5 ? 5 : 12,
            arcana: f === 1 ? 0 : f === 5 ? 5 : 12,
            vitality: f === 1 ? 0 : f === 5 ? 5 : 12,
          },
        }),
      ),
    ]),
  );
  const results = await page.evaluate((permanent) => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    const rows = [];
    for (const floor of [1, 5, 10, 20, 40])
      for (const type of floor > 10
        ? ["boss"]
        : ["ordinary", "elite", "boss", "mixed"]) {
        g._state.phase = "menu";
        g.setPermanentBonuses(permanent[floor]);
        g.start();
        g.setViewMode("overhead");
        g.spawnTimer =
          g.nextChestTime =
          g.nextEliteTime =
          g.nextGoldenTime =
          g.nextAltarTime =
            1e6;
        g._state.stage = floor;
        g.mode = floor > 10 ? "abyss" : "normal";
        g._state.xpNeeded = 1e9;
        g.stats.critChance = 0;
        const buy = (id) => {
          g._state.phase = "upgrade";
          g.upgradeChoices = [{ id }];
          if (!g.chooseUpgrade(id)) throw Error("invalid build " + id);
        };
        for (const [id, n] of Object.entries(
          floor === 1
            ? {}
            : floor === 5
              ? { power: 5, spell_power: 4, vitality: 4 }
              : {
                  power: 12,
                  spell_power: 12,
                  vitality: 8,
                  haste: 4,
                  blade_range: 4,
                },
        ))
          for (let j = 0; j < n; j++) buy(id);
        for (const id of ["fireball", "frost", "lightning"])
          for (
            let rank = g.stats.spells[id] || 0;
            rank < (floor === 1 ? 1 : floor === 5 ? 3 : 5);
            rank++
          )
            buy("spell_" + id);
        if (floor >= 10)
          for (const id of ["fireball", "frost", "lightning"])
            buy("evolve_" + id);
        g._state.phase = "playing";
        g.emit();
        const hp = g.state.hp,
          stats = {
            damage: g.combatStats.damage,
            spellDamage: g.combatStats.spellDamage,
            hp,
          };
        const e =
          type === "boss"
            ? g.spawnBoss()
            : g.spawnEnemy(0, 5, 0, { elite: type === "elite", mutations: [] });
        e.group.position.set(0, g.groundHeight(0, 5), 5);
        if (type === "mixed")
          for (let n = 1; n < 8; n++) {
            const angle = (n * Math.PI) / 4;
            g.spawnEnemy(
              Math.sin(angle) * 8,
              Math.cos(angle) * 8,
              floor === 1 ? n % 3 : [0, 1, 2, 3, 5, 6, 8][n - 1],
              { elite: n === 4, noMutations: true },
            );
          }
        const enemies = g.enemies.slice();
        const enemyHp = enemies.reduce((sum, enemy) => sum + enemy.maxHp, 0);
        const alive = () => enemies.some((enemy) => enemy.hp > 0);
        let target = e;
        let maxPhase = 1;
        for (
          let i = 0;
          i < 4000 && alive() && g._state.phase === "playing";
          i++
        ) {
          if (target.hp <= 0)
            target = enemies
              .filter((enemy) => enemy.hp > 0)
              .sort(
                (a, b) =>
                  a.group.position.distanceToSquared(g.player.position) -
                  b.group.position.distanceToSquared(g.player.position),
              )[0];
          if (!target) break;
          const d = target.group.position
              .clone()
              .sub(g.player.position)
              .setY(0),
            distance = d.length();
          if (distance) d.normalize();
          g.actions.setAim(d, distance);
          g.setMove(0, 0);
          maxPhase = Math.max(maxPhase, target.combatPhase || 1);
          const warning =
              target.action === "melee-warning" ||
              target.mode?.endsWith("warning"),
            timer =
              target.tactics?.phase === "windup"
                ? target.tactics.timer
                : target.actionTimer;
          if (
            warning &&
            timer < 0.13 &&
            g.parry.cooldown <= 0 &&
            target.kind !== 4
          ) {
            g.parry.press();
          }
          if (
            warning &&
            (target.kind === 4 || g.parry.cooldown > 0) &&
            !(g.parry.active > 0)
          )
            g.setMove((-d.x + d.z) * Math.SQRT1_2, (-d.x - d.z) * Math.SQRT1_2);
          if (
            warning &&
            timer < 0.24 &&
            g.dashCooldown <= 0 &&
            target.kind === 4
          ) {
            g.dash();
          } else if (distance > 2.5 && !g.actions.current)
            g.setMove((d.x - d.z) * Math.SQRT1_2, (d.x + d.z) * Math.SQRT1_2);
          if (
            !g.actions.current &&
            !g.actions.charging &&
            g.parry.active <= 0
          ) {
            if (g.parry.counterTime > 0 && distance < 4)
              g.actions.press("light");
            else if (g.actions.ultimateCooldown <= 0 && type === "boss")
              g.actions.press("ultimate");
            else if (g.magic.cooldowns.fireball <= 0) g.actions.press("skill0");
            else if (distance < 8 && g.magic.cooldowns.frost <= 0)
              g.actions.press("skill1");
            else if (g.magic.cooldowns.lightning <= 0)
              g.actions.press("skill2");
            else if (
              distance < 3 &&
              g.actions.heavyCooldown <= 0 &&
              (!warning || timer > 0.8)
            )
              g.actions.press("heavy");
            else if (distance < 3) g.actions.press("light");
          }
          g.advanceSimulation(0.02);
        }
        rows.push({
          floor,
          type,
          build: stats,
          enemyHp,
          enemyRemaining: enemies.reduce(
            (sum, enemy) => sum + Math.max(0, enemy.hp),
            0,
          ),
          enemies: enemies.length,
          links: g.runReport.linkTriggers || {},
          hp: Math.max(0, g.state.hp),
          seconds: +g.state.elapsed.toFixed(2),
          commands: g.actions.manualCommands,
          parries: g.analytics.parrySuccesses,
          maxPhase,
          result: !alive()
            ? "clear"
            : g.state.phase === "playing"
              ? "timeout"
              : g.state.phase,
        });
      }
    return rows;
  }, permanent);
  const output = {
    method:
      "Chromium WebGL; fixed selected card builds, 0/5/12 sword/magic/health permanent ranks on floors 1/5/10; real cooldowns, damage, AI, parry and simulation; single targets and eight-member mixed groups (no ambient reinforcements), real bounded attack cancel windows, 80s cap; abyss 20/40 deliberately reuse the capped floor-10 build to expose its limits; no invulnerability, health inflation or enemy-HP reduction; scripted aim/movement inputs. Excludes random rewards, attrition across a full run and human ability.",
    results,
    errors,
  };
  const outputFile =
    process.env.BALANCE_OUTPUT || "test-results/tactical-balance.json";
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
