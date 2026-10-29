import test from "node:test";
import assert from "node:assert/strict";
import { activeSets, rollSet, SETS } from "../src/sets.js";
import { equipmentBonuses, rollEquipment } from "../src/equipment.js";
test("sets count distinct worn slots, preserve old non-set items and prefer regional gear", () => {
  assert.deepEqual(activeSets([{ slot: "weapon" }]), []);
  assert.equal(
    activeSets(
      Array.from({ length: 4 }, () => ({ slot: "weapon", setId: "inferno" })),
    )[0].count,
    1,
  );
  const items = ["weapon", "armor", "ring", "necklace"].map((slot) => ({
    slot,
    setId: "glacier",
    power: 0.1,
    options: [],
    level: 0,
  }));
  assert.equal(activeSets(items)[0].count, 4);
  assert.equal(
    rollSet("volcano", () => 0.1),
    "inferno",
  );
  assert.equal(
    rollSet("tundra", () => 0.1),
    "glacier",
  );
  assert.equal(
    rollSet("void", () => 0.9),
    "",
  );
  assert.ok(equipmentBonuses(items).sets.length === 1);
});

test("regional bias retains every set and a 45 percent total set chance", () => {
  for (const region of [
    "volcano",
    "tundra",
    "forest",
    "ruins",
    "void",
    "sanctum",
  ]) {
    const counts = {};
    for (let i = 0; i < 1000; i++) {
      const id = rollSet(region, () => (i + 0.5) / 1000);
      counts[id] = (counts[id] || 0) + 1;
    }
    assert.equal(counts[""], 550);
    for (const set of SETS)
      assert.ok(counts[set.id] >= 40, `${region}: ${set.id} stays obtainable`);
    if (region === "volcano") assert.equal(counts.inferno, 290);
  }
});
