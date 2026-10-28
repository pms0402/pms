import assert from "node:assert/strict";
import { chromium } from "playwright";
import { rollEquipment } from "../src/equipment.js";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const errors = [],
  gpu = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ~= ${b}`);
try {
  const page = await browser.newPage({
    viewport: { width: 1180, height: 820 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/GL_INVALID|Shader Error|THREE.WebGLProgram:/.test(m.text()))
      gpu.push(m.text());
  });
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await page.waitForFunction(() => window.__game?.artReady);
  await page.locator("#start-button").click();
  await page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    window.fixture = () => {
      document.querySelector("#modal-backdrop").classList.add("hidden");
      g.mode = "normal";
      g.start();
      cancelAnimationFrame(g.raf);
      g.spawnTimer =
        g.attackTimer =
        g.nextChestTime =
        g.nextEliteTime =
        g.nextGoldenTime =
        g.nextAltarTime =
          1e6;
      g.stats.spells = {};
      g.stats.critChance = 0;
      g._state.xpNeeded = 1e9;
      g.invulnerable = 0;
      g.exploration.update = (() => {
        const original = g.exploration.update.bind(g.exploration);
        return (dt) => original(dt);
      })();
      return g;
    };
    window.fixture();
  });
  const gear = rollEquipment(8, "volcano", () => 0);
  gear.options = ["crit", "arcane", "guard"];
  const equipped = await page.evaluate((item) => {
    const g = window.__game,
      base = JSON.stringify(g.stats);
    g.equipment.drop(g.player.position, item);
    g.equipment.update(0.02);
    const collected = g.equipment.bag.length;
    g._state.hp = 60;
    g.equipment.equip(item.id);
    const stats = {
      damage: g.combatStats.damage,
      magic: g.combatStats.spellDamage,
      armor: g.combatStats.armor,
      crit: g.combatStats.critChance,
      hp: g._state.hp,
    };
    g.equipment.discard(item.id);
    return {
      collected,
      stats,
      baseUnchanged: base === JSON.stringify(g.stats),
      restored: g.combatStats.damage === g.stats.damage,
    };
  }, gear);
  assert.equal(equipped.collected, 1);
  assert.ok(
    equipped.stats.damage > 18 &&
      equipped.stats.magic > 18 &&
      equipped.stats.armor > 0 &&
      equipped.stats.crit === 0.04,
  );
  assert.equal(equipped.stats.hp, 60);
  assert.ok(equipped.baseUnchanged && equipped.restored);
  await page.evaluate((item) => {
    const g = window.__game;
    g.equipment.add(item);
    g.emit();
  }, gear);
  await page.locator("#equipment-button").click();
  assert.equal(await page.locator("[data-equip]").count(), 1);
  await page.locator("[data-equip]").click();
  assert.equal(await page.locator("[data-equip]").textContent(), "장착 중");
  await page.locator("#modal-close").click();
  console.log(
    "PASS physical grade drop, reversible equipment modifiers, no free healing and live comparison/equip UI",
  );
  await page.evaluate(() => window.fixture());
  const defense = await page.evaluate(() => {
    const g = window.__game;
    g.player.rotation.y = 0;
    const source = g.player.position.clone().set(0, 0, 1);
    g.parry.press();
    g.takeDamage(10, source);
    const perfect = { hp: g._state.hp, counter: g.parry.counterTime };
    const a = g.spawnEnemy(0, 2, 0, { mutations: [] }),
      b = g.spawnEnemy(0.3, 2.1, 0, { mutations: [] });
    a.hp = b.hp = 1000;
    g.attack();
    const damage = [1000 - a.hp, 1000 - b.hp];
    g.parry.cooldown = 0;
    g.parry.press();
    g.parry.update(0.2);
    g.invulnerable = 0;
    g.takeDamage(10, source);
    const guarded = 100 - g._state.hp;
    g._state.hp = 100;
    g.invulnerable = 0;
    g.parry.cooldown = 0;
    g.parry.press();
    g.takeDamage(10, source, { toString: () => "" }, null, {
      unblockable: true,
    });
    return { perfect, damage, guarded, unblockable: 100 - g._state.hp };
  });
  assert.equal(defense.perfect.hp, 100);
  assert.ok(defense.perfect.counter > 0);
  near(defense.damage[0], 45);
  assert.equal(defense.damage[1], 0);
  near(defense.guarded, 3.5);
  near(defense.unblockable, 10);
  console.log(
    "PASS forward perfect parry, single-target counter, partial late guard and unblockable attacks",
  );
  for (const type of [
    "warden",
    "artillery",
    "plague",
    "brood",
    "storm",
    "reaper",
  ]) {
    await page.evaluate(() => window.fixture());
    const phases = await page.evaluate((type) => {
      const g = window.__game,
        b = g.spawnBoss();
      g.bossSystem.clear();
      g.bossPhases.clear();
      b.archetype = type;
      g.bossSystem.begin(b);
      g.bossPhases.begin(b);
      b.hp = b.maxHp = 1000;
      g.hitEnemy(b, 310, undefined, "explosion");
      const second = b.combatPhase;
      g.hitEnemy(b, 350, undefined, "explosion");
      const max = b.maxHp;
      g.bossPhases.special(b);
      g.renderer.render(g.scene, g.camera);
      const result = {
        second,
        phase: b.combatPhase,
        transitions: [...g.bossPhases.transitions],
        max,
        hp: b.hp,
        zones: g.bossSystem.zones.length,
        rush: !!g.bossPhases.rush,
        shots: g.bossSystem.pendingShots.length,
      };
      g.hitEnemy(b, 1e8, undefined, "explosion");
      result.cleaned = g.bossSystem.zones.length === 0 && !g.bossPhases.boss;
      g.equipment.nextReward();
      return result;
    }, type);
    assert.equal(phases.second, 2);
    assert.equal(phases.phase, 3);
    assert.equal(phases.max, 1000);
    assert.equal(phases.hp, 340);
    assert.deepEqual(phases.transitions, [2, 3]);
    assert.ok(phases.cleaned && phases.zones <= 12 && phases.shots <= 12);
    assert.equal(await page.locator("[data-equipment-choice]").count(), 4);
    await page.locator("[data-equipment-choice]").first().click();
    assert.equal(
      await page.evaluate(() => window.__game.equipment.bag.length),
      1,
    );
  }
  console.log(
    "PASS all six boss archetypes cross three phases without healing, real warned specials, death cleanup and three-choice gear reward",
  );
  for (const [type, choice] of [
    ["merchant", "buyGear"],
    ["contractor", "blood"],
    ["shrine", "heal"],
    ["smith", "craft"],
  ]) {
    await page.evaluate(() => window.fixture());
    const before = await page.evaluate((type) => {
      const g = window.__game;
      g._state.gold = 1000;
      g._state.hp = 40;
      g.exploration.spawn(type);
      g.player.position.copy(g.exploration.npc.group.position);
      const before = {
        bank: localStorage.getItem("voidrun.progression"),
        hp: g._state.hp,
        base: JSON.stringify(g.stats),
      };
      g.exploration.interact();
      return before;
    }, type);
    assert.equal(await page.evaluate(() => window.__game.state.phase), "npc");
    const time = await page.evaluate(() => {
      const g = window.__game;
      const time = g._state.elapsed;
      g.stepForTest(3);
      return g._state.elapsed === time;
    });
    assert.ok(time);
    await page.locator(`[data-npc-choice="${choice}"]`).click();
    const after = await page.evaluate(() => {
      const g = window.__game;
      return {
        bank: localStorage.getItem("voidrun.progression"),
        base: JSON.stringify(g.stats),
        used: g.exploration.npc.used,
        second: g.exploration.interact(),
        damage: g.combatStats.damage,
        maxHp: g.combatStats.maxHp,
        hp: g._state.hp,
        gold: g._state.gold,
        bag: g.equipment.bag.length,
      };
    });
    assert.equal(after.bank, before.bank);
    assert.equal(after.base, before.base);
    assert.ok(after.used && !after.second);
    if (type === "contractor") {
      near(after.damage, 20.7);
      near(after.maxHp, 90);
      assert.equal(after.hp, 40);
    }
    if (type === "merchant" || type === "smith")
      assert.ok(after.bag === 1 && after.gold < 1000);
    if (type === "shrine") near(after.hp, 75);
  }
  await page.evaluate(() => window.fixture());
  const duel = await page.evaluate(() => {
    const g = window.__game;
    g.exploration.spawn("knight");
    g.player.position.copy(g.exploration.npc.group.position);
    g.exploration.interact();
    g.exploration.choose("duel");
    const e = g.enemies.find((e) => e.duelist);
    const model = !!e.npcModel;
    g.hitEnemy(e, 1e9, undefined, "explosion");
    const bag = g.equipment.bag.length;
    g.exploration.onKill(e);
    return {
      model,
      bag,
      after: g.equipment.bag.length,
      tokens: g.pendingRelicSources.length,
    };
  });
  assert.ok(duel.model);
  assert.equal(duel.bag, 1);
  assert.equal(duel.after, 1);
  assert.ok(duel.tokens > 0);
  console.log(
    "PASS five physical NPCs, paused transactions, net run gold, actual contracts/healing/crafting and nonrepeatable duel rewards",
  );
  await page.evaluate(() => window.fixture());
  const trial = await page.evaluate(() => {
    const g = window.__game;
    g.exploration.spawn("contractor");
    g.player.position.copy(g.exploration.npc.group.position);
    g.exploration.interact();
    g.exploration.choose("trial");
    const active = g.getThreat().enemyHealth;
    g._state.elapsed += 20;
    g.exploration.update(0.01);
    return {
      active,
      ended: g.getThreat().enemyHealth,
      gear: g.equipment.bag[0]?.grade,
    };
  });
  assert.ok(trial.active > trial.ended);
  assert.ok(["epic", "legendary"].includes(trial.gear));
  await page.evaluate(() => window.fixture());
  const win = await page.evaluate(() => {
    const g = window.__game;
    g._state.stage = 10;
    g.regionId = "throne";
    g.regionSystem.setRegion("throne");
    const b = g.spawnBoss();
    g.hitEnemy(b, 1e12, undefined, "explosion");
    g.equipment.nextReward();
    document.querySelector('[data-equipment-choice="skip"]').click();
    g._state.stageTime = 120;
    g.nextStage();
    return {
      phase: g._state.phase,
      unlocked: g.abyssUnlocked,
      save: JSON.parse(localStorage.getItem("voidrun.endgame")),
    };
  });
  assert.equal(win.phase, "won");
  assert.ok(win.unlocked && win.save.unlocked);
  await page.locator("#result-modes").click();
  await page.locator('[data-mode="abyss"]').click();
  await page.locator("#start-button").click();
  await page.evaluate(() => {
    const g = window.__game;
    cancelAnimationFrame(g.raf);
    g.spawnTimer =
      g.attackTimer =
      g.nextChestTime =
      g.nextEliteTime =
      g.nextGoldenTime =
      g.nextAltarTime =
        1e6;
    g.stats.spells = {};
    g.invulnerable = 1e6;
    g._state.xpNeeded = 1e9;
  });
  const abyss = await page.evaluate(() => {
    const g = window.__game;
    const start = {
      floor: g._state.stage,
      mode: g.mode,
      damage: g.combatStats.damage,
    };
    for (const stage of [11, 14, 19]) {
      g._state.stage = stage;
      g._state.stageTime = 120;
      g.bossDefeated = true;
      g.nextStage();
      g.chooseRoute("standard");
      g.chooseRegion(g.regionChoices[0].id);
    }
    const result = {
      start,
      stage: g._state.stage,
      rule: g.abyssConstraint,
      phase: g._state.phase,
    };
    g._state.gold = 100;
    g._state.grossGold = 150;
    g.endRun();
    result.saved = JSON.parse(localStorage.getItem("voidrun.endgame"));
    return result;
  });
  assert.deepEqual(abyss.start, { floor: 11, mode: "abyss", damage: 90 });
  assert.equal(abyss.stage, 20);
  assert.equal(abyss.phase, "playing");
  assert.ok(
    abyss.rule &&
      abyss.saved.bestFloor === 20 &&
      abyss.saved.bestGold === 150 &&
      abyss.saved.bestRun.build,
  );
  console.log(
    "PASS actual normal victory unlock, mode selection, 11→12/15/20 regional progress, constraints and persistent build records",
  );
  await page.evaluate(() => window.fixture());
  const defenseGear = await page.evaluate(item => { const g = window.__game; item.slot = 'armor'; item.options = ['desperate','vital','guard']; g.equipment.add(item); g.equipment.equip(item.id); g._state.hp = 40; const armor = g.combatStats.armor, hp = g._state.hp; g.takeDamage(10,g.player.position.clone().set(0,0,1)); return { armor, damage: hp - g._state.hp }; }, gear);
  near(defenseGear.armor, .09); near(defenseGear.damage, 9.1);
  await page.evaluate(() => window.fixture());
  const forged = await page.evaluate((item) => {
    const g = window.__game;
    g._state.gold = 10000;
    g.equipment.add(item);
    g.equipment.equip(item.id);
    const before = g.combatStats.damage;
    const visit = (choice) => {
      g.exploration.clearFloor();
      g.exploration.spawn("smith");
      g.player.position.copy(g.exploration.npc.group.position);
      g.exploration.interact();
      document.querySelector(`[data-npc-choice="${choice}"]`).click();
    };
    visit(`forge:${item.id}`);
    const after = g.combatStats.damage,
      old = g.equipment.bag[0].options[0];
    visit(`reroll:${item.id}`);
    return {
      before,
      after,
      level: g.equipment.bag[0].level,
      changed: old !== g.equipment.bag[0].options[0],
      unique: new Set(g.equipment.bag[0].options).size === 3,
    };
  }, gear);
  assert.ok(forged.after > forged.before && forged.changed && forged.unique);
  assert.equal(forged.level, 1);
  await page.evaluate(() => window.fixture());
  const procs = await page.evaluate((item) => {
    const g = window.__game;
    item.options = ["blast", "bolt", "dash"];
    g.equipment.add(item);
    g.equipment.equip(item.id);
    const target = g.spawnEnemy(0, 3, 0, { mutations: [] });
    target.hp = target.maxHp = 1e6;
    const random = Math.random;
    try {
      Math.random = () => 0;
      for (let i = 0; i < 20; i++) {
        const e = g.spawnEnemy(0, 2, 0, { mutations: [] });
        g.hitEnemy(e, 1e8, undefined, "sword");
      }
    } finally {
      Math.random = random;
    }
    return {
      lost: 1e6 - target.hp,
      expected: g.combatStats.damage * 0.35 + g.combatStats.spellDamage * 0.5,
      drops: g.equipment.drops.length,
      effects: g.magic.effects.length,
    };
  }, gear);
  near(procs.lost, procs.expected);
  assert.ok(procs.drops <= 12 && procs.effects <= 100);
  console.log(
    "PASS actual forge/reroll cache refresh and bounded kill explosion/projectile procs without recursive chains",
  );
  await page.evaluate(() => window.fixture());
  const stress = await page.evaluate((item) => {
    const g = window.__game;
    g.mode = "abyss";
    g._state.stage = 1000;
    g.regionId = "void";
    g.regionSystem.setRegion("void");
    g.invulnerable = 1e6;
    g.equipment.add(item);
    g.equipment.equip(item.id);
    g.stats.spells = { fireball: 5, frost: 5, lightning: 5, orbit: 5 };
    g.stats.evolutions = {
      fireball: true,
      frost: true,
      lightning: true,
      orbit: true,
    };
    g.stats.relics = ["glacier"];
    g.stats.swordEvolution = "wave";
    for (let i = 0; i < 160; i++) {
      const a = i * 2.399,
        r = 4 + (i % 11),
        e = g.spawnEnemy(
          Math.sin(a) * r,
          Math.cos(a) * r,
          [0, 1, 2, 3, 5, 6, 7, 8, 9][i % 9],
          { mutations: ["swift", "steel"] },
        );
      e.hp = e.maxHp = 1e14;
    }
    for (let i = 0; i < 30; i++) g.equipment.drop(g.player.position, item);
    g.exploration.spawn("merchant");
    g.parry.press();
    g.stepForTest(1.5);
    g.renderer.render(g.scene, g.camera);
    const state = g.getDebugState();
    g.start();
    return {
      state,
      bag: g.equipment.bag.length,
      drops: g.equipment.drops.length,
      npc: g.exploration.npc,
      guard: g.parry.active,
    };
  }, gear);
  assert.ok(
    stress.state.enemies <= 160 &&
      stress.state.magic.effects <= 100 &&
      stress.state.enemyProjectiles <= 80 &&
      stress.state.equipment.drops <= 12,
  );
  assert.ok(
    Number.isFinite(stress.state.hp) && Number.isFinite(stress.state.damage),
  );
  assert.equal(stress.bag, 0);
  assert.equal(stress.drops, 0);
  assert.equal(stress.npc, null);
  assert.equal(stress.guard, 0);
  console.log(
    "PASS floor1000 finite stats, 160 dual mutants, bounded drops/effects and all new systems reset cleanly",
  );
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.fixture());
    await page.evaluate((item) => {
      const g = window.__game;
      g.equipment.add(item);
      g.emit();
    }, gear);
    await page.locator("#equipment-button").click();
    assert.ok(await page.locator("[data-equip]").count());
    const overflow = await page.evaluate(() => [
      document.documentElement.scrollWidth - innerWidth,
      document.documentElement.scrollHeight - innerHeight,
    ]);
    assert.ok(overflow.every((n) => n <= 1));
    await page.locator("#modal-close").click();
    await page.locator("#guard-button").dispatchEvent("pointerdown");
    assert.ok(await page.evaluate(() => window.__game.parry.active > 0));
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(gpu, []);
  console.log(
    "PASS portrait/landscape inventory, reachable defense controls, no document scroll and clean WebGL shaders",
  );
} finally {
  await browser.close();
}
