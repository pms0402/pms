import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5302';
const out=process.env.SMOKE_OUTPUT||'/tmp/voidrun-fullscreen';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],results=[];
try{
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:960},deviceScaleFactor:2,isMobile:mobile,hasTouch:mobile});
  await context.addInitScript(()=>{
   localStorage.setItem('voidrun.preferences',JSON.stringify({screenControls:true,quality:'high'}));
   window.nativeRequests=0;
   const native=Element.prototype.requestFullscreen;
   if(native)Element.prototype.requestFullscreen=function(...args){window.nativeRequests++;return native.apply(this,args);};
  });
  const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);await p.waitForFunction(()=>window.__game?.artReady&&window.__game.frames>1);
  await p.evaluate(()=>cancelAnimationFrame(window.__game.raf));
  const size=()=>p.evaluate(()=>{const r=document.querySelector('#arena').getBoundingClientRect();return{width:r.width,height:r.height,iw:innerWidth,ih:innerHeight,full:document.body.classList.contains('theater-mode'),native:!!document.fullscreenElement,requests:window.nativeRequests,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight};});
  let state=await size();assert.equal(state.full,true);assert.equal(state.native,false);assert.equal(state.requests,0);assert.equal(state.width,state.iw);assert.equal(state.height,state.ih);
  for(const id of ['settings','sound-toggle','fullscreen'])assert.equal(await p.locator('#'+id).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,id+' reachable inside game');
  await p.locator('#settings').click();assert.ok(await p.locator('#setting-auto-performance').isVisible());
  await p.locator('#setting-auto-performance').click();assert.equal(await p.evaluate(()=>window.__game.renderBudget.enabled),false);
  await p.locator('#setting-auto-performance').click();assert.equal(await p.evaluate(()=>window.__game.renderBudget.enabled),true);
  await p.locator('#modal-close').click();
  await p.locator('#fullscreen').click();assert.equal((await size()).full,false);
  await p.locator('#fullscreen').click();assert.equal((await size()).full,true);assert.equal((await size()).requests,0);
  if(!mobile){
   await p.locator('#settings').click();await p.locator('#browser-fullscreen').click();
   await p.waitForFunction(()=>!!document.fullscreenElement);
   await p.evaluate(()=>document.exitFullscreen());await p.waitForFunction(()=>!document.fullscreenElement);
   assert.equal((await size()).full,true);assert.equal((await size()).requests,1);
   await p.locator('#modal-close').click();
  }
  await p.locator('#start-button').click();assert.equal(await p.evaluate(()=>window.__game.state.phase),'playing');
  await p.locator('#settings').click();assert.equal(await p.evaluate(()=>window.__game.state.phase),'paused');
  await p.locator('#modal-close').click();assert.equal(await p.evaluate(()=>window.__game.state.phase),'playing');assert.equal((await size()).full,true);
  const budget=await p.evaluate(()=>{const g=window.__game;cancelAnimationFrame(g.raf);g.setAutoPerformance(false);g.resize();const before=g.renderer.domElement.width*g.renderer.domElement.height;g.setAutoPerformance(true);g.resize();g.renderer.render(g.scene,g.camera);return{before,after:g.renderer.domElement.width*g.renderer.domElement.height,quality:g.quality,shadows:g.renderer.shadowMap.enabled};});
  assert.equal(budget.quality,'high');assert.equal(budget.shadows,true);assert.ok(budget.after<= (mobile?1800000:3000000));if(budget.before>(mobile?1800000:3000000))assert.ok(budget.after<budget.before);else assert.equal(budget.after,budget.before,'small screens retain the configured resolution');
  state=await size();assert.ok(state.scrollWidth<=state.iw+1&&state.scrollHeight<=state.ih+1);
  await p.screenshot({path:out+'/'+(mobile?'mobile':'desktop')+'.png'});
  const bossLayouts=[];await p.evaluate(()=>{window.__game.spawnBoss();window.__game.emit();});
  for(const viewport of [{width:1440,height:960},{width:1180,height:820},{width:390,height:844},{width:844,height:390}]){
   await p.setViewportSize(viewport);
   const layout=await p.evaluate(()=>{const b=document.querySelector('#boss-hud').getBoundingClientRect();return{width:innerWidth,height:innerHeight,boss:{x:b.x,y:b.y,width:b.width,height:b.height},overlaps:['camera-mode','game-speed','pause-button','fullscreen','sound-toggle','settings'].filter(id=>{const r=document.getElementById(id).getBoundingClientRect();return b.left<r.right&&b.right>r.left&&b.top<r.bottom&&b.bottom>r.top;})};});
   assert.deepEqual(layout.overlaps,[],JSON.stringify(layout));assert.ok(layout.boss.height<=42&&layout.boss.x>=0&&layout.boss.x+layout.boss.width<=viewport.width);bossLayouts.push(layout);
  }
  results.push({mobile,state,budget,bossLayouts});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/verification.json',JSON.stringify(results,null,2));console.log('PASS default full viewport, reachable controls, menus/resume, native fullscreen exit without collapse/reentry, high-DPI pixel reduction with high-quality models/shadows, PC/mobile no scrolling');
}finally{await browser.close();}
