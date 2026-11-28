import {prop} from './art.js';

// The saved drop is the marker's only source of truth. It survives resting,
// respawning and reloading, and disappears as soon as the coins are recovered.
export function renderLostCoins(r){
 const {g,c}=r,l=g.profile.loss;
 if(!l||l.x<r.x-100||l.x>r.x+r.width+100||l.y<r.y-20||l.y>r.y+r.height+90)return false;
 const x=Math.round(l.x),y=Math.round(l.y);
 c.save();
 r.glow(x,y-16,35,'#d6b771');
 // A broken, rising glimmer distinguishes a death trace from a wall lamp.
 for(let i=0;i<7;i++){
  const rise=(g.clock*9+i*7)%49;
  c.globalAlpha=.25+(1-rise/49)*.4;c.fillStyle=i%2?'#e9cf91':'#b79557';
  c.fillRect(x+[-5,4,-2,7,-7,2,0][i],Math.round(y-9-rise),1,i%3?2:3);
 }
 c.globalAlpha=1;prop(c,'lantern',x,y-2,32);
 for(const [dx,dy]of[[-8,-2],[4,-1],[-3,1]]){
  c.fillStyle='#463b30';c.fillRect(x+dx-3,y+dy-2,7,4);
  c.fillStyle='#aa8246';c.fillRect(x+dx-2,y+dy-2,5,3);
  c.fillStyle='#edce86';c.fillRect(x+dx-2,y+dy-2,4,1);
  c.fillStyle='#f5e2ab';c.fillRect(x+dx-1,y+dy-1,1,1);
 }
 if(Math.hypot(g.p.x-l.x,g.p.y-l.y)<170){
  const text='남겨진 동전 · '+l.marks.toLocaleString('ko-KR');
  c.font='10px sans-serif';c.textAlign='center';c.textBaseline='middle';
  const w=Math.ceil(c.measureText(text).width)+16,top=y-73;
  c.fillStyle='#101b22eb';c.fillRect(x-w/2,top,w,22);
  c.fillStyle='#9b804d';c.fillRect(x-w/2,top,w,1);c.fillRect(x-w/2,top+21,w,1);
  c.fillStyle='#efdab0';c.fillText(text,x,top+11);
 }
 c.restore();return true;
}
