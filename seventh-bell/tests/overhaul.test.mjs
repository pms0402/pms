import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {BOSS_DEFS} from '../src/bosses.js';
import {BOSS_ACTIONS,ACTION_SETS,selectBossAction} from '../src/boss-actions.js';
import {beginNativeBoss} from '../src/boss-runtime.js';
import {bossPose} from '../src/boss-motion.js';
import {SPECIES,CHAPTER_ENEMIES,makeSpecies,nativeEnemyPose} from '../src/enemy-species.js';
import {updateNativeEnemy,speciesDamage,speciesKilled} from '../src/enemy-ai.js';
import {worldBlade} from '../src/blade.js';
import {swordIntercept,prepareProjectile} from '../src/projectile-combat.js';
import {addField,updateFields,fieldActive,fieldTouches,dynamicSolids,clearArena,terrainAfterErase} from '../src/combat-fields.js';
import {solids,enemy,body,overlaps,moveBody,clearLine} from '../src/world.js';
import {newProfile,restoreProfile,validProfile,SAVE_KEY} from '../src/data.js';
import {ROUTE_GATES,ROUTE_KEYS,ROUTE_AREAS} from '../src/route-data.js';
import {updateRoutes,interactRoute,routeWallActive} from '../src/world-routes.js';
import {mapX} from '../src/layout.js';
function scene(id='edran'){
 const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 const g=new Game(storage);g.start();g.world.enemies=[];g.world.traps=[];Object.keys(g.profile.routes).forEach(k=>g.profile.routes[k]=true);
 const e=g.world.bosses.find(e=>e.id===id);g.world.boss=e;g.bossActive=true;Object.assign(g.p,{x:e.x-170,y:302,grounded:true,vx:0,vy:0,invulnerable:999,dir:1});return{g,e,data,storage};
}
function tick(g,t,input={}){for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120,input);}
function bossTick(g,t,observe=()=>{}){for(let i=0;i<Math.ceil(t*120);i++){g.clock+=1/120;g.updateBoss(1/120);updateFields(g,1/120);g.updateProjectiles(1/120);observe();}}
function smallScene(type,x=440,y=302){const{g}=scene();g.bossActive=false;g.world.sanctuaries=[];g.world.platforms=[{x:0,y:302,w:2000,h:500}];g.world.gates=[];g.world.routeWalls=[];g.world.waterPlatforms=[];g.world.movers=[];g.world.lift={x:2500,y:302,w:50,h:18,target:302};const e=makeSpecies(enemy('native-fixture','watchman',x,y),type);g.world.enemies=[e];Object.assign(g.p,{x:x-150,y:302});return{g,e};}

test('seven bosses have exactly doubled HP and 37 independently owned native actions',()=>{
 assert.deepEqual(['edran','marie','brag','leonel','arkein','neris','carillon'].map(id=>BOSS_DEFS[id].hp),[840,1240,1700,1960,2640,3080,3680]);assert.equal(Object.keys(BOSS_ACTIONS).length,37);
 for(const[id,phases]of Object.entries(ACTION_SETS)){assert.equal(phases[0].length,5);for(const a of new Set(phases.flat())){assert.equal(BOSS_ACTIONS[a].owner,id);for(const old of ['wave','shot','pillars','twice','speed'])assert.equal(old in BOSS_ACTIONS[a],false,a+' is not a legacy flag mixture');}}
});
test('all native actions wait through preparation, execute real effects, and reach a bounded opening',()=>{
 const reports=[];for(const[id,a]of Object.entries(BOSS_ACTIONS)){const{g,e}=scene(a.owner);e.phase=a.phase||1;beginNativeBoss(g,e,id);const hp=g.p.hp;
  bossTick(g,a.windup-.025);assert.equal(e.state,'windup',id);assert.equal(g.projectiles.length+g.combatFields.length+g.arenaPlatforms.length+g.arenaObstacles.length+g.arenaClones.length,0,id+' released during windup');assert.equal(g.p.hp,hp);
  let performed=false;bossTick(g,.04+a.active,()=>{performed||=!!(e.steel||g.projectiles.length||g.combatFields.length||g.arenaPlatforms.length||g.arenaObstacles.length||g.arenaClones.length||a.guard&&e.shielding);});assert.equal(e.state,'recover',id);assert.ok(performed,id+' must perform an action');
  assert.ok(e.t<a.recover,id+' has an opening');reports.push(id);
 }assert.equal(reports.length,37);
});
test('context selection restricts counters, anchors and late combos and is not round robin',()=>{
 const{g,e}=scene();e.cooldown=0;g.p.x=e.x-290;assert.equal(selectBossAction(g,e),'gateRush');e.queuedRiposte=true;g.p.x=e.x-60;assert.equal(selectBossAction(g,e),'gateCounter');
 const n=scene('neris');n.e.anchorOut=true;n.g.p.x=n.e.x-35;for(let i=0;i<12;i++){n.e.attackIndex=i;n.e.history=[selectBossAction(n.g,n.e)];assert.notEqual(selectBossAction(n.g,n.e),'ropeOrbit');}
 const k=scene('arkein');k.e.phase=2;k.e.hp=k.e.maxHp;assert.notEqual(selectBossAction(k.g,k.e),'royalFour');k.e.hp=100;k.g.p.x=k.e.x-110;k.e.history=['royalGuard','royalFirst'];assert.equal(selectBossAction(k.g,k.e),'royalFour');
});
test('shield reductions, hit-triggered counters and shieldless/cloakless phase art are real',()=>{
 const{g,e}=scene();beginNativeBoss(g,e,'gateShield');e.shielding=true;e.dir=-1;assert.equal(g.damageEnemy(e,100,1),undefined);assert.equal(e.hp,818);g.p.x=e.x+30;g.damageEnemy(e,100,-1);assert.equal(e.hp,718);
 for(const id of ['edran','arkein']){const s=scene(id);s.e.phase=2;for(const key of ACTION_SETS[id][1]){beginNativeBoss(s.g,s.e,key);assert.equal(bossPose(s.e).sheet,id==='edran'?'edran-unshielded':'arkein-uncloaked');}}
 const k=scene('arkein');k.g.p.x=k.e.x-40;beginNativeBoss(k.g,k.e,'royalGuard');bossTick(k.g,1.08);assert.equal(k.e.counterAt,undefined);const hp=k.e.hp;k.g.damageEnemy(k.e,100,1);assert.equal(k.e.hp,hp-15);assert.ok(k.e.counterAt-k.e.t>=.59);bossTick(k.g,.59);assert.ok(!k.e.events.has('riposte'));bossTick(k.g,.03);assert.ok(k.e.events.has('riposte'));
});
test('silence blocks Q only inside the active zone and voice steps are real colliders',()=>{
 const{g,e}=scene('marie');beginNativeBoss(g,e,'silentGround');bossTick(g,1.5);const f=g.combatFields[0];g.p.x=f.x+70;g.p.y=302;assert.ok(g.startAttack('skill'));g.p.action=null;g.skillCD=0;bossTick(g,1);assert.ok(g.p.silenced>0);const focus=g.p.stamina;assert.equal(g.startAttack('skill'),false);assert.equal(g.p.stamina,focus);g.p.x=f.x+f.w+60;bossTick(g,.2);assert.ok(g.startAttack('skill'));clearArena(g);beginNativeBoss(g,e,'voiceStairs');bossTick(g,1.7);assert.equal(g.arenaPlatforms.length,4);assert.ok(g.arenaPlatforms.every(p=>solids(g).includes(p)));const p=g.arenaPlatforms[2];Object.assign(g.p,{x:p.x+40,y:p.y-1,vy:100,vx:0});moveBody(g.p,.02,solids(g));assert.equal(g.p.y,p.y);assert.ok(g.p.grounded);
});
test('foundry coolant suppresses heat without healing and chain returns after its finite outbound journey',()=>{
 const{g,e}=scene('brag');beginNativeBoss(g,e,'overheat');bossTick(g,1.8);assert.ok(g.combatFields.some(f=>f.kind==='heat'));g.p.hp=47;const hp=e.hp;assert.ok(interactRoute(g,g.world.objects.find(o=>o.id==='arena-coolant')));assert.ok(!g.combatFields.some(f=>f.kind==='heat'));assert.equal(g.p.hp,47);assert.equal(e.hp,hp);assert.ok(e.cooledUntil>g.clock);assert.equal(e.stagger,1.25);beginNativeBoss(g,e,'chainCast');bossTick(g,1.5);assert.ok(g.projectiles.some(q=>q.tether));bossTick(g,5);assert.equal(g.projectiles.filter(q=>q.tether).length,0);assert.equal(e.anchorOut,false);
});
test('erased floors are warned, actually open, have a lower catch and restore',()=>{
 const{g,e}=scene('leonel');beginNativeBoss(g,e,'eraseSentence');bossTick(g,1.7);const f=g.combatFields.find(f=>f.kind==='erase'),x=f.x+55;const covered=()=>solids(g).some(p=>!p.oneway&&p.y===302&&p.x<x&&p.x+p.w>x);assert.ok(covered());assert.ok(!fieldActive(f));assert.ok(solids(g).some(p=>p.y===430&&p.x<x&&p.x+p.w>x));bossTick(g,1.3);assert.equal(covered(),false);bossTick(g,4.8);assert.ok(covered());
});
test('bookcases block movement and attacks from either side after their preparation',()=>{
 const{g,e}=scene('leonel');beginNativeBoss(g,e,'bookMaze');bossTick(g,1.75);const o=g.arenaObstacles[0];assert.ok(!solids(g).includes(o));bossTick(g,1.3);assert.ok(solids(g).includes(o));assert.equal(clearLine(g,o.x-20,260,o.x+o.w+20,260),false);assert.equal(clearLine(g,o.x+o.w+20,260,o.x-20,260),false);Object.assign(g.p,{x:o.x-12,y:302,vx:200,vy:0});moveBody(g.p,.2,solids(g));assert.ok(g.p.x<=o.x-g.p.w/2);
});
test('future records remain fixed and inversion telegraphs its real elevated destination',()=>{
 const{g,e}=scene('leonel');e.phase=2;beginNativeBoss(g,e,'futureRecord');const aim={...e.aim};g.p.x+=200;bossTick(g,1.6);const marks=g.combatFields.filter(f=>f.kind==='future');assert.equal(marks.length,2);assert.equal(marks[0].x,aim.x-32);assert.ok(marks[1].warning-marks[0].warning>=.8);clearArena(g);beginNativeBoss(g,e,'invertedPage');const destination={...e.destination},x=e.x;bossTick(g,1.45);assert.equal(e.x,x);bossTick(g,.23);assert.equal(e.x,destination.x);assert.equal(e.y,destination.y);assert.ok(e.teleportFade>0);assert.equal(e.state,'recover');assert.ok(g.arenaPlatforms.length>=4);
});
test('tide rises gradually below available solid platforms and the scanning lighthouse is blocked by cover',()=>{
 const{g,e}=scene('neris');beginNativeBoss(g,e,'risingTide');bossTick(g,2.05);const f=g.combatFields.find(f=>f.kind==='flood');assert.ok(f);assert.equal(g.arenaPlatforms.length,5);assert.ok(g.arenaPlatforms.every(p=>p.y<=257&&solids(g).includes(p)));const start=f.y;bossTick(g,1.8);assert.ok(f.y<start&&f.y>f.peak);const y=f.y;bossTick(g,.1);assert.ok(Math.abs(f.y-y)<4);clearArena(g);beginNativeBoss(g,e,'lighthouseAim');bossTick(g,2.05);const beam=g.combatFields[0];assert.ok(beam.scan);const end=beam.bx;bossTick(g,1.6);assert.notEqual(beam.bx,end);const cover=g.world.routeWalls.find(w=>w.owner==='neris');assert.equal(clearLine(g,cover.x-90,250,cover.x+70,250),false);
});
test('Neris rope is a moving tether, cannot be used while the anchor is out, and the tether expires',()=>{
 const{g,e}=scene('neris');beginNativeBoss(g,e,'ropeOrbit');bossTick(g,1.55);const f=g.combatFields.find(f=>f.kind==='ropeOrbit');assert.ok(f);const x=f.bx,y=f.by;bossTick(g,.15);assert.ok(Math.abs(f.bx-x)+Math.abs(f.by-y)>30);bossTick(g,.6);assert.ok(!g.combatFields.includes(f));g.p.x=e.x+340;beginNativeBoss(g,e,'anchorThrow');bossTick(g,1.5);assert.ok(e.anchorOut);beginNativeBoss(g,e,'ropeOrbit');bossTick(g,1.6);assert.ok(!g.combatFields.some(f=>f.kind==='ropeOrbit'));
});
test('recorded cuts replay the exact old steel and never target a new player position',()=>{
 const{g,e}=scene('carillon');e.phase=2;beginNativeBoss(g,e,'leftAttack');bossTick(g,1.6);const first=g.combatFields.find(f=>f.kind==='bladeEcho');assert.ok(first&&first.ghost);const old={ax:first.ax,ay:first.ay,bx:first.bx,by:first.by};bossTick(g,3);g.p.x=e.x+150;beginNativeBoss(g,e,'leftAttack');bossTick(g,1.6);const echoes=g.combatFields.filter(f=>f.kind==='bladeEcho');assert.equal(echoes.length,2);assert.deepEqual(Object.fromEntries(Object.keys(old).map(k=>[k,echoes[1][k]])),old);assert.ok(echoes.every(f=>f.warning>=1&&f.age<f.warning));assert.equal(echoes[1].warning,1.8);
});
test('clones require real hits, pay no XP or money, and only destruction of both exposes the boss',()=>{
 const{g,e}=scene('carillon');beginNativeBoss(g,e,'resonanceClones');bossTick(g,1.95);assert.equal(g.arenaClones.length,2);const xp=g.profile.xp,coins=g.profile.marks;for(const c of g.arenaClones){g.damageEnemy(c,999,1);assert.equal(c.hp,2);g.damageEnemy(c,999,1);g.damageEnemy(c,999,1);}updateFields(g,.01);assert.equal(g.arenaClones.length,0);assert.ok(e.stagger>=.95);assert.equal(g.profile.xp,xp);assert.equal(g.profile.marks,coins);
 const s=scene('carillon');beginNativeBoss(s.g,s.e,'resonanceClones');bossTick(s.g,1.95);for(const c of s.g.arenaClones)c.age=c.life;updateFields(s.g,.01);assert.equal(s.e.stagger,0,'expiry is not a kill reward');
});
test('rotating platforms carry the player and seven peals have seven separate beats with a long opening',()=>{
 const{g,e}=scene('carillon');beginNativeBoss(g,e,'gearRotation');bossTick(g,2.1);assert.equal(g.arenaPlatforms.length,4);const p=g.arenaPlatforms[0];Object.assign(g.p,{x:p.x+30,y:p.y,grounded:true,support:p});const dx=g.p.x-p.x,dy=g.p.y-p.y;updateFields(g,.1);assert.ok(Math.abs(g.p.x-p.x-dx)<.001);assert.ok(Math.abs(g.p.y-p.y-dy)<.001);clearArena(g);e.phase=2;e.hp=500;beginNativeBoss(g,e,'seventhPeal');assert.equal(e.pealInterval,.78);bossTick(g,BOSS_ACTIONS.seventhPeal.windup+BOSS_ACTIONS.seventhPeal.active+.01);assert.equal([...e.events].filter(k=>k.startsWith('peal')).length,7);assert.equal(e.state,'recover');assert.ok(BOSS_ACTIONS.seventhPeal.recover>=2.8);assert.ok(g.combatFields.filter(f=>f.damage>0).length<=4);
});

for(const kind of ['light1','light3'])for(const dir of [-1,1])for(const air of [false,true])test(`actual ${kind} steel cuts a fast ordinary projectile, direction ${dir}, air ${air}`,()=>{
 const{g}=smallScene('crossbow');g.p.x=300;g.p.y=air?240:302;g.p.grounded=!air;g.p.dir=dir;g.startAttack(kind);const a=g.p.action;a.t=(a.spec.windup+a.spec.end)/2;g.resolveAttack(a);const b=worldBlade(g.p);g.spawnShot(b.bx+dir*80,b.by,-dir*24000,0,20,'native-fixture','arrow',1000);const q=g.projectiles.at(-1);q.radius=4;q.destructible=true;const hp=g.p.hp,focus=g.p.stamina;g.updateProjectiles(1/120);assert.equal(q.destroyed,true);assert.equal(g.projectiles.includes(q),false);assert.equal(g.p.hp,hp);assert.equal(g.p.stamina,focus);assert.equal(g.projectileCuts,1);g.updateProjectiles(1/120);assert.equal(g.projectileCuts,1);assert.ok(g.effects.some(f=>f.kind==='projectileBreak'));
});
test('preparation, recovery, casting Q and boss projectiles cannot receive a free steel cancellation',()=>{
 for(const phase of ['preparation','recovery','skill','boss']){const{g}=smallScene('crossbow');g.p.x=300;g.p.invulnerable=0;g.startAttack(phase==='heavy'?'heavy':phase==='skill'?'skill':'light1');const a=g.p.action;a.t=phase==='preparation'?a.spec.windup-.01:phase==='recovery'?a.spec.end+.01:(a.spec.windup+a.spec.end)/2;g.spawnShot(380,275,-180,0,20,'native-fixture','arrow',500);const q=g.projectiles.at(-1);q.destructible=true;if(phase==='boss')q.source='boss';q.x=320;assert.equal(swordIntercept(g,q,380,275),false,phase);assert.equal(q.destroyed,undefined);}
});
test('a single active swing can damage a foe and break its shot without consuming either hit twice',()=>{
 const{g,e}=smallScene('crossbow');g.p.x=300;g.p.dir=1;e.x=330;e.y=302;g.startAttack('light1');const a=g.p.action;a.t=(a.spec.windup+a.spec.end)/2;g.resolveAttack(a);assert.ok(a.hit.has(e.id));const hp=e.hp,b=worldBlade(g.p);g.spawnShot(b.bx+55,b.by,-15000,0,20,e.id,'arrow',600);const q=g.projectiles.at(-1);q.destructible=true;g.updateProjectiles(.01);assert.ok(q.destroyed);g.resolveAttack(a);assert.equal(e.hp,hp);assert.equal(a.hit.size,1);
});
test('ordinary projectile hits the body when it reaches the player before any rear steel',()=>{
 const{g}=smallScene('crossbow');g.p.x=300;g.p.dir=1;g.p.invulnerable=0;g.startAttack('light1');const a=g.p.action;a.t=(a.spec.windup+a.spec.end)/2;g.resolveAttack(a);g.spawnShot(240,275,24000,0,20,'native-fixture','arrow',1000);const q=g.projectiles.at(-1);q.destructible=true;g.updateProjectiles(1/120);assert.equal(q.destroyed,undefined);assert.equal(g.p.hp,80);
});
test('all 21 species inhabit their own chapters with separate movement and combat pose groups',()=>{
 const g=new Game();assert.equal(Object.keys(SPECIES).length,21);assert.deepEqual(CHAPTER_ENEMIES.map(a=>a.length),Array(7).fill(3));for(const id of Object.keys(SPECIES)){const d=SPECIES[id],members=g.world.enemies.filter(e=>e.type===id);assert.ok(members.length,id);assert.ok(members.every(e=>e.rank===d.chapter-1&&e.maxHp===d.hp));const e=members[0];e.state='idle';e.stagger=0;assert.equal(nativeEnemyPose(e).gait,true);assert.notEqual(nativeEnemyPose(e).sheet,d.sheet);e.state='windup';assert.equal(nativeEnemyPose(e).row,d.slot*3+1);e.dead=true;assert.equal(nativeEnemyPose(e).row,d.slot*3+2);}assert.equal(g.world.enemies.filter(e=>['watchman','cantor','wisp'].includes(e.type)).length,0);
});
test('ranged species fire different finite projectiles; homing pearls turn slowly and remain breakable',()=>{
 for(const [id,kind,count] of [['crossbow','arrow',1],['choirghost','note',3],['paperghost','paperKnife',1],['royalmage','sunbolt',1],['harpooner','harpoon',1],['lanternwraith','lanternPearl',1],['resonator','resonance',3]]){const{g,e}=smallScene(id);e.cooldown=0;updateNativeEnemy(g,e,.01);assert.equal(e.state,'windup',id);Object.assign(e,{t:e.prep-.001});updateNativeEnemy(g,e,.002);assert.equal(g.projectiles.length,count,id);assert.ok(g.projectiles.every(q=>q.kind===kind&&q.destructible&&q.range<=430));if(id==='royalmage')assert.equal(g.combatFields.length,1);if(id==='harpooner'){assert.ok(e.cooldown<=0);updateNativeEnemy(g,e,.3);assert.ok(e.cooldown>=1.3);}if(id==='lanternwraith'){const q=g.projectiles[0],angle=Math.atan2(q.vy,q.vx);g.p.y-=130;prepareProjectile(g,q,.1);assert.ok(Math.abs(Math.atan2(Math.sin(Math.atan2(q.vy,q.vx)-angle),Math.cos(Math.atan2(q.vy,q.vx)-angle)))<=.056);}}
});
test('support chants accelerate nearby allies, low-health embers retreat, and disrupting a mage stops an uncast spell',()=>{
 const s=smallScene('devotee'),ally=makeSpecies(enemy('ally','watchman',s.e.x+50,302),'monk');s.g.world.enemies.push(ally);s.g.p.x=s.e.x-190;s.e.cooldown=0;updateNativeEnemy(s.g,s.e,.01);assert.equal(s.e.mode,'chant');updateNativeEnemy(s.g,s.e,s.e.prep+.01);assert.ok(ally.buffedUntil>s.g.clock);s.g.p.x=ally.x-40;ally.cooldown=0;updateNativeEnemy(s.g,ally,.01);assert.equal(ally.prep,SPECIES.monk.windup*.8);
 const f=smallScene('emberling');f.e.hp=20;f.e.cooldown=5;updateNativeEnemy(f.g,f.e,.01);assert.ok(f.e.retreatUntil>f.g.clock);assert.ok(f.e.vx>0);assert.ok(f.g.combatFields.some(f=>f.kind==='embers'));
 const m=smallScene('royalmage');m.e.cooldown=0;updateNativeEnemy(m.g,m.e,.01);m.g.damageEnemy(m.e,4,1);updateNativeEnemy(m.g,m.e,.1);assert.equal(m.g.projectiles.length,0);assert.equal(m.e.state,'recover');
});
test('shield direction and overhead ink vulnerability differ; a destroyed resonator destabilizes its neighbours',()=>{
 const s=smallScene('bookguard');s.e.shielding=true;s.e.dir=-1;assert.equal(speciesDamage(s.g,s.e,100,'light1'),22);s.g.p.x=s.e.x+10;assert.equal(speciesDamage(s.g,s.e,100,'light1'),100);s.g.p.x=s.e.x-10;assert.equal(speciesDamage(s.g,s.e,100,'heavy'),70);
 const i=smallScene('inkworm');i.g.p.y=i.e.y-40;assert.equal(speciesDamage(i.g,i.e,40,'light1'),60);i.g.p.y=i.e.y;assert.equal(speciesDamage(i.g,i.e,40,'light1'),40);
 const r=smallScene('resonator'),other=makeSpecies(enemy('other','wisp',r.e.x+60,280),'resonator');r.g.world.enemies.push(other);speciesKilled(r.g,r.e);assert.equal(other.unstableUntil,r.g.clock+2);updateNativeEnemy(r.g,other,.01);assert.equal(other.state,'recover');
});
test('new route state and moving-machine positions reload exactly without minting scarce supplies',()=>{
 const{g,storage}=scene();g.bossActive=false;g.profile.hp=g.p.hp=41;g.profile.flasks=0;g.profile.marks=213;g.profile.routes.towerGear=true;g.profile.routes.towerResonator=true;const m=g.world.movers.find(m=>m.id==='tower-upper');m.y=-712;m.target=-1000;m.phase=5.1;Object.assign(g.p,{x:m.x+65,y:m.y,grounded:true,support:m});g.save();assert.ok(validProfile(g.profile));const loaded=new Game(storage),restored=loaded.world.movers.find(m=>m.id===m.id&&m.id==='tower-upper');assert.equal(restored.y,-712);assert.equal(restored.target,-1000);assert.equal(loaded.p.y,-712);assert.equal(loaded.p.support,restored);assert.equal(loaded.p.hp,41);assert.equal(loaded.profile.flasks,0);assert.equal(loaded.profile.marks,213);assert.deepEqual(loaded.profile.routes,g.profile.routes);
});
test('v8 migration preserves outcomes/resources and only relocates a body colliding with a newly closed wall',()=>{
 const raw=newProfile();raw.version=8;raw.started=true;raw.tutorial.state='done';raw.hp=43;raw.flasks=1;raw.marks=321;raw.position={x:ROUTE_GATES[0].x+5,y:150};delete raw.routes;delete raw.machines;const p=restoreProfile(raw);assert.equal(p.version,12);assert.equal(p.hp,43);assert.equal(p.flasks,1);assert.equal(p.marks,321);const storage={getItem:()=>JSON.stringify(raw),setItem:()=>{}};const g=new Game(storage);assert.ok(g.migrationNotice);assert.equal(g.p.hp,43);assert.equal(g.profile.flasks,1);assert.equal(g.profile.marks,321);assert.equal(g.p.x,145);
 raw.position={x:500,y:302};const safe=new Game(storage);assert.equal(safe.p.x,500);assert.equal(safe.migrationNotice,undefined);
});
test('seven maps have distinct authored route areas, real route switches and high vertical tower geometry',()=>{
 const g=new Game();assert.equal(ROUTE_AREAS.length,21);assert.equal(g.world.movers.filter(m=>!m.journey).length,13);assert.ok(g.world.platforms.some(p=>p.y===-1000));assert.ok(g.world.movers.some(m=>Math.abs(m.top-m.bottom)>=700));assert.ok(g.world.movers.some(m=>m.periodic==='horizontal'));for(const gate of ROUTE_GATES){const o=g.world.objects.find(o=>o.key===gate.key);assert.ok(o,gate.key);assert.ok(g.world.gates.find(o=>o.key===gate.key));}assert.ok(g.world.objects.find(o=>o.id==='tower-lens').y===-1000);
});
test('harbor water changes actual lower-route collision, and floating supports follow its level',()=>{
 const{g}=scene('neris');g.bossActive=false;g.profile.routes.harborSluice=false;g.profile.flags.harborLock=false;const gate=g.world.routeWalls.find(w=>w.water);updateRoutes(g,.01);assert.ok(routeWallActive(g,gate));assert.ok(solids(g).includes(gate));const floating=g.world.waterPlatforms[0];Object.assign(g.p,{grounded:true,support:floating,x:floating.x+30,y:floating.y});g.profile.routes.harborSluice=true;updateRoutes(g,.01);assert.equal(routeWallActive(g,gate),false);assert.ok(!solids(g).includes(gate));assert.equal(floating.y,466);assert.equal(g.p.y,floating.y);
});

test('projectile CCD respects an earlier blade/body contact even with a wall farther along the same tick',()=>{
 for(const wallFirst of [false,true]){const{g}=smallScene('crossbow');g.p.x=300;g.p.dir=1;g.startAttack('light1');const a=g.p.action;a.t=(a.spec.windup+a.spec.end)/2;g.resolveAttack(a);const b=worldBlade(g.p);g.world.platforms.push({x:wallFirst?b.bx+25:240,y:180,w:8,h:122});g.spawnShot(b.bx+70,b.by,-24000,0,20,'native-fixture','arrow',1000);const q=g.projectiles.at(-1);q.destructible=true;g.updateProjectiles(1/120);assert.equal(!!q.destroyed,!wallFirst);assert.equal(g.p.hp,100);}
});
test('parrying a native slam cancels its attached floor hazard and preserves the real opening',()=>{
 for(const[id,pattern,at]of [['edran','gateRift',.18],['brag','anvilStrike',.18],['carillon','leftAttack',.08]]){const{g,e}=scene(id);g.p.invulnerable=0;g.p.x=e.x-30;g.p.dir=1;beginNativeBoss(g,e,pattern);Object.assign(e,{state:'attack',t:at-.001});g.parry();g.p.action.t=.08;g.updateBoss(.002);assert.equal(e.state,'recover',id);assert.equal(e.stagger,1.35,id);assert.equal(g.combatFields.length,0,id);assert.ok(g.p.counterReady>0);}
});


test('restoring an erased floor waits for a player in the hole and the renderer shares the split terrain',()=>{const{g}=scene('leonel'),f=addField(g,{kind:'erase',x:22520,y:302,w:110,h:10,warning:1,duration:1});f.age=1.5;const base=g.world.platforms,center=f.x+55;assert.ok(!terrainAfterErase(g,base).some(p=>!p.oneway&&p.y===302&&p.x<center&&p.x+p.w>center));Object.assign(g.p,{x:center,y:430});updateFields(g,1);assert.ok(g.combatFields.includes(f));g.p.x=f.x+f.w+30;updateFields(g,.1);assert.ok(!g.combatFields.includes(f));assert.ok(terrainAfterErase(g,base).some(p=>!p.oneway&&p.y===302&&p.x<center&&p.x+p.w>center));});
test('the tower has three real gear platforms and carries a standing rider around their shared axle',()=>{const{g}=scene('carillon'),m=g.world.movers.find(m=>m.id==='tower-gear-a');updateRoutes(g,.01);Object.assign(g.p,{x:m.x+40,y:m.y,grounded:true,support:m});const dx=g.p.x-m.x,dy=g.p.y-m.y,old=m.y;updateRoutes(g,.2);assert.notEqual(m.y,old);assert.ok(solids(g).includes(m));assert.ok(Math.abs(g.p.x-m.x-dx)<.001);assert.ok(Math.abs(g.p.y-m.y-dy)<.001);});

test('the final seven-beat sequence cannot overlap living clones or an unfinished damaging echo',()=>{const{g,e}=scene('carillon');e.phase=2;e.hp=200;g.p.x=e.x-220;e.history=['bellVibration','leftAttack'];g.arenaClones=[{hp:3}];assert.notEqual(selectBossAction(g,e),'seventhPeal');g.arenaClones=[];addField(g,{owner:e.id,kind:'bladeEcho',damage:40});assert.notEqual(selectBossAction(g,e),'seventhPeal');g.combatFields=[];assert.equal(selectBossAction(g,e),'seventhPeal');});

test('support and resonance cooperation have real neighbours on the authored paths',()=>{const g=new Game(),devotee=g.world.enemies.find(e=>e.type==='devotee');assert.ok(g.world.enemies.some(e=>e.type==='monk'&&Math.hypot(e.x-devotee.x,e.y-devotee.y)<230));const floaters=g.world.enemies.filter(e=>e.type==='resonator');assert.ok(floaters.length>=2);assert.ok(Math.hypot(floaters[0].x-floaters[1].x,floaters[0].y-floaters[1].y)<350);});

test('native melee species complete their different committed combo rhythms and leave recovery',()=>{for(const id of ['patrol','worker','royalguard','spearman','shaftpuppet','echocopy']){const{g,e}=smallScene(id);g.p.x=e.x-35;e.cooldown=0;const beats=[];const hurt=g.hurt.bind(g);g.hurt=(n,source)=>{beats.push(e.beat);return hurt(n,source);};let began=false;for(let i=0;i<1000;i++){g.clock+=1/120;updateNativeEnemy(g,e,1/120);if(e.state==='attack')began=true;if(began&&e.state==='recover')break;}assert.equal(e.state,'recover',id);assert.deepEqual(beats,Array.from({length:SPECIES[id].combo},(_,i)=>i),id);assert.equal(e.shielding,false,id);}});
test('a native ore cart commits to its warning direction and staggers on the actual wall',()=>{const{g,e}=smallScene('orecart');g.p.x=480;e.cooldown=0;updateNativeEnemy(g,e,.01);assert.equal(e.dir,1);g.world.platforms.push({x:500,y:200,w:30,h:102});g.p.x=550;for(let i=0;i<230&&e.stagger===0;i++){g.clock+=1/120;updateNativeEnemy(g,e,1/120);}assert.ok(e.stagger>=1);assert.equal(e.state,'recover');assert.ok(e.x>450,'the cart must actually charge before hitting the wall');assert.ok(e.x+e.w/2<=500.1);});
test('native ravens dive into mutual melee reach and ink worms climb real low-pit walls',()=>{const s=smallScene('raven',440,220);s.g.p.x=500;s.g.p.invulnerable=0;s.e.cooldown=0;tick(s.g,1.95);assert.ok(s.g.p.hp<100);assert.ok(Math.abs(s.e.y-s.g.p.y)<55);
 const i=smallScene('inkworm',475,430);i.g.world.platforms=[{x:0,y:430,w:500,h:500},{x:500,y:302,w:500,h:628}];i.g.p.x=550;i.e.cooldown=0;for(let n=0;n<520;n++){i.g.clock+=1/120;updateNativeEnemy(i.g,i.e,1/120);}assert.ok(i.e.y<=305);assert.ok(i.e.x>500);});

test('replayed training isolates and restores native combat fields and moving combat supports',()=>{const{g}=scene();g.bossActive=false;g.profile.tutorial.state='done';g.p.x=190;const field=addField(g,{owner:'old-ink',kind:'ink',x:300,y:295,w:30,h:7,damage:15});g.arenaPlatforms=[{id:'held-platform',x:250,y:210,w:100,h:18,age:3,life:10}];const fields=g.combatFields,platforms=g.arenaPlatforms;assert.ok(g.beginTutorial());assert.deepEqual(g.combatFields,[]);assert.deepEqual(g.arenaPlatforms,[]);assert.ok(g.finishTutorial(true));assert.equal(g.combatFields,fields);assert.equal(g.combatFields[0],field);assert.equal(g.arenaPlatforms,platforms);assert.equal(g.arenaPlatforms[0].age,3);});

test('a descending lift takes its rider through the starting one-way landing instead of leaving them behind',()=>{const{g}=scene('carillon');g.bossActive=false;const m=g.world.movers.find(m=>m.id==='tower-return');m.y=-1000;m.target=302;Object.assign(g.p,{x:m.x+m.w/2,y:m.y,grounded:true,support:m,vx:0,vy:0});tick(g,.25);assert.equal(g.p.support,m);assert.equal(g.p.y,m.y);assert.ok(g.p.y>-980);tick(g,8.6);assert.equal(g.p.y,302);assert.equal(g.p.support,m);});
