import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4190/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
const p=await browser.newPage({viewport:{width:1440,height:960}});p.on('pageerror',e=>errors.push(e.stack));
async function boot(p){await p.goto(base+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});await p.locator('#skip-tutorial').click();await p.locator('#letter-close').click();}
try{
 await boot(p);
 const report=await p.evaluate(()=>{
  const{game:g,art,poses}=window.__seventh,{registeredPose,ATTACKS,CUT_CLIPS}=poses;
  const actor=s=>({x:64,y:115,dir:1,grounded:true,vx:0,vy:0,brake:0,land:0,hurt:0,dead:false,walk:0,...s});
  function render(a){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;const pose=registeredPose(a);if(pose)art.drawPose(c,{...pose,steel:false},a.x,a.y,a.dir);else art.drawHero(c,a,0);const data=c.getImageData(0,0,128,128).data;let top=128,bottom=-1,area=0;for(let y=0;y<128;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*4+3]){top=Math.min(top,y);bottom=Math.max(bottom,y);area++;}return{canvas,top,bottom,height:bottom-top+1,area,size:pose?.size};}
  const cases=[['idle',actor({})],['walk',actor({vx:100,walk:0})]];
  for(const clip of CUT_CLIPS){const kind=clip==='light2'?'upper':clip==='air'?'light1':clip,spec=ATTACKS[kind];cases.push([clip+' ready',actor({grounded:clip!=='air',action:{kind,spec,t:0,air:clip==='air'}})]);cases.push([clip+' settle',actor({grounded:clip!=='air',action:{kind,spec,t:spec.duration-.0001,air:clip==='air',landed:clip==='plunge',recoveryT:.359}})]);}
  for(const kind of ['heal','skill'])cases.push([kind+' ready',actor({action:{kind,spec:kind==='heal'?{duration:.8,windup:.5,end:.65}:ATTACKS.skill,t:0}})]);
  cases.push(['braking',actor({vx:35,brake:.11})]);
  const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=Math.ceil(cases.length/6)*256;const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#21303a';c.fillRect(0,0,sheet.width,sheet.height);
  const measured=cases.map(([name,a],i)=>{const r=render(a),x=i%6*240,y=Math.floor(i/6)*256;c.drawImage(r.canvas,x,y,256,256);c.strokeStyle='#d2cb94';c.beginPath();c.moveTo(x,y+230);c.lineTo(x+230,y+230);c.moveTo(x,y+110);c.lineTo(x+230,y+110);c.stroke();c.fillStyle='white';c.font='11px monospace';c.fillText(name+' '+r.height+'px',x+8,y+250);return{name,height:r.height,bottom:r.bottom,size:r.size};});
  const frames=[];
  for(const clip of CUT_CLIPS){const kind=clip==='light2'?'upper':clip==='air'?'light1':clip,spec=ATTACKS[kind],sizes=new Set();let maxFootError=0;for(let f=0;f<24;f++){const t=f<4?spec.windup*(f+.5)/4:f<6?spec.windup+(spec.end-spec.windup)*(f-4+.5)/2:spec.end+(spec.duration-spec.end)*(f-6+.5)/18;for(const dir of [-1,1]){const a=actor({dir,grounded:clip!=='air',action:{kind,spec,t,air:clip==='air',landed:clip==='plunge'&&f>=5,recoveryT:(f-5+.5)/19*.36}}),r=render(a);sizes.add(r.size);maxFootError=Math.max(maxFootError,Math.abs(r.bottom-114));}}frames.push({clip,sizes:[...sizes],maxFootError});}
  // Crouching should lower the head while keeping the same source-pixel scale.
  const crouches=['light1','light3'].map(kind=>{const spec=ATTACKS[kind],ready=render(actor({action:{kind,spec,t:0}})),low=render(actor({action:{kind,spec,t:spec.end-.001}}));return{kind,ready:ready.height,low:low.height,readySize:ready.size,lowSize:low.size,areaRatio:low.area/ready.area};});
  g.paused=true;return{measured,frames,crouches,png:sheet.toDataURL()};
 });
 const standing=report.measured.filter(r=>r.name==='idle'||r.name==='walk'||r.name.endsWith(' settle')||r.name==='heal ready'||r.name==='skill ready');
 for(const r of standing)assert.ok(Math.abs(r.height-60)<=2,JSON.stringify(r));
 assert.ok(Math.max(...standing.map(r=>r.height))-Math.min(...standing.map(r=>r.height))<=2,'visible standing height changes between sheets');
 for(const r of report.measured)assert.ok(Math.abs(r.bottom-114)<=1,JSON.stringify(r));
 for(const r of report.frames){assert.equal(r.sizes.length,1,'do not stretch poses separately');assert.ok(r.maxFootError<=1,JSON.stringify(r));}
 for(const r of report.crouches){assert.equal(r.readySize,r.lowSize);assert.ok(r.low<=r.ready-6,JSON.stringify(r));assert.ok(r.areaRatio>.65&&r.areaRatio<1.3,JSON.stringify(r));}
 await writeFile(new URL('093-size-registration.png',out),Buffer.from(report.png.split(',')[1],'base64'));
 await writeFile(new URL('093-size-registration.json',out),JSON.stringify({standing,frames:report.frames,crouches:report.crouches},null,2));
 console.log('PASS actual rendered standing bodies, not canvas sizes',JSON.stringify(standing));
 console.log('PASS all 24 poses in seven clips, both directions, fixed anatomical scale and grounded soles');
 {const page=p;await page.evaluate(()=>{const g=window.__seventh.game;g.world.enemies=[];g.world.traps=[];g.paused=false;});await page.keyboard.down('d');await page.waitForTimeout(300);await page.keyboard.up('d');await page.waitForTimeout(180);await page.keyboard.press('j');await page.waitForTimeout(160);await page.keyboard.press('j');await page.waitForFunction(()=>{const{game:g,poses}=window.__seventh;return g.p.action?.kind==='light3'&&poses.registeredPose(g.p).frame>=5;});await page.evaluate(()=>{const{game:g,render:r}=window.__seventh;g.paused=true;r.snap();r.render(0);});await page.screenshot({path:new URL('093-height-slam.png',out).pathname});await page.evaluate(()=>window.__seventh.game.paused=false);await page.waitForFunction(()=>!window.__seventh.game.p.action);}
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.stack));await boot(m);await m.evaluate(()=>{const g=window.__seventh.game;g.world.enemies=[];g.world.traps=[];});await m.locator('[data-press="attack"]').tap();await m.waitForTimeout(160);await m.locator('[data-press="attack"]').tap();await m.waitForFunction(()=>window.__seventh.game.p.action?.kind==='light3');await m.waitForFunction(()=>!window.__seventh.game.p.action);assert.equal(await m.evaluate(()=>window.__seventh.poses.registeredPose(window.__seventh.game.p).size),report.measured.find(r=>r.name==='idle').size);assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await m.screenshot({path:new URL('093-height-mobile.png',out).pathname});await mobile.close();
 assert.deepEqual(errors,[]);console.log('PASS actual keyboard walk → two-hit combo → idle and mobile touch combo without replacing the body rig');
}finally{await browser.close();}
