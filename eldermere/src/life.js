import {weatherAt} from './valley-data.js';
import {materialReason,itemReason,stageAt,CHAPTERS} from './progression.js';
import {HOMES,homeSpec,homeDoor,homeUpgradePrice,farmLimit} from './housing.js';
import {homeGround} from './life-world.js';
import {METALS,CROPS,SKILLS,WEAPONS,GEAR_TYPES,QUALITIES,AFFIXES,ALL_RECIPES,GEAR_RECIPES,gearBuyPrice,FACILITIES,VENDORS,ORDERS,skillNeed,hourAt,dayAt,countCost,spend,stableRoll,gearStats,gearValue,quote,ensureMarket,addPressure} from './life-data.js';
import {ITEMS,mapSize} from './data.js';
import {blocked} from './world.js';
export class LifeSystem {
 constructor(game){this.g=game;this.placement=null;this.movingIndex=null;this.workFx=null;this.npcs=[];if(game.world.maps)game.world.maps.home=homeGround(game.state.life.home.type||'cottage');
  for(const o of game.world.objects){if(o.type==='merchant'){o.npc='mira';o.vendor='mira';}if(o.type==='farmer'){o.npc='farmer';o.vendor='farmer';}}
  for(const o of [...game.world.objects,...game.world.lifeObjects].filter(o=>o.npc)){
   const homes={mira:{x:425,y:568},farmer:{x:425,y:853},smith:{x:812,y:554},fisher:{x:1660,y:1050},miner:{x:1620,y:390,map:'overworld'}};
   o.map=o.map||'overworld';o.work={x:o.x,y:o.y,map:o.map};o.home={...homes[o.npc],map:homes[o.npc].map||'overworld'};this.npcs.push(o);
   if(!this.isOpen(o.npc)){o.map=o.home.map;o.x=o.home.x;o.y=o.home.y;}
  }
 }
 get s(){return this.g.state;}get l(){return this.s.life;}
 skill(id){return this.l.skills[id]?.level||1;}
 gain(id,n){const s=this.l.skills[id];if(!s||this.s.time-s.last<.8||s.level>=20)return;s.last=this.s.time;s.xp+=n;while(s.level<20&&s.xp>=skillNeed(s.level)){s.xp-=skillNeed(s.level);s.level++;this.g.notify(SKILLS[id]+' 숙련도 '+s.level+'단계','level');}if(s.level===20)s.xp=0;}
 objects(map=this.s.map){const result=[...this.g.world.objects,...this.g.world.lifeObjects,...(this.g.farm?.objects()||[]),...(this.g.pack?.objects()||[])].map(o=>o.id==='home-door'?{...o,label:this.l.home.owned&&this.l.home.type==='cottage'?'내 오두막 · 관리 / 입장':'오두막 안내 · 주택 매입'}:o.id==='property-door'?{...o,label:this.l.home.owned&&this.l.home.type!=='cottage'?homeSpec(this.s).name+' · 관리 / 입장':'개척지 주택 안내 · 매입'}:o.id==='home-exit'?{...o,x:homeSpec(this.s).w/2,y:homeSpec(this.s).h-34}:o.id==='home-deed'?{...o,x:homeSpec(this.s).w-80,y:homeSpec(this.s).h-60}:o).filter(o=>(o.map||'overworld')===map&&(o.plotIndex===undefined||o.plotIndex<this.l.farmSize));if(map==='home')for(const [i,o]of this.l.home.items.entries())result.push({...o,map:'home',id:'home-'+i,type:o.type==='furnace'?'forge':o.type==='bench'?'anvil':o.type==='chest'?'chest':o.type==='lamp'?'lamp':'home_'+o.type,interact:o.type==='chest'?'storage':o.type==='bench'||o.type==='furnace'||FACILITIES[o.type]?.station?'station':o.type==='bed'?'rest':'furniture',station:o.type==='furnace'?'furnace':o.type==='bench'?'bench':FACILITIES[o.type]?.station||null,label:FACILITIES[o.type].name+' · 사용'});return result;}
 nearest(){return this.objects().filter(o=>o.interact&&!this.depleted(o)&&Math.hypot(o.x-this.g.p.x,o.y-this.g.p.y)<43).sort((a,b)=>Math.hypot(a.x-this.g.p.x,a.y-this.g.p.y)-Math.hypot(b.x-this.g.p.x,b.y-this.g.p.y))[0];}
 depleted(o){return o.resource?this.s.harvested[o.id]?.until>this.s.time:this.l.nodes[o.id]?.until>this.s.time;}
 near(o,range=60){return o&&(o.map||'overworld')===this.s.map&&Math.hypot(o.x-this.g.p.x,o.y-this.g.p.y)<range;}
 nearStation(station){if(station==='field')return true;return this.objects().some(o=>this.near(o)&&((station==='bench'&&o.type==='bench')||o.station===station));}
 stationLevel(station){return this.s.map==='home'?this.l.home.levels[station]||1:this.l.town.support>=10?2:1;}
 isOpen(vendor){const def=VENDORS[vendor];if(!def)return false;const h=hourAt(this.s.time);return h>=def.open[0]&&h<def.open[1];}
 vendorNearby(vendor){return this.npcs.some(o=>o.npc===vendor&&this.near(o,64));}
 canTrade(vendor){return this.g.valley?.atCounter(vendor)?this.s.map==='place_inn'||this.isOpen(vendor):this.isOpen(vendor)&&this.vendorNearby(vendor);}
 update(dt){
  if(this.workFx){this.workFx.remaining-=dt;if(this.workFx.remaining<=0)this.workFx=null;}
  this.updateNpcs(dt);
  this.growCrops(dt);
  const j=this.l.job;
  if(j?.kind==='fish')this.g.activities?.resume();
  else if(j){
   if(j.map!==this.s.map||Math.hypot(this.g.p.x-j.x,this.g.p.y-j.y)>18){this.cancel('이동해서 작업을 멈췄습니다. 재료를 돌려받았습니다.');return;}
   j.remaining=Math.max(0,j.remaining-dt);
   if(j.remaining===0){this.l.job=null;if(this.finish({...j,grade:1})===false)this.refund(j);this.workFx={type:j.kind==='mine'?'mine':j.kind==='till'?'farm':'craft',remaining:.3};this.g.save(false);}
  }
 }
 growCrops(dt){for(const plot of Object.values(this.l.plots)){if(!plot.crop)continue;const c=CROPS[plot.crop];if(plot.growth>=c.time)continue;if(weatherAt(this.s.time)==='rain')plot.water=Math.min(120,plot.water+dt*4);if(this.s.farm?.upgrades.includes('irrigation')&&this.l.home.owned)plot.water=120;const wet=plot.water>0;plot.growth=Math.min(c.time,plot.growth+(wet?dt*(this.g.valley?.seasonGrowth(plot.crop)||1)*(1+(this.skill('farming')-1)*.035):0));plot.water=Math.max(0,plot.water-dt*.65);}}
 begin(kind,id,time,cost={},gold=0){if(this.l.job||this.g.activities?.busy){this.g.notify('진행 중인 작업을 먼저 마치세요.');return false;}if(!countCost(this.s.inventory,cost)||this.s.gold<gold||!Number.isSafeInteger(gold)||gold<0)return false;if(this.g.pack&&!this.g.pack.charge(this.g.pack.jobCost(kind,ALL_RECIPES.find(r=>r.id===id))))return false;spend(this.s.inventory,cost);this.s.gold-=gold;const duration=kind==='fish'?Math.max(.5,time):Math.max(.35,Math.min(2.4,time*.35));this.l.job={kind,id,remaining:duration,total:duration,cost:{...cost},gold,map:this.s.map,x:this.g.p.x,y:this.g.p.y,started:this.s.time};if(kind==='fish')this.g.activities?.start('fishing',{type:'job',id},this.jobLabel(this.l.job));this.g.event('work',{});this.g.event('sound',{name:kind==='mine'?'mine':kind==='fish'?'water':'craft'});this.g.save(false);return true;}
 jobLabel(j){const r=ALL_RECIPES.find(r=>r.id===j.id);return r?.name||this.g.world.lifeObjects.find(o=>o.id===j.id)?.label||'생활 작업';}
 refund(j){for(const [id,n]of Object.entries(j.cost))this.s.inventory[id]+=n;this.s.gold+=j.gold;}
 cancel(message){if(this.g.activities?.active?.source.type==='job'){this.g.activities.cancel();if(message)this.g.notify(message);return true;}const j=this.l.job;if(!j)return false;this.l.job=null;this.refund(j);if(message)this.g.notify(message);this.g.save(false);return true;}
 finish(j){
  if(j.kind==='mine'||j.kind==='gather'){
   const o=this.g.world.lifeObjects.find(o=>o.id===j.id);if(!o||this.depleted(o)||!this.near(o))return false;const id=o.metal?o.metal+'Ore':o.resourceId,skill=o.metal||id==='coal'||id==='stone'?'mining':'logging';
   const qty=Math.round((o.metal?6+(this.skill('mining')>=5?1:0):id==='stone'||id==='coal'?8:5)*(1+(j.grade||0)*.35));
   this.s.inventory[id]+=qty;this.l.nodes[o.id]={until:this.s.time+(o.metal?90+METALS[o.metal].tier*20:75)};
   this.gain(skill,o.metal?6+METALS[o.metal].tier*2:3);this.g.burst(o.x,o.y-10,22,o.metal?METALS[o.metal].color:'#b9bd82');this.g.notify(ITEMS[id].name+' +'+qty,j.kind==='mine'?'mine':'gather');return;
  }
  if(j.kind==='process'){
   const r=ALL_RECIPES.find(r=>r.id===j.id);if(!r)return false;
   if(r.slot){const serial=++this.l.serial,roll=stableRoll(serial),bonus=(this.skill('smithing')-1)*.035+(this.stationLevel('bench')-1)*.08+(j.grade||0)*.12;const quality=roll>.97-bonus/2?2:roll>.72-bonus?1:0;
    const affix=stableRoll(serial,3)>.78?Object.keys(AFFIXES)[Math.floor(stableRoll(serial,4)*4)]:null;this.l.gear.push({uid:'gear-'+serial,recipe:r.id,material:r.material,type:r.type,slot:r.slot,quality:Math.max((j.grade||0)>.9?1:0,quality),affix,upgrade:0});if(this.s.quest===1)this.s.quest=this.s.inventory.crystal?3:2;
    this.g.notify(QUALITIES[this.l.gear.at(-1).quality].name+' '+r.name+' 제작 완료','craft');
   }else{this.s.inventory[r.out]+=r.qty+(r.station==='press'&&this.s.farm?.upgrades.includes('press')?1:0);if(r.station==='press')this.s.farm.processed++;if(r.out==='sword'&&this.s.quest===1)this.s.quest=this.s.inventory.crystal?3:2;if(r.tool)this.l.tools.pick=Math.max(this.l.tools.pick,r.tool);this.g.notify(r.name+' 완료','craft');}
   this.gain(r.skill,r.xp);return;
  }
  if(j.kind==='upgrade'){const g=this.l.gear.find(g=>g.uid===j.id);if(!g)return false;g.upgrade++;this.gain('smithing',9+g.upgrade);this.g.notify('장비 강화 성공 · +'+g.upgrade,'craft');return;}
  if(j.kind==='fish'){const serial=++this.l.serial,rare=stableRoll(serial,19)<.07+(this.skill('fishing')-1)*.02;const id=rare?'rareFish':'fish';this.s.inventory[id]+=2+((j.grade||0)>.85?1:0);this.gain('fishing',6);this.g.burst(this.g.p.x-10,this.g.p.y,12,'#b4d5c4');this.g.notify(ITEMS[id].name+' 낚시 성공!','water');return;}
  if(j.kind==='till'){this.l.plots[j.id]={tilled:true,crop:null,growth:0,water:0};this.g.notify('밭을 개간했습니다. 씨앗을 심을 수 있습니다.','gather');}
 }
 startRecipe(id){const r=ALL_RECIPES.find(r=>r.id===id);const reason=this.recipeReason(r);if(reason){this.g.notify(reason);return false;}const duration=r.time/(1+(this.skill(r.skill)-1)*.06+(this.stationLevel(r.station)-1)*.15);return this.begin('process',r.id,duration,r.cost);}
 recipeReason(r){if(!r)return'존재하지 않는 레시피입니다.';if(r.material&&materialReason(this.s,r.material,true))return materialReason(this.s,r.material,true);if(r.stage&&stageAt(this.s)<r.stage)return '챕터 '+r.stage+' 보스 처치 필요';if(r.out&&itemReason(this.s,r.out))return itemReason(this.s,r.out);if(r.id==='sword'&&this.s.inventory.sword)return'이미 청철 장검을 보유하고 있습니다.';if(!this.nearStation(r.station))return({bench:'작업대',furnace:'용광로',cookfire:'화덕',press:'집 안 가공기'})[r.station]+' 가까이에서 작업하세요.';if(r.unlock&&!this.l.unlocked.includes(r.unlock))return'도안이 잠겨 있습니다. 의뢰나 탐험으로 발견하세요.';if(this.skill(r.skill)<(r.level||1))return SKILLS[r.skill]+' 숙련도 '+r.level+' 필요';if(r.tool&&this.l.tools.pick>=r.tool)return'이미 같거나 좋은 곡괭이를 보유하고 있습니다.';if(r.slot&&this.l.gear.length>=300)return'장비 보관 한도입니다. 일부를 판매하세요.';if(!countCost(this.s.inventory,r.cost))return'재료가 부족합니다.';if(this.l.job)return'다른 작업이 진행 중입니다.';return'';}
 mine(o){const dx=o.x-this.g.p.x,dy=o.y-this.g.p.y;this.g.p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2;if(this.depleted(o))return false;if(o.metal&&materialReason(this.s,o.metal)){this.g.notify(materialReason(this.s,o.metal));return false;}if(o.metal&&this.l.tools.pick<METALS[o.metal].tier){this.g.notify(METALS[o.metal].name+' 채굴에는 '+METALS[o.metal].tier+'등급 곡괭이가 필요합니다.');return false;}const time=(o.metal?METALS[o.metal].time:o.resourceId==='stone'?1.8:2)/(1+this.l.tools.pick*.25+(this.skill('mining')-1)*.04);return this.begin('mine',o.id,time);}
 interact(o){
  if(!o)return false;
  if(o.vendor||o.npc){this.g.event('dialog',{type:o.vendor||o.npc});return true;}
  const type=o.interact;
  if(type==='pickup'){this.g.pack?.pickup(o.drop);return true;}if(type==='placeEnter'){this.g.valley.enter(o.place);return true;}if(type==='placeExit'){this.g.valley.exit(o.place);return true;}if(type==='shopCounter'){this.g.event('lifePanel',{type:'vendor',id:o.shop});return true;}if(type==='valleySign'){this.g.notify(o.text);return true;}if(type==='discovery'){this.g.valley.discover(o.discovery);return true;}if(['shipping','sleep','archive','greenhouse'].includes(type)){this.g.event('valleyPanel',{type:type==='sleep'?'rest':type});return true;}
  if(type==='adventure'){this.g.event('adventurePanel',{});return true;}if(type==='rpgGate'){this.g.adventure.enter(o.target);return true;}if(type==='rpgExit'){this.g.adventure.exit(o.target);return true;}if(type==='ranch'||type==='animal'){this.g.event('ranchPanel',{id:o.animal});return true;}
  if(type==='mining'){this.mine(o);return true;}if(type==='forage'){this.begin('gather',o.id,1.5);return true;}
  if(type==='station'){this.g.event('lifePanel',{type:'station',id:o.station});return true;}
  if(type==='plot'){this.g.event('lifePanel',{type:'plot',id:o.id});return true;}
  if(type==='farmManage'){this.g.event('lifePanel',{type:'farm'});return true;}
  if(type==='fishing'){this.begin('fish',o.id,6/(1+(this.skill('fishing')-1)*.06),{bait:1});if(!this.s.inventory.bait&&!this.l.job)this.g.notify('미끼가 없습니다. 상인에게 구입하세요.');return true;}
  if(type==='house'||type==='storage'){this.g.event('lifePanel',{type:type==='house'?'house':'storage'});return true;}
  if(type==='rest'){this.g.event('valleyPanel',{type:'rest'});return true;}
  if(type==='furniture'){this.g.notify('손수 꾸민 집이 따뜻합니다.');return true;}
  const travel={mineEntry:['mine1',480,560],mineExit:['overworld',1660,389],deepDown:['mine2',160,522],deepUp:['mine1',800,190],homeExit:['overworld',homeDoor(this.s).x,homeDoor(this.s).y]};
  if(travel[type]){const [map,x,y]=travel[type];this.travel(map,x,y);return true;}
  if(type==='treasure'||type==='supplyCache'){if(this.l.treasures[o.id]){this.g.notify('이미 회수한 보급품입니다.');return true;}this.l.treasures[o.id]=true;if(type==='treasure'){this.s.inventory.relic+=3;this.s.inventory.ancientShard+=2;this.unlock('mythril');this.g.notify('미스릴 도안 · 고대 보물 3개 · 고대 파편 2개 발견!','level');}else{this.s.inventory.coal+=12;this.g.notify('갱도 보급품 · 석탄 12개');}this.g.save(false);return true;}
  return false;
 }
 travel(map,x,y){this.g.activities?.cancel();this.cancel();this.placement=null;this.movingIndex=null;this.s.map=map;Object.assign(this.g.p,{x,y});this.g.attack=null;this.g.projectiles=[];if(this.g.adventure)this.g.adventure.hazards=[];this.g.invulnerable=1.5;this.g.event('travel',{});this.g.save(false);}
 unlock(id){if(!this.l.unlocked.includes(id)){this.l.unlocked.push(id);this.g.notify('새 레시피 발견!','level');}}
 useBook(){if(this.l.unlocked.includes('silver')||this.s.inventory.silverBook<1)return false;this.s.inventory.silverBook--;this.unlock('silver');this.g.save(false);return true;}
 plotObject(id){return this.objects('overworld').find(o=>o.id===id&&o.interact==='plot');}
 plotAction(id,action,crop){const o=this.plotObject(id);if(!this.near(o,55)||this.l.job||this.g.activities?.busy)return false;const dx=o.x-this.g.p.x,dy=o.y-this.g.p.y;this.g.p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2;let p=this.l.plots[id];if(action==='till'){if(p?.tilled)return false;return this.begin('till',id,1.5);}
  if(!p?.tilled)return false;
  if(action==='plant'){const c=CROPS[crop];if(!c||itemReason(this.s,c.seed)||p.crop||this.s.inventory[c.seed]<1)return false;if(this.g.pack&&!this.g.pack.charge(1))return false;this.s.inventory[c.seed]--;Object.assign(p,{crop,growth:0,water:0});this.g.notify(c.name+' 씨앗을 심었습니다.','gather');}
  else if(action==='water'){if(!p.crop||p.water>=100)return false;if(this.g.pack&&!this.g.pack.charge(1))return false;p.water=120;this.g.notify('물을 주었습니다. 젖은 동안 작물이 자랍니다.','water');}
  else if(action==='harvest'){if(!p.crop||p.growth<CROPS[p.crop].time)return false;if(this.g.pack&&!this.g.pack.charge(2))return false;if(!this.collectCrop(id,1))return false;}
  else return false;this.workFx={type:action==='water'?'water':'farm',remaining:.7};this.g.burst(o.x,o.y-3,9,action==='water'?'#a1c8bd':'#d7c58b');this.g.save(false);return true;
 }
 collectLegacy(id,grade=1){const o=[...this.g.world.objects,...this.g.world.lifeObjects].find(o=>o.id===id&&o.resource);if(!o||this.l.job||this.g.activities?.busy||this.g.gatherCooldown>0||this.depleted(o)||!this.near(o,55))return false;if(this.g.pack&&!this.g.pack.charge(o.resource==='wood'?5:o.resource==='ore'?6:2))return false;const qty=Math.round((o.resource==='wood'?8:o.resource==='ore'?6:4)*(1+grade*.4));this.s.inventory[o.resource]+=qty;this.s.harvested[id]={hits:0,until:this.s.time+90};this.g.gatherCooldown=.4;this.workFx={type:o.resource==='ore'?'mine':o.resource==='wood'?'logging':'farm',remaining:.5};const dx=o.x-this.g.p.x,dy=o.y-this.g.p.y;this.g.p.dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2;this.gain(o.resource==='wood'?'logging':o.resource==='ore'?'mining':'farming',o.resource==='wood'?7:5);this.g.gainXp(3);this.g.burst(o.x,o.y-10,18,'#dbc78c');this.g.notify(ITEMS[o.resource].name+' +'+qty,o.resource==='ore'?'mine':'gather');this.g.save(false);return true;}
 collectCrop(id,grade=0){const o=this.plotObject(id),p=this.l.plots[id];if(!this.near(o,55)||!p?.crop||p.growth<CROPS[p.crop].time)return false;const plots=[o];if(this.s.farm?.upgrades.includes('harvestRig'))for(const target of this.objects('overworld')){const plot=this.l.plots[target.id];if(plots.length>=4)break;if(target.id!==id&&target.interact==='plot'&&Math.hypot(target.x-o.x,target.y-o.y)<55&&plot?.crop&&plot.growth>=CROPS[plot.crop].time)plots.push(target);}for(const obj of plots){const plot=this.l.plots[obj.id],c=CROPS[plot.crop],qty=Math.round((c.yield+(this.skill('farming')>=4?1:0))*(1+grade*.35));this.s.inventory[c.item]+=qty;Object.assign(plot,{crop:null,growth:0,water:0});this.gain('farming',7);this.g.notify(c.name+' +'+qty+' · 수확 '+plots.length+'칸','gather');}return true;}
 expandFarm(){const nearby=this.objects().some(o=>o.interact==='farmManage'&&this.near(o));if(!nearby||this.l.farmSize>=farmLimit(this.s)||this.s.gold<60||this.g.activities?.busy)return false;this.s.gold-=60;this.l.farmSize=Math.min(farmLimit(this.s),this.l.farmSize+4);this.g.notify('텃밭을 '+this.l.farmSize+'칸으로 넓혔습니다.');this.g.save(false);return true;}
 gear(uid){return this.l.gear.find(g=>g.uid===uid);}
 loadout(){return Object.fromEntries(Object.entries(this.l.equipped).map(([slot,id])=>[slot,this.gear(id)]));}
 weapon(){return this.gear(this.l.equipped.weapon);}
 profile(){const g=this.weapon();return g?WEAPONS[g.type]:WEAPONS.sword;}
 offenseBonus(){return Object.entries(this.loadout()).filter(([slot,g])=>slot!=='weapon'&&g?.affix==='keen').length*3;}
 attackSpeed(){return Object.values(this.loadout()).some(g=>g?.affix==='swift')?.92:1;}
 weaponDamage(){const g=this.weapon();return g?Math.max(1,Math.round(gearStats(g).damage*this.profile().damage))+(this.g.p.level-1)*2+this.offenseBonus():null;}
 defense(){return Object.entries(this.loadout()).reduce((n,[slot,g])=>n+(g&&slot!=='weapon'?gearStats(g).defense:0)+(g?.affix==='sturdy'&&slot==='weapon'?2:0),0);}
 bonusHp(){return Object.values(this.loadout()).filter(g=>g?.affix==='vital').length*8;}
 equipReason(g){return g?materialReason(this.s,g.material,true)||((GEAR_RECIPES.find(r=>r.id===g.recipe)?.stage||0)>stageAt(this.s)?'이 장비의 보스 해금 조건이 필요합니다.':''):'';}
 equip(uid){const g=this.gear(uid);if(g&&this.l.equipped[g.slot]!==uid&&this.equipReason(g)){this.g.notify(this.equipReason(g));return false;}if(!g||this.l.home.storedGear.includes(uid)||this.l.job?.id===uid)return false;this.l.equipped[g.slot]=this.l.equipped[g.slot]===uid?null:uid;this.g.p.hp=Math.min(this.g.p.hp,this.g.maxHp);this.g.notify(GEAR_TYPES[g.type].name+' '+(this.l.equipped[g.slot]?'장착':'해제'));this.g.save(false);return true;}
 upgrade(uid){const g=this.gear(uid);if(!g||this.equipReason(g)||g.upgrade>=5||this.l.home.storedGear.includes(uid)||!this.nearStation('bench'))return false;return this.begin('upgrade',uid,4+g.upgrade,{[g.material+'Bar']:2+g.upgrade,coal:1},20*(g.upgrade+1));}
 price(vendor,id,side){return quote(this.s,vendor,id,side,ITEMS);}
 tradeTotal(vendor,id,side,qty=1){if(!Number.isInteger(qty)||qty<1||qty>99)return 0;const m=ensureMarket(this.s,vendor),temp={...this.s,life:{...this.l,markets:{...this.l.markets,[vendor]:structuredClone(m)}}};let total=0;for(let i=0;i<qty;i++){total+=quote(temp,vendor,id,side,ITEMS);addPressure(temp,vendor,id,side==='sell'?1:-.25);}return total;}
 trade(vendor,id,side,qty=1){if(!this.canTrade(vendor)||!Number.isSafeInteger(qty)||qty<1||qty>99||(this.l.job||this.g.activities?.busy))return false;const m=ensureMarket(this.s,vendor),price=this.price(vendor,id,side);if(!price)return false;
  // Process unit by unit in a temporary state to price every unit against marginal demand.
  const before=structuredClone(m);let total=0;
  if(side==='buy'){if(this.g.pack&&!this.g.pack.canAdd(id)){this.g.notify('가방이 가득 찼습니다. 물품을 판매하거나 가방을 확장하세요.');return false;}if(itemReason(this.s,id)||(m.stock[id]||0)<qty)return false;const tool=({copperPick:1,ironPick:2,steelPick:3})[id];if(tool&&(qty!==1||this.l.tools.pick>=tool||tool>=2&&stageAt(this.s)<(tool===3?1:0)))return false;}
  else if(side==='sell'){if((this.s.inventory[id]||0)<qty)return false;}
  else return false;
  for(let i=0;i<qty;i++){total+=this.price(vendor,id,side);addPressure(this.s,vendor,id,side==='sell'?1:-.25);}
  if((side==='buy'&&this.s.gold<total)||(side==='sell'&&(m.cash<total||this.s.gold+total>=1e9))){this.l.markets[vendor]=before;return false;}
  if(side==='buy'){this.s.gold-=total;m.cash+=total;m.stock[id]-=qty;this.s.inventory[id]+=qty;const tool=({copperPick:1,ironPick:2,steelPick:3})[id];if(tool)this.l.tools.pick=Math.max(this.l.tools.pick,tool);}
  else{this.s.inventory[id]-=qty;this.s.gold+=total;m.cash-=total;this.l.town.support+=Math.floor(total/25);}
  this.gain('commerce',.5+Math.min(3,total/35));this.g.event('sound',{name:'coin'});this.g.save(false);return true;
 }
 gearOfferReason(vendor,id){const r=GEAR_RECIPES.find(r=>r.id===id);if(vendor!=='smith'||!r||r.special)return'상점에서 판매하지 않는 장비입니다.';const reason=materialReason(this.s,r.material,true);if(reason)return reason;if(!this.canTrade(vendor))return'브람의 영업 시간에 가까이에서 거래하세요.';if((ensureMarket(this.s,vendor).gearSold[id]||0)>=2)return'오늘 재고 소진';if(this.l.gear.length>=300)return'장비 보관 한도';if(this.s.gold<gearBuyPrice(id))return'금화 부족';if(this.l.job||this.g.activities.busy)return'작업 중입니다';return'';}
 buyGear(vendor,id){if(this.gearOfferReason(vendor,id))return false;const r=GEAR_RECIPES.find(r=>r.id===id),price=gearBuyPrice(id),m=ensureMarket(this.s,vendor);this.s.gold-=price;m.cash+=price;m.gearSold[id]=(m.gearSold[id]||0)+1;const gear={uid:'gear-'+(++this.l.serial),recipe:r.id,material:r.material,type:r.type,slot:r.slot,quality:0,affix:null,upgrade:0};this.l.gear.push(gear);if(this.s.quest===1)this.s.quest=this.s.inventory.crystal?3:2;this.gain('commerce',2);this.g.notify('장비 구매 · '+r.name+' (소지품에서 장착)','coin');this.g.save(false);return true;}
 gearPrice(vendor,g){return quote(this.s,vendor,g.type,'sell',ITEMS,gearValue(g));}
 sellGear(vendor,uid){const g=this.gear(uid);if(!g||!this.canTrade(vendor)||this.l.home.storedGear.includes(uid)||Object.values(this.l.equipped).includes(uid)||(this.l.job||this.g.activities?.busy))return false;const price=this.gearPrice(vendor,g),m=ensureMarket(this.s,vendor);if(m.cash<price||this.s.gold+price>=1e9)return false;this.l.gear=this.l.gear.filter(g=>g.uid!==uid);m.cash-=price;this.s.gold+=price;addPressure(this.s,vendor,g.type,1);this.l.town.support+=Math.floor(price/25);this.gain('commerce',2);this.g.notify('제작 장비 판매 · '+price+' G','coin');this.g.save(false);return true;}
 order(vendor,action){if(!this.canTrade(vendor)||(this.l.job||this.g.activities?.busy))return false;const def=ORDERS[vendor],day=dayAt(this.s.time);let order=this.l.orders[vendor];if(!order)order=this.l.orders[vendor]={active:false,done:-1};
  if(action==='accept'){if(order.active||order.done===day)return false;order.active=true;this.g.notify('의뢰 수락 · '+def.name);}
  else if(action==='deliver'){if(!order.active||order.done===day||!countCost(this.s.inventory,def.cost))return false;spend(this.s.inventory,def.cost);order.active=false;order.done=day;this.s.gold+=def.gold;this.l.town.support+=2;this.gain(def.skill,def.xp);if(def.unlock)this.unlock(def.unlock);this.g.notify('납품 완료 · '+def.gold+' G','coin');}
  else return false;this.g.save(false);return true;
 }
 nearDeed(){return this.s.map==='home'&&this.l.home.owned||this.objects().some(o=>o.interact==='house'&&this.near(o));}
 buyHome(type='cottage'){const h=HOMES[type];if(!Object.hasOwn(HOMES,type)||!this.nearDeed()||this.l.home.owned&&h.price<=homeSpec(this.s).price||this.l.job||this.g.activities?.busy)return false;const price=homeUpgradePrice(this.s,type);if(this.s.gold<price)return false;this.s.gold-=price;this.l.home.owned=true;this.l.home.type=type;this.furnishHome();this.l.farmSize=Math.max(this.l.farmSize,h.plots);this.g.world.maps.home=homeGround(type);if(this.s.map==='home'){this.g.p.x=h.w/2;this.g.p.y=h.h-60;this.g.event('travel',{});}this.g.notify(h.name+'을 마련했습니다! 농지 '+this.l.farmSize+'칸','level');this.g.save(false);return true;}
 furnishHome(){const h=this.l.home;if(!h.owned)return;const spec=homeSpec(this.s);for(const type of ['chest','bed']){if(h.items.length>=spec.decor)break;if(h.items.some(o=>o.type===type))continue;const f=FACILITIES[type];outer:for(let y=144;y<spec.h-90;y+=80)for(const x of[112,spec.w-112]){if(h.items.some(o=>{const z=FACILITIES[o.type];return Math.abs(o.x-x)<(f.w+z.w)/2+8&&y>o.y-z.h-8&&y-f.h<o.y+8;}))continue;h.items.push({type,x,y});break outer;}}if(this.s.pack)this.s.pack.furnished=true;}
 enterHome(){const door=homeDoor(this.s);if(!this.l.home.owned||this.s.map!=='overworld'||Math.hypot(this.g.p.x-door.x,this.g.p.y-door.y)>=65)return false;const h=homeSpec(this.s);this.travel('home',h.w/2,h.h-60);return true;}
 canPlace(type,x,y){const f=FACILITIES[type];if(this.s.map!=='home'||!this.l.home.owned||!f||this.l.job||this.movingIndex===null&&this.l.home.items.length>=homeSpec(this.s).decor)return false;if(f.unique&&this.l.home.items.some((o,i)=>o.type===type&&i!==this.movingIndex))return false;
  if(x-f.w/2<52||x+f.w/2>homeSpec(this.s).w-52||y-f.h<84||y>homeSpec(this.s).h-72||Math.abs(x-homeSpec(this.s).w/2)<55&&y>homeSpec(this.s).h-120||Math.hypot(x-this.g.p.x,y-this.g.p.y)<35)return false;
  return !this.l.home.items.some((o,i)=>{if(i===this.movingIndex)return false;const z=FACILITIES[o.type];return Math.abs(x-o.x)<(f.w+z.w)/2+6&&y>o.y-z.h-6&&y-f.h<o.y+6;});
 }
 place(type,x,y){x=Math.round(x/16)*16;y=Math.round(y/16)*16;const f=FACILITIES[type];if(!f||!this.canPlace(type,x,y))return false;if(this.movingIndex!==null){const moving=this.l.home.items[this.movingIndex];if(!moving||moving.type!==type)return false;Object.assign(moving,{x,y});this.movingIndex=null;this.placement=null;this.g.notify('가구 위치를 옮겼습니다.');this.g.save(false);return true;}if(this.s.gold<f.gold||!countCost(this.s.inventory,f.cost))return false;spend(this.s.inventory,f.cost);this.s.gold-=f.gold;this.l.home.items.push({type,x,y});this.placement=null;this.g.notify(f.name+' 설치 완료','craft');this.g.save(false);return true;}
 upgradeFacility(type){const home=this.l.home,level=home.levels[type];if(this.s.map!=='home'||!home.items.some(o=>o.type===type)||!level||level>=3||this.s.gold<50*level||!countCost(this.s.inventory,{ironBar:2*level,stone:4*level})||(this.l.job||this.g.activities?.busy))return false;spend(this.s.inventory,{ironBar:2*level,stone:4*level});this.s.gold-=50*level;home.levels[type]++;this.g.notify(FACILITIES[type].name+' '+home.levels[type]+'단계 업그레이드','craft');this.g.save(false);return true;}
 storageCapacity(){return 24+(this.l.home.levels.chest-1)*16;}
 storageUsed(){return Object.values(this.l.home.storage).filter(n=>n>0).length+this.l.home.storedGear.length;}
 nearChest(){return this.s.map==='home'&&this.l.home.owned;}
 transfer(id,qty,direction){if(!this.nearChest()||this.l.job||!Number.isSafeInteger(qty)||qty<1||qty>999||['sword','copperPick','ironPick','steelPick'].includes(id)||!ITEMS[id])return false;const src=direction==='deposit'?this.s.inventory:this.l.home.storage,dst=direction==='deposit'?this.l.home.storage:this.s.inventory;if(!['deposit','withdraw'].includes(direction)||(src[id]||0)<qty||direction==='deposit'&&this.storageUsed()+(dst[id]>0?0:1)>this.storageCapacity())return false;if(direction==='withdraw'&&this.g.pack&&!this.g.pack.canAdd(id))return false;src[id]-=qty;dst[id]=(dst[id]||0)+qty;this.g.save(false);return true;}
 transferGear(uid,direction){if(!this.nearChest()||!this.gear(uid)||this.l.job||Object.values(this.l.equipped).includes(uid))return false;const stored=this.l.home.storedGear;if(direction==='deposit'){if(stored.includes(uid)||this.storageUsed()>=this.storageCapacity())return false;stored.push(uid);}else if(direction==='withdraw'){if(!stored.includes(uid))return false;this.l.home.storedGear=stored.filter(id=>id!==uid);}else return false;this.g.save(false);return true;}
 updateNpcs(dt){for(const o of this.npcs){const open=this.isOpen(o.npc),target=open?o.work:o.home;o.working=open;
   if(o.map!==target.map){const portal=o.map==='mine1'?{x:480,y:560}:{x:1660,y:389};if(Math.hypot(o.x-portal.x,o.y-portal.y)<18){o.map=target.map;o.x=o.map==='mine1'?480:1660;o.y=o.map==='mine1'?560:389;o.route=null;}else this.walkNpc(o,portal,dt);}
   else this.walkNpc(o,target,dt);
  }}
 walkNpc(o,target,dt){o.moving=false;if(Math.hypot(o.x-target.x,o.y-target.y)<4){o.route=null;return;}const key=target.x+','+target.y;
  if(!o.route||o.routeKey!==key){o.route=this.npcRoute(o,target);o.routeKey=key;}
  const next=o.route?.[0];if(!next)return;const dx=next.x-o.x,dy=next.y-o.y,len=Math.hypot(dx,dy);if(len<2){o.route.shift();return;}const d=Math.min(len,dt*30);o.x+=dx/len*d;o.y+=dy/len*d;o.moving=d>.001;o.walk=(o.walk||0)+d/6;o.dir=Math.abs(dx)>Math.abs(dy)?dx>0?1:3:dy>0?0:2;
 }
 npcRoute(o,target){const size=mapSize(o.map,this.s),step=16,cols=Math.ceil(size.w/step),rows=Math.ceil(size.h/step),start=Math.round(o.y/step)*cols+Math.round(o.x/step),queue=[start],prev=new Map([[start,-1]]);let end=-1;
  const obstacles=[...this.g.world.objects,...this.g.world.lifeObjects];for(let k=0;k<queue.length;k++){const n=queue[k],x=n%cols*step,y=Math.floor(n/cols)*step;if(Math.hypot(x-target.x,y-target.y)<12){end=n;break;}for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx*step,ny=y+dy*step,nn=Math.round(ny/step)*cols+Math.round(nx/step);if(nx<32||ny<50||nx>size.w-32||ny>size.h-32||prev.has(nn)||blocked(nx,ny,o.map,obstacles,this.s,6))continue;prev.set(nn,n);queue.push(nn);}}
  if(end<0)return[];const route=[];for(let n=end;n!==-1;n=prev.get(n))route.push({x:n%cols*step,y:Math.floor(n/cols)*step});return route.reverse();
 }
}
