import {mapX,roomStart,EXTENSIONS} from './layout.js';
export const ROUTE_KEYS=['wall','cathedralUpper','foundryPower','archiveShift','archivePass','palaceBridge','harborSluice','harborBeacon','towerGear','towerResonator','towerAscent'];
export const newRoutes=()=>Object.fromEntries(ROUTE_KEYS.map(k=>[k,false]));
const inserted=id=>roomStart(EXTENSIONS.find(r=>r.id===id));
export const ROUTE_GATES=[
 {key:'wall',boss:'edran',x:inserted('yard')+1250},
 {key:'cathedralUpper',boss:'marie',x:inserted('procession')+1700},
 {key:'foundryPower',boss:'brag',x:inserted('ash')+2070},
 {key:'archivePass',boss:'leonel',x:inserted('atlas')+2120},
 {key:'palaceBridge',boss:'arkein',x:mapX(18440)},
 {key:'harborBeacon',boss:'neris',x:mapX(26000)},
 {key:'towerAscent',boss:'carillon',x:mapX(28740)}
];
export const ROUTE_CACHES=['wall','cathedral','foundry','archive','palace','harbor','tower'].map(k=>'route-'+k+'-cache');
export const MACHINE_IDS=['crypt-lift','choir-hoist','ore-carrier','foundry-hoist','wall-hoist','archive-booklift','tower-gear-a','tower-gear-b','tower-gear-c','palace-hoist','tower-lower','tower-middle','tower-upper','tower-return'];
export const ROUTE_AREAS=[
 {chapter:1,name:'버려진 성벽 마을',kind:'village'},{chapter:1,name:'외벽 순찰로',kind:'climb'},{chapter:1,name:'갈라진 순례교와 병영',kind:'detour'},
 {chapter:2,name:'중앙 종 승강로',kind:'vertical'},{chapter:2,name:'지하 묘실',kind:'crypt'},{chapter:2,name:'상층 성가 회랑',kind:'voice'},
 {chapter:3,name:'운반 발판',kind:'conveyor'},{chapter:3,name:'증기 압력로',kind:'timing'},{chapter:3,name:'냉각실과 대장간',kind:'cooling'},
 {chapter:4,name:'색인 갈림길',kind:'switch'},{chapter:4,name:'움직이는 책장',kind:'maze'},{chapter:4,name:'위층 비밀 기록실',kind:'memory'},
 {chapter:5,name:'왕궁 정원',kind:'approach'},{chapter:5,name:'지하 기계실',kind:'basement'},{chapter:5,name:'무기고와 높은 회랑',kind:'shortcut'},
 {chapter:6,name:'폐선 아래 물길',kind:'water'},{chapter:6,name:'상층 화물로',kind:'upper'},{chapter:6,name:'등대 절벽길',kind:'cliff'},
 {chapter:7,name:'아래 종축실',kind:'engine'},{chapter:7,name:'중층 회전 발판',kind:'moving'},{chapter:7,name:'위층 렌즈와 종 내부',kind:'tower'}
];
