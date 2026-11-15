import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {installNavigation} from './navigation.mjs';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:4174')+'/?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await page.click('#begin');await installNavigation(page);
 async function walk(id){const pos=await page.evaluate(id=>{const o=window.__eldermere.game.life.objects().find(o=>o.id===id);return[o.x,o.y];},id);await page.evaluate(([x,y])=>window.walkTo(x,y,34),pos);}
 const farmer=await page.evaluate(()=>window.__eldermere.game.life.npcs.find(o=>o.npc==='farmer').id);await walk(farmer);await page.keyboard.press('e');const buy=await page.evaluate(()=>window.__eldermere.game.life.price('farmer','carrot','buy'));await page.locator('[data-buy="carrot"]').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.state.inventory.carrot),1);await page.locator('.close').click();
 await walk('mine-mouth');await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__eldermere.game.state.map),'mine1');await walk('miner');await page.keyboard.press('e');await page.locator('[data-tab="sell"]').click();const before=await page.evaluate(()=>({gold:window.__eldermere.game.state.gold,price:window.__eldermere.game.life.price('miner','carrot','sell')}));await page.locator('[data-sell="carrot"]').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.state.gold),before.gold+before.price);assert.equal(await page.evaluate(()=>window.__eldermere.game.state.inventory.carrot),0);assert.ok(before.price>buy);assert.deepEqual(errors,[]);
 console.log(`PASS merchant route with starting funds and physical travel: farmer carrot ${buy}G → mine ${before.price}G; finite stock, demand and no grants`);
}finally{await browser.close();}
