import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.stack));
try{
 await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});await p.click('#skip-tutorial');await p.click('#letter-close');
 const colors=await p.evaluate(()=>{
  const{art}=window.__seventh,median=a=>a.sort((a,b)=>a-b)[Math.floor(a.length/2)];
  const cases=[['cut-body',0,3],...Array.from({length:8},(_,i)=>['repairman',i,1]),...Array.from({length:8},(_,i)=>['repairman',i,2]),...['light1','light2','light3','heavy','air','thrust','plunge'].flatMap(k=>Array.from({length:24},(_,i)=>['cut-'+k,i%6,Math.floor(i/6)])),...['gait-walk','gait-run','gait-transitions'].flatMap(id=>Array.from({length:24},(_,i)=>[id,i%6,Math.floor(i/6)])),...Array.from({length:3},(_,r)=>Array.from({length:8},(_,i)=>['motion-extras',i,r+1])).flat()];
  return cases.map(([id,col,row])=>{const im=art.cell(id,col,row),d=im.getContext('2d').getImageData(0,0,im.width,im.height).data,coat=[],scarf=[],colors=new Set();
   for(let i=0;i<d.length;i+=4)if(d[i+3]){const[r,g,b]=d.slice(i,i+3);colors.add([r,g,b].join());if(g>r*1.04&&b>r&&g>=b*.95)coat.push(.2126*r+.7152*g+.0722*b);if(r>g*1.18&&r>b*1.18&&g<b*1.35)scarf.push(.2126*r+.7152*g+.0722*b);}
   return{id,col,row,coat:median(coat),scarf:median(scarf),colors:colors.size};
  });
 });
 await writeFile(new URL('094-material-colors.json',out),JSON.stringify(colors,null,2));
 for(const material of ['coat','scarf']){const values=colors.map(c=>c[material]).filter(Number.isFinite),spread=Math.max(...values)-Math.min(...values);console.log('MATERIAL',material,'brightness spread',spread.toFixed(2));assert.ok(spread<9,'visible '+material+' changes exposure across animation sheets');}
 assert.ok(colors.every(c=>c.colors>=45),'material matching must retain sprite shading and detail');
 const pacing=await p.evaluate(()=>{
  const{game:g,poses}=window.__seventh;g.paused=false;g.world.enemies=[];g.world.traps=[];const results=[];
  for(const kind of ['light1','light3','heavy','counter']){
   Object.assign(g.p,{x:190,y:302,vx:0,vy:0,grounded:true,action:null,stamina:100,hurt:0,counterReady:1,comboQueued:false});g.startAttack(kind);const frames=new Set(),angles=new Set();let live=0;
   for(let i=0;i<200&&g.p.action;i++){const a=g.p.action,pose=poses.registeredPose(g.p);if(a.t>=a.spec.windup&&a.t<a.spec.end){live+=1/120;frames.add(pose.frame);angles.add(Math.round(pose.angle));}g.update(1/120);}
   results.push({kind,frames:[...frames],angles:[...angles],seconds:live});
  }
  g.paused=true;return results;
 });
 for(const r of pacing){assert.deepEqual(r.frames,[6,7,8,9,10,11,12,13,14,15]);assert.ok(r.angles.length>=8);assert.ok(r.seconds>=.19&&r.seconds<=.25);}
 console.log('PASS ten distinct live body poses per broad cut, 0.20–0.24 seconds at normal game speed');
 const exposure=await p.evaluate(()=>{
  const{game:g,render:r}=window.__seventh;g.paused=true;g.clock=20;g.shake=0;g.effects=[];g.p.action=null;g.p.hurt=0;r.snap();
  const sky=()=>{r.render(0);return [...r.c.getImageData(260,8,120,70).data];},baseline=sky();
  g.fx(g.p.x+14,g.p.y-30,'parry',.5);const parry=sky();g.effects=[];g.p.hurt=.28;const hurt=sky();g.p.hurt=0;
  return{parry:baseline.filter((v,i)=>v!==parry[i]).length,hurt:baseline.filter((v,i)=>v!==hurt[i]).length};
 });
 assert.deepEqual(exposure,{parry:0,hurt:0});console.log('PASS parry and damage feedback leave the central background exposure unchanged');
 // A real keyboard swing, measured by browser animation frames rather than
 // manually changing action time. No enemy/hitstop can inflate its duration.
 await p.evaluate(()=>{const{game:g}=window.__seventh;Object.assign(g.p,{x:190,y:302,vx:0,vy:0,grounded:true,action:null,stamina:100,hurt:0,counterReady:0,comboQueued:false});g.effects=[];g.hitstop=0;g.paused=false;
  window.cutPlayback=[];window.cutDone=false;let began=false;const sample=()=>{const a=g.p.action;if(a){began=true;window.cutPlayback.push({wall:performance.now(),t:a.t,kind:a.kind,frame:window.__seventh.poses.registeredPose(g.p).frame});}if(began&&!a){window.cutDone=true;return;}requestAnimationFrame(sample);};requestAnimationFrame(sample);
 });
 await p.keyboard.press('j');await p.waitForFunction(()=>window.cutDone);
 const played=await p.evaluate(()=>window.cutPlayback),elapsed=(played.at(-1).wall-played[0].wall)/1000;
 assert.ok(elapsed>=.65&&elapsed<1.15,'real-time first cut should read as a deliberate stroke: '+elapsed);assert.ok(new Set(played.filter(x=>x.frame>=6&&x.frame<=15).map(x=>x.frame)).size>=8);
 await writeFile(new URL('094-keyboard-playback.json',out),JSON.stringify(played,null,2));
 await p.keyboard.press('j');await p.waitForTimeout(180);await p.keyboard.press('j');
 await p.waitForFunction(()=>{const{game:g,poses}=window.__seventh;return g.p.action?.kind==='light3'&&poses.registeredPose(g.p).frame>=14;});
 await p.evaluate(()=>{const{game:g,render:r,updateUI}=window.__seventh;g.paused=true;r.snap();r.render(0);updateUI();});
 await p.screenshot({path:new URL('094-readable-downstroke.png',out).pathname});
 assert.deepEqual(errors,[]);console.log('PASS actual J input at normal browser speed, two-hit combo and color-stable rendering, first cut '+elapsed.toFixed(2)+'s');
}finally{await browser.close();}
