import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SAVE_KEY,newProfile,validProfile} from '../src/data.js';

function fixture(){
 const seed=newProfile();Object.assign(seed,{started:true,marks:100,position:{x:700,y:302}});seed.tutorial.state='done';
 const data=new Map([[SAVE_KEY,JSON.stringify(seed)],['voidrun','untouched'],['eldermere.save.v1','untouched']]);
 const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},g=new Game(storage),events=[];
 g.event=(kind,detail)=>events.push({kind,...detail});g.start();
 g.world.sanctuaries=[];g.world.traps=[];g.world.enemies=[];g.world.minibosses=[];g.updateBoss=()=>{};
 return{g,data,storage,events};
}
const tick=(g,seconds)=>{for(let i=0;i<Math.ceil(seconds*120);i++)g.update(1/120,{});};

test('a fatal hit inside the update cannot recover its own newly dropped coins',()=>{
 const {g,data,events}=fixture();g.p.invulnerable=0;
 // The fatal hit happens after step()'s initial dead check, just like real AI.
 g.updateBoss=()=>g.hurt(1000,{x:g.p.x+20,boss:true,stagger:0,state:'idle'});
 g.update(1/120,{});
 assert.equal(g.p.dead,true);assert.equal(g.profile.marks,50);assert.equal(g.profile.loss.marks,50);
 const drop={...g.profile.loss};tick(g,2);
 assert.deepEqual(g.profile.loss,drop);assert.equal(g.recoverLostCoins(),false);
 assert.equal(g.profile.marks,50);assert.equal(events.filter(e=>e.kind==='death').length,1);
 assert.equal(events.some(e=>e.name==='coin'),false);
 assert.equal(events.some(e=>e.text==='떨어뜨린 동전을 되찾았다.'),false);
 const saved=JSON.parse(data.get(SAVE_KEY));assert.ok(validProfile(saved));assert.deepEqual(saved.loss,drop);assert.equal(saved.marks,50);
});

test('a fatal projectile preserves the trace through death and allows exactly one living recovery',()=>{
 const {g,data,events}=fixture();g.p.invulnerable=0;
 g.spawnShot(g.p.x-1,g.p.y-20,100,0,1000,'test-enemy');
 g.update(1/120,{});assert.equal(g.p.dead,true);assert.equal(g.profile.marks,50);
 const drop={...g.profile.loss};assert.equal(drop.marks,50);tick(g,1.5);
 g.respawn();assert.deepEqual(g.profile.loss,drop);assert.equal(g.profile.marks,50);
 assert.equal(g.recoverLostCoins(),false,'checkpoint is away from the corpse');
 Object.assign(g.p,{x:drop.x,y:drop.y});
 assert.equal(g.recoverLostCoins(),true);assert.equal(g.recoverLostCoins(),false);
 assert.equal(g.profile.marks,100);assert.equal(g.profile.loss,null);
 assert.equal(events.filter(e=>e.name==='coin').length,1);
 const saved=JSON.parse(data.get(SAVE_KEY));assert.equal(saved.marks,100);assert.equal(saved.loss,null);
 assert.equal(data.get('voidrun'),'untouched');assert.equal(data.get('eldermere.save.v1'),'untouched');
});

test('death traces survive save, reload and a checkpoint rest until the living player returns',()=>{
 const {g,storage}=fixture();g.profile.charm=true;g.die();
 const drop={...g.profile.loss};assert.equal(drop.marks,20);assert.equal(g.profile.marks,80);
 const loaded=new Game(storage);loaded.start();assert.deepEqual(loaded.profile.loss,drop);
 loaded.respawn();loaded.world.enemies=[];loaded.world.minibosses=[];loaded.updateBoss=()=>{};
 assert.ok(loaded.interact());assert.deepEqual(loaded.profile.loss,drop);
 loaded.save();const again=new Game(storage);again.start();
 assert.deepEqual(again.profile.loss,drop);Object.assign(again.p,{x:drop.x,y:drop.y});
 assert.equal(again.recoverLostCoins(),true);assert.equal(again.profile.marks,100);
 assert.equal(new Game(storage).profile.loss,null);
});

test('recovery requires a living, active player within the unchanged 35-pixel reach',()=>{
 const {g}=fixture();g.profile.marks=50;g.profile.loss={x:700,y:302,marks:50};
 for(const edit of[p=>p.dead=true,p=>p.hp=0]){
  const before={dead:g.p.dead,hp:g.p.hp};edit(g.p);assert.equal(g.recoverLostCoins(),false);Object.assign(g.p,before);
 }
 g.paused=true;assert.equal(g.recoverLostCoins(),false);g.paused=false;
 g.profile.started=false;assert.equal(g.recoverLostCoins(),false);g.profile.started=true;
 g.p.x=735;assert.equal(g.recoverLostCoins(),false);
 g.p.x=734.9;assert.equal(g.recoverLostCoins(),true);assert.equal(g.profile.marks,100);
});

test('falling deaths leave a saved trace on the last safe floor without changing loss rates',()=>{
 const {g,data}=fixture(),safe={...g.p.lastSafe};g.p.y=680;
 g.update(1/120,{});assert.equal(g.p.dead,true);assert.deepEqual(g.profile.loss,{...safe,marks:50});
 assert.deepEqual(JSON.parse(data.get(SAVE_KEY)).loss,g.profile.loss);
});

test('a later death keeps the existing rule of replacing, rather than duplicating, the previous trace',()=>{
 const {g}=fixture();g.die();g.respawn();Object.assign(g.p,{x:900,y:302});g.die();
 assert.equal(g.profile.marks,25);assert.deepEqual(g.profile.loss,{x:900,y:302,marks:25});
 g.die();assert.equal(g.profile.marks,25);assert.equal(g.profile.loss.marks,25);
});
