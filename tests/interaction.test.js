import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { SideAreaSystem } from "../src/side-areas.js";
import { interactionTarget } from "../src/interaction.js";
function fixture() {
  return {
    _state: { phase: "playing" },
    callbacks: {},
    player: { position: new THREE.Vector3() },
    camp: { active: false, suspended: false },
    sideAreas: { active: null, portal: null },
    exploration: { npc: null },
  };
}
function object(x, z) {
  return { group: { position: new THREE.Vector3(x, 0, z) }, used: false };
}
test("NPC prompt uses the same exact interaction reach and vanishes for used/menu/modal targets", () => {
  const g = fixture();
  g.exploration.npc = { ...object(3.2, 0), type: "merchant" };
  assert.equal(interactionTarget(g).name, "떠돌이 상인");
  g.player.position.x = -0.00001;
  assert.equal(interactionTarget(g), null);
  g.player.position.x = 0;
  g.exploration.npc.used = true;
  assert.equal(interactionTarget(g), null);
  g.exploration.npc.used = false;
  g.callbacks.isUIBlocked = () => true;
  assert.equal(interactionTarget(g), null);
  delete g.callbacks.isUIBlocked;
  g._state.phase = "paused";
  assert.equal(interactionTarget(g), null);
});
test("portal priority agrees with the real dispatcher and used portals reveal a nearby NPC", () => {
  const g = fixture();
  g.exploration.npc = { ...object(0, 1), type: "shrine" };
  g.sideAreas.portal = object(3.5, 0);
  assert.equal(interactionTarget(g).kind, "portal");
  g.sideAreas.portal.used = true;
  assert.equal(interactionTarget(g).kind, "npc");
  g.sideAreas.portal.used = false;
  g.player.position.x = -0.00001;
  assert.equal(interactionTarget(g).kind, "npc");
});
test("camp prompts require reach, the active camp phase and an unsuspended facility", () => {
  const g = fixture();
  g._state.phase = "camp";
  g.camp.active = true;
  g.camp.nearest = () => ({ id: "smith", name: "대장간", distance: 3.4 });
  assert.equal(interactionTarget(g).id, "smith");
  g.camp.suspended = true;
  assert.equal(interactionTarget(g), null);
  g.camp.suspended = false;
  g.camp.nearest = () => ({ distance: 3.4001 });
  assert.equal(interactionTarget(g), null);
});
test("room doors, readable records, curse decisions and earned rewards cannot advertise an inactive action", () => {
  const g = fixture();
  g.sideAreas.active = { type: "ancient", complete: true, claimed: false };
  g.player.position.z = -3;
  assert.equal(interactionTarget(g).verb, "읽기");
  g.sideAreas.active.claimed = true;
  assert.equal(interactionTarget(g), null);
  g.player.position.z = 10;
  assert.equal(interactionTarget(g).kind, "exit");
  g.player.position.set(3.2, 0, 10);
  assert.equal(interactionTarget(g), null);
  g.player.position.set(0, 0, -3);
  g.sideAreas.active = {
    type: "curse",
    accepted: false,
    claimed: false,
    complete: false,
  };
  assert.equal(interactionTarget(g).verb, "시련 확인");
  g.sideAreas.active.accepted = true;
  assert.equal(interactionTarget(g), null);
  g.sideAreas.active.complete = true;
  assert.equal(interactionTarget(g).verb, "보상 받기");
  g.sideAreas.active.claimed = true;
  assert.equal(interactionTarget(g), null);
});

test("finishing a room publishes its actual configured interaction key and leaves the reward unclaimed", () => {
  const enemy = {},
    messages = [],
    found = [];
  const room = {
    active: { type: "dungeon", targets: new Set([enemy]), claimed: false },
    game: {
      bindings: { interact: "t" },
      story: { find: (id) => found.push(id) },
      callbacks: { onLoot: (message) => messages.push(message) },
    },
  };
  SideAreaSystem.prototype.onKill.call(room, enemy);
  assert.equal(room.active.complete, true);
  assert.equal(room.active.claimed, false);
  assert.deepEqual(found, ["buriedTruth"]);
  assert.match(messages[0], /T로 보상/);
  SideAreaSystem.prototype.onKill.call(room, enemy);
  assert.equal(messages.length, 1);
});
