// Progress is earned in the world. Gold can prepare a character, never grant a boss clear.
export const CHAPTERS=[
 {boss:'guardian',name:'숲의 맹세',map:'dungeon',level:1,x:1490,y:281,unlock:'은 광맥 · 별콩 · 목장 시설',reward:'ancientShard',gold:90,xp:90},
 {boss:'emberlord',name:'잿불의 왕관',map:'ember',level:3,x:1840,y:570,unlock:'금 광맥 · 불씨고추 · 고급 축사',reward:'emberCore',gold:200,xp:210},
 {boss:'frostqueen',name:'서리 속의 약속',map:'frost',level:5,x:2220,y:820,unlock:'미스릴 · 서리연꽃 · 관개 시설',reward:'frostHeart',gold:360,xp:330},
 {boss:'riftkeeper',name:'잊힌 별의 문',map:'rift',level:7,x:2370,y:260,unlock:'별의 장비 · 유물 공방 · 계곡의 미래',reward:'starSigil',gold:600,xp:500}
];
export const MATERIAL_GATES={copper:{stage:0,level:1},iron:{stage:0,level:2},silver:{stage:1,level:3},gold:{stage:2,level:5},mythril:{stage:3,level:7}};
export const CLASSES={
 warrior:{name:'서약의 기사',color:'#d8b17d',desc:'넓은 검격과 방어 태세. 무기 종류와 관계없이 전열을 지킵니다.',skills:[{id:'cleave',name:'초승달 베기',key:'R',desc:'전방 넓은 부채꼴에 공격력 1.7배',cost:22,cooldown:5},{id:'guard',name:'불굴의 서약',key:'T',desc:'5초 동안 받는 피해 55% 감소',cost:25,cooldown:13}]},
 ranger:{name:'바람의 순찰자',color:'#a7c894',desc:'거리 조절과 사격. 올가미로 적을 묶고 연속 화살을 날립니다.',skills:[{id:'volley',name:'바람살 연사',key:'R',desc:'세 방향으로 화살, 각각 공격력 0.75배',cost:23,cooldown:6},{id:'snare',name:'가시덩굴 올가미',key:'T',desc:'가까운 적에게 피해와 4초 둔화',cost:24,cooldown:10}]},
 mage:{name:'별무리 학자',color:'#9bb9d8',desc:'별과 서리의 마법. 근접 무기를 들어도 마법을 사용할 수 있습니다.',skills:[{id:'nova',name:'서리꽃 파동',key:'R',desc:'주위 적에게 공격력 1.3배와 3초 둔화',cost:28,cooldown:7},{id:'blink',name:'별빛 걸음',key:'T',desc:'바라보는 방향으로 빠르게 이동 · 짧은 무적',cost:20,cooldown:7}]},
 rogue:{name:'황혼의 길잡이',color:'#c7a0c1',desc:'짧은 틈을 노리는 기동 전투. 급습과 연막으로 기회를 만듭니다.',skills:[{id:'lunge',name:'그림자 급습',key:'R',desc:'앞으로 파고들며 공격력 2배 타격',cost:22,cooldown:5},{id:'smoke',name:'달그림자 연막',key:'T',desc:'짧은 무적과 기력 회복 · 적의 움직임 둔화',cost:18,cooldown:12}]}
};
export function newRpg(){return{class:null,learned:{},clears:[],kills:{},contracts:{},cooldowns:{},buffs:{guard:0,focus:0},storySeen:false};}
export function stageAt(s){const clears=s.rpg?.clears||[];let n=0;for(const c of CHAPTERS){if(!clears.includes(c.boss))break;n++;}return n;}
export function materialReason(s,material,gear=false){const req=MATERIAL_GATES[material];if(!req)return'';if(stageAt(s)<req.stage)return CHAPTERS[req.stage-1].name+' 보스 처치 필요';if(gear&&s.player.level<req.level)return'전투 Lv.'+req.level+' 필요';return'';}
export function itemReason(s,id){const metal=Object.keys(MATERIAL_GATES).find(k=>id===k+'Ore'||id===k+'Bar');if(metal)return materialReason(s,metal);const req=({starbean:1,starbeanSeed:1,emberPepper:2,emberPepperSeed:2,frostLotus:3,frostLotusSeed:3,rareFish:1})[id];return req&&stageAt(s)<req?CHAPTERS[req-1].name+' 보스 처치 필요':'';}
export function nodesFor(classId){const c=CLASSES[classId];if(!c)return[];return[
 {id:classId+'_active1',name:c.skills[0].name,desc:c.skills[0].desc,level:1,stage:0,cost:1,branch:'전투 기술'},
 {id:classId+'_vigor',name:'단단한 기초',desc:'최대 체력 +15',level:1,stage:0,cost:1,branch:'생존'},
 {id:classId+'_active2',name:c.skills[1].name,desc:c.skills[1].desc,level:2,stage:0,cost:1,parent:classId+'_active1',branch:'전투 기술'},
 {id:classId+'_edge',name:'전투의 감각',desc:'공격력 +3',level:2,stage:0,cost:1,parent:classId+'_vigor',branch:'생존'},
 {id:classId+'_mastery1',name:c.skills[0].name+' · 숙련',desc:'첫 기술 피해/효과 30% 강화',level:3,stage:1,cost:2,parent:classId+'_active1',branch:'전투 기술'},
 {id:classId+'_endurance',name:'먼 길의 호흡',desc:'기력 회복 초당 +8',level:3,stage:1,cost:1,parent:classId+'_edge',branch:'생존'},
 {id:classId+'_mastery2',name:c.skills[1].name+' · 숙련',desc:'둘째 기술 재사용 시간 25% 감소',level:5,stage:2,cost:2,parent:classId+'_active2',branch:'전투 기술'},
 {id:classId+'_legacy',name:'별을 잇는 자',desc:'공격력 +5 · 방어력 +3',level:7,stage:3,cost:2,parent:classId+'_endurance',branch:'생존'}
 ];}
export function learned(s,key){return !!s.rpg?.learned[(s.rpg?.class||'')+'_'+key];}
export function skillPoints(s){const earned=Math.min(30,s.player.level)+stageAt(s)*2;const spent=nodesFor(s.rpg?.class).filter(n=>s.rpg.learned[n.id]).reduce((v,n)=>v+n.cost,0);return earned-spent;}
export function nodeReason(s,node){if(!node)return'존재하지 않는 기술';if(s.rpg.learned[node.id])return'습득 완료';if(s.player.level<node.level)return'Lv.'+node.level+' 필요';if(stageAt(s)<node.stage)return'챕터 '+node.stage+' 보스 처치 필요';if(node.parent&&!s.rpg.learned[node.parent])return'앞선 기술을 먼저 배우세요';if(skillPoints(s)<node.cost)return'기술 점수 부족';return'';}
export const CONTRACTS={slimes:{name:'길목의 슬라임',type:'slime',qty:4,gold:55,xp:45,stage:0},wolves:{name:'들판을 지켜라',type:'wolf',qty:3,gold:90,xp:70,stage:0},depths:{name:'광부들의 귀환',type:'caveguard',qty:2,gold:140,xp:100,stage:1},embers:{name:'잿불 정찰대',type:'emberling',qty:3,gold:180,xp:140,stage:1},frost:{name:'얼어붙은 발자국',type:'frostling',qty:3,gold:240,xp:200,stage:2}};
export function validRpg(r,level=99){const rec=o=>o&&typeof o==='object'&&!Array.isArray(o),nat=n=>Number.isSafeInteger(n)&&n>=0&&n<1e9;if(!rec(r)||(r.class!==null&&!Object.hasOwn(CLASSES,r.class))||!rec(r.learned)||!Array.isArray(r.clears)||new Set(r.clears).size!==r.clears.length||r.clears.some((b,i)=>CHAPTERS[i]?.boss!==b)||!rec(r.kills)||!Object.values(r.kills).every(nat)||!rec(r.contracts)||!rec(r.cooldowns)||!rec(r.buffs))return false;for(const cls of Object.keys(CLASSES)){const known=nodesFor(cls).filter(n=>r.learned[n.id]);if(known.reduce((v,n)=>v+n.cost,0)>Math.min(30,level)+r.clears.length*2||known.some(n=>n.level>level||n.stage>r.clears.length||n.parent&&!r.learned[n.parent]))return false;}const all=new Set(Object.keys(CLASSES).flatMap(c=>nodesFor(c).map(n=>n.id)));if(!Object.entries(r.learned).every(([k,v])=>all.has(k)&&v===true))return false;if(!Object.entries(r.contracts).every(([id,c])=>CONTRACTS[id]&&rec(c)&&nat(c.start)&&Number.isSafeInteger(c.day)&&c.day>=-1&&typeof c.active==='boolean'))return false;return Object.values(r.cooldowns).every(n=>Number.isFinite(n)&&n>=0&&n<=60)&&Object.values(r.buffs).every(n=>Number.isFinite(n)&&n>=0&&n<=60)&&['guard','focus'].every(k=>Number.isFinite(r.buffs[k])&&r.buffs[k]>=0&&r.buffs[k]<=60);}
