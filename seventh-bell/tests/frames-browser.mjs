import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';

const out=new URL('../test-results/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const p=await browser.newPage({viewport:{width:1440,height:960}}),errors=[];
p.on('pageerror',e=>errors.push(e.stack));
try{
 await p.goto((process.env.BASE_URL||'http://127.0.0.1:4190/')+'?test=1');
 await p.waitForFunction(()=>window.__seventh,null,{timeout:60000});
 await p.click('#skip-tutorial');await p.click('#letter-close');
 const clips=await p.evaluate(()=>window.__seventh.poses.CUT_CLIPS);
 for(const clip of clips){
  const report=await p.evaluate(clip=>{
   const{game:g,art,poses}=window.__seventh,{registeredPose,worldBlade,ATTACKS}=poses;
   const kind=clip==='air'?'light1':clip,spec=ATTACKS[kind];
   const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;
   const c=canvas.getContext('2d');c.imageSmoothingEnabled=false;
   const body=new Set(),silhouettes=new Set(),drawings=new Set();
   for(let frame=0;frame<24;frame++){
    const t=frame<4?spec.windup*(frame+.5)/4:frame<6?spec.windup+(spec.end-spec.windup)*(frame-4+.5)/2:spec.end+(spec.duration-spec.end)*(frame-6+.5)/18;
    const actor={x:70,y:138,dir:1,grounded:clip!=='air',action:{kind,spec,t,air:clip==='air',landed:clip==='plunge'&&frame>=5,recoveryT:(frame-5+.5)/19*.36}};
    const pose=registeredPose(actor),im=art.cell(pose.sheet,pose.col,pose.row),pixels=im.getContext('2d').getImageData(0,0,128,128).data;
    let visible=0,mask='';for(let i=3;i<pixels.length;i+=4){if(pixels[i]!==0&&pixels[i]!==255)throw Error('Soft alpha '+clip);if(pixels[i])visible++;mask+=pixels[i]?'1':'0';}
    if(visible<200)throw Error('Empty body frame '+clip+':'+frame);
    if(pose.frame!==frame)throw Error('Wrong actual body frame');
    body.add(im.toDataURL());silhouettes.add(mask);
    const cell=document.createElement('canvas');cell.width=160;cell.height=160;
    const ctx=cell.getContext('2d');ctx.imageSmoothingEnabled=false;
    // Draw the actual character and blade only: no trails, particles, ghosts,
    // enemies or hit flashes can make an unchanged body look animated here.
    art.drawPose(ctx,pose,actor.x,actor.y,1);
    drawings.add(cell.toDataURL());
    c.drawImage(cell,(frame%6)*160,Math.floor(frame/6)*160);
    c.fillStyle='#bfcfc7';c.font='10px monospace';c.fillText(String(frame+1).padStart(2,'0'),(frame%6)*160+10,Math.floor(frame/6)*160+18);
    const blade=worldBlade(actor);if(Math.abs(Math.hypot(blade.bx-blade.ax,blade.by-blade.ay)-48)>1e-6)throw Error('Sword registration changed');
   }
   // Audit the real game update at normal 60 Hz, again without an afterimage.
   g.paused=false;g.world.enemies=[];g.world.traps=[];g.p.action=null;g.p.comboQueued=false;
   Object.assign(g.p,{x:190,y:['air','plunge'].includes(clip)?200:302,vx:0,vy:0,grounded:!['air','plunge'].includes(clip),stamina:100,hurt:0,land:0});
   g.startAttack(kind);const serial=g.p.action.serial,played=new Set();
   for(let i=0;i<140&&g.p.action?.serial===serial;i++){
    const pose=registeredPose(g.p);played.add(pose.frame);
    g.bladeEchoes=[];g.effects=[];g.update(1/60);
   }
   g.paused=true;
   return{body:body.size,silhouettes:silhouettes.size,drawings:drawings.size,played:[...played],sheet:canvas.toDataURL()};
  },clip);
  assert.equal(report.body,24,clip+' must contain 24 different actual body images');
  assert.ok(report.silhouettes>=20,clip+' must change body silhouette, not just texture or blade rotation');
  assert.equal(report.drawings,24);
  assert.ok(report.played.length>=20,clip+' must actually play at least 20 stages at normal 60 Hz');
  await writeFile(new URL('091-'+clip+'-24-poses.png',out),Buffer.from(report.sheet.split(',')[1],'base64'));
  console.log('PASS',clip,JSON.stringify({body:report.body,silhouettes:report.silhouettes,drawings:report.drawings,played:report.played.length}));
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
