import test from 'node:test';
import assert from 'node:assert/strict';
import { damp, angleDelta, dampAngle, createActorMotion, advanceActorMotion, swordSwing } from '../src/motion.js';

const actor = () => ({ position: { x: 0, z: 0 }, rotation: { y: 0 } });
test('damping and turning have the same response at 30, 60 and 120 Hz', () => {
  const results = [30, 60, 120].map(hz => {
    let value = 0, angle = Math.PI - .1;
    for (let i = 0; i < hz / 2; i++) { value = damp(value, 1, 10, 1 / hz); angle = dampAngle(angle, -Math.PI + .1, 16, 1 / hz); }
    return [value, angle];
  });
  for (const value of results) for (let i = 0; i < 2; i++) assert.ok(Math.abs(value[i] - results[0][i]) < 1e-12);
  assert.ok(results[0][1] > Math.PI, 'turn across the angle seam takes the short route');
  assert.equal(damp(3, 0, 10, 0), 3);
});
test('gait follows travel distance, eases to rest and stays still against walls', () => {
  const group = actor(), state = createActorMotion(group);
  for (let i = 0; i < 30; i++) { group.position.x += 7.5 / 60; advanceActorMotion(state, group, 1 / 60, 7.5); }
  assert.ok(state.stride > .99); assert.ok(Math.abs(state.phase - 3.75 * 1.47) < 1e-10);
  const before = state.stride, phase = state.phase;
  advanceActorMotion(state, group, 1 / 60, 7.5, false);
  assert.ok(state.stride > 0 && state.stride < before);
  for (let i = 0; i < 60; i++) advanceActorMotion(state, group, 1 / 60, 7.5, true);
  assert.ok(state.stride < .0001); assert.equal(state.phase, phase);
});
test('facing smoothing never alters physical position or combat direction', () => {
  const group = actor(), state = createActorMotion(group);
  group.rotation.y = Math.PI / 2;
  const physical = structuredClone(group);
  advanceActorMotion(state, group, 1 / 60, 7.5);
  assert.ok(state.facing > 0 && state.facing < group.rotation.y);
  assert.deepEqual(group, physical);
  assert.ok(Math.abs(angleDelta(group.rotation.y, state.facing)) < Math.PI);
});
test('teleports and pooled replacements do not play a giant running stride', () => {
  const group = actor(), state = createActorMotion(group, 1.2);
  group.position.x = 90; group.rotation.y = 1.3;
  advanceActorMotion(state, group, 1 / 60, 3);
  assert.equal(state.stride, 0); assert.equal(state.phase, 1.2); assert.equal(state.facing, 1.3);
  assert.equal(createActorMotion(group).stride, 0);
});
test('sword motion has continuous position and velocity through wind-up, stroke and recovery', () => {
  for (const t of [0, .18, .62, 1]) {
    const epsilon = 1e-5, center = swordSwing(t);
    assert.ok(Math.abs(swordSwing(t - epsilon) - center) < 1e-7);
    assert.ok(Math.abs(swordSwing(t + epsilon) - center) < 1e-7);
  }
  assert.equal(swordSwing(0), 0); assert.equal(swordSwing(1), 0);
  assert.ok(swordSwing(.18) < -.9 && swordSwing(.62) > .9);
});
