import { WORLD_COLLIDERS, STRUCTURES, terrainHeight } from "./terrain.js";

// Cheap static camera volumes; combat and movement colliders are untouched.
const structures = new Map(STRUCTURES.map((s) => [s.id, s]));
export const CAMERA_SOLIDS = WORLD_COLLIDERS.map((c) => {
  const s = structures.get(c.id),
    base = terrainHeight(c.x, c.z);
  return {
    x: c.x,
    z: c.z,
    hx: c.hx ?? c.radius,
    hz: c.hz ?? c.radius,
    minY: base - 0.3,
    maxY: base + (s?.height ?? 6),
  };
}).concat(
  STRUCTURES.filter((s) => s.type === "house").map((s) => ({
    x: s.x,
    z: s.z,
    hx: s.width / 2 + 0.4,
    hz: s.depth / 2 + 0.4,
    minY: terrainHeight(s.x, s.z) + s.height - 1.1,
    maxY: terrainHeight(s.x, s.z) + s.height + 0.5,
  })),
);
export const ROOM_SOLIDS = [-9, 9].flatMap((x) =>
  [-6, 6].map((z) => ({ x, z, hx: 0.4, hz: 0.4, minY: 0, maxY: 3.5 })),
);

/** Segment/AABB clipping includes near-plane clearance and detects thin walls. */
export function cameraArmFraction(
  start,
  end,
  solids,
  height,
  radius = 0.24,
  boundary = Infinity,
) {
  let fraction = 1;
  for (const box of solids) {
    let near = 0,
      far = 1;
    for (const [a, min, max] of [
      ["x", box.x - box.hx - radius, box.x + box.hx + radius],
      ["y", box.minY - radius, box.maxY + radius],
      ["z", box.z - box.hz - radius, box.z + box.hz + radius],
    ]) {
      const delta = end[a] - start[a];
      if (Math.abs(delta) < 1e-9) {
        if (start[a] < min || start[a] > max) {
          near = 2;
          break;
        }
        continue;
      }
      const t1 = (min - start[a]) / delta,
        t2 = (max - start[a]) / delta;
      near = Math.max(near, Math.min(t1, t2));
      far = Math.min(far, Math.max(t1, t2));
      if (near > far) break;
    }
    if (near <= far && far >= 0 && near <= 1)
      fraction = Math.min(fraction, Math.max(0, near - 0.012));
  }
  const length = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z),
    steps = Math.max(1, Math.ceil(length / 0.16));
  // Terrain samples use the game's cached height field; no scene-wide raycasts.
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (t > fraction) break;
    const x = start.x + (end.x - start.x) * t,
      y = start.y + (end.y - start.y) * t,
      z = start.z + (end.z - start.z) * t;
    if (y < height(x, z) + radius || Math.hypot(x, z) > boundary - radius) {
      fraction = Math.max(0, (i - 1) / steps);
      break;
    }
  }
  return fraction;
}
