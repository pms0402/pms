import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeStory,
  bossUnlocked,
  endingUnlocked,
  StorySystem,
} from "../src/story.js";
test("hidden encounters and all endings require authored discoveries and real progress", () => {
  const p = normalizeStory();
  assert.ok(!bossUnlocked(p, "king") && !endingUnlocked(p, "guardian"));
  p.records = ["royalOath"];
  assert.ok(!bossUnlocked(p, "king"));
  p.normalBossStages = [2];
  assert.ok(bossUnlocked(p, "king"));
  p.records.push("voidLens", "buriedTruth");
  assert.ok(bossUnlocked(p, "observer"));
  p.abyssHighest = 25;
  assert.ok(!bossUnlocked(p, "primordial"));
  p.defeated = ["king", "observer"];
  assert.ok(bossUnlocked(p, "primordial") && endingUnlocked(p, "heir"));
  p.records.push("sanctuary", "cycle", "firstRift");
  p.defeated.push("primordial");
  assert.ok(endingUnlocked(p, "origin"));
  assert.ok(!endingUnlocked(p, "cycle"));
  p.abyssHighest = 30;
  assert.ok(endingUnlocked(p, "cycle"));
});
test("old victories migrate safely; unseen endings need a choice and can be replayed after the run", () => {
  const game = { _state: { phase: "menu" }, callbacks: {} };
  const s = new StorySystem(game);
  s.load({}, [{ stage: 10, won: true }], {});
  assert.ok(s.canEnding("guardian"));
  assert.deepEqual(s.progress.endings, []);
  assert.ok(s.chooseEnding("guardian"));
  assert.ok(s.chooseEnding("guardian"));
  assert.equal(s.progress.endings.length, 1);
  game._state.phase = "playing";
  assert.equal(s.chooseEnding("guardian"), false);
  assert.deepEqual(
    normalizeStory({ records: ["bad", "sanctuary", "sanctuary"] }).records,
    ["sanctuary"],
  );
});
