import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {newProfile,CHECKPOINTS} from '../src/data.js';
import {JOURNEYS} from '../src/journey-data.js';
import {installRouteDriver} from './overhaul-route-driver.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:4190/',out=new URL('../test-results/',import.meta.url);await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']}),errors=[],report=[];
function seed(x,y=302){const s=newProfile();s.started=true;s.tutorial.state='done';s.flags.letter=true;s.position={x,y};Object.keys(s.routes).forEach(k=>s.routes[k]=true);Object.assign(s.flags,{edran:'freed',marie:'freed',brag:'freed',leonel:'freed',arkein:'freed',neris:'freed',carillon:'freed',sister:true,echo:true,voice:true,forge:true,memory:true,dawn:true,tide:true,resonance:true,lever:true,choir:true,coolant:true,index:true,chronology:true,palacedoor:true,clockwork:true,harborLock:true,towerSeal:true,towerLens:true});return s;}
async function open(s){const ctx=await browser.newContext({viewport:{width:1440,height:960}}),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.stack));await p.addInitScript(s=>{if(!localStorage.getItem('seventh-bell.save.v1'))localStorage.setItem('seventh-bell.save.v1',JSON.stringify(s));},s);await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});await p.click('#begin');await p.evaluate(()=>window.__seventh.game.paused=true);await installRouteDriver(p);return{p,ctx};}
try{
 for(const j of JOURNEYS){const{p,ctx}=await open(seed(j.west-65));await p.evaluate(j=>{const g=window.__seventh.game;g.world.enemies=[];g.world.traps=[];window.routeWalk(j.west-40);window.routeUse(j.object);window.routeWalk(j.start+150);},j);
 await p.screenshot({path:new URL('012-'+j.id+'-west.png',out).pathname});
 await p.evaluate(j=>{
 const g=window.__seventh.game;
 if(j.kind==='mine'){window.routeWalk(j.start+1195);window.routeUse('journey-mine-hoist');window.routeStep(220);window.routeWalk(j.start+1320);}
 else if(j.kind==='rail'){window.routeWalk(j.start+450);window.routeJump(j.start+500,250);window.routeWalk(j.start+565);window.routeStep(80);window.routeUse('freight-rail-latch');window.routeWalk(j.start+650);window.routeJump(j.start+730,280);window.routeWalk(j.start+820);window.routeStep(80);}
 else if(j.kind==='coast'){window.routeWalk(j.start+1120);window.routeUse('journey-coast-hoist-upper');window.routeStep(280);window.routeWalk(j.start+1240);window.routeUse('journey-coast-hoist');window.routeStep(280);window.routeWalk(j.start+1390);}
 window.routeWalk(j.end-100);window.routeStep(80);
 },j);
 await p.screenshot({path:new URL('012-'+j.id+'-east.png',out).pathname});
 const before=await p.evaluate(()=>{const g=window.__seventh.game;g.save();return{hp:g.p.hp,flasks:g.profile.flasks,x:g.p.x,machines:g.profile.machines};});await p.reload();await p.waitForFunction(()=>window.__seventh);await p.click('#begin');await p.evaluate(()=>{const g=window.__seventh.game;g.paused=true;g.world.enemies=[];g.world.traps=[];});await installRouteDriver(p);const restored=await p.evaluate(()=>({hp:window.__seventh.game.p.hp,flasks:window.__seventh.game.profile.flasks,x:window.__seventh.game.p.x}));assert.equal(restored.hp,before.hp);assert.equal(restored.flasks,before.flasks);assert.ok(Math.abs(restored.x-before.x)<2);
 await p.evaluate(j=>{const g=window.__seventh.game;window.routeWalk(j.end-95);window.routeUse(j.id+'-leave-east');window.routeWalk(j.east);window.routeUse(j.id+'-return');
 if(j.kind==='mine'){window.routeWalk(j.start+1325);window.routeUse('journey-mine-hoist-upper');window.routeStep(220);window.routeWalk(j.start+1195);window.routeUse('journey-mine-hoist');window.routeStep(220);}
 else if(j.kind==='rail'){window.routeWalk(j.start+820);g.paused=false;g.press('jump');g.paused=true;window.routeStep(85,{left:true,jump:true});window.routeWalk(j.start+570);g.paused=false;g.press('jump');g.paused=true;window.routeStep(90,{left:true,jump:true});window.routeWalk(j.start+390);}
 else if(j.kind==='coast'){window.routeWalk(j.start+1325);window.routeUse('journey-coast-hoist-lower');window.routeStep(280);window.routeWalk(j.start+1240);window.routeUse('journey-coast-hoist');window.routeStep(280);window.routeWalk(j.start+1100);}
 window.routeWalk(j.start+100);window.routeUse(j.id+'-leave-west');},j);
 const state=await p.evaluate(()=>{const g=window.__seventh.game;return{x:g.p.x,y:g.p.y,hp:g.p.hp,journeys:g.profile.journeys};});assert.ok(state.x<j.west);assert.equal(state.journeys[j.id],true);assert.equal(state.hp,before.hp);report.push({route:j.id,bothDirections:true,reload:true,...state});console.log('JOURNEY',j.id,JSON.stringify(state));await ctx.close();}
 // Actual populated world; stand at every shrine and challenge each boundary with a fast hostile shot.
 {const{p,ctx}=await open(seed(145));const safe=await p.evaluate(async checkpoints=>{const g=window.__seventh.game,checks=[];for(const c of checkpoints){g.paused=true;g.resetPlayer(c);g.p.hp=61;g.p.invulnerable=0;g.profile.flasks=1;g.profile.checkpoint=c.id;const zone=g.world.sanctuaries.find(z=>z.id===c.id);g.spawnShot(zone.x-40,c.y-25,600,0,90,'ward-probe','bolt',1200);g.paused=false;for(let n=0;n<1800;n++)g.update(1/120);g.paused=true;if(g.p.hp!==61||g.profile.flasks!==1)throw Error('Unsafe shrine '+c.id);checks.push({id:c.id,hp:g.p.hp});}return checks;},CHECKPOINTS);assert.equal(safe.length,21);report.push({safe});await ctx.close();}
 assert.deepEqual(errors,[]);await writeFile(new URL('012-journey-report.json',out),JSON.stringify(report,null,2));
}catch(e){for(const c of browser.contexts())for(const p of c.pages()){console.error('JOURNEY FAILURE',await p.evaluate(()=>{const g=window.__seventh?.game;return g?{x:g.p.x,y:g.p.y,nearest:g.nearest(),support:g.p.support,movers:g.world.movers.filter(m=>m.journey)}:null;}));await p.screenshot({path:new URL('012-journey-failure.png',out).pathname});}throw e;}finally{await browser.close();}
