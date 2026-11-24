import {JOURNEYS,JOURNEY_LIFTS} from './journey-data.js';
import {clearArena} from './combat-fields.js';

const material=chapter=>chapter===4?{material:'archive',tile:1}:chapter===6?{material:'harbor',tile:1}:chapter===7?{tile:0}:{tile:chapter===3?3:chapter===2?2:0};
export function buildJourneys(world){
 world.journeys=JOURNEYS;
 const floor=(j,dx,y,w,extra={})=>{const progress=(dx+w/2)/j.length,chapter=progress<.5?j.from:j.to;const q={x:j.start+dx,y,w,h:1800,foundation:true,stair:true,journey:j.id,...material(chapter),...extra};world.platforms.push(q);return q;};
 const steps=(j,dx,y,count,down)=>{for(let i=0;i<count;i++)floor(j,dx+i*24,y+(down?1:-1)*12*(i+1),24,{stair:true});};
 const object=(j,id,type,dx,y,label,extra={})=>world.objects.push({id,type,x:j.start+dx,y,label,journey:j.id,...extra});
 const prop=(j,dx,y,art,size=120)=>world.journeyScenery.push({x:j.start+dx,y,art,size,journey:j.id});
 const lift=(j,id,dx,bottom,top)=>{const m={id,x:j.start+dx-65,y:bottom,w:130,h:18,oneway:true,mover:true,bottom,top,target:bottom,speed:85,phase:0,tile:0,journey:j.id};world.movers.push(m);object(j,id,'route-lift',dx,bottom,'승강기 움직이기',{machine:id});for(const[y,suffix]of[[bottom,'lower'],[top,'upper']])object(j,id+'-'+suffix,'journey-call',dx+(y===top?(j.kind==='mine'?85:-85):(j.kind==='mine'?-85:85)),y,'승강기 부르기',{machine:id,target:y,art:20});};
 world.journeyScenery=[];
 for(const j of JOURNEYS){
  const west=world.objects.find(o=>o.id===j.object);if(west)Object.assign(west,{type:'journey-door',connection:j.id,side:'west',art:j.westArt,label:j.name+' · 들어가기'});else world.objects.push({id:j.object,type:'journey-door',x:j.west,y:302,connection:j.id,side:'west',art:j.westArt,label:j.name+' · 들어가기'});
  world.objects.push({id:j.id+'-return',type:'journey-door',x:j.east,y:302,connection:j.id,side:'east',art:j.eastArt,label:j.name+'으로 돌아가기'});
  world.gates.push({id:'journey-road-'+j.id,x:j.border-65,y:-1480,w:20,h:1980,travelBarrier:true,hidden:true});
  world.gates.push({id:'journey-door-'+j.id,x:j.west-22,y:82,w:44,h:220,travelBarrier:true,hidden:true});
  for(const dx of [-20,j.length-8])world.platforms.push({x:j.start+dx,y:-1480,w:28,h:2200,tile:0,journey:j.id,ceiling:true});
  const lastY=j.kind==='cliff'?478:302;
  object(j,j.id+'-leave-west','journey-exit',50,302,'지나온 길로 나가기',{connection:j.id,side:'west',art:j.westArt});
  object(j,j.id+'-leave-east','journey-exit',j.length-50,lastY,'통로 끝의 문 열기',{connection:j.id,side:'east',art:j.eastArt});
  world.gates.push({id:'journey-inside-west-'+j.id,x:j.start+28,y:82,w:44,h:220,travelBarrier:true,hidden:true,journey:j.id});
  world.gates.push({id:'journey-inside-east-'+j.id,x:j.end-72,y:lastY-220,w:44,h:220,travelBarrier:true,hidden:true,journey:j.id});
  if(j.kind==='pilgrim'){
   floor(j,0,302,200);steps(j,200,302,10,true);floor(j,440,422,380);steps(j,820,422,10,false);floor(j,1060,302,j.length-1060);
   for(const dx of [180,540,870])prop(j,dx,dx<200?302:422,1,76);
   prop(j,580,422,0,240);prop(j,1120,302,2,210);
  }else if(j.kind==='mine'){
   floor(j,0,302,180);steps(j,180,302,11,true);floor(j,444,434,806);floor(j,1250,302,j.length-1250);
   lift(j,JOURNEY_LIFTS[0],1195,434,302);
   for(let dx=240;dx<1120;dx+=150){const y=dx<444?302+Math.ceil((dx-180)/24)*12:434;world.platforms.push({x:j.start+dx,y:-100,w:Math.min(150,1120-dx),h:y-5,ceiling:true,journey:j.id,tile:0});prop(j,dx+60,y,21,170);}
   prop(j,490,434,4,220);prop(j,950,434,5,145);
  }else if(j.kind==='rail'){
   floor(j,0,302,680);floor(j,680,410,82);floor(j,762,302,j.length-762);
   floor(j,670,280,110,{oneway:true,h:18,foundation:false,tile:3});
   for(let dx=190;dx<j.length-150;dx+=130)prop(j,dx,302,7,110);
   prop(j,485,302,6,150);floor(j,460,250,70,{h:52,foundation:false,tile:3});
   object(j,j.id+'-rail-latch','journey-latch',565,302,'철도 차단기 열기',{art:20});
   object(j,j.id+'-rail-latch-return','journey-latch',725,302,'철도 차단기 열기',{art:20});
   world.gates.push({id:'journey-rail-latch',x:j.start+635,y:82,w:32,h:220,journey:j.id,journeyLatch:true});
   prop(j,1160,302,8,230);
  }else if(j.kind==='crypt'){
   floor(j,0,302,180);steps(j,180,302,11,true);floor(j,444,434,550);steps(j,994,434,11,false);floor(j,1258,302,j.length-1258);
   for(let dx=430;dx<1040;dx+=160){world.platforms.push({x:j.start+dx,y:-100,w:160,h:429,ceiling:true,journey:j.id,tile:0});prop(j,dx+70,434,dx<750?9:22,180);}
   prop(j,1350,302,10,220);
  }else if(j.kind==='cliff'){
   floor(j,0,302,180);steps(j,180,302,15,true);floor(j,540,482,250);floor(j,790,482,660,{h:28,foundation:false,material:'harbor',tile:1});floor(j,1450,482,j.length-1450,{stair:true});
   for(const dx of [530,750,1070,1410])prop(j,dx,478,dx===750||dx===1410?13:12,dx===750||dx===1410?135:210);
   prop(j,1520,478,17,135);world.waterAreas.push({id:'journey-sea',x:j.start+540,w:j.length-540,level:510,bottom:620,journey:j.id,sea:true});
  }else{
   floor(j,0,302,180);steps(j,180,302,15,false);floor(j,540,122,650);floor(j,1190,302,j.length-1190);
   lift(j,JOURNEY_LIFTS[1],1240,302,122);
   for(const dx of [200,540,990])prop(j,dx,dx<540?302:122,dx===200?15:13,dx===200?140:150);
   prop(j,1440,302,16,260);world.waterAreas.push({id:'journey-coast-sea',x:j.start+180,w:j.length-180,level:510,bottom:620,journey:j.id,sea:true});
  }
  // End landings remain clear for preparation and turning back.
  prop(j,105,302,18,68);prop(j,j.length-105,lastY,19,68);
 }
 return world;
}
export const journeyGateActive=(g,gate)=>gate.travelBarrier?true:gate.journeyLatch?!g.profile.journeyDevices?.railLatch&&!g.profile.journeys?.freight:null;
export function enterJourney(g,j,side,exiting=false){
 if(g.inTutorial||g.bossActive||g.p.dead||g.p.action||g.p.hurt>0)return false;
 if(!g.profile.flags[j.boss]||j.id==='undercroft'&&!g.profile.flags.sister){g.tell(j.id==='undercroft'?'누나의 입탑 기록부터 읽어 보자.':'수호자의 종이 아직 이 문을 붙들고 있다.');return false;}
 const x=exiting?(side==='east'?j.east+80:j.west-75):(side==='west'?j.start+120:j.end-125),y=exiting?302:side==='east'&&j.kind==='cliff'?478:302;
 if(exiting&&side==='east')g.profile.journeys[j.id]=true;
 Object.assign(g.p,{x,y,vx:0,vy:0,grounded:false,coyote:0,jumps:0,jumpBuffer:0,action:null,comboQueued:false,dir:side==='east'?1:-1,lastSafe:{x,y}});
 if(!exiting)g.p.dir=side==='west'?1:-1;
 g.projectiles=[];g.bladeEchoes=[];clearArena(g);g.attachToFloor();g.selectBoss();g.save();g.event('journey',{id:j.id,exiting,side});g.sound('mechanism');return true;
}
export function interactJourney(g,o){
 if(o.type==='journey-door'||o.type==='journey-exit')return enterJourney(g,JOURNEYS.find(j=>j.id===o.connection),o.side,o.type==='journey-exit');
 if(o.type==='journey-latch'){if(!g.profile.journeyDevices.railLatch){g.profile.journeyDevices.railLatch=true;g.tell('레일 위의 차단기가 올라갔다.');g.sound('mechanism');g.save();}return true;}
 if(o.type==='journey-call'){const m=g.world.movers.find(m=>m.id===o.machine);m.target=o.target;g.tell('사슬이 움직이기 시작했다.');g.sound('mechanism');g.save();return true;}
 return null;
}
