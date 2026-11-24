import {SPECIES,CHAPTER_ENEMIES,makeSpecies} from './enemy-species.js';
import {safeSpawn,entityBox,pacifyEnemy} from './sanctuary.js';
import {journeyAt,JOURNEYS} from './journey-data.js';
import {updateMiniboss} from './miniboss-runtime.js';
const anchors=[
 [[700,302],[840,202],[1450,114],[1730,20],[2040,-100],[3250,478],[3510,478],[3890,478],[4250,302]],
 [[6630,302],[6920,-420],[7370,-420],[7700,430],[7910,430],[8840,230],[9050,188],[9500,302]],
 [[11770,302],[11930,302],[12810,478],[13200,258],[13600,114],[13850,302],[14510,430],[14780,430],[15000,430]],
 [[17880,255],[18180,161],[18540,20],[19100,-180],[19430,430],[20350,430],[20660,430],[21450,230],[21600,302]],
 [[24050,302],[24400,430],[24620,430],[25980,67],[26300,-27],[26630,-120],[27000,302],[27420,478],[27710,478],[28130,302]],
 [[31280,302],[31430,302],[31940,478],[32230,234],[32400,478],[33220,252],[33400,156],[33770,-132]],
 [[36520,-120],[36550,-580],[36620,-1000],[36805,-965],[36850,302],[37230,430],[37550,430],[38740,176],[39030,302],[39200,302]]
];
const overlap=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
function perch(w,x,y,d,barriers=false){const area=journeyAt(x)?.id;const choices=w.platforms.filter(q=>q.journey===area&&!q.ceiling&&!q.echo&&!q.voice&&!q.memory&&!q.index&&!q.tide&&!q.resonance&&!q.routeMode&&!q.bridge&&x>q.x+d.w/2+2&&x<q.x+q.w-d.w/2-2&&Math.abs(q.y-y)<60).sort((a,b)=>Math.abs(a.y-y)-Math.abs(b.y-y));for(const q of choices){const e={x,y:q.y-(d.flying?24:0),w:d.w,h:d.h};if(!safeSpawn(w,e))continue;if(w.platforms.some(p=>p!==q&&p.journey===area&&!p.oneway&&!p.echo&&!p.voice&&!p.memory&&!p.routeMode&&!p.bridge&&overlap(entityBox(e),p)))continue;if(barriers&&[...w.gates,...(w.routeWalls||[])].some(p=>p.journey===area&&overlap(entityBox(e),p)))continue;return e;}return null;}
function settleSpawns(w){
 // Validate after assigning the legacy encounter IDs so existing kill records
 // keep referring to the same enemies. Include closed doors and route walls,
 // not just the floor beneath a sprite.
 for(const e of w.enemies){const d=SPECIES[e.type],area=journeyAt(e.homeX)?.id;let pos=perch(w,e.homeX,e.homeY,d,true);
  if(!pos)for(let step=1;step<=24&&!pos;step++)for(const side of[-1,1]){const x=e.homeX+side*step*24;if(journeyAt(x)?.id!==area)continue;pos=perch(w,x,e.homeY,d,true);if(pos)break;}
  if(!pos)throw Error('No clear enemy perch: '+e.id);
  Object.assign(e,{...pos,homeX:pos.x,homeY:pos.y});
 }
}
export function populateEncounters(w,baseEnemy){
 const points=anchors.flatMap((a,i)=>a.map(([x,y])=>({x,y,chapter:i+1})));
 // Preserve old IDs and kill flags, but move placements out of every new sanctuary.
 for(const e of w.enemies){if(safeSpawn(w,e)&&perch(w,e.x,e.y,SPECIES[e.type]))continue;const c=SPECIES[e.type].chapter,candidates=points.filter(p=>p.chapter===c).sort((a,b)=>Math.abs(a.x-e.homeX)-Math.abs(b.x-e.homeX));for(const p of candidates){const pos=perch(w,p.x,p.y,SPECIES[e.type]);if(pos){Object.assign(e,{...pos,homeX:pos.x,homeY:pos.y});break;}}}
 let serial=1000;
 const add=(type,x,y,pack)=>{const d=SPECIES[type],pos=perch(w,x,y,d);if(!pos||w.enemies.some(e=>e.type===type&&Math.abs(e.homeX-pos.x)<65&&Math.abs(e.homeY-pos.y)<70))return;const e=makeSpecies(baseEnemy('e'+serial++,'watchman',pos.x,pos.y,d.chapter-1),type);e.pack=pack;e.homeX=pos.x;e.homeY=pos.y;w.enemies.push(e);};
 anchors.forEach((list,c)=>list.forEach(([x,y],i)=>{const types=CHAPTER_ENEMIES[c];add(types[i%3],x,y,`main-${c}-${i}`);if(i%2===0)add(types[(i+1)%3],x+85,y,`main-${c}-${i}`);}));
 for(const j of JOURNEYS){const ys=j.kind==='pilgrim'?[422,422]:j.kind==='mine'?[434,434]:j.kind==='crypt'?[434,434]:j.kind==='cliff'?[482,478]:j.kind==='coast'?[122,122]:[302,302];for(let i=0;i<2;i++){const dx=j.kind==='pilgrim'?(i?700:520):j.kind==='crypt'?(i?800:540):j.kind==='coast'?(i?970:620):j.kind==='cliff'?(i?1160:620):i?j.length-470:540;add(CHAPTER_ENEMIES[j.from-1][i?1:0],j.start+dx,ys[i],j.id+'-'+i);add(CHAPTER_ENEMIES[j.to-1][i?0:2],j.start+dx+95,ys[i],j.id+'-'+i);}}
 settleSpawns(w);w.encounterCount=w.enemies.length;return w;
}
export function updateEncounters(g,dt){const area=journeyAt(g.p.x)?.id;g.activeEnemies=0;
 // The attack-start budget still limits simultaneous strikes. It must never
 // stop the movement, physics or hit reaction of the eighth visible enemy.
 for(const e of g.world.enemies){if(e.dead){e.deathT+=dt;continue;}if(journeyAt(e.homeX)?.id!==area||Math.abs(e.x-g.p.x)>=850||Math.abs(e.y-g.p.y)>=750){pacifyEnemy(g,e,dt);continue;}g.activeEnemies++;g.updateEnemy(e,dt);}
 for(const e of g.world.minibosses||[])updateMiniboss(g,e,dt);
}
export function reserveMinibossRooms(w){for(const e of w.enemies){const blocked=p=>(w.minibosses||[]).some(m=>Math.abs(p.x-m.homeX)<255&&Math.abs(p.y-m.homeY)<105);if(!blocked(e))continue;const d=SPECIES[e.type];let pos;for(let step=1;step<=32&&!pos;step++)for(const side of[-1,1]){const p=perch(w,e.homeX+side*step*24,e.homeY,d,true);if(p&&!blocked(p)){pos=p;break;}}if(!pos)throw Error('No ordinary perch outside miniboss room: '+e.id);Object.assign(e,{...pos,homeX:pos.x,homeY:pos.y});}}
