import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {engine,launchBrowser} from './browser-engine.mjs';
import {installTutorialDriver} from './tutorial-driver.mjs';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url),errors=[],report=[];
await mkdir(out,{recursive:true});
const browser=await launchBrowser();
async function state(p){return p.evaluate(()=>{const g=window.__seventh.game;return{training:g.inTutorial,hp:g.p.hp,flasks:g.profile.flasks,tutorial:g.profile.tutorial,action:g.p.action?.kind,failed:window.__seventh.runtime.state.failed};});}
async function advance(p,step){await p.evaluate(step=>window.trainUntil(window.__seventh.game,step),step);}
async function shot(p,name){await p.waitForFunction(()=>{const{game:g,render:r}=window.__seventh;return Math.abs(r.x-r.cameraX())<4&&g.p.x>=r.x&&g.p.x<=r.x+r.width;});await p.screenshot({path:new URL('tutorial-recovery-'+engine+'-'+name+'.png',out).pathname});}
try{
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:touch?{width:768,height:1024}:{width:1440,height:900},hasTouch:touch,isMobile:touch}),p=await context.newPage(),label=touch?'touch':'keys';p.on('pageerror',e=>errors.push(e.stack));
  await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});
  if(touch)await p.locator('#begin').tap();else await p.click('#begin');
  await p.locator('#tutorial-guide').waitFor();assert.equal((await state(p)).hp,60);
  await installTutorialDriver(p);await p.evaluate(()=>window.reachTrainingKnight(window.__seventh.game));await advance(p,5);
  await p.waitForFunction(()=>document.querySelector('#tutorial-title').textContent==='숨 돌리기'&&window.__seventh.game.p.action===null);
  const before=await state(p);assert.equal(before.tutorial.healed,false);assert.equal(before.flasks,3);assert.equal(await p.locator('#tutorial-step').textContent(),'6 / 10');assert.match(await p.locator('#tutorial-key').textContent(),touch?/회복 버튼/:/R \/ H/);
  // The game continues to run, but the knight gives the player room to learn.
  await p.waitForTimeout(1500);assert.equal((await state(p)).hp,before.hp);assert.equal(await p.evaluate(()=>window.__seventh.game.world.enemies[0].state),'idle');
  await shot(p,label+'-before');
  await p.click('#save-button');await p.reload();await p.waitForFunction(()=>window.__seventh);if(touch)await p.locator('#begin').tap();else await p.click('#begin');await installTutorialDriver(p);
  assert.equal((await state(p)).tutorial.healed,false);assert.equal((await state(p)).hp,before.hp);
  if(touch)await p.locator('#touch-heal').tap();else await p.keyboard.press('r');
  assert.equal((await state(p)).flasks,2);assert.equal((await state(p)).tutorial.healed,false);assert.equal((await state(p)).hp,before.hp);
  await p.waitForFunction(()=>window.__seventh.game.profile.tutorial.healed&&window.__seventh.game.p.action===null);
  await p.waitForFunction(()=>document.querySelector('#tutorial-title').textContent==='무게를 실어서');assert.equal((await state(p)).hp,Math.min(100,before.hp+40));assert.equal(await p.locator('#tutorial-step').textContent(),'7 / 10');
  await shot(p,label+'-after');
  await p.reload();await p.waitForFunction(()=>window.__seventh);if(touch)await p.locator('#begin').tap();else await p.click('#begin');await installTutorialDriver(p);assert.equal((await state(p)).tutorial.healed,true);assert.equal((await state(p)).flasks,2);
  await advance(p,8);await p.evaluate(()=>{const g=window.__seventh.game;window.walkTutorial(g,1850);window.tickTutorial(g,.4);});
  await p.waitForFunction(()=>document.querySelector('#tutorial-title').textContent==='떠나기 전 보급');const exitHp=(await state(p)).hp;assert.equal((await state(p)).tutorial.refilled,false);assert.equal((await state(p)).flasks,2);await shot(p,label+'-bell-before');
  if(touch)await p.locator('#interact-prompt').tap();else await p.keyboard.press('e');
  await p.waitForFunction(()=>window.__seventh.game.profile.tutorial.refilled&&document.querySelector('#flasks-count').textContent==='3 / 3');
  assert.equal((await state(p)).training,true);assert.equal((await state(p)).hp,exitHp);assert.equal((await state(p)).flasks,3);await shot(p,label+'-bell-after');
  // Reloading after the bell must remember that its replenishment was learned.
  await p.reload();await p.waitForFunction(()=>window.__seventh);if(touch)await p.locator('#begin').tap();else await p.click('#begin');assert.equal((await state(p)).tutorial.refilled,true);
  if(touch)await p.locator('#interact-prompt').tap();else await p.keyboard.press('e');
  await p.locator('#letter-close').waitFor();assert.equal((await state(p)).training,false);assert.equal((await state(p)).hp,exitHp);assert.equal((await state(p)).flasks,3);assert.equal((await state(p)).failed,false);
  report.push({input:label,healed:true,refilled:true,exitHp,persisted:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('tutorial-recovery-'+engine+'.json',out),JSON.stringify(report,null,2));console.log('PASS',engine,'natural parry → recovery → combat → bell refill, real R/touch inputs, trainer waits, live HP proof, pending/completed reload and departure after seeing 3/3');
}finally{await browser.close();}
