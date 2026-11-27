import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {JOURNEYS,sceneBounds} from '../src/journey-data.js';
import {PORTAL_ART,PASSAGE_BACKDROPS,portalInScene} from '../src/passage-layout.js';
import {newProfile,SAVE_KEY,validProfile,CHECKPOINTS} from '../src/data.js';
import {body,overlaps,solids,moveBody} from '../src/world.js';

test('all door-shaped assets belong to actual usable portals, with no decorative copies',()=>{
 const w=new Game().world,portals=w.objects.filter(o=>['journey-door','journey-exit'].includes(o.type));
 assert.equal(portals.length,24);assert.equal(new Set(portals.map(o=>o.id)).size,24);
 for(const j of JOURNEYS){const own=portals.filter(o=>o.connection===j.id);assert.equal(own.length,4);assert.ok(own.every(o=>PORTAL_ART.has(o.art)));for(const x of[j.west-75,j.east+80,j.start+120]){const active=own.filter(o=>portalInScene(x,o));assert.equal(active.length,x===j.start+120?2:1);}}
 assert.ok(w.journeyScenery.every(o=>!PORTAL_ART.has(o.art)));assert.ok(Object.values(PASSAGE_BACKDROPS).flat().every(n=>!PORTAL_ART.has(n)));
 for(const j of JOURNEYS)for(const m of w.movers.filter(m=>!m.periodic&&Math.abs(m.y-302)<55))assert.ok(j.east<m.x-60||j.east>m.x+m.w+60,j.id+' return overlaps '+m.id);
});

for(const j of JOURNEYS)test(j.id+' has one visible continuous partition and full-height room ends at the original stopping faces',()=>{
 const g=new Game(),w=g.world,wall=w.gates.find(q=>q.mapBoundary===j.id);
 assert.ok(wall&&!wall.hidden);assert.equal(wall.x,j.west-22);assert.ok(wall.y<=-1480&&wall.y+wall.h>=720);assert.ok(wall.x+wall.w>j.border-65);
 assert.equal(w.gates.filter(q=>q.travelBarrier&&q.id.includes(j.id)).length,1);
 const ends=w.platforms.filter(q=>q.mapBoundary===j.id);assert.equal(ends.length,2);
 const left=ends.find(q=>q.boundarySide==='west'),right=ends.find(q=>q.boundarySide==='east');assert.equal(left.x+left.w,j.start+72);assert.equal(right.x,j.end-72);
 for(const y of[302,40,-500,-1350])for(const [q,dir]of[[wall,1],[left,-1],[right,1]]){const start=dir>0?q.x-15:q.x+q.w+15,p={x:start,y,w:18,h:43,vx:dir*200,vy:0,grounded:false};moveBody(p,.1,[q]);assert.equal(overlaps(body(p),q),false);assert.equal(p.vx,0);}
 const a=sceneBounds(j.west-75,w.w,w),b=sceneBounds(j.east+80,w.w);assert.equal(a.right,wall.x+wall.w);assert.ok(a.right<j.east-100);assert.ok(b.left>j.west+20);assert.deepEqual(sceneBounds(j.start+120,w.w),{left:j.start,right:j.end});
 for(const o of [...CHECKPOINTS,...w.objects.filter(o=>o.type==='workshop')])assert.equal(overlaps({x:o.x-36,y:o.y-72,w:72,h:72},wall),false,o.id+' blocked');
});

test('an old save inside repaired masonry moves only to the nearby usable landing and keeps its progress',()=>{
 for(const j of JOURNEYS)for(const position of[{x:j.west+30,y:302},{x:j.start+35,y:302},{x:j.end-35,y:j.kind==='cliff'?482:302}]){
  const raw=newProfile();Object.assign(raw,{started:true,hp:47,flasks:1,marks:137,level:3,points:2,position,talents:['bellPulse'],abilityReady:{bellPulse:18,blackChain:0},playtime:13});raw.tutorial.state='done';raw.loss={...position,marks:61};assert.ok(validProfile(raw));
  const snapshot=structuredClone(raw),g=new Game({getItem:key=>key===SAVE_KEY?JSON.stringify(raw):null,setItem(){}});
  assert.ok(g.migrationNotice);assert.equal(solids(g).some(q=>q.mapBoundary&&overlaps(body(g.p),q)),false);assert.equal(g.p.grounded,true);assert.equal(g.profile.loss.marks,61);assert.equal(solids(g).some(q=>q.mapBoundary&&overlaps({x:g.profile.loss.x-9,y:g.profile.loss.y-12,w:18,h:12},q)),false);
  for(const key of['hp','flasks','marks','level','points','flags','opened','quests','talents','abilityReady','checkpoint','playtime'])assert.deepEqual(g.profile[key],snapshot[key],key);g.start();g.update(1/120,{});g.update(1/120,{});assert.equal(g.profile.loss,null);assert.equal(g.profile.marks,198);
 }
});

test('a valid old landing is not moved and region locks still require the boss and sister record',()=>{
 assert.deepEqual(sceneBounds(1850,2010),{left:0,right:2010});const raw=newProfile();raw.started=true;raw.tutorial.state='done';const j=JOURNEYS[0];raw.position={x:j.west-40,y:302};const g=new Game({getItem:()=>JSON.stringify(raw),setItem(){}});assert.equal(g.migrationNotice,undefined);assert.deepEqual(g.profile.position,raw.position);g.start();assert.equal(g.interact(),false);assert.equal(g.p.x,raw.position.x);g.profile.flags.edran='freed';assert.equal(g.interact(),true);assert.ok(g.p.x>j.start);
 const palace=JOURNEYS[3];g.resetPlayer({x:palace.west-40,y:302});for(const id of ['edran','marie','brag','leonel'])g.profile.flags[id]='freed';assert.equal(g.interact(),false);g.profile.flags.sister=true;assert.equal(g.interact(),true);
});

test('the tower entrance remains usable beside the hoist, which still works at its own center',()=>{
 const g=new Game(),j=JOURNEYS[5],lift=g.world.movers.find(m=>m.id==='tower-lower');g.start();for(const id of ['edran','marie','brag','leonel','arkein','neris'])g.profile.flags[id]='freed';g.profile.flags.sister=true;
 g.resetPlayer({x:lift.x+lift.w/2,y:302});assert.equal(g.nearest()?.id,'tower-lower');assert.ok(g.interact());assert.equal(lift.target,-120);lift.y=lift.target=302;
 g.resetPlayer({x:j.east,y:302});assert.equal(g.nearest()?.id,'coast-return');assert.ok(g.interact());assert.ok(g.p.x>j.start);
});
