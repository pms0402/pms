import {journeyAt} from './journey-data.js';

export const liftById=(world,id)=>world.lift.id===id?world.lift:(world.movers||[]).find(m=>m.id===id);
export const rideControlAvailable=(g,o)=>{const m=o.type==='lift'?g.world.lift:liftById(g.world,o.machine);return !!m&&(!m.enabled||g.profile.routes[m.enabled])&&isOnLift(g.p,m);};
export const isOnLift=(p,m)=>!!m&&p.grounded&&Math.abs(p.y-m.y)<3&&p.x>=m.x+p.w/2-1&&p.x<=m.x+m.w-p.w/2+1;
export function buildLiftControls(world){
 Object.assign(world.lift,{id:'crypt-lift',top:302,bottom:478,speed:65,phase:0,mover:true});
 for(const m of [world.lift,...world.movers.filter(m=>!m.periodic)]){
  const stops=[...new Set([m.bottom,m.top,...(m.id==='choir-hoist'?[140,-40,-220]:[])])];
  for(const y of stops){
   const stable=world.platforms.filter(q=>q.journey===m.journey&&q.y===y&&!q.ceiling&&!q.echo&&!q.routeMode&&!q.bridge&&q.w>=32);
   const side=(q,dir)=>{const preferred=dir>0?m.x+m.w+28:m.x-28,x=Math.max(q.x+16,Math.min(q.x+q.w-16,preferred));return{x,q,score:Math.abs(x-preferred)+(x>m.x&&x<m.x+m.w?1000:0)};};
   let choices=stable.flatMap(q=>[side(q,1),side(q,-1)]).sort((a,b)=>a.score-b.score),best=choices[0];if(!best)throw Error('Missing permanent lift landing: '+m.id+' '+y);
   // Two old return shafts stopped far from their upper walkways; connect the
   // existing landing to the shaft without filling or moving the shaft itself.
   if(best.score>2){const q=best.q,left=q.x>=m.x+m.w?m.x+m.w:q.x+q.w,right=q.x>=m.x+m.w?q.x:m.x;
    if(right>left)world.platforms.push({x:q.x>=m.x+m.w?left:Math.min(left,right-70),y,w:Math.max(70,right-left),h:18,oneway:true,tile:q.tile||0,material:q.material,journey:m.journey,liftLanding:m.id});
    const candidates=world.platforms.filter(q=>q.journey===m.journey&&q.y===y&&!q.ceiling&&!q.echo&&!q.routeMode&&!q.bridge&&q.w>=32);choices=candidates.flatMap(q=>[side(q,1),side(q,-1)]).sort((a,b)=>a.score-b.score);best=choices[0];
   }
   const existing=world.objects.find(o=>o.type==='journey-call'&&o.machine===m.id&&o.target===y);
   const call=existing||{id:m.id+'-call-'+y,type:'journey-call',machine:m.id,target:y,art:20};
   Object.assign(call,{x:best.x,y,journey:m.journey,label:'승강기 부르기'});if(!existing)world.objects.push(call);
  }
 }
 return world;
}
function ready(g,m){if(!m||m.periodic||g.paused||g.p.dead||g.p.action||g.p.hurt>0||g.bossActive)return false;if(m.enabled&&!g.profile.routes[m.enabled]){g.tell('연결 장치를 먼저 맞춰야 한다.');return false;}return true;}
export function callLift(g,o){const m=liftById(g.world,o.machine);if(!ready(g,m)||journeyAt(g.p.x)?.id!==o.journey||Math.abs(g.p.x-o.x)>=60||Math.abs(g.p.y-o.y)>=55||!Number.isFinite(o.target)||o.target<Math.min(m.top,m.bottom)||o.target>Math.max(m.top,m.bottom))return false;
 m.target=o.target;g.tell(Math.abs(m.y-o.target)<2?'발판이 도착했다. 올라탄 뒤 다시 작동시키자.':'이 층으로 승강기를 부른다.');g.sound('mechanism');g.save();return true;
}
export function operateLift(g,m){if(!ready(g,m)||!isOnLift(g.p,m))return false;const upper=Math.min(m.top,m.bottom),lower=Math.max(m.top,m.bottom);g.p.y=m.y;g.p.support=m;g.p.vy=0;m.target=Math.abs(m.target-m.y)>2?(m.target===upper?lower:upper):Math.abs(m.y-upper)<2?lower:upper;g.sound('mechanism');g.save();return true;}
