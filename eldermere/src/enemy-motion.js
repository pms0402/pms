// Collision-aware routes are cached per creature, never recomputed every frame.
// The same radius and swept segments are used for planning and movement.
export function clearSegment(a,b,solid,r=10){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));for(let i=1;i<=n;i++)if(solid(a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n,r))return false;return true;}
export function findEnemyRoute(start,goal,solid,r=10,stop=0){
 const cell=16,pad=144,minX=Math.min(start.x,goal.x)-pad,maxX=Math.max(start.x,goal.x)+pad,minY=Math.min(start.y,goal.y)-pad,maxY=Math.max(start.y,goal.y)+pad;
 const key=(x,y)=>x+','+y,point=n=>({x:start.x+n.x*cell,y:start.y+n.y*cell}),heuristic=p=>Math.hypot(p.x-goal.x,p.y-goal.y),heap=[],cost=new Map(),closed=new Set();
 const push=n=>{heap.push(n);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].f<heap[j].f)j++;if(heap[j].f>=last.f)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
 push({x:0,y:0,g:0,f:heuristic(start),parent:null});cost.set('0,0',0);
 for(let visited=0;heap.length&&visited<1800;visited++){
  const node=pop(),id=key(node.x,node.y);if(closed.has(id))continue;closed.add(id);const p=point(node);
  if(heuristic(p)<=stop&&clearSegment(p,goal,solid,2)||heuristic(p)<cell*1.5&&clearSegment(p,goal,solid,r)){const route=heuristic(p)<=stop?[]:[{x:goal.x,y:goal.y}];for(let n=node;n.parent;n=n.parent)route.push(point(n));return route.reverse();}
  for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const x=node.x+dx,y=node.y+dy,id=key(x,y),q=point({x,y});if(q.x<minX||q.x>maxX||q.y<minY||q.y>maxY||closed.has(id)||!clearSegment(p,q,solid,r))continue;
   const g=node.g+cell*Math.hypot(dx,dy);if(g>=(cost.get(id)??Infinity))continue;cost.set(id,g);push({x,y,g,f:g+heuristic(q),parent:node});
  }
 }
 return [];
}
export function pursueEnemy(g,e,target,speed,dt,stop=0){
 const r=e.boss?12:10,clearance=r+2,solid=(x,y,radius)=>g.solid(x,y,radius),d=Math.hypot(target.x-e.x,target.y-e.y);if(speed<=0||dt<=0)return false;
 e.routeClock=Math.max(0,(e.routeClock||0)-dt);let next=target;const direct=clearSegment(e,target,solid,clearance);if(direct&&d<=stop)return false;
 if(direct){e.route=null;}
 else{
  if(e.route?.length&&!clearSegment(e,e.route[0],solid,clearance))e.route=null;
  if(!e.route||e.routeClock===0&&(Math.hypot(target.x-e.routeGoal.x,target.y-e.routeGoal.y)>20||!e.route.length)){
   e.route=findEnemyRoute(e,target,solid,clearance,stop);e.routeGoal={x:target.x,y:target.y};e.routeClock=.8;
  }
  while(e.route.length&&Math.hypot(e.route[0].x-e.x,e.route[0].y-e.y)<3)e.route.shift();
  next=e.route[0];if(!next)return false;
 }
 const dx=next.x-e.x,dy=next.y-e.y,len=Math.hypot(dx,dy),travel=Math.min(speed*dt,len,direct?Math.max(0,d-stop):len);if(!len||travel<=0)return false;
 const moved=g.move(e,dx/len*travel,dy/len*travel,r);if(!moved){e.route=null;e.routeClock=.25;}return moved;
}
export function animateEnemy(e,previous){const dx=e.x-previous.x,dy=e.y-previous.y,d=Math.hypot(dx,dy);e.moving=d>.005;if(e.moving){e.walk=(e.walk||0)+d/6;if(Math.abs(dx)>.02)e.dir=dx>0?1:3;}e.dir??=3;}
