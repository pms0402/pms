import {BOSS_DEFS} from './bosses.js';
import {SPECIES} from './enemy-species.js';
import {journeyAt,JOURNEYS} from './journey-data.js';
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export const entityBox=e=>({x:e.x-e.w/2,y:e.y-e.h,w:e.w,h:e.h});
export function buildSanctuaries(w,checkpoints){
 w.sanctuaries=[{id:'arrival',x:0,y:65,w:560,h:440,floor:302},...checkpoints.map(c=>({id:c.id,x:c.x-250,y:c.y-200,w:450,h:400,floor:c.y})),...Object.entries(BOSS_DEFS).map(([id,b])=>({id:'prepare-'+id,x:b.left-190,y:102,w:250,h:400,floor:302}))];
 for(const j of JOURNEYS){for(const[x,y,id]of[[j.west,302,'west'],[j.east+50,302,'east'],[j.start+100,302,'entry'],[j.end-100,j.kind==='cliff'?478:302,'exit']])w.sanctuaries.push({id:j.id+'-'+id,x:x-160,y:y-180,w:320,h:360,floor:y});}
 w.traps=w.traps.filter(t=>!w.sanctuaries.some(z=>overlap({x:t.x-45,y:t.y-70,w:90,h:80},z)));
 return w;
}
export function sanctuaryAt(g,e=g.p){if(g.bossActive||g.inTutorial)return null;const b=entityBox(e);return(g.world.sanctuaries||[]).find(z=>overlap(b,z))||null;}
export function safeSpawn(w,e,padding=35){const b=entityBox(e);return!(w.sanctuaries||[]).some(z=>overlap({x:b.x-padding,y:b.y-padding,w:b.w+padding*2,h:b.h+padding*2},z))&&!Object.values(BOSS_DEFS).some(a=>e.x>a.left-200&&e.x<a.right+100);}
export function wardTime(g,q,x,y,nx,ny){if(q.friendly||g.bossActive||g.inTutorial)return 1;let earliest=1;const r=q.radius||4;for(const z of g.world.sanctuaries||[]){let lo=0,hi=1;for(const[a,d,min,max]of[[x,nx-x,z.x-r,z.x+z.w+r],[y,ny-y,z.y-r,z.y+z.h+r]]){if(Math.abs(d)<1e-9){if(a<min||a>max){lo=2;break;}}else{const u=(min-a)/d,v=(max-a)/d;lo=Math.max(lo,Math.min(u,v));hi=Math.min(hi,Math.max(u,v));}}if(lo<=hi&&hi>=0&&lo<earliest)earliest=Math.max(0,lo);}return earliest;}
export function pacifyEnemy(g,e,dt){
 const area=journeyAt(g.p.x)?.id,own=journeyAt(e.homeX)?.id;if(area!==own)return true;
 const resting=sanctuaryAt(g),inward=sanctuaryAt(g,e),far=Math.abs(e.x-g.p.x)>850||Math.abs(e.y-g.p.y)>750;
 if(!resting&&!inward&&!far)return false;
 e.state='idle';e.t=0;e.didHit=false;e.shielding=false;e.cooldown=Math.max(.8,e.cooldown);e.vx=0;e.vy=0;
 // Retire offscreen pursuit without simulating geometry in another room.
 if(far||inward){e.x=e.homeX;e.y=e.homeY;e.grounded=false;}else if(resting){const dx=e.homeX-e.x;e.x+=Math.sign(dx)*Math.min(Math.abs(dx),35*dt);}
 return true;
}
const ranged=new Set(['ranged','notes','paper','mage','harpoon','lantern','resonator','ember','support']);
export function canBeginEnemyAttack(g,e){const isRange=ranged.has(SPECIES[e.type]?.role);const active=g.world.enemies.filter(a=>a!==e&&!a.dead&&['windup','attack'].includes(a.state)&&Math.abs(a.x-g.p.x)<900&&journeyAt(a.x)?.id===journeyAt(g.p.x)?.id);const total=journeyAt(g.p.x)?.from===1||g.p.x<6140?2:3;return active.length<total&&active.filter(a=>ranged.has(SPECIES[a.type]?.role)===isRange).length<2;}
