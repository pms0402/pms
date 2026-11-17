// Each attack commits its direction and target before its visible windup.
export const PATTERNS={
 sweep:{name:'횡베기',hint:'뒤로 물러나거나 막기',windup:.95,active:.24,recover:1.15,range:118,damage:34,row:1,prep:1,strike:2},
 slam:{name:'종 내려찍기',hint:'바닥의 파동은 점프로 넘기',windup:1.2,active:.22,recover:1.45,range:78,damage:42,wave:30,row:1,prep:3,strike:4},
 lunge:{name:'돌진 찌르기',hint:'방향이 정해졌다 · 뒤로 회피하거나 막기',windup:1.05,active:.4,recover:1.35,range:95,damage:38,speed:225,row:2,prep:2,strike:3},
 double:{name:'두 번 베기',hint:'두 번째 칼날까지 보고 반격',windup:1.05,active:.23,recover:1.35,range:118,damage:35,row:2,prep:4,strike:5,twice:true},
 thrust:{name:'성녀의 지팡이',hint:'팔이 뻗기 전에 거리 벌리기',windup:1,active:.24,recover:1.25,range:126,damage:36,row:1,prep:2,strike:3},
 choir:{name:'돌아오지 않는 목소리',hint:'앞으로 흐르는 빛 · 도약하거나 막기',windup:1.25,active:.22,recover:1.4,range:0,damage:30,shot:true,row:1,prep:2,strike:4},
 tide:{name:'낮은 종소리',hint:'바닥을 타고 온다 · 점프',windup:1.2,active:.22,recover:1.5,range:64,damage:38,wave:32,row:2,prep:2,strike:4},
 knell:{name:'묶인 기도',hint:'빛이 고인 자리에서 벗어나기',windup:1.5,active:.24,recover:1.5,range:0,damage:40,pillars:true,row:2,prep:2,strike:4},
 hammer:{name:'모루를 울리는 망치',hint:'망치 아래에서 벗어나고 파동은 점프',windup:1.3,active:.24,recover:1.6,range:92,damage:49,wave:34,row:1,prep:2,strike:4},
 furnace:{name:'용광로의 숨',hint:'주황색 틈 사이에 서기',windup:1.6,active:.28,recover:1.65,range:0,damage:46,pillars:true,row:3,prep:2,strike:3},
 forgeSweep:{name:'망치 휘두르기',hint:'머리 위가 아닌 허리 쪽 준비 자세 · 거리 벌리기',windup:1.05,active:.26,recover:1.4,range:135,damage:44,row:2,prep:1,strike:3},
 charge:{name:'쇳덩이 돌진',hint:'발을 굳히면 방향 고정 · 회피하거나 막기',windup:1.2,active:.45,recover:1.5,range:95,damage:46,speed:235,row:2,prep:1,strike:4},
 forgeDouble:{name:'되돌아오는 망치',hint:'두 번 휘두른다 · 끝난 뒤 반격',windup:1.15,active:.25,recover:1.5,range:135,damage:44,row:2,prep:1,strike:3,twice:true}
};
export const BOSS_DEFS={
 edran:{name:'최후의 문지기, 에드란',chapter:1,x:3910,left:3395,right:4235,hp:420,clue:'memento',ability:'echo',patterns:[['sweep','slam','lunge'],['double','slam','lunge','sweep']],intro:'돌아가라. 밖에는 새벽이 오지 않는다.'},
 marie:{name:'침묵의 성녀, 마리에',chapter:2,x:6990,left:6500,right:7380,hp:620,clue:'hymn',ability:'voice',patterns:[['thrust','choir','tide'],['choir','knell','thrust','tide']],intro:'마리에는 입을 열었다. 목에 달린 작은 종만 흔들렸다.'},
 brag:{name:'잿빛 대장장이, 브라그',chapter:3,x:10210,left:9750,right:10740,hp:850,clue:'ledger',ability:'forge',patterns:[['hammer','forgeSweep','furnace'],['charge','hammer','forgeDouble','furnace']],intro:'그 밸브, 네가 잠갔나. …비켜. 아직 안에 사람이 있다.'}
};
export function createBoss(id){const d=BOSS_DEFS[id];return{id,type:id,boss:true,x:d.x,y:302,w:id==='brag'?58:48,h:id==='marie'?94:105,hp:d.hp,maxHp:d.hp,vx:0,vy:0,dir:-1,state:'idle',t:0,phase:1,cooldown:1.4,attackIndex:0,stagger:0,dead:false,deathT:0,hit:0,walk:0,targets:[]};}
export function attackRect(e,warning=false){const a=PATTERNS[e.pattern];if(!a)return{x:e.x,y:e.y,w:0,h:0};const reach=a.range+(warning?(a.speed||0)*a.active:0);return{x:e.dir>0?e.x-18:e.x-reach,y:e.y-96,w:reach+18,h:96};}
export function targetRects(e){return(e.targets||[]).map(x=>({x:x-34,y:e.y-104,w:68,h:104}));}
