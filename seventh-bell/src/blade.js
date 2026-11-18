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
export function registeredPose(p,clock=0){const cut=cutPose(p,clock);if(cut)return cut;const a=p.action;if(a?.spec){const col=attackFrame(a.spec,a.t),kind=a.kind,air=(a.air??!p.grounded)&&kind!=='heal'&&kind!=='skill';return {sheet:air?'motion-extras':kind==='heal'||kind==='skill'?'motion-extras':'swordplay',row:air?0:kind==='heal'?2:kind==='skill'?3:BLADE_ROWS[kind],col,size:80,root:62,foot:126,blade:air?AIR[col]:BLADES[BLADE_ROWS[kind]]?.[col]};}if(p.brake>0&&p.grounded&&!p.hurt&&!p.dead)return{sheet:'motion-extras',row:1,col:Math.min(3,Math.floor(p.brake*10)),size:80,root:62,foot:126};return null;}
export function worldBlade(p,pose=registeredPose(p)){if(pose?.steel){const {ax,ay,bx,by}=steelRig(p,pose);return{ax,ay,bx,by};}if(!pose?.blade)return null;const [ax,ay,bx,by]=pose.blade,s=pose.size/128,dir=p.dir;return {ax:p.x+(ax-pose.root)*s*dir,ay:p.y+(ay-pose.foot)*s,bx:p.x+(bx-pose.root)*s*dir,by:p.y+(by-pose.foot)*s};}
// Liang–Barsky segment/box intersection, with a 2px steel edge allowance.
export function bladeTouches(b,r,radius=2){if(!b)return false;let lo=0,hi=1;const dx=b.bx-b.ax,dy=b.by-b.ay;for(const [p,q]of[[-dx,b.ax-r.x+radius],[dx,r.x+r.w+radius-b.ax],[-dy,b.ay-r.y+radius],[dy,r.y+r.h+radius-b.ay]]){if(Math.abs(p)<1e-9){if(q<0)return false;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return false;}return true;}
export function sweptBlades(previous,current){if(!current)return[];if(!previous)return[current];const n=Math.max(1,Math.ceil(Math.max(Math.hypot(current.ax-previous.ax,current.ay-previous.ay),Math.hypot(current.bx-previous.bx,current.by-previous.by))/3));return Array.from({length:n+1},(_,i)=>Object.fromEntries(['ax','ay','bx','by'].map(k=>[k,previous[k]+(current[k]-previous[k])*i/n])));}
export const rootStep=(a,t)=>!a||a.kind==='skill'||a.kind==='heal'?0:({light1:5,light2:7,light3:11,heavy:9}[a.kind]||0)*Math.max(0,Math.min(1,(t-a.spec.windup)/(a.spec.end-a.spec.windup)));
