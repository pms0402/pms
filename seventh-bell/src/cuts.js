// Fist and boot registration on the body-only atlas (128px cells).
// The rigid steel sprite, its collision segment and its trail share this rig.
export const STEEL={length:30,guard:.185,grip:.095,axis:.5};
export const CUT_ROWS={light1:0,light2:1,light3:2};
const ROOTS=[[79.5,79.5,80.5,78.5,77.5,77,77.5,79],[79,78.5,78.5,78,78.5,78.5,78.5,79],[79.5,78.5,78.5,78,78,78,77.5,79.5],[79.5,79.5,79.5,79.5,79.5,78.5,78.5,79]];
const FEET=[[121,121,122,121,121,121,121,121],[121,121,121,121,121,121,121,121],[122,122,122,122,122,122,122,122],[121,121,121,122,122,122,121,121]];
const HANDS=[
 [[68,80],[64,32],[69,22],[101,34],[112,60],[100,79],[98,84],[68,80]],
 [[68,80],[60,80],[60,81],[94,77],[100,55],[108,34],[110,29],[100,60]],
 [[92,58],[64,37],[64,33],[101,48],[112,74],[108,90],[78,79],[69,80]],
 [[68,80],[68,80],[69,80],[68,80],[68,80],[67,80],[67,80],[68,80]]
];
const ANGLES={light1:{start:35,back:-130,ready:-105,end:35},light2:{start:35,back:145,ready:40,end:-100},light3:{start:-100,back:-150,ready:-100,end:25}};
const mix=(a,b,f)=>a+(b-a)*f;
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function framePose(row,col,angle){return{sheet:'cut-body',row,col,size:74,root:ROOTS[row][col],foot:FEET[row][col],hand:HANDS[row][col],angle,steel:true};}
export function cutAngle(a){const k=ANGLES[a.kind],s=a.spec,t=a.t;if(t<s.windup){const f=t/s.windup;return f<.5?mix(a.fromAngle??k.start,k.back,smooth(f*2)):mix(k.back,k.ready,smooth((f-.5)*2));}if(t<s.end)return mix(k.ready,k.end,smooth((t-s.windup)/(s.end-s.windup)));return mix(k.end,35,smooth((t-s.end)/(s.duration-s.end)));}
export function cutPose(p,clock=0){const a=p.action;if(!a){if(p.grounded&&Math.abs(p.vx)<12&&!p.brake&&!p.land&&!p.hurt&&!p.dead)return framePose(3,Math.floor(clock*5)%8,35);return null;}
 if(!Object.hasOwn(CUT_ROWS,a.kind)||a.air||!p.grounded)return null;const s=a.spec,t=a.t,row=CUT_ROWS[a.kind],angle=cutAngle(a);let col=t<s.windup?Math.min(2,Math.floor(t/s.windup*3)):t<s.end?3+Math.min(2,Math.floor((t-s.windup)/(s.end-s.windup)*3)):6+Math.min(1,Math.floor((t-s.end)/(s.duration-s.end)*2));
 if(a.fromPose&&t<s.windup/3)return{...a.fromPose,angle};
 // Single swings settle into the same ready artwork used when standing still.
 if(col===7&&!p.comboQueued)return framePose(3,0,angle);return framePose(row,col,angle);}
export function steelRig(p,pose){const s=pose.size/128,theta=pose.angle*Math.PI/180,c=Math.cos(theta)*p.dir,d=Math.sin(theta),width=STEEL.length/(1-STEEL.guard),offset=(STEEL.guard-STEEL.grip)*width,handX=p.x+(pose.hand[0]-pose.root)*s*p.dir,handY=p.y+(pose.hand[1]-pose.foot)*s;return{handX,handY,angle:pose.angle,width,ax:handX+c*offset,ay:handY+d*offset,bx:handX+c*(offset+STEEL.length),by:handY+d*(offset+STEEL.length)};}
