import {createBoss,BOSS_DEFS,BOSS_ORDER} from './bosses.js';
export const WORLD={w:15400,h:690};
const ground=(x,y,w,tile=0,extra={})=>({x,y,w,h:96,tile,...extra});
export function createWorld(){const bosses=BOSS_ORDER.map(createBoss);const world={w:WORLD.w,h:WORLD.h,
 platforms:[ground(-80,302,1190,0,{foundation:true,h:1800}),ground(1180,302,240,3),ground(1490,302,280,3),ground(1768,322,74,1,{h:14,oneway:true}),ground(1830,362,68,1,{h:14,oneway:true}),ground(1880,410,74,2,{h:14,oneway:true}),ground(1510,478,1040,2,{foundation:true,h:1800}),ground(2330,302,65),ground(2510,302,40),ground(2550,302,860,0,{foundation:true,h:1800}),ground(3390,302,1150,0,{foundation:true,h:1800}),ground(486,272,72,0,{oneway:true,h:18}),ground(550,246,128,0,{oneway:true,h:18}),ground(690,214,112,0,{oneway:true,h:18}),ground(810,202,128,0,{oneway:true,h:18}),ground(2600,244,128,0,{oneway:true,h:18}),ground(2780,190,120,0,{oneway:true,h:18}),ground(2930,132,105,0,{oneway:true,h:18}),ground(1125,222,90,3,{oneway:true,h:18,echo:true}),ground(1295,161,95,3,{oneway:true,h:18,echo:true}),ground(1465,105,130,0,{oneway:true,h:18,echo:true})],
 gates:[{id:'mechanism',x:2740,y:174,w:23,h:128},{id:'arena-left',x:3395,y:170,w:20,h:132},{id:'arena-right',x:4235,y:170,w:20,h:132}],
 objects:[{id:'shrine-outer',type:'shrine',x:145,y:302,checkpoint:'outer',label:'성벽 밖의 종'},{id:'salvager',type:'npc',x:425,y:302,label:'칼 수리 맡기기'},{id:'letter',type:'letter',x:650,y:246,label:'편지를 넣어 둔 함'},{id:'crypt',type:'chest',x:1628,y:478,label:'반쯤 묻힌 함'},{id:'supplies',type:'chest',x:885,y:202,label:'남겨진 보급품'},{id:'lever',type:'lever',x:2200,y:478,label:'성문 장치'},{id:'lift',type:'lift',x:2460,y:478,label:'승강기 작동'},{id:'shrine-gate',type:'shrine',x:3080,y:302,checkpoint:'gate',label:'문지기의 쉼터'},{id:'upper',type:'chest',x:1525,y:105,label:'수리공의 인장',echo:true},{id:'tower',type:'tower',x:4380,y:302,label:'성당으로 이어지는 길'}],
 scenery:[{type:'arch',x:210,y:302,s:1.7},{type:'tower',x:990,y:310,s:1.5},{type:'tree',x:750,y:302,s:1.2},{type:'statue',x:1160,y:430,s:1.4},{type:'columns',x:1570,y:478,s:1.1},{type:'arch',x:1820,y:478,s:1.3},{type:'columns',x:2020,y:478,s:1.6},{type:'arch',x:2540,y:302,s:1.6},{type:'statue',x:2910,y:302,s:1.2},{type:'tower',x:3300,y:302,s:1.6},{type:'arch',x:3770,y:302,s:2.1},{type:'tower',x:4400,y:302,s:2}],
 enemies:[enemy('e0','watchman',920,302),enemy('e1','wisp',1330,226),enemy('e2','watchman',1700,478),enemy('e3','cantor',1940,478),enemy('e4','watchman',2310,478),enemy('e5','cantor',2650,302),enemy('e6','wisp',2870,202),enemy('e7','watchman',3200,302)],
 bosses,boss:bosses[0],
 lift:{x:2410,y:478,w:100,h:13,target:478,vy:0}
};
 // The four chapters share one continuous coordinate space and collision map.
 world.platforms.push(ground(4540,302,3160,2,{foundation:true,h:1800}),ground(7700,302,950,3,{foundation:true,h:1800}),ground(8650,430,670,3,{foundation:true,h:1800}),ground(9250,302,1970,3,{foundation:true,h:1800}),
 ground(5050,270,105,2,{oneway:true,h:18}),ground(5190,230,110,2,{oneway:true,h:18}),ground(5340,188,150,2,{oneway:true,h:18}),ground(5520,188,300,2,{oneway:true,h:18}),
 ground(5770,182,110,2,{oneway:true,h:18}),ground(5850,130,110,2,{oneway:true,h:18,echo:true,voice:true}),
 ground(8610,342,100,3,{oneway:true,h:18}),ground(8670,386,90,3,{oneway:true,h:18}),ground(9040,386,110,3,{oneway:true,h:18}),ground(9150,340,100,3,{oneway:true,h:18}),
 ground(8040,248,100,3,{oneway:true,h:18}),ground(8170,194,270,3,{oneway:true,h:18}));
 world.gates.push({id:'first-bell',x:4510,y:-120,w:25,h:422},{id:'choir-door',x:6200,y:-120,w:25,h:422},{id:'second-bell',x:7670,y:-120,w:25,h:422},{id:'furnace-door',x:9440,y:-120,w:25,h:422},{id:'slag',x:8220,y:40,w:22,h:154});
 for(const b of bosses.slice(1)){const d=[BOSS_DEFS[b.id].left,BOSS_DEFS[b.id].right];world.gates.push({id:b.id+'-left',x:d[0],y:100,w:20,h:202},{id:b.id+'-right',x:d[1],y:100,w:20,h:202});}
 for(const c of [{id:'nave',x:4690},{id:'choir',x:6370},{id:'works',x:7860},{id:'anvil',x:9550}])world.objects.push({id:'shrine-'+c.id,type:'shrine',checkpoint:c.id,x:c.x,y:302,label:'종 앞에서 기록'});
 world.objects.push({id:'choir-rope',type:'bellrope',x:5760,y:188,label:'성가대석의 종줄 당기기'},{id:'hymn',type:'chest',x:6020,y:302,label:'목소리를 묶은 악보'},{id:'choirrelic',type:'chest',x:5910,y:130,echo:true,voice:true,label:'남겨 둔 목소리'},
 {id:'furnace-valve',type:'valve',x:8830,y:430,label:'용광로 밸브 잠그기'},{id:'ledger',type:'chest',x:9190,y:430,label:'작업반의 출근 장부'},{id:'forgecache',type:'chest',x:8350,y:194,label:'봉인된 도가니'},
 {id:'second-way',type:'tower',x:7500,y:302,label:'제철도시로 가는 길'},{id:'third-end',type:'archiveway',x:11060,y:302,label:'서고로 이어지는 길'});
 for(const [id,type,x,y,rank] of [['e9','watchman',4920,302,1],['e10','wisp',5290,280,1],['e11','cantor',5590,302,1],['e12','watchman',5940,302,1],['e13','cantor',6290,302,1],['e14','watchman',8100,302,2],['e15','wisp',8490,280,2],['e16','cantor',8910,430,2],['e17','watchman',9310,302,2]])world.enemies.push(enemy(id,type,x,y,rank));
 for(const [type,x,y,s] of [['columns',4820,302,1.8],['statue',5120,302,1.1],['arch',5500,302,1.5],['columns',6070,302,1.4],['arch',6970,302,2],['tower',7780,302,1.7],['columns',8310,302,1.2],['lift',8770,430,1.2],['arch',9130,430,1.4],['tower',9690,302,1.7],['arch',10200,302,1.9],['tower',11000,302,1.5]])world.scenery.push({type,x,y,s});
 const archiveGround=(x,y,w,tile=1,extra={})=>ground(x,y,w,tile,{material:'archive',...extra});
 world.platforms.push(archiveGround(11220,302,760,1,{foundation:true,h:1800}),archiveGround(11980,430,900,0,{foundation:true,h:1800}),archiveGround(12880,302,2520,1,{foundation:true,h:1800}),
 archiveGround(11930,342,100,2,{oneway:true,h:18}),archiveGround(12010,386,100,2,{oneway:true,h:18}),archiveGround(12610,386,120,2,{oneway:true,h:18}),archiveGround(12740,340,120,2,{oneway:true,h:18}),
 archiveGround(12050,302,730,2,{oneway:true,h:18,index:true}),archiveGround(13000,270,110,0,{oneway:true,h:18}),archiveGround(13120,230,110,0,{oneway:true,h:18}),archiveGround(13260,194,180,0,{oneway:true,h:18}),
 archiveGround(12440,230,110,2,{oneway:true,h:18,echo:true,memory:true}),archiveGround(12570,170,110,2,{oneway:true,h:18,echo:true,memory:true}),archiveGround(12670,120,150,2,{oneway:true,h:18,echo:true,memory:true}));
 world.gates.push({id:'third-bell',x:11190,y:-120,w:25,h:422},{id:'archive-index',x:13600,y:-120,w:25,h:422},{id:'palace-closed',x:15360,y:-120,w:25,h:422});
 world.objects.push({id:'shrine-archive',type:'shrine',x:11400,y:302,checkpoint:'archive',label:'서고 문턱에서 기록'},{id:'index-wheel',type:'indexwheel',x:12320,y:430,label:'책장 색인 장치 돌리기'},
 {id:'palimpsest',type:'lectern',x:13120,y:302,label:'아직 오지 않은 날의 기록 읽기'},{id:'errata',type:'chest',x:13350,y:194,label:'레오넬의 정정 기록',archive:true},
 {id:'shrine-index',type:'shrine',x:13760,y:302,checkpoint:'index',label:'기록실 앞에서 기록'},{id:'seventh-record',type:'finalrecord',x:15020,y:302,label:'일곱 번째 종의 입탑 기록'},
 {id:'archivecache',type:'chest',x:12740,y:120,echo:true,memory:true,archive:true,label:'접혀 있던 내일'},{id:'fourth-end',type:'ending',x:15300,y:302,label:'왕궁으로 가는 문 살펴보기'});
 for(const [type,x,y,scale]of [['archiveShelf',11610,302,1.7],['archiveShelf',11940,430,1.6],['archiveShelf',12250,430,1.7],['archiveShelf',12500,430,1.5],['archiveShelf',12960,302,1.6],['archiveShelf',13480,302,1.8],['archiveShelf',14340,302,1.9],['archiveShelf',14700,302,1.9],['archiveShelf',15170,302,1.6]])world.scenery.push({type,x,y,s:scale});
 for(const[id,type,x,y]of [['e18','watchman',11680,302],['e19','wisp',12080,406],['e20','cantor',12510,430],['e21','watchman',13010,302],['e22','cantor',13500,302]])world.enemies.push(enemy(id,type,x,y,3));
 return world;}
export function enemy(id,type,x,y,rank=0){const flying=type==='wisp',hp=Math.round((type==='watchman'?88:type==='cantor'?72:56)*(1+rank*.18));return{id,type,rank,x,y,homeX:x,homeY:y,w:flying?30:22,h:flying?30:48,hp,maxHp:hp,vx:0,vy:0,dir:-1,state:'idle',t:0,cooldown:1.1,stagger:0,dead:false,deathT:0,hit:0,walk:0,flying};}
export const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const body=e=>({x:e.x-e.w/2,y:e.y-e.h,w:e.w,h:e.h});
export function gateActive(g,id){const f=g.profile.flags;if(id==='mechanism')return !f.lever;if(id==='first-bell')return !f.edran;if(id==='second-bell')return !f.marie;if(id==='choir-door')return !f.choir;if(id==='furnace-door')return !f.coolant;if(id==='third-bell')return !f.brag;if(id==='archive-index')return !f.index||!f.chronology;if(id==='palace-closed')return true;if(id==='slag')return !f.slag;return g.bossActive&&(id.startsWith(g.world.boss.id+'-')||g.world.boss.id==='edran'&&id.startsWith('arena-'));}
export const solids=g=>[...g.world.platforms.filter(p=>(!p.echo||g.echoTime>0)&&(!p.voice||g.profile.flags.voice)&&(!p.memory||g.profile.flags.memory)&&(!p.index||g.profile.flags.index)),g.world.lift,...g.world.gates.filter(p=>gateActive(g,p.id))];
export function moveBody(e,dt,platforms){const oldY=e.y,oldX=e.x;e.grounded=false;e.x+=e.vx*dt;
 for(const p of platforms){if(p.oneway)continue;if(overlaps(body(e),p)){if(e.vx>0&&oldX+e.w/2<=p.x+2)e.x=p.x-e.w/2;else if(e.vx<0&&oldX-e.w/2>=p.x+p.w-2)e.x=p.x+p.w+e.w/2;else continue;e.vx=0;}}
 e.y+=e.vy*dt;for(const p of platforms){const b=body(e);if(b.x>=p.x+p.w||b.x+b.w<=p.x)continue;if(e.vy>=0&&oldY<=p.y+2&&e.y>=p.y){e.y=p.y;e.vy=0;e.grounded=true;e.support=p;}else if(!p.oneway&&e.vy<0&&oldY-e.h>=p.y+p.h-2&&e.y-e.h<p.y+p.h){e.y=p.y+p.h+e.h;e.vy=0;}}
}
export function clearLine(g,x1,y1,x2,y2){const steps=Math.ceil(Math.hypot(x2-x1,y2-y1)/6);return !solids(g).some(p=>!p.oneway&&Array.from({length:steps},(_,i)=>{const f=(i+1)/(steps+1),x=x1+(x2-x1)*f,y=y1+(y2-y1)*f;return x>p.x&&x<p.x+p.w&&y>p.y+2&&y<p.y+p.h;}).some(Boolean));}
