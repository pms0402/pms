// The same input-only simulation is replayed before/after the presentation patch.
// No positions, health, AI timers, geometry or damage values change during a run.
export function reviewStep(g,mode,n,state){const e=g.world.enemies.find(e=>e.id==='e33'),keys={right:n<(mode==='plunge'?182:102),jump:mode==='plunge'&&n>=170&&n<204};
 if(mode==='combo'){
  if(!state.parried&&e.state==='windup'&&e.t>=e.prep-.1){g.press('parry');state.parried=true;}
  if(state.parried&&!state.started&&g.p.counterReady===0&&!g.p.action&&e.stagger>0){g.press('attack');state.started=true;}
  if(state.started&&!state.queued&&g.p.action?.kind==='light1'&&g.p.action.t>.27){g.press('attack');state.queued=true;}
 }else if(mode==='plunge'){
  if(n===170)g.press('jump');
  if(n===204)g.press('attack',{down:true});
 }
 return keys;
}
export function reviewMark(g,mode,state){const e=g.world.enemies.find(e=>e.id==='e33');if(mode==='cycle'){
 if(!state.walk&&e.state==='idle'&&Math.abs(e.vx)>15){state.walk=true;return'walk';}
 if(!state.prep&&e.state==='windup'&&e.t>.45){state.prep=true;return'prepare';}
 if(!state.strike&&e.state==='attack'&&e.t>.07){state.strike=true;return'strike';}
 if(state.strike&&!state.recover&&e.state==='recover'&&e.t>.34){state.recover=true;return'recover';}
 }else{const kind=g.lastHits.at(-1)?.kind;if(mode==='combo'&&kind==='light1'&&!state.light){state.light=true;return'light';}if(mode==='combo'&&kind==='light3'&&!state.slam){state.slam=true;return'slam';}if(mode==='plunge'&&kind==='plunge'&&!state.plunge){state.plunge=true;return'plunge';}}
 return null;
}
export function reviewTrace(g){const p=g.p,e=g.world.enemies.find(e=>e.id==='e33');return{clock:g.clock,hitstop:g.hitstop,p:[p.x,p.y,p.vx,p.vy,p.hp,p.stamina,p.action?.kind,p.action?.t,p.action?.impactPause],enemy:[e.x,e.y,e.vx,e.vy,e.hp,e.state,e.t,e.stagger,e.dir,e.mode],shots:g.projectiles.map(q=>[q.x,q.y,q.vx,q.vy,q.life,q.owner,q.damage]),hits:g.lastHits.map(h=>[h.enemy,h.kind,h.t])};}
