import {body,overlaps} from './world.js';
export const makeTrap=(id,type,x,y=302,chapter=1,offset=0)=>({id,type,x,y,chapter,offset,lastCycle:-1});
export function trapPose(t,clock){const time=clock+t.offset;if(t.type==='spikes'){const f=((time%3.5)+3.5)%3.5;return{frame:f<1.2?0:f<2.1?1:f<2.3?2:f<2.95?3:2,active:f>=2.3&&f<2.95,x:t.x,y:t.y,w:80,h:30,warning:f>=1.2&&f<2.3};}
 if(t.type==='pendulum'){const a=Math.sin(time*1.45)*.84;return {x:t.x+Math.sin(a)*168,y:t.y-204+Math.cos(a)*168,pivotX:t.x,pivotY:t.y-204,w:36,h:40,active:true};}
 if(t.type==='crusher'){const f=((time%4)+4)%4,drop=f<1.5?0:f<1.8?(f-1.5)/.3:f<2.3?1:f<3?(3-f)/.7:0;return{x:t.x,y:t.y-195+drop*160,w:56,h:70,active:f>=1.5&&f<2.3,warning:f>=.5&&f<1.5,chain:true};}
 const cycle=Math.floor(time/3),f=((time%3)+3)%3;return{x:t.x,y:t.y-30,w:40,h:38,warning:f>.8&&f<1.65,fire:f>=1.65&&f<1.8,cycle,active:false};}
export function updateTraps(g,dt){for(const t of g.world.traps){if(Math.abs(t.x-g.p.x)>850)continue;const p=trapPose(t,g.clock);if(t.type==='emitter'&&p.fire&&t.lastCycle!==p.cycle){t.lastCycle=p.cycle;g.spawnShot(t.x-20,t.y-28,-230,0,24+t.chapter*2,t.id,'bolt',340);g.sound('swing');}
 if(!p.active)continue;const box=t.type==='spikes'?{x:p.x-40,y:p.y-30,w:80,h:30}:{x:p.x-p.w/2,y:p.y-p.h/2,w:p.w,h:p.h};if(overlaps(box,body(g.p)))g.hurt((t.type==='crusher'?32:22)+t.chapter*3,{x:p.x,stagger:0,state:'idle',unblockable:true});}}
