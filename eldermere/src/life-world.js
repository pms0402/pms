import {HOMES,homeSpec,farmPosition} from './housing.js';
import {Pixel,hash} from './art.js';
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
 const node=(id,metal,x,y,map)=>add(id,'vein_'+metal,x,y,map,{radius:13,metal,interact:'mining',label:({copper:'구리',iron:'철',silver:'은',gold:'금',mythril:'미스릴'})[metal]+' 광맥 · 채광'});
 for(let i=0;i<10;i++)node('copper'+i,'copper',130+(i%3)*64,195+Math.floor(i/3)*70,'mine1');
 for(let i=0;i<8;i++)node('iron'+i,'iron',420+(i%3)*62,180+Math.floor(i/3)*88,'mine1');
 for(let i=0;i<4;i++)node('silver'+i,'silver',740+i%2*80,270+Math.floor(i/2)*82,'mine1');
 for(let i=0;i<4;i++)node('surface-copper'+i,'copper',1490+i%2*62,825+Math.floor(i/2)*65,'overworld');
 for(let i=0;i<4;i++)node('deep-silver'+i,'silver',160+i%2*70,160+Math.floor(i/2)*75,'mine2');
 for(let i=0;i<6;i++)node('gold'+i,'gold',405+i%2*82,150+Math.floor(i/2)*70,'mine2');
 for(let i=0;i<5;i++)node('mythril'+i,'mythril',740+i%2*95,245+Math.floor(i/2)*95,'mine2');
 for(let i=0;i<8;i++)add('coal'+i,'coalVein',118+i%4*185,470+Math.floor(i/4)*60,'mine1',{radius:12,resourceId:'coal',interact:'mining',label:'석탄층 · 채광'});
 for(let i=0;i<9;i++)add('stone'+i,'stonePile',125+i%3*96,1145+Math.floor(i/3)*65,'overworld',{radius:10,resourceId:'stone',interact:'mining',label:'풍화암 · 석재 채집'});
 for(let i=0;i<10;i++){add('mushroom'+i,'mushroomPatch',210+i%4*130,280+Math.floor(i/4)*65,'overworld',{resourceId:'mushroom',interact:'forage',label:'숲버섯 · 채집'});}
 for(let i=0;i<6;i++)add('apple'+i,'appleTree',260+i%2*70,1175+Math.floor(i/2)*75,'overworld',{resourceId:'apple',interact:'forage',radius:10,label:'야생 사과나무 · 채집'});
 // Expanded frontier retains every existing node ID and appends new permanent IDs.
 add('property-house','property_farmhouse',2130,1280,'overworld',{solid:{w:190,h:80}});
 add('property-door','ledger',2130,1315,'overworld',{interact:'house',label:'개척지 주택 · 농가 / 공방 / 대저택'});
 add('frontier-bench','anvil',2290,1180,'overworld',{radius:12,interact:'station',station:'bench',label:'개척지 작업대'});
 add('frontier-forge','forge',2335,1180,'overworld',{radius:16,interact:'station',station:'furnace',label:'개척지 용광로'});
 add('frontier-farm-sign','ledger',1930,1370,'overworld',{radius:7,interact:'farmManage',label:'개척지 농장 관리'});
 for(let i=12;i<64;i++){const q=farmPosition(i);add('plot'+i,'plot',q.x,q.y,'overworld',{plotIndex:i,interact:'plot',label:'개척지 텃밭 · 재배 관리'});}
 for(const [n,m]of ['copper','iron','silver','gold','mythril'].entries())for(let i=0;i<6;i++)node('frontier-'+m+i,m,1930+n*105+(i%2)*38,240+Math.floor(i/2)*100,'overworld');
 for(let i=0;i<35;i++){const x=1875+(i%6)*105,y=850+Math.floor(i/6)*120;if(Math.hypot(x-2130,y-1280)<220||y>1290&&x>1900)continue;add('frontier-tree'+i,i%4?'tree':'pine',x,y,'overworld',{radius:10,resource:'wood',hits:3,interact:'gather',label:'개척지 나무 · 벌목'});}
 for(let i=0;i<14;i++)add('frontier-herb'+i,'herb',180+(i%7)*215,1550+Math.floor(i/7)*180,'overworld',{resource:'herb',hits:1,interact:'gather',label:'들판 달빛풀 · 채집'});
 for(let i=0;i<10;i++)add('frontier-apple'+i,'appleTree',1850+i%2*80,1460+Math.floor(i/2)*70,'overworld',{radius:10,resourceId:'apple',interact:'forage',label:'개척지 사과나무 · 수확'});
 for(const [id,x,y]of [['frontier-wolf',2400,480],['frontier-bat',2220,360]])enemies.push({id,x,y,homeX:x,homeY:y,type:'wolf',map:'overworld',hp:75,maxHp:75,cooldown:1,windup:0,hit:0,dead:false,respawn:0});
 for(const [id,x,y,type,map]of[['cave-slime',530,280,'slime','mine1'],['cave-wolf',760,380,'wolf','mine1'],['depth-guard1',700,350,'caveguard','mine2'],['depth-guard2',790,180,'caveguard','mine2'],['depth-bat',380,460,'bat','mine2']])enemies.push({id,x,y,homeX:x,homeY:y,type,map,hp:type==='caveguard'?125:55,maxHp:type==='caveguard'?125:55,cooldown:.7,windup:0,hit:0,dead:false,respawn:0});
 return {objects,enemies,maps:{mine1:mineGround('mine1'),mine2:mineGround('mine2'),home:homeGround()}};
}
function wall(p,b){p.r(b.x,b.y,b.w,b.h+9,'#172d31');p.r(b.x,b.y,b.w,b.h,'#4f6460');p.r(b.x,b.y,b.w,3,'#9ca38a');for(let y=b.y+4;y<b.y+b.h;y+=8)for(let x=b.x+(y%2)*6;x<b.x+b.w-2;x+=18){p.r(x,y,Math.min(15,b.x+b.w-x-1),6,'#718175');p.r(x+1,y,Math.min(13,b.x+b.w-x-2),1,'#8e9680');}}
function mineGround(map){const p=new Pixel(960,640);p.r(0,0,960,640,'#142b30');for(let y=72;y<594;y+=8)for(let x=48;x<914;x+=8){const h=hash(x,y,map==='mine2'?77:4);p.r(x,y,8,8,h>.75?'#4d5e56':h>.25?'#40564f':'#354d49');if(h>.8)p.r(x+2,y+4,3,1,'#738174');if(h<.1)p.line(x,y+3,x+6,y+5,'#263f3f');}
 for(const b of [{x:42,y:38,w:880,h:34},{x:30,y:72,w:18,h:538},{x:914,y:72,w:18,h:538},{x:42,y:594,w:880,h:15},...MINE_WALLS[map]])wall(p,b);
 // Timber supports, rails, ore debris and pools have silhouettes and surface detail.
 for(const [x,y]of[[65,170],[895,170],[65,420],[895,420]]){p.r(x-5,y-50,10,50,'#60533b');p.r(x-3,y-47,2,45,'#b39860');p.r(x-8,y-50,17,5,'#b19862');p.r(x-7,y-7,14,4,'#807453');}
 for(let y=390;y<592;y+=12){p.r(470,y,2,12,'#9e9b7a');p.r(489,y,2,12,'#a9a886');p.r(464,y,34,3,'#7b6949');p.r(470,y,2,1,'#d1c39a');}
 for(let i=0;i<90;i++){const x=66+hash(i,2)*825,y=88+hash(8,i)*484;p.poly([[x,y],[x+3,y-4],[x+7,y-2],[x+9,y+2],[x+2,y+3]],i%5?'#607468':'#9b9d79');}
 if(map==='mine2'){p.ellipse(510,475,65,35,'#203e48');for(let i=0;i<20;i++)p.r(465+hash(i,2)*85,456+hash(3,i)*38,8,1,'#4d7774');}
 return p.canvas;}
export function homeGround(type='cottage'){
 const spec=HOMES[type]||HOMES.cottage,{w,h}=spec,p=new Pixel(w,h),floor=h-34;
 p.r(0,0,w,h,'#172b28');p.r(38,42,w-76,h-76,'#a39066');
 for(let y=78;y<floor;y+=12)for(let x=48+(y%3)*8;x<w-48;x+=36){p.r(x,y,35,11,hash(x,y)>.5?'#917c55':'#9f8860');p.r(x+2,y,30,1,'#c3aa76');p.r(x+3,y+3,1,1,'#665b40');p.line(x+6,y+7,x+29,y+7,'#a18c61');}
 p.r(38,36,w-76,42,spec.color);for(let x=40;x<w-38;x+=50){p.r(x,36,5,42,'#645b40');p.r(x,39,2,36,'#8d7952');}p.r(38,70,w-76,8,'#6c6245');p.r(38,36,w-76,5,'#ddd0a0');p.r(38,78,10,h-112,'#5c5b40');p.r(w-48,78,10,h-112,'#5c5b40');p.r(38,floor,w/2-55,10,'#655d40');p.r(w/2+17,floor,w/2-55,10,'#655d40');
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
