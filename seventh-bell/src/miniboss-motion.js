import {attackSeconds} from './boss-tempo.js';
import {MINIBOSSES} from './miniboss-data.js';
import {MINIBOSS_RIG} from './miniboss-registration.js';
export function minibossPose(e){const d=MINIBOSSES[e.type],rig=MINIBOSS_RIG[e.type]||{},a=d.attacks[Math.max(0,e.attackIndex)];let row=0,col=0;
 if(e.dead){row=8;col=Math.min(5,Math.floor(e.deathT*7));}
 else if(e.stagger>0){row=7;col=Math.min(2,Math.max(0,Math.floor((1.35-e.stagger)*3)));}
 else if(e.state==='windup'){row=4+e.attackIndex;col=Math.min(2,Math.floor(e.t/e.prep*3));}
 else if(e.state==='attack'){row=4+e.attackIndex;col=e.t<a.active*.5?3:4;}
 else if(e.state==='recover'&&e.t<attackSeconds(.3)){row=4+Math.max(0,e.attackIndex);col=e.t<attackSeconds(.07)?(e.endCol??4):5;}
 else if(Math.abs(e.vx)>1||e.gaitSettling){const n=Math.floor((e.gaitPhase||0)*24)%24;row=Math.floor(n/6);col=n%6;}
 else{row=7;col=3+Math.floor(e.t*1.8)%3;}
 return{sheet:'mini-'+e.type,row,col,size:rig.size||128,root:rig.root||64,foot:rig.feet?.[row]?.[col]??118};
}
