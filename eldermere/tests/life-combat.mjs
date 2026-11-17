import {installActivities} from './activities-fixture.mjs';
// Focused late-game fixture: grants prerequisites so every combat family and rare material
// can be exercised without repeating hours of skill progression. Economic flow is tested separately.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto((process.env.BASE_URL||'http://127.0.0.1:4174')+'/?test=1');await page.waitForFunction(()=>window.__eldermere?.game.frames>2);await page.click('#begin');await installActivities(page);
 const results=await page.evaluate(async()=>{
  const {game:g}=window.__eldermere,{enemy}=await import('./src/world.js'),{validateSave}=await import('./src/data.js');
  g.world.enemies=[];g.state.gold=1000;g.state.rpg.clears=['guardian','emberlord','frostqueen'];g.p.level=7;for(const id of Object.keys(g.state.inventory))g.state.inventory[id]=100;for(const s of Object.values(g.state.life.skills)){s.level=5;s.xp=0;}g.state.life.unlocked=['basic','silver','mythril','feast'];
  const step=seconds=>{for(let i=0;i<seconds*50;i++)g.update(.02,{});};
  Object.assign(g.p,{x:780,y:680});
  for(const type of ['sword','greatsword','dagger','bow','staff','helmet','armor','gloves','boots']){if(!g.life.startRecipe('iron_'+type))throw Error('Cannot forge '+type);window.finishActivity();}
  const cases=[];
  for(const [type,distance]of [['sword',42],['greatsword',60],['dagger',26],['bow',150],['staff',140]]){
   g.state.map='overworld';Object.assign(g.p,{x:620,y:680,stamina:100,hp:100});g.projectiles=[];g.attack=null;g.attackCooldown=0;const gear=g.life.l.gear.find(x=>x.type===type);g.life.equip(gear.uid);const e=enemy('fixture-'+type,620+distance,680,'wolf');e.hp=e.maxHp=300;e.cooldown=999;g.world.enemies=[e];const hp=e.hp,stamina=g.p.stamina;g.strike(0);step(type==='bow'||type==='staff'?.7:.15);cases.push({type,damage:hp-e.hp,staminaSpent:stamina-g.p.stamina,projectile:g.life.profile().projectile||null});
  }
  // A wall stops the actual swept projectile before it can hit a target.
  g.attack=null;g.attackCooldown=0;g.projectiles=[];Object.assign(g.p,{x:425,y:600,stamina:100});g.life.equip(g.life.l.gear.find(x=>x.type==='bow').uid);const blocked=enemy('wall-test',425,500,'wolf');blocked.cooldown=999;g.world.enemies=[blocked];g.strike(-Math.PI/2);step(.6);const wallBlocked=blocked.hp===blocked.maxHp;
  // Armor changes real damage, not just the stats panel.
  for(const x of g.life.l.gear.filter(x=>x.slot!=='weapon'))g.life.equip(x.uid);g.invulnerable=0;g.p.hp=g.maxHp;const beforeHp=g.p.hp;g.hurt(30,{x:g.p.x-20,y:g.p.y});const armorDamage=beforeHp-g.p.hp,defense=g.life.defense();
  g.world.enemies=[];Object.assign(g.p,{x:780,y:680,stamina:100});g.state.map='overworld';for(const id of ['copperPick','ironPick','steelPick']){if(!g.life.startRecipe(id))throw Error('Tool recipe '+id);window.finishActivity();}
  const mined=[];for(const metal of ['silver','gold','mythril']){const o=g.world.lifeObjects.find(o=>o.metal===metal&&o.map==='mine2');g.life.travel('mine2',o.x-30,o.y);const prior=g.state.inventory[metal+'Ore'];if(!g.life.mine(o))throw Error('Rare node '+metal);window.finishActivity();mined.push({metal,qty:g.state.inventory[metal+'Ore']-prior,depleted:g.life.depleted(o)});}
  const o=g.world.lifeObjects.find(o=>o.id==='mythril0');g.life.travel('mine2',o.x-30,o.y+40);const nearMythril={x:g.p.x,y:g.p.y};
  // Resuming an incomplete job cannot duplicate outputs or refund a fabricated cost.
  g.life.travel('overworld',845,660);const prior=g.state.inventory.ironBar;if(!g.life.startRecipe('ironBar'))throw Error('No mid-job fixture');step(.2);const mid=JSON.parse(JSON.stringify(g.state)),validMid=!!mid.life.job&&validateSave(mid);g.activities.cancel();const canceled=g.state.inventory.ironBar===prior;
  g.state.life.home.owned=true;g.state.life.home.type='cottage';g.life.travel('home',240,300);const placed=g.life.place('chest',112,144)&&g.life.place('bench',352,144)&&g.life.place('furnace',352,240);const upgraded=g.life.upgradeFacility('furnace');g.life.movingIndex=0;g.life.placement='chest';const moved=g.life.place('chest',112,224);
  return {cases,wallBlocked,armorDamage,defense,mined,tool:g.state.life.tools.pick,validMid,canceled,placed,upgraded,moved,valid:validateSave(g.state)};
 });
 for(const c of results.cases)assert.ok(c.damage>0,JSON.stringify(c));assert.ok(results.wallBlocked);assert.ok(results.armorDamage<30);assert.ok(results.defense>0);assert.equal(results.tool,3);assert.ok(results.mined.every(m=>m.qty>0&&m.depleted));for(const key of ['validMid','canceled','placed','upgraded','moved','valid'])assert.ok(results[key],key+JSON.stringify(results));assert.deepEqual(errors,[]);
 console.log('PASS late-game fixture: 5 actual weapon attacks, ranged wall collision, armor mitigation, 3 tool tiers, rare veins, facility upgrade/reposition and valid in-progress save');
 const routine=await page.evaluate(()=>{const g=window.__eldermere.game;g.state.map='home';g.state.time=350;for(let i=0;i<500;i++)g.update(.04,{});const mira=g.life.npcs.find(o=>o.npc==='mira'),miner=g.life.npcs.find(o=>o.npc==='miner');const night={closed:!g.life.isOpen('mira'),distance:Math.hypot(mira.x-mira.home.x,mira.y-mira.home.y),minerMap:miner.map};g.state.time=600;for(let i=0;i<600;i++)g.update(.04,{});return {night,day:{open:g.life.isOpen('mira'),distance:Math.hypot(mira.x-mira.work.x,mira.y-mira.work.y),minerMap:miner.map}};});assert.ok(routine.night.closed);assert.ok(routine.night.distance<25,JSON.stringify(routine));assert.equal(routine.night.minerMap,'overworld');assert.ok(routine.day.open);assert.ok(routine.day.distance<25);assert.equal(routine.day.minerMap,'mine1');console.log('PASS NPC shop hours and physical day/night commute, including miner portal travel');
 await page.evaluate(()=>{const g=window.__eldermere.game;g.life.place('bed',112,144);g.life.place('rug',240,224);g.life.place('lamp',192,128);});await page.waitForTimeout(300);
 // Capture the original sprites used by the current build, rather than stock imagery.
 await page.screenshot({path:'/workspace/pms/eldermere/test-results/life-facilities.png'});
}finally{await browser.close();}
