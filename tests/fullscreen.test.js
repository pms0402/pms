import test from 'node:test';
import assert from 'node:assert/strict';
import {ViewportMode} from '../src/fullscreen.js';

function fixture(){
  const document=new EventTarget(),classes=new Set(),button={attributes:{},setAttribute(key,value){this.attributes[key]=value;}};
  document.body={classList:{toggle(name,value){if(value)classes.add(name);else classes.delete(name);}}};
  document.documentElement={};document.fullscreenElement=null;
  const parent=()=>({appendChild(child){child.parentElement=this;}});
  const root=parent(),home=parent(),controls=[{id:'settings'},{id:'sound-toggle'}];
  let resizes=0;
  const mode=new ViewportMode({document,root,home,controls,button,resize:()=>resizes++});
  return {document,classes,button,root,home,controls,mode,resizes:()=>resizes};
}

test('filling the game viewport never automatically requests native fullscreen',()=>{
  const f=fixture();let requests=0;
  f.document.documentElement.requestFullscreen=()=>{requests++;};
  assert.equal(f.mode.set(true),true);
  assert.equal(requests,0);
  assert.ok(f.classes.has('theater-mode'));
  assert.equal(f.button.attributes['aria-pressed'],'true');
  assert.ok(f.controls.every(control=>control.parentElement===f.root));
  f.mode.set(false);
  assert.equal(requests,0);
  assert.equal(f.classes.has('theater-mode'),false);
  assert.ok(f.controls.every(control=>control.parentElement===f.home));
  f.mode.dispose();
});

test('native Escape/fullscreen exit retains the full game viewport and controls',async()=>{
  const f=fixture();let requests=0,exits=0;
  f.document.documentElement.requestFullscreen=async()=>{requests++;f.document.fullscreenElement=f.document.documentElement;f.document.dispatchEvent(new Event('fullscreenchange'));};
  f.document.exitFullscreen=async()=>{exits++;f.document.fullscreenElement=null;f.document.dispatchEvent(new Event('fullscreenchange'));};
  assert.equal(await f.mode.requestNative(),true);
  assert.equal(await f.mode.requestNative(),true);
  assert.equal(requests,1);assert.equal(exits,1);
  assert.equal(f.mode.active,true);
  assert.ok(f.classes.has('theater-mode'));
  assert.ok(f.controls.every(control=>control.parentElement===f.root));
  f.document.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(requests,1,'native exits must never cause another request');
  const oldResizes=f.resizes();f.mode.dispose();
  f.document.dispatchEvent(new Event('fullscreenchange'));
  assert.equal(f.resizes(),oldResizes);
});

test('pending native requests deduplicate repeated clicks and recover from rejection',async()=>{
  const f=fixture();let reject,requests=0;
  f.document.documentElement.requestFullscreen=()=>{requests++;return new Promise((_,no)=>{reject=no;});};
  const pending=f.mode.requestNative();
  assert.equal(await f.mode.requestNative(),false);assert.equal(requests,1);
  reject(new Error('browser denied fullscreen'));
  assert.equal(await pending,false);assert.equal(f.mode.nativePending,false);
  assert.equal(f.mode.active,true);
  f.document.documentElement.requestFullscreen=async()=>{};
  assert.equal(await f.mode.requestNative(),true);
  f.mode.dispose();
});

test('legacy Safari transitions also deduplicate until their asynchronous fullscreen event',async()=>{
  const f=fixture();let requests=0;
  f.document.documentElement.webkitRequestFullscreen=()=>{requests++;};
  assert.equal(await f.mode.requestNative(),true);
  assert.equal(await f.mode.requestNative(),false);assert.equal(requests,1);
  f.document.webkitFullscreenElement=f.document.documentElement;
  f.document.dispatchEvent(new Event('webkitfullscreenchange'));
  assert.equal(f.mode.nativePending,false);
  f.document.webkitExitFullscreen=()=>{f.document.webkitFullscreenElement=null;f.document.dispatchEvent(new Event('webkitfullscreenchange'));};
  assert.equal(await f.mode.requestNative(),true);
  assert.equal(f.mode.active,true);
  assert.equal(f.mode.nativePending,false);
  f.mode.dispose();
});

test('unsupported or failed fullscreen keeps the game viewport usable',async()=>{
  const f=fixture();
  assert.equal(await f.mode.requestNative(),false);
  assert.equal(f.mode.active,true);assert.equal(f.mode.nativePending,false);
  f.document.documentElement.webkitRequestFullscreen=()=>{};
  await f.mode.requestNative();
  f.document.dispatchEvent(new Event('webkitfullscreenerror'));
  assert.equal(f.mode.nativePending,false);assert.equal(f.mode.active,true);
  f.mode.dispose();
});
