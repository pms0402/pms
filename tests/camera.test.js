import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cameraArmFraction, CAMERA_SOLIDS } from "../src/camera-collision.js";
import { viewMovement } from "../src/view.js";

test("view-relative movement keeps direction, analog magnitude and diagonal speed", () => {
  for (const yaw of [0, 0.7, Math.PI, 4.2]) {
    const forward = viewMovement(0, -1, yaw),
      right = viewMovement(1, 0, yaw);
    assert.ok(
      forward.distanceTo(new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw))) <
        1e-10,
    );
    assert.ok(Math.abs(forward.dot(right)) < 1e-10);
    assert.equal(
      viewMovement(0.3, -0.4, yaw).length().toFixed(8),
      "0.50000000",
    );
  }
  const initial = viewMovement(1, 0, Math.PI * 1.25);
  assert.ok(initial.x > 0 && initial.z < 0);
});
test("camera arm stops before thin walls, including diagonal corner clearance", () => {
  const wall = { x: 0, z: -2, hx: 4, hz: 0.08, minY: 0, maxY: 4 },
    start = { x: 0, y: 1.4, z: 0 },
    end = { x: 0, y: 3, z: -8 };
  const t = cameraArmFraction(start, end, [wall], () => 0);
  assert.ok(t > 0.15 && t < 0.22);
  const clear = cameraArmFraction(
    start,
    { x: 0, y: 1.4, z: 8 },
    [wall],
    () => 0,
  );
  assert.equal(clear, 1);
  assert.equal(
    cameraArmFraction(
      { x: 0, y: 6, z: 0 },
      { x: 0, y: 7, z: -8 },
      [wall],
      () => 0,
    ),
    1,
  );
  assert.ok(CAMERA_SOLIDS.some((c) => c.maxY > 10));
});
test("camera avoids terrain, room boundaries and zero-length segments without invalid positions", () => {
  const p = { x: 0, y: 1.5, z: 0 };
  assert.equal(
    cameraArmFraction(p, p, [], () => 0),
    1,
  );
  assert.ok(
    cameraArmFraction(p, { x: 10, y: 1.5, z: 0 }, [], (x) => (x > 4 ? 3 : 0)) <
      0.5,
  );
  const t = cameraArmFraction(p, { x: 20, y: 3, z: 0 }, [], () => 0, 0.24, 12);
  assert.ok(t > 0.5 && t < 0.6);
});
