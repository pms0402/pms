import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});await page.goto(process.env.BASE_URL||'http://127.0.0.1:5174');await page.waitForFunction(()=>window.__game?.frames>1);await page.locator('#start-button').click();
 const result=await page.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);g.start();g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};g._state.xpNeeded=1e9;g.invulnerable=1e6;
  const random=Math.random;let seed=7321;Math.random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  try{for(let i=0;i<160;i++){const angle=i*2.399,r=4+i%12,e=g.spawnEnemy(Math.cos(angle)*r,Math.sin(angle)*r,[0,1,2,3,5,6,7,8,9][i%9]);e.speed=0;e.hp=e.maxHp=1e6;e.group.rotation.y=angle+Math.PI;}}finally{Math.random=random;}
  g.camera.position.set(20,26,25);g.camera.lookAt(0,.5,0);g.camera.aspect=1000/700;g.camera.updateProjectionMatrix();g.renderer.setSize(1000,700,false);g.world.updateOcclusion(g.player.position,g.camera.position,100);
  const modes=g.enemyRenderer?[false,true]:[false],measurements=[];
  for(const optimized of modes){if(g.enemyRenderer)g.enemyRenderer.enabled=optimized;for(let n=0;n<3;n++)g.renderer.render(g.scene,g.camera);const memory=g.renderer.info.memory;const frame={optimized,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:memory.geometries,textures:memory.textures,shadows:g.renderer.shadowMap.enabled,pixelRatio:g.renderer.getPixelRatio(),image:g.renderer.domElement.toDataURL('image/png')};measurements.push(frame);}
  return {version:document.querySelector('.build-label b').textContent,enemyCount:g.enemies.length,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],measurements};
 });
 const prefix=process.env.BENCH_OUTPUT||'/tmp/voidrun-render';for(const m of result.measurements){await writeFile(`${prefix}-${m.optimized?'batched':'individual'}.png`,Buffer.from(m.image.split(',')[1],'base64'));delete m.image;}
 console.log(JSON.stringify(result));
}finally{await browser.close();}
