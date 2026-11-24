import {WORK_MAX,workLevel,workLimit,trainingRank,trainingPrice,gripReduction} from './upgrades.js';
import {chapterAtWorld} from './layout.js';
import {weaponLimit,armorLimit,gripLimit} from './data.js';

export const TRAVEL_COST=12;
export const CHARM_COST=35;
export const actionCost=(profile,base)=>Math.max(1,Math.round(base*(1-gripReduction(profile))));
export function offers(profile){
 const rows=[
  {id:'weapon',name:'종강검 연마',icon:0,level:profile.upgrade,limit:weaponLimit(profile),max:30,price:profile.upgrade<8?35+profile.upgrade*40:355+(profile.upgrade-8)*75+(profile.upgrade-8)**2*15,description:'한 단계마다 공격력 +4'},
  {id:'armor',name:'방어구 보강',icon:1,level:profile.gear.armor,limit:armorLimit(profile),max:12,price:profile.gear.armor<4?[90,150,230,310][profile.gear.armor]:430+(profile.gear.armor-4)*120+(profile.gear.armor-4)**2*25,description:profile.gear.armor<4?'다음 단계: 받는 피해 2 감소':'다음 단계: 받는 피해 1 감소'},
  {id:'grip',name:'손잡이 감기',icon:2,level:profile.gear.grip,limit:gripLimit(profile),max:8,price:profile.gear.grip<3?[75,125,195][profile.gear.grip]:300+(profile.gear.grip-3)*120+(profile.gear.grip-3)**2*30,description:profile.gear.grip<3?'다음 단계: 집중 소모 감소율 +8%':'다음 단계: 집중 소모 감소율 +4%'},
  ...[['lining','갑옷 안감',1,100,60,15,'최대 체력 +8 · 현재 체력은 그대로'],['reserve','집중 고리',2,110,65,20,'최대 집중 +10 · 즉시 보충되지 않음'],['breath','호흡 매듭',2,150,90,25,'집중 회복 초당 +1.5'],['boots','장화 보강',1,160,100,35,'회피 재사용 시간 0.025초 단축'],['focus','공명 초점',0,180,100,40,'공명 피해 +3 · 재사용 시간 0.1초 단축']].map(([id,name,icon,base,linear,quadratic,description])=>{const level=workLevel(profile,id);return{id,name,icon,level,limit:workLimit(profile,id),max:WORK_MAX[id],price:base+level*linear+level*level*quadratic,description,category:'body'};}),
  {id:'training',name:'끝없는 단련',icon:2,level:trainingRank(profile),limit:null,max:null,price:trainingPrice(trainingRank(profile)),description:'매회 공격력 +1 · 최대 체력 +2 · 최대 집중 +1',category:'training',infinite:true},
  {id:'charm',name:'매듭 부적',icon:3,level:Number(profile.charm),limit:1,max:1,price:CHARM_COST,description:'한 번 쓰러질 때 동전 손실을 50%에서 20%로 줄임'}
 ];
 return rows.map(row=>({...row,category:row.category||'gear',reason:row.infinite?(!profile.flags.brag?'브라그의 파편이 필요하다':row.price===null?'비용이 너무 크다':profile.marks<row.price?'동전이 부족하다':null):row.level>=row.max?(row.id==='charm'?'이미 지니고 있다':'정비 완료'):row.level>=row.limit?'다음 종의 파편이 필요하다':profile.marks<row.price?'동전이 부족하다':null}));
}
export function checkpointUnlocked(profile,checkpoint){const f=profile.flags;const chapter=checkpoint.chapter||chapterAtWorld(checkpoint.x);return chapter===7?!!f.neris:chapter===6?!!f.arkein:chapter===5?!!f.leonel&&!!f.sister:chapter===4?!!f.brag:chapter===3?!!f.marie:chapter===2?!!f.edran:true;}
