import {HOMES,homeSpec,farmLimit} from './housing.js';
// Serializable definitions shared by simulation, UI and tests. No DOM dependencies.
export const METALS = {
  copper: {name:'구리', tier:0, time:2.4, value:4, barValue:12, color:'#c68a61'},
  iron: {name:'철', tier:1, time:3.5, value:7, barValue:21, color:'#a2b2ae'},
  silver: {name:'은', tier:2, time:4.5, value:13, barValue:39, color:'#d4ddd3'},
  gold: {name:'금', tier:2, time:5.5, value:20, barValue:60, color:'#ebca72'},
  mythril: {name:'미스릴', tier:3, time:7, value:35, barValue:105, color:'#87d5d1'}
};
export const CROPS = {
  wheat:{name:'밀', seed:'wheatSeed', item:'wheat', time:55, yield:6, value:6},
  carrot:{name:'당근', seed:'carrotSeed', item:'carrot', time:80, yield:8, value:9},
  melon:{name:'달빛참외', seed:'melonSeed', item:'melon', time:125, yield:6, value:22}
};
export const SKILLS={mining:'채광',smelting:'제련',smithing:'대장장이',logging:'벌목',farming:'농사',fishing:'낚시',cooking:'요리',commerce:'상업'};
export const WEAPONS={
  sword:{name:'검', damage:1, cooldown:.40, range:49, arc:1.15, stamina:5, desc:'균형 잡힌 베기'},
  greatsword:{name:'대검', damage:1.65, cooldown:.88, range:65, arc:1.65, stamina:14, desc:'넓은 범위 · 느린 회복 · 높은 기력 소모'},
  dagger:{name:'단검', damage:.65, cooldown:.22, range:33, arc:.7, stamina:3, desc:'빠른 찌르기 · 짧은 사거리'},
  bow:{name:'활', damage:.85, cooldown:.65, range:270, arc:0, stamina:8, projectile:'arrow', desc:'긴 사거리 · 단일 표적 · 화살 자동 보충'},
  staff:{name:'지팡이', damage:1.05, cooldown:.90, range:190, arc:0, stamina:18, projectile:'spark', desc:'폭발 마법 · 기력 소모 · 느린 발사'}
};
export const GEAR_TYPES={...Object.fromEntries(Object.entries(WEAPONS).map(([k,v])=>[k,{name:v.name,slot:'weapon'}])),helmet:{name:'투구',slot:'head'},armor:{name:'갑옷',slot:'body'},gloves:{name:'장갑',slot:'hands'},boots:{name:'신발',slot:'feet'}};
export const QUALITIES=[{name:'보통',mult:1},{name:'정교',mult:1.15},{name:'명장',mult:1.32}];
export const AFFIXES={keen:{name:'예리함',desc:'공격력 +3'},sturdy:{name:'수호',desc:'방어력 +2'},swift:{name:'신속',desc:'공격 회복 8% 단축'},vital:{name:'생명',desc:'최대 체력 +8'}};
export const LIFE_ITEMS={};
const item=(id,name,icon,value,desc='')=>LIFE_ITEMS[id]={name,icon,value,desc};
for(const [id,m] of Object.entries(METALS)){item(id+'Ore',m.name+' 광석',id+'Ore',m.value,'곡괭이 '+m.tier+'등급 이상 · 제련 재료');item(id+'Bar',m.name+' 주괴',id+'Bar',m.barValue,'용광로에서 제련한 금속');}
for(const [id,c] of Object.entries(CROPS)){item(c.seed,c.name+' 씨앗','seed',id==='melon'?12:id==='carrot'?5:3,'개간한 밭에 심으세요');item(id,c.name,id,c.value,`성장 ${c.time}초 · 기본 수확 ${c.yield}개`);}
for(const [id,n,ico,value,desc] of [
 ['stone','석재','stone',2,'용광로와 집 시설 재료'],['coal','석탄','coal',3,'광석 2개와 석탄 1개로 주괴 2개 제련'],['plank','가공 목재','plank',7,'목재 2개를 작업대에서 가공'],['mushroom','숲버섯','mushroom',5,'요리 재료'],['apple','야생 사과','apple',6,'회복 음식과 요리 재료'],['fish','은빛 송어','fish',10,'호수와 강에서 낚시'],['rareFish','황금 농어','rareFish',28,'낚시 숙련도에 따라 확률 증가'],['bait','낚시 미끼','bait',2,'낚시 시도당 하나 소비'],['pelt','짐승 가죽','pelt',8,'늑대 부산물 · 가구 재료'],['gel','슬라임 진액','gel',5,'몬스터 부산물'],['ancientShard','고대 파편','ancientShard',25,'깊은 광산의 수호자 · 특수 장비 재료'],['relic','고대 보물','relic',55,'던전 보물 · 지역별 가격 차이'],['grilledFish','허브 생선구이','grilledFish',24,'체력 60 · 기력 30 회복'],['stew','농부의 스튜','stew',35,'체력 75 · 기력 60 회복'],['moonFeast','달빛 만찬','moonFeast',90,'체력과 기력 완전 회복'],['copperPick','구리 곡괭이','pickaxe',0,'등급 1 · 철 채굴 가능'],['ironPick','철 곡괭이','ironPick',0,'등급 2 · 은·금 채굴 가능'],['steelPick','은강 곡괭이','steelPick',0,'등급 3 · 미스릴 채굴 가능'],['silverBook','은세공 도안','book',50,'사용하면 은 장비 레시피 해금']
])item(id,n,ico,value,desc);
export const PROCESS_RECIPES=[
 {id:'potion',name:'회복 물약',out:'potion',qty:2,cost:{herb:2},station:'field',skill:'cooking',time:3,xp:5,legacy:true},
 {id:'food',name:'숲의 여행빵',out:'food',qty:2,cost:{herb:1,wood:1},station:'field',skill:'cooking',time:3,xp:5,legacy:true},
 {id:'sword',name:'청철 장검',out:'sword',qty:1,cost:{wood:6,ore:4},station:'bench',skill:'smithing',time:4,xp:12,legacy:true},
 {id:'plank',name:'목재 가공',out:'plank',qty:3,cost:{wood:2},station:'bench',skill:'logging',time:2,xp:4},
 ...Object.entries(METALS).map(([id,m])=>({id:id+'Bar',name:m.name+' 제련',out:id+'Bar',qty:2,cost:{[id+'Ore']:2,coal:1},station:'furnace',skill:'smelting',time:3+m.tier,level:1, xp:5+m.tier*2})),
 {id:'copperPick',name:'구리 곡괭이',out:'copperPick',qty:1,cost:{copperBar:3,wood:2},station:'bench',skill:'smithing',time:5,xp:12,tool:1},
 {id:'ironPick',name:'철 곡괭이',out:'ironPick',qty:1,cost:{ironBar:3,plank:2},station:'bench',skill:'smithing',time:6,xp:15,tool:2},
 {id:'steelPick',name:'은강 곡괭이',out:'steelPick',qty:1,cost:{ironBar:4,silverBar:2,plank:2},station:'bench',skill:'smithing',time:8,xp:20,tool:3},
 {id:'grilledFish',name:'허브 생선구이',out:'grilledFish',qty:1,cost:{fish:1,herb:1},station:'cookfire',skill:'cooking',time:3,xp:7},
 {id:'stew',name:'농부의 스튜',out:'stew',qty:1,cost:{carrot:2,wheat:1,mushroom:1},station:'cookfire',skill:'cooking',time:4,xp:10},
 {id:'moonFeast',name:'달빛 만찬',out:'moonFeast',qty:1,cost:{melon:1,rareFish:1,apple:1},station:'cookfire',skill:'cooking',time:6,xp:16,unlock:'feast',level:2}
];
// All weapon families exist in every material; their attack profiles stay distinct.
export const GEAR_RECIPES=Object.entries(METALS).flatMap(([material,m])=>Object.entries(GEAR_TYPES).map(([type,t])=>({
 id:material+'_'+type,name:m.name+' '+t.name,material,type,slot:t.slot,station:'bench',skill:'smithing',level:material==='mythril'?2:1,unlock:material==='mythril'?'mythril':material==='silver'||material==='gold'?'silver':null,
 cost:{[material+'Bar']:type==='greatsword'||type==='armor'?4:2,...(t.slot==='weapon'?{plank:type==='staff'?3:1}:{pelt:1}),...(material==='mythril'?{ancientShard:1}:{})},time:5+m.tier*2,xp:10+m.tier*3
})));
export const ALL_RECIPES=[...PROCESS_RECIPES,...GEAR_RECIPES];
export const FACILITIES={
 chest:{name:'보관함',cost:{plank:4,wood:4},gold:15,w:32,h:24,unique:true},
 bench:{name:'개인 제작대',cost:{plank:6,ironBar:2},gold:25,w:48,h:32,unique:true},
 furnace:{name:'개인 용광로',cost:{stone:8,copperBar:2},gold:30,w:48,h:48,unique:true},
 bed:{name:'참나무 침대',cost:{plank:4,pelt:2},gold:12,w:32,h:48,unique:true},
 rug:{name:'수놓은 양탄자',cost:{pelt:2,herb:1},gold:8,w:48,h:32},
 lamp:{name:'황동 등불',cost:{copperBar:1,plank:1},gold:5,w:16,h:16}
};
export const VENDORS={
 mira:{name:'미라',role:'마을 잡화점',region:'village',open:[8,18],cash:600,stock:{potion:12,food:20,coal:24,bait:30,wheatSeed:16,carrotSeed:10,melonSeed:6,silverBook:1}},
 smith:{name:'대장장이 브람',role:'강변 대장간',region:'village',open:[7,20],cash:850,stock:{coal:30,ironOre:12,copperOre:16,silverBook:1}},
 farmer:{name:'농부 엘린',role:'햇살 농장',region:'farm',open:[6,19],cash:450,stock:{wheatSeed:24,carrotSeed:16,melonSeed:8,wheat:24,carrot:16,melon:6,food:10,bait:15}},
 miner:{name:'광부 도란',role:'광산 보급소',region:'mine',open:[7,19],cash:700,stock:{coal:35,potion:8,food:12}},
 fisher:{name:'어부 세라',role:'호숫가 교역소',region:'lake',open:[5,21],cash:600,stock:{bait:40,fish:12,rareFish:3,food:8,herb:12}}
};
export const ORDERS={
 mira:{name:'마을 보급 목재',cost:{wood:9},gold:25,skill:'logging',xp:8},
 smith:{name:'대장간의 첫 납품',cost:{copperBar:3},gold:40,skill:'smithing',xp:12,unlock:'silver'},
 farmer:{name:'수확 축제의 채소',cost:{carrot:6},gold:50,skill:'farming',xp:12,unlock:'feast'},
 miner:{name:'갱도 지지대',cost:{plank:4,ironBar:2},gold:90,skill:'mining',xp:12},
 fisher:{name:'저녁 시장의 생선',cost:{fish:3},gold:40,skill:'fishing',xp:12}
};
export const skillNeed=level=>Math.round(45*Math.pow(level,1.35));
export const hourAt=time=>(8+time/25)%24;
export const dayAt=time=>Math.floor((time+200)/600);
export const countCost=(inv,cost)=>Object.entries(cost).every(([id,n])=>Number.isSafeInteger(n)&&n>0&&(inv[id]||0)>=n);
export function spend(inv,cost){if(!countCost(inv,cost))return false;for(const [id,n]of Object.entries(cost))inv[id]-=n;return true;}
export function newLife(){return {skills:Object.fromEntries(Object.keys(SKILLS).map(k=>[k,{level:1,xp:0,last:-100}])),tools:{pick:0},nodes:{},plots:{},unlocked:['basic'],gear:[],equipped:{weapon:null,head:null,body:null,hands:null,feet:null},serial:0,activitySerial:0,job:null,markets:{},orders:{},treasures:{},town:{support:0},home:{owned:false,type:null,items:[],storage:{},storedGear:[],levels:{chest:1,bench:1,furnace:1}},farmSize:4};}
export function initializeLife(state,starter=true){state.version=3;state.life=newLife();for(const id of Object.keys(LIFE_ITEMS))state.inventory[id]=0;if(starter){Object.assign(state.inventory,{wheatSeed:4,carrotSeed:2,bait:5});}return state;}
export function stableRoll(serial,salt=0){let x=Math.imul(serial+37,1664525)+1013904223+salt*69069;x^=x>>>13;return (Math.imul(x,1274126177)>>>0)/4294967296;}
export function gearName(g){return `${QUALITIES[g.quality].name} ${METALS[g.material].name} ${GEAR_TYPES[g.type].name}${g.upgrade?' +'+g.upgrade:''}${g.affix?' · '+AFFIXES[g.affix].name:''}`;}
export function gearStats(g){const tier=Object.keys(METALS).indexOf(g.material),q=QUALITIES[g.quality].mult;return{damage:Math.round((20+tier*6)*q)+g.upgrade*3+(g.affix==='keen'?3:0),defense:Math.round((2+tier*1.5)*q)+g.upgrade+(g.affix==='sturdy'?2:0)};}
export function gearValue(g){const r=GEAR_RECIPES.find(r=>r.id===g.recipe);const materialValue=Object.entries(r.cost).reduce((s,[id,n])=>s+(LIFE_ITEMS[id]?.value||4)*n,0);return Math.round(materialValue*(1.35+g.quality*.22)+g.upgrade*18);}
export function baseValue(id,items){return items[id]?.value??({wood:3,ore:6,herb:4,potion:9,food:6,crystal:0,sword:0}[id]||0);}
export function marketFactor(state,vendor,id){const row=state.life.markets[vendor]?.pressure[id];return row?Math.max(.45,1/(1+row.amount*Math.exp(-(state.time-row.at)/180)*.13)):1;}
export function regionalFactor(vendor,id){const region=VENDORS[vendor].region;if(region==='mine'&&['wheat','carrot','melon'].includes(id))return 2.8;if(region==='mine')return /Ore$/.test(id)?.78:/Bar$/.test(id)?1.22:['food','plank','potion'].includes(id)?1.35:1;if(region==='farm')return ['wheat','carrot','melon'].includes(id)?.82:id==='fish'?2.5:id==='ironBar'?1.3:1;if(region==='lake')return ['fish','rareFish'].includes(id)?.85:['carrot','melon','plank'].includes(id)?1.35:1.1;if(vendor==='smith')return /Bar$/.test(id)?1.2:1;return 1;}
export function quote(state,vendor,id,side,items,valueOverride){const value=valueOverride??baseValue(id,items);if(!VENDORS[vendor]||value<=0)return 0;const demand=marketFactor(state,vendor,id),regional=regionalFactor(vendor,id),rep=state.life.town.support>=10?.97:1,skill=state.life.skills.commerce.level-1;return side==='buy'?Math.max(1,Math.ceil(value*regional*demand*1.65*rep*(1-Math.min(.08,skill*.004)))):Math.max(1,Math.floor(value*regional*demand*.68*(1+Math.min(.07,skill*.005))));}
export function ensureMarket(state,vendor){const day=dayAt(state.time);let m=state.life.markets[vendor];if(!m){m=state.life.markets[vendor]={day,stock:{...VENDORS[vendor].stock},cash:VENDORS[vendor].cash,pressure:{}};}else if(m.day<day){m.stock={...VENDORS[vendor].stock};m.cash=VENDORS[vendor].cash;m.day=day;}return m;}
export function addPressure(state,vendor,id,qty){const m=ensureMarket(state,vendor),old=m.pressure[id],amount=old?old.amount*Math.exp(-(state.time-old.at)/180):0;m.pressure[id]={amount:Math.min(40,Math.max(0,amount+qty)),at:state.time};}
export function validLife(life,items,time){
 const record=o=>o&&typeof o==='object'&&!Array.isArray(o),nat=n=>Number.isSafeInteger(n)&&n>=0&&n<1e9;
 const inv=o=>record(o)&&Object.entries(o).every(([id,n])=>Object.hasOwn(items,id)&&nat(n));
 if(!record(life)||!record(life.skills)||!record(life.tools)||!Number.isInteger(life.tools.pick)||life.tools.pick<0||life.tools.pick>3||!nat(life.serial)||!nat(life.activitySerial)||!Number.isInteger(life.farmSize)||life.farmSize<4||life.farmSize%4!==0||life.farmSize>farmLimit({life}))return false;
 for(const id of Object.keys(SKILLS)){const s=life.skills[id];if(!record(s)||!Number.isInteger(s.level)||s.level<1||s.level>20||!Number.isFinite(s.xp)||s.xp<0||s.xp>=skillNeed(s.level)||!Number.isFinite(s.last))return false;}
 if(!record(life.nodes)||!Object.values(life.nodes).every(n=>record(n)&&Number.isFinite(n.until)&&n.until>=0)||!record(life.plots))return false;
 if(!Object.values(life.plots).every(p=>record(p)&&typeof p.tilled==='boolean'&&(p.crop===null||Object.hasOwn(CROPS,p.crop))&&Number.isFinite(p.growth)&&p.growth>=0&&p.growth<=200&&Number.isFinite(p.water)&&p.water>=0&&p.water<=180))return false;
 if(!Array.isArray(life.unlocked)||!life.unlocked.every(k=>['basic','silver','mythril','feast'].includes(k))||!Array.isArray(life.gear)||life.gear.length>300||!record(life.equipped))return false;
 const ids=new Set();for(const g of life.gear){if(!record(g)||typeof g.uid!=='string'||!/^gear-[1-9][0-9]*$/.test(g.uid)||Number(g.uid.slice(5))>life.serial||ids.has(g.uid)||!GEAR_RECIPES.some(r=>r.id===g.recipe&&r.material===g.material&&r.type===g.type&&r.slot===g.slot)||!Number.isInteger(g.quality)||g.quality<0||g.quality>2||!Number.isInteger(g.upgrade)||g.upgrade<0||g.upgrade>5||(g.affix!==null&&!Object.hasOwn(AFFIXES,g.affix)))return false;ids.add(g.uid);}
 const equipped=new Set();for(const slot of ['weapon','head','body','hands','feet']){const id=life.equipped[slot];if(id!==null&&(!ids.has(id)||equipped.has(id)||!life.gear.some(g=>g.uid===id&&g.slot===slot)))return false;if(id)equipped.add(id);}
 const h=life.home;if(!record(h)||typeof h.owned!=='boolean'||(h.owned?!Object.hasOwn(HOMES,h.type):h.type!==null)||!inv(h.storage)||!Array.isArray(h.storedGear)||new Set(h.storedGear).size!==h.storedGear.length||!h.storedGear.every(id=>ids.has(id)&&!equipped.has(id))||!record(h.levels)||!['chest','bench','furnace'].every(k=>Number.isInteger(h.levels[k])&&h.levels[k]>=1&&h.levels[k]<=3)||!Array.isArray(h.items)||h.items.length>(h.owned?homeSpec({life}).decor:24))return false;
 const unique=new Set();for(const o of h.items){if(!record(o)||!FACILITIES[o.type]||!Number.isInteger(o.x)||!Number.isInteger(o.y)||o.x<48||o.x>homeSpec({life}).w-48||o.y<80||o.y>homeSpec({life}).h-72)return false;if(FACILITIES[o.type].unique&&unique.has(o.type))return false;unique.add(o.type);}
 if(!record(life.markets)||!Object.entries(life.markets).every(([v,m])=>VENDORS[v]&&record(m)&&nat(m.day)&&nat(m.cash)&&inv(m.stock)&&record(m.pressure)&&Object.entries(m.pressure).every(([id,p])=>(Object.hasOwn(items,id)||Object.hasOwn(GEAR_TYPES,id))&&record(p)&&Number.isFinite(p.amount)&&p.amount>=0&&p.amount<=40&&Number.isFinite(p.at)&&p.at<=time)))return false;
 if(!record(life.orders)||!Object.entries(life.orders).every(([id,o])=>ORDERS[id]&&record(o)&&typeof o.active==='boolean'&&Number.isInteger(o.done)&&o.done>=-1)||!record(life.treasures)||!Object.values(life.treasures).every(v=>v===true)||!record(life.town)||!nat(life.town.support))return false;
 const j=life.job;if(j!==null){if(!record(j)||!['mine','gather','process','upgrade','fish','till'].includes(j.kind)||typeof j.id!=='string'||!/^[-a-zA-Z0-9_]{1,70}$/.test(j.id)||!Number.isFinite(j.remaining)||j.remaining<=0||j.remaining>30||!Number.isFinite(j.total)||j.total<j.remaining||j.total>30||!['overworld','dungeon','mine1','mine2','home'].includes(j.map)||!Number.isFinite(j.x)||!Number.isFinite(j.y)||!inv(j.cost)||!nat(j.gold)||!Number.isFinite(j.started)||j.started>time)return false;
 const sameCost=(a,b)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([id,n])=>b[id]===n);
 if(j.kind==='process'){const r=ALL_RECIPES.find(r=>r.id===j.id);if(!r||!sameCost(j.cost,r.cost)||j.gold!==0||r.slot&&life.gear.length>=300)return false;}
 else if(j.kind==='upgrade'){const g=life.gear.find(g=>g.uid===j.id);if(!g||g.upgrade>=5||!sameCost(j.cost,{[g.material+'Bar']:2+g.upgrade,coal:1})||j.gold!==20*(g.upgrade+1)||life.home.storedGear.includes(g.uid))return false;}
 else if(j.kind==='fish'){if(!sameCost(j.cost,{bait:1})||j.gold!==0)return false;}
 else if(Object.keys(j.cost).length||j.gold!==0)return false;
 }
 return true;
}
