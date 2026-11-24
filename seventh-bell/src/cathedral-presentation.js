// One visual pilot: the entrance/hoist bay of the cathedral's pilgrim gallery.
// These bounds are never included in world geometry or attack calculations.
export const CATHEDRAL_BAY={left:6140,right:7580,top:-80,bottom:500};
export const CATHEDRAL_INK={shadow:'#192d38',stone:'#3c535f',steel:'#a6bdbf',edge:'#e4dfc6',gold:'#c2a36e',danger:'#cf8e65'};
export function inCathedralBay(x,y=302){const b=CATHEDRAL_BAY;return x>=b.left&&x<b.right&&y>=b.top&&y<b.bottom;}

// Locate the first visible steel/body contact AFTER the existing hit predicate
// has accepted the target. This result drives feedback only, never hit tests.
export function contactOnBody(paths,r){for(const b of paths){let lo=0,hi=1;const dx=b.bx-b.ax,dy=b.by-b.ay;for(const[a,d,min,max]of[[b.ax,dx,r.x,r.x+r.w],[b.ay,dy,r.y,r.y+r.h]]){if(Math.abs(d)<1e-9){if(a<min||a>max){lo=2;break;}}else{const a0=(min-a)/d,a1=(max-a)/d;lo=Math.max(lo,Math.min(a0,a1));hi=Math.min(hi,Math.max(a0,a1));}}if(lo<=hi&&hi>=0&&lo<=1)return{x:b.ax+dx*Math.max(0,lo),y:b.ay+dy*Math.max(0,lo)};}
 // The existing 2px edge allowance can accept a grazing segment just outside.
 const b=paths.at(-1);return{x:Math.max(r.x,Math.min(r.x+r.w,b?.bx??r.x+r.w/2)),y:Math.max(r.y,Math.min(r.y+r.h,b?.by??r.y+r.h/2))};}

export function localImpact(g,e,kind,point){if(!point||e.boss||e.miniboss||!inCathedralBay(g.p.x,g.p.y)||!inCathedralBay(e.x,e.y))return false;const slam=['light3','heavy','plunge'].includes(kind);g.effects.push({kind:'cathedralContact',x:point.x,y:point.y,life:slam?.15:.11,max:slam?.15:.11,dir:g.p.dir,heavy:slam,seed:g.clock,target:{x:e.x-e.w/2,y:e.y-e.h,w:e.w,h:e.h}});g.sound(slam?'cathedralSlam':'cathedralHit');return true;}
