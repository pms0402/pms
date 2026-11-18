import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {newProfile,SAVE_KEY} from '../src/data.js';

const base=process.env.BASE_URL||'http://127.0.0.1:4190/';
const result=new URL('../test-results/',import.meta.url);
await mkdir(result,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];
const seed={...newProfile(),started:true,level:5,marks:240,points:4,upgrade:2,hp:63,flasks:1};
seed.tutorial.state='done';
seed.flags.letter=true;
const otherSaves={'voidrun':'keep-voidrun','eldermere.save.v1':'keep-eldermere'};
async function page(context,withSave=true){
 const p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.stack));
 await p.addInitScript(({seed,key,otherSaves,withSave})=>{
  if(!sessionStorage.getItem('reset-test-seeded')){
   sessionStorage.setItem('reset-test-seeded','1');
   if(withSave)localStorage.setItem(key,JSON.stringify(seed));
   for(const [k,v]of Object.entries(otherSaves))localStorage.setItem(k,v);
  }
 },{seed,key:SAVE_KEY,otherSaves,withSave});
 await p.goto(base+'?test=1');
 await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});
 return p;
}
const profile=p=>p.evaluate(()=>window.__seventh.game.profile);
async function confirmReset(p,touch=false){
 await p.locator('#new-game')[touch?'tap':'click']();
 await p.locator('#confirm-reset').waitFor();
 await Promise.all([
  p.waitForEvent('load'),
  p.locator('#confirm-reset')[touch?'tap':'click']()
 ]);
 await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});
}
async function assertFresh(p){
 const s=await profile(p);
 assert.equal(s.started,false);
 assert.equal(s.level,1);
 assert.equal(s.marks,0);
 assert.equal(s.upgrade,0);
 assert.equal(s.hp,100);
 assert.equal(s.flasks,3);
 assert.equal(s.tutorial.state,'new');
 assert.equal(s.tutorial.step,0);
 assert.deepEqual(s.talents,[]);
 assert.deepEqual(s.opened,[]);
 assert.equal(await p.evaluate(key=>localStorage.getItem(key),SAVE_KEY),null);
 for(const [key,value]of Object.entries(otherSaves))assert.equal(await p.evaluate(key=>localStorage.getItem(key),key),value);
 assert.match(await p.locator('#begin').innerText(),/조작 익히기/);
 assert.equal(await p.locator('#new-game').isVisible(),false);
}
try{
 const pc=await browser.newContext({viewport:{width:1440,height:960}}),p=await page(pc);
 assert.equal((await profile(p)).marks,240);
 await p.click('#new-game');
 await p.locator('#modal-body button').filter({hasText:'돌아간다'}).click();
 await p.reload();
 await p.waitForFunction(()=>window.__seventh);
 assert.equal((await profile(p)).marks,240,'cancel preserves the existing save');
 await confirmReset(p);
 await assertFresh(p);
 await p.reload();
 await p.waitForFunction(()=>window.__seventh);
 await assertFresh(p);
 await p.screenshot({path:new URL('072-reset-title.png',result).pathname});
 await p.click('#begin');
 await p.locator('#tutorial-guide').waitFor();
 await p.keyboard.down('d');
 await p.waitForTimeout(1100);
 await p.keyboard.up('d');
 await p.waitForFunction(()=>window.__seventh.game.profile.tutorial.step===1);
 await p.click('#save-button');
 await p.reload();
 await p.waitForFunction(()=>window.__seventh);
 const restarted=await profile(p);
 assert.equal(restarted.level,1);
 assert.equal(restarted.marks,0);
 assert.equal(restarted.tutorial.state,'active');
 assert.equal(restarted.tutorial.step,1);
 await pc.close();
 console.log('PASS actual reset reload/pagehide, cancel, repeat reload, fresh tutorial progress and other game saves');

 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),m=await page(mobile,false);
 await m.locator('#skip-tutorial').tap();
 await m.locator('#letter-close').tap();
 await m.locator('#menu-button').tap();
 await m.locator('#return-title').tap();
 assert.equal(await m.locator('#new-game').isVisible(),true,'first session exposes reset after returning to title');
 await confirmReset(m,true);
 await assertFresh(m);
 await m.screenshot({path:new URL('072-reset-mobile.png',result).pathname});
 await mobile.close();
 console.log('PASS mobile touch reset and reset button after first-session return to title');

 const failure=await browser.newContext({viewport:{width:1000,height:760}}),f=await page(failure);
 await f.evaluate(()=>{Storage.prototype.removeItem=function(){throw new DOMException('Storage blocked','SecurityError');};});
 await f.click('#new-game');
 await f.click('#confirm-reset');
 await f.locator('#reset-error').waitFor();
 assert.equal((await profile(f)).marks,240);
 assert.equal(await f.locator('#confirm-reset').isVisible(),true);
 assert.equal(JSON.parse(await f.evaluate(key=>localStorage.getItem(key),SAVE_KEY)).marks,240);
 await f.locator('#modal-body button').filter({hasText:'돌아간다'}).click();
 await f.reload();
 await f.waitForFunction(()=>window.__seventh);
 assert.equal((await profile(f)).marks,240);
 await failure.close();
 assert.deepEqual(errors,[]);
 console.log('PASS blocked storage reports failure without reloading or discarding progress');
}finally{
 await browser.close();
}
