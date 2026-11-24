import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {newProfile,restoreProfile,validProfile,CHECKPOINTS,SAVE_KEY} from '../src/data.js';
import {BOSS_ORDER,BOSS_DEFS,PATTERNS} from '../src/bosses.js';
import {mapX,chapterAtWorld,LEGACY_WORLD_WIDTH,WORLD_WIDTH} from '../src/layout.js';
import {gateActive,solids} from '../src/world.js';
import {ProximitySpeech} from '../src/speech.js';
import {bossImpactAt,bossPose} from '../src/boss-motion.js';
function fixture(){const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},g=new Game(storage);g.start();g.world.enemies=[];g.world.traps=[];Object.assign(g.profile.flags,{edran:'freed',marie:'freed',brag:'freed',leonel:'freed',arkein:'freed',echo:true,voice:true,forge:true,memory:true,dawn:true,sister:true});g.restoreEnemies();return{g,storage};}
function at(g,id){const o=g.world.objects.find(o=>o.id===id);assert.ok(o,id);Object.assign(g.p,{x:o.x,y:o.y,vx:0,vy:0,action:null});return o;}
const tick=(g,t,input={})=>{for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120,input);};

test('seven chapters append two full regions without moving any old checkpoint or end position',()=>{
 const g=new Game();assert.equal(LEGACY_WORLD_WIDTH,30600);assert.equal(WORLD_WIDTH,41800);assert.equal(mapX(22100),30300);assert.equal(CHECKPOINTS.find(c=>c.id==='throne').x,mapX(20420));assert.equal(g.world.bosses.length,7);
 assert.equal(chapterAtWorld(mapX(22400)),6);assert.equal(chapterAtWorld(mapX(27800)),7);assert.equal(g.world.objects.filter(o=>o.type==='ending').length,1);assert.equal(g.world.objects.find(o=>o.type==='ending').x,mapX(33300));
 assert.ok(g.world.enemies.filter(e=>e.rank===5).length>=6);assert.ok(g.world.enemies.filter(e=>e.rank===6).length>=6);assert.equal(CHECKPOINTS.filter(c=>c.chapter>=6).length,6);
});
test('all three old ending choices migrate as history; scarce supplies and coordinates never reset',()=>{
 for(const ending of [null,'today','night','dawn']){const p=newProfile();p.version=7;p.started=true;p.flags.ending=ending;Object.assign(p.flags,{edran:'freed',marie:'slain',brag:'freed',leonel:'freed',arkein:'freed',echo:true,dawn:true});p.position={x:mapX(22100),y:302};p.hp=23;p.flasks=0;p.marks=413;p.upgrade=4;p.level=6;p.talents=['edge'];p.loss={x:mapX(19800),y:302,marks:71};const before=structuredClone(p);assert.ok(validProfile(p));const restored=restoreProfile(p);assert.ok(restored);assert.equal(restored.version,10);for(const key of ['position','hp','flasks','marks','upgrade','level','talents','loss'])assert.deepEqual(restored[key],before[key]);assert.equal(restored.flags.ending,ending);assert.equal(restored.flags.legacyEnding,!!ending);assert.equal(restored.flags.neris,null);assert.equal(restored.flags.carillon,null);assert.deepEqual(restoreProfile(restored),restored);assert.deepEqual(p,before);}
 const invalid=newProfile();invalid.version=7;invalid.position.x=mapX(28000);assert.equal(validProfile(invalid),false);
});
test('late gates require the real king, water lock, lighthouse and tower devices',()=>{
 const{g}=fixture();assert.equal(gateActive(g,'royal-harbor'),false);g.profile.flags.arkein=null;assert.equal(gateActive(g,'royal-harbor'),true);g.profile.flags.arkein='freed';
 for(const[object,gate]of[['harbor-winch','harbor-lock'],['tower-resonator','tower-seal'],['tower-lens','tower-lens-gate']]){assert.equal(gateActive(g,gate),true);at(g,object);const hp=g.p.hp,flasks=g.profile.flasks;assert.ok(g.interact());assert.equal(gateActive(g,gate),false);const xp=g.profile.xp;assert.ok(g.interact());assert.equal(g.profile.xp,xp);assert.equal(g.p.hp,hp);assert.equal(g.profile.flasks,flasks);}
 assert.equal(gateActive(g,'sixth-bell'),true);g.profile.flags.neris='freed';assert.equal(gateActive(g,'sixth-bell'),false);
});
test('dock speech is one sided, accepts the request only nearby, disappears, and pays rescue once',()=>{
 const{g,storage}=fixture(),speech=new ProximitySpeech(g);assert.equal(g.acceptDockQuest(),false);at(g,'dockkeeper');let line=speech.update();assert.equal(line.npc.id,'dockkeeper');assert.equal(line.choice,null);g.clock+=30;assert.equal(speech.update().choice,'dock');assert.equal(g.paused,false);assert.ok(g.acceptDockQuest());assert.equal(g.acceptDockQuest(),false);g.p.x+=180;assert.equal(speech.update(),null);
 at(g,'stranded-worker');assert.equal(g.interact(),false);at(g,'harbor-winch');g.interact();at(g,'stranded-worker');const coins=g.profile.marks,points=g.profile.points,hp=g.p.hp;assert.ok(g.interact());assert.equal(g.profile.marks,coins+80);assert.equal(g.profile.points,points+1);assert.equal(g.profile.quests.dockkeeper,'done');assert.ok(g.interact());assert.equal(g.profile.marks,coins+80);assert.equal(g.p.hp,hp);assert.equal(new Game(storage).profile.flags.harborRescue,true);
});
test('new records and connection parts are physical, persistent, single rewards',()=>{
 const{g,storage}=fixture();for(const id of ['harborcache','towercache']){at(g,id);const coins=g.profile.marks;assert.ok(g.interact());assert.ok(g.profile.marks>coins);const earned=g.profile.marks;assert.equal(g.interact(),false);assert.equal(g.profile.marks,earned);}assert.equal(g.profile.flags.harborLog,true);
 at(g,'conductor-notes');g.interact();const xp=g.profile.xp;g.interact();assert.equal(g.profile.xp,xp);assert.equal(g.profile.flags.conductorNotes,true);const loaded=new Game(storage);assert.deepEqual(loaded.profile.opened,g.profile.opened);assert.equal(loaded.profile.flags.conductorNotes,true);
});
test('the tide ability reveals collidable return platforms and the last shard grants a third air jump',()=>{
 const{g}=fixture();g.echoTime=5;const platform=g.world.platforms.find(p=>p.tide);assert.equal(solids(g).includes(platform),false);Object.assign(g.profile.flags,{neris:'freed',tide:true});assert.equal(solids(g).includes(platform),true);Object.assign(g.p,{x:platform.x+45,y:platform.y-1,vy:550,grounded:false});g.update(1/120);assert.equal(g.p.y,platform.y);assert.equal(g.p.grounded,true);g.echoTime=0;assert.equal(solids(g).includes(platform),false);
 Object.assign(g.p,{x:mapX(28020),y:302,vx:0,vy:0,action:null});g.attachToFloor();g.press('jump');tick(g,.12,{jump:true});g.press('jump');tick(g,.08,{jump:true});assert.equal(g.p.jumps,2);g.press('jump');tick(g,.02,{jump:true});assert.equal(g.p.jumps,2);g.profile.flags.carillon='freed';g.profile.flags.resonance=true;g.press('jump');tick(g,.02,{jump:true});assert.equal(g.p.jumps,3);assert.ok(g.p.vy<0);g.press('jump');tick(g,.02,{jump:true});assert.equal(g.p.jumps,3);
});
test('new bosses have distinct designs and five readable attacks each, release at contact, save one shard',()=>{
 for(const id of ['neris','carillon']){const{g,storage}=fixture();if(id==='carillon')Object.assign(g.profile.flags,{neris:'freed',tide:true});const e=g.world.bosses.find(b=>b.id===id),d=BOSS_DEFS[id];g.world.boss=e;g.bossActive=true;g.profile.flags[d.clue]=true;assert.equal(new Set(d.patterns.flat()).size,5);
  for(const pattern of new Set(d.patterns.flat())){const a=PATTERNS[pattern];assert.ok(a.windup>=1.15&&a.recover>=1.55);Object.assign(e,{state:'attack',pattern,t:0,dir:-1,didHit:false,released:false});g.p.x=e.x-40;g.p.hp=g.maxHp;g.p.invulnerable=0;g.projectiles=[];g.updateBoss(bossImpactAt(pattern)-.001);assert.equal(g.p.hp,g.maxHp);g.updateBoss(.002);assert.equal(bossPose(e).role,'strike');if(a.range)assert.ok(g.p.hp<g.maxHp);if(a.wave)assert.equal(g.projectiles.length,2);}
  Object.assign(e,{hp:e.maxHp*.5,state:'idle'});g.updateBoss(.01);assert.equal(e.phase,2);assert.equal(e.state,'transition');Object.assign(e,{hp:30,state:'recover'});g.damageEnemy(e,30,1);assert.equal(e.state,'weakened');g.p.x=e.x-45;assert.ok(g.interact());assert.equal(g.profile.flags[id],'freed');assert.equal(g.profile.flags[d.ability],true);const money=g.profile.marks;assert.equal(g.clearBoss('slain'),false);assert.equal(g.profile.marks,money);assert.equal(new Game(storage).profile.flags[id],'freed');
 }
});
test('final choice requires the seventh boss and hidden ending requires all seven restorations and both townspeople',()=>{
 const{g,storage}=fixture();at(g,'seventh-bell');assert.equal(g.interact(),false);assert.equal(g.chooseEnding('night'),false);Object.assign(g.profile.flags,{neris:'freed',carillon:'freed',tide:true,resonance:true});assert.equal(g.chooseEnding('dawn'),false);Object.assign(g.profile.flags,{helped:true,harborRescue:true,conductorNotes:true,chronology:true});g.profile.quests={elma:'done',dockkeeper:'done'};g.profile.opened=['yard-cache','procession-cache','ash-cache','atlas-cache','tidecache','towercache'];assert.ok(g.hiddenEnding());assert.ok(g.chooseEnding('dawn'));const coins=g.profile.marks;assert.equal(g.chooseEnding('night'),false);assert.equal(g.profile.marks,coins);const loaded=new Game(storage);assert.equal(loaded.profile.flags.ending,'dawn');assert.equal(loaded.profile.flags.epilogue,true);
});
test('old endings remain immutable and receive an epilogue only at the new final bell',()=>{
 const{g,storage}=fixture();g.profile.flags.legacyEnding=true;g.profile.flags.ending='night';g.save();assert.ok(validProfile(JSON.parse(storage.getItem(SAVE_KEY))));at(g,'seventh-bell');assert.equal(g.interact(),false);Object.assign(g.profile.flags,{neris:'slain',carillon:'freed',tide:true,resonance:true});assert.ok(g.interact());assert.equal(g.profile.flags.epilogue,true);assert.equal(g.chooseEnding('today'),false);const loaded=new Game(storage);assert.equal(loaded.profile.flags.ending,'night');assert.equal(loaded.profile.flags.epilogue,true);
});
test('post-royal equipment caps use paid upgrades at later checkpoints without healing',()=>{
 const{g,storage}=fixture();at(g,'workshop-harbor');g.profile.marks=5000;g.p.hp=39;g.profile.flasks=0;g.profile.upgrade=6;g.profile.gear.grip=2;g.profile.gear.armor=3;assert.ok(g.purchase('weapon'));assert.equal(g.profile.upgrade,7);assert.equal(g.purchase('weapon'),false);assert.ok(g.purchase('grip'));assert.equal(g.profile.gear.grip,3);assert.equal(g.purchase('armor'),false);g.profile.flags.neris='freed';g.profile.flags.tide=true;assert.ok(g.purchase('weapon'));assert.ok(g.purchase('armor'));assert.equal(g.profile.upgrade,8);assert.equal(g.profile.gear.armor,4);assert.equal(g.p.hp,39);assert.equal(g.profile.flasks,0);assert.ok(validProfile(g.profile));assert.equal(new Game(storage).profile.gear.armor,4);
});
