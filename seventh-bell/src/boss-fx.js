import {sprite,paintSprite,drawBoss} from './art.js';
import {registeredWeaponTip} from './boss-strikes.js';
import {fieldActive} from './combat-fields.js';
import {projectileWallTime} from './projectile-combat.js';
import {BOSS_ACTIONS} from './boss-actions.js';
import {MINIBOSSES} from './miniboss-data.js';
import {attackSeconds,BOSS_ATTACK_RATE} from './boss-tempo.js';

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const PALETTES={edran:['#d5d9c4','#a69064','#4b5b64'],marie:['#d5f5df','#80c6c1','#385b70'],brag:['#fff0b1','#e98a4e','#7c3c36'],leonel:['#f0dbf6','#b79bcf','#5f4d7d'],arkein:['#fff0bd','#ddbd75','#82704e'],neris:['#e5eee1','#83c5c8','#496477'],carillon:['#fff1c6','#a9d1c5','#766583']};
const owners={rook:'carillon',censer:'brag',slag:'brag',folio:'leonel',seren:'arkein',ballast:'neris',pendulum:'carillon'};
const palette=id=>PALETTES[owners[id]||id]||PALETTES.carillon;

// Rasterized strokes keep diagonals on the same pixel grid as the sprite art.
function line(c,ax,ay,bx,by,width=1){ax=Math.round(ax);ay=Math.round(ay);bx=Math.round(bx);by=Math.round(by);const dx=Math.abs(bx-ax),sx=ax<bx?1:-1,dy=-Math.abs(by-ay),sy=ay<by?1:-1;let error=dx+dy;for(let n=0;n<2400;n++){c.fillRect(ax-Math.floor(width/2),ay-Math.floor(width/2),width,width);if(ax===bx&&ay===by)break;const e=error*2;if(e>=dy){error+=dy;ax+=sx;}if(e<=dx){error+=dx;ay+=sy;}}}
function ellipse(c,x,y,rx,ry){let previous=null;for(let n=0;n<=96;n++){const angle=n/96*Math.PI*2,p={x:x+Math.cos(angle)*rx,y:y+Math.sin(angle)*ry};if(previous)line(c,previous.x,previous.y,p.x,p.y);previous=p;}}
function art(c,col,row,x,y,w,h){const im=sprite('combat-atlas',col,row),b=im.opaqueBounds;paintSprite(c,im,b.x,b.y,b.w,b.h,Math.round(x-w/2),Math.round(y-h/2),Math.round(w),Math.round(h));}
function colour(c,value,alpha=1){c.fillStyle=value;c.globalAlpha=alpha;}
function glint(c,x,y,p,size=6){colour(c,p[1],.8);line(c,x-size,y,x+size,y);line(c,x,y-size,x,y+size);colour(c,p[0]);c.fillRect(Math.round(x)-1,Math.round(y)-1,3,3);}
function glyph(c,x,y,p,type='bell',size=8){colour(c,p[1],.8);if(type==='crown'){line(c,x-size,y+2,x-size,y-size/2);line(c,x-size,y-size/2,x-size/2,y);line(c,x-size/2,y,x,y-size);line(c,x,y-size,x+size/2,y);line(c,x+size/2,y,x+size,y-size/2);line(c,x+size,y-size/2,x+size,y+2);line(c,x-size,y+2,x+size,y+2);}else if(type==='page'){line(c,x-size,y-size,x+size-3,y-size);line(c,x+size-3,y-size,x+size,y-size+3);line(c,x+size,y-size+3,x+size,y+size);line(c,x-size,y-size,x-size,y+size);line(c,x-size,y+size,x+size,y+size);for(let n=-1;n<=1;n++)line(c,x-size+3,y+n*3,x+size-3,y+n*3);}else if(type==='gear'){ellipse(c,x,y,size*.65,size*.65);for(let n=0;n<8;n++){const a=n*Math.PI/4;line(c,x+Math.cos(a)*size*.7,y+Math.sin(a)*size*.7,x+Math.cos(a)*size,y+Math.sin(a)*size);}}else{line(c,x-size,y+size/2,x-size*.6,y-size/2);ellipse(c,x,y-size/2,size*.6,size*.35);line(c,x+size*.6,y-size/2,x+size,y+size/2);line(c,x-size,y+size/2,x+size,y+size/2);c.fillRect(Math.round(x)-1,Math.round(y+size*.6),3,2);}}
function capsule(c,a,b,r,p,active,fade=1){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len;for(let offset=-r;offset<=r;offset++){const edge=Math.abs(offset)/Math.max(1,r);colour(c,edge>.55?p[2]:edge>.2?p[1]:p[0],fade*(active?(.85-edge*.5):.15));line(c,a.x+nx*offset,a.y+ny*offset,b.x+nx*offset,b.y+ny*offset);}if(!active){colour(c,p[1],fade*.6);for(let t=0;t<len;t+=8){const x=a.x+dx*t/len,y=a.y+dy*t/len;line(c,x+nx*r,y+ny*r,x+nx*(r-1),y+ny*(r-1));line(c,x-nx*r,y-ny*r,x-nx*(r-1),y-ny*(r-1));}}}

function followupCharge(e,a){if(e.state!=='attack')return null;const t=e.t*BOSS_ATTACK_RATE;if(e.miniboss&&a.kind==='double'){const remaining=a.active*.57-e.t;return remaining>0&&remaining<attackSeconds(.2)?1-remaining/attackSeconds(.2):null;}
 const periods={knightThree:[.73,.3,3],royalProcession:[.8,.35,3],royalFour:[.76,.33,4]};if(periods[e.pattern]){const[period,impact,count]=periods[e.pattern],beat=Math.min(count-1,Math.floor(t/period)),local=t-beat*period;return local<impact?local/impact:null;}if(e.pattern==='royalFirst'&&t>=.38&&t<.68)return(t-.38)/.3;if(e.pattern==='royalGuard'&&e.counterAt!==undefined&&e.t<e.counterAt)return 1-(e.counterAt-e.t)/attackSeconds(.6);if(e.pattern==='seventhPeal'){const period=e.pealInterval||.85,beat=Math.max(0,Math.floor((t-.2)/period)+1),remaining=.2+beat*period-t;return beat<7&&remaining>0&&remaining<.24?1-remaining/.24:null;}return null;}
export function bossPreparation(r,e){if(!e.boss&&!e.miniboss||e.dead)return false;const d=e.miniboss?MINIBOSSES[e.type].attacks[e.attackIndex]:BOSS_ACTIONS[e.pattern];if(!d)return false;const following=followupCharge(e,d);if(e.state!=='windup'&&following===null)return false;const p=palette(e.miniboss?e.type:e.id),f=clamp(following===null?e.t/(e.prep||d.windup):following),tip=registeredWeaponTip(e)||{x:e.x+e.dir*18,y:e.y-e.h*.65},c=r.c;c.save();
 const style=owners[e.type]||e.id;colour(c,p[1],.2+f*.5);ellipse(c,tip.x,tip.y,3+f*4,2+f*3);if(f>.4)glint(c,tip.x,tip.y,p,2+f*5);
 if(['marie','leonel','carillon'].includes(style)){for(let n=0;n<3;n++){const a=n*Math.PI*2/3-f*.7,x=tip.x+Math.cos(a)*(13-f*5),y=tip.y+Math.sin(a)*8;colour(c,p[n%2],.3+f*.4);if(style==='leonel')glyph(c,x,y,p,'page',3);else{c.fillRect(Math.round(x),Math.round(y),2,2);line(c,x,y,x,y-4);}}}
 if(style==='brag')for(let n=0;n<5;n++){colour(c,p[n%2],.3+f*.5);const x=tip.x+(n-2)*3,y=tip.y-((e.t*24+n*4)%12);c.fillRect(Math.round(x),Math.round(y),1,n%2+1);}
 c.restore();return true;}

export function bossSteelEffect(r,e){const s=e.steel;if(!s||s.life<=0||e.dead)return;const c=r.c,p=palette(e.miniboss?e.type:e.id||'carillon'),fade=clamp(s.life/(s.max||.14));c.save();capsule(c,{x:s.ax,y:s.ay},{x:s.bx,y:s.by},s.radius||4,p,true,fade*.8);
 if(e.miniboss){const dx=s.bx-s.ax,dy=s.by-s.ay,length=Math.hypot(dx,dy)||1,nx=-dy/length,ny=dx/length;colour(c,p[0],fade*.8);for(let n=1;n<=5;n++){const x=s.ax+dx*n/6,y=s.ay+dy*n/6;if(e.type==='rook'||e.type==='ballast'){for(const side of[-1,1]){line(c,x+nx*side*7,y+ny*side*7,x+nx*side*3+dx/length*2,y+ny*side*3+dy/length*2);}}else if(['censer','pendulum'].includes(e.type)){line(c,x-nx*2,y-ny*2,x+nx*2+dx/length*2,y+ny*2+dy/length*2);line(c,x+nx*2+dx/length*2,y+ny*2+dy/length*2,x-nx*2+dx/length*4,y-ny*2+dy/length*4);}}
  if(e.type==='censer')art(c,2,0,s.bx,s.by,12,12);if(e.type==='pendulum')art(c,2,3,s.bx,s.by,12,12);if(e.type==='folio')art(c,3,0,(s.ax+s.bx)/2,(s.ay+s.by)/2,19,10);
 }
 if(fade>.6)glint(c,s.bx,s.by,p,4);c.restore();}

function floorMark(c,f,p,progress,type){const y=f.y+f.h-2;colour(c,p[2],.7);line(c,f.x,y,f.x+f.w-1,y);colour(c,p[1],.65);for(let x=f.x;x<f.x+f.w;x+=7)line(c,x,y,x+Math.min(3,f.x+f.w-1-x),y);colour(c,p[0],.85);line(c,f.x,y,f.x+(f.w-1)*progress,y);for(const x of[f.x+1,f.x+f.w-2]){line(c,x,y-5,x,y);line(c,x,y,x+(x<f.x+f.w/2?4:-4),y-2);}glyph(c,f.x+f.w/2,clamp(y-5,f.y+5,y),p,type,Math.min(7,f.h/3));}
function veil(c,f,p,alpha){for(let y=f.y;y<f.y+f.h;y+=2){const t=(y-f.y)/Math.max(1,f.h);colour(c,p[1],alpha*(.5+.5*Math.sin(t*Math.PI)));c.fillRect(Math.round(f.x),Math.round(y),Math.ceil(f.w),2);}}
function fissure(c,f,p,active,time){for(let x=f.x;x<f.x+f.w;x+=7){const a=Math.min(f.x+f.w-1,x+7),y=f.y+f.h*.55+Math.sin(x*.4)*Math.min(2,f.h/4);colour(c,active?p[0]:p[1],active?.9:.65);line(c,x,y,a,f.y+f.h*.55+Math.sin(a*.4)*Math.min(2,f.h/4));}if(active){veil(c,f,p,.15);for(let x=f.x+12;x<f.x+f.w;x+=24){art(c,f.kind==='crack'?3:5,2,x,f.y+f.h/2,26,Math.max(8,f.h));colour(c,p[0],.7);const y=f.y+Math.floor((time*19+x)%Math.max(1,f.h));c.fillRect(Math.round(x),Math.round(y),1,2);}}}
function flame(c,f,p,time){veil(c,f,p,.17);const size=Math.min(42,Math.max(18,f.h));for(let x=f.x+8;x<f.x+f.w+12;x+=22){const rise=(Math.sin(time*12+x*.17)+1)*.2,base=f.y+f.h;art(c,2,0,x,base-size*(.35+rise),Math.min(32,f.w),size);colour(c,p[0],.55);for(let n=0;n<3;n++){const y=base-((time*32+x+n*17)%Math.max(1,f.h));c.fillRect(Math.round(x+(n-1)*4),Math.round(y),1,2);}}}
function royalLight(c,f,p,time,carillon){veil(c,f,p,.1);const count=Math.max(2,Math.floor(f.w/24)),width=f.w/count,phase=clamp((f.age-f.warning)/f.duration);for(let n=0;n<count;n++){const x=f.x+width*(n+.5),top=f.y+2,base=f.y+f.h-1;for(let y=top;y<=base;y++){const t=(y-top)/Math.max(1,base-top),blade=t<.18?2:t<.24?width*.42:Math.max(1,width*.25*(1-(t-.24)/.76));colour(c,p[1],.35+.35*Math.sin(phase*Math.PI));line(c,x-blade,y,x+blade,y);colour(c,p[0],.85);line(c,x-Math.max(0,blade*.22),y,x+Math.max(0,blade*.22),y);}glyph(c,x,top+12,p,carillon?'bell':'crown',Math.min(6,width*.22));for(let k=0;k<3;k++){const y=top+(time*105+n*31+k*17)%f.h;colour(c,p[0],.7);c.fillRect(Math.round(x+(k-1)*width*.3),Math.round(y),1,3);}}colour(c,p[0],.85);line(c,f.x,f.y+f.h-1,f.x+f.w-1,f.y+f.h-1);}
function inkBlades(c,f,p,time){veil(c,f,p,.16);for(let n=0;n<4;n++){const x=f.x+8+n*(f.w-16)/3,y=f.y+((time*110+n*23)%Math.max(1,f.h-15));c.save();c.translate(Math.round(x),Math.round(y));c.rotate(Math.PI/2);art(c,3,0,0,0,35,11);c.restore();colour(c,p[1],.65);line(c,x,f.y,x,f.y+f.h-1);}colour(c,p[0],.7);line(c,f.x,f.y+f.h-1,f.x+f.w-1,f.y+f.h-1);}

// Rectangle-shaped hazards keep their exact collision footprint. The marks,
// embers, pages and rays are all clipped to it, rather than replacing its range.
export function bossFieldEffect(r,f){if(!PALETTES[f.owner])return false;const c=r.c,p=palette(f.owner),active=fieldActive(f),progress=clamp(f.age/Math.max(.001,f.warning)),time=r.g.clock;c.save();
 if(f.kind==='ring'){if(active){const radius=(f.age-f.warning)*f.speed;for(const n of[-1,0,1]){colour(c,p[n+1],.75);ellipse(c,f.x,f.y,Math.max(1,radius+n*(f.thickness||6)*.6),f.ry||24);}for(const dir of[-1,1]){colour(c,p[0],.7);for(let n=0;n<4;n++)c.fillRect(Math.round(f.x+dir*radius-dir*n*3),Math.round(f.y-3+n%2),2,2);}}c.restore();return true;}
 if(['bladeEcho','beam','ropeOrbit'].includes(f.kind)){const clip=f.kind==='bladeEcho'?1:projectileWallTime(r.g,{radius:1},f.ax,f.ay,f.bx,f.by),a={x:f.ax,y:f.ay},b={x:f.ax+(f.bx-f.ax)*clip,y:f.ay+(f.by-f.ay)*clip};
  if(f.kind==='bladeEcho'&&f.ghost){c.save();c.globalAlpha=active?.3:.15;drawBoss(c,{...r.g.world.boss,x:f.ghost.x,y:f.ghost.y,dir:f.ghost.dir,dead:false,state:'attack',pattern:'leftAttack',t:.2,poseRow:f.ghost.row,poseCol:f.ghost.col,stagger:0,hit:0});c.restore();}
  capsule(c,a,b,f.radius||5,p,active);if(f.kind==='ropeOrbit'){colour(c,'#cdb98c',active?1:.5);line(c,a.x,a.y,b.x,b.y,2);art(c,3,1,b.x,b.y,12,12);}else if(f.kind==='beam'){glint(c,a.x,a.y,p,7);if(!active&&f.scan){for(const angle of[f.scan.from,f.scan.to]){const end={x:a.x+Math.cos(angle)*f.scan.length,y:a.y+Math.sin(angle)*f.scan.length},t=projectileWallTime(r.g,{radius:1},a.x,a.y,end.x,end.y);colour(c,p[1],.25);line(c,a.x,a.y,a.x+(end.x-a.x)*t,a.y+(end.y-a.y)*t);}}}c.restore();return true;
 }
 if(!Number.isFinite(f.w)||!Number.isFinite(f.h)){c.restore();return false;}c.beginPath();c.rect(f.x,f.y,f.w,f.h);c.clip();
 const type=f.owner==='arkein'?'crown':f.owner==='leonel'?'page':f.owner==='carillon'?'gear':'bell';
 if(!active){floorMark(c,f,p,progress,type);if(['light','future'].includes(f.kind)){for(let x=f.x+4;x<f.x+f.w;x+=9){colour(c,p[1],.25+progress*.25);const y=f.y+((time*28+x*3)%Math.max(1,f.h));c.fillRect(Math.round(x),Math.round(y),1,3);}}else if(['crack','metal','lava','heat'].includes(f.kind))fissure(c,f,p,false,time);}
 else if(['light','future'].includes(f.kind)){if(f.kind==='future')inkBlades(c,f,p,time);else royalLight(c,f,p,time,f.owner==='carillon');}
 else if(['crack','metal','embers'].includes(f.kind))fissure(c,f,p,true,time);
 else if(['lava','heat'].includes(f.kind))flame(c,f,p,time);
 else if(f.kind==='silence'){veil(c,f,p,.2);for(let x=f.x;x<f.x+f.w;x+=5){const y=f.y+f.h/2+Math.sin(x*.16+time*4)*3;colour(c,p[1],.8);line(c,x,y,Math.min(f.x+f.w-1,x+5),f.y+f.h/2+Math.sin((x+5)*.16+time*4)*3);}floorMark(c,f,p,1,'bell');}
 else if(f.kind==='erase'){colour(c,'#151728',1);for(let y=0;y<f.h;y++){const inset=y%3===0?2:0;line(c,f.x+inset,f.y+y,f.x+f.w-1-inset,f.y+y);}colour(c,p[1],.9);for(let x=f.x;x<f.x+f.w;x+=7)line(c,x,f.y,x+4,f.y+2);}
 else if(f.kind==='flood'){veil(c,f,p,.5);for(let y=f.y+4;y<f.y+f.h;y+=12)for(let x=f.x;x<f.x+f.w;x+=28){colour(c,p[1],.32);line(c,x,y,x+10,y);}for(let x=f.x;x<f.x+f.w;x+=50)art(c,0,3,x+25,f.y+8,52,17);colour(c,p[0],.6);line(c,f.x,f.y,f.x+f.w-1,f.y);}
 else veil(c,f,p,.2);
 c.restore();return true;
}

export function bossObstacleTell(c,o){const p=palette(o.owner),f=clamp(o.age/o.warning);c.save();colour(c,p[1],.7);for(let x=o.x;x<o.x+o.w;x+=5)line(c,x,o.y+o.h-1,Math.min(x+2,o.x+o.w-1),o.y+o.h-1);glyph(c,o.x+o.w/2,o.y+o.h-10,p,'page',6);c.restore();return .25+f*.45;}
export function clonePose(c,boss){const wind=attackSeconds(1.5),impact=attackSeconds(2.3),recover=attackSeconds(2.48),a=BOSS_ACTIONS.leftAttack;return{...boss,x:0,y:0,dir:c.dir,dead:false,state:c.warned&&!c.struck?'windup':c.struck?'attack':'idle',pattern:'leftAttack',t:c.warned&&!c.struck?clamp((c.t-wind)/(impact-wind))*a.windup:attackSeconds(.2),stagger:0,hit:0,phase:2,poseRow:2,poseCol:c.struck?(c.t<recover?3:4):2};}

export function bossProjectileAccent(c,q){if(!q.bossTempo)return;const p=palette(q.bossStyle),speed=Math.hypot(q.vx,q.vy)||1,dx=q.vx/speed,dy=q.vy/speed;c.save();colour(c,p[1],.45);for(let n=1;n<=3;n++)c.fillRect(Math.round(q.x-dx*n*4),Math.round(q.y-dy*n*4),1,1);colour(c,p[0],.9);c.fillRect(Math.round(q.x),Math.round(q.y),1,1);c.restore();}

export function bossRetirementEffect(r,e){if(e.kind!=='bossDisperse')return false;const c=r.c,f=e.field,p=palette(f.owner),t=1-e.life/e.max;c.save();colour(c,p[1],.4*(1-t));for(let n=0;n<10;n++){const fraction=(n+.5)/10,x=Number.isFinite(f.ax)?f.ax+(f.bx-f.ax)*fraction:f.x+(f.w||20)*fraction,y=Number.isFinite(f.ay)?f.ay+(f.by-f.ay)*fraction:f.y+(f.h||10)*.7;c.fillRect(Math.round(x+Math.sin(n*2.3)*t*7),Math.round(y-t*(4+n%3)),1,n%2+1);}c.restore();return true;}
