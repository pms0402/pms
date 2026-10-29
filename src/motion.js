const TAU = Math.PI * 2;
const clamp01 = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp01(value); return t * t * t * (t * (t * 6 - 15) + 10); };

export const damp = (current, target, rate, dt) => current + (target - current) * -Math.expm1(-rate * Math.max(0, dt));
export const angleDelta = (from, to) => ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
export const dampAngle = (current, target, rate, dt) => current + angleDelta(current, target) * -Math.expm1(-rate * Math.max(0, dt));

export function createActorMotion(group, phase = 0) {
  return { x: group.position.x, z: group.position.z, facing: group.rotation.y, phase, stride: 0 };
}

// Observe actual travel, never move the collider or change its combat direction.
export function advanceActorMotion(state, group, dt, speed, walking = true, cadence = 1.47) {
  const distance = Math.hypot(group.position.x - state.x, group.position.z - state.z);
  state.x = group.position.x; state.z = group.position.z;
  const teleported = distance > Math.max(2, speed * dt * 8);
  const target = walking && dt > 0 && !teleported ? clamp01(distance / (Math.max(.1, speed) * dt)) : 0;
  state.stride = damp(state.stride, target, target > state.stride ? 14 : 10, dt);
  if (walking && !teleported) state.phase = (state.phase + distance * cadence) % TAU;
  state.facing = teleported ? group.rotation.y : dampAngle(state.facing, group.rotation.y, 16, dt);
  return state;
}

// Continuous wind-up, stroke and recovery: both ends meet the resting pose.
export function swordSwing(t) {
  if (t <= 0 || t >= 1) return 0;
  if (t < .18) return -.95 * ease(t / .18);
  if (t < .62) return -.95 + 1.95 * ease((t - .18) / .44);
  return 1 - ease((t - .62) / .38);
}

// Damage may be faster than a readable stroke; only artwork is coalesced.
export function beginSwordStroke(game, profile) {
  const duration = Math.max(.13, Math.min(.3, .8 / Math.max(1, game.combatStats.attackRate * profile.attackRateMultiplier)));
  if (game.attackAnim > 0 && game.attackAnim / (game.attackAnimTotal || duration) > .26) return false;
  game.swingSide = -(game.swingSide || -1);
  game.attackAnimTotal = duration; game.attackAnim = duration;
  return true;
}
