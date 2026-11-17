// Persistent carried stacks, physical overflow bundles and non-regenerating work energy.
export const BAG_COLUMNS=8,BAG_MAX_ROWS=5,BAG_PRICES=[60,180,450,900];
export const KEY_ITEMS=new Set(['sword','copperPick','ironPick','steelPick','crystal','ancientShard','emberCore','frostHeart','starSigil','relic','silverBook']);
export const isCargo=id=>!KEY_ITEMS.has(id);
export const newPack=()=>({rows:1,energy:100,serial:0,drops:[],furnished:false});
export function validPack(p,items,maps){return !!(p&&Number.isInteger(p.rows)&&p.rows>=1&&p.rows<=BAG_MAX_ROWS&&Number.isFinite(p.energy)&&p.energy>=0&&p.energy<=100&&Number.isSafeInteger(p.serial)&&p.serial>=0&&typeof p.furnished==='boolean'&&Array.isArray(p.drops)&&p.drops.length<=2000&&new Set(p.drops.map(d=>d?.id)).size===p.drops.length&&p.drops.every(d=>d&&Number.isSafeInteger(d.id)&&d.id>0&&d.id<=p.serial&&Object.hasOwn(items,d.item)&&isCargo(d.item)&&Number.isSafeInteger(d.qty)&&d.qty>0&&d.qty<=999999&&Object.hasOwn(maps,d.map)&&Number.isFinite(d.x)&&Number.isFinite(d.y)&&d.x>=0&&d.y>=0&&d.x<=(d.map==='home'?960:maps[d.map].w)&&d.y<=(d.map==='home'?640:maps[d.map].h)));}
export class PackSystem{
 constructor(game){this.g=game;const legacy=!game.state.pack;game.state.pack??=newPack();if(legacy)game.state.pack.rows=Math.min(BAG_MAX_ROWS,Math.max(1,Math.ceil(this.entries().length/BAG_COLUMNS)));
  const inv=game.state.inventory;for(const id of Object.keys(inv)){let value=inv[id];Object.defineProperty(inv,id,{enumerable:true,configurable:true,get:()=>value,set:n=>{if(n>value&&isCargo(id)&&value===0&&!this.canAdd(id)){this.leave(id,n-value);return;}value=n;}});}
  // A legacy save can hold more distinct stacks than the largest new backpack.
  for(const[id,qty]of this.entries().slice(this.capacity)){inv[id]=0;this.leave(id,qty);}
 }
 get p(){return this.g.state.pack;}get capacity(){return this.p.rows*BAG_COLUMNS;}get used(){return this.entries().length;}
 entries(){return Object.entries(this.g.state.inventory).filter(([id,n])=>isCargo(id)&&n>0);}
 canAdd(id){return !isCargo(id)||this.g.state.inventory[id]>0||this.used<this.capacity;}
 charge(n){if(!Number.isFinite(n)||n<0)return false;if(this.p.energy<n){this.g.notify('하루 기력이 부족합니다. 안전한 곳에서 하루를 마무리하세요.');return false;}this.p.energy=Math.max(0,this.p.energy-n);return true;}
 jobCost(kind,recipe){return({mine:6,gather:3,fish:7,till:3,upgrade:9})[kind]??(recipe?.slot?8:recipe?.skill==='smelting'?3:2);}
 leave(item,qty,manual=false){if(!Number.isSafeInteger(qty)||qty<=0)return false;const g=this.g;let d=this.p.drops.find(d=>d.item===item&&d.map===g.state.map&&Math.hypot(d.x-g.p.x,d.y-g.p.y)<20&&d.qty+qty<=999999);if(d)d.qty+=qty;else this.p.drops.push({id:++this.p.serial,item,qty,map:g.state.map,x:g.p.x,y:g.p.y});g.event(manual?'bagDrop':'bagFull',{item,qty});return true;}
 objects(){return this.p.drops.map(d=>({id:'bundle-'+d.id,drop:d.id,item:d.item,qty:d.qty,map:d.map,type:'chest',x:d.x,y:d.y,interact:'pickup',label:'남겨 둔 꾸러미 · '+d.qty+'개'}));}
 pickup(id){const at=this.p.drops.findIndex(d=>d.id===Number(id)),d=this.p.drops[at];if(!d||d.map!==this.g.state.map||Math.hypot(d.x-this.g.p.x,d.y-this.g.p.y)>65||!this.canAdd(d.item)||this.g.activities.busy)return false;this.p.drops.splice(at,1);this.g.state.inventory[d.item]+=d.qty;this.g.notify('꾸러미를 가방에 넣었습니다.','gather');this.g.save(false);return true;}
 drop(item,qty){const inv=this.g.state.inventory;if(!isCargo(item)||!Number.isSafeInteger(qty)||qty<1||(inv[item]||0)<qty||this.g.activities.busy||this.g.state.life.job)return false;inv[item]-=qty;this.leave(item,qty,true);this.g.save(false);return true;}
 upgradePrice(){return BAG_PRICES[this.p.rows-1]||0;}
 upgrade(vendor='mira'){const price=this.upgradePrice();if(vendor!=='mira'||!price||!this.g.life.canTrade(vendor)||this.g.state.gold<price||this.g.state.life.job||this.g.activities.busy)return false;this.g.state.gold-=price;this.p.rows++;this.g.notify('가방 한 줄 확장 · '+this.capacity+'칸','coin');this.g.save(false);return true;}
 recover(mode){const old=this.p.energy;this.p.energy=mode==='home'?100:Math.max(old,Math.min(mode==='inn'?90:55,old+(mode==='inn'?60:28)));}
}
