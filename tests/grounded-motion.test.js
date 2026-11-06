import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {solveLimb,groundPlayer} from '../src/grounded-motion.js';
import {actionPose,ACTION_POSE_STYLES} from '../src/action-poses.js';
import {createActorMotion,advanceActorMotion} from '../src/motion.js';
import {DeathPresentation} from '../src/death-presentation.js';
import {MagicSystem} from '../src/magic.js';
import {tagMotionGeometry,deformReference,secondaryAngle} from '../src/monster-motion.js';
function fixture(){
 const player=new THREE.Group(),root=new THREE.Group(),pelvis=new THREE.Group();player.add(root);root.add(pelvis);pelvis.position.y=1.045;
 const g={player,playerVisual:root,playerPelvis:pelvis,stats:{speed:4},groundHeight:(x)=>x*.08};
 for(const [side,id] of [[-1,'Left'],[1,'Right']]){const hip=new THREE.Group(),knee=new THREE.Group(),foot=new THREE.Group();hip.position.x=side*.122;knee.position.y=-.47;foot.position.y=-.55;pelvis.add(hip);hip.add(knee);knee.add(foot);g['leg'+id]=hip;g['knee'+id]=knee;g['foot'+id]=foot;}
 return g;
}
test('two-bone IK reaches targets and keeps connected joints and finite limits',()=>{
 const g=fixture();for(const target of [new THREE.Vector3(-.122,-.92,.12),new THREE.Vector3(.1,-.7,.2),new THREE.Vector3(0,-20,0)]){
 const length=solveLimb(g.legLeft,g.kneeLeft,g.footLeft,target,.47,.55);g.player.updateMatrixWorld(true);
 const actual=g.footLeft.position.clone().applyMatrix4(g.kneeLeft.matrixWorld),hip=g.legLeft.getWorldPosition(new THREE.Vector3());assert.ok(Math.abs(actual.distanceTo(hip)-length)<1e-5);assert.ok(g.kneeLeft.quaternion.toArray().every(Number.isFinite));
 }
});
test('planted feet keep their world positions on a slope, swing clears ground and stops settle',()=>{
 const g=fixture(),s=createActorMotion(g.player);let contacts=0,clearance=0;
 for(let i=0;i<120;i++){g.player.position.x+=4/60;g.player.position.y=g.groundHeight(g.player.position.x);advanceActorMotion(s,g.player,1/60,4,true,4.1);groundPlayer(g,s,1/60);g.player.updateMatrixWorld(true);
 for(const f of s.ground.feet){if(f.stance){assert.ok(f.world.distanceTo(f.plant)<1e-8);contacts++;}clearance=Math.max(clearance,f.world.y-g.groundHeight(f.world.x));}
 assert.ok(s.ground.feet.every(f=>f.world.toArray().every(Number.isFinite)));}
 assert.ok(contacts>50);assert.ok(clearance>.1);
 for(let i=0;i<60;i++){advanceActorMotion(s,g.player,1/60,4,false,4.1);groundPlayer(g,s,1/60);}assert.ok(s.stride<.001);
});
test('authored weapon poses meet at rest and have distinct contact silhouettes',()=>{
 const contacts=[];for(const style of ACTION_POSE_STYLES){assert.ok(Object.values(actionPose(style,0)).every(v=>v===0));assert.ok(Object.values(actionPose(style,1)).every(v=>Math.abs(v)<1e-8));const p=actionPose(style,.42);contacts.push(JSON.stringify(p));for(const t of [.16,.42,.64]){const a=actionPose(style,t-1e-5),b=actionPose(style,t+1e-5);assert.ok(Math.abs(a.arm-b.arm)<.001);}}
 assert.equal(new Set(contacts).size,contacts.length);
});
test('secondary knee/elbow skin bends lower vertices, preserves shared assets and supports corpse poses',()=>{
 const geo=tagMotionGeometry(new THREE.BoxGeometry(.2,.8,.2).translate(-.2,.2,0),0,4),copy=geo.clone(),before=geo.attributes.position.array.slice(),pose=new Float32Array(16);pose[0]=4;pose[1]=1;pose[15]=1;
 assert.ok(secondaryAngle(0,4,pose)>.2);deformReference(geo,copy,pose);assert.notDeepEqual(copy.attributes.position.array,before);assert.deepEqual(geo.attributes.position.array,before);
 pose[14]=1;deformReference(geo,copy,pose);assert.ok([...copy.attributes.position.array].every(Number.isFinite));geo.dispose();copy.dispose();
});

test('underground magic rings and particles remain on the casting floor',()=>{
 const effects=[],geometry=new THREE.RingGeometry(.2,1,8),material=new THREE.MeshBasicMaterial(),m={game:{groundHeight:(_x,_z,reference)=>reference<0?-6:0},meshPools:new Map(),geometry:{ring:geometry,spark:geometry},material:{frost:material},addEffect:e=>effects.push(e)},p=new THREE.Vector3(0,-6,0);
 MagicSystem.prototype.ring.call(m,p,3,'frost');MagicSystem.prototype.spark.call(m,p,'frost');MagicSystem.prototype.particles.call(m,p,'frost',3);
 assert.equal(effects[0].mesh.position.y,-5.84);assert.ok(effects.every(e=>e.mesh.position.y<-5));effects[0].mesh.material.dispose();material.dispose();geometry.dispose();
});

test('defeat animation continues the current stagger pose without straightening first',()=>{
 const geo=new THREE.BoxGeometry(),mat=new THREE.MeshBasicMaterial(),group=new THREE.Group(),visual=new THREE.Group();visual.add(new THREE.Mesh(geo,mat));group.add(visual);visual.rotation.x=.4;visual.rotation.z=-.1;visual.position.y=-.15;const pose=new Float32Array(16);pose[14]=.45;pose[15]=1;
 const deaths=new DeathPresentation({scene:new THREE.Scene(),effectIntensity:1});deaths.capture({group,visual,kind:0,motion:{pose}},new THREE.Vector3(1,0,0));deaths.update(0);const entry=deaths.slots[0];assert.ok(Math.abs(entry.root.rotation.x-.4)<1e-8);assert.ok(entry.pose[3].z>=.45-1e-7);assert.equal(entry.copy.position.y,-.15);deaths.update(1);assert.equal(entry.root.visible,false);deaths.dispose();geo.dispose();mat.dispose();
});
