import {journeyAt} from './journey-data.js';
import {mapX,roomStart,EXTENSIONS,chapterAtWorld} from './layout.js';
import {ROUTE_GATES,ROUTE_AREAS} from './route-data.js';
import {BOSS_DEFS} from './bosses.js';
import {makeTrap} from './traps.js';

const inserted=id=>roomStart(EXTENSIONS.find(r=>r.id===id));
export function buildRoutes(world){
 world.top=-1480;world.movers=[];world.routeWalls=[];world.waterAreas=[];world.waterPlatforms=[];world.routeAreas=ROUTE_AREAS;
 const ledge=(x,y,w=150,extra={})=>world.platforms.push({x,y,w,h:18,oneway:true,tile:chapterAtWorld(x)===3?3:0,...(chapterAtWorld(x)===4?{material:'archive',tile:2}:chapterAtWorld(x)>=6?{material:chapterAtWorld(x)===6?'harbor':'tower',tile:chapterAtWorld(x)===6?1:2}:{}),...extra});
 const floor=(x,y,w,extra={})=>world.platforms.push({x,y,w,h:1800,foundation:true,tile:2,...extra});
 const object=(id,x,y,kind,key,label,extra={})=>world.objects.push({id,type:kind,x,y,key,label,...extra});
 const lever=(id,x,y,key,label)=>object(id,x,y,'route-lever',key,label);
 const mover=(id,x,bottom,top,extra={})=>{const m={id,x:x-65,y:bottom,w:130,h:18,oneway:true,bottom,top,target:bottom,speed:90,phase:0,tile:0,mover:true,...extra};world.movers.push(m);if(!m.periodic)object(id,x,m.y,'route-lift',null,'승강 발판 작동',{machine:id});return m;};
 const stairs=(start,y,count,dx=115,dy=47,extra={})=>{for(let i=0;i<count;i++)ledge(start+dx*i,y-dy*i,150,extra);};
 const carve=(left,right,y=302)=>{world.platforms=world.platforms.flatMap(p=>{if(p.oneway||p.y!==y||p.x>=right||p.x+p.w<=left)return[p];return[...(p.x<left?[{...p,w:left-p.x}]:[]),...(p.x+p.w>right?[{...p,x:right,w:p.x+p.w-right}]:[])];});};
 const cache=(name,x,y)=>object('route-'+name+'-cache',x,y,'chest',null,'남겨진 연결 부품',{royal:true});
 for(const g of ROUTE_GATES)world.gates.push({id:'route-'+g.key,key:g.key,owner:g.boss,x:g.x,y:100,w:38,h:202,route:true});

 // Replace the four old repeated reward staircases with authored routes.
 // Cache identities stay intact so previous rewards and the hidden ending persist.
 for(const r of EXTENSIONS){const x=roomStart(r);world.platforms=world.platforms.filter(p=>!p.oneway||p.x<x||p.x>=x+r.length);floor(x+r.length*.56,302,76,{tile:r.chapter===3?3:0});}
 const relocatedCaches=[['yard',950,-100],['procession',600,-420],['ash',1500,114],['atlas',1510,-180]];
 for(const[id,dx,y]of relocatedCaches){const o=world.objects.find(o=>o.id===id+'-cache');Object.assign(o,{x:inserted(id)+dx,y});}

 // I: climb the exterior of the old barracks, then return down to the gate road.
 const wall=inserted('yard');stairs(wall+100,255,8,115,47);ledge(wall+875,-100,360);
 lever('wall-chain',wall+1040,-100,'wall','성벽 쇠사슬 풀기');cache('wall',wall+1160,-100);
 // The returning hoist opens a useful route back to the village, not a teleport.
 mover('wall-hoist',wall+130,302,-100,{enabled:'wall'});

 // II: a real 720px tall central shaft, side chapels and a lower crypt.
 const choir=inserted('procession');mover('choir-hoist',choir+220,302,-420,{speed:105});
 for(const[y,dx]of[[140,320],[-40,0],[-220,320],[-420,320]])ledge(choir+dx,y,240);
 ledge(choir+525,-420,180);ledge(choir+730,-420,320);
 lever('upper-choir-rope',choir+820,-420,'cathedralUpper','상층 회랑의 종줄 당기기');cache('cathedral',choir+990,-420);
 carve(choir+1080,choir+1430);floor(choir+1080,430,350,{tile:2});ledge(choir+1040,346,110);ledge(choir+1130,390,110);ledge(choir+1350,386,110);ledge(choir+1430,340,110);
 world.scenery.push({type:'statue',x:choir+1250,y:430,s:1.1});

 // III: a wide transport gap, a moving carrier, a hoist and live steam grates.
 const works=inserted('ash');carve(works+630,works+1000);floor(works+630,478,370,{tile:3});ledge(works+650,430,120);ledge(works+760,382,120);ledge(works+875,336,120);
 mover('ore-carrier',works+600,245,245,{periodic:'horizontal',left:works+535,right:works+965,speed:0,period:7});
 ledge(works+490,258,130);ledge(works+1050,258,160);mover('foundry-hoist',works+1370,302,114,{speed:75});ledge(works+1440,114,310);
 lever('foundry-distributor',works+1530,114,'foundryPower','운반로 전원 연결하기');cache('foundry',works+1680,114);
 for(const x of [works+250,works+1820])world.traps.push(makeTrap('route-steam-'+x,'steam',x,302,3,.4));

 // IV: the index console rearranges only the middle book path. Its permanent
 // entry and exit ledges remain, so switching never strands the player.
 const stacks=inserted('atlas');stairs(stacks+400,255,3);ledge(stacks+740,114,170,{routeMode:true});ledge(stacks+860,67,170,{routeMode:true});stairs(stacks+980,20,5,115,47);world.platforms.find(p=>p.x===stacks+1440&&p.y===-168).y=-180;
 ledge(stacks+1450,-180,360);lever('stack-index',stacks+700,161,'archiveShift','책장 색인 바꾸기');lever('secret-register',stacks+1630,-180,'archivePass','기록실 지름길 열기');cache('archive',stacks+1770,-180);mover('archive-booklift',stacks+1840,302,-180,{enabled:'archivePass',speed:95});
 world.routeWalls.push({x:stacks+1030,y:130,w:42,h:172,style:'bookcase',routeKey:'archiveShift',closedWhen:false});
 carve(stacks+1900,stacks+2090);floor(stacks+1900,430,190,{material:'archive',tile:1});ledge(stacks+1860,344,110);ledge(stacks+2010,340,110);

 // V: a high gallery above the western wing, linked to the original basement.
 stairs(mapX(17280),255,9,115,47);ledge(mapX(18220),-120,340);mover('palace-hoist',mapX(17360),302,-120,{enabled:'palaceBridge',speed:105});
 lever('armory-shortcut',mapX(18310),-120,'palaceBridge','중앙 홀 지름길 열기');cache('palace',mapX(18490),-120);
 ledge(mapX(17480),302,125,{bridge:'palaceBridge'});ledge(mapX(18060),302,150,{bridge:'palaceBridge'});

 // VI: the old lock is a low water route; a cargo walkway bypasses its surface.
 world.waterAreas.push({id:'harbor-water',x:mapX(23600),w:700,level:398,bottom:478});
 world.routeWalls.push({x:mapX(23910),y:398,w:38,h:80,style:'watergate',water:'harbor-water'});
 for(const x of [23720,24080])world.waterPlatforms.push({x:mapX(x),y:386,w:90,h:16,oneway:true,water:'harbor-water',tile:1});
 for(const[x,y]of[[23530,268],[23660,234],[23810,234],[23960,234],[24110,234],[24250,268]])ledge(mapX(x),y,x===23810?70:155);
 for(const p of world.platforms)if(!p.oneway&&p.x===mapX(23600)&&p.y===430)p.y=478;
 for(const id of ['harbor-winch','stranded-worker'])world.objects.find(o=>o.id===id).y=478;
 for(const d of world.scenery)if(d.x>=mapX(23600)&&d.x<mapX(24300)&&d.y===430)d.y=478;
 ledge(mapX(24025),430,115);ledge(mapX(24120),430,115);
 lever('harbor-sluice',mapX(24020),234,'harborSluice','물길 수위 낮추기');
 stairs(mapX(24900),252,10,90,48);ledge(mapX(25710),-180,220);
 lever('beacon-gear',mapX(25730),-180,'harborBeacon','등대 기어 맞추기');cache('harbor',mapX(25860),-180);
 const log=world.objects.find(o=>o.id==='harborcache');Object.assign(log,{x:mapX(25640),y:-180});ledge(mapX(25580),-180,180);

 // VII: three vertically linked engines and an unlockable return lift. The
 // tower's actual colliders span 1,302px, with safe permanent rest landings.
 mover('tower-lower',mapX(28140),302,-120,{speed:105});ledge(mapX(28240),-120,340);
 lever('tower-gear',mapX(28340),-120,'towerGear','중층 톱니 연결하기');
 mover('tower-middle',mapX(28540),-120,-580,{speed:110,enabled:'towerGear'});ledge(mapX(28270),-580,350);
 lever('tower-mid-resonator',mapX(28330),-580,'towerResonator','위층 공명 장치 연결하기');
 mover('tower-upper',mapX(28180),-580,-1000,{speed:100,enabled:'towerResonator'});ledge(mapX(28270),-1000,450);
 for(let i=0;i<3;i++)mover('tower-gear-'+['a','b','c'][i],mapX(28450),-790,-790,{enabled:'towerResonator',periodic:'orbit',cx:mapX(28450),cy:-790,rx:150,ry:160,angle:i*Math.PI*2/3,rate:.32,w:110});
 lever('tower-return-lever',mapX(28500),-1000,'towerAscent','종탑 귀환 승강기 열기');
 mover('tower-return',mapX(28700),-1000,302,{speed:150,enabled:'towerAscent',target:-1000});
 const lens=world.objects.find(o=>o.id==='tower-lens');Object.assign(lens,{x:mapX(28600),y:-1000});
 const notes=world.objects.find(o=>o.id==='conductor-notes');Object.assign(notes,{x:mapX(28420),y:-1000});cache('tower',mapX(28310),-1000);

 // Boss arenas carry meaningful permanent geometry. Floors beside the gates
 // remain intact. Every temporary fight also has these safe resting places.
 for(const id of ['marie','brag','leonel','neris','carillon']){const d=BOSS_DEFS[id];
  if(id==='marie')for(const[dx,y]of[[110,256],[265,210],[440,256]])ledge(d.left+dx,y,120,{arena:id});
  if(id==='brag'){carve(d.left+80,d.left+300);floor(d.left+80,378,220,{tile:3});ledge(d.left+95,257,115,{arena:id});ledge(d.left+275,245,120,{arena:id});object('arena-coolant',d.left+68,302,'cooling-valve',null,'냉각 밸브 돌리기');}
  if(id==='leonel')for(const[dx,y]of[[110,256],[285,210],[475,170],[650,256]])ledge(d.left+dx,y,120,{arena:id,material:'archive',tile:2});
  if(id==='neris'){for(const[dx,y]of[[160,257],[400,213],[650,257],[880,213]])ledge(d.left+dx,y,120,{arena:id});world.routeWalls.push({owner:id,x:d.left+450,y:198,w:42,h:104,style:'cover'});}
  if(id==='carillon')for(const[dx,y]of[[160,257],[420,210],[720,257],[1000,210]])ledge(d.left+dx,y,125,{arena:id});
 }
 // Place route enemies on real permanent ledges, with a fresh member of every
 // chapter's three species on the redesigned paths as well as the old routes.
 const points=[[1,wall+490,114,0],[1,wall+1100,-100,1],[1,wall+780,20,2],
 [2,choir+420,-420,0],[2,choir+590,-220,1],[2,choir+960,-420,2],
 [3,works+1100,258,0],[3,works+1770,302,1],[3,works+1500,114,2],
 [4,stacks+1410,-121,0],[4,stacks+980,-50,1],[4,stacks+1940,430,2],
 [5,mapX(17780),67,0],[5,mapX(18000),-27,1],[5,mapX(18430),-120,2],
 [6,mapX(23740),478,0],[6,mapX(24030),234,1],[6,mapX(25580),-180,2],
 [7,mapX(28310),-120,0],[7,mapX(28350),-580,1],[7,mapX(28420),-1000,2]];
 world.routeEnemyPoints=points;
 return world;
}

export function routeWallActive(g,w){return w.water?!g.profile.routes.harborSluice&&!g.profile.flags.harborLock:w.owner?g.bossActive&&g.world.boss.id===w.owner:w.closedWhen===g.profile.routes[w.routeKey];}
export function routeSolids(g,base){return[...base.filter(p=>(!p.routeMode||g.profile.routes.archiveShift||g.p?.support===p)&&(!p.bridge||g.profile.routes[p.bridge])),...(g.world.movers||[]).filter(m=>m.journey===journeyAt(g.p.x)?.id&&(!m.enabled||g.profile.routes[m.enabled])),...(g.world.waterPlatforms||[]),...(g.world.routeWalls||[]).filter(w=>routeWallActive(g,w))].filter(q=>q.journey===journeyAt(g.p.x)?.id);}
export function routeGate(g,id){const gate=g.world.gates.find(o=>o.id===id&&o.route);if(!gate)return null;return !g.profile.routes[gate.key]&&!g.profile.flags[gate.owner];}
export function restoreMachines(profile,world){for(const m of world.movers||[]){const v=profile.machines?.[m.id];if(v){m.phase=v.time||0;m.target=Math.max(Math.min(m.top,m.bottom),Math.min(Math.max(m.top,m.bottom),v.target));m.x=v.x;m.y=v.y;}}}
export function updateRoutes(g,dt){
 const p=g.p;for(const m of g.world.movers||[]){if(m.enabled&&!g.profile.routes[m.enabled])continue;const ox=m.x,oy=m.y;m.phase+=dt;
  if(m.periodic==='orbit'){const angle=m.angle+m.phase*m.rate;m.x=m.cx+Math.cos(angle)*m.rx-m.w/2;m.y=m.cy+Math.sin(angle)*m.ry;}else if(m.periodic==='horizontal')m.x=m.left+(m.right-m.left)*(.5+.5*Math.sin(m.phase*Math.PI*2/m.period));
  else m.y+=Math.sign(m.target-m.y)*Math.min(Math.abs(m.target-m.y),m.speed*dt);
  if(p.grounded&&p.support===m){p.x+=m.x-ox;p.y+=m.y-oy;}
  const obj=g.world.objects.find(o=>o.machine===m.id);if(obj){obj.x=m.x+m.w/2;obj.y=m.y;}
 }
 for(const water of g.world.waterAreas||[])if(!water.journey)water.level=g.profile.routes.harborSluice||g.profile.flags.harborLock?478:398+Math.sin(g.clock*.2)*17;
 for(const floating of g.world.waterPlatforms||[]){const water=g.world.waterAreas.find(w=>w.id===floating.water),old=floating.y;floating.y=water.level-12;if(p.grounded&&p.support===floating)p.y+=floating.y-old;}
 if(g.world.waterAreas?.some(w=>p.x>w.x&&p.x<w.x+w.w&&p.y>w.level+5))p.vx*=Math.pow(.55,dt*4);
}
export function interactRoute(g,o){const f=g.profile;
 if(o.type==='route-lever'){
  if(o.key==='archiveShift'){f.routes.archiveShift=!f.routes.archiveShift;g.tell('책장이 움직였다. 위쪽 책 다리의 위치가 바뀌었다.');}
  else if(f.routes[o.key]){g.tell('지름길은 열려 있다.');return true;}
  else{f.routes[o.key]=true;g.tell(o.key==='towerAscent'?'아래층까지 귀환 승강기가 연결됐다.':'쇠사슬이 움직였다. 다음 통로가 열렸다.');}
  g.sound('mechanism');g.save();return true;
 }
 if(o.type==='route-lift'){
  const m=g.world.movers.find(m=>m.id===o.machine);if(!m||m.enabled&&!f.routes[m.enabled]){g.tell('연결 장치를 먼저 맞춰야 한다.');return false;}
  if(Math.abs(g.p.y-m.y)<20){g.p.y=m.y;g.p.support=m;g.p.grounded=true;g.p.vy=0;m.target=Math.abs(m.y-m.bottom)<15?m.top:m.bottom;g.sound('mechanism');g.save();return true;}return false;
 }
 if(o.type==='cooling-valve'){
  const e=g.world.boss;if(e.id!=='brag'||e.dead){g.tell('냉각수는 흐르고 있다.');return true;}if(e.cooledUntil>g.clock){g.tell('밸브는 이미 열려 있다.');return false;}
  e.cooledUntil=g.clock+7;e.overheatUntil=0;e.wasHot=false;e.stagger=1.25;e.state='recover';e.t=0;g.combatFields=g.combatFields.filter(f=>f.owner!==e.id||f.kind!=='heat');g.sound('mechanism');g.tell('찬물이 흘렀다. 망치의 열기가 가라앉는다.');return true;
 }
 return null;
}
