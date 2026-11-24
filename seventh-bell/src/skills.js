import {workLevel,trainingRank} from './upgrades.js';
export const BRANCHES=[{id:'steel',name:'검술',text:'검에 힘을 싣는 법'},{id:'survival',name:'생존',text:'맞고도 버티는 법'},{id:'breath',name:'기동',text:'숨을 아껴 움직이는 법'},{id:'echo',name:'잔향',text:'파편의 울림을 다루는 법'}];
export const TALENTS={
 edge:{branch:'steel',tier:0,name:'손에 익은 검',desc:'검 공격 피해 +3',cost:1,requires:[]},
 edge2:{branch:'steel',tier:1,name:'날 세우기',desc:'검 공격 피해 추가 +4',cost:1,requires:['edge']},
 cutweight:{branch:'steel',tier:2,name:'무게 싣기',desc:'강공격의 준비와 회수 시간 15% 단축',cost:2,requires:['edge2']},
 riposte:{branch:'steel',tier:2,name:'되받아치기',desc:'패링 후 1.8초 안의 다음 검 공격 피해 +35%',cost:2,requires:['edge2']},
 finisher:{branch:'steel',tier:3,name:'마지막 한 수',desc:'일반 공격 마지막 내려찍기 피해 +20%',cost:2,requires:['cutweight','riposte']},
 vigor:{branch:'survival',tier:0,name:'버티는 몸',desc:'최대 체력 +20 · 현재 체력은 회복되지 않음',cost:1,requires:[]},
 vigor2:{branch:'survival',tier:1,name:'굳은살',desc:'최대 체력 추가 +15',cost:1,requires:['vigor']},
 guard:{branch:'survival',tier:1,name:'단단한 막기',desc:'일반 막기의 집중 소모 18 → 14',cost:1,requires:['vigor']},
 poised:{branch:'survival',tier:2,name:'흔들리지 않는 발',desc:'피격 넉백 25%, 경직 18% 감소',cost:2,requires:['guard']},
 laststand:{branch:'survival',tier:3,name:'아직 서 있다',desc:'체력 30% 이하일 때 받는 피해 10% 감소',cost:2,requires:['vigor2','poised']},
 breath:{branch:'breath',tier:0,name:'고른 호흡',desc:'집중 회복 초당 17 → 24',cost:1,requires:[]},
 reserve:{branch:'breath',tier:1,name:'긴 숨',desc:'최대 집중 +20 · 즉시 보충되지 않음',cost:1,requires:['breath']},
 stride:{branch:'breath',tier:1,name:'짧은 보폭',desc:'회피의 집중 소모 20 → 16',cost:1,requires:['breath']},
 airstep:{branch:'breath',tier:2,name:'공중 균형',desc:'공중 방향 전환 가속 25% 증가',cost:2,requires:['reserve']},
 quickhands:{branch:'breath',tier:3,name:'익숙한 손',desc:'약 마시기 0.8 → 0.65초 · 회복량과 병 수는 그대로',cost:2,requires:['reserve','stride']},
 echo:{branch:'echo',tier:0,name:'남은 울림',desc:'공명 기술 재사용 8 → 6초',cost:1,requires:[]},
 echo2:{branch:'echo',tier:1,name:'겹친 울림',desc:'공명 검이 관통하는 적 1명 추가',cost:1,requires:['echo']},
 echocharge:{branch:'echo',tier:2,name:'깊은 잔향',desc:'공명 검 피해 +20%',cost:2,requires:['echo2']},
 echobond:{branch:'echo',tier:2,name:'붙잡은 흔적',desc:'V로 드러낸 발판의 지속 시간 10 → 14초',cost:1,requires:['echo2']},
 aircut:{branch:'echo',tier:3,name:'허공의 칼끝',desc:'공중 검 공격 피해 +20%',cost:2,requires:['echocharge','airstep']}
};
export function learnReason(p,id){const t=TALENTS[id];if(!t)return '없는 기술';if(p.talents.includes(id))return '이미 익힘';const missing=t.requires.filter(k=>!p.talents.includes(k));if(missing.length)return missing.map(k=>TALENTS[k].name).join(' · ')+' 필요';if(p.points<t.cost)return '깨달음이 부족하다';return null;}
export const has=(p,id)=>p.talents.includes(id);
export const maxStamina=p=>100+(has(p,'reserve')?20:0)+workLevel(p,'reserve')*10+trainingRank(p);
