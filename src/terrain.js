export const WORLD_RADIUS = 90;
export const HILLS = Object.freeze([
 {x:29,z:23,radius:18,height:6.2},{x:-31,z:20,radius:17,height:5.8},
 {x:46,z:-37,radius:20,height:8.4},{x:-48,z:-30,radius:21,height:7.2},
 {x:8,z:62,radius:19,height:8.6},{x:-18,z:-67,radius:18,height:9.2},
 {x:68,z:27,radius:17,height:6.5},{x:-69,z:34,radius:20,height:7.8},
 {x:45,z:66,radius:17,height:5.2},
].map(Object.freeze));
export const STRUCTURES = Object.freeze([
 {id:'chapel',name:'찢긴 성당',type:'chapel',x:28,z:26,width:10,depth:13,height:8},
 {id:'ossuary',name:'납골당',type:'chapel',x:-30,z:20,width:9,depth:11,height:6.5},
 {id:'eastTower',name:'검은 감시탑',type:'tower',x:49,z:-22,width:6,depth:6,height:13},
 {id:'westTower',name:'부서진 첨탑',type:'tower',x:-55,z:-31,width:6,depth:6,height:10},
 {id:'lodge',name:'버려진 사냥꾼의 집',type:'house',x:7,z:61,width:9,depth:8,height:5},
 {id:'northGate',name:'뼈의 관문',type:'gate',x:-12,z:-62,width:13,depth:4,height:8},
 {id:'eastGate',name:'붉은 관문',type:'gate',x:67,z:28,width:12,depth:4,height:7},
 {id:'workshop',name:'역병 작업장',type:'house',x:-66,z:33,width:10,depth:8,height:5.5},
 {id:'crypt',name:'무너진 지하묘',type:'house',x:43,z:65,width:8,depth:8,height:4.5},
].map(Object.freeze));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
function rawHeight(x,z) {
 const mask=smooth((Math.hypot(x,z)-14)/12);
 let h=0.15*Math.sin(x*.22)*Math.cos(z*.17);
 for(const hill of HILLS)h+=hill.height*Math.exp(-((x-hill.x)**2+(z-hill.z)**2)/(hill.radius**2*.55));
 return h*mask;
}
const platforms=STRUCTURES.map(s=>({...s,level:rawHeight(s.x,s.z)}));
function sampleHeight(x,z) {
 let h=rawHeight(x,z);
 for(const s of platforms) {
  const d=Math.max(Math.abs(x-s.x)-s.width/2,Math.abs(z-s.z)-s.depth/2);
  if(d<4)h+=(s.level-h)*(1-smooth(d/4));
 }
 const edge=smooth((Math.hypot(x,z)-WORLD_RADIUS-1)/7);
 return h*(1-edge)-7*edge;
}
const EXTENT=105,STEP=1.5,SIZE=141,heights=new Float32Array(SIZE*SIZE);
for(let z=0;z<SIZE;z++)for(let x=0;x<SIZE;x++)heights[z*SIZE+x]=sampleHeight(x*STEP-EXTENT,z*STEP-EXTENT);
/** The rendering mesh and actor feet sample the same cached height field. */
export function terrainHeight(x,z) {
 const gx=Math.max(0,Math.min(SIZE-1.000001,(x+EXTENT)/STEP)),gz=Math.max(0,Math.min(SIZE-1.000001,(z+EXTENT)/STEP));
 const ix=Math.floor(gx),iz=Math.floor(gz),tx=gx-ix,tz=gz-iz;
 const a=heights[iz*SIZE+ix]*(1-tx)+heights[iz*SIZE+ix+1]*tx;
 const b=heights[(iz+1)*SIZE+ix]*(1-tx)+heights[(iz+1)*SIZE+ix+1]*tx;
 return a*(1-tz)+b*tz;
}
export const WORLD_COLLIDERS=Object.freeze(STRUCTURES.flatMap(s=>{
 if(s.type==='tower')return [{type:'circle',x:s.x,z:s.z,radius:2.85,id:s.id}];
 if(s.type==='gate')return [-1,1].map(side=>({type:'rect',x:s.x+side*(s.width/2-1.1),z:s.z,hx:1.1,hz:s.depth/2,id:s.id}));
 const door=2,half=s.width/2;
 return [
  {type:'rect',x:s.x-half,z:s.z,hx:.4,hz:s.depth/2,id:s.id},
  {type:'rect',x:s.x+half,z:s.z,hx:.4,hz:s.depth/2,id:s.id},
  {type:'rect',x:s.x,z:s.z-s.depth/2,hx:half,hz:.4,id:s.id},
  ...[-1,1].map(side=>({type:'rect',x:s.x+side*(half+door)/2,z:s.z+s.depth/2,hx:(half-door)/2,hz:.4,id:s.id})),
 ];
}).map(Object.freeze));
export function isWalkable(x,z,radius=.65) {
 if(Math.hypot(x,z)>WORLD_RADIUS-radius)return false;
 for(const c of WORLD_COLLIDERS) {
  if(c.type==='circle'){if(Math.hypot(x-c.x,z-c.z)<radius+c.radius)return false;}
  else {const dx=Math.max(0,Math.abs(x-c.x)-c.hx),dz=Math.max(0,Math.abs(z-c.z)-c.hz);if(dx*dx+dz*dz<radius*radius)return false;}
 }
 return true;
}
export function resolveTerrainMovement(position,radius=.65) {
 for(let pass=0;pass<3;pass++)for(const c of WORLD_COLLIDERS) {
  if(c.type==='circle') {
   const dx=position.x-c.x,dz=position.z-c.z,d=Math.hypot(dx,dz),r=radius+c.radius;
   if(d<r){position.x=c.x+(d?dx/d:1)*r;position.z=c.z+(d?dz/d:0)*r;}
  } else {
   const nx=Math.max(c.x-c.hx,Math.min(c.x+c.hx,position.x)),nz=Math.max(c.z-c.hz,Math.min(c.z+c.hz,position.z));
   const dx=position.x-nx,dz=position.z-nz,d=Math.hypot(dx,dz);
   if(d>0&&d<radius){position.x+=dx/d*(radius-d);position.z+=dz/d*(radius-d);}
   else if(d===0) {
    const edges=[{v:position.x-(c.x-c.hx),x:c.x-c.hx-radius,z:position.z},{v:c.x+c.hx-position.x,x:c.x+c.hx+radius,z:position.z},{v:position.z-(c.z-c.hz),x:position.x,z:c.z-c.hz-radius},{v:c.z+c.hz-position.z,x:position.x,z:c.z+c.hz+radius}];
    edges.sort((a,b)=>a.v-b.v);position.x=edges[0].x;position.z=edges[0].z;
   }
  }
 }
 const distance=Math.hypot(position.x,position.z),limit=WORLD_RADIUS-radius;
 if(distance>limit){position.x*=limit/distance;position.z*=limit/distance;}
 position.y=terrainHeight(position.x,position.z);return position;
}
export function steerAroundWalls(position,dx,dz,radius=.5,seed=0) {
 const length=Math.hypot(dx,dz)||1,fx=dx/length,fz=dz/length;
 if(isWalkable(position.x+fx*2.6,position.z+fz*2.6,radius)&&isWalkable(position.x+fx,position.z+fz,radius))return {x:fx,z:fz};
 const side=Math.sin(seed)>0?1:-1;
 for(const angle of [.65,-.65,1.15,-1.15,1.6,-1.6,2.1,-2.1]) {
  const a=angle*side,x=fx*Math.cos(a)-fz*Math.sin(a),z=fx*Math.sin(a)+fz*Math.cos(a);
  if(isWalkable(position.x+x*2.6,position.z+z*2.6,radius)&&isWalkable(position.x+x,position.z+z,radius))return {x,z};
 }
 return {x:0,z:0};
}
