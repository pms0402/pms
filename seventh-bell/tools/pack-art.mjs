// Compile the existing exact render pixels into lossless runtime atlases.
// No drawing, resampling or source-PNG modification takes place in this tool.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile,readdir,unlink,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {artInputs,BACKDROPS} from './art-inputs.mjs';
const base=process.env.BASE_URL||'http://127.0.0.1:4191/',dir=new URL('../assets/packed/',import.meta.url),input=await artInputs(),temp=await mkdtemp(join(tmpdir(),'bell-art-')),run=promisify(execFile);await mkdir(dir,{recursive:true});
async function encode(input,prefix){const target=join(temp,prefix+'.webp');await run('ffmpeg',['-nostdin','-hide_banner','-loglevel','error','-i',input,'-c:v','libwebp','-lossless','1','-compression_level','6','-pix_fmt','bgra','-y',target]);const bytes=await readFile(target),hash=createHash('sha256').update(bytes).digest('hex'),file=prefix+'-'+hash.slice(0,16)+'.webp';await writeFile(new URL(file,dir),bytes);return{file,bytes:bytes.length,hash};}
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
try{const p=await browser.newPage();await p.route('**/art-compiler.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Art compiler</title>'}));await p.goto(base+'art-compiler.html');
 const result=await p.evaluate(async()=>{const art=await import('./src/art.js');await art.loadArt(()=>{},{source:true});window.compilerArt=art;const entries=[];for(const[id,[cols,rows]]of Object.entries(art.SHEETS))for(let row=0;row<rows;row++)for(let col=0;col<cols;col++){const s=art.sprite(id,col,row),b=s.opaqueBounds,pixels=s.image.getContext('2d').getImageData(0,0,b.w,b.h).data,digest=await crypto.subtle.digest('SHA-256',pixels),hash=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');entries.push({key:[id,col,row].join(':'),w:b.w,h:b.h,size:s.width,foot:s.footPad,aspect:s.sourceAspect,bx:b.x,by:b.y,hash});}return entries;});
 // Non-overlapping guillotine bins, one transparent pixel around each cell.
 const limit=2048,pages=[],cells={};result.sort((a,b)=>b.h-a.h||b.w-a.w);
 for(const e of result){const w=e.w+2,h=e.h+2;let best;for(let page=0;page<pages.length;page++)for(let n=0;n<pages[page].free.length;n++){const r=pages[page].free[n];if(w<=r.w&&h<=r.h){const score=Math.min(r.w-w,r.h-h)*limit+Math.max(r.w-w,r.h-h);if(!best||score<best.score)best={page,n,r,score};}}
  if(!best){pages.push({free:[{x:0,y:0,w:limit,h:limit}],entries:[],w:0,h:0});best={page:pages.length-1,n:0,r:pages.at(-1).free[0]};}
  const page=pages[best.page],r=best.r;page.free.splice(best.n,1);const dw=r.w-w,dh=r.h-h;if(dw>dh){if(dw)page.free.push({x:r.x+w,y:r.y,w:dw,h:r.h});if(dh)page.free.push({x:r.x,y:r.y+h,w,h:dh});}else{if(dw)page.free.push({x:r.x+w,y:r.y,w:dw,h});if(dh)page.free.push({x:r.x,y:r.y+h,w:r.w,h:dh});}
  const x=r.x+1,y=r.y+1;cells[e.key]=[best.page,x,y,e.w,e.h,e.size,e.foot,e.aspect,e.bx,e.by,e.hash];page.entries.push({key:e.key,x,y});page.w=Math.max(page.w,r.x+w);page.h=Math.max(page.h,r.y+h);
 }
 const files=[];for(let i=0;i<pages.length;i++){const page=pages[i],data=await p.evaluate(({entries,w,h})=>{const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;for(const e of entries){const[id,col,row]=e.key.split(':'),s=window.compilerArt.sprite(id,+col,+row);ctx.drawImage(s.image,e.x,e.y);}const url=c.toDataURL('image/png');c.width=c.height=0;return url.slice(url.indexOf(',')+1);},page),source=join(temp,'page-'+i+'.png');await writeFile(source,Buffer.from(data,'base64'));files.push({...await encode(source,'sprites-'+i),w:page.w,h:page.h});}
 const backdrops={};for(const id of BACKDROPS){const source=new URL('../assets/'+id+'.png',import.meta.url),partialAlpha=await p.evaluate(id=>{const im=window.compilerArt.sheet(id),c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,c.width,c.height).data;let partial=false;for(let n=3;n<data.length;n+=4)if(data[n]!==0&&data[n]!==255){partial=true;break;}c.width=c.height=0;return partial;},id);if(partialAlpha){const f=input.inputs[id],file='background-'+id+'-'+f.hash.slice(0,16)+'.png';await writeFile(new URL(file,dir),await readFile(source));backdrops[id]={file,...f};}else backdrops[id]=await encode(fileURLToPath(source),'background-'+id);}
 const manifest={format:1,inputDigest:input.digest,sheets:Object.keys((await import('../src/art.js')).SHEETS),pages:files,cells,backdrops};await writeFile(new URL('manifest.json',dir),JSON.stringify(manifest));
 const keep=new Set(['manifest.json',...files.map(p=>p.file),...Object.values(backdrops).map(p=>p.file)]);for(const name of await readdir(dir))if(!keep.has(name)&&/^(?:sprites-\d+|background-[\w-]+)-[a-f0-9]+\.(png|webp)$/.test(name))await unlink(new URL(name,dir));
 console.log(JSON.stringify({cells:result.length,pages:files.length,sourceMiB:Object.values(input.inputs).reduce((n,p)=>n+p.bytes,0)/1024**2,runtimeMiB:[...files,...Object.values(backdrops)].reduce((n,p)=>n+p.bytes,0)/1024**2,pagePixelMiB:files.reduce((n,p)=>n+p.w*p.h*4,0)/1024**2}));
}finally{await browser.close();await rm(temp,{recursive:true,force:true});}
