import {HERO_RIG} from './hero-rig.js';

export const MOVE={speed:178,acceleration:360,braking:600,turning:900,start:.22,settle:.28,walkStride:72,runStride:104};
const approach=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);
export const newGait=()=>({phase:0,cycles:0,state:'idle',time:0,style:'walk',turnSpeed:0});
export function groundVelocity(v,intent,dt){return approach(v,intent*MOVE.speed,(intent?(v*intent<0?MOVE.turning:MOVE.acceleration):MOVE.braking)*dt);}

// Integrate foot phase from the distance actually travelled after collision.
// A new speed or sprite sheet never divides the accumulated distance again.
export function updateGait(p,dx,dt,intent){
 const g=p.gait??=newGait(),speed=Math.abs(p.vx),moving=speed>.25&&Math.abs(dx)>.00001;
 if(!p.grounded||p.action||p.hurt>0||p.dead){g.state='idle';g.time=0;return;}
 const oldPhase=g.phase;
 if(moving&&g.state!=='start'){
  const stride=g.style==='run'?MOVE.runStride:MOVE.walkStride;
  const phase=g.phase+Math.abs(dx)/stride;g.cycles+=Math.floor(phase);g.phase=phase%1;
 }
 const contact=g.phase<oldPhase||oldPhase<.5&&g.phase>=.5;
 if(contact){if(g.style==='walk'&&speed>=128)g.style='run';else if(g.style==='run'&&speed<100)g.style='walk';}
 if(intent&&p.vx*intent< -8){
  if(g.state!=='turn'){g.turnSpeed=speed;g.time=0;}g.state='turn';g.time+=dt;return;
 }
 if(intent&&moving){
  if(g.state==='idle'){g.state=speed>80?'stride':'start';g.time=0;g.style='walk';}
  else if(g.state==='stop'||g.state==='turn'){if(g.state==='turn')g.style='walk';g.state='stride';g.time=0;}
  if(g.state==='start'){g.time+=dt;if(g.time>=MOVE.start){g.state='stride';g.phase=0;}}
  return;
 }
 if(moving&&speed>90){g.state='stride';return;}
 if(g.state!=='idle'&&g.state!=='stop'){g.state='stop';g.time=0;}
 if(g.state==='stop'){g.time+=dt;if(g.time>=MOVE.settle&&!moving){g.state='idle';g.time=0;g.style='walk';}}
}

const WALK_HANDS=[[57,72],[56,72],[56,71],[58,71],[65,72],[72,71],[77,64],[78,62],[81,55],[59,67],[60,69],[60,72],[57,73],[57,73],[59,73],[61,73],[66,72],[72,71],[78,64],[80,61],[82,55],[60,67],[59,70],[59,72]];
const RUN_HANDS=[[52,75],[54,75],[57,75],[58,74],[59,75],[60,75],[58,66],[60,64],[61,65],[60,67],[60,69],[61,70],[55,76],[55,76],[56,76],[58,75],[63,73],[64,73],[59,65],[60,65],[61,65],[60,67],[61,69],[61,70]];
const TRANSITION_HANDS=[[62,74],[62,74],[61,74],[60,74],[59,73],[58,73],[59,72],[58,72],[58,72],[59,72],[59,73],[59,73],[60,73],[60,73],[60,73],[60,73],[61,73],[62,73],[63,73],[64,73],[64,73],[64,73],[64,73],[64,73]];
// The source run cells drift sideways by up to eight source pixels. Register
// their head/torso column once, so wrapping the sheet cannot yank the body back.
const RUN_ROOTS=[70,71,73,73,76,78,74,75,75,73,76,77,72,71,74,74,76,78,77,77,76,77,77,76];
export function locomotionPose(p){
 if(!p.grounded||p.action||p.hurt>0||p.dead||p.land>0)return null;
 const g=p.gait||{state:Math.abs(p.vx)>12?'stride':'idle',phase:((p.walk||0)/MOVE.walkStride)%1,cycles:0,style:Math.abs(p.vx)>140?'run':'walk'};
 if(g.state==='idle')return null;
 let sheet,frame,size,hand;
 if(['start','stop','turn'].includes(g.state)){
  sheet='gait-transitions';size=HERO_RIG.gaitTransitions.size;
  frame=g.state==='start'?Math.min(7,Math.floor(g.time/MOVE.start*8)):g.state==='turn'?12+Math.min(8,Math.floor((1-Math.abs(p.vx)/Math.max(1,g.turnSpeed))*9)):12+Math.min(11,Math.floor(g.time/MOVE.settle*12));
  hand=TRANSITION_HANDS[frame];
 }else{
  const run=g.style==='run';sheet=run?'gait-run':'gait-walk';size=HERO_RIG[run?'gaitRun':'gaitWalk'].size;
  frame=run?Math.min(23,Math.floor(g.phase*24)):(g.cycles%2)*12+Math.min(11,Math.floor(g.phase*12));hand=(run?RUN_HANDS:WALK_HANDS)[frame];
 }
 return{sheet,frame,col:frame%6,row:Math.floor(frame/6),size,root:sheet==='gait-run'?RUN_ROOTS[frame]:70,foot:sheet==='gait-transitions'?123:125,hand,angle:24,steel:true,gait:true};
}
