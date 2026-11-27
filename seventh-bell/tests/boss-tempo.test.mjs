import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {Game} from '../src/game.js';import {SPECIES,makeSpecies} from '../src/enemy-species.js';import {enemy} from '../src/world.js';
import {BOSS_DEFS} from '../src/bosses.js';import {BOSS_ACTIONS} from '../src/boss-actions.js';import {BOSS_MOTION,bossPose} from '../src/boss-motion.js';import {MINIBOSSES} from '../src/miniboss-data.js';
import {BOSS_ATTACK_RATE,BOSS_RECOVERY_RATE,MIN_BOSS_WARNING,quickenBossShot} from '../src/boss-tempo.js';
import {bossSteel,minibossSteel} from '../src/boss-strikes.js';import {beginNativeBoss} from '../src/boss-runtime.js';import {beginMiniboss,updateMiniboss} from '../src/miniboss-runtime.js';
const baseline=JSON.parse(await readFile(new URL('fixtures/boss-balance-0171.json',import.meta.url))),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex'),noTiming=({windup,active,recover,...rest})=>rest;
const tick=(g,t)=>{for(let n=0;n<Math.ceil(t*120);n++)g.update(1/120,{});};
test('boss and miniboss HP, damage, range, defenses, rewards and walking statistics match the published version',()=>{
 assert.equal(hash(BOSS_DEFS),baseline.bossStats);assert.equal(hash(Object.fromEntries(Object.entries(BOSS_ACTIONS).map(([id,a])=>[id,noTiming(a)]))),baseline.actions);assert.equal(hash(Object.fromEntries(Object.entries(MINIBOSSES).map(([id,d])=>[id,{...d,attacks:d.attacks.map(noTiming)}]))),baseline.minibossStats);assert.equal(hash(SPECIES),baseline.ordinaryStats);assert.equal(hash(BOSS_MOTION),baseline.walking);
 for(const [id,a]of Object.entries(BOSS_ACTIONS)){const b=baseline.mainTimings[id];assert.equal(a.windup,b[0]/BOSS_ATTACK_RATE);assert.equal(a.active,b[1]/BOSS_ATTACK_RATE);assert.equal(a.recover,b[2]/BOSS_RECOVERY_RATE);assert.ok(a.windup>.75);}
 for(const[id,d]of Object.entries(MINIBOSSES))d.attacks.forEach((a,i)=>{const b=baseline.miniTimings[id][i];assert.equal(a.windup,b[0]/BOSS_ATTACK_RATE);assert.equal(a.active,b[1]/BOSS_ATTACK_RATE);assert.equal(a.recover,b[2]/BOSS_RECOVERY_RATE);assert.ok(a.windup>.8);});
});

for(const type of Object.keys(SPECIES))test(type+' keeps the exact published 480-step movement, attacks, damage and projectile trace',()=>{
 const g=new Game();g.start();g.profile.tutorial.state='done';g.world.enemies=[];g.world.minibosses=[];g.world.traps=[];g.world.sanctuaries=[];g.world.gates=[];g.world.movers=[];g.world.routeWalls=[];g.world.waterAreas=[];g.world.waterPlatforms=[];g.world.platforms=[{x:0,y:302,w:2500,h:1800}];g.updateBoss=()=>{};g.resetPlayer({x:360,y:302});g.p.invulnerable=999;const e=makeSpecies(enemy('e2000','watchman',540,SPECIES[type].flying?250:302),type);g.world.enemies=[e];const trace=[];
 for(let n=0;n<480;n++){if(n===120||n===300)g.press('attack');g.update(1/120,{right:n>=10&&n<55,left:n>=220&&n<250});if(n%4===0)trace.push([g.p.x,g.p.y,g.p.vx,g.p.hp,g.p.stamina,g.p.action?.kind,g.p.action?.t,e.x,e.y,e.vx,e.vy,e.state,e.t,e.hp,e.cooldown,g.projectiles.map(q=>[q.x,q.y,q.vx,q.vy,q.life,q.damage,q.range,q.kind])]);}assert.equal(hash(trace),baseline.normal[type]);
});

test('faster boss flight preserves damage, range, radius, gravity trajectory and return distance',()=>{
 const old={x:10,y:20,vx:150,vy:-170,life:3,gravity:340,returnSpeed:250,outRange:320,holdTime:.7,range:900,damage:49,radius:6,destructible:false},q=quickenBossShot({...old},'brag');for(const k of['damage','range','radius','outRange','destructible'])assert.equal(q[k],old[k]);
 for(const t of[.1,.3,.7,1]){const fast=t/BOSS_ATTACK_RATE;assert.ok(Math.abs(old.x+old.vx*t-(q.x+q.vx*fast))<1e-9);assert.ok(Math.abs(old.y+old.vy*t+.5*old.gravity*t*t-(q.y+q.vy*fast+.5*q.gravity*fast*fast))<1e-9);}assert.equal(q.holdTime,old.holdTime/BOSS_ATTACK_RATE);assert.equal(q.returnSpeed,old.returnSpeed*BOSS_ATTACK_RATE);const once={...q};quickenBossShot(q,'brag');assert.deepEqual(q,once);
});

test('every main boss releases only after its shortened windup and keeps a readable field warning',()=>{
 for(const [id,a]of Object.entries(BOSS_ACTIONS)){const g=new Game();g.start();g.profile.tutorial.state='done';g.world.enemies=[];g.world.minibosses=[];g.world.traps=[];g.world.sanctuaries=[];const e=g.world.bosses.find(e=>e.id===a.owner);g.world.boss=e;g.bossActive=true;g.resetPlayer({x:e.x-100,y:302});g.p.invulnerable=999;e.phase=a.phase||1;beginNativeBoss(g,e,id);tick(g,a.windup-.025);assert.equal(e.state,'windup',id);assert.equal(g.combatFields.length+g.projectiles.length,0,id);tick(g,.04+a.active);for(const f of g.combatFields)if(f.warning>0)assert.ok(f.warning>=MIN_BOSS_WARNING,id);}
});

test('visible main and mini weapon trails use the very segment used for contact, and ending poses keep the final swing row',()=>{
 const g=new Game();g.start();g.world.enemies=[];g.world.minibosses=[];g.world.traps=[];g.world.sanctuaries=[];g.bossActive=true;const e=g.world.boss;e.phase=1;g.p.invulnerable=999;g.resetPlayer({x:e.x-70,y:302});beginNativeBoss(g,e,'gateBlade');tick(g,BOSS_ACTIONS.gateBlade.windup+.06);assert.ok(e.steel);const geometry=bossSteel(e,113,61);for(const k of['ax','ay','bx','by'])assert.equal(e.steel[k],geometry[k]);assert.equal(e.steel.radius,4);
 Object.assign(e,{phase:2,pattern:'royalFour',id:'arkein',state:'recover',endRow:1,t:.15,stagger:0});assert.equal(bossPose(e).row,1);e.t=.02;e.endCol=5;assert.equal(bossPose(e).col,5);e.endCol=2;assert.equal(bossPose(e).col,2);
 const h=new Game();h.start();h.world.enemies=[];h.world.traps=[];h.world.sanctuaries=[];h.updateBoss=()=>{};const m=h.world.minibosses.find(e=>e.type==='censer');h.world.minibosses=[m];h.resetPlayer({x:m.x+40,y:m.y});h.p.invulnerable=999;m.active=true;beginMiniboss(h,m,0);for(let n=0;n<160&&!m.steel;n++){h.clock+=1/120;updateMiniboss(h,m,1/120);}assert.ok(m.steel);const s=minibossSteel(m,MINIBOSSES.censer.attacks[0]);for(const k of['ax','ay','bx','by'])assert.equal(m.steel[k],s[k]);assert.equal(m.steel.radius,8);
});
