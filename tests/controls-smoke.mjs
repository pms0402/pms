import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'] });
const origin=process.env.BASE_URL||'http://127.0.0.1:5174';
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1180,height:820}});
 await context.addInitScript(()=>{
  if(localStorage.getItem('controls-seeded'))return;
  localStorage.setItem('controls-seeded','1');
  localStorage.setItem('unrelated-save','keep');
  localStorage.setItem('voidrun.story',JSON.stringify({records:['sanctuary','royalOath'],endings:['guardian'],normalClear:true}));
  localStorage.setItem('voidrun.progression',JSON.stringify({bank:123456789,upgrades:{power:12},settledRunIds:['old-run'],unlocks:{characters:['wanderer','arcanist'],weapons:['voidblade','tempest']},loadout:{character:'arcanist',weapon:'tempest'}}));
  localStorage.setItem('voidrun.history',JSON.stringify([{stage:4,elapsed:150,kills:20,gold:800,level:5,date:'10/27',runId:'old-run'}]));
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>{await page.waitForFunction(()=>window.__game?.frames>1);await page.evaluate(()=>cancelAnimationFrame(window.__game.raf));};
 await page.goto(origin);await ready();
 await page.locator('#settings').click();await page.locator('#reset-save').click();
 assert.ok(await page.locator('#reset-confirm').isVisible());
 assert.equal(await page.evaluate(()=>document.activeElement.id),'reset-cancel');
 await page.locator('#reset-cancel').click();
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('voidrun.progression')).bank),123456789);
 await page.locator('#modal-close').click();
 await page.locator('#game-speed').click();assert.equal(await page.locator('#game-speed').textContent(),'2×');
 await page.locator('#game-speed').click();assert.equal(await page.locator('#game-speed').textContent(),'3×');
 await page.locator('#start-button').click();
 const speeds=await page.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};
  const samples=[];
  for(const speed of [1,2,3]) {g.setPlaybackSpeed(speed);const before=g.state.elapsed;g.advanceSimulation(.05);samples.push(g.state.elapsed-before);}
  g.keys.add('w');g.setMoveInput(1,0);window.dispatchEvent(new Event('blur'));document.dispatchEvent(new Event('visibilitychange'));
  const phase=g.state.phase,cleared=g.keys.size===0&&g.touchMove.x===0;
  g.pause();const before=g.state.elapsed;g.advanceSimulation(.05);window.dispatchEvent(new Event('blur'));const paused=g.state.phase;
  const frozen=g.state.elapsed===before;g.resume();g.advanceSimulation(.05);
  return {samples,phase,cleared,paused,frozen,resumed:g.state.elapsed>before};
 });
 for(let i=0;i<3;i++)assert.ok(Math.abs(speeds.samples[i]-.05*(i+1))<1e-7);
 assert.equal(speeds.phase,'playing');assert.equal(speeds.cleared,true);assert.equal(speeds.paused,'paused');assert.ok(speeds.frozen&&speeds.resumed);
 await page.locator('#settings').click();assert.equal(await page.locator('#reset-save').isDisabled(),true);
 await page.locator('#modal-close').click();
 await page.keyboard.press('Escape');await page.locator('#pause-restart').click();
 await page.locator('#result-settings').click();await page.locator('#reset-save').click();
 await Promise.all([page.waitForNavigation(),page.locator('#reset-confirm').click()]);await ready();
 const reset=await page.evaluate(()=>({p:JSON.parse(localStorage.getItem('voidrun.progression')),h:JSON.parse(localStorage.getItem('voidrun.history')),prefs:JSON.parse(localStorage.getItem('voidrun.preferences')),other:localStorage.getItem('unrelated-save'),story:JSON.parse(localStorage.getItem('voidrun.story')),phase:window.__game.state.phase}));
 assert.deepEqual(reset.story.records,[]);assert.deepEqual(reset.story.endings,[]);assert.equal(reset.story.normalClear,false);assert.equal(reset.p.bank,0);assert.equal(reset.p.lifetimeGold,0);assert.ok(Object.values(reset.p.upgrades).every(x=>x===0));assert.deepEqual(reset.p.settledRunIds,[]);assert.deepEqual(reset.p.loadout,{character:'wanderer',weapon:'voidblade'});assert.deepEqual(reset.p.unlocks,{characters:['wanderer'],weapons:['voidblade']});assert.deepEqual(reset.h,[]);assert.equal(reset.prefs.speed,3);assert.equal(reset.other,'keep');assert.equal(reset.phase,'menu');
 await page.reload();await ready();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('voidrun.progression')).bank),0);
 for(const viewport of [{width:390,height:844},{width:844,height:390}]) {await page.setViewportSize(viewport);assert.ok(await page.locator('#game-speed').isVisible());const dims=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));assert.ok(dims.sw<=dims.w+1&&dims.sh<=dims.h+1);}
 assert.deepEqual(errors,[]);console.log('PASS reset confirmation/cancel, full persistent reset without re-import, preserved preferences; 1/2/3× real simulation, blur/visibility recovery, manual pause and mobile controls');
 await context.close();
}finally{await browser.close();}
