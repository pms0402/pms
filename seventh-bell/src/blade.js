import {locomotionPose} from './locomotion.js';
import {HERO_RIG,HERO_FEET} from './hero-rig.js';
import {cutPose,steelRig} from './cuts.js';
// Coordinates are traced on the displayed 128px animation cells, guard -> tip.
// Rendering and collision use this registration, including mirroring and the feet.
export const BLADE_ROWS={light1:0,light2:1,light3:2,heavy:3};
const READY=[75,94,104,119];
const BLADES=[
 [READY,[55,93,83,117],[36,67,62,18],[84,55,116,14],[93,64,126,55],[90,99,126,120],[70,99,118,111],READY],
 [READY,[60,96,88,118],[39,101,14,116],[82,87,113,72],[82,69,114,41],[85,44,124,20],[73,73,94,49],READY],
 [READY,[58,96,29,117],[36,92,13,87],[85,87,124,94],[84,80,126,80],[88,80,126,80],[82,89,126,93],READY],
 [READY,[63,64,98,29],[53,20,32,7],[80,47,47,14],[75,89,113,112],[71,104,111,125],[78,94,122,99],READY]
];
const AIR=[READY,[45,74,8,99],[39,31,90,5],[75,53,106,75],[78,61,124,61],[75,87,108,115],[72,95,120,109],READY];
export function attackFrame(s,t){if(t<s.windup)return Math.min(2,Math.floor(t/s.windup*3));if(t<s.end)return 3+Math.min(2,Math.floor((t-s.windup)/(s.end-s.windup)*3));return 6+Math.min(1,Math.floor((t-s.end)/(s.duration-s.end)*2));}
export function registeredPose(p,clock=0){const gait=locomotionPose(p);if(gait)return gait;const cut=cutPose(p,clock);if(cut)return cut;const a=p.action;if(a?.spec){const col=attackFrame(a.spec,a.t),kind=a.kind,rig=HERO_RIG[kind],air=(a.air??!p.grounded)&&kind!=='heal'&&kind!=='skill';return {sheet:air?'motion-extras':kind==='heal'||kind==='skill'?'motion-extras':'swordplay',row:air?0:kind==='heal'?2:kind==='skill'?3:BLADE_ROWS[kind],col,size:rig?.size||HERO_RIG.air.size,root:62,foot:rig?HERO_FEET[kind][col]:126,blade:air?AIR[col]:BLADES[BLADE_ROWS[kind]]?.[col]};}if(p.brake>0&&p.grounded&&!p.hurt&&!p.dead)return{sheet:'motion-extras',row:1,col:Math.min(3,Math.floor(p.brake*10)),size:HERO_RIG.brake.size,root:62,foot:HERO_FEET.brake[Math.min(3,Math.floor(p.brake*10))]};return null;}
export function worldBlade(p,pose=registeredPose(p)){if(pose?.steel){const {ax,ay,bx,by}=steelRig(p,pose);return{ax,ay,bx,by,floor:p.grounded?p.y-1.5:null};}if(!pose?.blade)return null;const [ax,ay,bx,by]=pose.blade,s=pose.size/128,dir=p.dir;return {ax:p.x+(ax-pose.root)*s*dir,ay:p.y+(ay-pose.foot)*s,bx:p.x+(bx-pose.root)*s*dir,by:p.y+(by-pose.foot)*s};}
// Liang–Barsky segment/box intersection, with a 2px steel edge allowance.
export function bladeTouches(b,r,radius=2){if(!b)return false;let lo=0,hi=1;const dx=b.bx-b.ax,dy=b.by-b.ay;for(const [p,q]of[[-dx,b.ax-r.x+radius],[dx,r.x+r.w+radius-b.ax],[-dy,b.ay-r.y+radius],[dy,r.y+r.h+radius-b.ay]]){if(Math.abs(p)<1e-9){if(q<0)return false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}return true;}
// Sweep a rigid blade around its moving wrist. Linear interpolation of the tip
// shortened steel into a chord and missed the outside of large cuts. The same
// samples now drive collision and the visible crescent, with no range disk.
export function sweptBlades(previous,current){
 if(!current)return[];if(!previous)return[current];
 const dx=current.ax-previous.ax,dy=current.ay-previous.ay,l0=Math.hypot(previous.bx-previous.ax,previous.by-previous.ay),l1=Math.hypot(current.bx-current.ax,current.by-current.ay);
 const start=Math.atan2(previous.by-previous.ay,previous.bx-previous.ax),end=Math.atan2(current.by-current.ay,current.bx-current.ax),turn=Math.atan2(Math.sin(end-start),Math.cos(end-start));
 const n=Math.max(1,Math.ceil((Math.hypot(dx,dy)+Math.abs(turn)*Math.max(l0,l1))/2),Math.ceil(Math.abs(turn)/(Math.PI/72)));
 return Array.from({length:n+1},(_,i)=>{const f=i/n,ax=previous.ax+dx*f,ay=previous.ay+dy*f,len=l0+(l1-l0)*f;let angle=start+turn*f;
  if(Number.isFinite(current.floor)&&Math.sin(angle)*len>current.floor-ay){const limit=Math.asin(Math.max(0,Math.min(1,(current.floor-ay)/len)));angle=Math.cos(angle)<0?Math.PI-limit:limit;}
  return{ax,ay,bx:ax+Math.cos(angle)*len,by:ay+Math.sin(angle)*len,floor:current.floor};
 });
}
// Load the rear leg, then drive the hips forward through the active cut.
// These are actual collision-tested steps; the sprite is never teleported.
export const ROOT_DRIVE={light1:{back:3,forward:9},light3:{back:4,forward:16},heavy:{back:4,forward:14},thrust:{back:4,forward:46},upper:{back:2,forward:8},counter:{back:2,forward:62}};
export function rootStep(a,t){const r=a&&ROOT_DRIVE[a.kind];if(!r||t<=0)return 0;const s=a.spec;if(t<s.windup){const f=Math.max(0,t/s.windup);return-r.back*f*f;}const f=Math.max(0,Math.min(1,(t-s.windup)/(s.end-s.windup)));return-r.back+(r.forward+r.back)*f*f*(3-2*f);}
