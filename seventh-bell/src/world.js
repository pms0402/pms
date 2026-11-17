export const WORLD={w:4540,h:690};
const ground=(x,y,w,tile=0,extra={})=>({x,y,w,h:96,tile,...extra});
export function createWorld(){return {w:WORLD.w,h:WORLD.h,
 platforms:[ground(-80,302,1190),ground(1180,302,240,3),ground(1490,302,280,3),ground(1768,322,74,1,{h:14,oneway:true}),ground(1830,362,68,1,{h:14,oneway:true}),ground(1880,410,74,2,{h:14,oneway:true}),ground(1510,478,1040,2),ground(2330,302,65),ground(2510,302,900),ground(3390,302,1150),ground(550,246,108,0,{oneway:true,h:18}),ground(790,202,106,0,{oneway:true,h:18}),ground(2600,244,128,0,{oneway:true,h:18}),ground(2780,190,120,0,{oneway:true,h:18}),ground(2930,132,105,0,{oneway:true,h:18}),ground(1125,222,90,3,{oneway:true,h:18,echo:true}),ground(1295,161,95,3,{oneway:true,h:18,echo:true}),ground(1465,105,130,0,{oneway:true,h:18,echo:true})],
 gates:[{id:'mechanism',x:2740,y:174,w:23,h:128},{id:'arena-left',x:3395,y:170,w:20,h:132},{id:'arena-right',x:4235,y:170,w:20,h:132}],
 objects:[{id:'shrine-outer',type:'shrine',x:145,y:302,checkpoint:'outer',label:'성벽 밖의 종'},{id:'salvager',type:'npc',x:425,y:302,label:'엘마와 이야기하기'},{id:'letter',type:'letter',x:650,y:246,label:'편지를 넣어 둔 함'},{id:'crypt',type:'chest',x:1628,y:478,label:'반쯤 묻힌 함'},{id:'supplies',type:'chest',x:885,y:202,label:'남겨진 보급품'},{id:'lever',type:'lever',x:2200,y:478,label:'성문 장치'},{id:'lift',type:'lift',x:2460,y:478,label:'승강기 작동'},{id:'shrine-gate',type:'shrine',x:3080,y:302,checkpoint:'gate',label:'문지기의 쉼터'},{id:'upper',type:'chest',x:1525,y:105,label:'수리공의 인장',echo:true},{id:'tower',type:'tower',x:4380,y:302,label:'성당으로 이어지는 길'}],
 scenery:[{type:'arch',x:210,y:302,s:1.7},{type:'tower',x:990,y:310,s:1.5},{type:'tree',x:750,y:302,s:1.2},{type:'statue',x:1160,y:430,s:1.4},{type:'columns',x:1570,y:478,s:1.1},{type:'arch',x:1820,y:478,s:1.3},{type:'columns',x:2020,y:478,s:1.6},{type:'arch',x:2540,y:302,s:1.6},{type:'statue',x:2910,y:302,s:1.2},{type:'tower',x:3300,y:302,s:1.6},{type:'arch',x:3770,y:302,s:2.1},{type:'tower',x:4400,y:302,s:2}],
 enemies:[enemy('e0','watchman',920,302),enemy('e1','wisp',1330,226),enemy('e2','watchman',1700,478),enemy('e3','cantor',1940,478),enemy('e4','watchman',2310,478),enemy('e5','cantor',2650,302),enemy('e6','wisp',2870,202),enemy('e7','watchman',3200,302)],
 boss:{id:'edran',type:'edran',x:3910,y:302,w:48,h:105,hp:420,maxHp:420,vx:0,vy:0,dir:-1,state:'idle',t:0,phase:1,cooldown:1.4,attackIndex:0,stagger:0,dead:false,deathT:0,hit:0},
 lift:{x:2410,y:478,w:100,h:13,target:478,vy:0}
};}
export function enemy(id,type,x,y){const flying=type==='wisp';return{id,type,x,y,homeX:x,homeY:y,w:flying?30:22,h:flying?30:48,hp:type==='watchman'?68:type==='cantor'?53:40,maxHp:type==='watchman'?68:type==='cantor'?53:40,vx:0,vy:0,dir:-1,state:'idle',t:0,cooldown:1.1,stagger:0,dead:false,deathT:0,hit:0,walk:0,flying};}
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const body=e=>({x:e.x-e.w/2,y:e.y-e.h,w:e.w,h:e.h});
export function gateActive(g,id){return id==='mechanism'?!g.profile.flags.lever:id==='arena-left'||id==='arena-right'?g.bossActive:false;}
export const solids=g=>[...g.world.platforms.filter(p=>!p.echo||g.echoTime>0),g.world.lift,...g.world.gates.filter(p=>gateActive(g,p.id))];
export function moveBody(e,dt,platforms){const oldY=e.y,oldX=e.x;e.grounded=false;e.x+=e.vx*dt;
 for(const p of platforms){if(p.oneway)continue;if(overlaps(body(e),p)){if(e.vx>0&&oldX+e.w/2<=p.x+2)e.x=p.x-e.w/2;else if(e.vx<0&&oldX-e.w/2>=p.x+p.w-2)e.x=p.x+p.w+e.w/2;else continue;e.vx=0;}}
 e.y+=e.vy*dt;for(const p of platforms){const b=body(e);if(b.x>=p.x+p.w||b.x+b.w<=p.x)continue;if(e.vy>=0&&oldY<=p.y+2&&e.y>=p.y){e.y=p.y;e.vy=0;e.grounded=true;e.support=p;}else if(!p.oneway&&e.vy<0&&oldY-e.h>=p.y+p.h-2&&e.y-e.h<p.y+p.h){e.y=p.y+p.h+e.h;e.vy=0;}}
}
export function clearLine(g,x1,y1,x2,y2){const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)/6);return !solids(g).some(p=>!p.oneway&&Array.from({length:steps},(_,i)=>{const f=(i+1)/(steps+1),x=x1+(x2-x1)*f,y=y1+(y2-y1)*f;return x>p.x&&x<p.x+p.w&&y>p.y+2&&y<p.y+p.h;}).some(Boolean));}
