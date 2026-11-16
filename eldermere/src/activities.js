import {METALS} from './life-data.js';
// Deterministic activity rules and one-shot reward boundary. No DOM dependencies.
export const ACTIVITIES={
 mining:{name:'광맥의 결을 읽기',hint:'움직이는 바늘이 금빛 구간에 들어오면 Space 또는 타격 버튼을 누르세요.',family:'timing',steps:3,window:.27,speed:1.0},
 logging:{name:'나무의 결 따라 베기',hint:'표시된 방향 순서대로 방향키 또는 방향 버튼을 누르세요. 틀려도 두 번까지 다시 시도할 수 있습니다.',family:'sequence',steps:4},
 gathering:{name:'잘 익은 재료 찾기',hint:'빛나는 재료 세 곳을 기억하세요. 잠시 뒤 같은 자리를 순서에 상관없이 고르면 됩니다.',family:'memory',steps:3},
 harvesting:{name:'수확의 리듬',hint:'초록 구간에서 Space 또는 수확 버튼을 세 번 눌러 줄기를 베세요.',family:'timing',steps:3,window:.34,speed:.8},
 fishing:{name:'물고기와 힘겨루기',hint:'Space 또는 감기 버튼을 누르고 놓으며 줄 장력을 초록 구간에 유지하세요.',family:'tension',seconds:5.5},
 smelting:{name:'용광로 온도 조절',hint:'Space 또는 풀무 버튼을 누르고 놓아 온도를 초록 구간에 유지하세요.',family:'tension',seconds:5},
 cooking:{name:'불맛을 맞추기',hint:'Space 또는 불 조절 버튼을 누르고 놓으며 알맞은 온도를 유지하세요.',family:'tension',seconds:4.5},
 crafting:{name:'장인의 망치질',hint:'금빛 구간에서 Space 또는 망치 버튼을 누르세요. 정확할수록 품질 보너스가 붙습니다.',family:'timing',steps:3,window:.30,speed:.85}
};
export function randomFor(seed,salt=0){let n=Math.imul(seed+11,1664525)+1013904223+Math.imul(salt+9,69069);n=Math.imul(n^(n>>>13),1274126177);return(n>>>0)/4294967296;}
export function makeChallenge(kind,id){const spec=ACTIVITIES[kind];if(!spec)throw Error('Unknown activity');const targets=Array.from({length:spec.steps||3},(_,i)=>.22+randomFor(id,i)*.56);const cells=[...Array(12).keys()].sort((a,b)=>randomFor(id,a+31)-randomFor(id,b+31)).slice(0,3);return{id,kind,family:spec.family,elapsed:0,steps:0,misses:0,accuracy:0,targets,cells,chosen:[],sequence:Array.from({length:4},(_,i)=>Math.floor(randomFor(id,i+17)*4)),cursor:0,held:false,tension:50,progress:0,risk:0,settled:false};}
export function cursorAt(a){return (Math.sin(a.elapsed*Math.PI*(a.speed||ACTIVITIES[a.kind].speed||1)-Math.PI/2)+1)/2;}
export function advanceChallenge(a,dt){if(a.settled)return null;dt=Math.max(0,Math.min(.05,dt));a.elapsed+=dt;if(a.family==='tension'){
 a.tension=Math.max(0,Math.min(100,a.tension+(a.held?34:-23)*dt+Math.sin(a.elapsed*3+a.id)*dt*5));const good=a.tension>=32&&a.tension<=72;
 a.progress=Math.min(1,a.progress+(good?dt/(a.seconds||ACTIVITIES[a.kind].seconds):dt*.025));a.accuracy+=good?dt:0;if(a.tension<8||a.tension>94)a.risk+=dt;else a.risk=Math.max(0,a.risk-dt*.5);
 if(a.risk>1.2||a.elapsed>25)return{success:false,grade:0};if(a.progress>=1)return{success:true,grade:Math.min(1,a.accuracy/Math.max(.1,a.elapsed))};
 }return null;}
export function inputChallenge(a,input){if(a.settled)return null;const spec=ACTIVITIES[a.kind];
 if(a.family==='timing'){const center=a.targets[a.steps],distance=Math.abs(cursorAt(a)-center);if(distance<=(a.window||spec.window)/2){a.steps++;a.accuracy+=1-distance/((a.window||spec.window)/2);if(a.steps>=spec.steps)return{success:true,grade:.65+.35*a.accuracy/spec.steps};}else a.misses++;}
 else if(a.family==='sequence'){if(input===a.sequence[a.steps]){a.steps++;if(a.steps===4)return{success:true,grade:1-a.misses*.12};}else a.misses++;}
 else if(a.family==='memory'){if(a.elapsed<1.8||!Number.isInteger(input)||input<0||input>=12||a.chosen.includes(input))return null;a.chosen.push(input);if(a.cells.includes(input)){a.steps++;if(a.steps===3)return{success:true,grade:1-a.misses*.12};}else a.misses++;}
 if(a.misses>=3)return{success:false,grade:0};return null;}
export class ActivitySystem{
 constructor(game){this.g=game;this.active=null;this.result=null;this.suspended=false;}
 get busy(){return !!(this.active||this.result);}
 start(kind,source,label){if(this.busy)return false;const id=++this.g.state.life.activitySerial;this.active={...makeChallenge(kind,id),source:{...source},label};const node=this.g.world.lifeObjects.find(o=>o.id===source.id);const skill=({mining:'mining',logging:'logging',gathering:'farming',harvesting:'farming',fishing:'fishing',smelting:'smelting',cooking:'cooking',crafting:'smithing'})[kind],level=this.g.life.skill(skill),spec=ACTIVITIES[kind];this.active.window=(spec.window||.27)+Math.min(.1,(level-1)*.008);this.active.seconds=(spec.seconds||5)/(1+(level-1)*.04);if(kind==='mining'){const tier=node?.metal?METALS[node.metal].tier:0;this.active.window-=tier*.025;this.active.speed=(1+tier*.1)/(1+this.g.state.life.tools.pick*.08+(level-1)*.02);}this.g.paused=true;this.g.attack=null;this.g.event('activity',{});this.g.save(false);return true;}
 resume(){const j=this.g.state.life.job;if(!j||this.busy)return;this.start(this.g.life.jobActivity(j),{type:'job',id:j.id},'저장한 작업 이어하기');}
 update(dt){if(!this.active||this.suspended)return;const outcome=advanceChallenge(this.active,dt);if(outcome)this.resolve(this.active.id,outcome);}
 input(id,value){const a=this.active;if(!a||a.id!==id)return false;if(a.family==='timing'&&value!==undefined||a.family==='sequence'&&!Number.isInteger(value))return false;const outcome=inputChallenge(a,value);this.g.event('sound',{name:a.kind==='fishing'?'water':'gather'});if(outcome)this.resolve(id,outcome);return true;}
 hold(id,held){if(!this.active||this.active.id!==id)return false;this.active.held=!!held;return true;}
 resolve(id,outcome){const a=this.active;if(!a||a.id!==id||a.settled)return false;a.settled=true;this.active=null;this.advanceTime(a.elapsed);const inv=this.g.state.inventory,before={...inv},oldGear=new Set(this.g.state.life.gear.map(g=>g.uid));let accepted=false;
 if(outcome.success){if(a.source.type==='job'){const j=this.g.state.life.job;if(j?.id===a.source.id){this.g.state.life.job=null;accepted=this.g.life.finish({...j,grade:outcome.grade})!==false;}}
 else if(a.source.type==='legacy')accepted=this.g.life.collectLegacy(a.source.id,outcome.grade);
 else if(a.source.type==='harvest')accepted=this.g.life.collectCrop(a.source.id,outcome.grade);}
 if(!outcome.success||!accepted){if(a.source.type==='job'){if(this.g.state.life.job?.kind==='fish')this.g.state.life.job=null;else this.g.life.cancel();}}
 const loot=Object.entries(inv).filter(([k,v])=>v>(before[k]||0)).map(([id,v])=>({id,qty:v-(before[id]||0)}));this.result={id,kind:a.kind,label:a.label,success:!!(outcome.success&&accepted),grade:outcome.grade,loot:outcome.success&&accepted?loot:[],equipment:this.g.state.life.gear.filter(g=>!oldGear.has(g.uid))};this.g.paused=true;this.g.event('activityResult',this.result);this.g.save(false);return true;}
 cancel(){const a=this.active;if(!a){if(this.result)this.dismiss();return false;}this.active=null;this.advanceTime(a.elapsed);if(a.source.type==='job')this.g.life.cancel();this.g.paused=!this.g.state.started;this.g.event('activityClosed',{});return true;}
 advanceTime(seconds){this.g.state.time+=seconds;this.g.life.growCrops?.(seconds);}
 dismiss(){this.result=null;this.g.paused=!this.g.state.started;this.g.event('activityClosed',{});}
}
