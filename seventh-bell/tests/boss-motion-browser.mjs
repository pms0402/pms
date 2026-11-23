import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const base=process.env.BASE_URL||'http://127.0.0.1:4190/',out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']}),errors=[];
const p=await browser.newPage({viewport:{width:1440,height:960}});p.on('pageerror',e=>errors.push(e.stack));
async function boot(page){await page.goto(base+'?test=1');await page.waitForFunction(()=>window.__seventh,null,{timeout:60000});await page.click('#skip-tutorial');await page.click('#letter-close');}
// Independent scenes isolate boss pose/timing. Every attack, movement, parry,
// counter, projectile and damage event still runs through the actual engine.
async function scene(page,id,pattern=null){await page.evaluate(({id,pattern})=>{
 const{game:g,input}=window.__seventh;for(const k in input)input[k]=false;
 const e=g.world.bosses.find(e=>e.id===id);g.world.boss=e;g.bossActive=true;g.world.enemies=[];g.world.traps=[];g.effects=[];g.projectiles=[];g.hitstop=0;g.bladeEchoes=[];
 Object.assign(e,{hp:e.maxHp,dead:false,phase:1,state:'idle',pattern:null,second:false,t:0,cooldown:10,stagger:0,walk:0,vx:0,hit:0});
 Object.assign(g.p,{x:e.x-240,y:302,vx:0,vy:0,grounded:true,hp:g.maxHp,stamina:100,action:null,hurt:0,land:0,invulnerable:0,dir:1,comboQueued:false,counterReady:0});g.attachToFloor();g.paused=true;
 if(pattern){g.p.x=e.x-65;g.beginBossWindup(e,pattern);}window.__seventh.render.snap();
 },{id,pattern});}
async function shot(page,name){await page.evaluate(()=>{const{game:g,render:r,updateUI}=window.__seventh;g.paused=true;r.snap();r.render(0);updateUI();});await page.screenshot({path:new URL('096-'+name+'.png',out).pathname});}
try{
 await boot(p);const ids=await p.evaluate(()=>Object.keys(window.__seventh.bosses.BOSS_MOTION));
 let patterns=0;
 for(const id of ids){
  const report=await p.evaluate(id=>{
   const{art,bosses,game:g}=window.__seventh,{BOSS_MOTION,PATTERNS,bossPose,bossWindup}=bosses,source=g.world.bosses.find(e=>e.id===id),m=BOSS_MOTION[id],patterns=Object.keys(m.rows),sheet=document.createElement('canvas');sheet.width=1920;sheet.height=patterns.length*320;
   const c=sheet.getContext('2d');c.imageSmoothingEnabled=false;c.fillStyle='#1e2b34';c.fillRect(0,0,sheet.width,sheet.height);
   const silhouettes=[],proof=[];
   function render(e){const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;if(!art.drawBoss(ctx,e))throw Error('Missing boss motion');const d=ctx.getImageData(0,0,256,256).data;let top=256,bottom=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(d[(y*256+x)*4+3]){top=Math.min(top,y);bottom=Math.max(bottom,y);}return{canvas,height:bottom-top+1,bottom};}
   for(let r=0;r<patterns.length;r++){
    const pattern=patterns[r],e={...source,x:128,y:220,vx:0,dir:1,stagger:0,hit:0,dead:false,second:false,pattern},spec=PATTERNS[pattern],times=[['windup',.1],['windup',spec.windup*.4],['windup',spec.windup*.9],['attack',spec.active*.25],['attack',spec.active*.75],['recover',.2]],drawings=new Set(),masks=[],heights=[];
    for(let f=0;f<times.length;f++){
     [e.state,e.t]=times[f];const pose=bossPose(e),im=art.cell(pose.sheet,pose.col,pose.row),data=im.getContext('2d').getImageData(0,0,im.width,im.height).data;let visible=0,clear=0,mask='';
     for(let i=3;i<data.length;i+=4){if(data[i]===255)visible++;else if(data[i]===0)clear++;else throw Error('soft boss pixels');mask+=data[i]?'1':'0';}
     if(visible<700||clear<5000)throw Error('empty or opaque-background boss');drawings.add(im.toDataURL());masks.push(mask);
     const rendered=render(e);heights.push(rendered.height);if(Math.abs(rendered.bottom-219)>1)throw Error('boss feet are detached from ground '+id+':'+pattern+':'+f);
     c.drawImage(rendered.canvas,f*320+32,r*320+28);c.fillStyle='#d0c5ab';c.font='12px monospace';c.fillText(pattern+' / '+times[f][0],f*320+12,r*320+310);
    }
    proof.push({pattern,heights,drawings:drawings.size,changes:masks[2].split('').filter((v,i)=>v!==masks[4][i]).length});silhouettes.push(masks[2]);
   }
   // Compare the actual character pixels, not a row/size configuration value.
   const e={...source,x:128,y:220,dead:false,state:'idle',vx:0,stagger:0,hit:0},neutral=render(e),old=document.createElement('canvas');old.width=old.height=256;const ctx=old.getContext('2d');ctx.imageSmoothingEnabled=false;if(['neris','carillon'].includes(id)){const im=art.cell(id+'-motion',0,0),size=bosses.BOSS_RIG[id].size;ctx.drawImage(im,128-size/2,220-(192-im.footPad)*size/192,size,size);}else art.draw(ctx,id,0,0,128,220,id==='brag'?156:142,id==='brag'?156:142,false,1,true);const d=ctx.getImageData(0,0,256,256).data;let top=256,bottom=0;for(let y=0;y<256;y++)for(let x=0;x<256;x++)if(d[(y*256+x)*4+3]){top=Math.min(top,y);bottom=Math.max(bottom,y);}
   return{proof,distinctPreparations:new Set(silhouettes).size,oldHeight:bottom-top+1,newHeight:neutral.height,png:sheet.toDataURL()};
  },id);
  await writeFile(new URL('096-'+id+'-patterns.png',out),Buffer.from(report.png.split(',')[1],'base64'));
  assert.ok(Math.abs(report.oldHeight-report.newHeight)<=2,id+' body size changed');assert.equal(report.distinctPreparations,report.proof.length);
  for(const r of report.proof){assert.equal(r.drawings,6);if(r.pattern==='royalMarch')assert.ok(r.heights[2]<=r.heights[0]+3,'the crouched charge contains a detached sprite artifact');assert.ok(r.changes>200,'the actual silhouette must move from preparation into the strike');patterns++;}
  await scene(p,id);const walk=await p.evaluate(()=>{const{game:g,art,bosses}=window.__seventh,e=g.world.boss,start=e.x,frames=new Set();g.paused=false;for(let i=0;i<150;i++){g.update(1/60);const pose=bosses.bossPose(e);if(pose.role==='walk')frames.add(art.cell(pose.sheet,pose.col,pose.row).toDataURL());}g.paused=true;const before=bosses.bossPose(e);g.damageEnemy(e,7,1,230,'light3');return{distance:start-e.x,frames:frames.size,before,after:bosses.bossPose(e),state:e.state,stagger:e.stagger};});
  assert.ok(walk.distance>65);assert.equal(walk.frames,6);assert.equal(walk.state,'idle');assert.equal(walk.stagger,0);assert.deepEqual(walk.before,walk.after);
  await shot(p,id+'-walking');console.log('PASS',id,report.proof.length,'distinct pattern preparations, six actual drawings each, original body height, grounded feet and walking that survives an ordinary hit');
 }
 assert.equal(patterns,33);
 await scene(p,'edran','sweep');await p.evaluate(()=>window.__seventh.game.paused=false);
 await p.waitForFunction(()=>{const{game:g,bosses}=window.__seventh,e=g.world.boss;return e.state==='windup'&&bosses.bossWindup(e)-e.t<.08;});await p.keyboard.press('l');await p.waitForFunction(()=>window.__seventh.game.world.boss.stagger>.5);assert.equal(await p.evaluate(()=>window.__seventh.game.p.hp),100);assert.equal(await p.evaluate(()=>window.__seventh.bosses.bossPose(window.__seventh.game.world.boss).role),'parry');await shot(p,'standing-parry');await p.evaluate(()=>window.__seventh.game.paused=false);await p.keyboard.press('j');assert.equal(await p.evaluate(()=>window.__seventh.game.p.action.kind),'counter');await p.waitForFunction(()=>window.__seventh.game.world.boss.hp<window.__seventh.game.world.boss.maxHp);await shot(p,'standing-counter');
 console.log('PASS actual L parry, upright stagger and J counter against a real boss attack');
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true}),m=await mobile.newPage();m.on('pageerror',e=>errors.push(e.stack));await boot(m);await scene(m,'brag','hammer');await m.evaluate(()=>window.__seventh.game.paused=false);await m.waitForFunction(()=>{const{game:g,bosses}=window.__seventh,e=g.world.boss;return e.state==='windup'&&bosses.bossWindup(e)-e.t<.025;});await m.locator('[data-press="parry"]').tap();await m.waitForFunction(()=>window.__seventh.game.world.boss.stagger>.5);assert.equal(await m.evaluate(()=>window.__seventh.game.p.hp),100);assert.equal(await m.evaluate(()=>window.__seventh.bosses.bossPose(window.__seventh.game.world.boss).role),'parry');await shot(m,'mobile-standing-parry');await m.evaluate(()=>window.__seventh.game.paused=false);await m.locator('[data-press="attack"]').tap();assert.equal(await m.evaluate(()=>window.__seventh.game.p.action.kind),'counter');await m.waitForFunction(()=>window.__seventh.game.world.boss.hp<window.__seventh.game.world.boss.maxHp);await shot(m,'mobile-boss-counter');assert.equal(await m.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await mobile.close();
 assert.deepEqual(errors,[]);console.log('PASS actual mobile block/counter, dedicated boss sprites, no knockdown reaction and no browser errors');
}finally{await browser.close();}
