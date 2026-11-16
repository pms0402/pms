import {Pixel,hash} from './art.js';
export const RUINS={
 ember:{name:'잿불 성채',w:864,h:640,entry:{x:432,y:560},boss:{x:432,y:175},walls:[{x:84,y:360,w:240,h:24},{x:540,y:360,w:240,h:24}],floor:'#574a43',light:'#b99b73'},
 frost:{name:'서리 왕릉',w:960,h:720,entry:{x:480,y:640},boss:{x:480,y:180},walls:[{x:60,y:390,w:285,h:24},{x:615,y:390,w:285,h:24},{x:228,y:190,w:25,h:95},{x:707,y:190,w:25,h:95}],floor:'#3f6266',light:'#a3c1b5'},
 rift:{name:'별의 경계',w:1024,h:768,entry:{x:512,y:685},boss:{x:512,y:225},walls:[{x:75,y:425,w:290,h:26},{x:660,y:425,w:290,h:26}],floor:'#44465c',light:'#b3a9c9'}
};
export function ruinBlocked(x,y,map,r){const d=RUINS[map];if(!d)return false;return x<52+r||x>d.w-52-r||y<72+r||y>d.h-48-r||d.walls.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);}
function ground(id){const d=RUINS[id],p=new Pixel(d.w,d.h);p.r(0,0,d.w,d.h,'#152728');for(let y=58;y<d.h-36;y+=16)for(let x=42;x<d.w-38;x+=20){const h=hash(x,y,id==='frost'?14:21);p.r(x,y,19,15,d.floor);p.r(x+1,y+1,17,1,h>.5?d.light:'#778478');p.line(x+2,y+12,x+15,y+12,'#213a3d44');if(h>.8)p.line(x+4,y+4,x+9,y+7,'#203337');}
 for(const b of [{x:42,y:38,w:d.w-84,h:34},{x:33,y:60,w:16,h:d.h-96},{x:d.w-49,y:60,w:16,h:d.h-96},...d.walls]){p.r(b.x,b.y,b.w,b.h+8,'#172c30');for(let y=b.y;y<b.y+b.h;y+=9)for(let x=b.x+(y%2)*7;x<b.x+b.w;x+=24){p.r(x,y,Math.min(22,b.x+b.w-x),8,d.floor);p.r(x+1,y,Math.max(1,Math.min(20,b.x+b.w-x-1)),2,d.light);}}
 const cx=d.boss.x,cy=d.boss.y;for(const rad of[42,67,94])for(let a=0;a<Math.PI*2;a+=.015){p.dot(cx+Math.cos(a)*rad,cy+Math.sin(a)*rad*.58,d.light);if(rad===67&&Math.floor(a*10)%4===0)p.dot(cx+Math.cos(a)*(rad-3),cy+Math.sin(a)*(rad-3)*.58,d.light);}
 for(let i=0;i<16;i++){const a=i*Math.PI/8,x=cx+Math.cos(a)*106,y=cy+Math.sin(a)*62;p.poly([[x,y-4],[x+4,y],[x,y+4],[x-4,y]],d.light);}
 if(id==='ember')for(const x of[64,d.w-74])for(let y=95;y<d.h-65;y+=20){p.poly([[x,y],[x+12,y-3],[x+8,y+15],[x-2,y+19]],'#ad6945');p.line(x+2,y+2,x+7,y+13,'#e1ac64');}
 if(id==='frost')for(let i=0;i<16;i++){const x=i%2?d.w-80:72,y=110+Math.floor(i/2)*65;p.poly([[x-5,y],[x-3,y-30],[x+4,y-42],[x+10,y-20],[x+7,y]],'#6faaa8');p.line(x+3,y-34,x+5,y-5,'#d8e2c8');}
 return p.canvas;}
export function adventureWorld(){const objects=[],enemies=[],maps={};objects.push({id:'quest-board',type:'questBoard',x:570,y:760,map:'overworld',interact:'adventure',label:'모험가 게시판 · 여정 / 의뢰'},{id:'ranch-sign',type:'ranchBoard',x:2330,y:1510,map:'overworld',interact:'ranch',label:'새벽 목장 · 가축과 농장 시설'},{id:'ranch-barn',type:'ranchBarn',x:2390,y:1400,map:'overworld',solid:{w:92,h:45}});
 for(const [i,id]of ['ember','frost','rift'].entries()){const d=RUINS[id],j=i+1,positions={ember:[1840,570],frost:[2220,820],rift:[2370,260]},[x,y]=positions[id];objects.push({id:id+'-gate',type:id+'Gate',x,y,map:'overworld',interact:'rpgGate',target:id,label:d.name+' · Lv.'+[3,5,7][i]+' 입장'},{id:id+'-exit',type:'ladder',x:d.entry.x,y:d.h-54,map:id,interact:'rpgExit',target:id,label:'계곡으로 돌아가기'});maps[id]=ground(id);
 const boss=['emberlord','frostqueen','riftkeeper'][i];enemies.push({id:boss,type:boss,map:id,x:d.boss.x,y:d.boss.y,homeX:d.boss.x,homeY:d.boss.y,hp:[460,780,1250][i],maxHp:[460,780,1250][i],cooldown:1.8,windup:0,hit:0,dead:false,respawn:0,boss:true,damage:[24,33,42][i],round:0});
 for(let n=0;n<6;n++){const px=d.w/2+(n%2?-1:1)*(105+(n%3)*38),py=d.h-155-Math.floor(n/2)*105,type=['emberling','frostling','riftsentinel'][i];enemies.push({id:id+'-mob'+n,type,map:id,x:px,y:py,homeX:px,homeY:py,hp:65+j*30,maxHp:65+j*30,cooldown:1,windup:0,hit:0,dead:false,respawn:0,xp:22+j*15,damage:10+j*6});}}
 return{objects,enemies,maps};}
