// Each melee clip has 24 actual body drawings in a 6 x 4 atlas. These are
// sprite frames, not trail samples or repeated copies of the old eight poses.
export const STEEL={length:30,guard:.185,grip:.095,axis:.5};
export const CUT_FRAMES=24;
export const CUT_CLIPS=['light1','light2','light3','heavy','air'];
const HANDS={
 light1:[[61,80],[65,74],[76,60],[74,52],[72,42],[57,17],[57,16],[61,18],[71,20],[86,41],[92,53],[94,68],[93,76],[87,80],[85,85],[85,97],[89,101],[95,110],[89,111],[87,95],[75,86],[62,88],[63,88],[62,89]],
 light2:[[61,78],[65,72],[76,57],[76,49],[75,40],[57,16],[58,17],[62,18],[72,21],[87,42],[95,57],[98,73],[96,83],[89,84],[86,84],[88,97],[91,104],[96,108],[93,106],[87,95],[75,84],[64,86],[64,86],[64,86]],
 light3:[[61,78],[74,75],[77,55],[83,45],[81,36],[58,10],[58,13],[64,14],[72,17],[87,37],[94,48],[99,62],[96,69],[90,78],[88,83],[90,94],[90,102],[98,109],[94,102],[86,86],[76,80],[70,80],[70,79],[70,78]],
 heavy:[[64,75],[74,67],[79,51],[82,43],[85,33],[76,13],[77,9],[81,15],[90,43],[102,49],[103,66],[100,83],[97,99],[90,105],[93,112],[95,115],[98,109],[99,106],[96,104],[87,95],[78,80],[73,75],[62,85],[64,85]],
 air:[[70,68],[64,52],[74,45],[79,42],[75,33],[61,10],[67,11],[67,18],[82,44],[94,54],[95,78],[94,93],[86,94],[87,96],[90,106],[92,108],[88,99],[85,85],[82,78],[82,75],[71,61],[72,61],[73,66],[74,69]]
};
const FEET={
 light1:[121,121,121,121,121,121,121,121,121,121,121,121,121,121,121,121,121,121,121.5,121.5,121.5,121.5,121.5,121.5],
 light2:[121,121,121,120.5,120.5,120.5,120.5,120.5,120.5,120.5,120.5,120.5,120.5,120.5,121,121,121,121,121,121,121,121,121,121],
 light3:[121.5,121.5,121.5,121.5,121.5,121.5,121,121,121,121,121,121,121,121.5,121.5,121.5,121.5,121.5,122,122,122,122,122,122],
 heavy:[122.5,122.5,122.5,122.5,122.5,122.5,122,122,122,122,122,122,122,122,122,122,122,122,122,122,122.5,122.5,122.5,123]
};
const ANGLES=[35,20,-10,-35,-65,-100,-105,-90,-65,-35,-15,0,12,25,38,50,60,70,68,60,48,40,37,35];
export function cutStage(a,queued=false){const s=a.spec,t=a.t,end=queued&&s.chainAt?s.chainAt:s.duration;if(t<s.windup)return Math.min(5,Math.floor(t/s.windup*6));if(t<s.end)return 6+Math.min(11,Math.floor((t-s.windup)/(s.end-s.windup)*12));return 18+Math.min(5,Math.floor((t-s.end)/(end-s.end)*6));}
export function cutAngle(a,queued=false){return ANGLES[cutStage(a,queued)];}
export function cutPose(p,clock=0){const a=p.action;
 if(!a){if(p.grounded&&Math.abs(p.vx)<12&&!p.brake&&!p.land&&!p.hurt&&!p.dead){const col=Math.floor(clock*5)%8;return{sheet:'cut-body',row:3,col,size:74,root:[79.5,79.5,79.5,79.5,79.5,78.5,78.5,79][col],foot:[121,121,121,122,122,122,121,121][col],hand:[[68,80],[68,80],[69,80],[68,80],[68,80],[67,80],[67,80],[68,80]][col],angle:35,steel:true};}return null;}
 if(!['light1','light2','light3','heavy'].includes(a.kind))return null;
 const clip=a.air||!p.grounded?'air':a.kind,frame=cutStage(a,p.comboQueued),foot=clip==='air'?121:FEET[clip][frame],hand=HANDS[clip][frame];
 let angle=ANGLES[frame];
 // A low follow-through turns the wrist outward instead of burying the long
 // blade in the floor. Rendering and collision both use this registered angle.
 if(p.grounded&&angle>0){const reach=STEEL.length+(STEEL.guard-STEEL.grip)*STEEL.length/(1-STEEL.guard),clearance=(foot-hand[1])*74/128-1.5;angle=Math.min(angle,Math.asin(Math.max(0,Math.min(1,clearance/reach)))*180/Math.PI);}
 return{sheet:'cut-'+clip,clip,frame,col:frame%6,row:Math.floor(frame/6),size:74,root:75,foot,hand,angle,steel:true};
}
export function steelRig(p,pose){const s=pose.size/128,theta=pose.angle*Math.PI/180,c=Math.cos(theta)*p.dir,d=Math.sin(theta),width=STEEL.length/(1-STEEL.guard),offset=(STEEL.guard-STEEL.grip)*width,handX=p.x+(pose.hand[0]-pose.root)*s*p.dir,handY=p.y+(pose.hand[1]-pose.foot)*s;return{handX,handY,angle:pose.angle,width,ax:handX+c*offset,ay:handY+d*offset,bx:handX+c*(offset+STEEL.length),by:handY+d*(offset+STEEL.length)};}
