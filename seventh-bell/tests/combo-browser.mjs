import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {newProfile,SAVE_KEY} from '../src/data.js';
import {newTutorial} from '../src/tutorial.js';
import {engine,launchBrowser} from './browser-engine.mjs';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url),errors=[],report=[];
await mkdir(out,{recursive:true});const browser=await launchBrowser();
const seed=newProfile();Object.assign(seed,{started:true,position:{x:145,y:302},tutorial:newTutorial(true)});seed.flags.letter=true;
async function boot(context){const p=await context.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(({seed,key})=>localStorage.setItem(key,JSON.stringify(seed)),{seed,key:SAVE_KEY});await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:120000});await p.click('#begin');await p.evaluate(()=>{const g=window.__seventh.game,press=g.press.bind(g),start=g.startAttack.bind(g);window.attackInputs=[];window.attackStarts=[];g.press=(kind,...args)=>{const before=g.p.action,a=before?{kind:before.kind,t:before.t,duration:before.spec?.duration}:null,ok=press(kind,...args);if(kind==='attack')window.attackInputs.push({clock:g.clock,before:a,ok});return ok;};g.startAttack=(kind,...args)=>{const before=g.p.stamina,ok=start(kind,...args);if(ok)window.attackStarts.push({kind,clock:g.clock,spent:before-g.p.stamina});return ok;};});return p;}
async function waitDone(p){await p.waitForFunction(()=>window.__seventh.game.p.action===null);}
async function late(p,kind){await p.waitForFunction(kind=>{const a=window.__seventh.game.p.action;return a?.kind===kind&&a.t>=a.spec.duration-.17;},kind,{timeout:5000});}
try{
 for(const mode of (process.env.COMBO_MODES?.split(',')||['J','Z','mouse','touch'])){
  const touch=mode==='touch',context=await browser.newContext({viewport:touch?{width:1024,height:768}:{width:1440,height:900},hasTouch:touch,isMobile:touch}),p=await boot(context);
  const button=touch?await p.locator('[data-press="attack"]').boundingBox():null;const tap=()=>touch?p.touchscreen.tap(button.x+button.width/2,button.y+button.height/2):mode==='mouse'?p.mouse.click(1100,500):p.keyboard.press(mode.toLowerCase());
  await tap();await p.waitForTimeout(100);await tap();assert.equal(await p.evaluate(()=>window.attackInputs.at(-1).ok),false);assert.equal(await p.evaluate(()=>window.__seventh.game.p.comboQueued),false);await waitDone(p);assert.equal(await p.evaluate(()=>window.attackStarts.length),1);
  await tap();await late(p,'light1');await tap();assert.equal(await p.evaluate(()=>window.attackInputs.at(-1).ok),true);await p.waitForFunction(()=>window.attackStarts.length===3);
  await p.waitForTimeout(90);await tap();assert.equal(await p.evaluate(()=>window.attackInputs.at(-1).ok),false);
  await late(p,'light3');await tap();assert.equal(await p.evaluate(()=>window.attackInputs.at(-1).ok),true);await p.waitForFunction(()=>window.attackStarts.length===4);await waitDone(p);
  const result=await p.evaluate(()=>({starts:window.attackStarts,inputs:window.attackInputs,hp:window.__seventh.game.p.hp,failed:window.__seventh.runtime.state.failed}));assert.deepEqual(result.starts.map(a=>a.kind),['light1','light1','light3','light1']);assert.deepEqual(result.starts.map(a=>a.spent),[8,8,15,8]);assert.ok(result.starts[2].clock-result.starts[1].clock>=.72-1e-7&&result.starts[2].clock-result.starts[1].clock<.74);assert.ok(result.starts[3].clock-result.starts[2].clock>=.88-1e-7&&result.starts[3].clock-result.starts[2].clock<.90);for(const input of result.inputs.filter(i=>i.before)){if(input.ok)assert.ok(input.before.t>=input.before.duration-.18-1e-7);else assert.ok(input.before.t<input.before.duration-.18);}assert.equal(result.hp,100);assert.equal(result.failed,false);
  await p.screenshot({path:new URL('combo-'+engine+'-'+mode+'.png',out).pathname});report.push({mode,...result});await context.close();
 }
 const ctx=await browser.newContext({viewport:{width:1440,height:900}}),held=await boot(ctx);await held.keyboard.down('j');await held.waitForTimeout(600);await held.keyboard.down('j');await held.waitForTimeout(200);await held.keyboard.down('j');await held.keyboard.up('j');await waitDone(held);assert.equal(await held.evaluate(()=>window.attackStarts.length),1);assert.equal(await held.evaluate(()=>window.attackInputs.length),1);await ctx.close();
 assert.deepEqual(errors,[]);await writeFile(new URL('combo-'+engine+'.json',out),JSON.stringify(report,null,2));console.log('PASS',engine,'actual '+report.map(r=>r.mode).join('/')+' reject early taps, accept late presses, finish full motions, charge focus once, stop without another input and ignore held-key repeat');
}catch(error){for(const context of browser.contexts())for(const page of context.pages())console.error('COMBO STATE',await page.evaluate(()=>({inputs:window.attackInputs,starts:window.attackStarts,p:window.__seventh?.game.p,failed:window.__seventh?.runtime.state.failed})));throw error;}finally{await browser.close();}
