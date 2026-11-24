export const STORY_ORDER=['edran','marie','brag','leonel','arkein','neris','carillon'];
export const newStory=()=>({seen:[],endingSeen:null,pending:null});
const memory=(index,speaker,text,focus=[.5,.5],zoom=1)=>({atlas:'story-scenes',index,speaker,text,focus,zoom,duration:Math.max(5,text.replaceAll('\n','').length*.09+1.8)});
const finale=(index,speaker,text,focus=[.5,.5],zoom=1)=>({...memory(index,speaker,text,focus,zoom),atlas:'finale-scenes'});
const titles=['닫힌 문 바깥','맡겨 둔 목소리','사람을 들이지 말 것','아직 쓰지 않은 삶','한 번만 더','돌아올 곳','종 안에 남은 사람'];
const opening=[
 ['문 너머에서 아이가 울었다.\n에드란의 손은 빗장에서 떨어지지 않았다.','밖으로 나가는 사람들까지 막은 거야?','성당으로 보낸 명부에서 한 줄이 비어 있었다.\n누나의 편지와 같은 종이였다.'],
 ['성가대석에 작은 종들이 놓여 있었다.\n종마다 다른 목소리로 울었다.','빼앗은 목소리를 여기 모아 둔 거야?','종을 달던 쇠고리는 제철도시의 물건이었다.\n납품처에는 ‘여명 연료실’이라고 적혀 있었다.'],
 ['화로 옆에는 장작 대신 장갑이 쌓여 있었다.\n사람들은 불 앞에서도 손을 떨었다.','불은 이렇게 센데, 왜 다들 떨고 있어?','열이 지나간 관은 서고 지하로 이어졌다.\n장부의 비용란에는 동전이 적혀 있지 않았다.'],
 ['책 속의 아이는 자라서 화가가 되어 있었다.\n다음 장을 넘기자 그 그림들이 사라졌다.','이건 일어난 일이 아니야. 아직… 안 일어났어.','닫힌 독서대 위에 입탑 명부가 남아 있었다.\n일곱 번째 종탑으로 들어간 사람들의 기록이었다.'],
 ['왕은 종의 밧줄을 쥔 채 앉아 있었다.\n책상에는 첫해의 사망자 명부가 놓여 있었다.','알면서도 여든일곱 해를 울린 거야?','왕궁 뒤의 계단은 항구로 이어졌다.\n누나가 적어 둔 장치 번호가 등대 지도에도 있었다.'],
 ['등대 장부에는 같은 배 이름이 적혀 있었다.\n‘미귀항.’ 그 아래도, 그 아래도.','그 배는 이제 안 와.','등대 아래 연결선이 해안 절벽을 돌아 나갔다.\n그 끝에서 일곱 번째 종이 울렸다.']
];
const freed=[
 '밖으로 보냈던 사람 중에 돌아온 사람은 없었다.\n…그래서 문을 닫았다.',
 '빼앗은 게 아니야. 오늘치만 맡아 둔 거야.\n안 주면, 종이 다른 걸 가져가.',
 '장작으론 안 돼. 살아 있는 온기만 받아.\n그래서 밸브를 잠갔다. 내가 잠갔어.',
 '종이 태우는 건 목숨이 아니야.\n그 사람들이 될 수 있었던 것들이지.',
 '한 번만 더 울리면 될 줄 알았다.\n그 한 번이… 여기까지 왔구나.',
 '알아. 하지만 불을 끄면,\n돌아올 곳마저 없어지잖아.'
];
const slain=[
 '열쇠로 문을 열자 바깥을 향한 발자국이 보였다.\n돌아온 자국은 없었다.',
 '부서진 종에서 웃음소리가 흘렀다.\n창밖의 새벽빛이 가늘어졌다.',
 '대장장이의 장부에는 같은 줄이 되풀이돼 있었다.\n‘사람을 화로에 들이지 말 것.’',
 '찢긴 장 사이에서 한 문장이 남았다.\n‘여명 한 회 — 주민의 미래 가능성 소모.’',
 '왕의 손에서 오래된 열쇠가 떨어졌다.\n‘피난민용 장작 창고.’ 닳아 버린 글씨였다.',
 '깨지지 않은 등불이 바다를 비췄다.\n불빛이 닿는 곳에는 배 대신 빗줄기만 있었다.'
];
const names=['에드란','마리에','브라그','레오넬','아르케인','네리스'];
export function bossStory(id,outcome){const n=STORY_ORDER.indexOf(id);if(n<0||!['freed','slain'].includes(outcome))return null;
 if(id==='carillon')return{id,title:titles[6],kind:'boss',cue:'bell',shots:[finale(0,'','빈 종 안에서 여러 사람이 한꺼번에 숨을 내쉬었다.\n아직 태어나지 않은 목소리들이었다.',[.5,.35]),finale(0,outcome==='freed'?'작은 목소리':'',outcome==='freed'?'내일, 나가도 돼?':'아무것도 남지 않은 줄 알았다.\n청동 틈에서 누나의 목소리가 들렸다.',[.5,.25],1.12),finale(0,'수리공','…누나?',[.35,.5],1.06),finale(0,'누나','종을 멈추면 밤이 와.\n계속 울리면 사람들한테서 내일을 가져가.',[.64,.44],1.08),finale(0,'누나','다른 방법을 찾으려고 여기 들어왔어.\n나를 잊게 될 줄도 알았고.',[.63,.47],1.08),finale(0,'누나','이젠 네가 정해 줘.\n밖에 남은 사람들 얼굴을 보고.',[.5,.5])]};
 return{id,title:titles[n],kind:'boss',cue:id==='brag'?'mechanism':id==='neris'?'echo':'bell',shots:[memory(n,'',opening[n][0],[.48,.5]),memory(n,'수리공',opening[n][1],[.46,.5],1.05),memory(n,outcome==='freed'?names[n]:'',outcome==='freed'?freed[n]:slain[n],[.53,.46],1.1),memory(n,'',opening[n][2],[.56,.48])]};
}
export const ENDING_TITLES={today:'영원한 오늘',night:'진정한 밤',dawn:'여명의 잔향'};
export function endingStory(choice){const title=ENDING_TITLES[choice];if(!title)return null;const lines={
 today:[['','수리공은 왕의 열쇠를 받았다.\n다음 날에도 종이 울렸다.'],['','빵집이 문을 열고,\n아이들은 같은 길로 학교에 갔다.'],['아이','엄마, 내일은 뭐가 달라져?'],['','어머니는 앞치마에 손을 닦았다.\n대답할 말이 떠오르지 않았다.']],
 night:[['','마지막 종이 갈라졌다.\n왕국에서 새벽빛이 꺼졌다.'],['','누군가 성냥을 켰다.\n옆 사람이 두 손으로 바람을 막았다.'],['','멀리, 집 한 채의 창이 밝아졌다.\n조금 뒤에는 그 옆집에도 불이 들어왔다.']],
 dawn:[['','연결한 종축이 천천히 돌았다.\n왕궁의 빛이 가늘어지고, 먼 마을의 창들이 밝아졌다.'],['누나','이제 가도 되겠다.'],['','아침은 전보다 어두웠다.\n길에서는 사람들이 오늘 할 일을 두고 다투고 있었다.']]
 };const index={today:1,night:2,dawn:3}[choice];return{id:choice,title,kind:'ending',cue:choice==='night'?'shatter':'bell',shots:lines[choice].map(([speaker,text],i)=>finale(index,speaker,text,choice==='today'&&i>=2?[.2,.7]:choice==='night'?[.48,.64]:[.48,.5],choice==='today'&&i>=2?1.45:i===1?1.12:1))};
}
