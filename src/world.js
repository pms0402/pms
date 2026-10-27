import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {WORLD_RADIUS,HILLS,STRUCTURES,WORLD_COLLIDERS,terrainHeight,isWalkable,resolveTerrainMovement,steerAroundWalls} from './terrain.js';

export function createTerrainWorld(game) {
 const {scene,mats,geo}=game;
 const stone=mats.rock,bone=mats.bone,dark=mats.rockDark,wood=mats.trunk;
 let seed=7341;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
 const box=(m,x,y,z,sx,sy,sz,parent=scene)=>{const mesh=game.box(m,x,y,z,sx,sy,sz,parent);mesh.castShadow=true;mesh.receiveShadow=true;return mesh;};
 const add=(geometry,material,x,y,z,sx=1,sy=sx,sz=sx,parent=scene)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;parent.add(mesh);return mesh;};
 const positions=[0,terrainHeight(0,0),0],colors=[],indices=[],uvs=[.5,.5];
 const green=new THREE.Color('#657252'),soil=new THREE.Color('#403a31'),path=new THREE.Color('#77725d');
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
 const groundMaterial=new THREE.MeshStandardMaterial({color:'#aab39a',roughness:1,vertexColors:true,flatShading:true,map:game.presentation.terrainMap,normalMap:game.presentation.terrainNormal,normalScale:new THREE.Vector2(.18,.18)});mats.terrainSurface=groundMaterial;
 const ground=new THREE.Mesh(groundGeo,groundMaterial);ground.receiveShadow=true;scene.add(ground);
 const cliffGeo=new THREE.CylinderGeometry(94,98,13,64);const cliff=add(cliffGeo,mats.edge,0,-7.8,0);cliff.receiveShadow=true;
 const roofGeo=new THREE.ConeGeometry(1,1,4);roofGeo.rotateY(Math.PI/4);game.ownedGeometries.add(roofGeo);
 const towerGeo=new THREE.CylinderGeometry(1,1.1,1,10);game.ownedGeometries.add(towerGeo);
 const windowMaterial=new THREE.MeshBasicMaterial({color:'#c06b4f'});mats.ruinWindow=windowMaterial;
 const occluders=[];
 for(const s of STRUCTURES) {
  const group=new THREE.Group();group.position.set(s.x,terrainHeight(s.x,s.z),s.z);scene.add(group);
  box(dark,0,.08,0,s.width+.7,.18,s.depth+.7,group);
  if(s.type==='tower') {
   add(towerGeo,stone,0,s.height/2,0,2.8,s.height,2.8,group);
   for(let level=1;level<=3;level++)for(let side=0;side<4;side++) {
    const a=side*Math.PI/2,x=Math.sin(a)*2.83,z=Math.cos(a)*2.83;
    box(dark,x,level*s.height/4,z,.8,1.4,.25,group).rotation.y=a;
    box(windowMaterial,x*1.006,level*s.height/4-.1,z*1.006,.32,.7,.27,group).rotation.y=a;
   }
   for(let i=0;i<10;i++){const a=i/10*Math.PI*2;box(stone,Math.cos(a)*2.65,s.height+.4,Math.sin(a)*2.65,.65,.8,.65,group);}
   add(roofGeo,dark,0,s.height+1.6,0,2.2,2.4,2.2,group);
  }else if(s.type==='gate') {
   for(const side of [-1,1]){box(stone,side*(s.width/2-1.1),s.height/2,0,2.2,s.height,s.depth,group);for(let j=0;j<3;j++)box(bone,side*(s.width/2-1.1)+(j-1)*.6,s.height+.4,0,.25,.8,.3,group);}
   box(dark,0,s.height-1.1,0,s.width,1.4,s.depth,group);
   for(let j=0;j<7;j++)add(geo.cone,bone,(j-3)*.75,s.height-2.05,0,.7,1.5,.7,group).rotation.z=Math.PI;
  }else {
   for(const collider of WORLD_COLLIDERS.filter(c=>c.id===s.id))box(stone,collider.x-s.x,s.height/2,collider.z-s.z,collider.hx*2,s.height,collider.hz*2,group);
   box(dark,0,s.height-.1,s.depth/2,4,.9,.95,group);
   for(const side of [-1,1]) {
    for(let i=0;i<4;i++)box(dark,side*s.width/2,s.height*.35+i*.85,-s.depth*.22,.9,.2,1.9,group);
    for(let i=0;i<3;i++){box(dark,side*(s.width/2+.025),s.height*.62,(i-1)*2.7,.14,1.6,.7,group);box(windowMaterial,side*(s.width/2+.09),s.height*.62,(i-1)*2.7,.12,.8,.3,group);}
    box(wood,side*s.width*.24,s.height+.55,-s.depth*.23,.16,1.2,s.depth*.6,group).rotation.z=side*.5;
   }
   for(let row=1;row<s.height;row++)for(const side of [-1,1]) {
    box(dark,side*(s.width/2+.012),row,0,.04,.055,s.depth,group);
    for(let column=0;column<4;column++)box(dark,side*(s.width/2+.03),row-.45,(column-1.5)*2.5+(row%2)*.8,.04,.8,.045,group);
   }
   // Missing front roof keeps the interior and doorway readable during combat.
   const roof=add(roofGeo,dark,0,s.height+1.1,-s.depth*.23,s.width*.76,2.4,s.depth*.45,group);roof.rotation.y=Math.PI/4;
   if(s.type==='chapel'){
    box(stone,0,s.height+2.2,-s.depth/2,1.2,4,1.3,group);box(bone,0,s.height+4.4,-s.depth/2,.28,1.6,.25,group);box(bone,0,s.height+4.6,-s.depth/2,1.1,.25,.25,group);
    box(dark,0,.7,-s.depth*.2,2.4,1.2,1.4,group);add(geo.sphere,bone,0,1.4,-s.depth*.2,.42,.5,.38,group);
   }
   for(let i=0;i<10;i++)box(i%3?dark:bone,(random()-.5)*(s.width-2),.2,(random()-.5)*(s.depth-2),.3+random()*.8,.25,.3+random()*.6,group).rotation.y=random()*6.28;
  }
  const buckets=new Map();group.updateMatrixWorld(true);
  for(const child of [...group.children]) {
   const entries=buckets.get(child.material)||[],g=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();
   entries.push(g.applyMatrix4(child.matrix));buckets.set(child.material,entries);child.removeFromParent();
  }
  const pieces=[];
  for(const [material,geometries] of buckets) {
   const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
   if(!geometry)continue;game.ownedGeometries.add(geometry);
   const copy=material.clone();copy.transparent=true;game.mats[`building${s.id}${pieces.length}`]=copy;
   const mesh=new THREE.Mesh(geometry,copy);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.noStaticBatch=true;group.add(mesh);pieces.push(mesh);
  }
  occluders.push({definition:s,pieces,opacity:1});
 }
 // Graves, bones, broken wagons, dead woods and grass share instanced geometry.
 for(let i=0;i<350;i++) {
  const a=random()*Math.PI*2,r=i<100?7+random()*22:18+Math.sqrt(random())*(WORLD_RADIUS-20),x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(!isWalkable(x,z,2))continue;const h=terrainHeight(x,z);
  if(i<110){const rock=add(geo.sphere,i%3?stone:dark,x,h+.15,z,.3+random()*.9,.3+random()*.8,.3+random()*.8);rock.rotation.set(random(),random()*6,random());}
  else if(i<190){const blade=box(wood,x,h+.3,z,.055,.4+random()*.65,.08);blade.rotation.z=(random()-.5)*.7;}
  else if(i<245){const grave=box(stone,x,h+.55,z,.7,1.1,.25);grave.rotation.z=(random()-.5)*.3;box(bone,x,h+.75,z+.15,.35,.1,.04);}
  else if(i<290){for(let j=0;j<3;j++)box(bone,x+(j-1)*.22,h+.12,z,.09,.08,.6+random()*.4).rotation.y=random()*2;}
  else {const trunk=box(wood,x,h+1.8,z,.3,3.6,.3);trunk.rotation.z=.12;for(const side of [-1,1])box(wood,x+side*.5,h+2.5,z,.15,1.7,.17).rotation.z=side*.8;}
 }
 // The spawn circle stays flat and provides an obvious starting landmark.
 for(let i=0;i<16;i++){const a=i/16*Math.PI*2;box(dark,Math.cos(a)*5,.04,Math.sin(a)*5,.8,.1,1.2).rotation.y=-a;}
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
 const tint=new THREE.Color(),white=new THREE.Color('#d0d8c0');
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
 return {ground,tint,white,updateOcclusion,structures:STRUCTURES,colliders:WORLD_COLLIDERS,hills:HILLS,height:terrainHeight,isWalkable,resolve:resolveTerrainMovement,steer,updateNavigation};
}
