import {HERO_RIG,HERO_FEET} from './hero-rig.js';
// Each melee clip has 24 actual body drawings in a 6 x 4 atlas. These are
// sprite frames, not trail samples or repeated copies of the old eight poses.
export const STEEL={length:48,guard:.185,grip:.095,axis:.5};
export const CUT_FRAMES=24;
export const CUT_CLIPS=['light1','light2','light3','heavy','air','plunge','thrust'];
const HANDS={"light1":[[82,70],[87,59],[87,47],[90,38],[92,27],[90,18],[57,14],[66,23],[69,28],[78,40],[87,56],[88,70],[87,72],[87,77],[91,84],[93,90],[97,96],[100,99],[98,98],[92,88],[90,81],[92,73],[88,67],[88,64]],"light2":[[81,80],[80,85],[75,87],[75,89],[95,58],[107,23],[99,15],[101,24],[103,35],[101,49],[96,58],[93,66],[87,67],[86,68],[86,69],[86,70],[86,70],[86,71],[85,73],[85,73],[85,73],[85,73],[85,73],[85,73]],"light3":[[96,91],[92,80],[90,62],[91,46],[90,34],[87,14],[57,14],[65,21],[68,27],[78,39],[87,59],[93,76],[92,83],[92,84],[95,91],[97,100],[100,104],[102,105],[101,102],[96,93],[92,81],[90,72],[89,64],[89,61]],"heavy":[[83,70],[87,60],[86,46],[90,37],[91,28],[89,17],[57,14],[66,22],[69,27],[78,39],[86,56],[88,70],[88,73],[88,77],[92,85],[93,91],[97,98],[99,100],[98,98],[93,90],[91,82],[91,73],[88,67],[88,64]],"air":[[82,69],[86,59],[87,48],[90,38],[91,28],[90,17],[57,13],[66,21],[68,27],[78,39],[87,56],[89,71],[88,74],[89,78],[93,86],[95,92],[98,98],[100,101],[99,99],[94,91],[91,82],[91,73],[89,67],[89,64]],"plunge":[[88,68],[84,44],[86,38],[80,47],[79,73],[88,110],[79,98],[77,86],[80,77],[83,70],[85,68],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67]],"thrust":[[81,68],[63,66],[52,65],[47,65],[101,52],[116,51],[119,49],[120,49],[120,50],[117,53],[111,56],[104,57],[98,59],[95,61],[88,64],[88,65],[88,65],[88,66],[87,65],[87,65],[87,65],[87,65],[87,65],[87,65]]};
const FEET=HERO_FEET;
const ROOTS={"light1":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"light2":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"light3":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"heavy":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"air":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"plunge":[74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74],"thrust":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70]};
const ANGLES={"light1":[20,-5,-35,-65,-100,-125,-135,-120,-100,-80,-55,-25,0,20,35,40,40,40,38,34,30,26,23,20],"light2":[20,25,20,15,35,-110,-110,-110,-110,-110,-105,-95,-80,-60,-40,-20,0,15,20,20,20,20,20,20],"light3":[32,15,-20,-55,-95,-130,-135,-120,-100,-80,-55,-25,0,20,35,40,40,40,38,34,30,26,23,20],"heavy":[20,-5,-35,-65,-100,-135,-145,-120,-100,-80,-55,-25,0,20,35,40,40,40,38,34,30,26,23,20],"air":[20,-5,-35,-65,-100,-125,-135,-120,-100,-80,-55,-25,0,20,35,40,40,40,38,34,30,26,23,20],"plunge":[35,70,90,90,90,90,70,60,50,45,42,40,38,36,35,35,35,35,35,35,35,35,35,35],"thrust":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
// Body drawings are timed by technique. Broad cuts have ten actual in-between
// drawings during the swing; slowing two impact pictures would still snap.
const CLIP={charge:'heavy',thrust:'thrust',upper:'light2',counter:'light1',plunge:'plunge'};
export const CUT_PHASES={light1:[6,10,8],light3:[6,10,8],heavy:[6,10,8],air:[6,10,8],light2:[4,2,18],thrust:[4,2,18],plunge:[4,2,18]};
export function cutFrameTime(clip,spec,frame){const [prep,swing,recover]=CUT_PHASES[clip];return frame<prep?spec.windup*(frame+.5)/prep:frame<prep+swing?spec.windup+(spec.end-spec.windup)*(frame-prep+.5)/swing:spec.end+(spec.duration-spec.end)*(frame-prep-swing+.5)/recover;}
export function cutStage(a){
 const s=a.spec,t=a.t,clip=CLIP[a.kind]||(a.air?'air':a.kind),[prep,swing,recover]=CUT_PHASES[clip];
 if(a.kind==='charge')return Math.min(prep-1,Math.floor(t/.3*prep));
 if(a.kind==='plunge'&&a.landed)return 5+Math.min(18,Math.floor((a.recoveryT||0)/.36*19));
 if(a.kind==='plunge')return t<s.windup?Math.min(3,Math.floor(t/s.windup*4)):4;
 if(t<s.windup)return Math.min(prep-1,Math.floor(t/s.windup*prep));
 if(t<s.end)return prep+Math.min(swing-1,Math.floor((t-s.windup)/(s.end-s.windup)*swing));
 return prep+swing+Math.min(recover-1,Math.floor((t-s.end)/(s.duration-s.end)*recover));
}
export function cutAngle(a){return ANGLES[CLIP[a.kind]||(a.air?'air':a.kind)][cutStage(a)];}
export function cutPose(p,clock=0){const a=p.action;
 if(!a){if(p.grounded&&Math.abs(p.vx)<12&&!p.brake&&!p.land&&!p.hurt&&!p.dead){const col=Math.floor(clock*5)%8;return{sheet:'cut-body',row:3,col,size:HERO_RIG.idle.size,root:[79.5,79.5,79.5,79.5,79.5,78.5,78.5,79][col],foot:HERO_FEET.idle[col],hand:[[68,80],[68,80],[69,80],[68,80],[68,80],[67,80],[67,80],[68,80]][col],angle:20,steel:true};}return null;}
 if(!['light1','light3','heavy',...Object.keys(CLIP)].includes(a.kind))return null;
 const clip=CLIP[a.kind]||((a.air||!p.grounded)?'air':a.kind),frame=cutStage(a),foot=FEET[clip][frame],hand=HANDS[clip][frame],size=HERO_RIG[clip].size;
 let angle=ANGLES[clip][frame];
 if(a.kind==='thrust')angle=frame<17?0:(frame-16)*20/7;
 // The held counter has the same side-view cut, driven further along the floor.
 // Grounded low grips turn the wrist rather than burying steel in the floor.
 if(p.grounded&&angle>0){const reach=STEEL.length+(STEEL.guard-STEEL.grip)*STEEL.length/(1-STEEL.guard),clearance=(foot-hand[1])*size/128-1.5,limit=Math.asin(Math.max(0,Math.min(1,clearance/reach)))*180/Math.PI;if(Math.sin(angle*Math.PI/180)>Math.sin(limit*Math.PI/180))angle=Math.cos(angle*Math.PI/180)<0?180-limit:limit;}
 return{sheet:'cut-'+clip,clip,frame,col:frame%6,row:Math.floor(frame/6),size,root:ROOTS[clip][frame],foot,hand,angle,steel:true,bladeBehind:a.kind==='thrust'&&frame<4};
}
export function steelRig(p,pose){const s=pose.size/128,theta=pose.angle*Math.PI/180,c=Math.cos(theta)*p.dir,d=Math.sin(theta),width=STEEL.length/(1-STEEL.guard),offset=(STEEL.guard-STEEL.grip)*width,handX=p.x+(pose.hand[0]-pose.root)*s*p.dir,handY=p.y+(pose.hand[1]-pose.foot)*s;return{handX,handY,angle:pose.angle,width,ax:handX+c*offset,ay:handY+d*offset,bx:handX+c*(offset+STEEL.length),by:handY+d*(offset+STEEL.length)};}
