import {dockkeeperScript} from './late-story.js';
export function elmaScript(profile){const f=profile.flags;
 const greeting=f.edran==='freed'?'문지기가 내려왔더라. 이름을 물었는데, 한참을 생각했어.':f.edran==='slain'?'종은 울리는데 골목이 어두워. 아까는 이렇지 않았어.':'문은 아직 닫혀 있어. 아래 묘지에 장치가 하나 남아 있을 거야.';
 if(profile.quests.elma==='done')return{lines:[greeting,'덕분에 금은 다 메웠어. 오늘 밤은 넘기겠네. 고맙다.'],choice:null};
 if(profile.quests.elma==='active')return f.lead?{lines:['찾아왔구나. 납은 이쪽에 놓아줘.'],choice:'deliver'}:{lines:['보급함은 순례교 위쪽에 있어. 무너진 발판을 타고 올라가면 돼.','난 여기 있을게. 발밑 조심하고.'],choice:null};
 return f.lead?{lines:[greeting,'손에 든 건 종 수리할 때 쓰는 납이네.','내 종에 금이 갔어. 조금 나눠 줄 수 있겠니? 값은 줄게.'],choice:'accept'}:{lines:[greeting,'네 집 열쇠는 내가 고쳐 줬지. …누구랑 살았더라.','종에 금이 갔어. 순례교 보급함에 납이 좀 남아 있을 텐데.','찾으면 가져다줄래? 동전 스무 개는 줄 수 있어.'],choice:'accept'};
}
// World-clock timing keeps speech in step with menus and never pauses the game.
export class ProximitySpeech{
 constructor(game){this.g=game;this.visit=null;}
 reset(){this.visit=null;}
 update(visible=true){const g=this.g,npc=g.world.objects.filter(o=>['salvager','dockkeeper'].includes(o.id)).sort((a,b)=>Math.abs(g.p.x-a.x)-Math.abs(g.p.x-b.x))[0];if(!npc||g.p.dead||g.bossActive||Math.abs(g.p.x-npc.x)>154||Math.abs(g.p.y-npc.y)>115){this.reset();return null;}if(!visible)return null;
 const signature=[npc.id,g.profile.quests.elma,g.profile.flags.lead,g.profile.flags.edran,g.profile.quests.dockkeeper,g.profile.flags.harborLock,g.profile.flags.harborRescue,g.profile.flags.neris].join(':');const script=()=>npc.id==='dockkeeper'?dockkeeperScript(g.profile):elmaScript(g.profile);if(!this.visit){if(Math.abs(g.p.x-npc.x)>120||Math.abs(g.p.y-npc.y)>90)return null;this.visit={signature,script:script(),index:0,since:g.clock,dismissed:false};}else if(this.visit.signature!==signature)this.visit={signature,script:script(),index:0,since:g.clock,dismissed:false};
 const v=this.visit;if(v.dismissed)return null;let line=v.script.lines[v.index],duration=line.length*.034+2.6;
 while(g.clock-v.since>duration&&v.index<v.script.lines.length-1){v.since+=duration;v.index++;line=v.script.lines[v.index];duration=line.length*.034+2.6;}
 const elapsed=Math.max(0,g.clock-v.since),last=v.index===v.script.lines.length-1,typing=line.length*.034;if(last&&!v.script.choice&&elapsed>typing+5){v.dismissed=true;return null;}
 return{npc,line,text:[...line].slice(0,Math.floor(elapsed/.034)+1).join(''),index:v.index,last,complete:elapsed>=typing,choice:last&&elapsed>=typing+.4?v.script.choice:null};
 }
 advance(){const v=this.visit;if(!v)return;const line=v.script.lines[v.index],elapsed=this.g.clock-v.since;if(elapsed<line.length*.034)v.since=this.g.clock-line.length*.034;else if(v.index<v.script.lines.length-1){v.index++;v.since=this.g.clock;}else if(!v.script.choice)v.dismissed=true;}
 dismiss(){if(this.visit)this.visit.dismissed=true;}
}
export function createSpeechUI({game:g,render,root,workshop}){
 const speech=new ProximitySpeech(g),name=root.querySelector('.speech-name'),copy=root.querySelector('.speech-copy'),text=root.querySelector('.speech-text'),choices=root.querySelector('.speech-choices');let lastChoice='';
 name.textContent='엘마';copy.onclick=()=>{speech.advance();document.querySelector('#world').focus({preventScroll:true});};
 function update(visible){const line=speech.update(visible);root.hidden=!line;if(!line){lastChoice='';choices.replaceChildren();return;}name.textContent=line.npc.id==='dockkeeper'?'도란':'엘마';text.textContent=line.text;copy.setAttribute('aria-label',line.complete?'다음 말':'이 말 끝까지 보기');
 const key=[line.npc.id,line.choice,g.profile.quests.elma,g.profile.flags.lead].join(':');if(key!==lastChoice){lastChoice=key;choices.replaceChildren();if(line.choice){const yes=document.createElement('button');yes.id=line.choice==='dock'?'accept-dock':line.choice==='accept'?'accept-elma':'deliver-elma';yes.className='speech-accept';yes.textContent=line.choice==='dock'||line.choice==='accept'?'부탁을 수락한다':'납을 건넨다';yes.onclick=e=>{e.stopPropagation();line.choice==='dock'?g.acceptDockQuest():line.choice==='accept'?g.acceptQuest():g.help();document.querySelector('#world').focus({preventScroll:true});update(visible);};choices.append(yes);const later=document.createElement('button');later.id=line.npc.id==='dockkeeper'?'later-dock':'later-elma';later.textContent='나중에';later.onclick=e=>{e.stopPropagation();speech.dismiss();root.hidden=true;document.querySelector('#world').focus({preventScroll:true});};choices.append(later);}}
 const bounds=root.parentElement.getBoundingClientRect(),width=Math.min(310,bounds.width-32);root.style.width=width+'px';const anchorX=(line.npc.x-render.x)/render.width*bounds.width,anchorY=(line.npc.y-68-render.y)/render.height*bounds.height;const left=Math.max(16,Math.min(bounds.width-width-16,anchorX-width*.48));const height=root.offsetHeight,top=Math.max(bounds.height<450?72:108,Math.min(bounds.height-height-94,anchorY-height-15));root.style.left=Math.round(left)+'px';root.style.top=Math.round(top)+'px';root.style.setProperty('--tail',Math.max(18,Math.min(width-18,anchorX-left))+'px');
 }
 return{update,model:speech};
}
