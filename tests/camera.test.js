import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cameraArmFraction, CAMERA_SOLIDS } from "../src/camera-collision.js";
import { viewMovement,MovementSteering,usesTouchSteering } from "../src/view.js";

test('mouse presence takes priority over touch capability, while touch-only devices keep steering', () => {
  assert.equal(usesTouchSteering({fine:true,coarse:false}),false);
  assert.equal(usesTouchSteering({fine:true,coarse:true,touches:10}),false);
  assert.equal(usesTouchSteering({coarse:true,touches:5}),true);
  assert.equal(usesTouchSteering({touches:1}),true);
  assert.equal(usesTouchSteering({}),false);
  assert.equal(usesTouchSteering({coarse:true,touches:5,mouseObserved:true}),false);
});

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

test("turn amount scales with duration and analog input, without cardinal snapping",()=>{
 const run=(input,seconds,hz)=>{const s=new MovementSteering();let yaw=0;for(let i=0;i<Math.round(seconds*hz);i++)yaw+=s.step(input,1/hz);for(let i=0;i<2*hz;i++)yaw+=s.step(0,1/hz);return yaw;};
 const short=run(1,.1,60),long=run(1,.4,60),half=run(.5,.4,60);
 assert.ok(Math.abs(short+Math.PI/18)<1e-6);assert.ok(Math.abs(long/short-4)<1e-6);assert.ok(Math.abs(half/long-.5)<1e-9);
 assert.ok(Math.abs(run(1,1.5,60))>Math.PI/2);
 for(const hz of [30,120])assert.ok(Math.abs(run(1,.4,hz)-long)<1e-6);
});
test("turn acceleration and release remain smooth and restart clears residual steering",()=>{
 const s=new MovementSteering(),first=Math.abs(s.step(1,1/60)),next=Math.abs(s.step(1,1/60));
 assert.ok(first<next&&next<Math.PI*100/180/60);const speed=Math.abs(s.speed);s.step(0,1/60);assert.ok(Math.abs(s.speed)>speed*.5&&Math.abs(s.speed)<speed);
 s.reset();assert.equal(s.step(0,1/60),0);assert.equal(s.step(1,0),0);
});
test("movement follows continuous facing with proportional analog speed and reverse input",()=>{
 const s=new MovementSteering();
 for(const yaw of [0,.13,.71,2.9])assert.ok(s.direction(1,0,yaw).distanceTo(new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)))<1e-10);
 assert.ok(Math.abs(s.direction(.3,-.4,.2).length()-.5)<1e-10);
 assert.equal(s.direction(0,1,0).z,-1);assert.equal(s.direction(0,0,0).length(),0);
});
