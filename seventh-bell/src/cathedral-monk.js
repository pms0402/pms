import {nativeEnemyPose,SPECIES} from './enemy-species.js';
import {inCathedralBay} from './cathedral-presentation.js';
import {CATHEDRAL_MONK_RIG as RIG} from './cathedral-monk-rig.js';
// Interrupted recoveries hold the ready grip instead of replaying a follow-
// through from an attack which never happened. This is not AI or saved state.
const interrupted=new WeakMap();
export function cathedralMonkPose(e){if(e.type!=='monk'||!inCathedralBay(e.x,e.y))return null;const old=nativeEnemyPose(e);
 if(e.dead)return{...old,size:102,root:64,foot:[114,115,115,114,113,117][old.col]};
 if(e.state==='windup'||e.state==='attack')interrupted.delete(e);if(e.stagger>0||e.hit>0)interrupted.set(e,true);
 if(e.stagger>0||e.state==='recover'&&interrupted.has(e))return{sheet:'cathedral-monk',row:0,col:5,size:RIG.size,root:RIG.roots[0][5],foot:RIG.feet[0][5]};
 let row,col;if(e.state==='windup'){const prep=e.prep||SPECIES.monk.windup,settle=Math.min(.16,prep*.2);if(e.t<settle){row=0;col=Math.min(5,Math.floor(e.t/settle*6));}else{row=1;col=Math.min(5,Math.floor((e.t-settle)/(prep-settle)*6));}}
 else if(e.state==='attack'){row=2;col=Math.min(5,Math.floor(e.t/.25*6));}
 else if(e.state==='recover'){row=3;col=Math.min(5,Math.floor(e.t/.85*6));}
 else return old;
 return{sheet:'cathedral-monk',row,col,size:RIG.size,root:RIG.roots[row][col],foot:RIG.feet[row][col]};
}
