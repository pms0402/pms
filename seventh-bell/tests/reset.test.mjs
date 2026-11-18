import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {SAVE_KEY} from '../src/data.js';

function fixture(){
 const data=new Map([['voidrun','keep-voidrun'],['eldermere.save.v1','keep-eldermere']]);
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
 const g=new Game(storage);
 g.start();g.profile.marks=240;g.profile.level=5;g.profile.upgrade=2;g.save();
 return{g,data,storage};
}
test('confirmed erasure cannot be undone by the outgoing game saving on pagehide or autosave',()=>{
 const{g,data,storage}=fixture();
 assert.ok(g.eraseSave());
 assert.equal(data.has(SAVE_KEY),false);
 assert.equal(g.save(),false);
 g.paused=false;g.autosave=16;g.update(1/60);
 assert.equal(data.has(SAVE_KEY),false);
 assert.equal(data.get('voidrun'),'keep-voidrun');
 assert.equal(data.get('eldermere.save.v1'),'keep-eldermere');
 const fresh=new Game(storage);
 assert.equal(fresh.profile.started,false);
 assert.equal(fresh.profile.level,1);
 assert.equal(fresh.profile.marks,0);
 assert.equal(fresh.profile.tutorial.state,'new');
 fresh.start();
 const newSave=data.get(SAVE_KEY);
 assert.equal(g.save(),false);
 assert.equal(data.get(SAVE_KEY),newSave,'the outgoing game cannot overwrite a new journey either');
});
test('erasing from isolated practice also prevents its saved main profile from returning',()=>{
 const{g,data,storage}=fixture();
 assert.ok(g.beginTutorial());
 assert.ok(g.trainingReturn);
 assert.ok(g.eraseSave());
 assert.ok(g.finishTutorial(true));
 assert.equal(g.profile.marks,240);
 assert.equal(g.save(),false);
 assert.equal(data.has(SAVE_KEY),false);
 assert.equal(new Game(storage).profile.marks,0);
});
test('denied or silently ignored storage deletion reports failure and keeps ordinary saving available',()=>{
 for(const removeItem of [()=>{throw new Error('denied');},()=>{}]){
  const{g,data,storage}=fixture(),saved=data.get(SAVE_KEY);
  storage.removeItem=removeItem;
  assert.equal(g.eraseSave(),false);
  assert.equal(data.get(SAVE_KEY),saved);
  g.profile.marks=250;
  assert.ok(g.save());
  assert.equal(JSON.parse(data.get(SAVE_KEY)).marks,250);
 }
 assert.equal(new Game().eraseSave(),false);
});
