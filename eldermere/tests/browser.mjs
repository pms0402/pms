import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=process.env.BASE_URL||'http://127.0.0.1:4174';
await mkdir(new URL('../test-results/',import.meta.url),{recursive:true});
try{
 await page.goto(base+'/?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);
 await page.evaluate(()=>localStorage.setItem('voidrun.test-preserve','untouched'));
 await page.click('#begin');const y=await page.evaluate(()=>window.__eldermere.game.p.y);await page.keyboard.down('s');await page.waitForTimeout(220);await page.keyboard.up('s');assert.ok(await page.evaluate(y=>window.__eldermere.game.p.y>y+7,y));
 await page.keyboard.press('Space');assert.ok(await page.evaluate(()=>window.__eldermere.game.p.stamina<90));
 await page.waitForTimeout(300);
 console.log('PASS real keyboard movement and stamina-consuming dodge');
 // Deterministic navigation fixture runs the real simulation and its solid-world queries.
 // It never teleports, grants materials or damages enemies directly.
 await page.evaluate(()=>{window.walkTo=(tx,ty,range=25)=>{const {game:g}=window.__eldermere;if(g.paused)throw Error('Navigation while paused');const w=g.state.map==='dungeon'?640:1920,h=g.state.map==='dungeon'?512:1440,S=8,cols=w/S,rows=h/S;
 const sx=Math.round(g.p.x/S),sy=Math.round(g.p.y/S),start=sy*cols+sx;const queue=[start],parents=new Int32Array(cols*rows).fill(-2);parents[start]=-1;let found=-1;const wanted=g.state.map==='overworld'?g.world.objects.find(o=>o.x===tx&&o.y===ty&&o.interact):null;const interactables=g.world.objects.filter(o=>o.interact&&!(o.resource&&g.state.harvested[o.id]?.until>g.state.time));
 for(let i=0;i<queue.length;i++){const node=queue[i],x=node%cols,y=Math.floor(node/cols);if(Math.hypot(x*S-tx,y*S-ty)<=range&&!g.solid(x*S,y*S,8)&&(!wanted||interactables.every(o=>o===wanted||Math.hypot(o.x-x*S,o.y-y*S)>Math.hypot(tx-x*S,ty-y*S)))){found=node;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,n=ny*cols+nx;if(nx<1||ny<1||nx>=cols-1||ny>=rows-1||parents[n]!==-2||g.solid(nx*S,ny*S,9))continue;parents[n]=node;queue.push(n);}}
 if(found<0)throw Error('No connected route to '+tx+','+ty);const route=[];for(let n=found;n>=0;n=parents[n])route.push([n%cols*S,Math.floor(n/cols)*S]);route.reverse();
 for(const [x,y]of route){for(let i=0;i<30&&Math.hypot(g.p.x-x,g.p.y-y)>2;i++){let dx=x-g.p.x,dy=y-g.p.y;g.update(.02,{right:dx>1,left:dx<-1,down:dy>1,up:dy<-1});if(g.p.hp<g.maxHp-35)g.use();for(const e of g.enemies)if(Math.hypot(e.x-g.p.x,e.y-g.p.y)<45)g.strike(Math.atan2(e.y-g.p.y,e.x-g.p.x));}if(Math.hypot(g.p.x-x,g.p.y-y)>8)throw Error('Blocked route at '+x+','+y);}
 if(Math.hypot(g.p.x-tx,g.p.y-ty)>range+5)throw Error('Route did not reach target');};});
 const walk=async(x,y,r=28)=>page.evaluate(([x,y,r])=>window.walkTo(x,y,r),[x,y,r]);
 await walk(700,604);await page.keyboard.press('e');await page.locator('#quest-action').click();await page.locator('#dialog-done').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.state.quest),1);
 console.log('PASS NPC conversation and quest acceptance');
 for(const [x,y]of[[360,690],[300,480]]){await walk(x,y,28);for(let i=0;i<3;i++){await page.keyboard.press('e');await page.evaluate(()=>{const g=window.__eldermere.game;for(let i=0;i<21;i++)g.update(.02,{});});}}
 assert.equal(await page.evaluate(()=>window.__eldermere.game.state.inventory.wood),6);
 for(const [x,y]of[[896,740],[924,765]]){await walk(x,y,29);for(let i=0;i<2;i++){await page.keyboard.press('e');await page.evaluate(()=>{const g=window.__eldermere.game;for(let i=0;i<21;i++)g.update(.02,{});});}}
 assert.equal(await page.evaluate(()=>window.__eldermere.game.state.inventory.ore),4);
 await walk(782,641,34);await page.keyboard.press('e');await page.locator('[data-craft="sword"]').click();await page.locator('.close').click();assert.deepEqual(await page.evaluate(()=>{const g=window.__eldermere.game;return[g.state.inventory.wood,g.state.inventory.ore,g.state.inventory.sword,g.damage,g.state.quest];}),[0,0,1,27,2]);
 console.log('PASS connected-world harvesting and exact-cost bench crafting');
 await walk(456,610);await page.keyboard.press('e');await page.click('#dialog-trade');const gold=await page.evaluate(()=>window.__eldermere.game.state.gold);const foodPrice=await page.evaluate(()=>window.__eldermere.game.life.price('mira','food','buy'));await page.locator('[data-buy="food"]').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.state.gold),gold-foodPrice);await page.locator('.close').click();
 await walk(734,756);await page.keyboard.press('e');await walk(847,737);await page.keyboard.press('e');await page.keyboard.press('c');await page.locator('[data-craft="potion"]').click();await page.locator('.close').click();
 console.log('PASS shop purchase and field potion crafting');
 await walk(620,568,32);await page.keyboard.press('e');
 await walk(1225,680);await walk(1490,305,8);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__eldermere.game.state.map),'dungeon');
 await page.screenshot({path:new URL('../test-results/dungeon.png',import.meta.url).pathname});
 // Fight using the same directional strike, collision, attack timing and AI as player input.
 const result=await page.evaluate(()=>{const {game:g}=window.__eldermere;let sawWindup=false,avoided=false;for(let i=0;i<2600;i++){const boss=g.enemies.find(e=>e.id==='guardian');if(!boss)break;const dx=boss.x-g.p.x,dy=boss.y-g.p.y,d=Math.hypot(dx,dy);let input={};if(d>39)input={right:dx>4,left:dx<-4,down:dy>4,up:dy<-4};if(boss.windup>0){sawWindup=true;if(g.p.stamina>=30){g.dash({right:dx<0,left:dx>0,down:dy<0,up:dy>0});avoided=true;}}if(d<53)g.strike(Math.atan2(dy,dx));if(g.p.hp<g.maxHp-35)g.use();g.update(.02,input);}return{dead:g.world.enemies.find(e=>e.id==='guardian').dead,crystal:g.state.inventory.crystal,sawWindup,avoided,map:g.state.map,hp:g.p.hp};});
 assert.ok(result.dead,JSON.stringify(result));assert.equal(result.crystal,1);assert.ok(result.sawWindup);assert.ok(result.avoided);assert.equal(result.map,'dungeon');
 console.log('PASS guardian telegraph, timed strikes, dodge and crystal reward');
 await walk(320,439);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__eldermere.game.state.map),'overworld');await walk(700,604);await page.keyboard.press('e');await page.locator('#quest-action').click();await page.locator('#dialog-done').click();assert.equal(await page.evaluate(()=>window.__eldermere.game.state.quest),4);
 await walk(620,664);await page.click('#save-button');const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('eldermere.save.v1')));assert.equal(saved.quest,4);assert.ok(saved.player.level>1);await page.reload();await page.waitForFunction(()=>window.__eldermere?.game.frames>2);assert.equal(await page.evaluate(()=>window.__eldermere.game.state.quest),4);assert.equal(await page.evaluate(()=>localStorage.getItem('voidrun.test-preserve')),'untouched');
 console.log('PASS complete quest reward, level growth, persistence and VOIDRUN isolation');
 await page.keyboard.press('Escape');const time=await page.evaluate(()=>window.__eldermere.game.state.time);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.__eldermere.game.state.time),time);await page.locator('#resume').click();await page.keyboard.press('i');assert.ok(await page.locator('.item-grid').isVisible());await page.keyboard.press('Escape');await page.keyboard.press('m');assert.ok(await page.locator('#large-map').isVisible());await page.screenshot({path:new URL('../test-results/map.png',import.meta.url).pathname});await page.keyboard.press('Escape');
 await page.waitForTimeout(2400);await page.screenshot({path:new URL('../test-results/village.png',import.meta.url).pathname});
 await page.evaluate(()=>{const g=window.__eldermere.game;g.state.time=350;});await page.waitForTimeout(180);await page.screenshot({path:new URL('../test-results/night.png',import.meta.url).pathname});
 const png=await page.evaluate(()=>window.__eldermere.makeAtlas().toDataURL().split(',')[1]);await writeFile(new URL('../assets/sprites-preview.png',import.meta.url),Buffer.from(png,'base64'));
 await page.setViewportSize({width:900,height:700});await page.waitForTimeout(200);assert.ok(await page.locator('#pause').isVisible());await page.screenshot({path:new URL('../test-results/compact.png',import.meta.url).pathname});
 const defense=await page.evaluate(()=>{const g=window.__eldermere.game;g.paused=false;g.invulnerable=0;g.p.stamina=100;const before=g.p.hp;g.dash({right:true});g.hurt(20,{x:g.p.x-20,y:g.p.y});const immune=g.p.hp===before;g.dashTime=0;g.invulnerable=0;g.p.hp=1;const gold=g.state.gold;g.hurt(20,{x:g.p.x-20,y:g.p.y});return{immune,hp:g.p.hp,max:g.maxHp,gold:g.state.gold,expectedGold:Math.max(0,gold-10),map:g.state.map,x:g.p.x,y:g.p.y};});
 assert.ok(defense.immune);assert.equal(defense.hp,defense.max);assert.equal(defense.gold,defense.expectedGold);assert.equal(defense.map,'overworld');assert.equal(defense.x,620);assert.equal(defense.y,664);console.log('PASS dodge invulnerability and lethal-damage village recovery');
 const badContext=await browser.newContext();const badPage=await badContext.newPage();await badPage.addInitScript(()=>localStorage.setItem('eldermere.save.v1','{broken'));await badPage.goto(base+'/?test=1');await badPage.waitForFunction(()=>window.__eldermere?.game.frames>2);assert.ok(await badPage.evaluate(()=>window.__eldermere.game.loadError));await badPage.click('#begin');assert.equal(await badPage.evaluate(()=>JSON.parse(localStorage.getItem('eldermere.save.v1')).version),2);await badContext.close();console.log('PASS corrupt-save recovery without browser crash');
 assert.deepEqual(errors,[]);console.log('PASS pause, inventory, world map, night lighting, compact layout and no browser exceptions');
}finally{await browser.close();}
