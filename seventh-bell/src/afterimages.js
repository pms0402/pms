import {registeredPose,worldBlade,sweptBlades} from './blade.js';

export const ECHO_LIFE=.14;
// The crescent follows the same rigid rotating steel as the hit samples.
// It fades after contact and cannot deal damage again.
export function ribbonEdges(a,b){
 const turn=Math.atan2(Math.sin(Math.atan2(b.by-b.ay,b.bx-b.ax)-Math.atan2(a.by-a.ay,a.bx-a.ax)),Math.cos(Math.atan2(b.by-b.ay,b.bx-b.ax)-Math.atan2(a.by-a.ay,a.bx-a.ax)));
 if(Math.abs(turn)<1e-6&&Math.hypot(b.ax-a.ax,b.ay-a.ay)<.1)return null;
 const paths=sweptBlades(a,b),outer=paths.map(p=>({x:p.bx,y:p.by})),inner=paths.map(p=>({x:p.ax+(p.bx-p.ax)*.28,y:p.ay+(p.by-p.ay)*.28}));
 return{outer,inner};
}
const MELEE=['light1','light3','heavy','thrust','upper','counter','plunge'];
function sample(g,pose,blade){return{time:g.clock,swing:g.p.action.serial,kind:g.p.action.kind,x:g.p.x,y:g.p.y,dir:g.p.dir,pose:{...pose,hand:pose.hand?[...pose.hand]:undefined,blade:pose.blade?[...pose.blade]:undefined},blade:{...blade}};}
// Keep the loaded pose privately. It appears in the crescent only once the
// cut starts; anticipation itself still causes no damage and shows no arc.
export function rememberSwing(g,a){if(!MELEE.includes(a.kind))return;const pose=registeredPose(g.p,g.clock),blade=worldBlade(g.p,pose);if(!blade)return;a.prepared=sample(g,pose,blade);a.previousBlade={...blade};}
export function ageAfterimages(g){g.bladeEchoes=g.bladeEchoes.filter(e=>g.clock-e.time<ECHO_LIFE);}
export function captureAfterimage(g,a){
 if(!MELEE.includes(a.kind)||a.t<a.spec.windup||a.kind!=='plunge'&&a.t>=a.spec.end)return;
 const pose=registeredPose(g.p,g.clock),blade=worldBlade(g.p,pose);if(!pose||!blade)return;
 if(!a.echoStarted){a.echoStarted=true;if(a.prepared)g.bladeEchoes.push({...a.prepared,time:g.clock-1/120});}
 const last=g.bladeEchoes.at(-1);if(last?.swing===a.serial&&g.clock-last.time<1/120-1e-6)return;
 g.bladeEchoes.push(sample(g,pose,blade));if(g.bladeEchoes.length>24)g.bladeEchoes.splice(0,g.bladeEchoes.length-24);
}
