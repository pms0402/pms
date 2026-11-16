import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {installNavigation} from './navigation.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));
const base=process.env.BASE_URL||'http://127.0.0.1:4174';await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
const state=()=>page.evaluate(()=>window.__eldermere.game.state);
try{
 await page.goto(base+'/?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await page.click('#begin');await installNavigation(page);
 await page.evaluate(()=>{window.tickLife=seconds=>{const g=window.__eldermere.game;if(g.paused)throw Error('Tick while paused');for(let i=0;i<seconds*25;i++){g.update(.04,{});if(g.p.hp<g.maxHp-40)g.use();}};window.finishLife=()=>{const g=window.__eldermere.game;let ticks=0;while(g.state.life.job&&ticks++<1000)g.update(.04,{});if(ticks>=1000)throw Error('Job stalled');};});
 const tick=s=>page.evaluate(s=>window.tickLife(s),s),finish=()=>page.evaluate(()=>window.finishLife());
 async function walk(id,range=34){const pos=typeof id==='string'?await page.evaluate(id=>{const o=window.__eldermere.game.life.objects().find(o=>o.id===id);if(!o)throw Error('Missing target '+id);return{x:o.x,y:o.y};},id):id;await page.evaluate(([p,r])=>window.walkTo(p.x,p.y,r),[pos,range]);}
 const key=()=>page.keyboard.press('e');
 async function process(station,id){await walk(station);await key();if(id.includes('_'))await page.locator('[data-tab="'+id.split('_')[0]+'"]').click();const b=page.locator('[data-process="'+id+'"]');assert.ok(await b.isEnabled(),'Disabled recipe '+id);await b.click();await finish();}
 async function mine(id){const item=await page.evaluate(id=>{const o=window.__eldermere.game.world.lifeObjects.find(o=>o.id===id);return o.metal?o.metal+'Ore':o.resourceId;},id);const before=(await state()).inventory[item];for(let attempt=0;attempt<4;attempt++){await walk(id);await key();assert.ok((await state()).life.job,'No mining job '+id);await finish();if((await state()).inventory[item]>before)return;await page.evaluate(()=>{const g=window.__eldermere.game;for(let i=0;i<350;i++){for(const e of g.enemies)if(Math.hypot(e.x-g.p.x,e.y-g.p.y)<g.life.profile().range)g.strike(Math.atan2(e.y-g.p.y,e.x-g.p.x));if(g.p.hp<g.maxHp-35)g.use();g.update(.02,{});}});}throw Error('Mining repeatedly interrupted '+id);}
 async function vendor(id){await page.evaluate(id=>{const g=window.__eldermere.game;let i=0;while(!g.life.isOpen(id)&&i++<15000)g.update(.04,{});},id);const npc=await page.evaluate(id=>{const o=window.__eldermere.game.life.npcs.find(o=>o.npc===id);return{id:o.id,map:o.map};},id);assert.equal(npc.map,(await state()).map);await walk(npc.id);await key();await page.click('#dialog-trade');await page.locator('[data-tab="buy"]').waitFor();}
 const trees=await page.evaluate(()=>window.__eldermere.game.world.objects.filter(o=>o.resource==='wood').sort((a,b)=>Math.hypot(a.x-620,a.y-664)-Math.hypot(b.x-620,b.y-664)).slice(0,14).map(o=>o.id));
 for(const id of trees){await walk(id);for(let i=0;i<3;i++){await key();await tick(.45);}}
 assert.ok((await state()).inventory.wood>=42);
 for(let i=0;i<3;i++)await mine('stone'+i);
 await walk('mine-mouth');await key();assert.equal((await state()).map,'mine1');await walk('mine-cache');await key();assert.equal((await state()).inventory.coal,12);
 for(let i=0;i<10;i++)await mine('copper'+i);for(let i=0;i<3;i++)await mine('coal'+i);
 await page.screenshot({path:new URL('../test-results/life-mine.png',import.meta.url).pathname});
 for(let i=0;i<10;i++)await process('mine-forge','copperBar');await process('mine-bench','copperPick');assert.equal((await state()).life.tools.pick,1);
 for(let i=0;i<6;i++)await mine('iron'+i);for(let i=0;i<6;i++)await process('mine-forge','ironBar');
 console.log('PASS real mining depletion, timed smelting, upgraded pickaxe and iron harvesting');
 for(let i=0;i<13;i++)await process('mine-bench','plank');
 for(const id of ['iron_sword','copper_bow','copper_dagger'])await process('mine-bench',id);
 const sword=(await state()).life.gear.find(x=>x.type==='sword');await walk('mine-bench');await key();await page.locator('[data-tab="upgrade"]').click();await page.locator('[data-upgrade="'+sword.uid+'"]').click();await finish();assert.equal((await state()).life.gear.find(x=>x.uid===sword.uid).upgrade,1);
 await page.keyboard.press('i');await page.click('#inventory-gear');await page.locator('[data-equip="'+sword.uid+'"]').click();await page.locator('.close').click();assert.equal((await state()).life.equipped.weapon,sword.uid);
 await walk('deep-down');await key();assert.equal((await state()).map,'mine2');await walk('deep-cache');await key();assert.equal((await state()).inventory.relic,3);assert.ok((await state()).life.unlocked.includes('mythril'));
 await walk('mythril0');await key();assert.equal((await state()).life.job,null);assert.equal((await state()).inventory.mythrilOre,0);
 await walk('deep-up');await key();await walk('mine-exit');await key();for(let i=0;i<2;i++)await mine('surface-copper'+i);for(let i=0;i<2;i++)await process('forge','copperBar');
 console.log('PASS forged, upgraded and equipped weapon, traversable deep mine, treasure and rare-ore gate');
 await vendor('mira');await page.locator('[data-tab="sell"]').click();for(let i=0;i<3;i++)await page.locator('[data-sell="relic"]').click();await page.locator('[data-tab="gear"]').click();const dagger=(await state()).life.gear.find(x=>x.type==='dagger');await page.locator('[data-sell-gear="'+dagger.uid+'"]').click();assert.equal((await state()).life.gear.some(x=>x.uid===dagger.uid),false);
 await page.locator('[data-tab="orders"]').click();await page.click('#order-action');await page.click('#order-action');await page.locator('.close').click();
 await vendor('smith');await page.locator('[data-tab="orders"]').click();await page.click('#order-action');await page.click('#order-action');assert.ok((await state()).life.unlocked.includes('silver'));await page.locator('.close').click();
 for(const id of ['plot0','plot1','plot2','plot3']){await walk(id);await key();await page.click('#till');await finish();await key();await page.locator('[data-plant="wheat"]').click();await page.click('#water');await page.locator('.close').click();}await tick(76);
 for(const id of ['plot0','plot1','plot2','plot3']){await walk(id);await key();await page.click('#harvest');await page.locator('.close').click();}assert.ok((await state()).inventory.wheat>=12);
 await walk('plot0');await key();await page.locator('[data-plant="carrot"]').click();await page.click('#water');await page.locator('.close').click();
 await walk('river-fish');await key();await finish();assert.ok((await state()).inventory.fish+(await state()).inventory.rareFish>=1);
 await walk('mushroom0');await key();await finish();const herb=await page.evaluate(()=>window.__eldermere.game.world.objects.find(o=>o.type==='herb'&&!window.__eldermere.game.life.depleted(o)).id);await walk(herb);await key();await process('cookfire','grilledFish');assert.equal((await state()).inventory.grilledFish,1);
 await page.screenshot({path:new URL('../test-results/life-farm.png',import.meta.url).pathname});console.log('PASS real plot cultivation, crop harvesting, fishing, forage and cooking');
 await vendor('mira');await page.locator('[data-tab="sell"]').click();for(let i=0;i<12;i++)await page.locator('[data-sell="wheat"]').click();await page.locator('[data-sell="grilledFish"]').click();await page.locator('.close').click();
 await page.keyboard.press('i');await page.click('#inventory-gear');await page.locator('[data-equip="'+sword.uid+'"]').click();await page.locator('.close').click();await vendor('mira');await page.locator('[data-tab="gear"]').click();await page.locator('[data-sell-gear="'+sword.uid+'"]').click();await page.locator('.close').click();
 console.log('Earned gold before housing:',(await state()).gold);assert.ok((await state()).gold>=180);
 await walk('home-door');await key();await page.click('#buy-home');await page.click('#enter-home');assert.equal((await state()).map,'home');
 async function place(type,x,y){await page.keyboard.press('b');await page.click('#life-home');await page.locator('[data-place="'+type+'"]').click();await page.waitForTimeout(300);const pos=await page.evaluate(([x,y])=>{const r=window.__eldermere.render,b=document.querySelector('#world').getBoundingClientRect();return{x:b.left+(x-r.left)/r.width*b.width,y:b.top+(y-r.top)/r.height*b.height};},[x,y]);await page.mouse.click(pos.x,pos.y);assert.ok((await state()).life.home.items.some(o=>o.type===type),'Failed placement '+type);}
 await place('chest',112,144);await walk('home-0');await key();const wood=(await state()).inventory.wood;await page.locator('[data-deposit="wood"]').click();assert.equal((await state()).inventory.wood,wood-1);await page.locator('[data-withdraw="wood"]').click();assert.equal((await state()).inventory.wood,wood);await page.locator('.close').click();
 if((await state()).gold<55){await walk('home-exit');await key();await vendor('mira');await page.locator('[data-tab="sell"]').click();for(const id of ['pelt','gel','mushroom','apple','coal'])while((await state()).gold<60&&(await state()).inventory[id]>0)await page.locator('[data-sell="'+id+'"]').click();await page.locator('.close').click();await walk('home-door');await key();await page.click('#enter-home');}
 await place('bench',352,144);await place('furnace',352,240);await page.screenshot({path:new URL('../test-results/life-home.png',import.meta.url).pathname});
 const before=await state();await page.click('#save-button');await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);const after=await state();assert.equal(after.map,'home');for(const key of ['home','skills','nodes'])assert.deepEqual(after.life[key],before.life[key]);for(const [id,p]of Object.entries(before.life.plots)){assert.equal(after.life.plots[id].crop,p.crop);assert.ok(after.life.plots[id].growth>=p.growth&&after.life.plots[id].growth<p.growth+.5);}assert.equal(after.gold,before.gold);
 assert.deepEqual(errors,[]);console.log('PASS earned housing, clickable in-world facilities, storage and persistence; no resource/XP/gold/position grants');
}catch(error){console.log('FAIL STATE',JSON.stringify(await state()).slice(0,2400));await page.screenshot({path:new URL('../test-results/life-failure.png',import.meta.url).pathname});throw error;}finally{await browser.close();}
