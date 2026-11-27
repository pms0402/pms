import {attackSeconds} from './boss-tempo.js';
import {REGISTERED_RIG,REGISTERED_FEET} from './boss-registration.js';
import {BOSS_ACTIONS} from './boss-actions.js';
import {PATTERNS} from './bosses.js';
import {creatureGaitPose} from './creature-motion.js';

// Native attacks retain their dedicated preparation/strike/recovery rows.
// Locomotion uses registered 24-drawing cycles from creature-motion.js.
export const BOSS_MOTION={
 edran:{speed:43,stop:92,stride:54,rows:{sweep:1,slam:2,lunge:3,double:4},second:{double:1},parry:5},
 marie:{speed:37,stop:94,stride:46,rows:{thrust:1,choir:2,tide:3,knell:4},second:{},parry:5},
 brag:{speed:40,stop:94,stride:52,rows:{hammer:1,forgeSweep:2,charge:3,furnace:4,forgeDouble:5},second:{forgeDouble:2}},
 leonel:{speed:42,stop:92,stride:50,rows:{quill:1,folio:2,redaction:3,footnote:4,finalLine:5},second:{finalLine:1}},
 neris:{speed:45,stop:94,stride:52,rows:{hookCut:1,anchorFall:2,harpoonRush:3,lanternCall:4,twinHook:5},second:{twinHook:1}},
 carillon:{speed:38,stop:100,stride:60,rows:{chimeSweep:1,pendulumFall:2,frameRush:3,hollowChorus:4,brokenCadence:5},second:{brokenCadence:1}},
 arkein:{speed:46,stop:92,stride:56,rows:{royalCut:1,royalFall:2,royalMarch:3,royalDawn:4,royalTwice:5},second:{royalTwice:1}}
};
// Fixed neutral-body scale matches the previously published boss height.
export const BOSS_RIG={"edran":{"size":243,"foot":184,"rows":[243,240,240,240,243,245]},"marie":{"size":187,"foot":172,"rows":[187,187,187,189,190,190]},"brag":{"size":215,"foot":174,"rows":[215,224,224,224,224,222]},"leonel":{"size":239,"foot":166,"rows":[239,234,239,234,241,241]},"arkein":{"size":194,"foot":178,"rows":[194,198,194,198,198,203]}};
// Fixed scale per sequence; sole anchors on the actual 192px cells.
const BOSS_FEET={"edran":[[184,184,184,184,184,183],[185,185,185,185,185,185],[184,185,185,185,185,185],[184,184,184,184,184,184],[184,184,184,184,184,184],[184,184,184,184,184,184]],"marie":[[172,171,173,173,173,172],[169,169,169,169,169,169],[170,170,169,170,171,170],[169,169,169,168,164,169],[170,169,170,170,170,170],[171,171,171,170,170,171]],"brag":[[174,174,174,174,174,174],[172,172,172,173,173,173],[167,167,167,167,167,167],[166,166,166,165,165,166],[166,166,166,166,166,166],[168,168,167,167,167,168]],"leonel":[[166,166,165,166,165,165],[165,165,164,165,164,165],[164,164,163,163,162,162],[163,163,163,163,163,163],[160,153,150,150,150,158],[158,158,158,158,158,158]],"arkein":[[178,177,178,177,176,177],[177,178,178,178,178,178],[177,177,177,177,177,177],[177,177,177,177,177,177],[177,177,177,177,177,177],[175,174,174,174,174,175]]};
Object.assign(BOSS_RIG,{"neris":{"size":220,"foot":166,"rows":[220,225,228,228,228,228]},"carillon":{"size":276,"foot":167,"rows":[276,280,280,287,276,280]}});
Object.assign(BOSS_FEET,{"neris":[[166,167,166,166,166,166],[164,164,163,164,164,164],[164,164,165,165,165,164],[163,160,161,162,162,162],[164,162,162,163,162,164],[163,162,161,162,162,162]],"carillon":[[167,167,168,168,168,167],[167,167,167,167,168,168],[167,168,168,170,172,167],[165,164,164,165,164,165],[168,167,167,168,168,168],[167,167,167,167,167,167]]});
for(const r of Object.values(BOSS_RIG))r.rows=Array(9).fill(r.size);
Object.assign(BOSS_RIG,REGISTERED_RIG);Object.assign(BOSS_FEET,REGISTERED_FEET);
for(const[id,m]of Object.entries(BOSS_MOTION))for(const[key,a]of Object.entries(BOSS_ACTIONS))if(a.owner===id)m.rows[key]=a.row;
export const BOSS_RECOVER_STEP=.32;
const groundImpacts=new Set(['slam','hammer','royalFall','tide','footnote','anchorFall','pendulumFall'].map(k=>PATTERNS[k]));
export function bossWindup(e){return e.second?(PATTERNS[e.pattern]?.secondWindup||.85):PATTERNS[e.pattern]?.windup||1;}
export function bossImpactAt(pattern){const a=typeof pattern==='string'?PATTERNS[pattern]:pattern;return a?a.active*(groundImpacts.has(a)?.5:.18):0;}
export function bossRecovery(e){const a=PATTERNS[e.pattern];return a?.twice&&!e.second?.5:a?.recover||1;}
export function bossAttackRow(e){const m=BOSS_MOTION[e.id];return(e.second?m?.second[e.pattern]:null)??m?.rows[e.pattern]??1;}
export function bossPose(e){
 const native=e.boss&&nativeBossPose(e,BOSS_RIG[e.id],BOSS_FEET[e.id]);if(native)return native;
 if(!e.boss||e.dead||['weakened','transition'].includes(e.state))return null;
 const motion=BOSS_MOTION[e.id],rig=BOSS_RIG[e.id];if(!motion)return null;
 let row=0,col=0,role='guard';
 if(e.stagger>.12){row=motion.parry??0;col=motion.parry===undefined?0:Math.min(5,Math.floor((1.35-Math.min(1.35,e.stagger))/1.35*6));role='parry';}
 else if(e.state==='windup'){row=bossAttackRow(e);const f=e.t/bossWindup(e);col=f<.22?0:f<.58?1:2;role='prepare';}
 else if(e.state==='attack'){row=bossAttackRow(e);col=e.t<PATTERNS[e.pattern].active*.5?3:4;role='strike';}
 else if(e.state==='recover'&&e.t<BOSS_RECOVER_STEP){row=bossAttackRow(e);col=e.t<.10?4:5;role='recover';}
 else if(Math.abs(e.vx)>1){col=Math.floor((e.walk||0)/motion.stride*6)%6;role='walk';}
 if(role==='walk')return creatureGaitPose(e,e.id+'-gait',0,motion.stride,rig.size);
 return{sheet:e.id+'-motion',row,col,role,size:rig.rows[row],root:96,foot:BOSS_FEET[e.id][row][col]};
}

export function nativeBossPose(e,rig,feet){
 const a=BOSS_ACTIONS[e.pattern];if(!e.native&&!a||e.pattern&&!a)return null;
 let row=e.phase===2?6:0,col=0,role='guard';
 if(e.dead){row=8;col=Math.min(5,4+Math.floor(e.deathT*2));role='death';}
 else if(e.state==='freed'){row=8;col=3;role='freed';}
 else if(e.state==='weakened'){row=8;col=2;role='weakened';}
 else if(e.state==='transition'){row=8;col=1;role='transition';}
 else if(e.stagger>.12){row=8;col=0;role='parry';}
 else if(e.state==='windup'){row=a.row;col=e.t/a.windup<.25?0:e.t/a.windup<.62?1:2;role='prepare';}
 else if(e.state==='attack'){row=e.poseRow??a.row;col=e.poseCol??(e.t<a.active*.5?3:4);role='strike';}
 else if(e.state==='recover'&&e.t<attackSeconds(.4)){row=e.endRow??a?.row??0;col=e.t<attackSeconds(.07)?(e.endCol??4):5;role='recover';}
 else if(Math.abs(e.vx)>1||e.gaitSettling){role='walk';return creatureGaitPose(e,e.id+'-gait',e.phase===2&&['edran','arkein'].includes(e.id)?4:0,BOSS_MOTION[e.id].stride,rig.size);}
 let sheet=e.id+'-motion';
 if(e.phase===2&&['edran','arkein'].includes(e.id)&&!e.dead&&!['weakened','transition','freed'].includes(e.state)){
  sheet=e.id==='edran'?'edran-unshielded':'arkein-uncloaked';
  if(e.stagger>.12){row=e.id==='edran'?5:3;col=2;}
  else if(row===6)row=0;
  else if(e.id==='edran')row=({1:1,2:1,3:2,4:3,5:5,7:4})[row]??0;
  else if(row===7)row=4;
  rig=REGISTERED_RIG[sheet]||rig;feet=REGISTERED_FEET[sheet]||feet;
 }
 return{sheet,row,col,role,size:rig.size,root:96,foot:feet?.[row]?.[col]??rig.foot};
}
