import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {registeredPose} from '../src/blade.js';
import {MOVE,newGait} from '../src/locomotion.js';

const tick=(g,t,input={})=>{for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120,input);};
function scene(){const g=new Game();g.start();g.world.enemies=[];g.world.traps=[];return g;}
test('direction alone builds from a first step to running in half a second, without a run modifier',()=>{
 for(const dir of [-1,1]){const g=scene();g.p.x=500;const held=dir>0?{right:true}:{left:true},speeds=[];
  for(let i=0;i<64;i++){g.update(1/120,held);speeds.push(Math.abs(g.p.vx));}
  assert.ok(speeds[0]>0&&speeds[0]<5);assert.ok(speeds[11]<40);assert.ok(speeds[35]>100&&speeds[35]<120);assert.equal(speeds[63],178);
  assert.ok(speeds.every((v,i)=>i===0||v>=speeds[i-1]));assert.ok(Math.abs(g.p.x-500)>45&&Math.abs(g.p.x-500)<55);assert.equal(g.p.dir,dir);
 }
});
test('releasing the key takes one braking step, keeps facing and finishes the settle animation',()=>{
 const g=scene();tick(g,1,{right:true});const x=g.p.x,phase=g.p.gait.phase;tick(g,.1);assert.ok(g.p.vx>110&&g.p.vx<125);assert.ok(g.p.x>x+13);assert.notEqual(g.p.gait.phase,phase);assert.equal(g.p.dir,1);
 tick(g,.21);assert.equal(g.p.vx,0);assert.ok(g.p.x-x>24&&g.p.x-x<28);assert.equal(g.p.gait.state,'stop');assert.equal(registeredPose(g.p).sheet,'gait-transitions');
 tick(g,.22);assert.equal(g.p.gait.state,'idle');assert.equal(registeredPose(g.p).sheet,'cut-body');const stop=g.p.x;tick(g,1);assert.equal(g.p.x,stop);
});
test('turning brakes existing momentum before the sprite and acceleration change direction',()=>{
 const g=scene();tick(g,1,{right:true});const x=g.p.x;tick(g,.08,{left:true});assert.ok(g.p.vx>100);assert.equal(g.p.dir,1);assert.equal(g.p.gait.state,'turn');assert.ok(g.p.x>x);
 tick(g,.16,{left:true});assert.ok(g.p.vx< -8);assert.equal(g.p.dir,-1);assert.equal(g.p.gait.style,'walk');tick(g,.55,{left:true});assert.equal(g.p.vx,-178);
});
test('gait changes at a footfall and preserves phase rather than recalculating accumulated distance',()=>{
 const g=scene();Object.assign(g.p,{vx:128,gait:{...newGait(),state:'stride',phase:.49}});
 const before=g.p.gait.phase;g.update(1/120,{right:true});assert.equal(g.p.gait.style,'run');assert.ok(g.p.gait.phase>before&&g.p.gait.phase<.52);assert.equal(registeredPose(g.p).frame,12);
 let wraps=0,previous=g.p.gait.phase;for(let i=0;i<160;i++){g.update(1/120,{right:true});const phase=g.p.gait.phase;if(phase<previous)wraps++;else assert.ok(phase-previous<.02);previous=phase;}
 assert.ok(wraps>=2);assert.equal(g.p.gait.style,'run');
});
test('a wall stops the body and the foot cycle instead of making the player run in place',()=>{
 const g=scene();g.world.platforms.push({x:330,y:120,w:24,h:182});tick(g,2,{right:true});assert.equal(g.p.x,321);assert.equal(g.p.vx,0);assert.equal(g.p.gait.state,'idle');const phase=g.p.gait.phase;tick(g,.5,{right:true});assert.equal(g.p.gait.phase,phase);assert.equal(registeredPose(g.p).sheet,'cut-body');
});
test('a running character can attack or dodge immediately and movement cannot overwrite the action',()=>{
 for(const action of ['attack','dash']){const g=scene();tick(g,.8,{right:true});assert.ok(g.press(action));const expected=action==='attack'?'light1':'dash';tick(g,.08,{right:true});assert.equal(g.p.action.kind,expected);assert.equal(g.p.gait.state,'idle');assert.ok(g.p.stamina<100);}
 const g=scene();tick(g,.8,{right:true});const snapshot=structuredClone(g.p);g.paused=true;tick(g,.5);assert.deepEqual(g.p,snapshot);
});
