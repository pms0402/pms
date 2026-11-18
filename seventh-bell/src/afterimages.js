import {registeredPose,worldBlade} from './blade.js';

export const ECHO_LIFE=.14;
export function ageAfterimages(g){g.bladeEchoes=g.bladeEchoes.filter(e=>g.clock-e.time<ECHO_LIFE);}
export function captureAfterimage(g,a){if(!['light1','light2','light3','heavy'].includes(a.kind)||a.t<a.spec.windup||a.t>=a.spec.end)return;const pose=registeredPose(g.p,g.clock),blade=worldBlade(g.p,pose);if(!pose||!blade)return;const last=g.bladeEchoes.at(-1);if(last?.swing===a.serial&&g.clock-last.time<1/120-1e-6)return;g.bladeEchoes.push({time:g.clock,swing:a.serial,kind:a.kind,x:g.p.x,y:g.p.y,dir:g.p.dir,pose:{...pose,hand:pose.hand?[...pose.hand]:undefined,blade:pose.blade?[...pose.blade]:undefined},blade:{...blade}});if(g.bladeEchoes.length>24)g.bladeEchoes.splice(0,g.bladeEchoes.length-24);}
