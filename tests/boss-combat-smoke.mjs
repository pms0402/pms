import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const p=await browser.newPage({viewport:{width:1280,height:900}});p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.BASE_URL||'http://127.0.0.1:5302');await p.waitForFunction(()=>window.__game?.artReady);await p.locator('#start-button').click();
 for(const id of ['warden','artillery','plague','brood','storm','reaper','king','observer','primordial']){
  const result=await p.evaluate(id=>{
   const g=window.__game;cancelAnimationFrame(g.raf);g.start();g.spawnTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e9;g._state.xpNeeded=1e15;g.stats.critChance=0;g.stats.relics=[];g.stats.spells={};g.invulnerable=1e9;
   if(['king','observer','primordial'].includes(id)){const can=g.story.canBoss;g.story.canBoss=()=>true;g.sideAreas.enter(id);g.story.canBoss=can;}else{g._state.stage=({warden:1,artillery:2,plague:3,brood:4,storm:5,reaper:6})[id];g.spawnBoss();}
   g.bossArena.skip();const b=g.boss;b.hp=b.maxHp=1000;const d=g.player.position.clone().set(0,0,1);
   const hit=n=>g.hitEnemy(b,n,d,'sword');hit(100);const guard=1000-b.hp;
   b.recoveryTime=1;b.chainRemaining=0;const previous=b.hp;hit(100);const opening=previous-b.hp;b.recoveryTime=0;
   const phases=[];for(const phase of [2,3]){hit(1e9);const hp=b.hp;const detected=b.combatPhase;hit(1e9);const blocked=b.hp===hp;g.updateBoss(b,.8);phases.push({detected,blocked,resumed:!(b.transitionTime>0),hp});}
   hit(1e9);return{id,guard,opening,phases,dead:b.hp<=0,won:g.bossArena.won,finite:g.player.position.toArray().every(Number.isFinite)};
  },id);
  assert.equal(result.guard,60,id+' guard');assert.equal(result.opening,125,id+' genuine opening');assert.deepEqual(result.phases.map(x=>x.detected),[2,3]);assert.ok(result.phases.every(x=>x.blocked&&x.resumed&&x.hp>0));assert.ok(result.dead&&result.won&&result.finite);console.log('PASS',id,'guard, opening, three actual phases, transition protection/release and victory');
 }
 const pickups=await p.evaluate(()=>{
  const g=window.__game;g.start();cancelAnimationFrame(g.raf);g.player.position.set(0,g.groundHeight(0,0),0);
  for(let i=0;i<200;i++)g.dropPickup(g.player.position.clone().set(25,g.groundHeight(25,0),0),'gold',1);
  let checks=0;const original=g.combatLineClear;g.combatLineClear=function(...args){checks++;return original.apply(this,args);};
  g.updatePickups(1/60);const distant=checks;g.dropPickup(g.player.position,'gold',1);const near=g.pickups.at(-1);near.mesh.position.copy(g.player.position);near.mesh.position.y+=.35;
  const before=g._state.gold;g.updatePickups(1/60);const collected=g._state.gold>before;g.combatLineClear=original;
  return{distant,checks,collected};
 });assert.equal(pickups.distant,0);assert.ok(pickups.checks>0&&pickups.collected);console.log('PASS 200 distant pickups skip wall scans while nearby gold still checks terrain and collects');
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
