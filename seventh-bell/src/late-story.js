// Returning null leaves the original chapters' interactions unchanged.
export function interactLate(g,o){
 const p=g.profile,f=p.flags;
 if(o.type==='dockkeeper'){g.tell('부두지기 쪽에서 말을 걸어온다.');return true;}
 if(o.type==='harborway'){g.tell(f.arkein?'왕이 남긴 열쇠로 문을 열었다. 계단 아래에서 바닷바람이 올라온다.':'옥좌를 지키는 왕이 열쇠를 지니고 있다.');return true;}
 if(o.type==='beacon'){g.tell(f.neris==='freed'?'등대가 한 번 길게 빛났다. 네리스는 불을 끄지 않았다.':f.neris==='slain'?'등불은 남아 있다. 심지를 갈 사람이 없어졌다.':'등대는 바다가 아니라, 멈춘 배들을 비추고 있었다.');return true;}
 if(['dockwinch','resonator','towerlens'].includes(o.type)){
  if(!f[o.flag]){f[o.flag]=true;g.gainXp(35);g.sound('mechanism');g.fx(o.x,o.y-25,'echo',1);
   g.tell(o.flag==='harborLock'?'수문이 올라갔다. 아래층 인부가 손을 흔들었다.':o.flag==='towerSeal'?'끊겼던 종축이 맞물렸다. 위층 철문이 열렸다.':'렌즈가 등대 쪽을 향했다. 안쪽 종실로 빛이 이어졌다.');g.save();
  }else g.tell('장치는 제자리에 맞춰져 있다.');return true;
 }
 if(o.type==='dockworker'){
  if(f.harborRescue){g.tell('“집에 가 봐야지. 문이 아직 열리려나.”');return true;}
  if(!f.harborLock){g.tell('“쇠사슬부터 풀어 줘. 이 문은 안에서 안 열려.”');return false;}
  f.harborRescue=true;p.quests.dockkeeper='done';p.marks+=80;p.points++;g.sound('coin');g.tell('인부가 나왔다. 품삯 동전 80개 · 깨달음 +1');g.save();return true;
 }
 if(o.id==='conductor-notes'){
  if(!f.conductorNotes){f.conductorNotes=true;g.gainXp(30);g.save();}g.event('clue',{id:'conductorNotes'});return true;
 }
 if(!['harborcache','tidecache','towercache','resonancecache'].includes(o.id))return null;
 if(p.opened.includes(o.id))return false;
 p.opened.push(o.id);
 if(o.id==='harborcache'){f.harborLog=true;p.marks+=60;g.event('clue',{id:'harborLog'});}
 else{const reward=o.id==='resonancecache'?180:120;p.marks+=reward;p.points++;g.tell((o.id==='resonancecache'?'누나의 작은 공구함':'종축을 잇는 부품')+' · 동전 +'+reward+' · 깨달음 +1');}
 g.sound('coin');g.save();return true;
}

export function dockkeeperScript(profile){const f=profile.flags;
 if(f.harborRescue)return{lines:[f.neris==='freed'?'등대지기가 내려왔어. 밥부터 달라더라. 잘됐지.':f.neris==='slain'?'등대 불이 낮아졌네. 오늘은 내가 올라가야겠어.':'둘 다 돌아왔어. 문밖에서 서로 얼굴만 보고 있더라.','품삯은 그 친구한테 맡겼어. 네 몫까지 챙겼다더군.'],choice:null};
 if(profile.quests.dockkeeper==='active')return{lines:[f.harborLock?'수문 열리는 소리가 들렸어. 아래쪽 인부한테도 한마디 해 줘.':'선착장 아래 권양기를 돌려 줘. 갇힌 친구가 아직 거기 있어.','등대는 네리스가 지켜. 배가 돌아오는 걸 봐야 한다면서.'],choice:null};
 return{lines:['바다가 멈춘 날, 배 세 척이 안 들어왔어. 저 불은 그때부터 켜져 있지.','난 부두지기 도란이야. 아래 수문에 같이 일하던 친구가 갇혔어.','권양기만 돌리면 나올 수 있어. 구해 주면 밀린 품삯을 나눠 줄게.'],choice:'dock'};
}
