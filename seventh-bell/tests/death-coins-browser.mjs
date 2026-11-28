import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {newProfile,SAVE_KEY} from '../src/data.js';
import {engine,launchBrowser} from './browser-engine.mjs';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await launchBrowser(),errors=[],report=[];
const snapshot=p=>p.evaluate(()=>{const g=window.__seventh.game;return{dead:g.p.dead,x:g.p.x,y:g.p.y,hp:g.p.hp,marks:g.profile.marks,loss:g.profile.loss,failed:window.__seventh.runtime.state.failed};});
async function boot(touch){
 const context=await browser.newContext({viewport:touch?{width:1024,height:768}:{width:1440,height:900},hasTouch:touch,isMobile:touch}),p=await context.newPage();
 p.on('pageerror',e=>errors.push(e.stack));
 const seed=newProfile();Object.assign(seed,{started:true,hp:1,marks:100,position:{x:700,y:302}});seed.tutorial.state='done';seed.flags.letter=true;
 await p.addInitScript(({seed,key})=>{if(!localStorage.getItem(key)){localStorage.setItem(key,JSON.stringify(seed));localStorage.setItem('eldermere.save.v1','untouched');localStorage.setItem('voidrun','untouched');}},{seed,key:SAVE_KEY});
 await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});await p.locator('#begin')[touch?'tap':'click']();
 return{context,p};
}
async function markerInk(p){return p.evaluate(async()=>{
 const version=new URL(document.querySelector('script[type=module]').src).search,{renderLostCoins}=await import('./src/lost-coin-renderer.js'+version),g=window.__seventh.game,l=g.profile.loss;
 const canvas=document.createElement('canvas');canvas.width=220;canvas.height=100;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
 const x=l?.x??g.p.x,y=l?.y??g.p.y;c.translate(110-x,82-y);
 const drawn=renderLostCoins({g,c,x:x-110,y:y-82,width:220,height:100,glow:()=>{}});
 const d=c.getImageData(0,0,220,100).data;let ink=0;for(let i=3;i<d.length;i+=4)if(d[i])ink++;
 return{drawn,ink};
});}
try{
 for(const touch of[false,true]){
  const{p,context}=await boot(touch),label=touch?'touch':'desktop';
  // An existing enemy deals the fatal hit. No debug damage or position writes
  // are used during the death, respawn and walk back to the saved trace.
  await p.waitForFunction(()=>window.__seventh.game.p.dead,null,{timeout:15000});
  const dead=await snapshot(p);assert.equal(dead.marks,50);assert.equal(dead.loss?.marks,50);
  assert.ok(Math.hypot(dead.x-dead.loss.x,dead.y-dead.loss.y)<35,'corpse is inside pickup reach');
  await p.locator('#respawn').waitFor();
  assert.equal((await snapshot(p)).marks,50);assert.deepEqual((await snapshot(p)).loss,dead.loss);
  const saved=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);assert.equal(saved.marks,50);assert.deepEqual(saved.loss,dead.loss);
  assert.match(await p.locator('#modal').innerText(),/동전 50개.*금빛 흔적/);
  assert.ok((await markerInk(p)).ink>100);
  await p.screenshot({path:new URL('death-coins-'+engine+'-'+label+'-death.png',out).pathname});
  await p.locator('#respawn')[touch?'tap':'click']();
  await p.waitForFunction(()=>!window.__seventh.game.p.dead);
  assert.equal((await snapshot(p)).marks,50);assert.deepEqual((await snapshot(p)).loss,dead.loss);
  await p.keyboard.down('ArrowRight');
  await p.waitForFunction(()=>{const g=window.__seventh.game;return g.profile.loss&&g.profile.loss.x-g.p.x<115;});
  await p.keyboard.up('ArrowRight');await p.waitForTimeout(400);
  const nearby=await snapshot(p);assert.equal(nearby.dead,false);assert.equal(nearby.marks,50);assert.deepEqual(nearby.loss,dead.loss);
  assert.ok(Math.hypot(nearby.x-dead.loss.x,nearby.y-dead.loss.y)>35);
  assert.ok((await markerInk(p)).ink>100);
  await p.locator('#save-button')[touch?'tap':'click']();
  await p.screenshot({path:new URL('death-coins-'+engine+'-'+label+'-trace.png',out).pathname});
  await p.reload();await p.waitForFunction(()=>window.__seventh);await p.locator('#begin')[touch?'tap':'click']();
  assert.deepEqual((await snapshot(p)).loss,dead.loss);assert.equal((await snapshot(p)).marks,50);
  await p.keyboard.down('ArrowRight');await p.waitForFunction(()=>window.__seventh.game.profile.loss===null);await p.keyboard.up('ArrowRight');
  assert.equal((await snapshot(p)).dead,false);assert.equal((await snapshot(p)).marks,100);
  assert.deepEqual(await markerInk(p),{drawn:false,ink:0});
  await p.waitForTimeout(600);assert.equal((await snapshot(p)).marks,100);
  await p.screenshot({path:new URL('death-coins-'+engine+'-'+label+'-recovered.png',out).pathname});
  const recovered=await p.evaluate(key=>JSON.parse(localStorage.getItem(key)),SAVE_KEY);assert.equal(recovered.marks,100);assert.equal(recovered.loss,null);
  await p.reload();await p.waitForFunction(()=>window.__seventh);await p.locator('#begin')[touch?'tap':'click']();
  assert.equal((await snapshot(p)).marks,100);assert.equal((await snapshot(p)).loss,null);
  assert.deepEqual(await p.evaluate(()=>[localStorage.getItem('eldermere.save.v1'),localStorage.getItem('voidrun')]),['untouched','untouched']);
  assert.equal((await snapshot(p)).failed,false);
  report.push({label,dead,nearby,onceOnly:true,deathSave:true,reloadTrace:true,recoveredSave:true});await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(new URL('death-coins-'+engine+'.json',out),JSON.stringify(report,null,2));
 console.log('PASS',engine,'native enemy death, corpse cannot recover, saved gold trace, respawn and walk back, reload, exactly one recovery, desktop and tablet buttons');
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){console.error('STATE',await snapshot(p));await p.screenshot({path:new URL('death-coins-'+engine+'-failure.png',out).pathname});}throw e;}finally{await browser.close();}
