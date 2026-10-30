import * as THREE from "three";
import { WORLD_COLLIDERS } from "./terrain.js";

export const ROOM_COMBAT_SOLIDS = [-9, 9].flatMap((x) =>
  [-6, 6].map((z) => ({ type: "circle", x, z, radius: 0.4 })),
);

/** First intersection of a swept point with a wall. Includes segment endpoints. */
export function segmentEntry(a, b, solid, padding = 0) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  if (solid.type === "circle") {
    const x = a.x - solid.x,
      z = a.z - solid.z,
      r = solid.radius + padding,
      c = x * x + z * z - r * r;
    if (c <= 0) return 0;
    const aa = dx * dx + dz * dz;
    if (aa < 1e-12) return Infinity;
    const bb = x * dx + z * dz,
      disc = bb * bb - aa * c;
    if (disc < 0) return Infinity;
    const t = (-bb - Math.sqrt(disc)) / aa;
    return t >= 0 && t <= 1 ? t : Infinity;
  }
  let near = 0,
    far = 1;
  for (const [v, d, center, half] of [
    [a.x, dx, solid.x, solid.hx + padding],
    [a.z, dz, solid.z, solid.hz + padding],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (v < center - half || v > center + half) return Infinity;
      continue;
    }
    const t1 = (center - half - v) / d,
      t2 = (center + half - v) / d;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return Infinity;
  }
  return near <= 1 && far >= 0 ? Math.max(0, near) : Infinity;
}
export function combatSolids(game) {
  if (game.training?.active) return game.training.colliders;
  if (game.sideAreas?.active) return ROOM_COMBAT_SOLIDS;
  return game.world?.colliders || WORLD_COLLIDERS;
}
export function clearFraction(game, a, b, padding = 0.04) {
  let first = 1;
  for (const wall of combatSolids(game))
    first = Math.min(first, segmentEntry(a, b, wall, padding));
  return first;
}
export function combatLineClear(game, a, b) {
  if (!a || !b || !Number.isFinite(a.x + a.z + b.x + b.z)) return false;
  if (clearFraction(game, a, b) < 1 - 1e-8) return false;
  if (
    game.sideAreas?.active ||
    game.training?.active ||
    game.camp?.active ||
    !game.groundHeight
  )
    return true;
  const count = Math.min(24, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 1.5));
  for (let i = 1; i < count; i++) {
    const t = i / count,
      y = (a.y || 0) * (1 - t) + (b.y || 0) * t + 1.2;
    if (game.groundHeight(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) > y)
      return false;
  }
  return true;
}
export function clipAimPoint(game, origin, target, out = new THREE.Vector3()) {
  const distance = Math.hypot(target.x - origin.x, target.z - origin.z),
    fraction = clearFraction(game, origin, target, 0.12);
  out
    .copy(origin)
    .lerp(
      target,
      Math.max(
        0,
        fraction - (fraction < 1 ? 0.18 / Math.max(0.18, distance) : 0),
      ),
    );
  out.y = game.groundHeight?.(out.x, out.z) || 0;
  return out;
}
export function hurtRadius(enemy) {
  return Math.max(
    0.2,
    Math.min(enemy.kind === 4 ? 2 : 1.3, (Number(enemy.size) || 1) * 0.4),
  );
}
