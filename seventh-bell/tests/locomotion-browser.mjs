import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4191/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
const p=await browser.newPage({viewport:{width:1440,height:900}});p.on('pageerror',e=>errors.push(e.stack));
async function boot(page){await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__seventh,null,{timeout:60000});await page.click('#skip-tutorial');await page.click('#letter-close');await page.evaluate(()=>{const g=window.__seventh.game;g.world.enemies=[];g.world.traps=[];});}
const state=page=>page.evaluate(()=>{const{game:g,poses}=window.__seventh;return{x:g.p.x,vx:g.p.vx,dir:g.p.dir,gait:g.p.gait,pose:poses.registeredPose(g.p),action:g.p.action?.kind};});
try{
 await boot(p);
 const artwork=await p.evaluate(()=>{
  const{art,poses}=window.__seventh,report=[];
  for(const kind of ['walk','run']){
   const images=new Set(),masks=[];const atlas=document.createElement('canvas');atlas.width=1200;atlas.height=800;const a=atlas.getContext('2d');a.imageSmoothingEnabled=false;a.fillStyle='#1d2b32';a.fillRect(0,0,1200,800);
   for(let f=0;f<24;f++){
    const actor={x:64,y:110,dir:1,grounded:true,vx:kind==='run'?178:100,hurt:0,dead:false,land:0,gait:{state:'stride',style:kind,phase:kind==='run'?(f+.5)/24:(f%12+.5)/12,cycles:Math.floor(f/12)}},pose=poses.registeredPose(actor);
    const im=art.cell(pose.sheet,pose.col,pose.row),raw=im.getContext('2d').getImageData(0,0,128,128).data;let solid=0,clear=0;
    for(let i=3;i<raw.length;i+=4){if(raw[i]===255)solid++;else if(raw[i]===0)clear++;else throw Error('soft gait alpha');}
    if(solid<700||clear<8000)throw Error('gait sprite is empty or has an opaque background');images.add(im.toDataURL());
    const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;art.drawPose(ctx,{...pose,steel:false},64,110,1);const body=ctx.getImageData(0,0,128,128).data;masks.push(Array.from({length:128*128},(_,i)=>body[i*4+3]>0));
    a.save();a.translate(f%6*200,Math.floor(f/6)*200);a.scale(1.5,1.5);art.drawPose(a,pose,64,110,1);a.fillStyle='white';a.font='7px monospace';a.fillText(String(f).padStart(2,'0'),3,128);a.restore();
   }
   const difference=(a,b)=>{let xor=0,union=0;for(let i=0;i<a.length;i++){if(a[i]||b[i])union++;if(a[i]!==b[i])xor++;}return xor/union;},steps=masks.map((m,i)=>difference(m,masks[(i+1)%24]));
   report.push({kind,distinct:images.size,seam:steps[23],midpoint:steps[11],neighbor90:steps.toSorted((a,b)=>a-b)[21],png:atlas.toDataURL()});
  }
  return report;
 });
 for(const r of artwork){assert.equal(r.distinct,24);await writeFile(new URL('095-'+r.kind+'-loop.png',out),Buffer.from(r.png.split(',')[1],'base64'));assert.ok(r.seam<.35&&r.seam<=r.neighbor90*1.25,'loop closure has a larger pose jump than the stride');console.log('PASS real',r.kind,'body drawings and loop closure',JSON.stringify({frames:r.distinct,seam:r.seam,neighbor90:r.neighbor90}));}
 await p.evaluate(()=>{window.gaitTrace=[];window.gaitRecording=true;const sample=()=>{const{game:g,poses}=window.__seventh;if(!window.gaitRecording)return;window.gaitTrace.push({wall:performance.now(),x:g.p.x,vx:g.p.vx,dir:g.p.dir,gait:{...g.p.gait},sheet:poses.registeredPose(g.p)?.sheet,frame:poses.registeredPose(g.p)?.frame});requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 const x=(await state(p)).x;await p.keyboard.down('ArrowRight');await p.waitForTimeout(250);let r=await state(p);assert.ok(r.vx>65&&r.vx<120,JSON.stringify(r));assert.ok(r.x>x+8&&r.x<x+25);await p.waitForTimeout(1000);r=await state(p);assert.equal(r.vx,178);assert.equal(r.pose.sheet,'gait-run');await p.screenshot({path:new URL('095-running.png',out).pathname});
 await p.evaluate(()=>window.addEventListener('keyup',()=>{window.releaseX=window.__seventh.game.p.x;},{once:true}));await p.keyboard.up('ArrowRight');const release=await p.evaluate(()=>window.releaseX);await p.waitForTimeout(85);r=await state(p);assert.ok(r.vx>80&&r.vx<160);assert.ok(r.x>release+9);await p.waitForTimeout(420);r=await state(p);assert.equal(r.vx,0);assert.ok(r.x-release>23&&r.x-release<29,JSON.stringify({coast:r.x-release,r}));assert.equal(r.gait.state,'idle');assert.equal(r.pose.sheet,'cut-body');
 await p.keyboard.down('ArrowLeft');await p.waitForTimeout(450);await p.keyboard.up('ArrowLeft');await p.keyboard.down('ArrowRight');await p.waitForTimeout(60);assert.equal((await state(p)).dir,-1);await p.waitForTimeout(260);assert.equal((await state(p)).dir,1);await p.keyboard.up('ArrowRight');await p.waitForTimeout(500);
 const trace=await p.evaluate(()=>{window.gaitRecording=false;return window.gaitTrace;});await writeFile(new URL('095-keyboard-gait.json',out),JSON.stringify(trace,null,2));assert.ok(trace.some(x=>x.gait.state==='start'));assert.ok(trace.some(x=>x.gait.state==='stop'));assert.ok(trace.some(x=>x.gait.state==='turn'));assert.ok(new Set(trace.filter(x=>x.sheet==='gait-run').map(x=>x.frame)).size>=20);
 // Combat still takes priority over locomotion, including while coasting.
 await p.keyboard.down('ArrowRight');await p.waitForTimeout(550);await p.keyboard.press('j');r=await state(p);assert.equal(r.action,'light1');assert.equal(r.pose.sheet,'cut-light1');await p.keyboard.up('ArrowRight');await p.waitForTimeout(900);
 console.log('PASS real ArrowRight/ArrowLeft, gradual acceleration, auto-run, foot phase, coast, turn and immediate J attack');
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.stack));await boot(m);const box=await m.locator('[data-hold="right"]').boundingBox(),cdp=await mobile.newCDPSession(m);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2}]});await m.waitForTimeout(1100);r=await state(m);assert.equal(r.vx,178);assert.equal(r.pose.sheet,'gait-run');await m.screenshot({path:new URL('095-mobile-run.png',out).pathname});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await m.waitForTimeout(80);assert.ok((await state(m)).vx>80);await m.waitForTimeout(450);assert.equal((await state(m)).gait.state,'idle');assert.equal((await state(m)).vx,0);assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();
 assert.deepEqual(errors,[]);console.log('PASS real mobile held movement and touch release with the same acceleration and settling');
}finally{await browser.close();}
