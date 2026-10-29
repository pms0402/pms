import test from "node:test";
import assert from "node:assert/strict";
import {
  RunAnalytics,
  damageCategory,
  normalizeRunHistory,
} from "../src/analytics.js";
test("analytics assigns each actual hit once, isolates overkill, and distinguishes new damage causes", () => {
  const a = new RunAnalytics();
  assert.equal(a.hit("sword", 100, 30, 0, 1), 30);
  assert.equal(a.damage.sword, 30);
  assert.equal(a.overkill, 70);
  assert.equal(a.hit("pet", 12, 100, 1, 1), 12);
  assert.equal(
    damageCategory("sword", null, { analyticsSource: "counter" }),
    "counter",
  );
  assert.equal(damageCategory("explosion", null), "relic");
  assert.equal(
    damageCategory("set", "frost", { analyticsSource: "set" }),
    "set",
  );
  assert.equal(
    Object.values(a.damage).reduce((x, y) => x + y, 0),
    42,
  );
});
test("long runs retain bounded charts and floor rows and old history remains intact", () => {
  const a = new RunAnalytics();
  for (let i = 0; i < 1000; i++) {
    a.hit("fireball", 10, 20, i * 120, i);
    a.hurt(5, i);
  }
  assert.ok(a.bins.length <= 180 && a.floors.size <= 200);
  assert.equal(a.received, 5000);
  const old = { runId: "old", gold: 50, stage: 2 };
  assert.deepEqual(normalizeRunHistory([old]), [old]);
  assert.equal(normalizeRunHistory(Array(40).fill(old)).length, 30);
});

test("collected equipment retains total counts with bounded metadata", () => {
  const a = new RunAnalytics();
  for (let i = 0; i < 1000; i++)
    a.equipment({
      id: `g${i}`,
      title: `장비 ${i}`,
      slot: "weapon",
      grade: "rare",
    });
  assert.equal(a.gearCount, 1000);
  assert.equal(a.gear.length, 32);
  assert.ok(a.gearIds.size <= 512);
});
