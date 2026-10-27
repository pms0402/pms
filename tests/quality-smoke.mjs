import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.BASE_URL||'http://127.0.0.1:5174');await page.waitForFunction(()=>window.__game?.frames>1);await page.locator('#start-button').click();
 const result=await page.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};g.invulnerable=1e6;g._state.xpNeeded=1e9;g.stats.critChance=0;
  for(let i=0;i<160;i++){const a=i*2.399,r=4+i%12,e=g.spawnEnemy(Math.cos(a)*r,Math.sin(a)*r,[0,1,2,3,5,6,7,8,9][i%9]);e.speed=0;e.hp=e.maxHp=1e6;}
  g.renderer.setSize(800,560,false);g.camera.aspect=800/560;g.camera.updateProjectionMatrix();g.camera.position.set(20,26,25);g.camera.lookAt(0,.5,0);g.world.updateOcclusion(g.player.position,g.camera.position,100);
  const stats=JSON.stringify(g.stats),hp=g.state.hp,gold=g.state.gold,gl=g.renderer.getContext();
  const snapshot=enabled=>{g.enemyRenderer.enabled=enabled;for(let i=0;i<3;i++)g.renderer.render(g.scene,g.camera);const data=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,data);return{calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,data};};
  const before=snapshot(false),after=snapshot(true);let total=0,changed=0;
  for(let i=0;i<before.data.length;i+=4){let max=0;for(let c=0;c<3;c++){const error=Math.abs(before.data[i+c]-after.data[i+c]);total+=error;max=Math.max(max,error);}if(max>3)changed++;}
  const pixels=before.data.length/4,meanError=total/(pixels*3),changedFraction=changed/pixels;
  const cached=g.enemyRenderer.batches.size,sourceParts=g.enemies.reduce((n,e)=>n+e.visual.children.filter(m=>!m.material.transparent).length,0),active=g.enemyRenderer.getDebugState();
  const materials={environment:!!g.scene.environment,terrain:!!g.world.ground.material.map,normal:!!g.world.ground.material.normalMap,cloth:!!g.cape.material.map,shadow:!!g.playerShadow.material.map};
  const originalPool=g.effectPool,ownedBefore=g.ownedGeometries.size;g.effectPool=Array.from({length:150},()=>({type:'reserved'}));
  for(let i=0;i<40;i++){g.slash(g.player.position.clone().set(0,0,1));const effect=g.effects.pop();g.releaseEffect(effect);}
  const discardedGeometryFreed=g.ownedGeometries.size===ownedBefore;g.effectPool=originalPool;
  const unchanged=JSON.stringify(g.stats)===stats&&g.state.hp===hp&&g.state.gold===gold;
  g.start();g.renderer.render(g.scene,g.camera);const reset=g.enemyRenderer.getDebugState();for(let i=0;i<16;i++)g.spawnEnemy(i*.3,5,0);g.renderer.render(g.scene,g.camera);const reused=g.enemyRenderer.batches.size<=cached;
  return{before:{calls:before.calls,triangles:before.triangles},after:{calls:after.calls,triangles:after.triangles},meanError,changedFraction,sourceParts,active,reset,reused,unchanged,discardedGeometryFreed,materials,shadows:g.renderer.shadowMap.enabled,pixelRatio:g.renderer.getPixelRatio(),textures:g.renderer.info.memory.textures,geometries:g.renderer.info.memory.geometries};
 });
 assert.ok(result.after.calls<result.before.calls*.4,'same crowd draws with substantially fewer calls');assert.equal(result.after.triangles,result.before.triangles,'all model triangles remain');assert.ok(result.meanError<.1&&result.changedFraction<.002,'batching retains the individual-render appearance');assert.ok(result.unchanged&&result.discardedGeometryFreed);assert.ok(Object.values(result.materials).every(Boolean));assert.ok(result.shadows&&result.pixelRatio>=1);assert.equal(result.reset.instances,0);assert.ok(result.reused);assert.ok(result.textures<32&&result.geometries<180);assert.deepEqual(errors,[]);
 console.log('PASS same160-monster geometry, near-identical pixels, fewer draw calls, unchanged stats, material polish and restart reuse',JSON.stringify(result));
}finally{await browser.close();}
