import {fillFloor} from './terrain.js';
import {HOMES,homeSpec,farmPosition} from './housing.js';
import {Pixel,hash,sprite,drawSprite,spriteSize} from './art.js';
export const MINE_WALLS={mine1:[{x:320,y:74,w:24,h:245},{x:640,y:325,w:24,h:260}],mine2:[{x:312,y:285,w:220,h:24},{x:610,y:74,w:24,h:220},{x:610,y:390,w:24,h:195}]};
export function lifeWorld(){
 const objects=[],enemies=[];
 const add=(id,type,x,y,map='overworld',extra={})=>{const o={id,type,x,y,map,...extra};objects.push(o);return o;};
 add('forge','forge',855,621,'overworld',{radius:16,interact:'station',station:'furnace',label:'공용 용광로 · 제련'});
 add('anvil','anvil',826,670,'overworld',{radius:12,interact:'station',station:'bench',label:'대장간 모루 · 제작 / 강화'});
 add('sawmill','sawbench',745,867,'overworld',{radius:14,interact:'station',station:'bench',label:'목재 작업대 · 가공'});
 add('cookfire','cookfire',730,1040,'overworld',{radius:12,interact:'station',station:'cookfire',label:'농장 화덕 · 요리'});
 add('smith','smith',855,670,'overworld',{npc:'smith',interact:'vendor',vendor:'smith',label:'대장장이 브람 · 장비와 의뢰'});
 add('mine-mouth','minegate',1660,350,'overworld',{interact:'mineEntry',label:'구리빛 갱도 · 내려가기'});
 add('miner','miner',390,510,'mine1',{npc:'miner',interact:'vendor',vendor:'miner',label:'광부 도란 · 보급과 의뢰'});
 add('mine-forge','forge',452,508,'mine1',{radius:16,interact:'station',station:'furnace',label:'광산 용광로 · 제련'});
 add('mine-bench','anvil',557,515,'mine1',{radius:12,interact:'station',station:'bench',label:'광산 작업대 · 도구 제작'});
 add('mine-exit','ladder',480,585,'mine1',{interact:'mineExit',label:'계곡으로 올라가기'});
 add('deep-down','ladder',800,150,'mine1',{interact:'deepDown',label:'별빛 심층 · 내려가기'});
 add('deep-up','ladder',160,555,'mine2',{interact:'deepUp',label:'구리빛 갱도로 올라가기'});
 add('deep-cache','relicChest',828,116,'mine2',{radius:10,interact:'treasure',label:'봉인된 도안 상자 · 조사'});
 add('mine-cache','crate',180,110,'mine1',{radius:10,interact:'supplyCache',label:'오래된 석탄 수레 · 회수'});
 add('home-door','sign',811,867,'overworld',{interact:'house',label:'빈 오두막 · 매입 / 입장'});
 add('home-exit','door',240,326,'home',{interact:'homeExit',label:'버들빛 마을로 나가기'});
 add('home-deed','ledger',400,300,'home',{radius:8,interact:'house',label:'내 집 · 시설과 배치'});
 add('farm-sign','ledger',685,1082,'overworld',{radius:7,interact:'farmManage',label:'텃밭 관리 · 농장 확장'});
 for(let i=0;i<12;i++)add('plot'+i,'plot',748+i%4*34,1000+Math.floor(i/4)*38,'overworld',{plotIndex:i,interact:'plot',label:'텃밭 · 재배 관리'});
 add('river-fish','fishingSign',964,817,'overworld',{interact:'fishing',label:'강가 낚시터 · 미끼 1개'});
 add('lake-fish','dock',1598,1130,'overworld',{interact:'fishing',label:'호숫가 낚시터 · 미끼 1개'});
 add('fisher','fisher',1620,1090,'overworld',{npc:'fisher',interact:'vendor',vendor:'fisher',label:'어부 세라 · 생선과 의뢰'});
 for(const map of ['mine1','mine2'])for(const[i,[x,y]]of [[66,180],[908,180],[66,500],[908,500]].entries()){add(map+'-support-'+i,'mine_support',x,y,map,{decor:true});add(map+'-lamp-'+i,'lamp',x+8,y-8,map,{decor:true});}
 for(const [map,x,y]of [['mine1',480,405],['mine2',520,380]]){add(map+'-haulage-frame','mine_support',x,y,map,{decor:true});for(const dx of[-36,36])add(map+'-haulage-post'+dx,'collision',x+dx,y,map,{hidden:true,radius:5});}
 const node=(id,metal,x,y,map)=>add(id,'vein_'+metal,x,y,map,{radius:13,metal,interact:'mining',label:({copper:'구리',iron:'철',silver:'은',gold:'금',mythril:'미스릴'})[metal]+' 광맥 · 채광'});
 const deposits={copper:[[122,188],[180,228],[246,178],[132,314],[224,310],[277,371],[126,401],[206,455],[290,493],[147,555]],iron:[[422,164],[513,203],[596,162],[412,281],[489,328],[586,294],[423,396],[563,417]],silver:[[732,241],[830,284],[750,371],[841,414]],gold:[[414,150],[492,196],[400,232],[522,250],[438,374],[520,430]],mythril:[[747,243],[839,300],[724,365],[844,437],[766,523]]};
 for(const m of ['copper','iron','silver'])deposits[m].forEach(([x,y],i)=>node(m+i,m,x,y,'mine1'));
 for(let i=0;i<4;i++)node('surface-copper'+i,'copper',1490+i%2*62,825+Math.floor(i/2)*65,'overworld');
 for(const[i,[x,y]]of [[166,146],[232,192],[153,251],[237,314]].entries())node('deep-silver'+i,'silver',x,y,'mine2');
 for(const m of ['gold','mythril'])deposits[m].forEach(([x,y],i)=>node(m+i,m,x,y,'mine2'));
 for(let i=0;i<8;i++)add('coal'+i,'coalVein',118+i%4*185,470+Math.floor(i/4)*60,'mine1',{radius:12,resourceId:'coal',interact:'mining',label:'석탄층 · 채광'});
 for(const[i,[x,y]]of [[125,1150],[211,1176],[301,1147],[147,1238],[252,1242],[334,1218],[116,1327],[216,1350],[332,1310]].entries())add('stone'+i,'stonePile',x,y,'overworld',{radius:10,resourceId:'stone',interact:'mining',label:'풍화암 · 석재 채집'});
 for(let i=0;i<10;i++){add('mushroom'+i,'mushroomPatch',210+i%4*130,280+Math.floor(i/4)*65,'overworld',{resourceId:'mushroom',interact:'forage',label:'숲버섯 · 채집'});}
 for(let i=0;i<6;i++)add('apple'+i,'appleTree',260+i%2*70,1175+Math.floor(i/2)*75,'overworld',{resourceId:'apple',interact:'forage',radius:10,label:'야생 사과나무 · 채집'});
 // Expanded frontier retains every existing node ID and appends new permanent IDs.
 add('property-house','property_farmhouse',2130,1280,'overworld',{solid:{w:190,h:80}});
 add('property-door','ledger',2130,1315,'overworld',{interact:'house',label:'개척지 주택 · 농가 / 공방 / 대저택'});
 add('frontier-bench','anvil',2290,1180,'overworld',{radius:12,interact:'station',station:'bench',label:'개척지 작업대'});
 add('frontier-forge','forge',2335,1180,'overworld',{radius:16,interact:'station',station:'furnace',label:'개척지 용광로'});
 add('frontier-farm-sign','ledger',1930,1370,'overworld',{radius:7,interact:'farmManage',label:'개척지 농장 관리'});
 for(let i=12;i<64;i++){const q=farmPosition(i);add('plot'+i,'plot',q.x,q.y,'overworld',{plotIndex:i,interact:'plot',label:'개척지 텃밭 · 재배 관리'});}
 const frontierVeins={copper:[[1924,288],[1972,310],[1940,381],[2002,416],[1925,505],[1984,531]],iron:[[2075,223],[2114,263],[2053,329],[2127,364],[2083,457],[2140,510]],silver:[[2190,240],[2242,275],[2160,355],[2240,409],[2192,482],[2260,521]],gold:[[2308,310],[2350,352],[2296,433],[2369,471],[2309,548],[2381,578]],mythril:[[2422,170],[2472,218],[2402,290],[2482,355],[2436,429],[2484,487]]};for(const[m,points]of Object.entries(frontierVeins))points.forEach(([x,y],i)=>node('frontier-'+m+i,m,x,y,'overworld'));
 for(let i=0;i<35;i++){const x=1875+(i%6)*105,y=850+Math.floor(i/6)*120;if(Math.hypot(x-2130,y-1280)<220||y>1290&&x>1900)continue;add('frontier-tree'+i,i%4?'tree':'pine',x,y,'overworld',{radius:10,resource:'wood',hits:3,interact:'gather',label:'개척지 나무 · 벌목'});}
 for(let i=0;i<14;i++)add('frontier-herb'+i,'herb',180+(i%7)*215,1550+Math.floor(i/7)*180,'overworld',{resource:'herb',hits:1,interact:'gather',label:'들판 달빛풀 · 채집'});
 for(let i=0;i<10;i++)add('frontier-apple'+i,'appleTree',1850+i%2*80,1460+Math.floor(i/2)*70,'overworld',{radius:10,resourceId:'apple',interact:'forage',label:'개척지 사과나무 · 수확'});
 for(const [id,x,y]of [['frontier-wolf',2400,480],['frontier-bat',2220,360]])enemies.push({id,x,y,homeX:x,homeY:y,type:'wolf',map:'overworld',hp:75,maxHp:75,cooldown:1,windup:0,hit:0,dead:false,respawn:0});
 for(const [id,x,y,type,map]of[['cave-slime',530,280,'slime','mine1'],['cave-wolf',760,380,'wolf','mine1'],['depth-guard1',700,350,'caveguard','mine2'],['depth-guard2',790,180,'caveguard','mine2'],['depth-bat',380,460,'bat','mine2']])enemies.push({id,x,y,homeX:x,homeY:y,type,map,hp:type==='caveguard'?125:55,maxHp:type==='caveguard'?125:55,cooldown:.7,windup:0,hit:0,dead:false,respawn:0});
 return {objects,enemies,maps:{mine1:mineGround('mine1'),mine2:mineGround('mine2'),home:homeGround()}};
}
function wall(p,b){p.r(b.x,b.y,b.w,b.h+9,'#172d31');p.r(b.x,b.y,b.w,b.h,'#4f6460');fillFloor(p.c,15,b.x,b.y,b.w,b.h);p.r(b.x,b.y,b.w,3,'#9ca38a');}
function mineGround(map){const p=new Pixel(960,640);p.r(0,0,960,640,'#17282c');fillFloor(p.c,7,48,72,866,522);if(map==='mine2'){p.c.fillStyle='#335a6930';p.c.fillRect(48,72,866,522);}
 for(const b of [{x:42,y:38,w:880,h:34},{x:30,y:72,w:18,h:538},{x:914,y:72,w:18,h:538},{x:42,y:594,w:880,h:15},...MINE_WALLS[map]])wall(p,b);
 // Timber supports, rails, ore debris and pools have silhouettes and surface detail.
 for(const [x,y]of[[65,170],[895,170],[65,420],[895,420]]){p.r(x-5,y-50,10,50,'#60533b');p.r(x-3,y-47,2,45,'#b39860');p.r(x-8,y-50,17,5,'#b19862');p.r(x-7,y-7,14,4,'#807453');}
 for(let y=363;y<592;y+=14){p.r(461,y,40,4,'#3d352a');p.r(462,y,38,2,'#9c7e50');for(const x of[468,490])p.dot(x,y,'#ded2a2');}for(const x of[468,490]){p.r(x,360,3,234,'#596c70');p.r(x,360,1,234,'#c4c5aa');p.r(x+2,360,1,234,'#263d41');}
 for(let i=0;i<90;i++){const x=66+hash(i,2)*825,y=88+hash(8,i)*484;p.poly([[x,y],[x+3,y-4],[x+7,y-2],[x+9,y+2],[x+2,y+3]],i%5?'#607468':'#9b9d79');}
 for(const y of[180,350,520]){p.r(54,y-45,9,50,'#4a392a');p.r(56,y-45,3,49,'#b18b54');p.r(52,y-48,17,6,'#c6a572');p.r(892,y-45,10,50,'#4a392a');p.r(894,y-45,3,49,'#b18b54');p.r(889,y-48,18,6,'#c6a572');}if(map==='mine2'){p.ellipse(510,475,65,35,'#203e48');for(let i=0;i<20;i++)p.r(465+hash(i,2)*85,456+hash(3,i)*38,8,1,'#4d7774');}
 return p.canvas;}
export function homeGround(type='cottage'){
 const spec=HOMES[type]||HOMES.cottage,{w,h}=spec,p=new Pixel(w,h),floor=h-34;
 p.r(0,0,w,h,'#172b28');p.r(38,42,w-76,h-76,'#a39066');
 fillFloor(p.c,type==='lodge'?13:12,48,78,w-96,floor-78);
 p.r(38,36,w-76,42,spec.color);fillFloor(p.c,14,38,36,w-76,42);for(let x=40;x<w-38;x+=50){p.r(x,36,5,42,'#645b40');p.r(x,39,2,36,'#8d7952');}p.r(38,70,w-76,8,'#6c6245');p.r(38,36,w-76,5,'#ddd0a0');p.r(38,78,10,h-112,'#5c5b40');p.r(w-48,78,10,h-112,'#5c5b40');p.r(38,floor,w/2-55,10,'#655d40');p.r(w/2+17,floor,w/2-55,10,'#655d40');
 for(let x=110;x<w-100;x+=190){p.r(x,43,42,27,'#625d42');p.r(x+3,44,36,23,'#9eae9c');p.r(x+19,43,3,27,'#6d6949');p.r(x,55,42,2,'#6d6949');p.r(x+4,45,13,8,'#d4d4b0');}
 if(type==='estate'){for(let x=64;x<w-64;x+=180){p.r(x,78,12,44,'#b9bd9c');p.r(x+2,78,3,42,'#e2d9b6');p.r(x-3,78,18,5,'#6e816e');}p.r(65,135,w-130,4,'#b8aa7b');}
 if(type==='lodge'){p.r(55,82,w-110,6,'#685638');for(let x=60;x<w-60;x+=120){p.r(x,85,3,16,'#b5a170');p.r(x+9,85,3,16,'#b5a170');}}
 return p.canvas;
}
export function indoorBlocked(x,y,map,objects,state,r=7){if(map==='home'){
 const spec=homeSpec(state);if(x<48+r||x>spec.w-48-r||y<80+r||y>spec.h-34-r)return true;
 return state.life.home.items.some(o=>{const size=({chest:[30,20],bench:[46,25],furnace:[38,30],bed:[30,43],lamp:[8,8],press:[38,30]})[o.type];return size&&Math.abs(x-o.x)<size[0]/2+r&&y>o.y-size[1]-r&&y<o.y+r;});}
 if(x<48+r||x>914-r||y<74+r||y>594-r)return true;
 if(MINE_WALLS[map]?.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h))return true;
 if(map==='mine2'&&((x-510)/72)**2+((y-475)/42)**2<1)return true;
 return objects.some(o=>{if(o.map!==map||!o.radius||state.life.nodes[o.id]?.until>state.time)return false;return Math.hypot(x-o.x,y-o.y)<o.radius+r;});}
