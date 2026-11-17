// Focused expansion fixture supplies money/tools for all house tiers. The separate
// life-browser run earns the first house from real harvesting, crafting and sales.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {installNavigation} from './navigation.mjs';
import {installActivities} from './activities-fixture.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.stack));const base=process.env.BASE_URL||'http://127.0.0.1:4174';
const state=()=>page.evaluate(()=>window.__eldermere.game.state);
async function walk(id){const q=await page.evaluate(id=>{const o=window.__eldermere.game.life.objects().find(o=>o.id===id);if(!o)throw Error('Missing '+id);return[o.x,o.y];},id);await page.evaluate(([x,y])=>window.walkTo(x,y,30),q);}
async function finish(){await page.evaluate(()=>window.finishActivity());await page.waitForFunction(()=>document.querySelector('#activity-layer').hidden);}
async function enter(){await page.keyboard.press('e');}
try{
 await page.goto(base+'/?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await page.click('#begin');await installNavigation(page);await installActivities(page);
 const tree=await page.evaluate(()=>window.__eldermere.game.world.objects.find(o=>o.x===360&&o.y===690).id);await walk(tree);await enter();assert.equal((await state()).inventory.wood,11);assert.equal(await page.evaluate(()=>window.__eldermere.game.activities.busy),false);await finish();
 const herb=await page.evaluate(()=>window.__eldermere.game.world.objects.find(o=>o.resource==='herb').id);await walk(herb);await enter();await finish();assert.ok((await state()).inventory.herb>=5);
 // Production restores its reserved timer, never reopens a removed minigame.
 const herbBefore=(await state()).inventory.herb,potionsBefore=(await state()).inventory.potion;await page.keyboard.press('c');await page.locator('[data-craft="potion"]').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.activities.busy),false);await page.click('#save-button');await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await installNavigation(page);await installActivities(page);await finish();assert.equal((await state()).inventory.herb,herbBefore-2);assert.equal((await state()).inventory.potion,potionsBefore+2);await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);assert.equal((await state()).inventory.potion,potionsBefore+2);await installNavigation(page);await installActivities(page);
 await walk('surface-copper0');await enter();assert.equal(await page.evaluate(()=>window.__eldermere.game.activities.busy),false);await finish();assert.ok((await state()).inventory.copperOre>=6);
 await page.evaluate(()=>{const g=window.__eldermere.game;g.state.gold=5000;Object.assign(g.state.inventory,{plank:20,wood:30,ironBar:20,stone:30});});
 await walk('home-door');const housingGold=(await state()).gold;await enter();await page.click('[data-buy-home="cottage"]');await page.click('#enter-home');assert.equal((await state()).life.farmSize,8);
 await page.evaluate(()=>{const g=window.__eldermere.game;if(!g.life.place('chest',112,144))throw Error('Chest placement');g.life.travel('home',112,170);if(!g.life.transfer('wood',7,'deposit'))throw Error('Store wood');g.state.life.plots.plot0={tilled:true,crop:'carrot',growth:15,water:80};});
 const sizes=[];
 for(const [type,count]of [['farmhouse',16],['lodge',24],['estate',48]]){
  await page.keyboard.press('b');await page.click('#life-home');await page.locator('[data-buy-home="'+type+'"]').click();const s=await state();assert.equal(s.life.home.type,type);assert.equal(s.life.farmSize,count);assert.equal(s.life.home.storage.wood,7);assert.equal(s.life.home.items[0].x,112);assert.equal(s.life.plots.plot0.crop,'carrot');assert.equal(s.gold,housingGold-({farmhouse:500,lodge:1000,estate:2200})[type]-15);sizes.push(await page.evaluate(()=>({w:window.__eldermere.game.world.maps.home.width,h:window.__eldermere.game.world.maps.home.height})));await page.locator('.close').click();
 }
 assert.deepEqual(sizes,[{w:640,h:448},{w:768,h:528},{w:960,h:640}]);await page.waitForTimeout(300);await page.screenshot({path:'/workspace/pms/eldermere/test-results/estate-interior.png'});
 await walk('home-exit');await enter();assert.ok((await state()).player.x>1900);await walk('frontier-farm-sign');await enter();for(let i=0;i<4;i++)await page.click('#farm-expand');assert.equal((await state()).life.farmSize,64);assert.ok(await page.locator('#farm-expand').isDisabled());await page.locator('.close').click();
 await walk('plot63');await enter();await page.click('#till');await finish();await enter();await page.locator('[data-plant="carrot"]').click();await page.click('#water');await page.locator('.close').click();
 await page.evaluate(()=>{const g=window.__eldermere.game;g.state.rpg.clears=['guardian','emberlord','frostqueen'];g.p.level=7;g.state.life.tools.pick=3;g.state.inventory.coal=5;g.state.life.unlocked.push('silver','mythril');});
 for(const metal of ['copper','iron','silver','gold','mythril']){await walk('frontier-'+metal+'0');await enter();assert.equal(await page.evaluate(()=>window.__eldermere.game.activities.busy),false);await finish();assert.ok((await state()).inventory[metal+'Ore']>=6);}
 await walk('frontier-forge');await enter();await page.locator('[data-process="mythrilBar"]').click();await finish();assert.equal((await state()).inventory.mythrilBar,2);
 await walk('property-door');await enter();await page.screenshot({path:'/workspace/pms/eldermere/test-results/housing-catalog.png'});await page.click('#enter-home');await page.click('#save-button');const before=await state();await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);let s=await state();assert.equal(s.life.home.type,'estate');assert.equal(s.life.farmSize,64);assert.deepEqual(s.life.home,before.life.home);assert.ok(s.life.plots.plot63.crop==='carrot');assert.equal(s.inventory.mythrilBar,2);
 await page.setViewportSize({width:900,height:700});await page.keyboard.press('b');await page.click('#life-home');const box=await page.locator('#modal').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=900);await page.screenshot({path:'/workspace/pms/eldermere/test-results/housing-compact.png'});await page.locator('.close').click();
 assert.deepEqual(errors,[]);console.log('PASS automatic work without minigames, expanded connected world, all 5 frontier minerals, smelting, all 4 houses, real interior sizes, 64 usable plots, storage/crop migration and reload');
}finally{await browser.close();}
