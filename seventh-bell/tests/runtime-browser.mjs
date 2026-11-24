import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {engine,launchBrowser} from './browser-engine.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await launchBrowser(),errors=[],samples=[];
try{const ctx=await browser.newContext({viewport:{width:1024,height:768},deviceScaleFactor:2,isMobile:true,hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.stack));
 await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});await p.locator('#skip-tutorial').tap();await p.locator('#letter-close').tap();
 const initial=await p.evaluate(()=>({clock:window.__seventh.game.clock,x:window.__seventh.game.p.x,art:window.__seventh.artStats()}));
 assert.equal(initial.art.loaded.length,84);assert.equal(initial.art.memory.peakDecoding,2);assert.ok(initial.art.memory.sourceBytes+initial.art.memory.cellBytes<160*1024*1024);
 // Real animation frames and touch pointer capture, without modifying the game.
 for(let i=0;i<6;i++){for(const direction of ['right','left']){const b=await p.locator('[data-hold="'+direction+'"]').boundingBox();assert.ok(b);await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();await p.waitForTimeout(450);await p.mouse.up();await p.waitForTimeout(250);}await p.locator('[data-press="attack"]').tap();await p.waitForTimeout(650);samples.push(await p.evaluate(()=>({clock:window.__seventh.game.clock,x:window.__seventh.game.p.x,hp:window.__seventh.game.p.hp,failed:window.__seventh.runtime.state.failed,frames:window.__seventh.runtime.state.frames})));}
 for(let i=0;i<samples.length;i++){assert.equal(samples[i].failed,false);assert.ok(samples[i].clock>(samples[i-1]?.clock??initial.clock)+.5);assert.ok(samples[i].hp>0);}
 assert.ok(samples.at(-1).frames>100);assert.ok(samples.some(s=>Math.abs(s.x-initial.x)>1));
 const stats=await p.evaluate(()=>window.__seventh.artStats());assert.equal(stats.memory.runtimeBuilds,0);assert.equal(stats.cached,initial.art.cached);assert.equal(stats.memory.cellBytes,initial.art.memory.cellBytes);assert.equal(await p.locator('#runtime-error').isVisible(),false);
 await p.screenshot({path:new URL('016-runtime-'+engine+'.png',out).pathname});
 // A one-off frame exception must show a recoverable pause, not lose the RAF.
 await p.evaluate(()=>{const r=window.__seventh.render,old=r.render.bind(r);r.render=(...args)=>{r.render=old;throw Error('intentional-frame-test');};});await p.locator('#runtime-error').waitFor({state:'visible'});const before=await p.evaluate(()=>window.__seventh.game.clock);await p.locator('#runtime-retry').tap();await p.waitForFunction(before=>window.__seventh.game.clock>before+.25,before);assert.equal(await p.locator('#runtime-error').isVisible(),false);assert.deepEqual(errors,[]);
 // Exact readback preserves the previous renderer's pixels, bounds and pivots.
 if(engine==='chromium'){const oracle=JSON.parse(await readFile(new URL('pixel-oracle.json',import.meta.url),'utf8'));for(const f of oracle){const actual=await p.evaluate(({id,col,row})=>{const im=window.__seventh.art.cell(id,col,row);return{pixels:[...im.getContext('2d').getImageData(0,0,im.width,im.height).data],width:im.width,height:im.height,footPad:im.footPad,b:im.opaqueBounds};},f);assert.equal(createHash('sha256').update(Buffer.from(actual.pixels)).digest('hex'),f.hash,f.id+' '+f.row+':'+f.col);for(const k of ['width','height','footPad','b'])assert.deepEqual(actual[k],f[k]);}}
 const saved=await p.evaluate(()=>{const g=window.__seventh.game;g.save();return structuredClone(g.profile);});await p.reload();await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});const restored=await p.evaluate(()=>window.__seventh.game.profile);for(const k of ['flags','marks','level','flasks','hp','minibosses'])assert.deepEqual(restored[k],saved[k]);
 await writeFile(new URL('016-runtime-'+engine+'.json',out),JSON.stringify({initial,samples,stats,errors},null,2));console.log('PASS',engine,'iPad-sized touch movement/attacks, bounded raster memory, no runtime rasterization, frame recovery, pixel preservation and reload',JSON.stringify({frames:samples.at(-1).frames,retainedMiB:(stats.memory.sourceBytes+stats.memory.cellBytes)/1024**2}));await ctx.close();
}finally{await browser.close();}
