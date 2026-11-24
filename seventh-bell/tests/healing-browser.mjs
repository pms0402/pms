import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {newProfile,SAVE_KEY} from '../src/data.js';
import {engine,launchBrowser} from './browser-engine.mjs';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await launchBrowser(),errors=[],report=[];
async function boot(touch=false){
 const context=await browser.newContext({viewport:touch?{width:1024,height:768}:{width:1440,height:900},hasTouch:touch,isMobile:touch}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.stack));
 const seed=newProfile();Object.assign(seed,{started:true,hp:30,flasks:0,position:{x:145,y:302}});seed.tutorial.state='done';seed.flags.letter=true;
 await p.addInitScript(({seed,key})=>{if(!localStorage.getItem(key)){localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('eldermere.save.v1','untouched');localStorage.setItem('voidrun','untouched');}},{seed,key:SAVE_KEY});
 await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});await p.click('#begin');
 return{p,context};
}
const state=p=>p.evaluate(()=>({hp:window.__seventh.game.p.hp,flasks:window.__seventh.game.profile.flasks,checkpoint:window.__seventh.game.profile.checkpoint,failed:window.__seventh.runtime.state.failed}));
async function wait(p,hp,flasks){await p.waitForFunction(({hp,flasks})=>{const g=window.__seventh.game;return g.p.hp===hp&&g.profile.flasks===flasks&&g.p.action===null&&document.querySelector('#flasks-count').textContent===flasks+' / 3';},{hp,flasks});}
try{
 const{p,context}=await boot();
 assert.equal(await p.locator('#flasks').isDisabled(),true);
 await p.keyboard.press('w');await wait(p,30,3);
 assert.match(await p.locator('#flasks').textContent(),/R.*회복.*3\s*\/\s*3/);
 // Holding the dedicated key must not auto-drink a second flask on key repeat.
 await p.keyboard.down('r');await p.waitForTimeout(1600);await p.keyboard.up('r');await wait(p,70,2);
 await p.keyboard.press('h');await wait(p,100,1);
 await p.keyboard.press('r');assert.equal((await state(p)).flasks,1,'full HP cannot waste a flask');
 await p.keyboard.press('w');await wait(p,100,3);await p.keyboard.press('w');assert.equal((await state(p)).flasks,3);
 await p.reload();await p.waitForFunction(()=>window.__seventh);await p.click('#begin');await wait(p,100,3);
 assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('eldermere.save.v1'),localStorage.getItem('voidrun')]),['untouched','untouched']);
 assert.equal((await state(p)).failed,false);report.push({desktop:await state(p),R:true,H:true,repeatedKey:true,persisted:true});
 await p.screenshot({path:new URL('healing-desktop-'+engine+'.png',out).pathname});await context.close();

 const mobile=await boot(true),m=mobile.p;
 await m.locator('#interact-prompt').tap();await wait(m,30,3);
 await m.locator('#touch-heal').tap();await wait(m,70,2);
 assert.equal(await m.locator('#touch-heal-count').textContent(),'2 / 3');
 for(const viewport of [{width:1024,height:768},{width:768,height:1024},{width:390,height:844},{width:844,height:390}]){
  await m.setViewportSize(viewport);await m.waitForTimeout(120);
  const layout=await m.evaluate(()=>{const heal=document.querySelector('#touch-heal').getBoundingClientRect(),buttons=[...document.querySelectorAll('#mobile-controls button')].filter(b=>b.id!=='touch-heal').map(b=>b.getBoundingClientRect());return{inside:heal.left>=0&&heal.top>=0&&heal.right<=innerWidth&&heal.bottom<=innerHeight,overlap:buttons.some(b=>Math.min(heal.right,b.right)>Math.max(heal.left,b.left)&&Math.min(heal.bottom,b.bottom)>Math.max(heal.top,b.top)),size:heal.width>=44&&heal.height>=44,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.deepEqual(layout,{inside:true,overlap:false,size:true,overflow:false});
  await m.screenshot({path:new URL('healing-touch-'+engine+'-'+viewport.width+'.png',out).pathname});
 }
 await m.locator('#interact-prompt').tap();await wait(m,70,3);
 await m.reload();await m.waitForFunction(()=>window.__seventh);await m.locator('#begin').tap();await wait(m,70,3);
 report.push({touch:await state(m),singleBottle:true,refill:true,persisted:true});await mobile.context.close();
 assert.deepEqual(errors,[]);await writeFile(new URL('healing-'+engine+'.json',out),JSON.stringify(report,null,2));
 console.log('PASS',engine,'bell refill/revisit, actual R and H inputs, no held-key repeat, 40% drink, separate touch heal, four layouts, persistence and independent game saves');
}finally{await browser.close();}
