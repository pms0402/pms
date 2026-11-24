import {MINIBOSSES} from '../src/miniboss-data.js';
export function minibossInputs(g,e,stats){const p=g.p,d=MINIBOSSES[e.type],a=d.attacks[Math.max(0,e.attackIndex)],dx=e.x-p.x,dist=Math.abs(dx),can=!p.action||g.canRecover();let move=dist>Math.max(40,e.w*.45+15),direction=Math.sign(dx),jump=false;
 const impact=a.kind==='slam'?a.active*.52:.08,beats=a.kind==='double'?[.08,a.active*.57]:[impact],t=e.state==='windup'?e.t-e.prep:e.state==='attack'?e.t:-99,until=beats.find(at=>at>t+.001)-t;
 if(until>0&&until<.13&&dist<a.reach+45&&Math.abs(p.y-e.y)<70&&can){if(g.parry())stats.parries++;move=false;}
 const vulnerable=e.state==='recover'||e.state==='idle'||e.stagger>.1;
 if(vulnerable&&p.hp<g.maxHp*.57&&g.profile.flasks&&p.grounded&&dist>75&&(!p.action||p.action.kind==='heal')){move=false;if(!p.action&&Math.abs(p.vx)<12)g.heal();}
 else if(vulnerable&&dist<Math.max(58,e.w*.45+30)&&Math.abs(p.y-e.y)<60){move=false;if(p.stamina>18)g.press(e.stagger>.5&&p.stamina>35?'heavy':'attack');}
 if(e.state==='windup'||e.state==='attack'){move=false;if(a.kind==='cast'&&p.grounded&&can&&e.t>.1)jump=true;}
 for(const q of g.projectiles){if(q.friendly)continue;const tx=q.vx?(p.x-q.x)/q.vx:10;if(tx>0&&tx<.24&&Math.abs(q.y+q.vy*tx-(p.y-24))<28&&can){if(tx<.11&&p.dir===-Math.sign(q.vx)){if(g.parry())stats.parries++;}else if(p.grounded)jump=true;}}
 if(p.y>e.y+20&&can&&(p.grounded||p.vy>-30&&p.jumps<2))jump=true;
 if(jump)g.press('jump');if(p.action?.kind==='heal')move=false;
 return{left:move&&direction<0,right:move&&direction>0,jump};
}
