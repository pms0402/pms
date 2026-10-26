import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { RELICS } from '../src/content.js';

// Runtime fixtures shorten fights and choose RNG, not growth: actual deaths,
// pickups, rewards, level-up selections, purchases and transitions execute.
// Healing perks and random healing drops are disabled in stat-invariance
// fixtures so healing is not mistaken for automatic maximum-stat growth.
const origin = process.env.BASE_URL || 'http://127.0.0.1:5174';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors = [];
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-7, `${message}: ${actual} ≈ ${expected}`);
let context, page;

async function load(viewport = { width: 1440, height: 1000 }) {
  await context?.close();
  context = await browser.newContext({ viewport, hasTouch: viewport.width < 1200, isMobile: viewport.width < 1000 });
  page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(origin);
  await page.waitForFunction(() => window.__game?.frames > 1);
  assert.equal(await page.locator('#canvas-error').isVisible(), false);
  await page.locator('#start-button').click();
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf));
  await fixture();
}

async function fixture() {
  await page.evaluate(() => {
    const game = window.__game; game.start(); cancelAnimationFrame(game.raf);
    game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
    game.stats.critChance = 0; game.stats.regen = 0; game.stats.lifeOnKill = 0;
    game.stats.spells = { fireball: 0, frost: 0, lightning: 0, orbit: 0 };
    game._state.hp = 61; game.emit();
  });
}

async function openEarnedLevel() {
  return page.evaluate(() => {
    const game = window.__game, before = structuredClone(game.stats), hp = game.state.hp;
    const random = Math.random;
    try {
      Math.random = () => 0;
      game._state.xp = game._state.xpNeeded;
      if (!game.openLevelUp()) throw new Error('Earned level-up did not open');
    } finally { Math.random = random; }
    return { before, after: structuredClone(game.stats), hp, afterHp: game.state.hp, phase: game.state.phase, choices: game.upgradeChoices.map(choice => ({ ...choice })) };
  });
}

try {
  await load();
  const pickups = await page.evaluate(() => {
    const game = window.__game, before = structuredClone(game.stats), hp = game.state.hp;
    game.dropPickup(game.player.position, 'gold', 50);
    game.dropPickup(game.player.position, 'xp', 2);
    game.stepForTest(.3);
    return { before, after: structuredClone(game.stats), hp, afterHp: game.state.hp, phase: game.state.phase, gold: game.state.gold, xp: game.state.xp };
  });
  assert.deepEqual(pickups.after, pickups.before, 'gold and below-threshold XP cannot rewrite any player stat');
  assert.equal(pickups.afterHp, pickups.hp); assert.equal(pickups.phase, 'playing'); assert.equal(pickups.gold, 50); assert.equal(pickups.xp, 2);
  const paused = await page.evaluate(() => {
    const game = window.__game; game.pause(); const before = game.state.elapsed;
    game.stepForTest(1); const after = game.state.elapsed; game.resume();
    return { before, after, phase: game.state.phase };
  });
  assert.equal(paused.before, paused.after); assert.equal(paused.phase, 'playing');
  console.log('PASS non-growth events: gold, below-threshold XP and paused time leave the entire stat object and health unchanged');

  await fixture();
  const chestReward = await page.evaluate(ids => {
    const game = window.__game, before = structuredClone(game.stats), hp = game.state.hp;
    game._state.xpNeeded = 1e9;
    const random = Math.random;
    try {
      Math.random = () => .5;
      const chest = game.spawnChest(10, 0); game.player.position.set(10, 0, 0);
      for (const guard of chest.guards) game.hitEnemy(guard, guard.hp + 1);
      const level = game.state.level, xp = game.state.xp, gold = game.state.gold;
      Math.random = () => (ids.indexOf('whetstone') + .01) / ids.length;
      game.tick(.01);
      return { before, hp, level, xp, gold, opened: chest.opened, after: { stats: structuredClone(game.stats), hp: game.state.hp, phase: game.state.phase, tokens: game.state.rewardTokens, level: game.state.level, xp: game.state.xp, gold: game.state.gold, choices: game.chestChoices.map(choice => choice.id) } };
    } finally { Math.random = random; }
  }, RELICS.map(relic => relic.id));
  assert.equal(chestReward.opened, true); assert.equal(chestReward.after.phase, 'relic');
  assert.equal(chestReward.after.choices.length, 3); assert.equal(new Set(chestReward.after.choices).size, 3);
  assert.ok(chestReward.after.choices.includes('whetstone'));
  assert.deepEqual(chestReward.after.stats, chestReward.before, 'opening the immediate chest selection does not itself apply a relic');
  assert.equal(chestReward.after.hp, chestReward.hp); assert.equal(chestReward.after.tokens, 0);
  assert.equal(chestReward.after.level, chestReward.level); assert.equal(chestReward.after.xp, chestReward.xp);
  assert.equal(chestReward.after.gold - chestReward.gold, 40, 'the actual opened chest grants its gold immediately');
  assert.equal(await page.locator('[data-chest-relic]').count(), 3);
  await page.locator('[data-chest-relic="whetstone"]').click();
  const chosenChest = await page.evaluate(() => ({ stats: structuredClone(window.__game.stats), hp: window.__game.state.hp, level: window.__game.state.level, xp: window.__game.state.xp, phase: window.__game.state.phase, repeated: window.__game.chooseChestReward('whetstone') }));
  const chestExpected = structuredClone(chestReward.before); chestExpected.damage *= 1.4; chestExpected.relics.push('whetstone');
  assert.deepEqual(chosenChest.stats, chestExpected, 'exactly the selected chest relic applies');
  assert.equal(chosenChest.hp, chestReward.hp); assert.equal(chosenChest.phase, 'playing'); assert.equal(chosenChest.repeated, false);
  assert.equal(chosenChest.level, chestReward.level); assert.equal(chosenChest.xp, chestReward.xp);
  const eliteToken = await page.evaluate(() => {
    const game = window.__game, before = structuredClone(game.stats), hp = game.state.hp;
    const random = Math.random;
    try {
      Math.random = () => .5;
      const elite = game.spawnEnemy(15, 0, 2, { elite: true }); game.hitEnemy(elite, elite.hp + 1); game.tick(.01);
      return { before, hp, after: structuredClone(game.stats), afterHp: game.state.hp, phase: game.state.phase, tokens: game.state.rewardTokens };
    } finally { Math.random = random; }
  });
  assert.deepEqual(eliteToken.after, eliteToken.before); assert.equal(eliteToken.afterHp, eliteToken.hp);
  assert.equal(eliteToken.phase, 'playing'); assert.equal(eliteToken.tokens, 1, 'elite rewards retain their later level-up token flow');
  console.log('PASS chest/elite distinction: actual chest grants40G and three immediate relic options; only the chosen relic changes stats, while elites still queue level-up tokens');

  await fixture();
  const tenFloors = await page.evaluate(() => {
    const game = window.__game, baseline = structuredClone(game.stats), hp = game.state.hp, records = [];
    game._state.xpNeeded = 1e9;
    const random = Math.random;
    try {
      // Avoid random healing drops; no healing/crit/regeneration perk is active.
      Math.random = () => .5;
      for (let floor = 1; floor <= 10; floor++) {
        const before = structuredClone(game.stats), beforeHp = game.state.hp;
        const boss = game.spawnBoss();
        const afterSpawn = structuredClone(game.stats);
        game.hitEnemy(boss, boss.hp + 1);
        const afterKill = structuredClone(game.stats), killHp = game.state.hp;
        game.dropPickup(game.player.position.clone().set(30, 0, 30), 'heal', 30);
        game._state.stageTime = game.state.stageDuration;
        const advanced = game.nextStage();
        const routePhase = game.state.phase;
        if (floor < 10) {
          if (routePhase !== 'route') throw new Error('Nonfinal floor must ask for the next route');
          if (!game.chooseRoute('standard')) throw new Error('Standard route was rejected');
        }
        const afterAdvance = structuredClone(game.stats), advanceHp = game.state.hp;
        if (game.state.phase === 'playing') {
          game.spawnTimer = game.attackTimer = game.nextChestTime = game.nextEliteTime = game.nextGoldenTime = game.nextAltarTime = 1e6;
          game.stepForTest(.02);
        }
        records.push({ floor, before, beforeHp, afterSpawn, afterKill, killHp, advanced, routePhase, afterAdvance, advanceHp, afterTick: structuredClone(game.stats), tickHp: game.state.hp, phase: game.state.phase });
      }
      return { baseline, hp, records, end: { stage: game.state.stage, phase: game.state.phase, stats: structuredClone(game.stats), hp: game.state.hp, pendingBossRewards: game.state.pendingBossRewards.length } };
    } finally { Math.random = random; }
  });
  for (const record of tenFloors.records) {
    assert.deepEqual(record.before, tenFloors.baseline, `floor${record.floor} starts without hidden previous-floor growth`);
    assert.deepEqual(record.afterSpawn, record.before, 'boss spawn itself cannot grant stats');
    assert.deepEqual(record.afterKill, record.before, `floor${record.floor} boss death only unlocks a future choice`);
    assert.deepEqual(record.afterAdvance, record.before, `floor${record.floor} has no automatic stage multiplier`);
    assert.deepEqual(record.afterTick, record.before, 'queued boss rewards do not silently apply on the next simulation tick');
    assert.equal(record.killHp, record.beforeHp); assert.equal(record.advanceHp, tenFloors.hp); assert.equal(record.tickHp, tenFloors.hp);
    assert.equal(record.advanced, true);
    assert.equal(record.routePhase, record.floor === 10 ? 'won' : 'route');
    assert.equal(record.phase, record.floor === 10 ? 'won' : 'playing');
  }
  assert.equal(tenFloors.end.stats.maxHp, 100); assert.equal(tenFloors.end.stats.damage, 18); assert.equal(tenFloors.end.stats.spellDamage, 18);
  assert.equal(tenFloors.end.hp, 61); assert.equal(tenFloors.end.stage, 10); assert.equal(tenFloors.end.pendingBossRewards, 10);
  console.log('PASS all ten floors: exact full-stat snapshots stay unchanged on boss death, gold/XP sweep, floor advance and queued rewards;100HP/18damage remain100/18');

  await load();
  const ordinary = await openEarnedLevel();
  assert.deepEqual(ordinary.after, ordinary.before); assert.equal(ordinary.afterHp, ordinary.hp); assert.equal(ordinary.phase, 'upgrade');
  assert.equal(ordinary.choices.length, 3);
  assert.ok(ordinary.choices.some(choice => choice.id === 'power'));
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'upgrade', 'mandatory choice stays open until a card is selected');
  await page.locator('[data-upgrade="power"]').click();
  const sword = await page.evaluate(() => ({ stats: structuredClone(window.__game.stats), hp: window.__game.state.hp, phase: window.__game.state.phase, rejected: window.__game.chooseUpgrade('power') }));
  near(sword.stats.damage, ordinary.before.damage * 1.2, 'selected sword power grants exactly20%');
  assert.equal(sword.stats.spellDamage, ordinary.before.spellDamage); assert.equal(sword.hp, ordinary.hp); assert.equal(sword.phase, 'playing'); assert.equal(sword.rejected, false);
  const swordExpected = structuredClone(ordinary.before); swordExpected.damage *= 1.2; swordExpected.passiveLevels.power = 1;
  assert.deepEqual(sword.stats, swordExpected, 'a sword card changes only its specified stat and purchase counter');
  console.log('PASS explicit level choice: opening a level-up changes no stat; selecting sword power changes only sword damage and cannot be replayed');

  await fixture();
  const queued = await page.evaluate(ids => {
    const game = window.__game;
    // Limit eligibility to one target relic, without applying the other effects.
    game.stats.relics = ids.filter(id => id !== 'giantsHeart');
    const before = structuredClone(game.stats), hp = game.state.hp;
    const opened = game.openRelic('정예 처치 선택권');
    const direct = game.chooseRelic('giantsHeart'), bypass = game.chooseUpgrade('relic_giantsHeart');
    return { before, after: structuredClone(game.stats), hp, afterHp: game.state.hp, opened, direct, bypass, phase: game.state.phase, tokens: game.state.rewardTokens };
  }, RELICS.map(relic => relic.id));
  assert.equal(queued.opened, true); assert.equal(queued.phase, 'playing'); assert.equal(queued.tokens, 1);
  assert.equal(queued.direct, false); assert.equal(queued.bypass, false); assert.deepEqual(queued.after, queued.before); assert.equal(queued.afterHp, queued.hp);
  const relicOffer = await openEarnedLevel();
  assert.deepEqual(relicOffer.after, relicOffer.before); assert.equal(relicOffer.choices.length, 4);
  assert.equal(relicOffer.choices.at(-1).id, 'relic_giantsHeart');
  await page.locator('[data-upgrade="power"]').click();
  const skipped = await page.evaluate(() => ({ hp: window.__game.state.hp, maxHp: window.__game.stats.maxHp, tokens: window.__game.state.rewardTokens, owned: window.__game.stats.relics.includes('giantsHeart') }));
  assert.deepEqual(skipped, { hp: 61, maxHp: 100, tokens: 1, owned: false }, 'choosing another card never also grants or spends the relic');
  const nextRelicOffer = await openEarnedLevel();
  assert.deepEqual(nextRelicOffer.before, nextRelicOffer.after);
  await page.locator('[data-upgrade="relic_giantsHeart"]').click();
  const giant = await page.evaluate(() => ({ stats: structuredClone(window.__game.stats), hp: window.__game.state.hp, tokens: window.__game.state.rewardTokens, direct: window.__game.chooseRelic('giantsHeart') }));
  near(giant.stats.maxHp, 140, 'giant heart applies only after choosing its level-up card'); near(giant.hp, 101, 'the chosen health increase heals only its added40capacity');
  assert.equal(giant.tokens, 0); assert.equal(giant.direct, false);
  const giantExpected = structuredClone(nextRelicOffer.before); giantExpected.maxHp *= 1.4; giantExpected.relics.push('giantsHeart');
  assert.deepEqual(giant.stats, giantExpected);
  console.log('PASS elite relic choice: optional fourth card must be chosen, survives a skipped level and consumes one token');

  await fixture();
  const bossToken = await page.evaluate(() => {
    const game = window.__game, before = structuredClone(game.stats), hp = game.state.hp;
    const random = Math.random;
    try {
      Math.random = () => .5;
      const boss = game.spawnBoss(); game.hitEnemy(boss, boss.hp + 1);
    } finally { Math.random = random; }
    const direct = game.chooseUpgrade('boss_warden');
    return { before, after: structuredClone(game.stats), hp, afterHp: game.state.hp, direct, pending: game.state.pendingBossRewards.map(reward => reward.id) };
  });
  assert.deepEqual(bossToken.after, bossToken.before); assert.equal(bossToken.afterHp, bossToken.hp); assert.equal(bossToken.direct, false); assert.deepEqual(bossToken.pending, ['warden']);
  const bossOffer = await openEarnedLevel();
  assert.deepEqual(bossOffer.before, bossOffer.after); assert.equal(bossOffer.choices.length, 4); assert.equal(bossOffer.choices.at(-1).id, 'boss_warden');
  await page.locator('[data-upgrade="boss_warden"]').click();
  const legacy = await page.evaluate(() => ({ stats: structuredClone(window.__game.stats), hp: window.__game.state.hp, pending: window.__game.state.pendingBossRewards.length, invalid: window.__game.chooseUpgrade('boss_warden') }));
  const bossExpected = structuredClone(bossOffer.before); bossExpected.swordRangeMultiplier *= 1.1; bossExpected.bossRewards.push('warden');
  assert.deepEqual(legacy.stats, bossExpected); assert.equal(legacy.hp, bossToken.hp); assert.equal(legacy.pending, 0); assert.equal(legacy.invalid, false);
  console.log('PASS boss legacy: defeat grants no stats; choosing the earned fourth card applies its one effect exactly once');

  await load();
  await page.evaluate(() => {
    const game = window.__game; game.dropPickup(game.player.position, 'gold', 12); game.stepForTest(.2);
    game._state.hp = 1; game.invulnerable = 0; game.spawnEnemy(.1, 0, 0); game.stepForTest(.02);
  });
  assert.equal(await page.evaluate(() => window.__game.state.phase), 'over');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')).bank), 12);
  const endedDamage = await page.evaluate(() => window.__game.stats.damage);
  await page.locator('#result-permanent').click(); await page.locator('[data-permanent-buy="power"]').click();
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('voidrun.progression')).bank), 0);
  assert.equal(await page.evaluate(() => window.__game.stats.damage), endedDamage, 'between-run purchase configures the next run without rewriting an ended run');
  await page.locator('#camp-start').click();
  await page.evaluate(() => cancelAnimationFrame(window.__game.raf));
  near(await page.evaluate(() => window.__game.stats.damage), 18 * 1.12, 'only purchased permanent bonuses change the next starting sword damage');
  assert.equal(await page.evaluate(() => window.__game.stats.spellDamage), 18);
  assert.equal(await page.evaluate(() => window.__game.setPermanentBonuses({ damageMultiplier: 4 })), false);
  console.log('PASS permanent choice: contact death settles12G, purchased12G power applies next start and cannot be changed during a live run');

  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    await load(viewport);
    await page.evaluate(ids => {
      const game = window.__game; game.stats.relics = ids.filter(id => id !== 'giantsHeart'); game.openRelic('모바일 선택권');
    }, RELICS.map(relic => relic.id));
    const offered = await openEarnedLevel(); assert.equal(offered.choices.length, 4);
    const cards = page.locator('[data-upgrade]'); assert.equal(await cards.count(), 4);
    for (let index = 0; index < 4; index++) {
      const card = cards.nth(index); await card.scrollIntoViewIfNeeded();
      const box = await card.boundingBox();
      assert.ok(box && box.x >= 0 && box.x + box.width <= viewport.width + 1, 'all four mobile cards fit horizontally');
      assert.ok(box.y >= 0 && box.y < viewport.height, 'each card remains reachable inside the dialog');
    }
    const scroll = await page.evaluate(() => ({ height: document.documentElement.scrollHeight, width: document.documentElement.scrollWidth, innerHeight, innerWidth }));
    assert.ok(scroll.height <= scroll.innerHeight + 1 && scroll.width <= scroll.innerWidth + 1, 'four choices never enable document scrolling');
    assert.equal(await page.evaluate(() => window.__game.state.phase), 'upgrade');
    await page.locator('[data-upgrade="relic_giantsHeart"]').click();
    near(await page.evaluate(() => window.__game.stats.maxHp), 140, 'mobile selects the same manual relic effect');
  }
  assert.deepEqual(errors, [], 'no uncaught browser exceptions');
  console.log('PASS mobile manual growth: four reachable cards, one selected upgrade and no page overflow in portrait/landscape');
  console.log('All manual-only growth browser checks passed.');
} finally {
  await context?.close(); await browser.close();
}
