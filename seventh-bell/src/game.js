import {BOSS_MOTION,BOSS_RECOVER_STEP,bossWindup,bossImpactAt,bossRecovery} from './boss-motion.js';
import {MOVE,newGait,groundVelocity,updateGait} from './locomotion.js';
import {ageAfterimages,captureAfterimage,rememberSwing} from './afterimages.js';
import {createTutorialWorld,newTutorial,trainerOf,tutorialSignal,tutorialHit,updateTutorial} from './tutorial.js';
import {mapX,chapterAtWorld} from './layout.js';
import {has,maxStamina,learnReason} from './skills.js';
import {worldBlade,bladeTouches,sweptBlades,rootStep} from './blade.js';
import {updateTraps} from './traps.js';
import {offers,actionCost,checkpointUnlocked,TRAVEL_COST} from './economy.js';
import {BOSS_DEFS,PATTERNS,attackRect,targetRects} from './bosses.js';
import {ATTACKS,CHECKPOINTS,TALENTS,newProfile,validProfile,restoreProfile,maxHp,SAVE_KEY,zoneAt,POTION} from './data.js';
import {createWorld,enemy,body,overlaps,moveBody,solids,clearLine} from './world.js';
const approach=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);
export class Game{
 constructor(storage=null){this.storage=storage;this.saveDisabled=false;this.profile=newProfile();try{const p=JSON.parse(storage?.getItem(SAVE_KEY)||'null');const restored=restoreProfile(p);if(restored)this.profile=restored;}catch{}this.world=this.profile.tutorial.state==='active'?createTutorialWorld(this.profile.tutorial):createWorld();this.event=()=>{};this.clock=0;this.paused=true;this.hitstop=0;this.shake=0;this.skillCD=0;this.echoCD=0;this.echoTime=0;this.bossActive=false;this.effects=[];this.projectiles=[];this.notices=[];this.zone='';this.autosave=0;this.lastHits=[];this.bladeEchoes=[];this.attackSerial=0;this.resetPlayer(this.profile.position);this.restoreEnemies();this.selectBoss();}
 get inTutorial(){return this.world.tutorial===true;}
 get maxHp(){return maxHp(this.profile);}get maxStamina(){return maxStamina(this.profile);}get p(){return this.player;}
 resetPlayer(pos){this.bladeEchoes=[];this.player={x:pos.x,y:pos.y,w:18,h:43,vx:0,vy:0,dir:1,hp:this.profile.hp,stamina:this.maxStamina,gait:newGait(),brake:0,counterReady:0,riposte:0,grounded:false,coyote:0,jumpBuffer:0,jumps:0,action:null,comboQueued:false,invulnerable:.8,hurt:0,dashCD:0,land:0,walk:0,deathT:0,dead:false,deathShown:false};this.attachToFloor();}
 attachToFloor(){const p=this.p,q=solids(this).find(q=>Math.abs(q.y-p.y)<.01&&p.x+p.w/2>q.x&&p.x-p.w/2<q.x+q.w);if(q){p.grounded=true;p.support=q;p.coyote=.11;p.vy=0;if(!q.echo)p.lastSafe={x:p.x,y:p.y};}}
 selectBoss(){if(this.bossActive||this.inTutorial)return;this.world.boss=this.world.bosses[chapterAtWorld(this.p.x)-1];}
 restoreEnemies(){if(this.profile.flags.edran==='slain'&&!this.world.enemies.some(e=>e.id==='e8'))this.world.enemies.push(enemy('e8','wisp',mapX(1100),280));for(const e of this.world.enemies)if(this.profile.killed.includes(e.id)){e.dead=true;e.deathT=5;}for(const b of this.world.bosses)if(this.profile.flags[b.id]){b.dead=true;b.deathT=5;}}

 beginTutorial(){if(this.inTutorial||this.p.dead||this.bossActive||this.p.action||this.p.hurt>0)return false;if(this.world.enemies.some(e=>!e.dead&&Math.abs(e.x-this.p.x)<180&&Math.abs(e.y-this.p.y)<120)||this.projectiles.some(q=>!q.friendly)){this.tell('적이 없는 곳에서 연습하자.');return false;}
 const replay=this.profile.tutorial.state!=='new'||this.profile.flags.letter||this.profile.level>1||this.profile.marks>0;if(replay){this.save();const keys=['profile','world','player','clock','skillCD','echoCD','echoTime','effects','projectiles','zone','autosave','hitstop','shake'];this.trainingReturn=Object.fromEntries(keys.map(k=>[k,this[k]]));this.profile=newProfile();this.profile.started=true;}else this.profile.hp=this.p.hp;
 this.profile.tutorial={...newTutorial(),state:'active'};this.profile.position={x:160,y:302};this.world=createTutorialWorld(this.profile.tutorial);this.resetPlayer(this.profile.position);this.bossActive=false;this.projectiles=[];this.effects=[];this.clock=0;this.hitstop=0;this.shake=0;this.skillCD=0;this.echoCD=0;this.echoTime=0;this.tutorialWalk=0;this.tutorialJumped=false;this.zone='';this.paused=false;this.save();this.event('tutorialStarted',{replay});return true;}
 finishTutorial(skip=false){if(!this.inTutorial){if(this.profile.tutorial.state==='new'){this.profile.tutorial=newTutorial(true);return true;}return false;}const t=this.profile.tutorial;if(!skip&&(t.step<8||Math.abs(this.p.x-1850)>65||Math.abs(this.p.y-302)>55))return false;
 const replay=!!this.trainingReturn;if(replay){const original=this.trainingReturn;this.trainingReturn=null;Object.assign(this,original);}else{const hp=this.p.hp,focus=this.p.stamina;this.profile.tutorial=newTutorial(true);this.profile.position={x:190,y:302};this.profile.hp=hp;this.world=createWorld();this.resetPlayer(this.profile.position);this.p.stamina=focus;this.bossActive=false;this.effects=[];this.projectiles=[];this.zone='';this.restoreEnemies();this.selectBoss();this.save();}this.bladeEchoes=[];this.paused=false;this.event('tutorialExit',{replay,skipped:skip});return true;}

 start(){this.profile.started=true;this.paused=false;this.save();}
 tell(text){this.event('notice',{text});}sound(name){this.event('sound',{name});}
 // Existing bindings stay intact. Direction and dash/parry state select the
 // technique; all attacks still pay once and use the visible steel segment.
 canRecover(){const a=this.p.action;return !a||a.kind==='charge'||a.kind==='dash'||a.kind==='plunge'&&a.landed||!!a.spec&&a.kind!=='heal'&&a.t>=a.spec.end;}
 cancelCharge(){if(this.p.action?.kind==='charge'){this.p.action=null;this.p.comboQueued=false;return true;}return false;}
 beginCharge(){const p=this.p;if(this.paused||p.dead||!this.profile.started||!this.canRecover()||p.hurt>0||p.stamina<actionCost(this.profile,ATTACKS.heavy.stamina))return false;this.bladeEchoes=[];p.action={kind:'charge',spec:ATTACKS.heavy,t:0,air:!p.grounded};p.comboQueued=false;return true;}
 releaseCharge(){const a=this.p.action;if(a?.kind!=='charge')return false;if(this.paused||this.p.dead){this.cancelCharge();return false;}const held=a.t,ok=this.startAttack('heavy',{replace:true,power:held>=.5?1.65:1});if(ok&&held>=.12)this.p.action.t=Math.min(this.p.action.spec.windup-.008333,held);return ok;}
 press(kind,input={}){if(this.paused||this.p.dead||!this.profile.started)return false;const p=this.p;
  if(kind==='jump'){p.jumpBuffer=.13;return true;}
  if(kind==='attack'){
   if(p.counterReady>0&&(!p.action||p.action.kind==='parry'||this.canRecover()))return this.startAttack('counter',{replace:true});
   if(p.action?.kind==='dash')return this.startAttack('thrust',{replace:true});
   if(input.down&&!p.grounded)return this.startAttack('plunge',{replace:this.canRecover()});
   if(input.up)return this.startAttack('upper',{replace:this.canRecover()});
   if(p.action?.kind.startsWith('light')){if(p.action.t>.05)p.comboQueued=true;return true;}
   return this.startAttack('light1',{replace:this.canRecover()});
  }
  if(kind==='upper'||kind==='plunge')return this.startAttack(kind,{replace:this.canRecover()});
  if(kind==='heavy'||kind==='skill')return this.startAttack(kind);
  if(kind==='dash')return this.dash();if(kind==='parry')return this.parry();if(kind==='heal')return this.heal();if(kind==='interact')return this.interact();if(kind==='echo')return this.reveal();return false;
 }
 startAttack(kind,{replace=false,power=1}={}){const p=this.p,base=ATTACKS[kind];if(!base||p.action&&!replace||p.hurt>0||p.stamina<actionCost(this.profile,base.stamina)||kind==='skill'&&this.skillCD>0||kind==='plunge'&&p.grounded||kind==='counter'&&p.counterReady<=0)return false;
  const factor=kind==='heavy'&&has(this.profile,'cutweight')?.85:1,a={...base,duration:base.duration*factor,windup:base.windup*factor,end:base.end*factor};p.stamina-=actionCost(this.profile,a.stamina);
  p.action={kind,spec:a,t:0,hit:new Set(),serial:++this.attackSerial,air:!p.grounded,power:power*(kind!=='skill'&&p.riposte>0?1.35:1)};
  if(kind!=='skill')p.riposte=0;if(kind==='counter')p.counterReady=0;p.comboQueued=false;if(p.grounded)p.vx=0;if(kind==='plunge'){p.vy=0;p.vx*=.25;}
  if(kind==='skill'){this.skillCD=has(this.profile,'echo')?6:8;this.sound('echo');}return true;
 }
 dash(){const p=this.p;if(p.action?.kind==='heal')return false;if(p.dashCD>0||p.stamina<(has(this.profile,'stride')?16:20)||p.hurt>0)return false;if(p.action?.kind==='plunge'&&!p.action.landed)return false;if(p.action&&p.action.spec&&p.action.kind!=='charge'&&p.action.t>=p.action.spec.windup&&p.action.t<p.action.spec.end)return false;this.bladeEchoes=[];p.action={kind:'dash',t:0};p.comboQueued=false;p.stamina-=has(this.profile,'stride')?16:20;p.dashCD=.55;p.vy*=.3;this.sound('dash');if(this.inTutorial)tutorialSignal(this,'dash',trainerOf(this));return true;}
 parry(){const p=this.p;if(p.action?.kind==='heal')return false;if(p.stamina<12||p.hurt>0||p.action&&!this.canRecover())return false;this.bladeEchoes=[];p.action={kind:'parry',t:0};p.comboQueued=false;this.sound('parry');return true;}
 heal(){const p=this.p;if(this.paused||p.dead||this.profile.flasks<1||p.hp>=this.maxHp||p.hurt>0||p.action||!p.grounded||Math.abs(p.vx)>12)return false;this.profile.flasks--;p.action={kind:'heal',t:0,applied:false,spec:{duration:has(this.profile,'quickhands')?.65:POTION.duration,windup:has(this.profile,'quickhands')?.4:POTION.apply,end:has(this.profile,'quickhands')?.53:.65}};this.sound('heal');this.save();return true;}

 reveal(){if(!this.profile.flags.echo){this.tell('파편에는 아직 잡히지 않는 울림이 있다.');return false;}if(this.echoCD>0)return false;this.echoTime=has(this.profile,'echobond')?14:10;this.echoCD=13;this.fx(this.p.x,this.p.y-25,'echo',1);this.tell('끊긴 길이 잠깐 모습을 드러낸다.');this.sound('echo');return true;}
 update(dt,input={}){dt=Math.min(.08,Math.max(0,dt));if(this.paused||!this.profile.started)return;for(let left=dt;left>1e-6;){const step=Math.min(1/120,left);this.step(step,input);left-=step;}}
 step(dt,input){const p=this.p;this.clock+=dt;ageAfterimages(this);this.profile.playtime+=dt;this.effects=this.effects.filter(e=>(e.life-=dt)>0);this.shake=Math.max(0,this.shake-dt*20);if(p.dead){p.deathT+=dt;if(p.deathT>1.3&&!p.deathShown){p.deathShown=true;this.event('death',{});}return;}if(this.hitstop>0){this.hitstop=Math.max(0,this.hitstop-dt);return;}
 this.skillCD=Math.max(0,this.skillCD-dt);this.echoCD=Math.max(0,this.echoCD-dt);this.echoTime=Math.max(0,this.echoTime-dt);p.invulnerable=Math.max(0,p.invulnerable-dt);p.hurt=Math.max(0,p.hurt-dt);p.dashCD=Math.max(0,p.dashCD-dt);p.land=Math.max(0,p.land-dt);p.riposte=Math.max(0,p.riposte-dt);p.counterReady=Math.max(0,p.counterReady-dt);p.jumpBuffer=Math.max(0,p.jumpBuffer-dt);
 const lift=this.world.lift,dy=Math.sign(lift.target-lift.y)*Math.min(Math.abs(lift.target-lift.y),65*dt);if(p.grounded&&p.support===lift)p.y+=dy;lift.y+=dy;
 const wasGrounded=p.grounded;p.coyote=p.grounded ? .11 : Math.max(0,p.coyote-dt);if(p.grounded)p.jumps=0;
 if(p.jumpBuffer>0&&p.hurt===0&&this.canRecover()&&(p.coyote>0||this.profile.flags.echo&&p.jumps<2)){p.vy=-390;p.jumps=p.coyote>0?1:2;p.grounded=false;p.coyote=0;p.jumpBuffer=0;p.land=0;if(p.action){p.action=null;p.comboQueued=false;this.bladeEchoes=[];}this.sound('jump');if(this.inTutorial)tutorialSignal(this,'jump');this.fx(p.x,p.y,'dust',.32);}
 if(!input.jump&&p.vy<-160)p.vy=approach(p.vy,-160,2100*dt);
 if(p.action?.kind==='dash'){p.action.t+=dt;p.vx=p.dir*310;if(p.action.t>=.03&&p.action.t<=.23)p.invulnerable=Math.max(p.invulnerable,.035);if(p.action.t>=.28)p.action=null;}
 else if(p.hurt===0){const move=Number(!!input.right)-Number(!!input.left),oldVX=p.vx;
 if(p.action&&p.grounded){p.vx=p.action.spec?(rootStep(p.action,p.action.t+dt)-rootStep(p.action,p.action.t))/dt*p.dir:0;p.brake=0;}
 else{if(p.grounded)p.vx=groundVelocity(p.vx,move,dt);else{const accel=has(this.profile,'airstep')?1312:1050;p.vx=approach(p.vx,move*MOVE.speed,(move?accel:1450)*dt);}if(!p.action){if(move&&oldVX*move<0&&Math.abs(oldVX)>18)p.brake+=dt;else p.brake=0;if(Math.abs(p.vx)>8)p.dir=Math.sign(p.vx);else if(move&&Math.abs(oldVX)<8)p.dir=move;}}}
 else p.vx=approach(p.vx,0,380*dt);
 if(p.action?.kind==='plunge'&&!p.action.landed&&p.action.t>=p.action.spec.windup){p.vy=720;p.vx=0;}else p.vy=Math.min(560,p.vy+1100*dt);const oldX=p.x;moveBody(p,dt,solids(this));p.x=Math.max(15,Math.min(this.world.w-20,p.x));p.walk+=Math.abs(p.x-oldX);updateGait(p,p.x-oldX,dt,Number(!!input.right)-Number(!!input.left));
 if(p.grounded&&!p.support?.echo)p.lastSafe={x:p.x,y:p.y};
 if(!wasGrounded&&p.grounded){p.land=.12;this.fx(p.x,p.y,'dust',.35);this.sound('land');}
 if(p.action&&p.action.kind!=='dash'){
  const a=p.action;a.t+=dt;if(a.spec&&a.t<a.spec.windup)rememberSwing(this,a);
  if(a.kind==='charge'){
   if(a.t>=.5&&!a.ready){a.ready=true;this.fx(p.x+p.dir*8,p.y-39,'charge',.3);this.sound('parry');}
  }else if(a.kind==='plunge'){
   // The dive remains active until actual terrain contact, never a timer-based
   // air explosion. A single hit set spans the entire fall and landing.
   if(a.landed){a.recoveryT+=dt;if(a.recoveryT>=.36)p.action=null;}
   else if(a.t>=a.spec.windup){this.resolveAttack(a);if(p.grounded){a.landed=true;a.recoveryT=0;this.fx(p.x,p.y,'dust',.4);this.sound('heavy');this.shake=Math.max(this.shake,2);}}
  }else{
   if(!p.grounded&&a.spec&&a.kind!=='heal'&&a.kind!=='skill')a.air=true;
   if(a.kind==='heal'&&a.t>=a.spec.windup&&!a.applied){a.applied=true;p.hp=Math.min(this.maxHp,p.hp+Math.ceil(this.maxHp*POTION.ratio));this.fx(p.x,p.y-25,'heal',.8);this.save();}
   else if(a.kind!=='heal'&&a.spec&&a.t>=a.spec.windup&&a.t<a.spec.end)this.resolveAttack(a);
   if(a.impactPause&&a.t>=a.spec.windup+(a.spec.end-a.spec.windup)*.8){this.hitstop=Math.max(this.hitstop,a.impactPause);a.impactPause=0;}
   const duration=a.kind==='parry'?.55:p.comboQueued&&a.spec.chainAt?a.spec.chainAt:a.spec.duration;
   if(a.t>=duration){const next=a.kind==='light1'?'light3':null,queued=p.comboQueued;p.action=null;p.comboQueued=false;if(queued&&next)this.startAttack(next);}
  }
 }
 if(!p.action&&p.hurt===0)p.stamina=Math.min(this.maxStamina,p.stamina+(this.profile.talents.includes('breath')?24:17)*dt);
 if(this.inTutorial)updateTutorial(this,dt);else{this.selectBoss();for(const e of this.world.enemies)if(!this.bossActive)this.updateEnemy(e,dt);this.updateBoss(dt);updateTraps(this,dt);}this.updateProjectiles(dt);
 if(p.y>650)this.die();if(this.profile.loss&&Math.hypot(p.x-this.profile.loss.x,p.y-this.profile.loss.y)<35){this.profile.marks+=this.profile.loss.marks;this.profile.loss=null;this.tell('떨어뜨린 동전을 되찾았다.');this.sound('coin');this.save();}
 const zone=this.inTutorial?'tutorial':zoneAt(p.x,p.y);if(zone!==this.zone){this.zone=zone;this.event('zone',{zone});}
 this.autosave+=dt;if(this.autosave>15){this.autosave=0;this.save();}}
 attackDamage(a){const p=this.profile;let n=a.spec.damage+p.upgrade*4+(p.level-1)*2+(p.flags.upper?7:0)+(a.kind==='heavy'&&p.flags.forge?12:0);if(a.kind==='skill'){if(has(p,'echocharge'))n*=1.2;}else{n+=(has(p,'edge')?3:0)+(has(p,'edge2')?4:0);if(a.kind==='light3'&&has(p,'finisher'))n*=1.2;if(a.air&&has(p,'aircut'))n*=1.2;}return Math.round(n*(a.power||1));}
 resolveAttack(a){const p=this.p,s=a.spec;if(a.kind==='skill'){if(!a.released){a.released=true;this.projectiles.push({kind:'echoBlade',friendly:true,x:p.x+p.dir*24,y:p.y-30,vx:p.dir*285,vy:0,damage:this.attackDamage(a),owner:'player',life:.6,range:145,distance:0,hit:new Set(),pierce:has(this.profile,'echo2')?3:2});}return;}
 if(!a.swung){if(!a.prepared){const t=a.t;a.t=Math.max(0,s.windup-1e-6);rememberSwing(this,a);a.t=t;}a.swung=true;this.sound(['heavy','light3'].includes(a.kind)?'heavy':'swing');}captureAfterimage(this,a);const blade=worldBlade(p),paths=sweptBlades(a.previousBlade,blade).filter(b=>clearLine(this,p.x,p.y-30,b.ax,b.ay));a.previousBlade=blade;
 const touches=r=>paths.some(b=>bladeTouches(b,r)&&clearLine(this,b.ax,b.ay,Math.max(r.x,Math.min(r.x+r.w,b.bx)),Math.max(r.y,Math.min(r.y+r.h,b.by))));
 for(const e of [...this.world.enemies,this.world.boss]){if(e.dead||e.boss&&(!this.bossActive||e!==this.world.boss)||a.hit.has(e.id)||!touches(body(e)))continue;a.hit.add(e.id);this.damageEnemy(e,this.attackDamage(a),p.dir,s.push,a.kind);if(a.kind==='light3'&&p.grounded&&!a.impact){a.impact=true;this.fx(p.x+p.dir*26,p.y,'dust',.35);}if(a.kind==='upper'&&!e.boss&&!e.training&&!e.flying&&!e.dead){e.vy=-255;e.grounded=false;e.y-=1;}this.lastHits.push({enemy:e.id,kind:a.kind,t:a.t,windup:s.windup,end:s.end,blade:{...blade}});this.lastHits=this.lastHits.slice(-30);}
 const seal=this.world.objects.find(o=>o.id==='forgecache');if(a.kind==='heavy'&&this.profile.flags.forge&&!this.profile.flags.slag&&touches({x:seal.x-22,y:seal.y-35,w:44,h:35})){this.profile.flags.slag=true;this.tell('보물함을 묶은 쇠사슬이 끊어졌다.');this.fx(seal.x,seal.y-20,'hit',.8);this.sound('mechanism');this.save();}}

 hitPause(duration,kind){const a=this.p.action;if(['light3','heavy'].includes(kind)&&a?.kind===kind&&a.t<a.spec.windup+(a.spec.end-a.spec.windup)*.8)a.impactPause=Math.max(a.impactPause||0,duration);else this.hitstop=Math.max(this.hitstop,duration);}
 damageEnemy(e,n,dir,push=80,kind=null){const weight=['heavy','plunge','counter'].includes(kind)?1.5:kind==='light3'?1.65:1;if(e.training){if(!this.inTutorial||e.dead)return;tutorialHit(this,e,kind,n);this.hitPause(.05*weight,kind);this.shake=1.2*weight;this.fx(e.x,e.y-e.h*.5,'hit',.3);this.sound(kind==='light3'?'slamHit':'hit');return;}if(e.dead||e.state==='weakened'&&e.grace>0)return;e.hp=Math.max(0,e.hp-n);e.hit=.13;e.hitDir=dir;if(!e.boss)e.vx=dir*push;e.stagger=e.boss?e.stagger:kind==='light3'?.48:.34;if(!e.boss){e.state='recover';e.t=0;}this.hitPause((e.boss?.06:.05)*weight,kind);this.shake=(e.boss?2:1.2)*weight;this.fx(e.x,e.y-e.h*.5,'hit',.3);this.sound(kind==='light3'?'slamHit':'hit');this.effects.push({kind:'number',x:e.x,y:e.y-e.h-6,text:String(n),life:.65,max:.65});
 if(e.boss&&e.phase===2&&e.hp<=e.maxHp*.115&&this.profile.flags[BOSS_DEFS[e.id].clue]&&!e.offered){e.offered=true;e.hp=Math.max(1,e.hp);e.state='weakened';e.stagger=0;e.t=0;e.grace=1.3;this.p.comboQueued=false;this.projectiles=[];this.tell('종의 박자가 기록과 같다. 가까이서 W를 누르면 울림을 맞출 수 있다.');return;}
 if(e.hp<=0){e.dead=true;e.deathT=0;e.vx=0;if(e.boss){this.clearBoss('slain');return;}if(!this.profile.killed.includes(e.id))this.profile.killed.push(e.id);this.profile.marks+=(e.type==='watchman'?10:12)+(e.rank||0)*4;this.gainXp((e.type==='watchman'?18:22)+(e.rank||0)*5);this.sound('coin');}}

 updateEnemy(e,dt){
 e.hit=Math.max(0,e.hit-dt);if(e.dead){e.deathT+=dt;return;}if(Math.abs(e.x-this.p.x)>850)return;e.stagger=Math.max(0,e.stagger-dt);e.cooldown-=dt;e.t+=dt;
 const p=this.p,d=p.x-e.x,vertical=Math.abs(p.y-e.y),alert=Math.abs(d)<(e.flying?270:250)&&vertical<(e.flying?155:75),rank=e.rank||0;
 if(e.stagger>0)e.vx=approach(e.vx,0,500*dt);
 else if(e.state==='windup'){e.vx=0;if(e.t>=(e.type==='cantor'?1:e.flying?.8:.72)){e.state='attack';e.t=0;e.didHit=false;this.sound(e.type==='cantor'?'echo':'swing');if(e.type==='cantor')this.spawnShot(e.x+e.dir*16,e.y-33,e.dir*145,0,24+rank*4,e.id,'ember',300);}}
 else if(e.state==='attack'){e.vx=e.flying?e.dir*145:0;if(!e.didHit&&e.type!=='cantor'&&e.t<.25&&overlaps({x:e.dir>0?e.x-5:e.x-55,y:e.y-e.h-5,w:60,h:e.h+10},body(p))&&clearLine(this,e.x,e.y-20,p.x,p.y-20)){e.didHit=true;this.hurt((e.type==='watchman'?27:23)+rank*4,e);}if(e.t>.30){e.state='recover';e.t=0;}}
 else if(e.state==='recover'){e.vx=0;if(e.t>.85){e.state='idle';e.cooldown=.55;e.t=0;}}
 else if(alert){e.dir=Math.sign(d)||e.dir;const reach=e.type==='cantor'?225:e.flying?65:52;if(Math.abs(d)<reach&&vertical<(e.flying?36:75)&&e.cooldown<=0&&clearLine(this,e.x,e.y-25,p.x,p.y-25)){e.state='windup';e.t=0;e.vx=0;}else e.vx=e.dir*(e.type==='watchman'?51:e.type==='cantor'?23:58);}
 else e.vx=Math.abs(e.homeX-e.x)>40?Math.sign(e.homeX-e.x)*22:Math.sin(this.clock*.45+e.homeX)*13;
 const x=e.x;
 if(e.flying){const ox=e.x,oy=e.y;e.x+=e.vx*dt;const floor=this.world.platforms.filter(q=>!q.echo&&q.x<e.x+10&&q.x+q.w>e.x-10&&q.y>=e.homeY-5).sort((a,b)=>a.y-b.y)[0]?.y??302;
 const desired=alert?p.y-17:floor-22+Math.sin(this.clock*2.5+e.homeX)*6;
 if(e.state!=='windup'&&e.state!=='attack')e.y=approach(e.y,desired,90*dt);
 if(solids(this).some(q=>!q.oneway&&overlaps(body(e),q))){e.x=ox;e.y=oy;e.vx=0;}}
 else{e.vy=Math.min(500,e.vy+1100*dt);const ahead=solids(this).some(q=>q.x<e.x+e.dir*22&&q.x+q.w>e.x+e.dir*22&&Math.abs(q.y-e.y)<25);if(!ahead&&e.grounded&&e.state!=='attack')e.vx=0;moveBody(e,dt,solids(this));}e.walk+=Math.abs(x-e.x);
 }
 spawnShot(x,y,vx,vy,damage,owner,kind='ember',range=360){this.projectiles.push({x,y,vx,vy,damage,owner,kind,attackSerial:owner===this.world.boss.id?this.world.boss.attackSerial:null,life:range/Math.hypot(vx,vy)+.05,distance:0,range});}
 beginBossWindup(e,pattern,second=false){
  e.attackSerial=(e.attackSerial||0)+1;e.pattern=pattern;e.state='windup';e.t=0;e.vx=0;e.second=second;e.released=false;e.didHit=false;e.dir=Math.sign(this.p.x-e.x)||e.dir;
  const a=PATTERNS[pattern],d=BOSS_DEFS[e.id];e.targets=a.pillars?[Math.max(d.left+70,Math.min(d.right-70,this.p.x)),Math.max(d.left+70,Math.min(d.right-70,this.p.x+(this.p.x<e.x?190:-190)))]:[];this.sound('parry');
 }
 updateBoss(dt){
 const e=this.world.boss,p=this.p,d=BOSS_DEFS[e.id],motion=BOSS_MOTION[e.id];e.hit=Math.max(0,e.hit-dt);if(e.dead){e.deathT+=dt;return;}
 if(!this.bossActive){if(p.x>d.left+65&&p.x<d.right-25&&p.y<350){this.bossActive=true;this.projectiles=[];this.event('bossIntro',{id:e.id,text:d.intro});this.sound('bell');}else return;}
 e.cooldown-=dt;e.t+=dt;e.stagger=Math.max(0,e.stagger-dt);
 if(e.state==='weakened'){e.grace=Math.max(0,(e.grace||0)-dt);e.vx=0;return;}
 if(e.hp<e.maxHp*.52&&e.phase===1&&['idle','recover'].includes(e.state)){e.phase=2;e.state='transition';e.t=0;e.vx=0;e.stagger=0;e.second=false;this.projectiles=[];this.shake=3;this.fx(e.x,e.y-65,'echo',1.3);this.tell(d.phaseText||(e.id==='edran'?'에드란이 금 간 종을 움켜쥐었다.':e.id==='marie'?'마리에의 목에 달린 종에서 목소리가 흘러나왔다.':'브라그가 화로 문을 열었다.'));this.sound('bell');}
 if(e.state==='transition'){if(e.t>=1.6){e.state='idle';e.t=0;e.cooldown=.6;}return;}
 // Only a successful parry holds the boss. Ordinary hits preserve the current
 // preparation/strike/footfall rather than selecting a collapse drawing.
 if(e.stagger>.12){e.vx=0;return;}
 const approachPlayer=factor=>{const distance=p.x-e.x;e.dir=Math.sign(distance)||e.dir;e.vx=Math.abs(distance)>motion.stop?e.dir*motion.speed*factor:0;};
 if(e.state==='idle'){
  approachPlayer(1);
  if(e.cooldown<=0&&Math.abs(p.x-e.x)<=180){const list=d.patterns[e.phase-1];this.beginBossWindup(e,list[e.attackIndex++%list.length]);}
 }else if(e.state==='windup'){
  e.vx=0;if(e.t>=bossWindup(e)){e.state='attack';e.t=0;e.didHit=false;e.released=false;}
 }else if(e.state==='attack'){
  const a=PATTERNS[e.pattern];e.vx=(a.speed||0)*e.dir;
  // Ground blows release at the low impact drawing; casts and direct cuts
  // release while the weapon/hand extends. No damage occurs in preparation.
  if(e.t>=bossImpactAt(e.pattern)&&e.t<a.active){
   if(!e.released){e.released=true;this.sound(e.id==='marie'||e.id==='leonel'?'echo':'heavy');
    if(a.wave){for(const dir of [-1,1])this.spawnShot(e.x+dir*35,e.y-9,dir*155,0,a.wave,e.id,'wave',e.id==='brag'?330:390);this.shake=3;}
    if(a.shot)this.spawnShot(e.x+e.dir*25,e.y-30,e.dir*175,0,a.damage,e.id,a.projectile||'voice',a.projectile?340:380);
    if(a.pillars)for(const x of e.targets)this.fx(x,e.y-50,'pillar',.28);
   }
   const rects=a.pillars?targetRects(e):a.range?[attackRect(e)]:[];
   if(!e.didHit&&rects.some(r=>overlaps(r,body(p)))&&clearLine(this,e.x,e.y-30,p.x,p.y-25)){e.didHit=true;this.hurt(a.damage,e);}
  }
  if(e.t>=a.active){e.state='recover';e.t=0;e.vx=0;}
 }else if(e.state==='recover'){
  e.vx=0;if(e.t>=BOSS_RECOVER_STEP)approachPlayer(.72);
  if(e.t>=bossRecovery(e)){if(PATTERNS[e.pattern]?.twice&&!e.second)this.beginBossWindup(e,e.pattern,true);else{e.second=false;e.state='idle';e.t=0;e.cooldown=.6;}}
 }
 const oldX=e.x;e.x=Math.max(d.left+75,Math.min(d.right-65,e.x+e.vx*dt));e.walk+=Math.abs(e.x-oldX);if(Math.abs(e.x-oldX)<1e-6)e.vx=0;
 }

 hurt(n,source){const p=this.p;if(p.dead||p.invulnerable>0)return false;const face=(source.x-p.x)*p.dir>0,a=p.action;if(a?.kind==='parry'&&face&&!source.unblockable){if(a.t>=.025&&a.t<=.21){if(source.boss)this.projectiles=this.projectiles.filter(q=>q.friendly||q.owner!==source.id||q.attackSerial!==source.attackSerial);source.stagger=1.35;source.state='recover';source.t=0;p.stamina=Math.min(this.maxStamina,p.stamina+24);this.hitstop=.09;p.counterReady=.8;this.shake=3;this.fx(p.x+p.dir*14,p.y-30,'parry',.5);if(source.training)tutorialSignal(this,'parry',source);if(has(this.profile,'riposte'))p.riposte=1.8;this.sound('parryHit');return false;}if(p.stamina>=(has(this.profile,'guard')?14:18)){p.stamina-=has(this.profile,'guard')?14:18;n=Math.ceil(n*.3);if(source.training)tutorialSignal(this,'guard',source);}}
 n=Math.max(1,n-this.profile.gear.armor*2);if(source.training&&this.inTutorial)n=Math.min(n,Math.max(0,p.hp-1));if(has(this.profile,'laststand')&&p.hp<=this.maxHp*.3)n=Math.ceil(n*.9);p.hp-=n;this.bladeEchoes=[];p.counterReady=0;p.action=null;p.comboQueued=false;p.hurt=has(this.profile,'poised')?.23:.28;p.invulnerable=.65;p.vx=(Math.sign(p.x-source.x)||-p.dir)*(has(this.profile,'poised')?101:135);p.vy=-75;this.shake=3.5;this.hitstop=.06;this.fx(p.x,p.y-25,'hurt',.4);this.sound('hurt');if(p.hp<=0)this.die();return true;}
 updateProjectiles(dt){for(const q of this.projectiles){const old=q.x,oldY=q.y,speed=Math.hypot(q.vx,q.vy),travel=Math.min(dt,Math.max(0,((q.range||300)-(q.distance||0))/speed));q.x+=q.vx*travel;q.y+=q.vy*travel;q.distance=(q.distance||0)+speed*travel;q.life-=dt;
 if(!clearLine(this,old,oldY,q.x,q.y)){q.life=0;continue;}
 if(q.friendly){const dir=Math.sign(q.vx),blade={ax:old-dir*14,ay:oldY,bx:q.x+dir*14,by:q.y};for(const e of [...this.world.enemies,this.world.boss]){if(e.dead||e.boss&&!this.bossActive||q.hit.has(e.id)||!bladeTouches(blade,body(e),2)||!clearLine(this,q.x,q.y,e.x,e.y-Math.min(35,e.h/2)))continue;q.hit.add(e.id);this.damageEnemy(e,q.damage,dir,100,'skill');this.fx(e.x,e.y-e.h*.5,'bladeImpact',.3);if(q.hit.size>=q.pierce){q.life=0;break;}}}
 else{const hit=overlaps({x:Math.min(old,q.x)-5,y:Math.min(oldY,q.y)-(q.kind==='wave'?10:6),w:Math.abs(q.x-old)+10,h:Math.abs(q.y-oldY)+(q.kind==='wave'?17:12)},body(this.p));if(q.life>0&&hit){this.hurt(q.damage,{x:q.x-Math.sign(q.vx)*20,stagger:0,state:'idle'});q.life=0;}}
 if(q.distance>=(q.range||300)){q.life=0;this.fx(q.x,q.y,'dust',.18);}}this.projectiles=this.projectiles.filter(q=>q.life>0);}


 die(){if(this.p.dead)return;const p=this.p;p.dead=true;this.bladeEchoes=[];p.action=null;p.hp=0;p.deathT=0;const protectedCoins=this.profile.charm;const lost=Math.floor(this.profile.marks*(protectedCoins?.2:.5));this.profile.charm=false;if(protectedCoins)this.tell('매듭이 풀어졌다. 떨어뜨린 동전이 줄었다.');this.profile.marks-=lost;const point=p.y>580&&p.lastSafe?p.lastSafe:p;this.profile.loss=lost?{x:point.x,y:Math.min(478,point.y),marks:lost}:null;this.sound('death');this.save();}
 respawn(){if(this.inTutorial){this.profile.hp=this.maxHp;this.profile.flasks=3;this.world=createTutorialWorld(this.profile.tutorial);this.resetPlayer({x:160,y:302});this.projectiles=[];this.hitstop=0;this.paused=false;this.save();return;}this.bossActive=false;this.projectiles=[];this.world=createWorld();this.profile.killed=[];const c=CHECKPOINTS.find(c=>c.id===this.profile.checkpoint);this.profile.hp=this.maxHp;this.profile.flasks=3;this.resetPlayer(c);this.restoreEnemies();this.selectBoss();this.paused=false;this.skillCD=0;this.save();}
 gainXp(n){this.profile.xp+=n;while(this.profile.xp>=45*this.profile.level&&this.profile.level<30){this.profile.xp-=45*this.profile.level;this.profile.level++;this.profile.points++;this.tell('레벨 '+this.profile.level+' · 수첩에서 능력을 익힐 수 있다.');this.sound('level');}}
 nearest(){if(this.bossActive&&this.world.boss.state==='weakened'&&Math.abs(this.p.x-this.world.boss.x)<90)return {id:this.world.boss.id,type:'boss',x:this.world.boss.x,y:302,label:'종의 울림 맞추기'};const objs=this.world.objects.filter(o=>(!o.echo||this.echoTime>0)&&(!o.voice||this.profile.flags.voice)&&(!o.memory||this.profile.flags.memory)&&!(o.type==='chest'&&this.profile.opened.includes(o.id)));return objs.filter(o=>Math.abs(o.x-this.p.x)<60&&Math.abs((o.type==='lift'?this.world.lift.y:o.y)-this.p.y)<55).sort((a,b)=>Math.abs(a.x-this.p.x)-Math.abs(b.x-this.p.x))[0];}
 interact(){if(this.p.action?.kind==='heal')return false;const o=this.nearest();if(!o)return false;const f=this.profile.flags;if(o.type==='trainingExit')return this.finishTutorial();if(o.type==='boss'){this.clearBoss('freed');return true;}if(o.type==='npc'||o.type==='workshop'){this.event('npc',{});return true;}if(o.type==='letter'){f.letter=true;this.event('letter',{});this.save();return true;}
 if(o.type==='shrine'){this.profile.checkpoint=o.checkpoint;if(!this.profile.rested.includes(o.checkpoint))this.profile.rested.push(o.checkpoint);this.tell('기록했다. 체력과 약병은 보충되지 않는다.');this.sound('bell');this.fx(o.x,o.y-30,'echo',1);this.save();return true;}
 if(o.type==='bellrope'||o.type==='valve'){const key=o.type==='bellrope'?'choir':'coolant';if(!f[key]){f[key]=true;this.gainXp(25);this.tell(key==='choir'?'종줄이 움직였다. 성가대석으로 가는 문이 열렸다.':'화로의 압력이 내려갔다. 모루 쪽 철문이 열렸다.');this.sound('mechanism');this.save();}return true;}

 if(o.type==='royallever'){if(!f[o.flag]){f[o.flag]=true;this.gainXp(30);this.tell(o.flag==='palacedoor'?'지하에서 문이 들려 올라갔다.':'멈춘 종축이 다시 돌기 시작했다.');this.sound('mechanism');this.save();}return true;}
 if(o.type==='palaceway'){this.tell(f.leonel&&f.sister?'문이 열렸다. 안쪽에서 종소리가 겹쳐 들린다.':'기록실 오른쪽 독서대를 먼저 살펴보자.');return true;}
 if(o.type==='indexwheel'){if(!f.index){f.index=true;this.gainXp(30);this.fx(mapX(12415),302,'echo',1.2);this.sound('mechanism');this.tell('책장 사이로 다리가 펼쳐졌다. 위쪽 통로로 돌아갈 수 있다.');this.save();}else this.tell('색인 장치는 제자리에 맞춰져 있다.');return true;}
 if(o.type==='lectern'){if(!f.chronology){f.chronology=true;this.gainXp(25);this.save();}this.event('clue',{id:'chronology'});return true;}
 if(o.type==='finalrecord'){if(!f.leonel){this.tell('기록실의 종이 책을 닫아 놓고 있다.');return false;}f.sister=true;this.save();this.event('clue',{id:'sister'});return true;}
 if(o.type==='archiveway'){this.tell(f.brag?'쪽지에는 레오넬에게 그 책을 태우지 말라고 적혀 있다. 오른쪽이 서고다.':'모루의 울림이 서고 문을 붙잡고 있다.');return true;}
 if(o.type==='lever'){if(!f.lever){f.lever=true;this.gainXp(12);this.tell('쇠사슬이 움직인다. 위쪽 성문이 열렸다.');this.sound('mechanism');this.save();}else this.tell('성문은 열려 있다. 오른쪽 승강기로 올라갈 수 있다.');return true;}
 if(o.type==='lift'){this.world.lift.target=this.world.lift.y>390?302:478;this.sound('mechanism');return true;}
 if(o.type==='chest'){if(this.profile.opened.includes(o.id))return false;if(o.id==='forgecache'&&(!f.forge||!f.slag)){this.tell(f.forge?'강공격으로 보물함의 쇠사슬을 끊을 수 있다.':'도가니가 쇠와 붙어 버렸다. 더 강한 열이 필요하다.');return false;}this.profile.opened.push(o.id);if(o.id.endsWith('-cache')){this.profile.marks+=40;this.profile.points++;this.tell('종축 연결 부품을 챙겼다. 깨달음 +1, 동전 +40.');}if(o.id==='royalorder'){f.royalorder=true;this.profile.marks+=45;this.event('clue',{id:'royalorder'});}if(o.id==='palacecache'){this.profile.marks+=100;this.profile.points++;this.tell('시종이 남긴 동전 100개 · 깨달음 +1');}if(o.id==='crypt'){f.memento=true;this.profile.marks+=20;this.event('memento',{});}if(o.id==='supplies'){this.profile.marks+=25;f.lead=!f.helped;this.tell('동전 25개와 종을 고칠 납을 찾았다.');}if(o.id==='upper'){f.upper=true;this.profile.marks+=40;this.tell('수리공의 인장 · 공격력 +7. 뒷면에 아버지의 작업장 이름이 남아 있다.');}if(o.id==='hymn'||o.id==='ledger'||o.id==='errata'){f[o.id]=true;this.profile.marks+=30;this.event('clue',{id:o.id});}if(o.id==='choirrelic'){this.profile.marks+=60;this.profile.points++;this.tell('유리병 속에서 어린아이의 웃음이 들렸다. 깨달음 +1, 동전 +60.');}if(o.id==='archivecache'){this.profile.marks+=100;this.profile.points++;this.tell('접혀 있던 기록에서 처음 보는 내일을 읽었다. 깨달음 +1, 동전 +100.');}if(o.id==='forgecache'){this.profile.marks+=90;this.profile.points++;this.tell('불씨가 식지 않은 도가니 · 깨달음 +1, 동전 +90.');}this.sound('coin');this.save();return true;}
 if(o.type==='tower'){this.tell(o.id==='tower'?(f.edran?'오른쪽 길이 대성당으로 이어진다.':'문지기가 성문 열쇠를 지니고 있다.'):(f.marie?'재 냄새가 바람에 섞여 온다. 제철도시는 오른쪽이다.':'제단의 울림이 철문을 붙잡고 있다.'));return true;}if(o.type==='ending'){if(!f.arkein){this.tell('옥좌의 종이 아직 왕의 손에 묶여 있다.');return false;}this.event('chapterEnd',{});return true;}return false;}
 hiddenEnding(){const p=this.profile;return ['edran','marie','brag','leonel','arkein'].every(id=>p.flags[id]==='freed')&&p.flags.helped&&p.flags.chronology&&p.flags.sister&&['yard','procession','ash','atlas'].every(id=>p.opened.includes(id+'-cache'));}
 chooseEnding(choice){if(!this.profile.flags.arkein||this.profile.flags.ending||!['today','night','dawn'].includes(choice)||choice==='dawn'&&!this.hiddenEnding()||this.nearest()?.type!=='ending')return false;this.profile.flags.ending=choice;this.sound('bell');this.save();this.event('ending',{choice});return true;}

 clearBoss(choice){const e=this.world.boss,d=BOSS_DEFS[e.id];if(this.profile.flags[e.id])return false;e.dead=true;e.hp=0;e.deathT=0;e.state='dead';this.bossActive=false;this.profile.flags[e.id]=choice;this.profile.flags[d.ability]=true;this.profile.marks+=d.chapter*40+40;this.profile.points+=2;this.gainXp(70+d.chapter*20);this.projectiles=[];this.restoreEnemies();this.sound('bell');this.event('bossClear',{choice,id:e.id});this.save();return true;}

 workshop(){if(!this.profile.started||this.p.dead||this.bossActive||this.p.action||this.p.hurt>0)return null;return this.world.objects.filter(o=>['npc','workshop'].includes(o.type)&&Math.abs(o.x-this.p.x)<65&&Math.abs(o.y-this.p.y)<55).sort((a,b)=>Math.abs(a.x-this.p.x)-Math.abs(b.x-this.p.x))[0]||null;}
 shopOffers(){return offers(this.profile);}
 purchase(id){if(!this.workshop()||!Number.isSafeInteger(this.profile.marks))return false;const item=this.shopOffers().find(o=>o.id===id);if(!item||item.reason||!Number.isSafeInteger(item.price)||item.price<=0)return false;this.profile.marks-=item.price;if(id==='weapon')this.profile.upgrade++;else if(id==='charm')this.profile.charm=true;else this.profile.gear[id]++;this.sound('level');this.save();return true;}
 upgrade(){return this.purchase('weapon');}
 travelReason(id){const station=this.workshop(),c=CHECKPOINTS.find(c=>c.id===id);if(!station)return '정비대에서만 이동할 수 있다.';if(!c||!this.profile.rested.includes(id)||!checkpointUnlocked(this.profile,c))return '발견하지 않은 종이다.';if((station.checkpoint||'outer')===id)return '지금 있는 종이다.';if(this.profile.marks<TRAVEL_COST)return '동전이 부족하다.';if(this.world.enemies.some(e=>!e.dead&&Math.abs(e.x-this.p.x)<150&&Math.abs(e.y-this.p.y)<100))return '근처의 적을 먼저 처리해야 한다.';return null;}
 travel(id){if(this.travelReason(id))return false;const c=CHECKPOINTS.find(c=>c.id===id);this.profile.marks-=TRAVEL_COST;this.profile.checkpoint=id;Object.assign(this.p,{x:c.x,y:c.y,vx:0,vy:0,grounded:false,coyote:0,jumpBuffer:0,jumps:0,action:null,lastSafe:{x:c.x,y:c.y}});this.attachToFloor();this.p.invulnerable=Math.max(this.p.invulnerable,1.2);this.bladeEchoes=[];this.projectiles=[];this.echoTime=0;this.selectBoss();this.save();this.sound('bell');return true;}

 nearElma(){const o=this.world.objects.find(o=>o.id==='salvager');return !!(o&&!this.p.dead&&!this.bossActive&&Math.abs(this.p.x-o.x)<155&&Math.abs(this.p.y-o.y)<115);}
 acceptQuest(){if(!this.nearElma()||this.profile.quests.elma!=='available')return false;this.profile.quests.elma='active';this.tell('엘마의 부탁 · 순례교 위쪽 보급함에서 납 찾기');this.save();return true;}
 help(){if(!this.nearElma()||this.profile.quests.elma!=='active'||!this.profile.flags.lead||this.profile.flags.helped)return false;this.profile.flags.lead=false;this.profile.flags.helped=true;this.profile.quests.elma='done';this.profile.marks+=20;this.tell('엘마의 부탁 완료 · 동전 20개');this.save();return true;}
 learn(id){const t=TALENTS[id];if(learnReason(this.profile,id))return false;this.profile.points-=t.cost;this.profile.talents.push(id);this.p.hp=Math.min(this.maxHp,this.p.hp);this.sound('level');this.save();return true;}
 fx(x,y,kind,life=.4,dir=1){this.effects.push({x,y,kind,life,max:life,dir,seed:this.clock});}
 eraseSave(){try{if(!this.storage)return false;this.storage.removeItem(SAVE_KEY);if(this.storage.getItem(SAVE_KEY)!==null)return false;}catch{return false;}this.saveDisabled=true;this.paused=true;return true;}
 save(){if(this.saveDisabled||this.trainingReturn)return false;if(!this.profile.started)return false;const p=this.p,c=CHECKPOINTS.find(c=>c.id===this.profile.checkpoint);if(p.dead){this.profile.flasks=3;this.profile.killed=[];}this.profile.hp=p.dead?this.maxHp:Math.max(1,p.hp);this.profile.position=this.bossActive||p.dead||p.y>580?{x:c.x,y:c.y}:{x:p.x,y:p.y};if(!validProfile(this.profile))return false;try{this.storage?.setItem(SAVE_KEY,JSON.stringify(this.profile));return true;}catch{return false;}}
}
