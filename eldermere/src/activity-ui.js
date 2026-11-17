import {ACTIVITIES} from './activities.js';
import {icon,sprite,drawSprite,spriteSize} from './art.js';
import {ITEMS} from './data.js';
import {gearName} from './life-data.js';
export function createActivityUI({game:g,onOpen,onClose}){
 const root=document.querySelector('#activity-layer'),panel=root.querySelector('section'),stage=root.querySelector('.activity-stage'),canvas=root.querySelector('canvas'),ctx=canvas.getContext('2d');let shown=null,buttons=[];
 const controller=()=>g.activities;
 function emit(value){const a=controller().active;if(a)controller().input(a.id,value);}
 function hold(value){const a=controller().active;if(a)controller().hold(a.id,value);}
 function build(a){root.hidden=false;document.body.classList.add('minigame-open');onOpen();root.querySelector('.activity-title').textContent=ACTIVITIES[a.kind].name;root.querySelector('.activity-subtitle').textContent=a.label;root.querySelector('.activity-hint').textContent=ACTIVITIES[a.kind].hint;stage.replaceChildren();buttons=[];root.querySelector('.activity-cancel').hidden=false;root.querySelector('.activity-continue').hidden=true;root.querySelector('.activity-rewards').replaceChildren();canvas.hidden=false;
 const b=document.createElement('button');b.className='primary activity-action';b.textContent='누르고 있는 동안 줄 감기';b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture?.(e.pointerId);hold(true);};b.onpointerup=b.onpointercancel=()=>hold(false);stage.className='activity-stage';stage.append(b);panel.focus({preventScroll:true});
 }
 function draw(a){const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#122720';ctx.fillRect(0,0,W,H);ctx.strokeStyle='#607659';ctx.strokeRect(6,6,W-12,H-12);ctx.fillStyle='#9cad86';ctx.font='14px sans-serif';ctx.textAlign='center';
 {ctx.fillText(a.kind==='fishing'?'줄이 끊어지지 않게 힘을 조절하세요':'알맞은 열을 꾸준히 유지하세요',W/2,30);const x=35,w=W-70;ctx.fillStyle='#674b3a';ctx.fillRect(x,64,w,32);ctx.fillStyle='#8b9d63';ctx.fillRect(x+w*.32,64,w*.4,32);ctx.fillStyle='#f8e7ac';ctx.fillRect(x+w*a.tension/100-3,55,6,50);ctx.fillStyle='#263f30';ctx.fillRect(x,132,w,14);ctx.fillStyle='#d5bf7a';ctx.fillRect(x,132,w*a.progress,14);ctx.fillStyle='#e6dfba';ctx.fillText('완성도 '+Math.floor(a.progress*100)+'% · '+(a.held?'힘을 주는 중':'힘을 푸는 중'),W/2,180);}
 }
 function result(r){root.hidden=false;document.body.classList.add('minigame-open');onOpen();root.querySelector('.activity-title').textContent=r.success?'좋은 수확입니다':'다시 도전해 보세요';root.querySelector('.activity-subtitle').textContent=r.label;root.querySelector('.activity-hint').textContent=r.success?'성공한 작업의 보상을 소지품에 넣었습니다.':'물고기가 달아났습니다. 미끼 1개를 소비했습니다.';canvas.hidden=true;stage.replaceChildren();root.querySelector('.activity-cancel').hidden=true;root.querySelector('.activity-continue').hidden=false;const rewards=root.querySelector('.activity-rewards');rewards.replaceChildren();for(const loot of r.loot){const line=document.createElement('div');line.className='activity-loot';line.textContent=(ITEMS[loot.id]?.name||loot.id)+'  +'+loot.qty;rewards.append(line);}if(r.equipment?.length)for(const item of r.equipment){const line=document.createElement('div');line.className='activity-loot';line.textContent=gearName(item);rewards.append(line);}if(r.success&&!rewards.children.length){rewards.textContent='작업이 완료되었습니다.';}panel.focus({preventScroll:true});}
 function hide(){root.hidden=true;shown=null;document.body.classList.remove('minigame-open');onClose();}
 root.querySelector('.activity-cancel').onclick=()=>{controller().cancel();hide();};root.querySelector('.activity-continue').onclick=()=>{controller().dismiss();hide();};
 return {update(){const c=controller();if(c.active){if(shown!==c.active.id){shown=c.active.id;build(c.active);}draw(c.active);}else if(c.result){if(shown!=='result-'+c.result.id){shown='result-'+c.result.id;result(c.result);}}else if(!root.hidden)hide();},hide,hold,emit};
}
