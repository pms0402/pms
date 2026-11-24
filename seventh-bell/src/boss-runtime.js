import {REGISTERED_WEAPONS} from './boss-registration.js';
import {BOSS_ACTIONS,selectBossAction} from './boss-actions.js';
import {BOSS_DEFS} from './bosses.js';
import {BOSS_MOTION,bossPose,BOSS_RIG} from './boss-motion.js';
import {advanceCreatureGait} from './creature-motion.js';
import {body,solids,clearLine} from './world.js';
import {bladeTouches} from './blade.js';
import {addField,clearArena} from './combat-fields.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),toward=(v,target,amount)=>v<target?Math.min(target,v+amount):Math.max(target,v-amount);
function field(g,e,config){return addField(g,{owner:e.id,pattern:e.pattern,sourceX:e.x,...config});}
function platform(g,e,x,y,w=100,life=13,extra={}){g.arenaPlatforms??=[];const p={owner:e.id,id:e.id+'-step-'+g.arenaPlatforms.length,x,y,w,h:18,oneway:true,age:0,life,tile:e.id==='carillon'?2:0,...extra};g.arenaPlatforms.push(p);return p;}
function shot(g,e,kind,x,y,vx,vy,damage,range=450,extra={}){g.spawnShot(x,y,vx,vy,damage,e.id,kind,range);const q=g.projectiles.at(-1);Object.assign(q,{destructible:false,radius:6,...extra});return q;}
function aimShot(g,e,kind,damage,angleOffset=0,speed=180,origin=null,extra={}){const x=origin?.x??e.x+e.dir*20,y=origin?.y??e.y-49,angle=Math.atan2(e.aim.y-y,e.aim.x-x)+angleOffset;return shot(g,e,kind,x,y,Math.cos(angle)*speed,Math.sin(angle)*speed,damage,500,extra);}
function once(e,key,at,fn){if(e.t>=at&&!e.events.has(key)){e.events.add(key);fn();}}
function harm(g,e,damage,segment){if(!e.hitBeats.has(e.beat||0)&&bladeTouches(segment,body(g.p),4)&&clearLine(g,segment.ax,segment.ay,g.p.x,g.p.y-25)){e.hitBeats.add(e.beat||0);g.hurt(damage,e);}}
function cut(g,e,damage,length=110,y=42,extra={}){const pose=bossPose(e),trace=pose&&REGISTERED_WEAPONS[pose.sheet===e.id+'-motion'?e.id:pose.sheet]?.[pose.row]?.[pose.col],scale=pose?pose.size/192:1,tip=trace?{x:e.x+(trace.tip[0]-pose.root)*scale*e.dir,y:e.y+(trace.tip[1]-pose.foot)*scale}:{x:e.x+e.dir*length,y:e.y-y+(extra.slope||0)};const segment={ax:e.x+e.dir*12,ay:e.y-43,bx:e.x+e.dir*Math.min(length,Math.max(25,Math.abs(tip.x-e.x))),by:tip.y,ghost:{id:e.id,x:e.x,y:e.y,dir:e.dir,row:pose?.row||0,col:pose?.col||0}};e.steel={...segment,life:.16,kind:extra.kind||'cut'};harm(g,e,damage,segment);if(!e.events.has('swordSound'+(e.beat||0))){e.events.add('swordSound'+(e.beat||0));g.sound('heavy');}return segment;}
function scheduled(g,e,delay,fn){e.pending??=[];e.pending.push({at:g.clock+delay,fn});}
function prepareSteps(g,e,style='voice'){
 const d=BOSS_DEFS[e.id],mid=(d.left+d.right)/2;
 for(const [dx,y]of[[-240,255],[-110,210],[35,170],[190,210]])platform(g,e,mid+dx,y,105,14,{style});
}
function returning(g,e,kind,speed,damage,outRange,extra={}){e.anchorOut=true;const q=aimShot(g,e,kind,damage,0,speed,null,{tether:true,outRange,returnSpeed:e.phase===2?340:250,holdTime:.7,hold:0,age:0,range:1800,life:6,radius:kind==='anchor'?11:7,...extra});return q;}
function bossBeatPose(e,beat,waiting){e.poseRow=7;e.poseCol=Math.min(5,beat*2+(waiting?0:1));}

const CONTROLLERS={
 edran(g,e,a){
  if(e.pattern==='gateShield'){e.shielding=true;e.vx=e.dir*42;if(Math.abs(g.p.x-e.x)<76||e.t>1.05){once(e,'bash',0,()=>{e.shielding=false;cut(g,e,a.damage,65,29);});if(e.t>.18+1.05)finish(e);}}
  if(e.pattern==='gateBlade')once(e,'cut',.05,()=>cut(g,e,a.damage,113,61));
  if(e.pattern==='gateCounter')once(e,'counter',.06,()=>{e.queuedRiposte=false;e.shielding=false;cut(g,e,a.damage,91,39);});
  if(e.pattern==='gateRift')once(e,'ground',.18,()=>{cut(g,e,a.damage,83,30,{slope:26});if(e.state!=='attack')return;field(g,e,{kind:'crack',x:e.aim.x-42,y:292,w:84,h:10,warning:.45,duration:2.2,damage:23,color:'#e0b587'});});
  if(e.pattern==='gateRush'){e.shielding=e.phase===1;e.vx=e.dir*255;cut(g,e,a.damage,57,28);const d=BOSS_DEFS.edran;if(e.x<=d.left+76||e.x>=d.right-70){e.wallStun=true;finish(e);e.followup=null;e.stagger=1.8;e.shielding=false;g.fx(e.x,e.y-30,'hit',.5);}}
  if(e.pattern==='knightThree'){
   const beat=Math.min(2,Math.floor(e.t/.73)),phase=e.t-beat*.73;e.beat=beat;bossBeatPose(e,beat,phase<.3);
   once(e,'combo'+beat,beat*.73+.3,()=>cut(g,e,beat===2?52:40,beat===1?98:112,beat===0?60:beat===1?15:35,{slope:beat===2?31:0}));
  }
 },
 marie(g,e,a){
  if(e.pattern==='soundRing')once(e,'ring',.08,()=>{field(g,e,{kind:'ring',x:e.x,y:e.y-8,speed:185,ry:22,thickness:6,warning:0,duration:2.3,damage:a.damage,color:'#a1eee0'});if(e.phase===2)scheduled(g,e,.8,()=>field(g,e,{kind:'ring',x:e.x,y:e.y-89,speed:165,ry:24,warning:0,duration:2.3,damage:36,color:'#e9e1ad'}));});
  if(e.pattern==='choirShards')for(let i=0;i<3;i++)once(e,'note'+i,.08+i*.13,()=>aimShot(g,e,'note',a.damage,(i-1)*.2,170));
  if(e.pattern==='silentGround')once(e,'silence',.08,()=>field(g,e,{kind:'silence',x:e.aim.x-75,y:290,w:150,h:12,warning:.9,duration:5.5,color:'#6cadad'}));
  if(e.pattern==='voiceStairs')once(e,'stairs',.1,()=>{prepareSteps(g,e);e.elevatedUntil=g.clock+9;e.elevation=170;e.moveTo={x:clamp(e.aim.x+150,BOSS_DEFS.marie.left+150,BOSS_DEFS.marie.right-170),y:170};});
  if(e.pattern==='reversePeal')once(e,'forward',.1,()=>{
   const d=BOSS_DEFS.marie,dir=e.dir,from=dir>0?d.left+35:d.right-35,dist=d.right-d.left-70;
   shot(g,e,'choirWave',from,288,e.dir*190,0,a.damage,dist,{radius:9});
   scheduled(g,e,dist/190+.65,()=>shot(g,e,'choirWave',dir>0?d.right-35:d.left+35,288,-dir*190,0,a.damage,dist,{radius:9}));
  });
 },
 brag(g,e,a){
  if(e.pattern==='anvilStrike')once(e,'anvil',.18,()=>{cut(g,e,a.damage,85,31,{slope:27});if(e.state!=='attack')return;field(g,e,{kind:'metal',x:clamp(e.aim.x-42,BOSS_DEFS.brag.left+65,BOSS_DEFS.brag.right-140),y:291,w:84,h:11,warning:.9,duration:2.7,damage:e.phase===2?31:24,color:'#ef9b62'});});
  if(e.pattern==='moltenFlow')once(e,'pour',.13,()=>{const d=BOSS_DEFS.brag;field(g,e,{kind:'lava',x:d.left+80,y:333,w:230,h:47,warning:1.5,duration:5.5,damage:35,color:'#ed8651',flow:55,limit:d.left+110});});
  if(e.pattern==='chainCast')once(e,'chain',.08,()=>returning(g,e,'ironWeight',220,a.damage,320));
  if(e.pattern==='metalSpray')once(e,'spray',.12,()=>{for(let i=0;i<5;i++){const angle=-Math.PI*.88+i*.15;shot(g,e,'metalShard',e.x,e.y-50,e.dir*Math.abs(Math.cos(angle))*190,Math.sin(angle)*190,a.damage,460,{gravity:340,radius:4});}});
  if(e.pattern==='overheat')once(e,'heat',.12,()=>{if(e.cooledUntil>g.clock)return;e.overheatUntil=g.clock+6;e.wasHot=true;field(g,e,{kind:'heat',x:e.x-53,y:e.y-74,w:106,h:74,warning:.7,duration:5.3,damage:22,color:'#f0a571',follow:e.id});});
 },
 leonel(g,e,a){
  if(e.pattern==='recordBlades')for(let i=0;i<3;i++)once(e,'paper'+i,.06+i*.22,()=>aimShot(g,e,'paperKnife',a.damage,0,195,{x:e.x-e.dir*(i*17),y:e.y-48-i*23}));
  if(e.pattern==='eraseSentence')once(e,'erase',.13,()=>{const x=clamp(e.aim.x-55,BOSS_DEFS.leonel.left+90,BOSS_DEFS.leonel.right-210);field(g,e,{kind:'erase',x,y:302,w:110,h:10,warning:1.25,duration:e.phase===2?3.2:4.5,color:'#bda5dc'});platform(g,e,x-30,430,170,8,{style:'book'});});
  if(e.pattern==='bookMaze')once(e,'maze',.1,()=>{const x=clamp((e.x+e.aim.x)/2,BOSS_DEFS.leonel.left+140,BOSS_DEFS.leonel.right-180);g.arenaObstacles.push({owner:e.id,x:x-22,y:197,w:44,h:105,age:0,warning:1.25,life:7.5,style:'bookcase'});});
  if(e.pattern==='futureRecord')once(e,'future',.12,()=>{field(g,e,{kind:'future',x:e.aim.x-32,y:e.aim.y-73,w:64,h:97,warning:1.05,duration:.22,damage:a.damage,color:'#dbc2ed'});if(e.phase===2){const x=clamp(e.aim.x+(e.dir*140),BOSS_DEFS.leonel.left+65,BOSS_DEFS.leonel.right-100);field(g,e,{kind:'future',x:x-32,y:205,w:64,h:97,warning:1.9,duration:.22,damage:a.damage,color:'#c1a2e3'});}});
  if(e.pattern==='invertedPage')once(e,'page',.15,()=>{prepareSteps(g,e,'book');e.x=e.destination.x;e.y=e.destination.y;e.elevation=e.y;e.elevatedUntil=g.clock+6;e.teleportFade=.22;e.exposedUntil=g.clock+1.4;e.state='recover';e.t=0;});
 },
 arkein(g,e,a){
  if(e.pattern==='royalFirst'){
   e.beat=e.t<.62?0:1;e.poseRow=1;e.poseCol=e.t<.18?3:e.t<.38?4:e.t<.64?2:4;
   once(e,'first',.06,()=>cut(g,e,a.damage,108,54));
   once(e,'turn',.38,()=>{e.nextDir=Math.sign(g.p.x-e.x)||e.dir;e.secondTarget={x:g.p.x,y:g.p.y};});
   once(e,'return',.68,()=>{if(Math.abs(e.secondTarget.x-e.x)<153){e.dir=e.nextDir;cut(g,e,a.damage,140,32);}});
  }
  if(e.pattern==='dawnThrust'){e.vx=e.dir*180;once(e,'thrust',.05,()=>cut(g,e,a.damage,145,31));}
  if(e.pattern==='royalGuard'){
   e.shielding=!e.events.has('riposte');e.poseRow=3;e.poseCol=e.counterAt!==undefined?e.t<e.counterAt?2:4:2;
   if(e.counterAt!==undefined)once(e,'riposte',e.counterAt,()=>{e.shielding=false;cut(g,e,a.damage,120,39);});
  }
  if(e.pattern==='royalProcession'){
   const beat=Math.min(2,Math.floor(e.t/.8)),local=e.t-beat*.8;e.beat=beat;e.poseRow=4;e.poseCol=Math.min(5,beat*2+(local<.35?0:1));e.vx=local<.3?e.dir*65:0;
   once(e,'turn'+beat,beat*.8,()=>{e.dir=Math.sign(g.p.x-e.x)||e.dir;});
   once(e,'march'+beat,beat*.8+.35,()=>{cut(g,e,a.damage,beat===2?132:88,beat===1?17:40);if(beat===2){e.hitBeats.delete(beat);const dir=e.dir;e.dir=-dir;cut(g,e,a.damage,100,40);e.dir=dir;}});
  }
  if(e.pattern==='artificialDawn')once(e,'dawn',.1,()=>{const d=BOSS_DEFS.arkein;for(let i=0;i<3;i++)field(g,e,{kind:'light',x:d.left+120+i*310,y:100,w:115,h:202,warning:1.25,duration:.35,damage:a.damage,color:'#e9d0a3'});});
  if(e.pattern==='royalFour'){
   const beat=Math.min(3,Math.floor(e.t/.76)),local=e.t-beat*.76;e.beat=beat;bossBeatPose(e,Math.min(2,beat),local<.31);if(beat===3){e.poseRow=1;e.poseCol=local<.31?2:4;}
   once(e,'king-turn'+beat,beat*.76,()=>{e.dir=Math.sign(g.p.x-e.x)||e.dir;});
   once(e,'four'+beat,beat*.76+.33,()=>cut(g,e,beat===3?68:54,beat===2?142:115,[59,16,31,35][beat],{slope:beat===3?29:0}));
  }
 },
 neris(g,e,a){
  if(e.pattern==='anchorThrow')once(e,'anchor',.1,()=>returning(g,e,'anchor',220,a.damage,365));
  if(e.pattern==='hookPull')once(e,'hook',.08,()=>returning(g,e,'hook',250,a.damage,300,{holdTime:.05,pull:true}));
  if(e.pattern==='risingTide')once(e,'tide',.15,()=>{const d=BOSS_DEFS.neris;for(const[x,y]of[[d.left+110,257],[d.left+305,213],[d.left+520,257],[d.left+735,213],[d.left+950,257]])platform(g,e,x,y,120,13,{style:'cargo'});field(g,e,{kind:'flood',x:d.left+65,y:350,w:d.right-d.left-130,h:130,warning:1.7,duration:6,damage:22,color:'#77c1c2',base:350,peak:278});});
  if(e.pattern==='lighthouseAim')once(e,'beam',.1,()=>{const d=BOSS_DEFS.neris;const ax=d.left+40,ay=112,angle=Math.atan2(e.aim.y-ay,e.aim.x-ax);field(g,e,{kind:'beam',ax,ay,bx:e.aim.x,by:e.aim.y,warning:1.4,duration:1.8,radius:6,damage:a.damage,color:'#f2d29a',scan:{from:angle-.16,to:angle+.16,length:Math.hypot(e.aim.x-ax,e.aim.y-ay)+180}});});
  if(e.pattern==='ropeOrbit')once(e,'rope',.1,()=>{if(e.anchorOut)return;field(g,e,{kind:'ropeOrbit',orbitOwner:e.id,ax:e.x,ay:e.y-34,bx:e.x-88,by:e.y-34,warning:0,duration:.55,radius:7,length:88,damage:a.damage,unblockable:false,color:'#cab98b'});e.orbitUntil=g.clock+.55;});
 },
 carillon(g,e,a){
  if(e.pattern==='bellVibration')for(let i=0;i<3;i++)once(e,'bellwave'+i,.08+i*.57,()=>{const y=e.y-(e.phase===2&&i===1?88:10);for(const dir of [-1,1])shot(g,e,'bellWave',e.x+dir*25,y,dir*210,0,a.damage,280,{radius:8});g.sound('bell');});
  if(e.pattern==='leftAttack')once(e,'left',.08,()=>{const steel=cut(g,e,a.damage,119,43);if(e.state!=='attack')return;field(g,e,{kind:'bladeEcho',...steel,warning:1.05,duration:.2,damage:a.damage,color:'#a5d2d1',radius:5});if(e.phase===2&&e.lastCut)field(g,e,{kind:'bladeEcho',...e.lastCut,warning:1.8,duration:.2,damage:55,color:'#c6b3e1',radius:5});e.lastCut={...steel};});
  if(e.pattern==='resonanceClones')once(e,'clones',.15,()=>{const d=BOSS_DEFS.carillon;for(const x of [d.left+210,d.right-210])g.arenaClones.push({id:'clone-'+(++g.fieldSerial|| (g.fieldSerial=1)),clone:true,type:'carillon',x,y:302,w:37,h:75,dir:Math.sign(g.p.x-x)||1,hp:3,maxHp:3,t:0,age:0,life:13,dead:false});});
  if(e.pattern==='gearRotation')once(e,'rotate',.15,()=>{const d=BOSS_DEFS.carillon,cx=(d.left+d.right)/2;for(let i=0;i<4;i++)platform(g,e,cx,220,112,15,{orbit:true,cx,cy:206,rx:190,ry:70,angle:i*Math.PI/2,rate:.35,style:'gear'});});
  if(e.pattern==='seventhPeal')for(let i=0;i<7;i++)once(e,'peal'+i,.2+i*(e.pealInterval||.85),()=>{
   e.beat=i;e.poseRow=i%2?7:5;e.poseCol=i%2?3:4;g.sound('bell');const d=BOSS_DEFS.carillon,dir=i%2?-e.dir:e.dir;
   if(i===2||i===5){const x=clamp(e.aim.x+(i===5?180:0),d.left+80,d.right-160);field(g,e,{kind:'light',x:x-40,y:192,w:80,h:110,warning:.65,duration:.18,damage:a.damage,color:'#b8dad0'});}
   else if(i===6)field(g,e,{kind:'crack',x:e.x-85,y:290,w:170,h:12,warning:.8,duration:.25,damage:e.pealInterval<.85?79:73,color:'#e2bf83'});
   else shot(g,e,'bellWave',e.x+dir*24,e.y-(i===1||i===4?88:10),dir*225,0,a.damage,e.pealInterval<.85?330:285,{radius:8});
  });
 }
};
function finish(e){if(e.phase===2&&e.pattern==='gateRush'&&e.hp<e.maxHp*.28&&!e.wallStun)e.followup='gateBlade';if(e.phase===2&&e.pattern==='chainCast')e.followup='anvilStrike';if(e.phase===2&&e.pattern==='bookMaze')e.followup='recordBlades';if(e.phase===2&&e.pattern==='voiceStairs')e.followup='choirShards';if(e.phase===2&&e.pattern==='anchorThrow')e.followup='lighthouseAim';if(e.phase===2&&e.pattern==='royalFirst'&&e.attackIndex%2===0)e.followup='dawnThrust';e.state='recover';e.t=0;e.vx=0;e.shielding=false;e.poseRow=null;e.poseCol=null;}
export function beginNativeBoss(g,e,pattern){const a=BOSS_ACTIONS[pattern];if(!a)return false;const d=BOSS_DEFS[e.id];e.native=true;e.wallStun=false;e.pattern=pattern;e.state='windup';e.t=0;e.vx=0;e.dir=Math.sign(g.p.x-e.x)||e.dir;e.aim={x:clamp(g.p.x,d.left+70,d.right-70),y:g.p.y-25};e.events=new Set();e.hitBeats=new Set();e.beat=0;e.attackSerial=(e.attackSerial||0)+1;e.counterAt=undefined;e.shielding=!!a.guard&&e.phase===1;e.poseRow=null;e.poseCol=null;e.history??=[];e.history.push(pattern);e.history=e.history.slice(-4);e.attackIndex++;if(pattern==='invertedPage')e.destination={x:g.p.x<(d.left+d.right)/2?d.right-170:d.left+170,y:170};if(pattern==='seventhPeal'){e.moveTo={x:(d.left+d.right)/2,y:302};e.pealInterval=e.phase===2&&e.hp<e.maxHp*.27?.78:.85;}g.sound('parry');return true;}

export function updateNativeBoss(g,e,dt){
 if(e.pattern&&!BOSS_ACTIONS[e.pattern])return false;
 const d=BOSS_DEFS[e.id],p=g.p,m=BOSS_MOTION[e.id];e.hit=Math.max(0,e.hit-dt);e.teleportFade=Math.max(0,(e.teleportFade||0)-dt);if(e.steel)e.steel.life-=dt;
 if(e.dead){e.deathT+=dt;return true;}
 if(!g.bossActive){if(p.x>d.left+65&&p.x<d.right-25&&p.y<350){g.bossActive=true;g.projectiles=[];g.event('bossIntro',{id:e.id,text:d.intro});g.sound('bell');}else return true;}
 g.arenaPlatforms??=[];g.arenaObstacles??=[];g.arenaClones??=[];g.combatFields??=[];e.pending??=[];e.aim??={x:p.x,y:p.y-24};e.events??=new Set();e.hitBeats??=new Set();
 for(const pending of e.pending.filter(q=>q.at<=g.clock))pending.fn();e.pending=e.pending.filter(q=>q.at>g.clock);
 e.cooldown-=dt;e.t+=dt;e.stagger=Math.max(0,e.stagger-dt);
 if(e.state==='weakened'){e.grace=Math.max(0,(e.grace||0)-dt);e.vx=0;e.y=302;return true;}
 if(e.phase===1&&e.hp<e.maxHp*.52&&['idle','recover'].includes(e.state)){
  e.phase=2;e.state='transition';e.t=0;e.vx=0;e.shielding=false;e.pending=[];g.projectiles=[];g.combatFields=[];e.poseRow=null;e.poseCol=null;
  if(e.id==='edran')e.shieldDiscarded=true;g.tell(d.phaseText||({edran:'에드란이 금 간 방패를 내려놓았다.',marie:'목에 달린 종이 멎었다. 마리에가 숨을 들이켰다.',brag:'화로의 불이 망치 속으로 흘러들었다.'}[e.id]));g.sound('bell');
 }
 if(e.state==='transition'){if(e.t>=1.6){e.state='idle';e.t=0;e.cooldown=.75;}return true;}
 if(e.wasHot&&e.overheatUntil<=g.clock){e.wasHot=false;e.stagger=1.3;finish(e);e.exhaustedUntil=g.clock+1.5;}
 if(e.stagger>.12){e.vx=0;return true;}
 const oldX=e.x,oldVX=e.vx;e.vx=0;if(e.vault){const v=e.vault;v.t+=dt;const f=Math.min(1,v.t/1.1),horizontal=clamp((f-.25)/.5,0,1);e.x=v.from+(v.to-v.from)*horizontal;e.y=302-Math.sin(f*Math.PI)*165;e.walk+=Math.abs(e.x-oldX);advanceCreatureGait(e,dt,e.x-oldX,m.stride);if(f>=1){e.y=302;e.vault=null;}return true;}
 if(e.moveTo){e.x=toward(e.x,e.moveTo.x,140*dt);e.y=toward(e.y,e.moveTo.y,120*dt);if(Math.abs(e.x-e.moveTo.x)<2&&Math.abs(e.y-e.moveTo.y)<2)e.moveTo=null;}
 if(e.elevatedUntil>g.clock)e.y=toward(e.y,e.elevation||170,95*dt);else if(!e.moveTo)e.y=toward(e.y,302,110*dt);
 if(e.state==='idle'){
  const distance=p.x-e.x,preferred=['marie','leonel'].includes(e.id)?170:e.id==='brag'?115:m.stop;e.dir=Math.sign(distance)||e.dir;
  if(!e.anchorOut&&!e.moveTo){if(Math.abs(distance)>preferred)e.vx=e.dir*m.speed*(e.id==='arkein'&&e.phase===2?1.2:1);else if(['marie','leonel'].includes(e.id)&&Math.abs(distance)<110)e.vx=-e.dir*m.speed*.7;}
  if(e.cooldown<=0&&Math.abs(distance)<(e.id==='edran'?430:720)&&(!e.exhaustedUntil||e.exhaustedUntil<=g.clock)){const next=e.followup||selectBossAction(g,e);e.followup=null;beginNativeBoss(g,e,next);}
 }else if(e.state==='windup'){
  const a=BOSS_ACTIONS[e.pattern];e.shielding=!!a.guard&&!(e.id==='edran'&&e.phase===2);
  if(e.t>=a.windup){e.state='attack';e.t=0;e.events=new Set();e.hitBeats=new Set();}
 }else if(e.state==='attack'){
  const a=BOSS_ACTIONS[e.pattern];CONTROLLERS[e.id](g,e,a);if(e.state==='attack'&&e.t>=a.active&&!(e.pattern==='royalGuard'&&e.counterAt>e.t))finish(e);
 }else if(e.state==='recover'){
  const a=BOSS_ACTIONS[e.pattern];if(e.t>.4&&!e.anchorOut&&Math.abs(p.x-e.x)>m.stop)e.vx=Math.sign(p.x-e.x)*m.speed*.6;
  if(e.t>=(a?.recover||1.5)){if(e.id==='neris'&&e.phase===2&&e.attackIndex%5===0&&e.resetIndex!==e.attackIndex){g.combatFields=g.combatFields.filter(f=>f.owner!==e.id);e.resetIndex=e.attackIndex;g.sound('bell');g.tell('등대의 불이 다시 켜졌다.');}e.state='idle';e.t=0;e.cooldown=e.id==='arkein'&&e.phase===2?.45:.65;e.poseRow=null;e.poseCol=null;}
 }
 if(e.state==='idle'||e.state==='recover'&&e.t>.4)e.vx=toward(oldVX,e.vx,m.speed*6*dt);else if(e.state==='windup')e.vx=0;
 const proposed=clamp(e.x+e.vx*dt,d.left+75,d.right-70),blocking=solids(g).some(q=>!q.oneway&&q.y<e.y-5&&q.y+q.h>e.y-e.h&&proposed+e.w/2>q.x&&proposed-e.w/2<q.x+q.w);
 const floorAhead=['marie','leonel'].includes(e.id)||e.y<290||solids(g).some(q=>q.x<=proposed-e.w/2&&q.x+q.w>=proposed+e.w/2&&Math.abs(q.y-e.y)<8);if(!blocking&&floorAhead)e.x=proposed;else if(blocking&&e.id==='neris'&&['idle','recover'].includes(e.state)&&Math.abs(p.x-e.x)>120){const cover=(g.world.routeWalls||[]).find(w=>w.owner==='neris');if(cover)e.vault={from:e.x,to:e.x<cover.x?cover.x+cover.w+e.w:cover.x-e.w,t:0};}else if(e.pattern==='gateRush'&&e.state==='attack'){e.wallStun=true;finish(e);e.followup=null;e.stagger=1.8;}
 e.walk+=Math.abs(e.x-oldX);advanceCreatureGait(e,dt,e.x-oldX,m.stride);if(Math.abs(e.x-oldX)<1e-6)e.vx=0;
 return true;
}

export function nativeBossDamage(g,e,n){
 if(!BOSS_ACTIONS[e.pattern])return n;
 const front=(g.p.x-e.x)*e.dir>0;
 if(e.id==='edran'&&e.phase===1&&e.shielding&&front){e.guardHits=(e.guardHits||0)+1;if(e.guardHits%3===0)e.queuedRiposte=true;g.fx(e.x+e.dir*21,e.y-42,'parry',.22);return Math.max(1,Math.round(n*.22));}
 if(e.id==='arkein'&&e.pattern==='royalGuard'&&e.state==='attack'&&front&&e.shielding){if(e.counterAt===undefined)e.counterAt=e.t+.6;g.fx(e.x+e.dir*18,e.y-40,'parry',.25);return Math.max(1,Math.round(n*.15));}
 return n;
}
