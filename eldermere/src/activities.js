// Fishing is the only modal minigame. All other work runs in LifeSystem.
export const ACTIVITIES={fishing:{name:'물고기와 힘겨루기',hint:'Space 또는 감기 버튼을 누르고 놓으며 줄 장력을 초록 구간에 유지하세요.',family:'tension',seconds:5.5}};
export function makeChallenge(kind,id){if(kind!=='fishing')throw Error('Only fishing has a minigame');return{id,kind,family:'tension',elapsed:0,held:false,tension:50,progress:0,accuracy:0,risk:0,settled:false};}
export function advanceChallenge(a,dt){if(a.settled)return null;dt=Math.max(0,Math.min(.05,dt));a.elapsed+=dt;
 a.tension=Math.max(0,Math.min(100,a.tension+(a.held?34:-23)*dt+Math.sin(a.elapsed*3+a.id)*dt*5));const good=a.tension>=32&&a.tension<=72;
 a.progress=Math.min(1,a.progress+(good?dt/(a.seconds||ACTIVITIES.fishing.seconds):dt*.025));a.accuracy+=good?dt:0;if(a.tension<8||a.tension>94)a.risk+=dt;else a.risk=Math.max(0,a.risk-dt*.5);
 if(a.risk>1.2||a.elapsed>25)return{success:false,grade:0};if(a.progress>=1)return{success:true,grade:Math.min(1,a.accuracy/Math.max(.1,a.elapsed))};return null;
}
export class ActivitySystem{
 constructor(game){this.g=game;this.active=null;this.result=null;this.suspended=false;}
 get busy(){return !!(this.active||this.result);}
 start(kind,source,label){const j=this.g.state.life.job;if(kind!=='fishing'||this.busy||source.type!=='job'||j?.kind!=='fish'||j.id!==source.id)return false;const id=++this.g.state.life.activitySerial;this.active={...makeChallenge(kind,id),source:{...source},label,seconds:ACTIVITIES.fishing.seconds/(1+(this.g.life.skill('fishing')-1)*.04)};this.g.paused=true;this.g.attack=null;this.g.event('activity',{});this.g.save(false);return true;}
 resume(){const j=this.g.state.life.job;if(j?.kind==='fish'&&!this.busy)this.start('fishing',{type:'job',id:j.id},'낚시 이어하기');}
 update(dt){if(!this.active||this.suspended)return;const outcome=advanceChallenge(this.active,dt);if(outcome)this.resolve(this.active.id,outcome);}
 input(){return false;}
 hold(id,held){if(!this.active||this.active.id!==id)return false;this.active.held=!!held;return true;}
 resolve(id,outcome){const a=this.active;if(!a||a.id!==id||a.settled)return false;a.settled=true;this.active=null;this.advanceTime(a.elapsed);const inv=this.g.state.inventory,before={...inv},j=this.g.state.life.job;let accepted=false;
 if(j?.kind==='fish'&&j.id===a.source.id){this.g.state.life.job=null;if(outcome.success)accepted=this.g.life.finish({...j,grade:outcome.grade})!==false;}
 const loot=Object.entries(inv).filter(([k,v])=>v>(before[k]||0)).map(([id,v])=>({id,qty:v-(before[id]||0)}));this.result={id,kind:'fishing',label:a.label,success:!!(outcome.success&&accepted),grade:outcome.grade,loot:accepted?loot:[]};this.g.paused=true;this.g.event('activityResult',this.result);this.g.save(false);return true;}
 cancel(){const a=this.active;if(!a){if(this.result)this.dismiss();return false;}this.active=null;this.advanceTime(a.elapsed);this.g.life.cancel();this.g.paused=!this.g.state.started;this.g.event('activityClosed',{});return true;}
 advanceTime(seconds){this.g.state.time+=seconds;this.g.life.growCrops?.(seconds);this.g.farm?.update(seconds);}
 dismiss(){this.result=null;this.g.paused=!this.g.state.started;this.g.event('activityClosed',{});}
}
