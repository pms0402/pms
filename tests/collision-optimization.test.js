import test from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_COLLIDERS,
  WORLD_RADIUS,
  terrainHeight,
  isWalkable,
  resolveTerrainMovement,
} from "../src/terrain.js";
// Independent pre-optimization scan checks every wall, including bucket seams.
function referenceWalk(x, z, r = 0.65) {
  if (Math.hypot(x, z) > WORLD_RADIUS - r) return false;
  for (const c of WORLD_COLLIDERS) {
    if (c.type === "circle") {
      if (Math.hypot(x - c.x, z - c.z) < r + c.radius) return false;
    } else {
      const dx = Math.max(0, Math.abs(x - c.x) - c.hx),
        dz = Math.max(0, Math.abs(z - c.z) - c.hz);
      if (dx * dx + dz * dz < r * r) return false;
    }
  }
  return true;
}
function referenceResolve(position, r = 0.65) {
  for (let pass = 0; pass < 3; pass++)
    for (const c of WORLD_COLLIDERS) {
      if (c.type === "circle") {
        const dx = position.x - c.x,
          dz = position.z - c.z,
          d = Math.hypot(dx, dz),
          range = r + c.radius;
        if (d < range) {
          position.x = c.x + (d ? dx / d : 1) * range;
          position.z = c.z + (d ? dz / d : 0) * range;
        }
      } else {
        const nx = Math.max(c.x - c.hx, Math.min(c.x + c.hx, position.x)),
          nz = Math.max(c.z - c.hz, Math.min(c.z + c.hz, position.z)),
          dx = position.x - nx,
          dz = position.z - nz,
          d = Math.hypot(dx, dz);
        if (d > 0 && d < r) {
          position.x += (dx / d) * (r - d);
          position.z += (dz / d) * (r - d);
        } else if (d === 0) {
          const edges = [
            { v: position.x - (c.x - c.hx), x: c.x - c.hx - r, z: position.z },
            { v: c.x + c.hx - position.x, x: c.x + c.hx + r, z: position.z },
            { v: position.z - (c.z - c.hz), x: position.x, z: c.z - c.hz - r },
            { v: c.z + c.hz - position.z, x: position.x, z: c.z + c.hz + r },
          ];
          edges.sort((a, b) => a.v - b.v);
          position.x = edges[0].x;
          position.z = edges[0].z;
        }
      }
    }
  const d = Math.hypot(position.x, position.z),
    limit = WORLD_RADIUS - r;
  if (d > limit) {
    position.x *= limit / d;
    position.z *= limit / d;
  }
  position.y = terrainHeight(position.x, position.z);
  return position;
}
let seed = 88319;
const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
test("spatial walkability index equals the full scan at random points, grid seams and collider boundaries", () => {
  const points = Array.from({ length: 12000 }, () => [
    (random() - 0.5) * 210,
    (random() - 0.5) * 210,
  ]);
  for (let x = -96; x <= 96; x += 12)
    for (let z = -96; z <= 96; z += 12)
      for (const e of [-1e-10, 0, 1e-10]) points.push([x + e, z - e]);
  for (const c of WORLD_COLLIDERS)
    for (const r of [0.08, 0.65, 1.4, 2, 3.5])
      for (const sign of [-1, 1])
        points.push(
          [c.x + sign * ((c.hx ?? c.radius) + r), c.z],
          [c.x, c.z + sign * ((c.hz ?? c.radius) + r)],
        );
  for (const r of [0, 0.08, 0.65, 1.4, 2, 2.00001, 3.5, 20])
    for (const [x, z] of points)
      assert.equal(
        isWalkable(x, z, r),
        referenceWalk(x, z, r),
        `${x},${z} radius ${r}`,
      );
});
test("cheap rejection preserves exact push ordering, corner exits and grounded coordinates", () => {
  const points = Array.from({ length: 5000 }, () => ({
    x: (random() - 0.5) * 220,
    z: (random() - 0.5) * 220,
    y: 99,
  }));
  for (const c of WORLD_COLLIDERS)
    for (const dx of [-0.5, 0, 0.5])
      for (const dz of [-0.5, 0, 0.5])
        points.push({ x: c.x + dx, z: c.z + dz, y: 0 });
  for (const r of [0.08, 0.65, 1.4, 2, 5])
    for (const p of points)
      assert.deepEqual(
        resolveTerrainMovement({ ...p }, r),
        referenceResolve({ ...p }, r),
      );
});
