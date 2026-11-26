// Input-only controller shared by unit and browser checks. It never grants
// position, health, equipment, money, lesson completion or enemy damage.
export function tickTutorial(g,t,held={}){for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120,held);}
export function walkTutorial(g,x){let i=0;while(Math.abs(g.p.x-x)>5&&i++<4000){if(g.paused||g.p.dead)throw Error('Tutorial route interrupted');g.update(1/120,{right:g.p.x<x,left:g.p.x>x});}tickTutorial(g,.15);if(Math.abs(g.p.x-x)>20)throw Error('Tutorial route blocked at '+g.p.x+' -> '+x);}
export function reachTrainingKnight(g){walkTutorial(g,280);g.press('jump');tickTutorial(g,.73,{right:true,jump:true});if(g.profile.tutorial.step!==2)throw Error('No landing proof '+g.profile.tutorial.step+' at '+g.p.x+','+g.p.y);walkTutorial(g,940);tickTutorial(g,3);}
export function faceTrainer(g){const e=g.world.enemies[0],d=e.x-g.p.x;if(g.p.dir!==Math.sign(d)&&!g.p.action)tickTutorial(g,.025,{right:d>0,left:d<0});}
export function trainUntil(g,step=8){for(let i=0;i<24000;i++){const t=g.profile.tutorial,e=g.world.enemies[0],p=g.p;if(t.step>=step)return{step:t.step,hp:p.hp,flasks:g.profile.flasks,time:i/120};if(g.paused||p.dead)throw Error('Training stopped');const d=e.x-p.x,near=Math.abs(d)<38;faceTrainer(g);
 if(t.step===2){if(near&&!p.action||p.action?.kind.startsWith('light')&&!p.comboQueued&&p.action.t>=p.action.spec.duration-.12)g.press('attack');}
 else if(t.step===3){if(e.state==='windup'&&e.t>1.0&&!p.action)g.press('dash');}
 else if(t.step===4){if(e.state==='windup'&&e.t>1.03&&!p.action)g.press('parry');}
 else if(t.step===5&&t.healed===false){if(!p.action)g.press('heal');}
 else if(t.step===5){if(near&&!p.action&&(e.state==='recover'||e.stagger>.2))g.press('heavy');}
 else if(t.step===6){if(!p.action&&Math.abs(d)<135)g.press('skill');}
 else if(t.step===7){if(e.state==='windup'&&e.t>(e.pattern==='overhead'?1.29:1.04)&&!p.action)g.press('parry');else if((e.state==='recover'||e.stagger>.2)&&near){if(!p.action)g.press('heavy');}}
 const move=t.step===2||t.step>=5&&['idle','recover'].includes(e.state)||t.step===4&&Math.abs(d)>85;g.update(1/120,{right:move&&!near&&d>0,left:move&&!near&&d<0});}
 throw Error('Training timed out at lesson '+g.profile.tutorial.step+' '+JSON.stringify(g.world.enemies[0]));}
export async function installTutorialDriver(page){const fns=[tickTutorial,walkTutorial,reachTrainingKnight,faceTrainer,trainUntil].map(fn=>[fn.name,fn.toString()]);await page.evaluate(entries=>{for(const[name,source]of entries)window[name]=(0,eval)('('+source+')');},fns);}
