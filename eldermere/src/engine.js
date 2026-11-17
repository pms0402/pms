import {PackSystem} from './pack.js';
import {ToolSystem} from './tools.js';
import {pursueEnemy,animateEnemy} from './enemy-motion.js';
import {ValleySystem} from './valley.js';
import {AdventureSystem} from './adventure.js';
import {FarmSystem} from './farm.js';
import {learned,CHAPTERS} from './progression.js';
import {ActivitySystem} from './activities.js';
import {LifeSystem} from './life.js';
import {SPAWN,initialState,restoreSave,SAVE_KEY,RECIPES,craft,regionAt,REGIONS} from './data.js';
import {createWorld,blocked,enemy,objectBounds} from './world.js';
export class Game {
 constructor(storage=localStorage){this.storage=storage;this.loadError=false;this.state=initialState();try{const s=JSON.parse(storage.getItem(SAVE_KEY));const restored=restoreSave(s);if(restored)this.state=restored;else if(s)this.loadError=true;}catch{this.loadError=true;}
 this.world=createWorld();this.world.enemies.push(enemy('guardian',320,178,'guardian','dungeon'));this.effects=[];this.particles=[];this.attack=null;this.attackCooldown=0;this.dashTime=0;this.invulnerable=0;this.gatherCooldown=0;this.walk=0;this.moving=false;this.running=false;this.paused=!this.state.started;this.region=regionAt(this.state.player.x,this.state.player.y,this.state.map);this.autosave=0;this.shake=0;this.event=()=>{};this.frames=0;this.totalKills=0;this.projectiles=[];this.life=new LifeSystem(this);this.activities=new ActivitySystem(this);this.adventure=new AdventureSystem(this);this.farm=new FarmSystem(this);this.valley=new ValleySystem(this);this.tools=new ToolSystem(this);this.pack=new PackSystem(this);this.life.furnishHome();
 for(const e of this.world.enemies){if(this.state.rpg.clears.includes(e.id)){e.dead=true;e.respawn=1e12;}if(this.state.killed[e.id]>this.state.time){e.dead=true;e.respawn=this.state.killed[e.id];}}
 if(this.solid(this.state.player.x,this.state.player.y)){this.state.map='overworld';Object.assign(this.state.player,SPAWN);}
 }
 get p(){return this.state.player;}get maxHp(){return 100+(this.p.level-1)*10+(this.life?.bonusHp()||0)+(this.adventure?.bonusHp()||0);}get damage(){return (this.adventure?.bonusDamage()||0)+(this.state.rpg?.buffs.focus>0?4:0)+(this.life?.weaponDamage()??(18+(this.state.inventory.sword?9:0)+(this.p.level-1)*2+(this.life?.offenseBonus()||0)));}get enemies(){return this.world.enemies.filter(e=>e.map===this.state.map&&!e.dead);}
 solid(x,y,r=7){
  if(this.state.map!=='overworld')return blocked(x,y,this.state.map,[...this.world.objects,...this.world.lifeObjects],this.state,r);
  const version=this.world.objects.length+','+this.world.lifeObjects.length;
  if(this.collisionVersion!==version){this.collisionVersion=version;this.collisionGrid=new Map();for(const o of [...this.world.objects,...this.world.lifeObjects]){if(o.map&&o.map!=='overworld')continue;const b=objectBounds(o);if(!b)continue;for(let cy=Math.floor((b.y-20)/64);cy<=Math.floor((b.y+b.h+20)/64);cy++)for(let cx=Math.floor((b.x-20)/64);cx<=Math.floor((b.x+b.w+20)/64);cx++){const key=cx+','+cy;if(!this.collisionGrid.has(key))this.collisionGrid.set(key,[]);this.collisionGrid.get(key).push(o);}}}
  const objects=r<=20?(this.collisionGrid.get(Math.floor(x/64)+','+Math.floor(y/64))||[]):[...this.world.objects,...this.world.lifeObjects];return blocked(x,y,'overworld',objects,this.state,r);
 }
 move(entity,dx,dy,r=7){const steps=Math.max(1,Math.ceil(Math.max(Math.abs(dx),Math.abs(dy))/4));let moved=false;for(let i=0;i<steps;i++){if(!this.solid(entity.x+dx/steps,entity.y,r)){entity.x+=dx/steps;moved=true;}if(!this.solid(entity.x,entity.y+dy/steps,r)){entity.y+=dy/steps;moved=true;}}return moved;}
 notify(text,sound='ui'){this.event('toast',{text});this.event('sound',{name:sound});}
 start(){this.state.started=true;this.paused=false;this.save(false);}
 update(dt,input){this.frames++;if(this.paused)return;dt=Math.max(0,Math.min(dt,.04));this.state.time+=dt;this.valley.update(dt);this.adventure.update(dt);this.farm.update(dt);this.attackCooldown=Math.max(0,this.attackCooldown-dt);this.gatherCooldown=Math.max(0,this.gatherCooldown-dt);this.invulnerable=Math.max(0,this.invulnerable-dt);this.shake=Math.max(0,this.shake-dt*25);
 let dx=(input.right?1:0)-(input.left?1:0),dy=(input.down?1:0)-(input.up?1:0),len=Math.hypot(dx,dy);if(len){dx/=len;dy/=len;if(Math.abs(dx)>Math.abs(dy))this.p.dir=dx>0?1:3;else this.p.dir=dy>0?0:2;}
 this.running=!!input.run&&this.p.stamina>4&&len>0;let speed=(this.running?113:78)*(this.adventure.slow>0?.65:1);
 if(this.dashTime>0){this.dashTime-=dt;dx=this.dashX;dy=this.dashY;speed=290;}else this.p.stamina=Math.min(100,this.p.stamina+(this.running?-9:22+(learned(this.state,'endurance')?8:0))*dt);
 const ox=this.p.x,oy=this.p.y;this.move(this.p,dx*speed*dt,dy*speed*dt);this.life.update(dt);this.updateProjectiles(dt);this.moving=Math.hypot(this.p.x-ox,this.p.y-oy)>.01;if(this.moving)this.walk+=dt*(this.running?12:8);
 if(this.attack){this.attack.t+=dt;if(this.attack.t>=.075&&!this.attack.hit){this.attack.hit=true;this.resolveAttack();}if(this.attack.t>(this.attack.duration||.3))this.attack=null;}
 for(const e of this.world.enemies){if(e.dead){if(e.id!=='guardian'&&e.respawn<this.state.time){e.dead=false;e.hp=e.maxHp;e.x=e.homeX;e.y=e.homeY;e.route=null;e.aggro=false;e.returning=false;e.windup=0;e.positionChecked=false;}continue;}if(e.map!==this.state.map)continue;this.updateEnemy(e,dt);}
 for(const f of this.effects)f.life-=dt;this.effects=this.effects.filter(f=>f.life>0);for(const p of this.particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=30*dt;}this.particles=this.particles.filter(p=>p.life>0);
 const region=regionAt(this.p.x,this.p.y,this.state.map);if(region!==this.region){this.region=region;if(!this.state.discovered.includes(region)){this.state.discovered.push(region);this.gainXp(8);this.notify('새 지역 발견 · '+REGIONS[region].name);}this.event('region',{name:REGIONS[region].name});}
 this.autosave+=dt;if(this.autosave>20){this.autosave=0;this.save(false);}
 }
 dash(input){if(this.paused||this.dashTime>0||this.p.stamina<30)return false;let x=(input.right?1:0)-(input.left?1:0),y=(input.down?1:0)-(input.up?1:0);if(!x&&!y)[x,y]=[[0,1],[1,0],[0,-1],[-1,0]][this.p.dir];const len=Math.hypot(x,y);this.dashX=x/len;this.dashY=y/len;this.dashTime=.19;this.invulnerable=.25;this.p.stamina-=30;this.burst(this.p.x,this.p.y,8,'#d0d9b1');this.event('sound',{name:'dash'});return true;}
 strike(angle){const gear=this.life.weapon(),profile=this.life.profile(),cost=gear?profile.stamina:5;if(this.paused||this.life.l.job||this.attackCooldown>0||this.p.stamina<cost||this.dashTime>0)return false;if(!Number.isFinite(angle))angle=[Math.PI/2,0,-Math.PI/2,Math.PI][this.p.dir];this.attack={angle,t:0,hit:false,profile,damage:this.damage,duration:gear?Math.min(.5,profile.cooldown*.7):.3};this.attackCooldown=(gear?profile.cooldown:.37)*this.life.attackSpeed();this.p.stamina-=cost;this.p.dir=Math.abs(Math.cos(angle))>Math.abs(Math.sin(angle))?(Math.cos(angle)>0?1:3):(Math.sin(angle)>0?0:2);this.event('sound',{name:profile.projectile?'cast':'swing'});return true;}
 resolveAttack(){const a=this.attack,profile=a.profile;if(profile?.projectile){this.projectiles.push({x:this.p.x,y:this.p.y,angle:a.angle,speed:profile.projectile==='arrow'?300:180,range:profile.range,damage:a.damage,type:profile.projectile});return;}
 for(const e of this.enemies){const dx=e.x-this.p.x,dy=e.y-this.p.y,d=Math.hypot(dx,dy),angle=Math.atan2(dy,dx),delta=Math.atan2(Math.sin(angle-a.angle),Math.cos(angle-a.angle));if(d>(profile?.range||48)+(['guardian','caveguard'].includes(e.type)?8:0)||Math.abs(delta)>(profile?.arc||1.25))continue;
 if(!this.clearLine(this.p.x,this.p.y,e.x,e.y))continue;this.hitEnemy(e,a.damage,a.angle);}}
 clearLine(x,y,xx,yy){const steps=Math.ceil(Math.hypot(xx-x,yy-y)/4);for(let i=1;i<steps;i++)if(this.solid(x+(xx-x)*i/steps,y+(yy-y)*i/steps,2))return false;return true;}
 hitEnemy(e,damage,angle){if(e.dead)return;e.hp-=damage;const recipe=this.life.weapon()?.recipe;if(recipe==='ember_sword'){e.burn=3;e.burnTick=0;}if(recipe==='frost_staff')e.slow=4;e.hit=.18;this.shake=2.3;this.effects.push({x:e.x,y:e.y-25,text:String(damage),color:'#f5dfaa',life:.65});this.burst(e.x,e.y-12,12,'#f0d698');this.event('sound',{name:'hit'});this.move(e,Math.cos(angle)*8,Math.sin(angle)*8,9);if(e.hp<=0)this.kill(e);}
 updateProjectiles(dt){for(const p of this.projectiles){if(p.dead)continue;const travel=Math.min(p.range,p.speed*dt),steps=Math.ceil(travel/3);for(let i=0;i<steps;i++){const len=travel/steps,nx=p.x+Math.cos(p.angle)*len,ny=p.y+Math.sin(p.angle)*len;if(this.solid(nx,ny,2)){p.dead=true;break;}p.x=nx;p.y=ny;p.range-=len;const hit=this.enemies.find(e=>Math.hypot(e.x-p.x,e.y-p.y)<(['guardian','caveguard'].includes(e.type)?18:12));if(hit){if(p.type==='spark'){for(const e of this.enemies)if(Math.hypot(e.x-p.x,e.y-p.y)<38&&this.clearLine(p.x,p.y,e.x,e.y))this.hitEnemy(e,p.damage,p.angle);this.burst(p.x,p.y-14,22,'#a8ded0');}else this.hitEnemy(hit,p.damage,p.angle);p.dead=true;break;}}if(p.range<=0)p.dead=true;}this.projectiles=this.projectiles.filter(p=>!p.dead);}
 kill(e){if(e.dead)return;this.totalKills++;if(this.adventure.onKill(e))return;e.dead=true;this.state.inventory[e.type==='wolf'?'pelt':e.type==='caveguard'||e.id==='guardian'?'ancientShard':'gel']++;e.respawn=e.id==='guardian'?1e12:this.state.time+150;this.state.killed[e.id]=e.respawn;this.state.gold+=['guardian','caveguard'].includes(e.type)?45:e.type==='wolf'?8:5;this.gainXp(e.xp||(['guardian','caveguard'].includes(e.type)?90:e.type==='wolf'?22:16));this.burst(e.x,e.y-12,18,'#98c5ad');if(e.id==='guardian'){this.state.inventory.crystal++;if(this.state.quest===2)this.state.quest=3;this.notify('숲의 심장을 얻었습니다. 장로 로완에게 돌아가세요.','level');this.save(false);}else if(Math.random()<.4){this.state.inventory.herb++;this.notify('달빛풀 +1');}}
 pursueEnemy(e,target,speed,dt,stop=0){return pursueEnemy(this,e,target,speed,dt,stop);}
 updateEnemy(e,dt){const previous={x:e.x,y:e.y};this.thinkEnemy(e,dt);animateEnemy(e,previous);}
 thinkEnemy(e,dt){
  if(!e.positionChecked){e.positionChecked=true;if(this.solid(e.x,e.y,10)){outer:for(let radius=8;radius<=80;radius+=8)for(let i=0;i<16;i++){const x=e.x+Math.cos(i*Math.PI/8)*radius,y=e.y+Math.sin(i*Math.PI/8)*radius;if(!this.solid(x,y,10)){e.x=e.homeX=x;e.y=e.homeY=y;break outer;}}}}
  if(e.burn>0){e.burn-=dt;e.burnTick=(e.burnTick||0)+dt;if(e.burnTick>=1){e.burnTick-=1;e.hp-=4;this.burst(e.x,e.y-15,3,'#e7aa6d');if(e.hp<=0){this.kill(e);return;}}}
  if(this.adventure.enemy(e,dt))return;
  e.slow=Math.max(0,(e.slow||0)-dt);e.hit=Math.max(0,e.hit-dt);e.cooldown-=dt;
  const d=Math.hypot(this.p.x-e.x,this.p.y-e.y),home=Math.hypot(e.x-e.homeX,e.y-e.homeY),large=['guardian','caveguard'].includes(e.type),reach=large?55:26;
  if(e.windup>0){e.windup=Math.max(0,e.windup-dt);if(e.windup===0){e.cooldown=large?1.4:1.1;if(d<(large?63:33)&&this.clearLine(e.x,e.y,this.p.x,this.p.y))this.hurt(e.damage||(large?22:e.type==='wolf'?13:9),e);this.burst(e.x,e.y,7,'#c3a578');}return;}
  // Separate acquire/release distances stop aggro flickering at the boundary.
  if(e.returning&&home<12){e.returning=false;e.aggro=false;}
  if(!e.returning&&(home>300||e.aggro&&d>270)){e.aggro=false;e.returning=true;e.route=null;}
  if(!e.returning&&d<(e.aggro?270:205))e.aggro=true;
  if(!e.aggro&&!e.returning&&d>330)return;
  let target,stop=3;
  if(e.aggro){
   if(d<=reach&&this.clearLine(e.x,e.y,this.p.x,this.p.y)){if(e.cooldown<=0)e.windup=large?.75:.5;return;}
   target=this.p;stop=reach-2;
  }else if(e.returning||home>65){target={x:e.homeX,y:e.homeY};}
  else{
   if(!e.wander||this.state.time>e.wander.until){const phase=e.homeX*.07+e.homeY*.13+Math.floor(this.state.time/5)*2.4;e.wander={x:e.homeX+Math.cos(phase)*32,y:e.homeY+Math.sin(phase)*24,until:this.state.time+4};e.route=null;}
   target=e.wander;
  }
  const speed=(e.type==='bat'?68:e.type==='wolf'?49:large?30:29)*(e.slow>0?.45:1)*(e.hit>0?0:1);
  this.pursueEnemy(e,target,speed,dt,stop);
  // Gentle separation keeps a pack from occupying exactly the same footprint.
  if(e.moving!==false&&speed>0)for(const other of this.enemies){if(other===e)continue;const dx=e.x-other.x,dy=e.y-other.y,len=Math.hypot(dx,dy);if(len>0&&len<20)this.move(e,dx/len*(20-len)*dt*2,dy/len*(20-len)*dt*2,10);}
 }

 hurt(amount,source){if(this.invulnerable>0)return false;amount=Math.max(Math.ceil(amount*.28),amount-this.life.defense()-this.adventure.bonusDefense());if(this.state.rpg.buffs.guard>0)amount=Math.max(1,Math.round(amount*.45));this.life.cancel('피격으로 작업이 중단되었습니다. 재료를 돌려받았습니다.');this.p.hp-=amount;this.invulnerable=.85;this.shake=4;this.effects.push({x:this.p.x,y:this.p.y-30,text:'−'+amount,color:'#f3a18c',life:.7});this.event('sound',{name:'hurt'});const d=Math.hypot(this.p.x-source.x,this.p.y-source.y)||1;this.move(this.p,(this.p.x-source.x)/d*13,(this.p.y-source.y)/d*13);if(this.p.hp<=0){this.adventure.hazards=[];this.state.gold=Math.max(0,this.state.gold-10);this.state.map='overworld';Object.assign(this.p,SPAWN,{hp:this.maxHp,stamina:100});this.invulnerable=3;this.notify('장로가 당신을 구했습니다. 마을에서 다시 시작합니다. (10G 소모)');this.event('travel',{});this.save(false);}return true;}
 gainXp(n){this.p.xp+=n;while(this.p.xp>=60*this.p.level){this.p.xp-=60*this.p.level;this.p.level++;this.p.hp=this.maxHp;this.notify('레벨 상승! LV. '+this.p.level+' · 체력과 공격력 증가','level');}}
 burst(x,y,n,color){for(let i=0;i<n;i++)this.particles.push({x,y,vx:(Math.random()-.5)*75,vy:(Math.random()-.7)*75,life:.3+Math.random()*.4,color});}
 nearest(){if(this.state.map==='dungeon'){const obs=[{id:'exit',map:'dungeon',type:'entrance',x:320,y:439,interact:'exit',label:'버들빛 계곡으로 나가기'},{id:'relic',map:'dungeon',type:'crystal',x:320,y:110,interact:'relic',label:'고대 비문 읽기'}];return obs.filter(o=>Math.hypot(o.x-this.p.x,o.y-this.p.y)<42).sort((a,b)=>Math.hypot(a.x-this.p.x,a.y-this.p.y)-Math.hypot(b.x-this.p.x,b.y-this.p.y))[0];}
 return this.life.nearest();}

 interact(target){if(this.paused)return false;const o=target||this.nearest();if(!o||!this.life.near(o,65))return false;if(this.life.interact(o))return true;if(this.life.l.job){this.notify('작업이 진행 중입니다.');return;}if(o.interact==='gather'){this.life.collectLegacy(o.id);return;}
 if(o.interact==='well'){this.p.hp=this.maxHp;this.p.stamina=100;this.notify('시원한 우물물로 체력과 전투 활력을 회복했습니다.');return;}
 if(o.interact==='entrance'||o.interact==='exit'){if(o.interact==='entrance'){const reason=this.adventure.canEnter('dungeon');if(reason){this.notify(reason);return;}}this.state.map=o.interact==='entrance'?'dungeon':'overworld';Object.assign(this.p,o.interact==='entrance'?{x:320,y:422}:{x:1490,y:327});this.attack=null;this.invulnerable=1.5;this.event('travel',{});this.notify(o.interact==='entrance'?'폐광에 들어섰습니다. 붉은 공격 예고를 피해 회피하세요.':'숲의 바람이 느껴집니다.');this.save(false);return;}
 if(o.interact==='chest'){if(this.state.chest){this.notify('상자는 비어 있습니다.');return;}this.state.chest=true;this.state.gold+=30;this.state.inventory.potion+=2;this.notify('오래된 보급품 · 30G, 회복 물약 2개');this.save(false);return;}
 this.event('dialog',{type:o.interact});}
 nearBench(){return this.life.nearStation('bench');}
 craft(id){if(this.life.l.job||this.activities.busy)return false;return this.life.startRecipe(id);}
 use(id='potion'){if(['grilledFish','stew','moonFeast','apple','cheese','omelet','starSalad','emberStew','frostTea'].includes(id)){if(this.state.inventory[id]<1||this.life.l.job)return false;const restore={grilledFish:[60,30],stew:[75,60],moonFeast:[9999,100],apple:[12,5],cheese:[70,15],omelet:[55,70],starSalad:[50,50],emberStew:[85,60],frostTea:[40,60]}[id];if(this.p.hp>=this.maxHp&&this.p.stamina>=100&&!['omelet','starSalad','emberStew','frostTea'].includes(id))return false;this.state.inventory[id]--;if(['omelet','starSalad','emberStew'].includes(id))this.state.rpg.buffs.focus=60;if(id==='frostTea')this.state.rpg.buffs.ward=60;this.p.hp=Math.min(this.maxHp,this.p.hp+restore[0]);this.p.stamina=Math.min(100,this.p.stamina+restore[1]);this.notify('음식으로 기운을 되찾았습니다.','heal');this.save(false);return true;}if(!['potion','food'].includes(id)||this.state.inventory[id]<=0)return false;if(this.p.hp>=this.maxHp&&(id!=='food'||this.p.stamina>=100)){this.notify('이미 충분히 회복되어 있습니다.');return false;}this.state.inventory[id]--;this.p.hp=Math.min(this.maxHp,this.p.hp+(id==='potion'?45:25));if(id==='food')this.p.stamina=Math.min(100,this.p.stamina+40);this.burst(this.p.x,this.p.y-12,10,'#a6cba3');this.notify(id==='potion'?'체력 +45':'체력 +25 · 전투 활력 +40','heal');return true;}
 buy(id){return this.life.trade('mira',id,'buy');}
 sell(id){return this.life.trade('mira',id,'sell');}
 advanceQuest(){if(this.state.quest===0){this.state.quest=this.state.inventory.sword||this.state.life.gear.some(g=>g.slot==='weapon')?(this.state.inventory.crystal?3:2):1;this.notify('퀘스트 수락 · 숲의 부름');}else if((this.state.quest===2||this.state.quest===3)&&this.state.inventory.crystal>0){this.state.inventory.crystal--;this.state.quest=4;this.state.gold+=120;this.gainXp(60);this.notify('퀘스트 완료 · 120G, 경험치 60','level');}this.save(false);}
 save(show=true){if(!this.state.started)return false;try{this.storage.setItem(SAVE_KEY,JSON.stringify(this.state));this.event('saved',{});if(show)this.notify('여정을 저장했습니다.');return true;}catch{this.notify('저장 공간을 사용할 수 없습니다. 브라우저 설정을 확인하세요.');return false;}}
}
