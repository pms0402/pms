import {createBoss} from './bosses.js';
import {body,moveBody,solids,clearLine} from './world.js';
import {bladeTouches,sweptBlades} from './blade.js';

export const TUTORIAL_HP=360;
// Optional proofs keep pre-existing step numbers and saved lessons intact.
export const newTutorial=(done=false)=>({state:done?'done':'new',step:done?8:0,combo:done?5:0,hp:done?0:TUTORIAL_HP,healed:done,refilled:done});
export const LESSONS=[
 {title:'몸 풀기',key:'A D / ← →',touch:'왼쪽 · 오른쪽 버튼',text:'오는 길에 다친 무릎이 쑤신다. 우선 오른쪽으로 걸으며 몸을 풀자.'},
 {title:'무너진 작업대',key:'Space',touch:'도약 버튼',text:'뛰어서 낮은 돌턱을 넘자. 누르는 길이에 따라 뛰는 높이가 달라진다.'},
 {title:'검을 손에 익히기',key:'좌클릭 / J · 끝에 한 번 더',touch:'공격 · 끝에 한 번 더',text:'가까이서 한 번 베자. 검을 거두는 끝부분에 다시 누르면 내려찍기로 이어진다.'},
 {title:'한 걸음 비켜서기',key:'Shift',touch:'회피 버튼',text:'기사가 검을 들면 회피로 공격을 피하자. 공격과 회피에는 집중을 쓴다.'},
 {title:'칼 받아내기',key:'우클릭 / L',touch:'막기 버튼',text:'기사를 바라보고 검을 막자. 닿기 직전에 받아내면 패링이 된다.'},
 {title:'무게를 실어서',key:'K / X',touch:'강타 버튼',text:'강공격을 한 번 맞히자. 준비가 길어서, 기사가 검을 거둘 때가 좋다.'},
 {title:'파편의 울림',key:'Q',touch:'공명 버튼',text:'조금 떨어져 공명 검을 맞히자. 다시 쓰기까지는 시간이 필요하다.'},
 {title:'마지막 점검',key:'배운 동작으로 겨루기',touch:'배운 동작으로 겨루기',text:'이제 끝까지 겨뤄 보자. 집중이 모자라면 잠깐 검을 쉬어도 된다.'},
 {title:'점검 끝',key:'W / E',touch:'화면의 상호작용 버튼',text:'약병을 다시 채웠다. 준비가 됐으면 종 앞에서 성벽으로 나가자.'}
];
export const tutorialRecovering=g=>g.inTutorial&&g.profile.tutorial.step===5&&(g.profile.tutorial.healed===false||g.p.action?.kind==='heal');
export function tutorialLesson(g){const t=g.profile.tutorial;if(tutorialRecovering(g))return g.profile.flasks===0&&g.p.action?.kind!=='heal'?{title:'빈 약병',key:'왼쪽 종 · W / E',touch:'왼쪽 종의 상호작용 버튼',text:'약병이 비었다. 왼쪽 연습 종을 치면 세 병을 채울 수 있다. 기사는 기다려 준다.'}:{title:'숨 돌리기',key:'R / H',touch:'회복 버튼',text:'기사가 검을 내렸다. 방향키를 놓고 약을 마시자. 한 병으로 최대 체력의 40%를 회복한다.'};if(t.step===8&&t.refilled!==true)return{title:'떠나기 전 보급',key:'W / E',touch:'종 앞의 상호작용 버튼',text:'오른쪽 종을 쳐서 약병을 채우자. 여정에서도 종을 만날 때마다 세 병까지 보충할 수 있다.'};return LESSONS[t.step];}
export function tutorialProgress(g){const t=g.profile.tutorial,care=typeof t.healed==='boolean',bell=typeof t.refilled==='boolean';if(t.step===8){const total=8+Number(care)+Number(bell);return t.refilled===false?total+' / '+total:'점검 완료';}const n=t.step+1+(care&&t.step>=5&&!tutorialRecovering(g)?1:0);return n+' / '+(8+Number(care)+Number(bell));}
export const TRAINING_PATTERNS={cut:{windup:1.2,active:.26,recover:1.45,row:1,damage:5},overhead:{windup:1.45,active:.26,recover:1.6,row:2,damage:7}};
export function createTutorialWorld(t){const dummy=createBoss('edran');Object.assign(dummy,{dead:true,deathT:10});const trainer={id:'training-knight',type:'tutor',training:true,x:1140,y:302,homeX:1140,homeY:302,w:38,h:80,hp:t.hp,maxHp:TUTORIAL_HP,vx:0,vy:0,dir:-1,state:'idle',t:0,cooldown:1.2,stagger:0,dead:t.step===8,deathT:t.step===8?2:0,hit:0,walk:0,serial:0,attackIndex:0};
 return{tutorial:true,w:1950,h:690,platforms:[{x:-80,y:302,w:2110,h:1800,tile:0,foundation:true},{id:'practice-step',x:330,y:270,w:130,h:32,tile:0},{x:495,y:242,w:108,h:18,tile:0,oneway:true},{x:640,y:270,w:98,h:18,tile:0,oneway:true}],gates:[{id:'training-door',x:1740,y:100,w:46,h:202}],objects:[{id:'practice-bell',type:'shrine',checkpoint:'outer',x:840,y:302,label:'연습 종'},{id:'practice-exit',type:'trainingExit',x:1850,y:302,label:t.refilled===false?'종 치기 · 약병 충전':'성벽으로 나가기'}],scenery:[{type:'workshop',x:85,y:302,s:.6},{type:'supplycart',x:250,y:302,s:.55},{type:'tree',x:615,y:302,s:1.25},{type:'statue',x:1570,y:302,s:1.3}],enemies:[trainer],bosses:[dummy],boss:dummy,lift:{x:-300,y:302,w:70,h:12,target:302},traps:[]};}
export const trainerOf=g=>g.world.enemies.find(e=>e.training);
export function nextLesson(g){const t=g.profile.tutorial;if(t.step>=8)return false;t.step++;g.tutorialWalk=0;g.event('tutorialStep',{step:t.step});g.sound('level');g.save();return true;}
export function tutorialSignal(g,kind,e=null){if(!g.inTutorial)return;const t=g.profile.tutorial;if(kind==='jump')g.tutorialJumped=true;if(kind==='heal'&&t.healed===false){t.healed=true;g.event('tutorialStep',{step:t.step});g.sound('level');}if(kind==='dash'&&e&&['windup','attack'].includes(e.state)&&Math.abs(g.p.x-e.x)<125)e.dashAttempt=e.serial;if(t.step===4&&['parry','guard'].includes(kind))nextLesson(g);}
export function tutorialHit(g,e,kind,n){if(e.dead)return;const t=g.profile.tutorial;e.hp=Math.max(t.step<7?125:0,e.hp-n);t.hp=e.hp;e.hit=.13;e.stagger=.2;if(t.step===2&&['light1','light3'].includes(kind)){t.combo|=kind==='light1'?1:4;if((t.combo&5)===5)nextLesson(g);}else if(t.step===5&&t.healed!==false&&kind==='heavy')nextLesson(g);else if(t.step===6&&kind==='skill')nextLesson(g);
 if(e.hp<=0){e.dead=true;e.deathT=0;e.vx=0;e.state='dead';nextLesson(g);g.projectiles=[];g.sound('mechanism');}g.save();}
export function trainerFrame(e,clock){if(e.dead)return[3,Math.min(5,3+Math.floor(e.deathT*2))];if(e.stagger>.21)return[3,2];if(e.hit>0&&e.state==='idle')return[3,0];const a=TRAINING_PATTERNS[e.pattern];if(e.state==='windup')return[a.row,Math.min(2,Math.floor(e.t/a.windup*3))];if(e.state==='attack')return[a.row,3+Math.min(1,Math.floor(e.t/a.active*2))];if(e.state==='recover')return[a?.row||1,5];return[0,Math.floor(e.walk*.07||clock*3)%6];}
export function trainerBlade(e){const [row,col]=trainerFrame(e,0);if(![1,2].includes(row)||![3,4].includes(col))return null;const points=row===1?(col===3?[82,62,127,62]:[79,86,123,99]):(col===3?[74,75,114,108]:[70,96,124,120]),s=92/128,[ax,ay,bx,by]=points;return{ax:e.x+(ax-52)*s*e.dir,ay:e.y+(ay-122)*s,bx:e.x+(bx-52)*s*e.dir,by:e.y+(by-122)*s};}
export function updateTutorial(g,dt){const p=g.p,t=g.profile.tutorial,e=trainerOf(g);if(t.step===0){g.tutorialWalk=(g.tutorialWalk||0)+Math.abs(p.vx)*dt;if(g.tutorialWalk>=90&&p.x>=275)nextLesson(g);}if(t.step===1&&g.tutorialJumped&&p.grounded&&p.x>=330&&(p.support?.id==='practice-step'||p.x>=460))nextLesson(g);
 e.hit=Math.max(0,e.hit-dt);if(e.dead){e.deathT+=dt;return;}e.stagger=Math.max(0,e.stagger-dt);e.cooldown-=dt;e.t+=dt;
 if(tutorialRecovering(g)){e.state='idle';e.t=0;e.vx=0;e.previousBlade=null;e.cooldown=1.5;return;}
 if(p.x<770||t.step<2){e.vx=0;return;}if(e.stagger>.21){e.vx=0;return;}
 const d=p.x-e.x,dist=Math.abs(d),a=TRAINING_PATTERNS[e.pattern];
 if(e.state==='idle'){e.dir=Math.sign(d)||e.dir;e.vx=t.step>=3&&dist<32?-e.dir*44:dist>53?e.dir*44:0;if(t.step>=3&&dist>=32&&dist<100&&e.cooldown<=0){e.pattern=t.step===3||t.step===4?'cut':e.attackIndex++%2?'overhead':'cut';e.state='windup';e.t=0;e.vx=0;e.serial++;e.didHit=false;e.damagedPlayer=false;e.dashAttempt=null;e.previousBlade=null;g.sound('parry');}}
 else if(e.state==='windup'){e.vx=0;if(e.t>=a.windup){e.state='attack';e.t=0;g.sound('swing');}}
 else if(e.state==='attack'){e.vx=0;const b=trainerBlade(e),paths=sweptBlades(e.previousBlade,b);e.previousBlade=b;if(!e.didHit&&paths.some(v=>bladeTouches(v,body(p),2))&&clearLine(g,e.x,e.y-30,p.x,p.y-25)){e.didHit=true;e.damagedPlayer=g.hurt(a.damage,e);}if(e.t>=a.active){if(t.step===3&&e.dashAttempt===e.serial&&!e.damagedPlayer)nextLesson(g);e.state='recover';e.t=0;}}
 else if(e.state==='recover'){e.vx=0;if(e.t>=(a?.recover||1.3)){e.state='idle';e.t=0;e.cooldown=.55;}}
 e.vy=Math.min(500,e.vy+1100*dt);const old=e.x;moveBody(e,dt,solids(g));e.x=Math.max(800,Math.min(1690,e.x));e.walk+=Math.abs(e.x-old);}
