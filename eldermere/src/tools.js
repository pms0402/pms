// One input model for the hotbar, mouse, keyboard and touch.
export const TOOLS=[
 {id:'weapon',name:'무기',icon:'sword',hint:'적을 향해 공격'},
 {id:'axe',name:'도끼',icon:'axe',hint:'나무를 베어 목재 수집'},
 {id:'pick',name:'곡괭이',icon:'pickaxe',hint:'광맥·바위 채굴'},
 {id:'hoe',name:'괭이',icon:'hoe',hint:'빈 땅 개간'},
 {id:'water',name:'물뿌리개',icon:'wateringCan',hint:'작물에 물주기'},
 {id:'seed',name:'씨앗',icon:'seed',hint:'선택한 씨앗 심기'},
 {id:'scythe',name:'낫',icon:'scythe',hint:'익은 작물·약초 수확'},
 {id:'rod',name:'낚싯대',icon:'fishingRod',hint:'물가의 낚시 지점에서 사용'}
];
const FARM_TOOLS=['hoe','water','seed','scythe'];
export class ToolSystem{
 constructor(game){this.g=game;this.selected='weapon';}
 select(id){if(!TOOLS.some(t=>t.id===id))return false;this.selected=id;this.g.valley.tool=FARM_TOOLS.includes(id)?id:null;return true;}
 target(point,predicate){return [...this.g.life.objects(),...(this.g.state.map==='dungeon'?[{id:'exit',map:'dungeon',type:'entrance',x:320,y:439,interact:'exit'},{id:'relic',map:'dungeon',type:'crystal',x:320,y:110,interact:'relic'}]:[])].filter(o=>predicate(o)&&!this.g.life.depleted(o)).sort((a,b)=>Math.hypot(a.x-point.x,a.y-point.y)-Math.hypot(b.x-point.x,b.y-point.y))[0];}
 interact(point){const g=this.g;if(g.paused||g.activities.busy)return false;const o=this.target(point,o=>o.interact&&!['gather','mining','forage','fishing','plot'].includes(o.interact));if(!o||Math.hypot(o.x-point.x,o.y-point.y)>46){g.notify('주민이나 시설을 클릭해 주세요. 작업은 선택한 도구로 합니다.');return false;}if(!g.life.near(o,65)){g.notify('조금 더 가까이 다가가세요.');return false;}return g.interact(o);}
 use(point){const g=this.g;if(g.paused||g.activities.busy||g.life.l.job)return false;const tool=this.selected;
 if(tool==='weapon')return g.strike(Math.atan2(point.y-g.p.y,point.x-g.p.x));
 if(FARM_TOOLS.includes(tool)){
  if(tool==='scythe'){const plant=this.target(point,o=>o.resource==='herb'||o.interact==='forage');if(plant&&Math.hypot(plant.x-point.x,plant.y-point.y)<28&&g.life.near(plant,55))return plant.resource?g.life.collectLegacy(plant.id):g.life.begin('gather',plant.id,1.5);}
  return g.valley.useTool(point.x,point.y);
 }
 const o=this.target(point,o=>tool==='axe'?o.resource==='wood':tool==='pick'?o.interact==='mining'||o.resource==='ore':o.interact==='fishing');
 if(!o||Math.hypot(o.x-point.x,o.y-point.y)>46||!g.life.near(o,60)){g.notify(tool==='axe'?'가까운 나무를 향해 도끼를 사용하세요.':tool==='pick'?'가까운 광맥이나 바위에 곡괭이를 사용하세요.':'물가의 낚시 지점 가까이에서 사용하세요.');return false;}
 if(o.resource)return g.life.collectLegacy(o.id);
 if(tool==='pick')return g.life.mine(o);
 return g.life.begin('fish',o.id,6,{bait:1});
 }
 touch(point){const o=this.target(point,o=>o.interact&&!['gather','mining','forage','fishing','plot'].includes(o.interact));if(o&&Math.hypot(o.x-point.x,o.y-point.y)<32)return this.interact(point);return this.use(point);}
 keyboardPoint(){const g=this.g,dir=[[0,1],[1,0],[0,-1],[-1,0]][g.p.dir];return{x:g.p.x+dir[0]*32,y:g.p.y+dir[1]*32};}
}
export function attachTouchMovement(root,input,allowed){
 let pointer=null;const reset=()=>{pointer=null;for(const k of ['up','down','left','right'])input[k]=false;root.style.setProperty('--stick-x','0px');root.style.setProperty('--stick-y','0px');};
 const move=e=>{if(pointer!==e.pointerId)return;if(!allowed()){reset();return;}const b=root.getBoundingClientRect(),dx=e.clientX-b.left-b.width/2,dy=e.clientY-b.top-b.height/2,d=Math.hypot(dx,dy),scale=Math.min(1,30/(d||1));root.style.setProperty('--stick-x',dx*scale+'px');root.style.setProperty('--stick-y',dy*scale+'px');input.left=dx<-9;input.right=dx>9;input.up=dy<-9;input.down=dy>9;};
 root.onpointerdown=e=>{if(pointer!==null||!allowed())return;e.preventDefault();pointer=e.pointerId;root.setPointerCapture(e.pointerId);move(e);};root.onpointermove=move;root.onpointerup=root.onpointercancel=root.onlostpointercapture=reset;window.addEventListener('blur',reset);return reset;
}
