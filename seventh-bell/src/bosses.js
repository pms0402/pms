import {mapX} from './layout.js';
// Each attack commits its direction and target before its visible windup.
export const PATTERNS={
 hookCut:{name:'선착장의 갈고리',windup:1.15,active:.28,recover:1.55,range:88,damage:58,row:1},
 anchorFall:{name:'닻 내려놓기',windup:1.45,active:.28,recover:1.75,range:68,damage:65,wave:37,row:2},
 harpoonRush:{name:'뱃머리 찌르기',windup:1.35,active:.42,recover:1.65,range:94,damage:61,speed:180,row:3},
 lanternCall:{name:'돌아오지 않는 불빛',windup:1.65,active:.28,recover:1.85,range:0,damage:62,pillars:true,row:4},
 twinHook:{name:'되감은 밧줄',windup:1.3,active:.28,recover:1.7,range:92,damage:56,twice:true,secondWindup:.95,row:5},
 chimeSweep:{name:'종축 가르기',windup:1.35,active:.30,recover:1.65,range:112,damage:66,row:1},
 pendulumFall:{name:'멎은 진자',windup:1.65,active:.30,recover:1.85,range:78,damage:72,wave:44,row:2},
 frameRush:{name:'틀의 전진',windup:1.45,active:.44,recover:1.8,range:104,damage:67,speed:175,row:3},
 hollowChorus:{name:'비어 있는 합창',windup:1.85,active:.30,recover:1.95,range:0,damage:68,pillars:true,row:4},
 brokenCadence:{name:'남겨진 박자',windup:1.5,active:.30,recover:1.8,range:114,damage:64,twice:true,secondWindup:1.05,row:5},

 royalCut:{name:'닫힌 성문',windup:1.15,active:.25,recover:1.5,range:128,damage:51,row:1,prep:2,strike:4},
 royalFall:{name:'묵은 새벽',windup:1.5,active:.24,recover:1.65,range:82,damage:58,wave:38,row:2,prep:2,strike:4},
 royalMarch:{name:'왕의 걸음',windup:1.25,active:.40,recover:1.55,range:98,damage:52,speed:185,row:1,prep:2,strike:4},
 royalDawn:{name:'일곱 번째 종',windup:1.7,active:.24,recover:1.7,range:0,damage:55,pillars:true,row:2,prep:2,strike:4},
 royalTwice:{name:'놓지 못한 칼',windup:1.3,active:.24,recover:1.65,range:128,damage:49,twice:true,row:1,prep:2,strike:4},
 sweep:{name:'횡베기',windup:.95,active:.24,recover:1.15,range:118,damage:34,row:1,prep:1,strike:2},
 slam:{name:'종 내려찍기',windup:1.2,active:.22,recover:1.45,range:78,damage:42,wave:30,row:1,prep:3,strike:4},
 lunge:{name:'돌진 찌르기',windup:1.05,active:.4,recover:1.35,range:95,damage:38,speed:225,row:2,prep:2,strike:3},
 double:{name:'두 번 베기',windup:1.05,active:.23,recover:1.35,range:118,damage:35,row:2,prep:4,strike:5,twice:true},
 thrust:{name:'성녀의 지팡이',windup:1,active:.24,recover:1.25,range:126,damage:36,row:1,prep:2,strike:3},
 choir:{name:'돌아오지 않는 목소리',windup:1.25,active:.22,recover:1.4,range:0,damage:30,shot:true,row:1,prep:2,strike:4},
 tide:{name:'낮은 종소리',windup:1.2,active:.22,recover:1.5,range:64,damage:38,wave:32,row:2,prep:2,strike:4},
 knell:{name:'묶인 기도',windup:1.5,active:.24,recover:1.5,range:0,damage:40,pillars:true,row:2,prep:2,strike:4},
 hammer:{name:'모루를 울리는 망치',windup:1.3,active:.24,recover:1.6,range:92,damage:49,wave:34,row:1,prep:2,strike:4},
 furnace:{name:'용광로의 숨',windup:1.6,active:.28,recover:1.65,range:0,damage:46,pillars:true,row:3,prep:2,strike:3},
 forgeSweep:{name:'망치 휘두르기',windup:1.05,active:.26,recover:1.4,range:135,damage:44,row:2,prep:1,strike:3},
 charge:{name:'쇳덩이 돌진',windup:1.2,active:.45,recover:1.5,range:95,damage:46,speed:235,row:2,prep:1,strike:4},
 quill:{name:'행을 가르는 깃펜',windup:1.1,active:.25,recover:1.4,range:128,damage:43,row:1,prep:2,strike:3},
 folio:{name:'접힌 문장',windup:1.35,active:.23,recover:1.5,range:0,damage:35,shot:true,projectile:'page',row:2,prep:2,strike:3},
 redaction:{name:'지워지는 자리',windup:1.6,active:.26,recover:1.6,range:0,damage:45,pillars:true,row:2,prep:2,strike:4},
 footnote:{name:'바닥에 남은 주석',windup:1.3,active:.24,recover:1.55,range:68,damage:41,wave:33,row:2,prep:2,strike:4},
 finalLine:{name:'끝나지 않은 문장',windup:1.2,active:.25,recover:1.5,range:135,damage:44,twice:true,row:1,prep:2,strike:4},
 forgeDouble:{name:'되돌아오는 망치',windup:1.15,active:.25,recover:1.5,range:135,damage:44,row:2,prep:1,strike:3,twice:true}
};
export const BOSS_DEFS={
 edran:{name:'최후의 문지기, 에드란',chapter:1,x:3910,left:3395,right:4235,hp:420,clue:'memento',ability:'echo',patterns:[['sweep','slam','lunge'],['double','slam','lunge','sweep']],intro:'돌아가라. 밖에는 새벽이 오지 않는다.'},
 marie:{name:'침묵의 성녀, 마리에',chapter:2,x:6990,left:6500,right:7380,hp:620,clue:'hymn',ability:'voice',patterns:[['thrust','choir','tide'],['choir','knell','thrust','tide']],intro:'마리에는 입을 열었다. 목에 달린 작은 종만 흔들렸다.'},
 leonel:{name:'기억의 기록관, 레오넬',chapter:4,x:14490,left:14000,right:14900,hp:980,clue:'errata',ability:'memory',patterns:[['quill','folio','footnote'],['finalLine','redaction','folio','footnote']],phaseText:'레오넬이 책의 매듭을 풀었다.',intro:'그 글씨를 알아보는군. …그럼 여기서 멈춰. 다음 장은 읽지 마.'},
 brag:{name:'잿빛 대장장이, 브라그',chapter:3,x:10210,left:9750,right:10740,hp:850,clue:'ledger',ability:'forge',patterns:[['hammer','forgeSweep','furnace'],['charge','hammer','forgeDouble','furnace']],intro:'그 밸브, 네가 잠갔나. …비켜. 아직 안에 사람이 있다.'}
};
BOSS_DEFS.arkein={name:'여명을 지키는 왕, 아르케인 3세',chapter:5,x:21200,left:20600,right:21840,hp:1320,clue:'royalorder',ability:'dawn',patterns:[['royalCut','royalFall','royalMarch'],['royalTwice','royalDawn','royalMarch','royalFall']],intro:'종을 끄러 왔나. …그 뒤에 오는 밤도 네가 맡을 테냐.',phaseText:'왕이 망토를 풀었다. 등 뒤의 창에서 새벽빛이 꺼졌다.'};

BOSS_DEFS.neris={name:'등대를 지키는 자, 네리스',chapter:6,x:26700,left:26100,right:27300,hp:1540,w:46,h:102,artSize:220,clue:'harborLog',ability:'tide',patterns:[['hookCut','anchorFall','harpoonRush'],['twinHook','lanternCall','harpoonRush','anchorFall']],intro:'배는 안 와. 알아. 그래도 불을 끄면… 돌아올 곳마저 없어지잖아.',phaseText:'네리스가 등불의 심지를 올렸다. 물에 비친 배들이 사라졌다.'};
BOSS_DEFS.carillon={name:'빈 종의 잔향, 카리온',chapter:7,x:32300,left:31700,right:33000,hp:1840,w:62,h:118,artSize:276,clue:'conductorNotes',ability:'resonance',patterns:[['chimeSweep','pendulumFall','frameRush'],['brokenCadence','hollowChorus','frameRush','pendulumFall']],intro:'빈 종 안에서, 여러 사람이 같은 말을 했다. “아직 끄지 마.”',phaseText:'종 안의 목소리가 갈라졌다. 청동 틈에서 빛이 새어 나왔다.'};
for(const d of Object.values(BOSS_DEFS))for(const k of ['x','left','right'])d[k]=mapX(d[k]);
export const BOSS_ORDER=['edran','marie','brag','leonel','arkein','neris','carillon'];
export function createBoss(id){const d=BOSS_DEFS[id];return{id,type:id,boss:true,x:d.x,y:302,w:d.w||(id==='brag'?58:48),h:d.h||(id==='marie'?94:id==='leonel'?99:105),hp:d.hp,maxHp:d.hp,vx:0,vy:0,dir:-1,state:'idle',t:0,phase:1,cooldown:1.4,attackIndex:0,stagger:0,dead:false,deathT:0,hit:0,walk:0,targets:[]};}
export function attackRect(e,warning=false){const a=PATTERNS[e.pattern];if(!a)return{x:e.x,y:e.y,w:0,h:0};const reach=a.range+(warning?(a.speed||0)*a.active:0);return{x:e.dir>0?e.x-18:e.x-reach,y:e.y-96,w:reach+18,h:96};}
export function targetRects(e){return(e.targets||[]).map(x=>({x:x-34,y:e.y-104,w:68,h:104}));}
