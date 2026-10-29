import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createProgress, getPermanentBonuses } from "../src/progression.js";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
  ],
});
const base = process.env.BASE_URL || "http://127.0.0.1:5174",
  errors = [],
  gpu = [];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} ≈ ${b}`);
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (/GL_INVALID|Shader Error|THREE.WebGLProgram:/.test(m.text()))
      gpu.push(m.text());
  });
  const old = createProgress();
  old.bank = old.lifetimeGold = 2000;
  old.upgrades.arcana = 2;
  await p.addInitScript((data) => {
    if (!localStorage.getItem("v014-test-seed")) {
      localStorage.setItem("voidrun.progression", JSON.stringify(data));
      localStorage.setItem(
        "voidrun.history",
        JSON.stringify([
          {
            stage: 3,
            kills: 45,
            gold: 77,
            elapsed: 250,
            won: false,
            date: "과거 런",
          },
        ]),
      );
      localStorage.setItem("v014-test-seed", "1");
    }
  }, old);
  await p.goto(base);
  await p.waitForFunction(() => window.__game?.artReady);
  await p.evaluate(() => cancelAnimationFrame(window.__game.raf));
  await p.locator("#enter-camp").click();
  assert.equal(await p.evaluate(() => window.__game.state.phase), "camp");
  assert.equal(await p.evaluate(() => window.__game.enemies.length), 0);
  await p.keyboard.down("w");
  const moved = await p.evaluate(() => {
    const g = window.__game,
      b = g.player.position.clone();
    g.camp.update(0.2);
    return b.distanceTo(g.player.position);
  });
  await p.keyboard.up("w");
  assert.ok(moved > 1);
  await p.locator('#camp-navigation [data-camp-facility="training"]').click();
  await p.locator("#facility-loadout").click();
  assert.equal(await p.locator('[data-unlock-type="character"]').count(), 7);
  await p.locator('[data-unlock-id="paladin"]').click();
  await p.locator('[data-unlock-id="paladin"]').click();
  assert.equal(
    await p.evaluate(() => window.__game.stats.characterId),
    "paladin",
  );
  await p.locator("#modal-close").click();
  await p.locator('#camp-navigation [data-camp-facility="training"]').click();
  await p.locator("#practice-start").click();
  const practice = await p.evaluate(() => {
    const g = window.__game,
      before = JSON.stringify(g.analytics.snapshot(g));
    g.parry.press();
    g.parry.update(0.1);
    g.camp.practiceTimer = 0.01;
    g.camp.update(0.02);
    const counter = g.parry.counterTime;
    g.parry.press();
    return {
      counter,
      untouched: JSON.stringify(g.analytics.snapshot(g)) === before,
      hp: g._state.hp,
      shields: g.classes.shield,
      phase: g._state.phase,
    };
  });
  assert.ok(practice.counter > 0 && practice.untouched);
  assert.equal(practice.shields, 0);
  await p.locator('#camp-navigation [data-camp-facility="altar"]').click();
  await p.locator('[data-permanent-buy="power"]').click();
  await p.locator("#modal-close").click();
  await p.locator('#camp-navigation [data-camp-facility="laboratory"]').click();
  assert.equal(await p.locator("[data-synergy]").count(), 7);
  await p.locator("#modal-close").click();
  await p.locator('#camp-navigation [data-camp-facility="archive"]').click();
  await p.locator("#archive-history").click();
  assert.equal(await p.locator(".history-detail").count(), 1);
  await p.locator(".history-detail>summary").click();
  assert.match(await p.locator(".history-detail").textContent(), /이전 버전/);
  await p.locator("#modal-close").click();
  await p.locator('#camp-navigation [data-camp-facility="smith"]').click();
  assert.equal(await p.locator("#facility-loadout").count(), 1);
  await p.locator("#modal-close").click();
  await p.locator('#camp-navigation [data-camp-facility="gate"]').click();
  assert.equal(await p.locator('[data-gate-mode="abyss"]').isDisabled(), true);
  await p.locator("#gate-start").click();
  const campStats = await p.evaluate(() => {
    const g = window.__game;
    return {
      phase: g._state.phase,
      camp: g.camp.active,
      damage: g.stats.damage,
      hp: g.stats.maxHp,
      speed: g.stats.speed,
      armor: g.stats.armor,
      saved: JSON.parse(localStorage.getItem("voidrun.progression")),
    };
  });
  assert.equal(campStats.phase, "playing");
  assert.match(await p.locator("#area-stage").textContent(), /STAGE 01/);
  assert.doesNotMatch(await p.locator("#area-name").textContent(), /야영지/);
  assert.equal(campStats.camp, false);
  near(campStats.damage, 18 * 1.12);
  near(campStats.hp, 120);
  near(campStats.speed, 6.75);
  near(campStats.armor, 0.05);
  assert.equal(campStats.saved.upgrades.arcana, 2);
  console.log(
    "PASS 3D camp movement, six facility flows, paid job unlock, safe parry practice, permanent purchase and next-run application; old save/history retained",
  );
  await p.evaluate(() => {
    const g = window.__game;
    window.fixture = (bonus = {}) => {
      document.querySelector("#modal-backdrop").classList.add("hidden");
      g.camp.leave();
      g._state.phase = "menu";
      g.mode = "normal";
      g.setPermanentBonuses(bonus);
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
      g._state.hp = g.combatStats.maxHp;
      return g;
    };
  });
  const jobBonuses = Object.fromEntries(
    ["assassin", "summoner", "paladin", "warlock"].map((id) => {
      const d = createProgress();
      d.unlocks.characters.push(id);
      d.loadout.character = id;
      return [id, getPermanentBonuses(d)];
    }),
  );
  const classResults = await p.evaluate((bonuses) => {
    const out = {};
    for (const [id, b] of Object.entries(bonuses)) {
      const g = window.fixture(b),
        e = g.spawnEnemy(0, 2, 0, { noMutations: true });
      e.hp = e.maxHp = 10000;
      if (id === "assassin") {
        const hp = g.stats.maxHp,
          speed = g.stats.speed;
        g.dash();
        const boosted = g.classes.swordBonus(),
          once = g.classes.swordBonus();
        g.hitEnemy(e, 1e6);
        out[id] = { hp, speed, boosted, once, haste: g.classes.hasteUntil };
      }
      if (id === "summoner") {
        for (let i = 0; i < 8; i++) {
          g._state.elapsed += 0.21;
          g.hitEnemy(e, 1, undefined, "magic", "fireball");
        }
        const charged = g.classes.magicHits;
        g.classes.update(0.1);
        out[id] = {
          charged,
          pet: g.analytics.damage.pet,
          hits: g.classes.magicHits,
          visible: g.classes.pet.visible,
        };
      }
      if (id === "paladin") {
        g._state.hp = 60;
        g.player.rotation.y = 0;
        g.parry.press();
        g.takeDamage(10, { x: 0, z: 1 });
        const hp = g._state.hp;
        g._state.elapsed = 12;
        g.classes.update(0.1);
        const shield = g.classes.shield;
        g.parry.active = 0;
        g.invulnerable = 0;
        g.takeDamage(5, { x: 0, z: 1 });
        out[id] = {
          hp,
          shield,
          after: g.classes.shield,
          taken: g.analytics.received,
          heal: g.analytics.healed,
        };
      }
      if (id === "warlock") {
        const hp = g.stats.maxHp;
        for (let i = 0; i < 6; i++) {
          const t = g.spawnEnemy(2, 2, 0, { noMutations: true });
          t.hp = 1;
          g.hitEnemy(t, 10);
        }
        const stacks = g.classes.stacks;
        g.hitEnemy(e, 100, undefined, "magic", "fireball");
        const first = 10000 - e.hp;
        g.hitEnemy(e, 100, undefined, "magic", "fireball");
        out[id] = {
          hp,
          stacks,
          first,
          second: 10000 - e.hp - first,
          stackAfter: g.classes.stacks,
        };
      }
    }
    return out;
  }, jobBonuses);
  near(classResults.assassin.hp, 85);
  near(classResults.assassin.speed, 8.625);
  near(classResults.assassin.boosted, 1.2);
  near(classResults.assassin.once, 1);
  assert.ok(classResults.assassin.haste > 0);
  assert.equal(classResults.summoner.charged, 8);
  assert.ok(classResults.summoner.pet > 0 && classResults.summoner.visible);
  assert.equal(classResults.summoner.hits, 0);
  near(classResults.paladin.hp, 63.6);
  assert.ok(classResults.paladin.shield > classResults.paladin.after);
  near(classResults.paladin.taken, 0);
  near(classResults.paladin.heal, 3.6);
  near(classResults.warlock.hp, 80);
  assert.equal(classResults.warlock.stacks, 6);
  near(classResults.warlock.first, 160);
  near(classResults.warlock.second, 100);
  assert.equal(classResults.warlock.stackAfter, 0);
  console.log(
    "PASS all four jobs: bounded dash boost, kill haste, charged pet damage, parry healing/shield and one-shot warlock charge",
  );
  const sets = await p.evaluate(() => {
    const out = {};
    for (const id of ["inferno", "glacier", "stalker", "abyss", "storm"]) {
      const g = window.fixture(),
        slots = ["weapon", "armor", "ring", "necklace"];
      for (const slot of slots) {
        const item = {
          id: id + slot,
          slot,
          grade: "rare",
          title: "시험 " + slot,
          power: 0,
          level: 0,
          options: [],
          setId: id,
        };
        g.equipment.add(item);
        g.equipment.equip(item.id);
      }
      g.setSystem.update();
      const before = g.analytics.damage.set;
      if (id === "inferno" || id === "glacier") {
        const a = g.spawnEnemy(0, 2, 0, { noMutations: true }),
          b = g.spawnEnemy(0.5, 2, 0, { noMutations: true });
        a.hp = b.hp = 1e5;
        a.slowTime = 2;
        const random = Math.random;
        Math.random = () => 0;
        g.hitEnemy(
          a,
          1,
          undefined,
          "magic",
          id === "inferno" ? "fireball" : "frost",
        );
        g.hitEnemy(
          a,
          1,
          undefined,
          "magic",
          id === "inferno" ? "fireball" : "frost",
        );
        Math.random = random;
        out[id] = {
          damage: g.analytics.damage.set - before,
          cooldown:
            id === "inferno" ? g.setSystem.nextFire : g.setSystem.nextFrost,
          visible: g.setSystem.mesh.visible,
        };
      }
      if (id === "stalker") {
        g.dash();
        out[id] = {
          crit: g.combatStats.critChance,
          rate: g.combatStats.attackRate,
        };
      }
      if (id === "abyss") {
        const hp = g.combatStats.maxHp;
        g.setSystem.onParry();
        const shield = g.setSystem.shield;
        g.equipment.discard("abyssnecklace");
        const afterHp = g.combatStats.maxHp;
        g.setSystem.absorb(1);
        out[id] = { hp, afterHp, shield, after: g.setSystem.shield };
      }
      if (id === "storm")
        out[id] = {
          damage: g.setSystem.damage("lightning"),
          count: g.setSystem.count("storm"),
        };
    }
    return out;
  });
  near(sets.inferno.damage, 5.4);
  near(sets.glacier.damage, 4.5);
  assert.ok(
    sets.inferno.cooldown > 0 &&
      sets.glacier.cooldown > 0 &&
      sets.inferno.visible,
  );
  near(sets.stalker.crit, 0.05);
  near(sets.stalker.rate, 1.8);
  near(sets.abyss.hp, 112);
  near(sets.abyss.afterHp, 112);
  assert.ok(sets.abyss.shield > 0);
  near(sets.abyss.after, 0);
  near(sets.storm.damage, 1.18);
  assert.equal(sets.storm.count, 4);
  console.log(
    "PASS five equipped sets, live threshold recalculation, nonrecursive/cooldown-limited procs and distinct aura",
  );
  const room = await p.evaluate(() => {
    const g = window.fixture();
    g._state.stage = 2;
    g._state.stageTime = 95;
    g._state.elapsed = 100;
    g._state.hp = 60;
    const enemy = g.spawnEnemy(7, 7, 0, { mutations: ["explosive"] }),
      boss = g.spawnBoss();
    boss.hp -= 20;
    const pos = g.player.position.clone(),
      original = {
        enemies: [...g.enemies],
        boss,
        system: g.bossSystem,
        phase: g.bossPhases,
        magic: g.magic,
        mutation: g.mutationSystem,
        hp: boss.hp,
        enemyHp: enemy.hp,
      };
    g.shootEnemyProjectile(boss, {
      clone: () => g.player.position.clone().set(1, 0, 0),
    });
    const shot = g.enemyProjectiles[0],
      shotLife = shot.life;
    g.magic.ring(g.player.position, 2, "fireball", 1, 0.5);
    g.equipment.drop(g.player.position, {
      id: "parent-gear",
      slot: "weapon",
      title: "보존 장비",
      grade: "rare",
      power: 0.1,
      level: 0,
      options: [],
    });
    const drop = g.equipment.drops[0];
    g.sideAreas.spawnPortal();
    const entered = g.sideAreas.enter("trial");
    const roomCount = g.enemies.length;
    g.tick(0.2);
    const frozen = g._state.stageTime;
    g._state.hp = 55;
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e9, undefined, "other");
    const done = g.sideAreas.active.complete;
    g.sideAreas.claim();
    const rewards = g.equipment.choices.length;
    g.equipment.choose("skip");
    g.sideAreas.leave();
    const preserved =
      g.boss === boss &&
      boss.hp === original.hp &&
      g.bossSystem === original.system &&
      g.bossPhases === original.phase &&
      g.magic === original.magic &&
      g.mutationSystem === original.mutation &&
      g.enemies.length === original.enemies.length &&
      g.enemies.every((e, i) => e === original.enemies[i]) &&
      enemy.hp === original.enemyHp &&
      shot.life === shotLife &&
      g.enemyProjectiles[0] === shot &&
      g.equipment.drops[0] === drop &&
      g.player.position.equals(pos);
    return {
      entered,
      roomCount,
      frozen,
      done,
      rewards,
      preserved,
      hp: g._state.hp,
      gold: g._state.gold,
      stage: g._state.stage,
      stageTime: g._state.stageTime,
      phase: g._state.phase,
      active: !!g.sideAreas.active,
      normalRewards: g.pendingBossRewards.length,
      runGold: g.analytics.snapshot(g).gold,
    };
  });
  assert.ok(room.entered && room.done && room.preserved);
  assert.equal(room.roomCount, 4);
  assert.equal(room.frozen, 95);
  assert.equal(room.stageTime, 95);
  assert.equal(room.stage, 2);
  assert.equal(room.normalRewards, 0);
  assert.equal(room.hp, 55);
  assert.ok(room.rewards > 0 && room.gold > 0);
  assert.equal(room.active, false);
  assert.equal(room.phase, "playing");
  console.log(
    "PASS room combat, claimed gear/gold, exact parent enemies/boss/AI/magic/mutation/bolts/drops/position restoration and frozen floor time without healing",
  );
  await p.evaluate(() => {
    const g = window.fixture();
    g._state.stage = 2;
    g.sideAreas.spawnPortal();
    g.player.position.copy(g.sideAreas.portal.group.position);
    g.interact();
  });
  assert.ok(await p.locator('[data-portal-choice="ancient"]').isVisible());
  await p.locator('[data-portal-choice="ancient"]').click();
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, -3);
    g.interact();
  });
  assert.equal(
    await p.evaluate(() =>
      window.__game.story.progress.records.includes("royalOath"),
    ),
    true,
  );
  await p.evaluate(() => {
    const g = window.__game;
    g.player.position.set(0, 0, 10);
    g.interact();
    g.sideAreas.enter("curse");
    g.player.position.set(0, 0, -3);
    g.interact();
  });
  await p.locator('[data-room-curse="yes"]').click();
  assert.equal(await p.evaluate(() => window.__game.enemies.length), 3);
  await p.evaluate(() => {
    const g = window.__game;
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e9, undefined, "other");
    g.sideAreas.claim();
  });
  assert.equal(await p.locator("[data-equipment-choice]").count(), 4);
  await p.locator('[data-equipment-choice="skip"]').click();
  await p.evaluate(() => window.__game.sideAreas.leave());
  const dungeon = await p.evaluate(() => {
    const g = window.fixture();
    g._state.stage = 7;
    g.sideAreas.enter("dungeon");
    const mini = !!g.boss && g.boss.name === "매몰된 감시자";
    for (const e of [...g.enemies]) g.hitEnemy(e, 1e9, undefined, "other");
    const result = {
      mini,
      complete: g.sideAreas.active.complete,
      record: g.story.progress.records.includes("buriedTruth"),
      normalBoss: g.story.progress.normalBossStages.includes(7),
      rewards: g.pendingBossRewards.length,
    };
    g.sideAreas.leave();
    return result;
  });
  assert.ok(dungeon.mini && dungeon.complete && dungeon.record);
  assert.equal(dungeon.rewards, 0);
  assert.equal(
    dungeon.normalBoss,
    false,
    "optional boss grants no new normal-floor completion",
  );
  const refusal = await p.evaluate(() => {
    const g = window.fixture();
    g.sideAreas.enter("curse");
    g.player.position.set(0, 0, -3);
    g.interact();
    g.sideAreas.chooseCurse(false);
    const safe = g.enemies.length === 0 && g.sideAreas.active.claimed;
    g.sideAreas.leave();
    for (let i = 0; i < 137; i++) g.spawnEnemy(0, 2, 0, { noMutations: true });
    return {
      safe,
      denied: !g.sideAreas.enter("treasure"),
      intact: g.enemies.length === 137,
    };
  });
  assert.ok(refusal.safe && refusal.denied && refusal.intact);
  console.log(
    "PASS real portal/ancient/curse choices, optional refusal, mini-boss dungeon record and total actor-budget admission",
  );
  const hidden = await p.evaluate(() => {
    const out = {};
    for (const id of ["king", "observer", "primordial"]) {
      const g = window.fixture();
      g.story.progress.records = [
        "sanctuary",
        "royalOath",
        "voidLens",
        "buriedTruth",
        "cycle",
      ];
      g.story.progress.normalBossStages = [1, 2];
      g.story.progress.abyssHighest = 30;
      g.story.progress.defeated = ["king", "observer"];
      g.sideAreas.enter(id);
      const b = g.boss,
        model = b.specialModel;
      g._state.hp = g.combatStats.maxHp;
      g.invulnerable = 0;
      g.sideAreas.hidden.prepare(b);
      const first = b.hiddenPending.type,
        warnings = g.bossSystem.zones.length;
      const before = g._state.hp;
      g.bossSystem.updateEffects(0.1);
      const warned = g._state.hp === before;
      g.sideAreas.hidden.resolve(b);
      const shots = g.enemyProjectiles.length;
      g.hitEnemy(b, b.maxHp * 0.4, undefined, "other");
      const second = b.combatPhase,
        canceled = b.hiddenPending === null;
      g.hitEnemy(b, b.maxHp * 0.3, undefined, "other");
      const final = b.combatPhase;
      g.bossSystem.cancelAttacks();
      if (id === "primordial") {
        b.hiddenAction = 1;
        g.sideAreas.hidden.prepare(b);
        g.player.position.set(0, 0, 0);
        g.invulnerable = 0;
        for (let i = 0; i < 14; i++) g.bossSystem.updateEffects(0.1);
        const safe = g._state.hp;
        g.player.position.set(7, 0, 0);
        g.invulnerable = 0;
        g.bossSystem.updateEffects(0.01);
        out.safeCenter = safe;
        out.annulusDamage = safe - g._state.hp;
      }
      g.hitEnemy(b, 1e16, undefined, "other");
      out[id] = {
        name: b.name,
        model: model.children.length,
        first,
        warnings,
        warned,
        shots,
        second,
        final,
        canceled,
        complete: g.sideAreas.active.complete,
        record: g.story.progress.defeated.includes(id),
        clean: g.bossSystem.zones.length === 0 && g.bossPhases.boss === null,
      };
      g.sideAreas.claim();
      out[id].loot = g.equipment.choices.map((i) => ({
        set: i.setId,
        grade: i.grade,
        title: i.title,
      }));
      g.equipment.choose("skip");
      g.sideAreas.leave();
    }
    return out;
  });
  for (const id of ["king", "observer", "primordial"]) {
    assert.ok(
      hidden[id].model > 2 &&
        hidden[id].warnings > 0 &&
        hidden[id].warned &&
        hidden[id].canceled &&
        hidden[id].complete &&
        hidden[id].record &&
        hidden[id].clean,
    );
    assert.equal(hidden[id].second, 2);
    assert.equal(hidden[id].final, 3);
  }
  for (const [id, set] of Object.entries({
    king: "abyss",
    observer: "stalker",
    primordial: "storm",
  })) {
    assert.equal(hidden[id].loot.length, 3);
    assert.ok(
      hidden[id].loot.every(
        (i) =>
          i.set === set &&
          ["epic", "legendary"].includes(i.grade) &&
          i.title.includes("유산"),
      ),
    );
  }
  assert.ok(hidden.primordial.loot.every((i) => i.grade === "legendary"));
  assert.equal(hidden.king.first, "blade");
  assert.equal(hidden.observer.first, "blink");
  assert.ok(hidden.observer.shots >= 5);
  assert.ok(hidden.annulusDamage > 0);
  near(hidden.safeCenter, 100);
  console.log(
    "PASS three unique hidden bosses: actual models, warned sword/teleport/annulus attacks, phase cancellation, safe center and persistent real-kill rewards",
  );
  const stats = await p.evaluate(() => {
    const g = window.fixture(),
      t = g.spawnEnemy(0, 2, 0, { noMutations: true });
    t.hp = t.maxHp = 10;
    g.hitEnemy(t, 30, undefined, "pet");
    g._state.hp = 50;
    g.heal(100);
    g.dashCooldown = 0;
    g.dash();
    g._state.elapsed = 4;
    g.emit();
    g.endRun();
    return {
      a: g.analytics.snapshot(g),
      history: JSON.parse(localStorage.getItem("voidrun.history")),
    };
  });
  near(stats.a.damage.pet, 10);
  near(stats.a.overkill, 20);
  near(stats.a.healed, 50);
  assert.equal(stats.a.dashes, 1);
  assert.equal(stats.a.kills.normal, 1);
  assert.equal(stats.history[0].analytics.damage.pet, 10);
  assert.ok(await p.locator("[data-dps-chart]").isVisible());
  assert.ok(await p.locator("[data-floor-chart]").isVisible());
  assert.equal(await p.locator('[data-damage-source="pet"]').count(), 1);
  await p.locator("#result-story").click();
  assert.equal(await p.locator('[data-ending="guardian"]').isDisabled(), true);
  assert.equal(await p.locator('[data-ending="origin"]').isDisabled(), false);
  await p.locator('[data-ending="origin"]').click();
  assert.equal(
    await p.evaluate(() =>
      JSON.parse(localStorage.getItem("voidrun.story")).endings.includes(
        "origin",
      ),
    ),
    true,
  );
  await p.locator("#ending-back").click();
  await p.locator("#modal-close").click();
  await p.locator("#result-camp").click();
  await p.locator('[data-nav="history"]').click();
  assert.equal(await p.locator(".history-detail").count(), 2);
  await p.locator(".history-detail>summary").first().click();
  assert.equal(await p.locator('[data-analytics-source="pet"]').count(), 1);
  await p.locator("#history-mode").selectOption("abyss");
  assert.equal(await p.locator(".history-detail").count(), 0);
  await p.locator("#modal-close").click();
  const restored = await p.evaluate(() => ({
    story: JSON.parse(localStorage.getItem("voidrun.story")),
    progress: JSON.parse(localStorage.getItem("voidrun.progression")),
  }));
  await p.reload();
  await p.waitForFunction(() => window.__game?.artReady);
  await p.evaluate(() => cancelAnimationFrame(window.__game.raf));
  assert.equal(
    await p.evaluate(() =>
      window.__game.story.progress.endings.includes("origin"),
    ),
    true,
  );
  assert.equal(
    (
      await p.evaluate(() =>
        JSON.parse(localStorage.getItem("voidrun.progression")),
      )
    ).loadout.character,
    restored.progress.loadout.character,
  );
  console.log(
    "PASS accurate actual/overkill/source/heal/dash statistics, persisted detailed/legacy history, charts/filters and gated selectable replayable endings across reload",
  );
  await p.locator("#enter-camp").click();
  await p.evaluate(() => {
    const g = window.__game;
    g.updateCamera(100);
    g.renderer.render(g.scene, g.camera);
  });
  await p.screenshot({
    path: "/tmp/voidrun-v014-camp-desktop.png",
    animations: "disabled",
  });
  const resources = await p.evaluate(() => {
    const g = window.__game;
    g.camp.leave();
    g._state.phase = "menu";
    g.start();
    cancelAnimationFrame(g.raf);
    g.stats.spells = { fireball: 1 };
    for (let i = 0; i < 16; i++)
      g.spawnEnemy(Math.sin(i) * 5, Math.cos(i) * 5, 0, { noMutations: true });
    for (let i = 0; i < 24; i++) g.magic.castFireball();
    g.shootEnemyProjectile(
      g.enemies[0],
      g.player.position.clone().set(1, 0, 0),
      { count: 12 },
    );
    while (g.enemyProjectiles.length < 56)
      g.shootEnemyProjectile(
        g.enemies[0],
        g.player.position.clone().set(1, 0, 0),
        { count: 1 },
      );
    const samples = [];
    let budget;
    for (let i = 0; i < 8; i++) {
      g.sideAreas.enter(i % 2 ? "observer" : "trial");
      for (let j = 0; j < 100; j++) g.magic.castFireball();
      for (let j = 0; j < 100; j++)
        g.shootEnemyProjectile(
          g.enemies[0],
          g.player.position.clone().set(1, 0, 0),
        );
      budget = {
        magic:
          g.magic.projectiles.length +
          g.sideAreas.snapshot.fields.magic.projectiles.length,
        bolts:
          g.enemyProjectiles.length +
          g.sideAreas.snapshot.arrays.enemyProjectiles.length,
      };
      g.updateCamera(100);
      g.renderer.render(g.scene, g.camera);
      g.sideAreas.leave();
      g.renderer.render(g.scene, g.camera);
      samples.push({ ...g.renderer.info.memory });
    }
    return {
      budget,
      samples,
      enemies: g.enemies.length,
      magic: g.magic.projectiles.length,
      bolts: g.enemyProjectiles.length,
    };
  });
  assert.equal(resources.budget.magic, 40);
  assert.equal(resources.budget.bolts, 80);
  assert.equal(resources.enemies, 16);
  assert.equal(resources.magic, 24);
  assert.equal(resources.bolts, 56);
  assert.ok(
    resources.samples.at(-1).geometries <= resources.samples[2].geometries + 2,
  );
  assert.ok(
    resources.samples.at(-1).textures <= resources.samples[2].textures + 2,
  );
  console.log(
    "PASS repeated room/hidden arena cleanup with fixed actor/bolt/magic budgets and stable GPU resources",
    JSON.stringify(resources.samples.at(-1)),
  );
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const mobile = await context.newPage();
  mobile.on("pageerror", (e) => errors.push(e.message));
  await mobile.goto(base);
  await mobile.waitForFunction(() => window.__game?.artReady);
  await mobile.locator("#enter-camp").click();
  await mobile.locator('#camp-navigation [data-camp-facility="archive"]').click();
  await mobile.locator("#archive-story").click();
  await mobile.locator("#modal-close").click();
  const button = await mobile.locator('[data-move="0,-1"]').boundingBox(),
    cdp = await context.newCDPSession(mobile);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: button.x + button.width / 2, y: button.y + button.height / 2 },
    ],
  });
  await mobile.waitForTimeout(250);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  const mobileState = await mobile.evaluate(() => ({
    moved:
      window.__game.player.position.distanceTo({ x: 0, y: 0, z: 12.8 }) > 0.1,
    overflow: document.documentElement.scrollWidth > innerWidth,
    scroll: document.documentElement.scrollHeight > innerHeight + 1,
    phase: window.__game.state.phase,
  }));
  assert.ok(mobileState.moved && !mobileState.overflow && !mobileState.scroll);
  assert.equal(mobileState.phase, "camp");
  await mobile.screenshot({
    path: "/tmp/voidrun-v014-camp-mobile.png",
    animations: "disabled",
  });
  await context.close();
  assert.deepEqual(errors, []);
  assert.deepEqual(gpu, []);
  console.log(
    "PASS mobile camp touch/facilities and bounded page layout; no browser/GL errors",
  );
} finally {
  await browser.close();
}
