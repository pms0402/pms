import {inCathedralBay} from './cathedral-presentation.js';
import {cathedralPortal} from './cathedral-renderer.js';
import {sprite,paintSprite} from './art.js';
import {journeyAt} from './journey-data.js';
export function journeyProp(c,index,x,y,height=120,alpha=1){const im=sprite('journey-objects',index%6,Math.floor(index/6)),b=im.opaqueBounds,w=height*b.w/b.h;c.save();c.globalAlpha=alpha;paintSprite(c,im,b.x,b.y,b.w,b.h,Math.round(x-w/2),Math.round(y-height),Math.round(w),Math.round(height));c.restore();}
export function renderJourneys(r){const g=r.g,c=r.c,j=journeyAt(g.p.x),visible=x=>x>r.x-260&&x<r.x+r.width+260;
 if(j){for(let dx=130;dx<j.length;dx+=210){const x=j.start+dx;if(!visible(x))continue;const floors=g.world.platforms.filter(q=>q.journey===j.id&&q.foundation&&x>=q.x&&x<q.x+q.w),y=floors[0]?.y||302;const blend=Math.max(0,Math.min(1,(dx/j.length-.3)/.4)),height=['mine','crypt','rail'].includes(j.kind)?210:180;if(blend<1)journeyProp(c,j.kind==='mine'?21:j.kind==='crypt'?9:j.westArt,x,y,height,.24*(1-blend));if(blend>0)journeyProp(c,j.kind==='crypt'?22:j.eastArt,x,y,height,.24*blend);}
 }
 for(const d of g.world.journeyScenery||[])if(visible(d.x))journeyProp(c,d.art,d.x,d.y,d.size,.82);
 for(const o of g.world.objects){if(!visible(o.x))continue;if(['journey-door','journey-exit'].includes(o.type)){if(o.id==='pilgrim-return'&&inCathedralBay(o.x,o.y))cathedralPortal(c,o.x,o.y);else journeyProp(c,o.art,o.x,o.y,220);r.glow(o.x,o.y-75,48,'#b8c7a4');}else if(['journey-call','journey-latch'].includes(o.type))journeyProp(c,o.art,o.x,o.y,54);}
 // Ward posts mark the actual protected interval; overlapping shrines share posts.
 const zones=(g.world.sanctuaries||[]).filter(z=>z.x+z.w>r.x-80&&z.x<r.x+r.width+80).sort((a,b)=>a.x-b.x),merged=[];
 for(const z of zones){const last=merged.at(-1);if(last&&z.x<=last.x+last.w&&z.floor===last.floor){last.w=Math.max(last.w,z.x+z.w-last.x);}else merged.push({...z});}
 for(const z of merged)for(const x of[z.x+10,z.x+z.w-10]){if(!visible(x))continue;journeyProp(c,18,x,z.floor,46,.9);if(!g.bossActive)r.glow(x,z.floor-28,38,'#a4d6c7');}
}
