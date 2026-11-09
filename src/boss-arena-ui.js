import './boss-arena-ui.css';
let root,lastId,lastText;
export function updateBossArenaUI(game,state){
  if(!root){root=document.createElement('div');root.className='boss-arena-ui';root.innerHTML='<div class="boss-arena-rule hidden"><span></span><small></small></div><div class="boss-arena-cue hidden" role="status" aria-live="polite"><small></small><strong></strong><span></span><button type="button">Enter · 연출 건너뛰기</button></div>';document.querySelector('#arena').append(root);root.querySelector('button').onclick=()=>game.bossArena.skip();}
  root.querySelector('button').onclick=()=>game?.bossArena.skip();
  const arena=state.bossArena,cue=arena?.cue,visible=state.phase==='playing',rule=root.children[0],banner=root.children[1];
  rule.classList.toggle('hidden',!arena||!visible);banner.classList.toggle('hidden',!cue||!visible);
  if(arena){const text=arena.title+'|'+arena.phase+'|'+arena.changing+'|'+arena.won;if(lastText!==text){lastText=text;rule.firstElementChild.textContent=arena.title+' · '+(arena.changing?'지형 변화 예고':arena.won?'전장 정복':'PHASE '+arena.phase);rule.lastElementChild.textContent=arena.won?'출구에서 C · 탐험으로 복귀':arena.rule;}}
  if(cue&&lastId!==cue.id){lastId=cue.id;banner.dataset.kind=cue.kind;banner.firstElementChild.textContent=cue.kind==='intro'?cue.epithet:cue.kind==='victory'?'전장 정복 · VICTORY':arena.changing===3?'최종 페이즈 · FINAL PHASE':'전장 변화 · PHASE II';banner.querySelector('strong').textContent=cue.name;banner.querySelector('span').textContent=arena.title;}
}
