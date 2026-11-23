import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {installDriver} from './driver.mjs';
const seed=JSON.parse(await readFile(new URL('../test-results/five-bells.json',import.meta.url),'utf8'));
const base=process.env.BASE_URL||'http://127.0.0.1:4190/',out=new URL('../test-results/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),p=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));
await p.addInitScript(seed=>{if(!localStorage.getItem('seventh-bell.save.v1'))localStorage.setItem('seventh-bell.save.v1',JSON.stringify(seed));},seed);
const state=()=>p.evaluate(()=>({profile:window.__seventh.game.profile,p:window.__seventh.game.p,boss:window.__seventh.game.world.boss}));
async function shot(name){const old=await p.evaluate(()=>{const{game:g,render:r,updateUI}=window.__seventh,old=g.paused;g.paused=true;r.snap();r.render(0);updateUI();return old;});await p.screenshot({path:new URL('010-'+name+'.png',out).pathname});await p.evaluate(old=>window.__seventh.game.paused=old,old);}
async function fight(id,entry){
 for(let attempt=0;attempt<3;attempt++){
  await p.evaluate(entry=>window.walkTo(entry),entry);assert.equal((await state()).boss.id,id);await shot(id+'-first-phase');
  let result=await p.evaluate(()=>window.fightBoss(true));
  if(result.phase===2&&!result.dead){await shot(id+'-second-phase');await p.evaluate(()=>window.__seventh.game.paused=false);result=await p.evaluate(()=>window.fightBoss());}
  console.log('FIGHT',id,attempt+1,JSON.stringify(result));
  if(result.choice==='freed'){assert.equal(result.dead,false);await p.locator('#boss-clear-close').waitFor();await shot(id+'-freed');await p.click('#boss-clear-close');return;}
  assert.equal(result.dead,true,JSON.stringify(result));await p.evaluate(()=>window.tick(1.6));await p.locator('#respawn').waitFor();await p.click('#respawn');await p.evaluate(()=>{window.__seventh.game.world.enemies=[];window.__seventh.game.world.traps=[];});
 }
 throw Error('Could not defeat '+id+' in three real lives');
}
try{
 await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});assert.equal((await state()).profile.hp,seed.hp);assert.equal((await state()).profile.flasks,seed.flasks);await p.click('#begin');await installDriver(p);
 // As in the earlier chapter route: isolate collision, progression and full boss
 // AIs from ordinary monsters/traps. Separate tests retain actual hazards.
 await p.evaluate(()=>{const g=window.__seventh.game;g.world.enemies=[];g.world.traps=[];window.walkTo(22620);});await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'harbor');await shot('harbor-entry');
 await p.evaluate(()=>window.walkTo(22840));await p.locator('#speech').waitFor({state:'visible'});assert.equal(await p.locator('.speech-name').textContent(),'도란');
 for(let i=0;i<6;i++)await p.locator('.speech-copy').click();await p.locator('#accept-dock').waitFor();await shot('dock-request');await p.click('#accept-dock');assert.equal((await state()).profile.quests.dockkeeper,'active');
 await p.evaluate(()=>window.walkTo(23100));await p.locator('#speech').waitFor({state:'hidden'});
 await p.evaluate(()=>window.walkTo(23880));assert.equal((await state()).p.y,430);await shot('dry-lock');await p.keyboard.press('w');assert.equal((await state()).profile.flags.harborLock,true);
 await p.evaluate(()=>window.walkTo(24090));const coins=(await state()).profile.marks;await p.keyboard.press('w');assert.equal((await state()).profile.marks,coins+80);await p.keyboard.press('w');assert.equal((await state()).profile.marks,coins+80);assert.equal((await state()).profile.quests.dockkeeper,'done');
 await p.evaluate(()=>{window.jumpTo(24100);window.jumpTo(24230);window.jumpTo(24340);window.walkTo(24600);});await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'drydock');
 await p.evaluate(()=>{window.walkTo(24850);window.jumpTo(24940);window.walkTo(24990);window.jumpTo(25070);window.walkTo(25110);window.jumpTo(25220);});assert.equal((await state()).p.y,176);await p.keyboard.press('w');await p.locator('#clue-close').waitFor();assert.match(await p.locator('#modal-body').innerText(),/이미 집에/);await shot('lighthouse-log');await p.click('#clue-close');assert.equal((await state()).profile.flags.harborLog,true);
 await p.evaluate(()=>window.walkTo(25880));await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'beacon');
 await p.evaluate(()=>window.walkTo(25790));await p.keyboard.press('w');const money=(await state()).profile.marks;await p.click('#upgrade-weapon');assert.equal((await state()).profile.upgrade,4);assert.equal((await state()).profile.marks,money-155);await p.click('#shop-close');
 await fight('neris',26200);assert.equal((await state()).profile.flags.tide,true);
 // Walk back through the lock, then use V and real jumps on the new tide path.
 await p.evaluate(()=>{window.walkTo(24230);window.walkTo(23690);window.jumpTo(23690);window.jumpTo(23610);window.jumpTo(23530);});await p.keyboard.press('v');await p.evaluate(()=>{window.jumpTo(23700,true);window.walkTo(23730);window.jumpTo(23850,true);window.walkTo(23890);window.jumpTo(24080,true);});assert.equal((await state()).p.y,150);await shot('tide-return-path');await p.keyboard.press('w');assert.equal((await state()).profile.opened.includes('tidecache'),true);
 await p.evaluate(()=>{window.walkTo(24340);window.walkTo(27960);});await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'belltower');await shot('tower-entry');
 await p.evaluate(()=>window.walkTo(29170));assert.equal((await state()).p.y,430);await p.keyboard.press('w');assert.equal((await state()).profile.flags.towerSeal,true);await shot('tower-resonator');
 await p.evaluate(()=>window.walkTo(29420));await p.keyboard.press('w');assert.equal((await state()).profile.opened.includes('towercache'),true);
 await p.evaluate(()=>{window.jumpTo(29400);window.jumpTo(29520);window.jumpTo(29650);window.walkTo(30020);});await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'gearhall');
 await p.evaluate(()=>{window.walkTo(30230);window.jumpTo(30320);window.walkTo(30370);window.jumpTo(30450);window.walkTo(30500);window.jumpTo(30620);});assert.equal((await state()).p.y,176);await p.keyboard.press('w');assert.equal((await state()).profile.flags.towerLens,true);await shot('tower-lens');
 await p.evaluate(()=>window.walkTo(31090));await p.keyboard.press('w');await p.locator('#clue-close').waitFor();assert.match(await p.locator('#modal-body').innerText(),/동생이 오면/);await p.click('#clue-close');assert.equal((await state()).profile.flags.conductorNotes,true);
 await p.evaluate(()=>window.walkTo(31600));await p.keyboard.press('w');assert.equal((await state()).profile.checkpoint,'heart');await p.click('#save-button');await writeFile(new URL('six-bells.json',out),JSON.stringify((await state()).profile));
 await fight('carillon',31810);assert.equal((await state()).profile.flags.resonance,true);
 await p.evaluate(()=>{window.walkTo(31090);window.jumpTo(31120);window.jumpTo(31240,true);window.jumpTo(31260,true);});assert.equal((await state()).p.y,70);await p.keyboard.press('w');assert.equal((await state()).profile.opened.includes('resonancecache'),true);await shot('last-return-treasure');
 await p.evaluate(()=>window.walkTo(33300));await p.keyboard.press('w');await p.locator('#ending-night').waitFor();assert.equal(await p.locator('#ending-dawn').count(),0);await shot('seventh-choice');await p.click('#ending-night');assert.equal((await state()).profile.flags.ending,'night');await shot('seventh-ending');await p.click('#ending-close');await p.click('#save-button');const saved=(await state()).profile;await writeFile(new URL('seven-bells.json',out),JSON.stringify(saved));await p.reload();await p.waitForFunction(()=>window.__seventh);const reloaded=(await state()).profile;for(const key of ['marks','flasks','hp','level','upgrade','talents','opened','flags','quests'])assert.deepEqual(reloaded[key],saved[key]);assert.deepEqual(errors,[]);
 console.log('PASS real six/seven route, proximity quest, one-time rescue/treasures, lower-room exits, paid workshop, both real two-phase new bosses, V return path, final power treasure, ending and exact save reload');
}catch(e){console.log('SEVEN STATE',JSON.stringify(await state()).slice(0,6000));await shot('seven-failure');throw e;}finally{await browser.close();}
