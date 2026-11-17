import {fineSprite} from './pixel-atlas.js';
import {terrainTile} from './pixel-atlas.js';
import {WORLD,isWater,isPath,riverX,onBridge} from './data.js';
import {valleyPier} from './valley-data.js';
import {townRoadDistance} from './world-composition.js';
const SIZE=768,D=2,supertiles=new Map();let scratch=null;
function canvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
const distance=(x,y,cx,cy,rx,ry)=>Math.sqrt(((x-cx)/rx)**2+((y-cy)/ry)**2)-1;
function shore(x,y){if(onBridge(x,y)||valleyPier(x,y))return 90;return Math.min(Math.abs(x-riverX(y))-47,distance(x,y,1310,1130,265,175)*175,x>3000?distance(x,y,3450,870,290,235)*235:900,3570-x);}
function alpha(value){return Math.max(0,Math.min(255,Math.round(value*255)));}
function masks(ox,oy,w,h){
 const mw=Math.ceil(w/2),mh=Math.ceil(h/2);
 const names=['forest','road','stone','shore','water','farm','marsh','flowers','highland'],out=Object.fromEntries(names.map(id=>[id,{canvas:canvas(mw,mh),image:null}]));for(const q of Object.values(out))q.image=q.canvas.getContext('2d').createImageData(mw,mh);
 for(let y=0;y<mh;y++)for(let x=0;x<mw;x++){const xx=x*2+ox,yy=y*2+oy,i=(y*mw+x)*4+3,water=isWater(xx,yy),bank=shore(xx,yy),wave=Math.sin(xx*.065+Math.sin(yy*.047))*1.6+Math.sin(yy*.11)*.7;
  const forest=xx<260||yy<420||xx>1200&&xx<1870&&yy<1020||xx>2770&&yy>2040;
  out.highland.image.data[i]=xx>1800&&yy<650?alpha(Math.max(0,1-(((xx-2210)/420)**2+((yy-350)/300)**2))*.85):0;
  out.forest.image.data[i]=forest?alpha(.6+Math.sin(xx*.017)*Math.cos(yy*.014)*.24):0;
  const town=townRoadDistance(xx,yy),village=xx>295&&xx<1030&&yy>330&&yy<930;
  const road=isPath(xx,yy)||town<3+wave;out.road.image.data[i]=road?255:0;
  const plaza=((xx-620)/94)**2+((yy-659)/72)**2<1;out.stone.image.data[i]=!water&&(plaza||village&&town<4+wave)?255:0;
  out.shore.image.data[i]=!water&&bank<12+wave?alpha((14-bank)/12):0;out.water.image.data[i]=water?255:0;
  out.farm.image.data[i]=(xx>294&&xx<531&&yy>949&&yy<1098||xx>729&&xx<870&&yy>983&&yy<1101||xx>1940&&xx<2280&&yy>1378&&yy<1718)&&!water?255:0;
  out.marsh.image.data[i]=yy>2180&&xx>1250&&xx<2150&&!water&&!road?alpha(.6+Math.sin(xx*.025)*.2):0;
  out.flowers.image.data[i]=!forest&&!water&&!road&&Math.sin(xx*.011+1)*Math.sin(yy*.009)>.53?alpha(.6):0;
 }
 for(const q of Object.values(out))q.canvas.getContext('2d').putImageData(q.image,0,0);return out;
}
function patternLayer(ctx,index,mask,ox,oy,w,h){if(!scratch||scratch.width!==w*D||scratch.height!==h*D)scratch=canvas(w*D,h*D);const c=scratch,a=c.getContext('2d');a.setTransform(1,0,0,1,0,0);a.globalCompositeOperation='source-over';a.clearRect(0,0,c.width,c.height);a.imageSmoothingEnabled=false;a.scale(D,D);a.translate(-ox,-oy);const tile=terrainTile(index),tileWorld=80;
 // Mirrored 2x2 supertiles meet at identical pixels, avoiding visible hard seams.
 let mirror=supertiles.get(index);if(!mirror){mirror=canvas(tile.width*2,tile.height*2);const m=mirror.getContext('2d');for(let row=0;row<2;row++)for(let col=0;col<2;col++){m.save();m.translate((col+1)*tile.width,(row+1)*tile.height);m.scale(col?-1:1,row?-1:1);m.drawImage(tile,col?0:-tile.width,row?0:-tile.height);m.restore();}supertiles.set(index,mirror);}
 const p=a.createPattern(mirror,'repeat');p.setTransform(new DOMMatrix().scale(tileWorld/tile.width));a.fillStyle=p;a.fillRect(ox,oy,w,h);a.setTransform(1,0,0,1,0,0);if(mask){a.globalCompositeOperation='destination-in';a.drawImage(mask,0,0,w*D,h*D);}ctx.drawImage(c,0,0);
}
export function makeOutdoorTerrain(){const started=performance.now(),chunks=[];for(let oy=0;oy<WORLD.h;oy+=SIZE)for(let ox=0;ox<WORLD.w;ox+=SIZE){const w=Math.min(SIZE,WORLD.w-ox),h=Math.min(SIZE,WORLD.h-oy),c=canvas(w*D,h*D),ctx=c.getContext('2d');c.density=D;const q=masks(ox,oy,w,h);patternLayer(ctx,0,null,ox,oy,w,h);for(const[id,index]of [['forest',1],['highland',7],['flowers',9],['marsh',6],['road',2],['stone',3],['farm',4],['shore',5],['water',8]])patternLayer(ctx,index,q[id].canvas,ox,oy,w,h);ctx.setTransform(D,0,0,D,-ox*D,-oy*D);drawBridges(ctx);drawTownGround(ctx);chunks.push({x:ox,y:oy,canvas:c});}return{width:WORLD.w*D,height:WORLD.h*D,density:D,chunks,buildMs:performance.now()-started};}
function drawBridges(c){for(const y of[680,2160,2500]){const x=Math.round(riverX(y));c.fillStyle='#443c2f';c.fillRect(x-105,y-27,210,55);for(let xx=x-102;xx<x+103;xx+=7){c.fillStyle=xx%3?'#a88758':'#98764d';c.fillRect(xx,y-24,6,47);c.fillStyle='#d7b984';c.fillRect(xx,y-24,1,47);c.fillStyle='#4d493b';c.fillRect(xx+3,y-20,1,2);c.fillRect(xx+3,y+17,1,2);}for(const yy of[y-27,y+25]){c.fillStyle='#e4c590';c.fillRect(x-107,yy,214,3);c.fillStyle='#685641';c.fillRect(x-107,yy+3,214,2);}for(let xx=x-103;xx<=x+103;xx+=41){c.fillStyle='#584b38';c.fillRect(xx,y-39,5,15);c.fillRect(xx,y+19,5,17);c.fillStyle='#ba9962';c.fillRect(xx,y-39,3,14);c.fillRect(xx,y+19,3,15);}}
 for(let x=3230;x<3640;x+=8){c.fillStyle='#a88a5d';c.fillRect(x,628,7,45);c.fillStyle='#d9c192';c.fillRect(x,628,1,45);}c.fillStyle='#695d45';c.fillRect(3230,672,410,4);
}
function drawTownGround(c){
 // The well mosaic, field borders and villagers' established crops ground the village.

 for(let row=0;row<6;row++)for(let col=0;col<7;col++){const img=fineSprite('crop_'+(col<4?'wheat':'carrot')+'_3');c.drawImage(img,304+col*32,940+row*24,32,39);}for(const[x,y,h]of[[536,946,158],[876,982,123]]){c.fillStyle='#5b624c';c.fillRect(x,y,4,h);c.fillStyle='#77a9a1';c.fillRect(x+1,y,2,h);}
 c.strokeStyle='#bdab81';c.lineWidth=3;c.beginPath();c.ellipse(620,568,29,15,0,0,Math.PI*2);c.stroke();c.strokeStyle='#706f53';c.lineWidth=1;c.beginPath();c.ellipse(620,568,34,18,0,0,Math.PI*2);c.stroke();
 for(const[x,y,w,h]of[[290,946,245,158],[726,979,148,127],[1938,1376,345,345]]){c.strokeStyle='#af9973';c.lineWidth=3;c.strokeRect(x,y,w,h);c.strokeStyle='#6d5b43';c.lineWidth=1;c.strokeRect(x-2,y-2,w+4,h+4);}
}
export function fillFloor(ctx,index,x,y,w,h){const tile=terrainTile(index,index===16?512:index===15?256:128);if(!tile)return false;ctx.save();ctx.imageSmoothingEnabled=false;if(index===16){ctx.drawImage(tile,x,y,w,h);ctx.restore();return true;}let image=tile;if(index>=12){const key='floor:'+index;if(!supertiles.has(key)){const m=canvas(tile.width*2,tile.height*2),c=m.getContext('2d');for(let row=0;row<2;row++)for(let col=0;col<2;col++){c.save();c.translate((col+1)*tile.width,(row+1)*tile.height);c.scale(col?-1:1,row?-1:1);c.drawImage(tile,col?0:-tile.width,row?0:-tile.height);c.restore();}supertiles.set(key,m);}image=supertiles.get(key);}const p=ctx.createPattern(image,'repeat');p.setTransform(new DOMMatrix().scale(.5));ctx.fillStyle=p;ctx.fillRect(x,y,w,h);if(index===7){ctx.fillStyle='#263e4580';ctx.fillRect(x,y,w,h);}ctx.restore();return true;}
