import {makeOutdoorTerrain,fillFloor} from './terrain.js';
import {neighborhoodWorld,dressWorld,townRoadDistance} from './world-composition.js';
import {valleyWorld,placeBlocked} from './valley-world.js';
import {valleySea} from './valley-data.js';
import {adventureWorld,ruinBlocked,RUINS} from './adventure-world.js';
import {lifeWorld,indoorBlocked} from './life-world.js';
import {hash,Pixel,sprite,spriteSize,drawSprite} from './art.js';
import {WORLD,DUNGEON_WALLS,isWater,isPath,riverX,regionAt,onBridge,isOriginalPath} from './data.js';
export function createWorld(){const objects=[],enemies=[];let id=0;const add=(type,x,y,extra={})=>{const o={id:'o'+id++,type,x,y,...extra};objects.push(o);return o;};
 add('house',425,557,{solid:{w:100,h:52},label:'목재와 향신료 · 상점'});add('shop',812,538,{solid:{w:100,h:52}});add('house',425,833,{solid:{w:100,h:52}});add('house',811,846,{solid:{w:100,h:52}});
 add('well',620,568,{radius:15,label:'우물 · 체력 회복',interact:'well'});add('bench',782,641,{radius:15,label:'제작대',interact:'bench'});add('elder',700,604,{label:'장로 로완 · 대화',interact:'elder'});add('merchant',456,610,{label:'상인 미라 · 거래',interact:'merchant'});add('farmer',690,1010,{label:'농부 엘린 · 대화',interact:'farmer'});
 for(const [type,x,y]of[['barrel',377,568],['crate',476,574],['barrel',868,549],['crate',874,576],['bush',505,558],['bush',746,541],['bush',383,840],['barrel',470,850],['mushroom',913,864],['log',268,740]])add(type,x,y,{radius:type==='barrel'||type==='crate'?8:0});
 add('sign',591,713,{radius:6,label:'이정표 읽기',interact:'sign'});add('entrance',1490,281,{label:'잊힌 별의 폐광 · 입장',interact:'entrance'});add('chest',1590,1000,{radius:10,label:'오래된 상자 열기',interact:'chest'});
 for(const [x,y]of[[531,578],[858,584],[534,833],[872,833],[979,645],[1173,645],[1460,305]])add('lamp',x,y,{radius:3});
 for(let x=300;x<920;x+=46)if(Math.abs(x-620)>60)add('fence',x,925,{solid:{w:44,h:5}});
 for(let x=270;x<=530;x+=44)add('fence',x,1115,{solid:{w:42,h:5}});
 for(const [x,y]of[[295,584],[307,811],[914,827],[895,486],[300,480],[945,595],[756,390],[530,396],[360,690],[940,708]])add('tree',x,y,{radius:10,resource:'wood',hits:3,label:'버드나무 · 목재 채집',interact:'gather',variant:id%3});
 for(let j=0;j<190;j++){const x=65+hash(j,7)*1780,y=100+hash(3,j)*1240;if(isWater(x,y)||isOriginalPath(x,y)||onBridge(x,y))continue;if(x>290&&x<935&&y>410&&y<900)continue;if(x>260&&x<940&&y>910&&y<1130)continue;if(Math.hypot(x-1490,y-281)<80||Math.hypot(x-1590,y-1000)<55)continue;if(objects.some(o=>Math.hypot(x-o.x,y-o.y)<44))continue;add(j%4===0?'pine':'tree',Math.round(x),Math.round(y),{radius:10,resource:'wood',hits:3,label:'나무 · 목재 채집',interact:'gather',variant:j%3});}
 for(const [x,y]of[[896,740],[924,765],[963,790],[1300,591],[1420,413],[1550,360],[400,330],[480,315],[1530,900]])add('ore',x,y,{radius:13,resource:'ore',hits:2,label:'청철 광맥 · 광석 채집',interact:'gather'});
 for(let j=0;j<44;j++){const x=260+hash(j,32)*1350,y=350+hash(42,j)*850;if(isWater(x,y)||isOriginalPath(x,y)||objects.some(o=>Math.hypot(x-o.x,y-o.y)<45))continue;add('herb',Math.round(x),Math.round(y),{resource:'herb',hits:1,label:'달빛풀 · 채집',interact:'gather'});}
 for(const [x,y]of[[734,756],[847,737],[535,870],[760,1092]])add('herb',x,y,{resource:'herb',hits:1,label:'달빛풀 · 채집',interact:'gather'});
 for(const [x,y,type]of[[1290,660,'slime'],[1350,550,'slime'],[1440,780,'wolf'],[1580,610,'wolf'],[1550,420,'slime'],[1380,960,'slime'],[230,180,'wolf'],[760,150,'wolf'],[1600,1180,'wolf']])enemies.push(enemy('e'+enemies.length,x,y,type));
 const life=lifeWorld(),adventure=adventureWorld(),valley=valleyWorld();life.objects.push(...valley.objects,...neighborhoodWorld());dressWorld(life.objects);Object.assign(life.maps,valley.maps);life.objects.push(...adventure.objects);life.enemies.push(...adventure.enemies);Object.assign(life.maps,adventure.maps);const reserved=life.objects.filter(o=>o.map==='overworld'&&!o.decor&&!['plot','stonePile','mushroomPatch','appleTree'].includes(o.type));const retained=objects.filter(o=>!['tree','pine','herb'].includes(o.type)||!reserved.some(n=>Math.hypot(o.x-n.x,o.y-n.y)<45));clearNewStreets(retained,life.objects);return {objects:retained,enemies:[...enemies,...life.enemies],ground:createGround(),dungeon:createDungeon(),lifeObjects:life.objects,maps:life.maps};}
function clearNewStreets(objects,lifeObjects){
 const all=[...objects,...lifeObjects],fixed=new Set(['295,584','307,811','914,827','895,486','300,480','945,595','756,390','530,396','360,690','940,708']),empty={time:0,harvested:{},life:{nodes:{}}};
 for(const o of all){if(o.resource!=='wood'||o.map&&o.map!=='overworld'||o.x>1150||o.y>1400||fixed.has(o.x+','+o.y)||townRoadDistance(o.x,o.y)>24)continue;
  const ox=o.x,oy=o.y;outer:for(let r=36;r<=180;r+=12)for(let i=0;i<20;i++){const x=Math.round(ox+Math.cos(i*Math.PI/10)*r),y=Math.round(oy+Math.sin(i*Math.PI/10)*r);if(townRoadDistance(x,y)<26||blocked(x,y,'overworld',all,empty,14))continue;o.x=x;o.y=y;break outer;}
 }
}
export function enemy(id,x,y,type,map='overworld'){return{id,x,y,homeX:x,homeY:y,type,map,hp:type==='guardian'?180:type==='wolf'?58:42,maxHp:type==='guardian'?180:type==='wolf'?58:42,cooldown:.5,windup:0,hit:0,dead:false,respawn:0};}
function createGround(){return makeOutdoorTerrain();}
function createDungeon(){const p=new Pixel(640,512);p.r(0,0,640,512,'#162a2d');fillFloor(p.c,7,64,76,512,382);p.r(64,46,512,8,'#77837a');p.r(64,54,512,12,'#4b6261');p.r(64,66,512,5,'#243e40');for(let x=76;x<576;x+=31)p.r(x,51,28,3,'#8a9082');
 for(const [x,y]of[[160,156],[480,156],[160,340],[480,340]]){p.r(x-14,y-44,29,45,'#273f43');p.r(x-12,y-44,25,33,'#627575');p.r(x-15,y-46,31,6,'#94a095');p.r(x-15,y-12,31,7,'#85958d');p.r(x-9,y-36,3,20,'#879891');p.r(x+6,y-36,3,20,'#445f61');}
 for(const wall of DUNGEON_WALLS){p.r(wall.x,wall.y,wall.w,wall.h+5,'#1c3338');p.r(wall.x,wall.y,wall.w,wall.h,'#536968');p.r(wall.x,wall.y,wall.w,3,'#a2aa95');for(let x=wall.x+3;x<wall.x+wall.w-6;x+=16){p.r(x,wall.y+4,13,5,'#7d8e82');p.r(x+6,wall.y+11,12,4,'#687e77');}}
 // A ritual mosaic, broken masonry and blue mineral seams give the ruin its own identity.
 for(let rad=21;rad<64;rad+=19){for(let a=0;a<Math.PI*2;a+=.05)p.dot(Math.round(320+Math.cos(a)*rad),Math.round(156+Math.sin(a)*rad*.48),'#738b7d');}
 for(let i=0;i<34;i++){const x=90+hash(i,11)*455,y=i%2?86+hash(8,i)*25:440+hash(8,i)*14;p.poly([[x,y],[x+5,y-4],[x+11,y-3],[x+13,y+4],[x+2,y+5]],'#657c75');p.line(x+2,y,x+9,y-2,'#8c9b8a');}
 for(const [x,y]of[[86,215],[550,215],[90,380],[550,380]]){p.poly([[x-5,y],[x-8,y-18],[x-3,y-26],[x+2,y-18],[x+5,y-6]],'#5e9b9b');p.line(x-4,y-21,x-3,y-5,'#abd5c2');p.poly([[x+1,y],[x+3,y-13],[x+7,y-15],[x+10,y-5],[x+6,y+2]],'#54858a');}
 for(let i=0;i<300;i++){const x=75+hash(i,7)*490,y=78+hash(2,i)*370;if(i%3===0)p.r(x,y,2,2,'#84927a');else p.line(x,y,x+5,y+2,'#283f42');}return p.canvas;}
export function objectBounds(o){if(o.solid)return{x:o.x-o.solid.w/2,y:o.y-o.solid.h-5,w:o.solid.w,h:o.solid.h};if(o.radius)return{x:o.x-o.radius,y:o.y-o.radius,w:o.radius*2,h:o.radius*2};return null;}
export function blocked(x,y,map,objects,state,r=7){if(map.startsWith('place_'))return placeBlocked(x,y,map,objects,r);if(RUINS[map])return ruinBlocked(x,y,map,r);if(['mine1','mine2','home'].includes(map))return indoorBlocked(x,y,map,objects,state,r);if(map==='dungeon'){if(x<73+r||x>568-r||y<76+r||y>458-r)return true;if(DUNGEON_WALLS.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h))return true;return [[160,156],[480,156],[160,340],[480,340]].some(([px,py])=>Math.abs(x-px)<15+r&&y>py-45-r&&y<py+r);}
 if(x<28||y<46||x>WORLD.w-28||y>WORLD.h-28)return true;
 for(const [dx,dy]of[[r,0],[-r,0],[0,r],[0,-r]])if(isWater(x+dx,y+dy))return true;
 return objects.some(o=>{if(o.map&&o.map!==map)return false;if(o.plotIndex!==undefined)return false;if(state.life?.nodes[o.id]?.until>state.time)return false;if(o.resource&&state.harvested[o.id]?.until>state.time)return false;const b=objectBounds(o);return b&&x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h;});}
export function drawObject(ctx,o,time,state){if(o.hidden||o.interact==='placeEnter')return;let type=o.type;if(o.id==='o0')type='valley_store';if(o.id==='o2')type='valley_inn';if(o.id==='property-house')type='property_'+(state.life.home.type&&state.life.home.type!=='cottage'?state.life.home.type:'farmhouse');
 if(o.plotIndex!==undefined){const plot=state.life.plots[o.id];if(plot?.crop){const cropTime=({wheat:55,carrot:80,melon:125,starbean:90,emberPepper:120,frostLotus:160})[plot.crop];type='crop_'+plot.crop+'_'+(plot.growth>=cropTime?3:plot.growth>cropTime*.4?2:1);}else if(!plot?.tilled){type='plotWild';}else type='plot';}
 if(state.life?.nodes[o.id]?.until>time){if(o.interact==='mining')type='rubble';else if(o.resourceId==='apple')type='appleTree';else return;}
 if(o.resource&&state.harvested[o.id]?.until>state.time){if(o.resource!=='wood')return;type='stump';}
 const animated=['forge','cookfire'].includes(type);const img=sprite(type,o.npc?(o.moving?Math.floor(o.walk||0)%4:0):animated?Math.floor(time*3)%4:o.variant||0,o.dir||0);const size=spriteSize(img);let anchorX=size.w/2,anchorY=size.h-7;
 if(['house','shop','mill'].includes(type))anchorY=132;if(type.startsWith('property_'))anchorY=size.h-8;
 if(type==='tree'||type==='pine')anchorY=size.h-8;
 if(o.npc||o.solid||o.resource==='wood'){ctx.save();ctx.fillStyle='#15362d35';ctx.beginPath();ctx.ellipse(o.x,o.y+2,o.npc?10:o.solid?Math.min(57,o.solid.w/2):18,o.npc?3:6,0,0,7);ctx.fill();ctx.restore();}drawSprite(ctx,img,Math.round(o.x-anchorX),Math.round(o.y-anchorY));if(type==='forge'||type==='cookfire'){ctx.save();ctx.globalCompositeOperation='screen';ctx.globalAlpha=.12+Math.sin(time*8+o.x)*.05;ctx.fillStyle='#ffb64d';ctx.beginPath();ctx.ellipse(o.x,o.y-19,8,6,0,0,7);ctx.fill();ctx.restore();}
 if(o.plotIndex!==undefined&&state.life.plots[o.id]?.water>0){ctx.fillStyle='#7eacb944';ctx.fillRect(o.x-15,o.y-3,30,3);}
 if(o.interact==='mining'&&state.life.job?.id===o.id){const j=state.life.job;ctx.fillStyle='#243c32';ctx.fillRect(o.x-16,o.y+5,32,3);ctx.fillStyle='#ddc98f';ctx.fillRect(o.x-16,o.y+5,32*(1-j.remaining/j.total),2);}
 if(o.npc){ctx.font='8px sans-serif';ctx.textAlign='center';ctx.fillStyle=o.working?'#e0c481':'#b2c2a0';ctx.fillText(o.working?'◈':'z',o.x,o.y-39);}
}
