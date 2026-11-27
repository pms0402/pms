import {JOURNEYS,journeyAt,mainChapter} from './journey-data.js';

// Door artwork belongs to usable exits only, never to background decoration.
export const PORTAL_ART=new Set([0,2,3,4,8,9,10,11,14,16]);
export const PASSAGE_BACKDROPS={pilgrim:[1,22],mine:[21,5],rail:[7,23],crypt:[22,23],cliff:[12,13],coast:[13,23]};
const legacyGates=['first-bell','second-bell','third-bell','palace-closed','royal-harbor','sixth-bell'];

export function buildPassageBoundaries(world){
 for(const [i,j] of JOURNEYS.entries()){
  // These three old, invisible stoppers and the old chapter gate occupied the
  // same exit. The solid end wall now supplies the single physical boundary.
  const retired=new Set([legacyGates[i],'journey-door-'+j.id,'journey-inside-west-'+j.id,'journey-inside-east-'+j.id]);
  world.gates=world.gates.filter(g=>!retired.has(g.id));
  const wall=world.gates.find(g=>g.id==='journey-road-'+j.id),nextBench=world.objects.filter(o=>o.type==='workshop'&&o.x>=j.border-40&&o.x<j.east).reduce((right,o)=>Math.min(right,o.x-38),j.border+20);
  Object.assign(wall,{x:j.west-22,y:-1480,w:nextBench-(j.west-22),h:2200,hidden:false,mapBoundary:j.id});
  const left=world.platforms.find(q=>q.journey===j.id&&q.ceiling&&q.x===j.start-20);
  const right=world.platforms.find(q=>q.journey===j.id&&q.ceiling&&q.x===j.end-8);
  Object.assign(left,{w:92,mapBoundary:j.id,boundarySide:'west'});
  Object.assign(right,{x:j.end-72,w:92,mapBoundary:j.id,boundarySide:'east'});
 }
 return world;
}

export function portalInScene(playerX,o){
 const j=JOURNEYS.find(j=>j.id===o.connection),room=journeyAt(playerX);if(!j)return false;
 return room?o.type==='journey-exit'&&room.id===j.id:o.type==='journey-door'&&mainChapter(playerX)===(o.side==='west'?j.from:j.to);
}

export function repairedPassagePosition(p,world){
 const b={x:p.x-p.w/2,y:p.y-p.h,w:p.w,h:p.h},wall=[...world.gates,...world.platforms].find(q=>q.mapBoundary&&b.x<q.x+q.w&&b.x+b.w>q.x&&b.y<q.y+q.h&&b.y+b.h>q.y);
 if(!wall)return null;const j=JOURNEYS.find(j=>j.id===wall.mapBoundary);
 if(wall.boundarySide)return{x:wall.boundarySide==='west'?j.start+120:j.end-125,y:wall.boundarySide==='east'&&j.kind==='cliff'?482:302};
 return{x:p.x<j.border?j.west-75:j.east+80,y:302};
}
