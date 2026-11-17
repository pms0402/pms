import {fillFloor} from './terrain.js';
import {Pixel,hash,sprite,drawSprite} from './art.js';
import {PLACES,DISCOVERIES,valleySea,valleyPath} from './valley-data.js';
export function valleyWorld(){const objects=[],maps={};const add=(id,type,x,y,extra={})=>objects.push({id,type,x,y,map:'overworld',...extra});
 for(const [id,p]of Object.entries(PLACES)){add('door-'+id,'door',p.x,p.y,{interact:'placeEnter',place:id,label:p.name+' · 들어가기'});const map='place_'+id;maps[map]=roomGround(id);add('exit-'+id,'door',p.w/2,p.h-46,{map,interact:'placeExit',place:id,label:'계곡으로 나가기'});
  if(p.vendor)add('counter-'+id,'valley_counter',p.w/2,160,{map,shop:p.vendor,interact:'shopCounter',label:'계산대 · 거래',solid:{w:74,h:24}});
  if(id==='inn'){for(const[i,y]of[260,350].entries())add('inn-extra-bed'+i,'home_bed',560,y,{map,solid:{w:35,h:45}});add('inn-bed','home_bed',560,170,{map,interact:'sleep',label:'포근한 침대 · 쉬기 / 다음 날',solid:{w:35,h:45}});add('inn-cook','cookfire',120,155,{map,station:'cookfire',interact:'station',label:'여관의 주방 · 요리',radius:13});}
  if(id==='smithy'){add('indoor-forge','forge',110,150,{map,station:'furnace',interact:'station',label:'화덕 · 제련',radius:16});add('indoor-anvil','anvil',470,200,{map,station:'bench',interact:'station',label:'작업대 · 제작',radius:13});}
  if(id==='mill')add('mill-bench','sawbench',p.w/2,160,{map,station:'bench',interact:'station',label:'제분·가공 작업대',radius:16});
  if(id==='greenhouse'){add('glass-work','valley_counter',p.w/2,140,{map,interact:'greenhouse',label:'온실의 씨앗 상자 · 계절과 재배',solid:{w:74,h:24}});for(let i=0;i<6;i++)add('glass-herb'+i,'herb',130+i%3*180,250+Math.floor(i/3)*80,{map,resource:'herb',interact:'gather',label:'온실의 약초 · 채집'});}
  if(id==='library')add('archive-desk','valley_counter',p.w/2,160,{map,interact:'archive',label:'계곡의 기록 · 발견한 이야기',solid:{w:74,h:24}});
  if(id==='store'||id==='library')for(let x=70;x<p.w-100;x+=110)add('shelf-'+id+x,'collision',x+41,140,{map,hidden:true,solid:{w:83,h:40}});
  if(id!=='mill')for(const [n,x]of [86,p.w-86].entries())add('indoor-flower-'+id+n,'valley_flowers',x,p.h-120,{map,decor:true});
  const furnishings=id==='inn'?[[170,270],[350,270],[170,370],[350,370]]:id==='store'?[[140,270],[435,270],[140,355],[435,355]]:id==='library'?[[160,300],[510,300]]:[];for(const [i,[x,y]]of furnishings.entries())add('table-'+id+i,id==='store'?'village_potting':'valley_table',x,y,{map,solid:{w:id==='store'?54:41,h:18}});
 }
 for(const [id,type,x,y,w,h]of [['greenhouse','valley_greenhouse',2940,1530,120,60],['mill','valley_windmill',3230,1520,110,70],['archive','valley_inn',2970,1800,120,60],['harbor-store','valley_store',3010,530,110,55],['port-home','valley_farmhouse',3240,480,110,55],['east-home','valley_farmhouse',3270,1800,110,55]])add('building-'+id,type,x,y,{solid:{w,h}});
 add('harbor-counter','valley_market',3040,720,{shop:'fisher',interact:'shopCounter',label:'항구 교역소 · 세라의 물품',solid:{w:70,h:25}});add('port-fish','fishingSign',3540,650,{interact:'fishing',label:'별물결 부두 · 바다 낚시'});
 add('shipping-old','valley_shipping',712,1125,{interact:'shipping',label:'출하 상자 · 다음 날 정산',radius:10});add('shipping-new','valley_shipping',2010,1340,{interact:'shipping',label:'출하 상자 · 다음 날 정산',radius:10});
 for(const d of DISCOVERIES)add('memory-'+d.id,'valley_shrine',d.x,d.y,{interact:'discovery',discovery:d.id,label:d.name+' · 이야기 발견',radius:12});
 const signs=[['harbor',2680,680,'동쪽은 물결항, 남쪽은 햇살 마을입니다.'],['hamlet',2860,1650,'유리빛 온실과 제분소, 기록관을 둘러보세요.'],['woods',2980,2180,'꽃비 숲에는 오래된 약속의 흔적이 남아 있습니다.'],['marsh',1700,2190,'서쪽 다리를 건너면 들꽃 평원, 동쪽은 꽃비 숲입니다.']];for(const [id,x,y,text]of signs)add('valley-sign-'+id,'sign',x,y,{interact:'valleySign',text,label:'길 안내 읽기',radius:5});
 for(let i=0;i<300;i++){const x=2600+hash(i,179)*1140,y=100+hash(223,i)*2650;if(valleySea(x,y)||valleyPath(x,y)||objects.some(o=>Math.hypot(o.x-x,o.y-y)<100)||x>2820&&x<3350&&y>1300&&y<1920)continue;const type=y>2050?'valley_cherry':x>3400?'pine':i%3===0?'valley_willow':'tree';add('new-grove'+i,type,Math.round(x),Math.round(y),{canopy:true,resource:'wood',interact:'gather',radius:9,label:'계곡의 나무 · 벌목'});}
 for(let i=0;i<85;i++){const x=150+hash(i,317)*2300,y=1980+hash(67,i)*760;if(valleyPath(x,y)||Math.abs(x-(1080+Math.sin(y/180)*54))<100)continue;add('south-grove'+i,i%3?'valley_willow':'tree',Math.round(x),Math.round(y),{resource:'wood',canopy:true,interact:'gather',radius:9,label:'들판의 나무 · 벌목'});}
 for(let i=0;i<120;i++){const x=2620+hash(i,419)*850,y=850+hash(217,i)*1800;if(valleySea(x,y)||valleyPath(x,y)||objects.some(o=>o.solid&&Math.hypot(o.x-x,o.y-y)<100))continue;add('flower-border'+i,i%8===0?'valley_rocks':'valley_flowers',Math.round(x),Math.round(y),{resource:i%8===0?'ore':'herb',interact:'gather',label:i%8===0?'수정 바위 · 청철 채집':'들꽃과 약초 · 채집',radius:i%8===0?10:0});}
 // Curated gardens, flower borders and lamps make the village readable at first arrival.
 for(const [i,[x,y]]of [[334,590],[500,570],[740,561],[882,570],[338,859],[510,865],[725,873],[900,870],[537,740],[721,739]].entries())add('town-flowers'+i,'valley_flowers',x,y,{decor:true});
 for(const [i,[x,y]]of [[2870,680],[3090,680],[3170,1650],[2800,1650],[2990,1990],[2990,2390],[1700,2400],[610,2300]].entries())add('valley-lamp'+i,'lamp',x,y,{radius:3});
 return{objects,maps};}
export function roomGround(id){const d=PLACES[id],p=new Pixel(d.w,d.h);p.r(0,0,d.w,d.h,'#213b38');p.r(38,38,d.w-76,d.h-72,'#d5b98d');fillFloor(p.c,['smithy','greenhouse'].includes(id)?17:id==='inn'?13:12,44,80,d.w-88,d.h-120);if(id==='store'||id==='library')fillFloor(p.c,16,d.w/2-67,192,134,130);p.r(37,35,d.w-74,45,'#e4cda5');fillFloor(p.c,14,37,35,d.w-74,39);p.r(37,74,d.w-74,8,'#755e47');for(let x=48;x<d.w-50;x+=45){p.r(x,35,5,43,'#856746');p.r(x+1,38,2,35,'#c3a370');}for(let x=92;x<d.w-100;x+=180){p.r(x,42,45,28,'#7d6e56');p.r(x+3,44,39,23,'#9ac7b8');p.r(x+21,43,3,27,'#c8b284');p.r(x,56,45,2,'#c8b284');p.r(x+4,45,15,7,'#e8e8bf');}p.r(38,80,8,d.h-120,'#795f46');p.r(d.w-46,80,8,d.h-120,'#795f46');
 if(id==='store'||id==='library')for(let x=70;x<d.w-100;x+=110)drawSprite(p.c,sprite('village_bookcase'),x,80,83,65);
 if(id==='greenhouse'){for(let y=190;y<390;y+=100)for(let x=90;x<d.w-80;x+=90)drawSprite(p.c,sprite('crop_'+(x%3?'melon':'carrot')+'_2'),x-20,y-28,44,43);}
 if(id==='inn'){fillFloor(p.c,16,80,200,340,198);p.r(470,90,8,230,'#7b6149');p.r(471,90,2,230,'#c2a378');}
 if(id==='mill')for(const[x,y]of[[100,150],[430,150],[110,270],[420,280]])drawSprite(p.c,sprite('village_supplies'),x-26,y-40,52,47);
 return p.canvas;}
export function placeBlocked(x,y,map,objects,r){const id=map.slice(6),p=PLACES[id];if(x<48+r||x>p.w-48-r||y<84+r||y>p.h-38-r)return true;return objects.some(o=>o.map===map&&o.solid&&x+r>o.x-o.solid.w/2&&x-r<o.x+o.solid.w/2&&y+r>o.y-o.solid.h-5&&y-r<o.y-5);}
