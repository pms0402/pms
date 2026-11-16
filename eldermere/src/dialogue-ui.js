import {CHARACTERS,portraitPosition,readingDuration} from './characters.js';
export function createDialogue({game,close,onOpen,onHide}){
 const panel=document.querySelector('#conversation'),name=panel.querySelector('.conversation-name'),role=panel.querySelector('.conversation-role'),traits=panel.querySelector('.conversation-traits'),art=panel.querySelector('.conversation-portrait'),text=panel.querySelector('.conversation-text'),actions=panel.querySelector('.conversation-actions'),next=panel.querySelector('.conversation-next');
 let lines=[],index=0,choices=[],speaker='',back=null;
 function draw(){text.textContent=lines[index]||'';panel.querySelector('.conversation-page').textContent=lines.length>1?`${index+1} / ${lines.length}`:'';next.hidden=index>=lines.length-1;next.textContent='계속 듣기  ↵';actions.replaceChildren();if(index>=lines.length-1)for(const choice of choices){const b=document.createElement('button');b.className=choice.primary?'primary':'secondary';b.textContent=choice.label;if(choice.id)b.id=choice.id;b.disabled=!!choice.disabled;b.onclick=choice.action;actions.append(b);}panel.querySelector('#dialog-done').textContent='대화 마치기';}
 function show(id,dialogue,options=[]){const profile=CHARACTERS[id]||CHARACTERS.elder;speaker=id;lines=dialogue;index=0;choices=options;if(panel.hidden)back=document.activeElement;onOpen();game.paused=true;panel.hidden=false;panel.style.setProperty('--speaker-color',profile.color||'#c7b57b');name.textContent=profile.name;role.textContent=profile.title;traits.textContent=profile.traits.join(' · ');art.style.backgroundPosition=portraitPosition(id);art.setAttribute('aria-label',profile.name+'의 얼굴 초상화');draw();panel.focus({preventScroll:true});}
 function hide(){panel.hidden=true;onHide?.();}
 function advance(){if(panel.hidden)return false;if(index<lines.length-1){index++;draw();}else panel.querySelector('.conversation-actions button:not(:disabled)')?.focus();return true;}
 next.onclick=advance;panel.querySelector('#dialog-done').onclick=close;
 return {show,hide,advance,get visible(){return !panel.hidden;},get speaker(){return speaker;}};
}
export function createNotices(){const box=document.querySelector('#notice-stack'),queue=[];let current=null,deadline=0,left=0,timer,paused=false,suspended=false;
 const later=()=>{clearTimeout(timer);deadline=performance.now()+left;if(!paused&&!suspended)timer=setTimeout(dismiss,left);};
 function dismiss(){clearTimeout(timer);box.classList.remove('shown');box.hidden=true;current=null;if(queue.length)display(queue.shift());}
 function display(notice){current=notice;box.hidden=false;box.querySelector('.notice-title').textContent=notice.title;box.querySelector('.notice-body').textContent=notice.text;left=readingDuration(notice.text);box.style.setProperty('--notice-time',left+'ms');box.classList.remove('shown');void box.offsetWidth;box.classList.add('shown');box.classList.toggle('reading',paused||suspended);later();}
 function show(title,text){if(current?.text===text||queue.some(n=>n.text===text))return;if(current){queue.push({title,text});return;}display({title,text});}
 box.querySelector('button').onclick=dismiss;
 box.addEventListener('pointerenter',()=>{paused=true;left=Math.max(0,deadline-performance.now());clearTimeout(timer);box.classList.add('reading');});box.addEventListener('pointerleave',()=>{paused=false;box.classList.toggle('reading',suspended);if(current)later();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&current){left=Math.max(0,deadline-performance.now());clearTimeout(timer);}else if(current)later();});
 return {show,dismiss,suspend(flag){if(flag&&!suspended){if(current&&!paused)left=Math.max(0,deadline-performance.now());clearTimeout(timer);suspended=true;box.classList.add('reading');}else if(!flag&&suspended){suspended=false;box.classList.toggle('reading',paused);if(current)later();}},get current(){return current;},get queued(){return queue.length;}};
}
