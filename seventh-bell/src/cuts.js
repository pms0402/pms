// Each melee clip has 24 actual body drawings in a 6 x 4 atlas. These are
// sprite frames, not trail samples or repeated copies of the old eight poses.
export const STEEL={length:30,guard:.185,grip:.095,axis:.5};
export const CUT_FRAMES=24;
export const CUT_CLIPS=['light1','light2','light3','heavy','air'];
const HANDS={
 light1:[[83,70],[77,76],[63,55],[53,43],[62,33],[66,24],[65,34],[59,46],[82,76],[94,91],[101,101],[100,112],[100,102],[100,95],[91,88],[87,77],[86,75],[86,78],[78,77],[75,76],[75,77],[77,76],[73,77],[72,77]],
 light2:[[70,62],[69,71],[63,76],[52,79],[50,85],[53,81],[50,69],[59,64],[71,62],[88,54],[98,36],[105,22],[107,11],[92,15],[101,24],[105,39],[104,53],[101,70],[94,78],[86,77],[83,74],[87,70],[86,67],[86,66]],
 light3:[[83,73],[78,74],[59,69],[53,52],[58,26],[68,22],[70,19],[76,32],[75,48],[90,79],[108,95],[108,101],[103,110],[100,109],[92,104],[88,95],[85,88],[85,85],[85,83],[81,76],[79,77],[78,75],[79,77],[75,79]],
 heavy:[[92,79],[90,83],[97,58],[104,41],[90,19],[66,13],[59,10],[69,13],[83,23],[111,65],[116,90],[102,107],[94,109],[80,107],[75,106],[74,99],[80,88],[80,81],[83,77],[84,74],[82,69],[79,67],[81,69],[81,71]],
 air:[[66,89],[61,67],[69,44],[64,28],[65,13],[70,14],[75,18],[62,34],[71,70],[79,83],[99,101],[116,108],[115,101],[111,94],[106,87],[89,75],[83,70],[75,65],[76,77],[78,74],[73,74],[74,75],[74,73],[78,76]]
};
const FEET={
 light1:[124.0,124.0,124.0,124.0,124.0,124.0,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.0,124.5,124.5,124.0,124.0,124.0],
 light2:[122.5,123.0,123.0,123.0,123.0,123.0,123.0,123.0,123.0,123.0,123.0,123.0,123.5,123.5,123.5,123.5,123.5,123.5,122.5,122.5,122.5,122.5,122.5,122.5],
 light3:[124.0,124.0,124.0,124.0,124.0,124.0,123.5,123.5,124.0,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5],
 heavy:[122.5,122.5,122.5,122.5,122.5,122.5,122.0,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,123.0,123.0,123.0,123.0,123.0,123.0],
 air:[121,121,121,124.0,124.5,125.0,124.5,123.0,124.5,124.5,125.5,126.0,126.0,126.0,122.0,121,121,121,121,121,121,121,121,121]
};
const ROOTS={
 light1:[68.8,67.8,66.8,66.5,65.0,65.5,66.8,65.2,62.2,60.8,59.5,59.2,60.0,60.8,61.2,62.8,63.0,63.8,66.2,68.8,69.0,68.5,69.2,69.0],
 light2:[67.8,68.0,68.2,68.5,69.2,66.8,65.5,70.5,69.2,69.0,68.8,69.0,69.5,70.2,69.8,70.5,69.8,70.5,67.5,67.2,68.2,69.8,69.0,70.0],
 light3:[68.5,68.2,69.0,69.2,69.8,70.0,69.5,67.8,64.8,64.2,62.2,61.2,59.8,58.0,58.2,59.2,62.0,64.5,64.8,66.5,65.5,69.8,71.5,71.5],
 heavy:[73.8,74.2,73.2,72.5,72.5,73.0,73.2,71.5,67.2,62.0,61.0,60.0,60.5,60.8,61.2,60.8,61.5,63.0,64.0,67.8,69.5,71.2,73.0,72.8],
 air:[75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75,75]
};
const ANGLES={
 light1:[35,15,-20,-50,-95,-125,-125,-115,-100,-75,-45,-20,0,20,36,50,60,66,62,54,45,40,37,35],
 light2:[35,45,65,85,110,125,68,58,45,30,12,-5,-22,-40,-58,-72,-85,-98,-80,-55,-25,0,20,35],
 light3:[35,10,-30,-65,-100,-125,-135,-120,-100,-75,-45,-15,10,30,48,60,68,75,68,55,45,40,37,35],
 heavy:[35,0,-40,-80,-100,-120,-130,-115,-95,-70,-45,-20,0,22,40,55,65,75,68,55,45,40,37,35],
 air:[35,0,-35,-65,-100,-120,-125,-110,-90,-65,-40,-15,5,25,42,55,65,72,65,52,43,38,36,35]
};
export function cutStage(a,queued=false){const s=a.spec,t=a.t,end=queued&&s.chainAt?s.chainAt:s.duration;if(t<s.windup)return Math.min(5,Math.floor(t/s.windup*6));if(t<s.end)return 6+Math.min(11,Math.floor((t-s.windup)/(s.end-s.windup)*12));return 18+Math.min(5,Math.floor((t-s.end)/(end-s.end)*6));}
export function cutAngle(a,queued=false){return ANGLES[a.air?'air':a.kind][cutStage(a,queued)];}
export function cutPose(p,clock=0){const a=p.action;
 if(!a){if(p.grounded&&Math.abs(p.vx)<12&&!p.brake&&!p.land&&!p.hurt&&!p.dead){const col=Math.floor(clock*5)%8;return{sheet:'cut-body',row:3,col,size:74,root:[79.5,79.5,79.5,79.5,79.5,78.5,78.5,79][col],foot:[121,121,121,122,122,122,121,121][col],hand:[[68,80],[68,80],[69,80],[68,80],[68,80],[67,80],[67,80],[68,80]][col],angle:35,steel:true};}return null;}
 if(!['light1','light2','light3','heavy'].includes(a.kind))return null;
 const clip=a.air||!p.grounded?'air':a.kind,frame=cutStage(a,p.comboQueued),foot=FEET[clip][frame],hand=HANDS[clip][frame];
 let angle=ANGLES[clip][frame];
 // A low follow-through turns the wrist outward instead of burying the long
 // blade in the floor. Rendering and collision both use this registered angle.
 if(p.grounded&&angle>0){const reach=STEEL.length+(STEEL.guard-STEEL.grip)*STEEL.length/(1-STEEL.guard),clearance=(foot-hand[1])*74/128-1.5;const limit=Math.asin(Math.max(0,Math.min(1,clearance/reach)))*180/Math.PI;if(Math.sin(angle*Math.PI/180)>Math.sin(limit*Math.PI/180))angle=Math.cos(angle*Math.PI/180)<0?180-limit:limit;}
 return{sheet:'cut-'+clip,clip,frame,col:frame%6,row:Math.floor(frame/6),size:74,root:ROOTS[clip][frame],foot,hand,angle,steel:true};
}
export function steelRig(p,pose){const s=pose.size/128,theta=pose.angle*Math.PI/180,c=Math.cos(theta)*p.dir,d=Math.sin(theta),width=STEEL.length/(1-STEEL.guard),offset=(STEEL.guard-STEEL.grip)*width,handX=p.x+(pose.hand[0]-pose.root)*s*p.dir,handY=p.y+(pose.hand[1]-pose.foot)*s;return{handX,handY,angle:pose.angle,width,ax:handX+c*offset,ay:handY+d*offset,bx:handX+c*(offset+STEEL.length),by:handY+d*(offset+STEEL.length)};}
