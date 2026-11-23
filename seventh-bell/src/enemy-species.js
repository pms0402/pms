const rows=[
 ['patrol','성벽 순찰병','guard',88,22,48,46,.76,2,66],['crossbow','폐허 석궁병','ranged',68,22,46,42,1.05,1,250],['raven','성벽 까마귀','dive',58,32,26,85,.9,1,210],
 ['monk','침묵의 수도사','monk',112,22,51,32,1.05,1,78],['choirghost','성가의 망령','notes',85,28,45,57,1.2,1,260],['devotee','종을 든 신도','support',130,28,42,28,1.15,1,76],
 ['worker','쇳가루 노동자','pick',140,23,45,53,.8,2,62],['orecart','용광로 운반병','cart',195,56,48,44,1.2,1,210],['emberling','불씨 정령','ember',100,34,25,68,.95,1,210],
 ['bookguard','기록의 수호자','bookguard',184,29,54,30,1.15,1,85],['paperghost','종이 망령','paper',116,32,38,58,1.18,1,270],['inkworm','잉크 벌레','ink',118,37,22,73,.65,1,48],
 ['royalguard','왕실 근위병','duelist',210,25,52,65,.86,3,92],['spearman','왕궁 창병','spear',165,24,53,44,1.05,1,132],['royalmage','왕실 마도사','mage',142,25,50,43,1.25,1,300],
 ['drowned','침수된 선원','hook',205,25,49,62,1,1,145],['harpooner','부두 작살병','harpoon',175,28,49,34,1.25,1,350],['lanternwraith','등불 망령','lantern',138,30,40,80,1.2,1,290],
 ['shaftpuppet','종축 인형','rhythm',240,25,51,44,.95,3,86],['echocopy','잔향 복제체','copy',205,24,49,72,.87,2,78],['resonator','공명 부유체','resonator',165,34,38,54,1.35,1,300]
];
export const SPECIES=Object.fromEntries(rows.map(([id,name,role,hp,w,h,speed,windup,combo,reach],i)=>[id,{id,name,role,hp,w,h,speed,windup,combo,reach,chapter:1+Math.floor(i/3),slot:i%3,sheet:'foes-'+(1+Math.floor(i/3)),flying:['dive','notes','paper','lantern','resonator'].includes(role)}]));
export const CHAPTER_ENEMIES=Array.from({length:7},(_,i)=>Object.keys(SPECIES).slice(i*3,i*3+3));
export function makeSpecies(e,id){const d=SPECIES[id];return{...e,type:id,rank:d.chapter-1,w:d.w,h:d.h,hp:d.hp,maxHp:d.hp,flying:d.flying,cooldown:1.4,guardHits:0,attackCycle:0,beat:0,elite:!!e.elite};}
export function nativeEnemyPose(e){const d=SPECIES[e.type];if(!d)return null;let row=d.slot*3,col=0;
 if(e.dead){row+=2;col=Math.min(5,3+Math.floor(e.deathT*3));}
 else if(e.stagger>0){row+=2;col=2;}
 else if(e.shielding&&['idle','guard'].includes(e.state)){row+=2;col=e.state==='guard'?1:0;}
 else if(e.state==='windup'){row++;col=Math.min(2,Math.floor(e.t/(e.prep||d.windup)*3));}
 else if(e.state==='attack'){row++;col=e.t<.12?3:4;if(['rhythm','duelist'].includes(d.role))col=Math.min(5,(e.beat||0)*2+1);}
 else if(e.state==='recover'&&e.t<.2){row++;col=5;}
 else col=Math.floor((e.walk||0)/44*6)%6;
 return{sheet:d.sheet,row,col,size:d.role==='cart'?140:d.role==='ink'?96:112};
}
