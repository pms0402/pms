import {manualPage} from './manual-fixtures.mjs';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const p=await manualPage(b,{viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.BASE_URL||'http://127.0.0.1:5174');await p.waitForFunction(()=>window.__game?.frames>1);await p.locator('#start-button').click();
 const result=await p.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};g.actions.syncSlots();g._state.xpNeeded=1e9;
  g.player.position.set(17,g.groundHeight(17,20),20);g.setMoveInput(1,1);const before=g.player.position.clone();g.stepForTest(.8);g.setMoveInput(0,0);const after=g.player.position.clone();
  const groundError=Math.abs(after.y-g.groundHeight(after.x,after.z));
  const wall=g.world.colliders.find(c=>c.id==='chapel');g.player.position.set(wall.x-.9,g.groundHeight(wall.x-.9,wall.z),wall.z);g.setMoveInput(1,1);g.stepForTest(.3);g.setMoveInput(0,0);const blocked=g.world.isWalkable(g.player.position.x,g.player.position.z,.649);
  const s=g.world.structures.find(s=>s.id==='chapel');g.player.position.set(s.x,g.groundHeight(s.x,s.z+s.depth/2+2),s.z+s.depth/2+2);g.setMoveInput(1,-1);g.stepForTest(.7);g.setMoveInput(0,0);const entered=g.player.position.z<s.z+s.depth/2;
  const e=g.spawnEnemy(21.5,26,0);e.hp=e.maxHp=1e6;g.player.position.set(28,g.groundHeight(28,26),26);g.world.updateNavigation(g.player.position,10);let enemyClip=false;for(let i=0;i<480;i++){g.updateEnemies(1/60);if(!g.world.isWalkable(e.group.position.x,e.group.position.z,e.size*.4-.001))enemyClip=true;}const enemyGroundError=Math.abs(e.group.position.y-g.groundHeight(e.group.position.x,e.group.position.z));
  g.player.position.set(35,g.groundHeight(35,-10),-10);const pickPos=g.player.position.clone();g.dropPickup(pickPos,'gold',10);const pickup=g.pickups.at(-1);const pickupError=Math.abs(pickup.mesh.position.y-g.groundHeight(pickup.mesh.position.x,pickup.mesh.position.z)-.4);
  const target=g.spawnEnemy(36,-10,0);target.hp=target.maxHp=1e6;window.testStrike(g,{x:1,z:0});const slash=g.effects.find(e=>e.type==='slash');slash.mesh.updateMatrixWorld(true);const positions=slash.mesh.geometry.attributes.position;let sweepError=0;for(let i=0;i<positions.count;i++){const point=g.player.position.clone().fromBufferAttribute(positions,i).applyMatrix4(slash.mesh.matrixWorld);sweepError=Math.max(sweepError,Math.abs(point.y-g.groundHeight(point.x,point.z)-.38));}
  const kinds=[0,1,2,3,5,6,7,8,9],anatomy=kinds.map((kind,i)=>{const x=45+i*.5,z=-12;const enemy=g.spawnEnemy(x,z,kind);return {kind,parts:enemy.visual.children.length,vertices:enemy.visual.children.reduce((sum,m)=>sum+m.geometry.attributes.position.count,0)};});
  g.world.updateNavigation({x:20,z:0},100);g.world.updateNavigation({x:0,z:0},0);const restartDirection=g.world.steer({x:0,z:8},0,-8,.5,0);
  g.updateCamera(100);g.world.updateOcclusion({x:17,y:g.groundHeight(17,20),z:20},{x:37,y:30,z:45},100);let faded=0;g.scene.traverse(m=>{if(m.isMesh&&m.userData.noStaticBatch&&m.material.opacity<.5)faded++;});g.renderer.render(g.scene,g.camera);
  return {world:g.state.world,radius:g.state.arenaRadius,before:before.toArray(),after:after.toArray(),groundError,blocked,entered,enemyClip,enemyGroundError,pickupError,sweepError,restartDirection,anatomy,faded,draw:g.renderer.info.render.calls,geometries:g.renderer.info.memory.geometries};
 });
 assert.equal(result.radius,90);assert.equal(result.world.hills,9);assert.equal(result.world.structures,9);assert.ok(result.after[1]>result.before[1]);assert.ok(result.groundError<1e-7);assert.ok(result.blocked&&result.entered);assert.equal(result.enemyClip,false);assert.ok(result.enemyGroundError<1e-7&&result.pickupError<1e-6&&result.sweepError<1e-5);assert.ok(result.anatomy.every(x=>x.parts<=7&&x.vertices>600));assert.ok(result.faded>0);assert.ok(result.restartDirection.z<-.8);assert.ok(result.draw<500);
 console.log('PASS climbable hills, enlarged map, wall/door collision, grounded enemies/pickups, terrain-fitted sword sweep, cached distinct anatomy and occlusion fade',JSON.stringify(result));
 for(const viewport of [{width:390,height:844},{width:1180,height:820}]){await p.setViewportSize(viewport);const dims=await p.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(dims.sw<=dims.w+1&&dims.sh<=dims.h+1);}
 assert.deepEqual(errors,[]);
}finally{await b.close();}
