import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
const base=process.env.ELDERMERE_URL||'http://127.0.0.1:4186/pms/eldermere/';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const errors=[];await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:960}});page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
 await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await page.click('#begin');const y=await page.evaluate(()=>window.__eldermere.game.p.y);await page.keyboard.down('s');await page.waitForTimeout(250);await page.keyboard.up('s');assert.ok(await page.evaluate(y=>window.__eldermere.game.p.y>y+8,y));await page.keyboard.press('b');await page.getByRole('heading',{name:'계곡에서 살아가는 법'}).waitFor();await page.keyboard.press('Escape');await page.keyboard.press('i');await page.locator('.item-grid').waitFor();await page.keyboard.press('Escape');await page.click('#save-button');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('eldermere.save.v1')));await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);assert.equal(await page.evaluate(()=>window.__eldermere.game.p.y),saved.player.y);assert.equal(await page.locator('#welcome').isVisible(),false);await page.screenshot({path:new URL('../test-results/website.png',import.meta.url).pathname});
 await page.setViewportSize({width:900,height:700});await page.waitForTimeout(150);assert.ok(await page.locator('#life-button').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
 const offline=await browser.newPage({viewport:{width:1440,height:960}});offline.on('pageerror',e=>errors.push(e.message));const network=[];offline.on('request',r=>{if(/^https?:/.test(r.url())&&r.resourceType()!=='document')network.push(r.url());});
 await offline.route('**/*',route=>route.request().resourceType()==='document'?route.continue():route.abort());await offline.goto(base+'ELDERMERE.html?test=1');await offline.waitForFunction(()=>window.__eldermere?.game.frames>2);await offline.context().setOffline(true);await offline.click('#begin');await offline.keyboard.press('i');await offline.locator('.item-grid').waitFor();assert.deepEqual(network,[]);assert.deepEqual(errors,[]);
 console.log('PASS nested game website, actual movement, life/inventory UI, save/reload, compact layout and self-contained offline HTML');
}finally{await browser.close();}
