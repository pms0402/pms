// Reads raster landmarks; writes anchors only, never modifies the source art.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
try{const p=await browser.newPage();await p.goto((process.env.BASE_URL||'http://127.0.0.1:4191/')+'?test=1');await p.waitForFunction(()=>window.__seventh,null,{timeout:90000});
 const rig=await p.evaluate(async()=>{
  const{SPECIES}=await import('../src/enemy-species.js'),{FOE_GAIT_SOURCES}=await import('../src/creature-motion.js'),{BOSS_RIG}=await import('../src/boss-motion.js'),{REGISTERED_FEET}=await import('../src/boss-registration.js'),{art}=window.__seventh,out={};
  function landmark(im,kind){const b=im.opaqueBounds,d=im.getContext('2d').getImageData(0,0,im.width,im.height).data,points=[];
   for(let y=b.y;y<b.y+b.h;y++)for(let x=b.x;x<b.x+b.w;x++){const i=(y*im.width+x)*4,[r,g,blue,a]=d.slice(i,i+4),u=(x-b.x)/b.w,v=(y-b.y)/b.h;if(!a)continue;let take;
    if(kind==='raven')take=u>.72&&r>140&&g>105&&blue<r*.85;
    else if(kind==='lanternwraith')take=u>.3&&u<.7&&g>110&&g>r*1.15&&blue>r*1.1;
    else if(kind==='resonator')take=blue>105&&blue>r*1.25&&blue>g*1.08;
    else if(kind==='choirghost'||kind==='paperghost')take=u>.66&&v<.7&&r>150&&g>140&&blue>120&&Math.max(r,g,blue)-Math.min(r,g,blue)<80;
    else take=v<.3&&x>im.width*.28&&x<im.width*.73;
    if(take)points.push([x,y]);
   }
   if(!points.length)throw Error('Missing body landmark: '+kind);
   // Median resists stray hair, cloth, detached feathers and antialias remnants.
   return{x:points.map(v=>v[0]).sort((a,b)=>a-b)[Math.floor(points.length/2)],y:points.map(v=>v[1]).sort((a,b)=>a-b)[Math.floor(points.length/2)]};
  }
  function register(sheet,row,reference,oldSize,oldFoot,kind,flying,size){const first=art.cell(sheet,0,row),oldMark=landmark(reference,kind),target=reference.opaqueBounds.h*oldSize/reference.width;size??=target*first.width/first.opaqueBounds.h;const feet=[],roots=[];
   for(let frame=0;frame<24;frame++){const im=art.cell(sheet,frame%6,row+Math.floor(frame/6)),mark=landmark(im,kind);roots.push(+(mark.x-(oldMark.x-reference.width/2)*oldSize/reference.width*im.width/size).toFixed(3));feet.push(+(flying?mark.y-(oldMark.y-oldFoot)*oldSize/reference.width*im.width/size:im.height-im.footPad).toFixed(3));}
   (out[sheet]??={})[row]={size:+size.toFixed(3),roots,feet};
  }
  for(const d of Object.values(SPECIES)){const old=art.cell(d.sheet,0,d.slot*3),size=d.role==='cart'?140:d.role==='ink'?96:112,single=FOE_GAIT_SOURCES[d.id];register(single||d.sheet+'-gait',single?0:d.slot*4,old,size,d.flying?128:128-old.footPad,d.id,d.flying);}
  for(const[id,r]of Object.entries(BOSS_RIG)){if(id.includes('-'))continue;const old=art.cell(id+'-motion',0,0);register(id+'-gait',0,old,r.size,REGISTERED_FEET[id][0][0],id,false);if(['edran','arkein'].includes(id)){const source=id==='edran'?'edran-unshielded':'arkein-uncloaked';register(id+'-gait',4,art.cell(source,0,0),r.size,REGISTERED_FEET[source][0][0],id,false,out[id+'-gait'][0].size);}}
  return out;
 });
 await writeFile(new URL('../src/creature-registration.js',import.meta.url),'// Fixed source-art scale, planted soles and measured head/body pivots. No source pixels edited.\nexport const CREATURE_RIG='+JSON.stringify(rig)+';\n');
 console.log('Registered',Object.values(rig).reduce((n,g)=>n+Object.keys(g).length,0),'24-pose cycles');
}finally{await browser.close();}
