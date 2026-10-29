import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const origin=process.env.BASE_URL||'http://127.0.0.1:5183',output=process.env.BENCH_OUTPUT||'/workspace/artifacts/voidrun-quality/before';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader','--enable-precise-memory-info']});
try{
 const p=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));
 await p.addInitScript(()=>{let seed=7781;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};});
 await p.goto(origin);await p.waitForFunction(()=>window.__game?.artReady);await p.locator('#start-button').click();
 await p.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);window.qualityFixture=(crowd=12)=>{
   g.start();g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};g._state.xpNeeded=1e9;g.invulnerable=1e6;g.setPlaybackSpeed(1);g.setQuality('high');
   for(let i=0;i<crowd;i++){const angle=crowd>20?i*2.399:Math.PI*1.25+(i%5-2)*.19,r=crowd>20?4+i%12:4+Math.floor(i/5)*3,e=g.spawnEnemy(Math.sin(angle)*r,Math.cos(angle)*r,[0,1,2,3,5,6,7,8,9][i%9],{noMutations:true});e.speed=0;e.hp=e.maxHp=1e9;e.shootTimer=e.actionTimer=1e6;}
   g._state.elapsed=12;g.playerVisual.visible=true;g.emit();
  };window.qualityFixture();
 });
 for(const mode of ['third','first','overhead']){
  await p.evaluate(mode=>{const g=window.__game;g.setViewMode(mode);for(let i=0;i<12;i++)g.advanceSimulation(1/60);g.updateCamera(100);g.playerVisual.visible=true;g.renderer.render(g.scene,g.camera);},mode);
  await p.locator('#game-canvas').screenshot({path:`${output}/${mode}.png`});
 }
 for(const region of ['volcano','tundra','forest','ruins','void']){
  await p.evaluate(id=>{const g=window.__game;g.regionId=id;g.regionSystem.setRegion(id);g.setViewMode('third');g.updateMood(100);g.world.art.update(0);g.playerVisual.visible=true;g.updateCamera(100);g.renderer.render(g.scene,g.camera);g.emit();},region);
  await p.locator('#game-canvas').screenshot({path:`${output}/${region}.png`});
 }
 await p.setViewportSize({width:390,height:844});await p.evaluate(()=>{const g=window.__game;g.resize();g.updateCamera(100);g.playerVisual.visible=true;g.renderer.render(g.scene,g.camera);});await p.screenshot({path:`${output}/mobile.png`});
 await p.setViewportSize({width:1280,height:900});
 const metrics=await p.evaluate(async()=>{
  const g=window.__game;window.qualityFixture(160);g.regionId='sanctum';g.regionSystem.setRegion('sanctum');g.setViewMode('overhead');g.renderer.setSize(960,540,false);g.camera.aspect=960/540;g.camera.updateProjectionMatrix();g.camera.position.set(20,26,25);g.camera.lookAt(0,.5,0);g.world.updateOcclusion(g.player.position,g.camera.position,100);
  const gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info'),hardware=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',frames=[],cpu=[];let previous;
  for(let i=0;i<72;i++)await new Promise(resolve=>requestAnimationFrame(now=>{const start=performance.now();g.advanceSimulation(1/60);g.playerVisual.visible=true;g.renderer.render(g.scene,g.camera);if(i>=12){cpu.push(performance.now()-start);if(previous)frames.push(now-previous);}previous=now;resolve();}));
  const sorted=arr=>[...arr].sort((a,b)=>a-b),f=sorted(frames),c=sorted(cpu),info=g.renderer.info;
  return{version:document.querySelector('.build-label b').textContent,hardware,viewport:[960,540],pixelRatio:g.renderer.getPixelRatio(),quality:g.quality,enemies:g.enemies.length,frames:f.length,frameMedianMs:f[Math.floor(f.length*.5)],frameP95Ms:f[Math.floor(f.length*.95)],cpuMedianMs:c[Math.floor(c.length*.5)],cpuP95Ms:c[Math.floor(c.length*.95)],calls:info.render.calls,triangles:info.render.triangles,geometries:info.memory.geometries,textures:info.memory.textures,heap:performance.memory?.usedJSHeapSize};
 });
 const session=await p.context().newCDPSession(p),memory=[];
 for(let n=0;n<4;n++){await p.evaluate(()=>{const g=window.__game;g.start();for(let i=0;i<24;i++)g.spawnEnemy(Math.sin(i)*8,Math.cos(i)*8,i%10);g.renderer.render(g.scene,g.camera);g.start();g.renderer.render(g.scene,g.camera);});await session.send('HeapProfiler.collectGarbage');memory.push(await p.evaluate(()=>({heap:performance.memory?.usedJSHeapSize,...window.__game.renderer.info.memory})));}
 const report={...metrics,resetSamples:memory,errors,method:'Chromium/SwiftShader, 960×540 backing buffer, fixed 160 actors, 12 warmup + 60 sampled RAF frames; CPU is simulation + render submission, not GPU hardware time. GC is invoked only by this benchmark.'};
 await writeFile(`${output}/metrics.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser.close();}
