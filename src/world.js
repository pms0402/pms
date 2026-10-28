import * as THREE from 'three';
import {buildWorldArt} from './world-art.js';
import {createGroundMaterial} from './ground-material.js';
import {WORLD_RADIUS,HILLS,STRUCTURES,WORLD_COLLIDERS,terrainHeight,isWalkable,resolveTerrainMovement,steerAroundWalls} from './terrain.js';

export function createTerrainWorld(game) {
 const {scene,mats,geo}=game;
 const positions=[0,terrainHeight(0,0),0],colors=[],indices=[],uvs=[.5,.5];
 const green=new THREE.Color('#b1b3a7'),soil=new THREE.Color('#777a76'),path=new THREE.Color('#c9c6bd');
 const colorAt=(x,z,h)=>{
  const road=Math.min(Math.abs(z-Math.sin(x*.035)*5),Math.abs(x-Math.sin(z*.03)*5));
  const c=green.clone().lerp(soil,Math.min(.65,Math.max(0,h/13))).multiplyScalar(.9+.04*Math.sin(x*.3)*Math.cos(z*.32)+.03*Math.sin(x*.7+z*.43));
  if(road<2.4)c.lerp(path,(1-road/2.4)*.75);return c;
 };
 let c=colorAt(0,0,0);colors.push(c.r,c.g,c.b);
 const sectors=128,rings=49,extent=98;
 for(let ring=1;ring<=rings;ring++)for(let i=0;i<sectors;i++) {
  const angle=i/sectors*Math.PI*2,r=ring/rings*extent,x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=terrainHeight(x,z);
  positions.push(x,h,z);uvs.push(x/(extent*2)+.5,z/(extent*2)+.5);c=colorAt(x,z,h);colors.push(c.r,c.g,c.b);
 }
 for(let i=0;i<sectors;i++)indices.push(0,1+(i+1)%sectors,1+i);
 for(let ring=1;ring<rings;ring++)for(let i=0;i<sectors;i++) {
  const a=1+(ring-1)*sectors+i,b=1+(ring-1)*sectors+(i+1)%sectors,c=1+ring*sectors+i,d=1+ring*sectors+(i+1)%sectors;
  indices.push(a,b,c,b,d,c);
 }
 const groundGeo=new THREE.BufferGeometry();groundGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));groundGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));groundGeo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));groundGeo.setIndex(indices);groundGeo.computeVertexNormals();
 const groundMaterial=createGroundMaterial(game.presentation);mats.terrainSurface=groundMaterial;
 const ground=new THREE.Mesh(groundGeo,groundMaterial);ground.receiveShadow=true;scene.add(ground);
 const art=buildWorldArt(game),occluders=art.occluders;
 // A shared small flow field routes a horde around ruins without one path search per monster.
 const navSize=91,navStep=2,navCount=navSize*navSize,walk=new Uint8Array(navCount),distance=new Uint16Array(navCount),queue=new Uint16Array(navCount);
 for(let z=0;z<navSize;z++)for(let x=0;x<navSize;x++)walk[z*navSize+x]=isWalkable(x*navStep-WORLD_RADIUS,z*navStep-WORLD_RADIUS,.65)?1:0;
 const navDirections=[[1,0],[-1,0],[0,1],[0,-1]];
 let navGoal=-1,navTime=-Infinity,navTarget={x:0,z:0};
 const updateNavigation=(target,time)=>{
  navTarget={x:target.x,z:target.z};
  const gx=Math.max(0,Math.min(navSize-1,Math.round((target.x+WORLD_RADIUS)/navStep))),gz=Math.max(0,Math.min(navSize-1,Math.round((target.z+WORLD_RADIUS)/navStep)));
  let goal=gz*navSize+gx;
  if(!walk[goal]){let best=Infinity;for(let dz=-2;dz<=2;dz++)for(let dx=-2;dx<=2;dx++){const x=gx+dx,z=gz+dz,id=z*navSize+x;if(x<0||z<0||x>=navSize||z>=navSize||!walk[id])continue;const d=(x*navStep-WORLD_RADIUS-target.x)**2+(z*navStep-WORLD_RADIUS-target.z)**2;if(d<best){best=d;goal=id;}}}
  if(time<navTime){navGoal=-1;navTime=-Infinity;}
  if(goal===navGoal||time-navTime<.25)return;navGoal=goal;navTime=time;distance.fill(65535);let head=0,tail=0;queue[tail++]=goal;distance[goal]=0;
  while(head<tail){const id=queue[head++],x=id%navSize,z=Math.floor(id/navSize);for(const [dx,dz] of navDirections){const nx=x+dx,nz=z+dz,next=nz*navSize+nx;if(nx<0||nz<0||nx>=navSize||nz>=navSize||!walk[next]||distance[next]!==65535)continue;distance[next]=distance[id]+1;queue[tail++]=next;}}
 };
 const steer=(position,dx,dz,radius,seed)=>{
  if(navGoal<0||Math.hypot(position.x+dx-navTarget.x,position.z+dz-navTarget.z)>3)return steerAroundWalls(position,dx,dz,radius,seed);
  const length=Math.hypot(dx,dz)||1,fx=dx/length,fz=dz/length;
  // Short clear routes keep close-range movement smooth instead of snapping to a grid.
  if(length<3&&isWalkable(position.x+fx*Math.min(length,1),position.z+fz*Math.min(length,1),radius))return {x:fx,z:fz};
  const gx=Math.round((position.x+WORLD_RADIUS)/navStep),gz=Math.round((position.z+WORLD_RADIUS)/navStep);let best=Infinity,chosen=null;
  for(let iz=-1;iz<=1;iz++)for(let ix=-1;ix<=1;ix++){
   const x=gx+ix,z=gz+iz,id=z*navSize+x;if(x<0||z<0||x>=navSize||z>=navSize||distance[id]===65535)continue;
   const tx=x*navStep-WORLD_RADIUS-position.x,tz=z*navStep-WORLD_RADIUS-position.z,len=Math.hypot(tx,tz);if(len<.2)continue;
   if(!isWalkable(position.x+tx*.5,position.z+tz*.5,radius)||!isWalkable(position.x+tx,position.z+tz,radius))continue;
   const score=distance[id]+len*.2;if(score<best){best=score;chosen={x:tx/len,z:tz/len};}
  }
  return chosen||steerAroundWalls(position,dx,dz,radius,seed);
 };
 const tint=new THREE.Color(),white=new THREE.Color('#e1e5e8');
 const updateOcclusion=(player,camera,dt)=>{
  const dx=camera.x-player.x,dz=camera.z-player.z,length=dx*dx+dz*dz||1;
  for(const item of occluders){
   const s=item.definition,t=((s.x-player.x)*dx+(s.z-player.z)*dz)/length;
   const x=player.x+Math.max(0,Math.min(1,t))*dx,z=player.z+Math.max(0,Math.min(1,t))*dz;
   const hidden=t>=-.1&&t<=1&&Math.abs(x-s.x)<s.width/2+2&&Math.abs(z-s.z)<s.depth/2+2;
   const wanted=hidden?.16:1;item.opacity+=(wanted-item.opacity)*(1-Math.exp(-dt*10));
   for(const piece of item.pieces){piece.material.opacity=item.opacity;piece.material.depthWrite=item.opacity>.95;piece.castShadow=item.opacity>.95;}
  }
 };
 return {ground,tint,white,art,setQuality:art.setQuality,updateOcclusion,structures:STRUCTURES,colliders:WORLD_COLLIDERS,hills:HILLS,height:terrainHeight,isWalkable,resolve:resolveTerrainMovement,steer,updateNavigation};
}
