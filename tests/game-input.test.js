import test from "node:test";
import assert from "node:assert/strict";
import { gameKey, isGameShortcut } from "../src/game-input.js";

test("physical gameplay keys survive Korean IME, composition and Caps Lock", () => {
  for (const key of ["f", "F", "ㄹ", "Process", "Unidentified"])
    assert.equal(gameKey({ key, code: "KeyF", isComposing: true }), "f");
  assert.equal(gameKey({ key: "ㅈ", code: "KeyW" }), "w");
  assert.equal(gameKey({ key: "ArrowLeft", code: "ArrowLeft" }), "arrowleft");
  assert.equal(gameKey({ key: " ", code: "Space" }), " ");
  assert.equal(gameKey({ key: "G" }), "g");
  assert.equal(gameKey({ key: "ㄹ" }), "f");
  assert.equal(gameKey({key:"ㅍ"}),"v");
  assert.equal(gameKey({ key: "ㅠ" }), "b");
  assert.equal(gameKey({}), "");
});
test("typing and operating-system shortcuts never trigger combat actions", () => {
  assert.ok(isGameShortcut({ shiftKey: true }));
  for (const flag of ["ctrlKey", "metaKey", "altKey"])
    assert.equal(isGameShortcut({ [flag]: true }), false);
  assert.equal(
    isGameShortcut({
      target: { closest: (s) => (s.includes("contenteditable") ? {} : null) },
    }),
    false,
  );
  assert.ok(isGameShortcut({ target: { closest: () => null } }));
});
