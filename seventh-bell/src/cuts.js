// Each melee clip has 24 actual body drawings in a 6 x 4 atlas. These are
// sprite frames, not trail samples or repeated copies of the old eight poses.
export const STEEL={length:48,guard:.185,grip:.095,axis:.5};
export const CUT_FRAMES=24;
export const CUT_CLIPS=['light1','light2','light3','heavy','air','plunge','thrust'];
const HANDS={"light1":[[80,68],[38,30],[45,15],[47,14],[102,67],[102,98],[99,96],[100,94],[99,89],[93,85],[86,78],[87,73],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,69]],"light2":[[81,80],[80,85],[75,87],[75,89],[95,58],[107,23],[99,15],[101,24],[103,35],[101,49],[96,58],[93,66],[87,67],[86,68],[86,69],[86,70],[86,70],[86,71],[85,73],[85,73],[85,73],[85,73],[85,73],[85,73]],"light3":[[80,75],[84,53],[85,36],[66,16],[101,64],[113,89],[97,98],[97,91],[94,83],[90,78],[89,71],[87,68],[86,67],[86,67],[86,67],[86,67],[86,67],[86,67],[86,68],[86,68],[86,68],[86,68],[86,68],[86,68]],"heavy":[[87,77],[85,53],[82,36],[72,13],[102,38],[111,97],[96,103],[95,91],[92,83],[90,79],[87,74],[87,69],[84,69],[85,69],[85,69],[85,69],[85,69],[85,69],[85,70],[85,70],[85,70],[85,70],[85,70],[85,70]],"air":[[79,80],[84,49],[78,30],[65,9],[104,66],[112,91],[96,98],[96,90],[94,83],[91,79],[90,75],[88,71],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70],[86,70]],"plunge":[[88,68],[84,44],[86,38],[80,47],[79,73],[88,110],[79,98],[77,86],[80,77],[83,70],[85,68],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67],[85,67]],"thrust":[[81,68],[63,66],[52,65],[47,65],[101,52],[116,51],[119,49],[120,49],[120,50],[117,53],[111,56],[104,57],[98,59],[95,61],[88,64],[88,65],[88,65],[88,66],[87,65],[87,65],[87,65],[87,65],[87,65],[87,65]]};
const FEET={"light1":[124.5,124.5,125.0,125.0,125.0,125.0,125.5,125.5,125.0,125.0,125.0,125.0,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5],"light2":[122.5,122.5,122.5,122.5,122.5,122.5,122.0,122.5,122.5,122.5,122.0,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5,122.5],"light3":[124.0,124.0,124.0,124.0,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,123.5,123.5,123.5,124.0,124.0,123.5,124.0,124.0,124.0,124.0,124.0,124.0],"heavy":[124.0,124.0,124.5,124.0,124.5,124.0,124.0,124.0,124.0,124.0,124.0,124.0,123.5,124.0,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5,123.5],"air":[125.5,124.5,125.0,126.0,125.0,123.5,122.0,122.5,124.5,125.0,125.0,125.0,123.0,122.5,122.5,122.0,123.5,123.5,122.5,123.5,122.5,123.5,123.5,123.5],"plunge":[120.5,112.0,120.0,123.5,128.0,128.0,123.5,123.5,123.5,123.5,123.5,123.5,122.5,122.5,122.5,122.5,122.5,122.5,123.0,123.0,123.0,123.0,123.0,123.0],"thrust":[124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5,124.5]};
const ROOTS={"light1":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"light2":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"light3":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"heavy":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"air":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70],"plunge":[74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74,74],"thrust":[70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70,70]};
const ANGLES={"light1":[20,-70,-120,-130,-60,30,30,30,30,30,30,28,26,24,22,20,20,20,20,20,20,20,20,20],"light2":[20,25,20,15,35,-110,-110,-110,-110,-110,-105,-95,-80,-60,-40,-20,0,15,20,20,20,20,20,20],"light3":[20,-30,-90,-130,-70,35,35,35,35,35,35,32,29,26,23,20,20,20,20,20,20,20,20,20],"heavy":[20,-30,-90,-135,-75,40,40,40,40,40,40,36,32,28,24,20,20,20,20,20,20,20,20,20],"air":[20,-30,-90,-130,-65,65,65,65,65,65,60,55,50,45,40,35,30,25,20,20,20,20,20,20],"plunge":[35,70,90,90,90,90,70,60,50,45,42,40,38,36,35,35,35,35,35,35,35,35,35,35],"thrust":[0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]};
// Four short anticipation drawings, two contact drawings, eighteen recovery
// drawings. Cancels can intentionally interrupt recovery; there is no 3D yaw.
export function cutStage(a){
 const s=a.spec,t=a.t;
 if(a.kind==='charge')return Math.min(3,Math.floor(t/.3*4));
 if(a.kind==='plunge'&&a.landed)return 5+Math.min(18,Math.floor((a.recoveryT||0)/.36*19));
 if(a.kind==='plunge')return t<s.windup?Math.min(3,Math.floor(t/s.windup*4)):4;
 if(t<s.windup)return Math.min(3,Math.floor(t/s.windup*4));
 if(t<s.end)return 4+Math.min(1,Math.floor((t-s.windup)/(s.end-s.windup)*2));
 return 6+Math.min(17,Math.floor((t-s.end)/(s.duration-s.end)*18));
}
const CLIP={charge:'heavy',thrust:'thrust',upper:'light2',counter:'light1',plunge:'plunge'};
export function cutAngle(a){return ANGLES[CLIP[a.kind]||(a.air?'air':a.kind)][cutStage(a)];}
export function cutPose(p,clock=0){const a=p.action;
 if(!a){if(p.grounded&&Math.abs(p.vx)<12&&!p.brake&&!p.land&&!p.hurt&&!p.dead){const col=Math.floor(clock*5)%8;return{sheet:'cut-body',row:3,col,size:74,root:[79.5,79.5,79.5,79.5,79.5,78.5,78.5,79][col],foot:[121,121,121,122,122,122,121,121][col],hand:[[68,80],[68,80],[69,80],[68,80],[68,80],[67,80],[67,80],[68,80]][col],angle:20,steel:true};}return null;}
 if(!['light1','light3','heavy',...Object.keys(CLIP)].includes(a.kind))return null;
 const clip=CLIP[a.kind]||((a.air||!p.grounded)?'air':a.kind),frame=cutStage(a),foot=FEET[clip][frame],hand=HANDS[clip][frame];
 let angle=ANGLES[clip][frame];
 if(a.kind==='thrust')angle=frame<17?0:(frame-16)*20/7;
 // The held counter has the same side-view cut, driven further along the floor.
 // Grounded low grips turn the wrist rather than burying steel in the floor.
 if(p.grounded&&angle>0){const reach=STEEL.length+(STEEL.guard-STEEL.grip)*STEEL.length/(1-STEEL.guard),clearance=(foot-hand[1])*74/128-1.5,limit=Math.asin(Math.max(0,Math.min(1,clearance/reach)))*180/Math.PI;if(Math.sin(angle*Math.PI/180)>Math.sin(limit*Math.PI/180))angle=Math.cos(angle*Math.PI/180)<0?180-limit:limit;}
 return{sheet:'cut-'+clip,clip,frame,col:frame%6,row:Math.floor(frame/6),size:74,root:ROOTS[clip][frame],foot,hand,angle,steel:true,bladeBehind:a.kind==='thrust'&&frame<4};
}
export function steelRig(p,pose){const s=pose.size/128,theta=pose.angle*Math.PI/180,c=Math.cos(theta)*p.dir,d=Math.sin(theta),width=STEEL.length/(1-STEEL.guard),offset=(STEEL.guard-STEEL.grip)*width,handX=p.x+(pose.hand[0]-pose.root)*s*p.dir,handY=p.y+(pose.hand[1]-pose.foot)*s;return{handX,handY,angle:pose.angle,width,ax:handX+c*offset,ay:handY+d*offset,bx:handX+c*(offset+STEEL.length),by:handY+d*(offset+STEEL.length)};}
