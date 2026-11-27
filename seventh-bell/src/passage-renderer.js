import {drawCell} from './art.js';
import {environmentAt} from './journey-data.js';

const STONE={
 1:{base:'#24333c',edge:'#70828a',shade:'#15242e',sheet:'masonry',col:0,row:0},
 2:{base:'#192d38',edge:'#8c9b9e',shade:'#12212a',sheet:'cathedral-detail',col:0,row:0},
 3:{base:'#2c2c30',edge:'#8b8278',shade:'#1c2229',sheet:'masonry',col:3,row:0},
 4:{base:'#292d36',edge:'#8a8c94',shade:'#1b202a',sheet:'archive-objects',col:1,row:1},
 5:{base:'#28313a',edge:'#8a9299',shade:'#1b242e',sheet:'masonry',col:0,row:0},
 6:{base:'#26343c',edge:'#829298',shade:'#17232e',sheet:'late-objects',col:1,row:2},
 7:{base:'#282e38',edge:'#8a9099',shade:'#19222d',sheet:'late-objects',col:2,row:2}
};
const stoneAt=x=>{const e=environmentAt(x);return STONE[e.mix<.5?e.from:e.to];};
export function solidTerrainBase(r,q){if(q.echo)return;const c=r.c,s=q.material==='archive'?STONE[4]:q.material==='harbor'?STONE[6]:q.material==='tower'?STONE[7]:stoneAt(q.x+q.w/2);c.fillStyle=s.base;c.fillRect(q.x,q.y,q.w,q.h);}

export function passageWall(r,q){
 const c=r.c,s=stoneAt(r.g.p.x),left=Math.max(q.x,r.x),right=Math.min(q.x+q.w,r.x+r.width),top=Math.max(q.y,r.y),bottom=Math.min(q.y+q.h,r.y+r.height);if(left>=right||top>=bottom)return;
 c.save();c.beginPath();c.rect(q.x,q.y,q.w,q.h);c.clip();c.fillStyle=s.base;c.fillRect(left,top,right-left,bottom-top);
 for(let y=Math.floor(top/64)*64;y<bottom;y+=64)for(let x=Math.floor(left/64)*64;x<right;x+=64){if(s.sheet==='cathedral-detail')drawCell(c,s.sheet,((Math.floor(x/64)+Math.floor(y/64))%4+4)%4,0,x,y);else drawCell(c,s.sheet,s.col,s.row,32,32,64,64,x,y,64,64);}
 // The bright facing edge and dark inner joint stay inside the real collider.
 c.fillStyle=s.edge;c.fillRect(q.x,q.y,2,q.h);c.fillRect(q.x+q.w-2,q.y,1,q.h);c.fillStyle=s.shade;c.fillRect(q.x+2,q.y,2,q.h);c.fillRect(q.x+q.w-5,q.y,3,q.h);c.restore();
}
