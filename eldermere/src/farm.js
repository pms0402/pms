import {ANIMALS,FARM_UPGRADES,animalLimit} from './farm-data.js';
import {stageAt,CHAPTERS} from './progression.js';
import {countCost,spend,dayAt} from './life-data.js';
export class FarmSystem{
 constructor(game){this.g=game;}
 get s(){return this.g.state;}get f(){return this.s.farm;}
 near(){return this.s.map==='overworld'&&Math.hypot(this.g.p.x-2330,this.g.p.y-1510)<100;}
 objects(){return this.f.animals.map((a,i)=>({id:'animal-'+a.id,animal:a.id,type:'animal_'+a.kind,map:'overworld',interact:'animal',label:ANIMALS[a.kind].name+' · 돌보기',x:2320+(i%3)*42+Math.sin(this.s.time*.3+i)*9,y:1555+Math.floor(i/3)*48+Math.cos(this.s.time*.23+i)*7}));}
 update(dt){for(const a of this.f.animals)if(a.feed>0)a.progress=Math.min(ANIMALS[a.kind].time,a.progress+dt*(1+a.bond*.003));}
 reason(kind){const a=ANIMALS[kind];if(!Object.hasOwn(ANIMALS,kind))return'알 수 없는 가축';if(!this.s.life.home.owned)return'먼저 집을 매입하세요';if(stageAt(this.s)<a.stage)return CHAPTERS[a.stage-1].name+' 보스 처치 필요';if(this.f.animals.length>=animalLimit(this.s))return'축사가 가득 찼습니다';if(!this.near())return'동쪽 새벽 목장에 방문하세요';if(this.s.gold<a.price)return'금화 부족';return'';}
 buy(kind){if(this.reason(kind)||this.g.activities.busy)return false;const spec=ANIMALS[kind];this.s.gold-=spec.price;this.f.animals.push({id:++this.f.serial,kind,feed:2,progress:0,bond:0,petDay:-1});this.g.notify(spec.name+'이 새 식구가 되었습니다. 첫 사료 2회분을 포함합니다.','level');this.g.save(false);return true;}
 act(id,action){const a=this.f.animals.find(a=>a.id===Number(id)),o=this.objects().find(o=>o.animal===Number(id));if(!a||!this.g.life.near(o,65)||this.g.activities.busy)return false;
 if(action==='feed'){if(a.feed>=3||this.s.inventory.feed<1)return false;if(this.g.pack&&!this.g.pack.charge(1))return false;this.s.inventory.feed--;a.feed++;}
 else if(action==='pet'){const day=dayAt(this.s.time);if(a.petDay===day)return false;a.petDay=day;a.bond=Math.min(100,a.bond+8);this.g.burst(o.x,o.y-12,10,'#dfbd98');}
 else if(action==='collect'){if(this.s.life.job||!this.collect(id,1))return false;this.g.life.workFx={type:'farm',remaining:.5};this.g.burst(o.x,o.y-10,10,'#e4d4a4');}
 else return false;this.g.save(false);return true;
 }
 collect(id,grade){const a=this.f.animals.find(a=>a.id===Number(id)),o=this.objects().find(o=>o.animal===Number(id));if(!a||!this.g.life.near(o,65))return false;const d=ANIMALS[a.kind];if(a.progress<d.time||a.feed<1)return false;if(this.g.pack&&!this.g.pack.charge(2))return false;a.progress=0;a.feed--;const qty=d.qty+(grade>.9?1:0)+(a.bond>=50?1:0);this.s.inventory[d.item]+=qty;this.g.life.gain('farming',8);this.g.notify('목장 수확 · '+qty+'개','gather');return true;}
 upgrade(id){const u=FARM_UPGRADES[id];if(!Object.hasOwn(FARM_UPGRADES,id)||!this.near()||!this.s.life.home.owned||this.f.upgrades.includes(id)||stageAt(this.s)<u.stage||this.g.activities.busy||this.s.gold<u.gold||!countCost(this.s.inventory,u.cost)||id==='barn2'&&!this.f.upgrades.includes('barn'))return false;spend(this.s.inventory,u.cost);this.s.gold-=u.gold;this.f.upgrades.push(id);this.g.notify(u.name+' 완성 · '+u.desc,'level');this.g.save(false);return true;}
}
