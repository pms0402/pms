import {weaponLimit,armorLimit,gripLimit} from './data.js';

export const TRAVEL_COST=12;
export const CHARM_COST=35;
export const actionCost=(profile,base)=>Math.max(1,Math.round(base*(1-profile.gear.grip*.08)));
export function offers(profile){
 const rows=[
  {id:'weapon',name:'종강검 연마',icon:0,level:profile.upgrade,limit:weaponLimit(profile),max:6,price:35+profile.upgrade*40,description:'한 단계마다 공격력 +4'},
  {id:'armor',name:'방어구 보강',icon:1,level:profile.gear.armor,limit:armorLimit(profile),max:3,price:[90,150,230][profile.gear.armor],description:'한 단계마다 받는 피해 2 감소'},
  {id:'grip',name:'손잡이 감기',icon:2,level:profile.gear.grip,limit:gripLimit(profile),max:2,price:[75,125][profile.gear.grip],description:'한 단계마다 공격의 집중 소모 8% 감소'},
  {id:'charm',name:'매듭 부적',icon:3,level:Number(profile.charm),limit:1,max:1,price:CHARM_COST,description:'한 번 쓰러질 때 동전 손실을 50%에서 20%로 줄임'}
 ];
 return rows.map(row=>({...row,reason:row.level>=row.max?(row.id==='charm'?'이미 지니고 있다':'정비 완료'):row.level>=row.limit?'다음 종의 파편이 필요하다':profile.marks<row.price?'동전이 부족하다':null}));
}
export function checkpointUnlocked(profile,checkpoint){const f=profile.flags;return checkpoint.x>=11220?!!f.brag:checkpoint.x>=7700?!!f.marie:checkpoint.x>=4540?!!f.edran:true;}
