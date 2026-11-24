import {ATLAS_LAYOUT} from './atlas-layout.js';
import {nativeEnemyPose} from './enemy-species.js';
import {heroPalette,matchHeroPalette} from './hero-palette.js';
import {HERO_BASE_SIZE} from './hero-rig.js';
import {STEEL} from './cuts.js';
import {registeredPose} from './blade.js';
import {bossPose} from './boss-motion.js';
import {CREATURE_SHEETS} from './creature-motion.js';
import {MINIBOSS_SHEETS} from './miniboss-data.js';
export const SHEETS={...CREATURE_SHEETS,...MINIBOSS_SHEETS,'story-scenes':[2,3,128],'finale-scenes':[2,2,128],'journey-objects':[6,4,128],'edran-unshielded':[6,6,192],'arkein-uncloaked':[6,6,192],...Object.fromEntries(Array.from({length:7},(_,i)=>['foes-'+(i+1),[6,9,128]])),'combat-atlas':[6,4,128],'neris-motion':[6,9,192],'carillon-motion':[6,9,192],'late-objects':[4,3,128],'edran-motion':[6,9,192],'marie-motion':[6,9,192],'brag-motion':[6,9,192],'leonel-motion':[6,9,192],'arkein-motion':[6,9,192],'gait-walk':[6,4,128],'gait-run':[6,4,128],'gait-transitions':[6,4,128],'cut-light1':[6,4,128],'cut-light2':[6,4,128],'cut-light3':[6,4,128],'cut-heavy':[6,4,128],'cut-air':[6,4,128],'cut-plunge':[6,4,128],'cut-thrust':[6,4,128],'cut-body':[8,4,128],'steel-blade':[1,1,128],tutor:[6,4,128],swordplay:[8,4,128],'motion-extras':[8,4,128],'echo-blade':[4,2,128],arkein:[6,4,128],traps:[4,3,128],repairman:[8,8,64],remnants:[8,6,64],edran:[6,4,128],marie:[6,4,128],brag:[6,4,128],leonel:[6,4,128],services:[4,2,128],'archive-objects':[4,2,128],objects:[4,4,128],masonry:[4,4,128]};
const sheets=new Map(),cache=new Map(),sprites=new Map(),loaded=new Set();
const backgrounds=['kingdom','ruins','cathedral','foundry','archive','palace','harbor','belltower'];
const fullSheets=new Set([...backgrounds,'story-scenes','finale-scenes']);
const allocation={sourceBytes:0,cellBytes:0,peakBytes:0,decoding:0,peakDecoding:0,ready:false,runtimeBuilds:0};
const countAllocation=()=>{allocation.peakBytes=Math.max(allocation.peakBytes,allocation.sourceBytes+allocation.cellBytes);};
let palette;
const heroSheets=new Set(['repairman','cut-body','motion-extras','swordplay',...Object.keys(SHEETS).filter(k=>k.startsWith('cut-')||k.startsWith('gait-'))]);
function matchHero(id,data){
 if(!heroSheets.has(id))return;
 if(!palette){const im=sheets.get('cut-body'),c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(im,0,im.height*3/4,im.width/8,im.height/4,0,0,128,128);palette=heroPalette(ctx.getImageData(0,0,128,128).data);}
 matchHeroPalette(data,palette,id.startsWith('gait-'));
}
async function decodeArt(id){const url=new URL('../assets/'+id+'.png',import.meta.url).href+new URL(import.meta.url).search,response=await fetch(url);if(!response.ok)throw Error('Artwork '+id+': '+response.status);const blob=await response.blob();
 if(typeof createImageBitmap==='function'){const image=await createImageBitmap(blob);return{image,release:()=>image.close()};}
 const objectURL=URL.createObjectURL(blob),image=new Image();try{await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=objectURL;});}finally{URL.revokeObjectURL(objectURL);}return{image,release:()=>{image.src='';}};
}
export async function loadArt(progress=()=>{}){
 const ids=['cut-body',...Object.keys(SHEETS).filter(id=>id!=='cut-body'),...backgrounds];let done=0,next=1;
 async function prepare(id){allocation.decoding++;allocation.peakDecoding=Math.max(allocation.peakDecoding,allocation.decoding);let source,bytes=0,retained=false;
  try{source=await decodeArt(id);const im=source.image;bytes=im.width*im.height*4;allocation.sourceBytes+=bytes;countAllocation();sheets.set(id,im);
   if(SHEETS[id]){const[cols,rows]=SHEETS[id];let yieldAt=performance.now();for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){sprite(id,col,row);if(performance.now()-yieldAt>6){await new Promise(resolve=>setTimeout(resolve,0));yieldAt=performance.now();}}}
   retained=fullSheets.has(id);loaded.add(id);progress(++done/ids.length);
  }finally{if(source&&!retained){sheets.delete(id);source.release();allocation.sourceBytes-=bytes;}allocation.decoding--;}
 }
 // Establish the hero's material palette before preparing any dependent sheet.
 // Two source bitmaps at a time; large originals are closed as soon as their
 // final, crisp game-sized cells are ready. No first-contact raster work.
 await prepare(ids[0]);await Promise.all(Array.from({length:2},async()=>{while(next<ids.length){const id=ids[next++];await prepare(id);}}));allocation.ready=true;
}
export function sheet(id){return sheets.get(id);}
export function sprite(id,col,row){const key=[id,col,row].join(':');if(sprites.has(key))return sprites.get(key);const im=sheets.get(id);if(!im)throw Error('Missing artwork '+id+' '+row+':'+col);if(allocation.ready)allocation.runtimeBuilds++;const [cols,rows,size]=SHEETS[id],c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;let sx=col*im.width/cols,sy=row*im.height/rows,sw=im.width/cols,sh=im.height/rows;
 if(id==='objects'||id==='masonry'){const ys=[0,.23,.487,.744,1];sy=im.height*ys[row];sh=im.height*(ys[row+1]-ys[row]);if(row===0){sy+=12;sh-=15;}}
 const registered=ATLAS_LAYOUT[id];if(registered){const[a,b,w,h,center]=registered.cells[row][col],scale=registered.scale;ctx.drawImage(im,a,b,w,h,size/2+(a-center)*scale,registered.bottom-h*scale,w*scale,h*scale);}else ctx.drawImage(im,sx,sy,sw,sh,0,0,size,size);let data=ctx.getImageData(0,0,size,size);if(id==='archive-objects'&&row===1&&col<3||id==='late-objects'&&row===2){let minX=size,minY=size,maxX=0,maxY=0;for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data.data[(y*size+x)*4+3]>=150){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}if(minX<=maxX){const copy=document.createElement('canvas');copy.width=copy.height=size;copy.getContext('2d').drawImage(c,0,0);ctx.clearRect(0,0,size,size);ctx.drawImage(copy,minX,minY,maxX-minX+1,maxY-minY+1,0,0,size,size);data=ctx.getImageData(0,0,size,size);}}
 for(let i=3;i<data.data.length;i+=4)data.data[i]=id==='masonry'?255:data.data[i]>=150?255:0;matchHero(id,data.data);let bottom=0;for(let i=3;i<data.data.length;i+=4)if(data.data[i])bottom=Math.floor(i/(size*4))+1;let minX=size,minY=size,maxX=-1,maxY=-1;for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data.data[(y*size+x)*4+3]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 const b=maxX<minX?{x:0,y:0,w:1,h:1}:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1},image=document.createElement('canvas');image.width=b.w;image.height=b.h;image.getContext('2d',{willReadFrequently:true}).putImageData(data,-b.x,-b.y,b.x,b.y,b.w,b.h);c.width=c.height=0;
 const result={image,width:size,height:size,sourceAspect:sw/sh,opaqueBounds:b,footPad:size-bottom};sprites.set(key,result);allocation.cellBytes+=b.w*b.h*4;countAllocation();return result;
}
// All game rendering uses the trimmed image with its original logical pivot.
// Full-square cells remain available for inspection, with a small bounded cache.
export function cell(id,col,row){const key=[id,col,row].join(':');if(cache.has(key)){const im=cache.get(key);cache.delete(key);cache.set(key,im);return im;}const s=sprite(id,col,row),c=document.createElement('canvas');c.width=s.width;c.height=s.height;c.getContext('2d').drawImage(s.image,s.opaqueBounds.x,s.opaqueBounds.y);Object.assign(c,{sourceAspect:s.sourceAspect,opaqueBounds:s.opaqueBounds,footPad:s.footPad});cache.set(key,c);if(cache.size>16)cache.delete(cache.keys().next().value);return c;}
export function paintSprite(ctx,s,...args){let sx=0,sy=0,sw=s.width,sh=s.height,dx,dy,dw,dh;if(args.length===2){[dx,dy]=args;dw=sw;dh=sh;}else if(args.length===4)[dx,dy,dw,dh]=args;else[sx,sy,sw,sh,dx,dy,dw,dh]=args;const b=s.opaqueBounds,left=Math.max(sx,b.x),top=Math.max(sy,b.y),right=Math.min(sx+sw,b.x+b.w),bottom=Math.min(sy+sh,b.y+b.h);if(right<=left||bottom<=top||sw<=0||sh<=0)return;ctx.drawImage(s.image,left-b.x,top-b.y,right-left,bottom-top,dx+(left-sx)*dw/sw,dy+(top-sy)*dh/sh,(right-left)*dw/sw,(bottom-top)*dh/sh);}
export function drawCell(ctx,id,col,row,...args){paintSprite(ctx,sprite(id,col,row),...args);}
export const PROP={arch:[0,1],tower:[1,1],trainingExit:[2,1],shrine:[2,1],gate:[3,1],tree:[0,2],statue:[1,2],columns:[2,2],lift:[3,2],chest:[0,3],lantern:[1,3],lever:[2,3],npc:[3,3],letter:[0,3],bellrope:[2,3],valve:[2,3],ending:[1,1],archiveway:[1,1]};
export function draw(ctx,id,col,row,x,y,w,h,flip=false,alpha=1,alignFeet=false){const im=sprite(id,col,row);ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x),Math.round(y+(alignFeet?im.footPad*h/im.height:0)));if(flip)ctx.scale(-1,1);paintSprite(ctx,im,Math.round(-w/2),Math.round(-h),w,h);ctx.restore();}
const ARCHIVE_PROP={archiveShelf:[0,0],lectern:[1,0],finalrecord:[1,0],indexwheel:[2,0],archiveLamp:[3,0],archiveChest:[3,1]};
const ROYAL_PROP={royallever:[0,2],royalChest:[1,2],clockwork:[2,2],bellpart:[3,2],palaceway:[0,2]};
const LATE_PROP={'route-lever':[1,0],'route-lift':[3,1],'cooling-valve':[1,0],dockkeeper:[0,0],dockworker:[0,0],dockwinch:[1,0],beacon:[2,0],dockcargo:[3,0],resonator:[0,1],towerlens:[1,1],lateChest:[2,1],gearwheel:[3,1],harborway:[2,0]};
const SERVICE_PROP={workshop:[0,0],supplycart:[1,0],lockedChest:[3,0]};
export function gatePanel(ctx,gate){const im=sprite('services',2,0),b=im.opaqueBounds;paintSprite(ctx,im,b.x,b.y,b.w,b.h,Math.round(gate.x),Math.round(gate.y),gate.w,gate.h);}
export function prop(ctx,type,x,y,size=128,alpha=1){const late=LATE_PROP[type],service=SERVICE_PROP[type],archive=ARCHIVE_PROP[type],royal=ROYAL_PROP[type],[col,row]=late||service||archive||royal||PROP[type];draw(ctx,late?'late-objects':service?'services':archive?'archive-objects':royal?'traps':'objects',col,row,x,y,size,size,false,alpha,true);}
export function actionFrame(a,t){return t<a.windup?0:t<a.end?(t<(a.windup+a.end)/2?1:2):3;}
export function heroFrame(p,clock){if(p.dead)return[7,4+Math.min(3,Math.floor(p.deathT*4))];if(p.hurt>0)return[6,6+Math.min(1,Math.floor((.3-p.hurt)*8))];const a=p.action;if(a){if(a.kind==='dash')return[6,Math.min(3,Math.floor(a.t/.28*4))];if(a.kind==='parry')return[6,a.t<.20?4:5];return[a.spec.row,a.spec.start+actionFrame(a.spec,a.t)];}if(p.land>0)return[3,p.land>.06?6:7];if(!p.grounded)return[3,p.vy<-80?2:p.vy<70?3:4];if(Math.abs(p.vx)>12)return[Math.abs(p.vx)>140?2:1,Math.floor(p.walk/(Math.abs(p.vx)>140?76:54)*8)%8];return[0,Math.floor(clock*6)%8];}
const ghostCache=new Map();
function ghostCell(id,col,row){const key=[id,col,row].join(':');if(ghostCache.has(key))return ghostCache.get(key);const src=sprite(id,col,row),image=document.createElement('canvas');image.width=src.image.width;image.height=src.image.height;const ctx=image.getContext('2d');ctx.drawImage(src.image,0,0);ctx.globalCompositeOperation='source-in';ctx.fillStyle='#91b9b2';ctx.fillRect(0,0,image.width,image.height);const result={...src,image};ghostCache.set(key,result);return result;}
function paintSteel(ctx,pose){const im=sprite('steel-blade',0,0),b=im.opaqueBounds,s=pose.size/128,w=STEEL.length/(1-STEEL.guard),h=w*b.h/b.w/im.sourceAspect*1.35;ctx.save();ctx.translate((pose.hand[0]-pose.root)*s,(pose.hand[1]-pose.foot)*s);ctx.rotate(pose.angle*Math.PI/180);paintSprite(ctx,im,b.x,b.y,b.w,b.h,-STEEL.grip*w,-STEEL.axis*h,w,h);ctx.restore();}
export function drawPose(ctx,pose,x,y,dir,alpha=1,ghost=false){const s=pose.size/128,im=ghost?ghostCell(pose.sheet,pose.col,pose.row):sprite(pose.sheet,pose.col,pose.row);ctx.save();ctx.globalAlpha*=alpha;ctx.translate(Math.round(x),Math.round(y));if(dir<0)ctx.scale(-1,1);const behind=pose.steel&&(pose.bladeBehind||Math.cos(pose.angle*Math.PI/180)<0);if(behind)paintSteel(ctx,pose);paintSprite(ctx,im,-pose.root*s,-pose.foot*s,pose.size,pose.size);if(pose.steel&&!behind){paintSteel(ctx,pose);const [hx,hy]=pose.hand;paintSprite(ctx,im,hx-3,hy-3,6,6,(hx-pose.root-3)*s,(hy-pose.foot-3)*s,6*s,6*s);}ctx.restore();}
export function drawHero(ctx,p,clock){const pose=!p.dead&&p.hurt<=0&&registeredPose(p,clock);if(!pose){const [row,col]=heroFrame(p,clock);draw(ctx,'repairman',col,row,p.x,p.y,HERO_BASE_SIZE,HERO_BASE_SIZE,p.dir<0,1,p.grounded);return;}drawPose(ctx,pose,p.x,p.y,p.dir);}
export function drawBoss(ctx,e){const pose=bossPose(e);if(!pose)return false;const im=sprite(pose.sheet,pose.col,pose.row),scale=pose.size/192;ctx.save();ctx.imageSmoothingEnabled=false;if(e.teleportFade>0)ctx.globalAlpha=.5;ctx.translate(Math.round(e.x+(e.hit>0?(e.hitDir||0)*Math.sin(e.hit/.13*Math.PI)*1.5:0)),Math.round(e.y));if(e.dir<0)ctx.scale(-1,1);paintSprite(ctx,im,-pose.root*scale,-pose.foot*scale,pose.size,pose.size);ctx.restore();return true;}
export function boundedProp(ctx,col,row,x,y,w,h,center=false){const im=sprite('traps',col,row),b=im.opaqueBounds;paintSprite(ctx,im,b.x,b.y,b.w,b.h,Math.round(x-w/2),Math.round(y-(center?h/2:h)),w,h);}
export function enemyFrame(e,clock){const native=nativeEnemyPose(e);if(native)return[native.row,native.col];if(e.boss){if(['neris','carillon'].includes(e.id)){if(e.dead)return[6,Math.min(5,Math.floor(e.deathT*3))];if(e.state==='weakened')return[7,3];if(e.state==='transition')return[7,2];}if(e.dead)return[3,Math.min(5,3+Math.floor(e.deathT*2))];if(e.state==='weakened')return[3,e.id==='edran'?2:3];if(e.state==='transition')return[e.id==='edran'?2:3,e.id==='edran'?0:2];const pose=bossPose(e);return pose?[pose.row,pose.col]:[0,0];}

 const base=e.type==='watchman'?0:e.type==='cantor'?2:4;if(e.dead)return[base+1,Math.min(7,6+Math.floor(e.deathT*2))];if(e.stagger>0)return[base+1,4+Math.floor(clock*9)%2];if(e.state==='windup')return[base+1,Math.min(1,Math.floor(e.t*3))];if(e.state==='attack')return[base+1,2+Math.floor(e.t*10)%2];return[base,Math.floor(e.walk*.1||clock*(e.flying?9:5))%8];}
export function artStats(){return {loaded:[...loaded],cached:sprites.size,inspectionCells:cache.size,retainedSheets:sheets.size,memory:{...allocation},heroFrames:400,cutBodyFrames:32,attackClips:7,attackFrames:168,framesPerAttack:24,enemyFrames:378,bossFrames:666,trainingFrames:24,locomotionFrames:72,bossMotionFrames:450,minibossFrames:378,minibossMovementFrames:168,creatureMovementFrames:720,framesPerCreatureCycle:24};}
