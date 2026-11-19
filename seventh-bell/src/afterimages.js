import {registeredPose,worldBlade} from './blade.js';

export const ECHO_LIFE=.14;
// Join recorded blade poses around the wrist rather than cutting straight
// across the swing with one large triangle. This is only the fading ribbon;
// attack timing and collision continue to use the original animation frames.
export function ribbonEdges(a,b){
 const dx=b.ax-a.ax,dy=b.ay-a.ay,al=Math.hypot(a.bx-a.ax,a.by-a.ay),bl=Math.hypot(b.bx-b.ax,b.by-b.ay);
 const angle=Math.atan2(a.by-a.ay,a.bx-a.ax),end=Math.atan2(b.by-b.ay,b.bx-b.ax);
 const turn=Math.atan2(Math.sin(end-angle),Math.cos(end-angle));
 if(Math.abs(turn)<1e-6&&Math.hypot(dx,dy)<.1&&Math.abs(al-bl)<.1)return null;
 const steps=Math.min(64,Math.max(2,Math.ceil(Math.abs(turn)/(Math.PI/72)),Math.ceil(Math.hypot(dx,dy)/2)));
 const outer=[],inner=[];
 for(let i=0;i<=steps;i++){
  const f=i/steps,x=a.ax+dx*f,y=a.ay+dy*f,len=al+(bl-al)*f,t=angle+turn*f,vx=Math.cos(t)*len,vy=Math.sin(t)*len;
  outer.push({x:x+vx,y:y+vy});
  inner.push({x:x+vx*.28,y:y+vy*.28});
 }
 return{outer,inner};
}
export function ageAfterimages(g){g.bladeEchoes=g.bladeEchoes.filter(e=>g.clock-e.time<ECHO_LIFE);}
export function captureAfterimage(g,a){if(!['light1','light2','light3','heavy','thrust','upper','counter','plunge'].includes(a.kind)||a.t<a.spec.windup||a.kind!=='plunge'&&a.t>=a.spec.end)return;const pose=registeredPose(g.p,g.clock),blade=worldBlade(g.p,pose);if(!pose||!blade)return;const last=g.bladeEchoes.at(-1);if(last?.swing===a.serial&&g.clock-last.time<1/120-1e-6)return;g.bladeEchoes.push({time:g.clock,swing:a.serial,kind:a.kind,x:g.p.x,y:g.p.y,dir:g.p.dir,pose:{...pose,hand:pose.hand?[...pose.hand]:undefined,blade:pose.blade?[...pose.blade]:undefined},blade:{...blade}});if(g.bladeEchoes.length>24)g.bladeEchoes.splice(0,g.bladeEchoes.length-24);}
