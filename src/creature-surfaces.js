import * as THREE from 'three';

/** Original pore, scar and fabric normals, shared by all actors. */
export class CreatureSurfaces{
 constructor(game){this.game=game;this.textures=[];const size=128,height=new Float32Array(size*size),pixels=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),weave=new Uint8Array(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,vein=Math.sin(x*.13+Math.sin(y*.09)*2),h=.48+.14*Math.sin(x*1.71+y*.73)*Math.cos(y*1.23)+Math.max(0,vein)**12*.2;height[i]=h;const v=Math.round(175+h*70);pixels.set([v,v,Math.max(0,v-6),Math.round(170+h*70)],i*4);}
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];normal.set([128-dx*80,128-dy*80,247,255],i);weave.set([128+Math.sin(x*Math.PI*.5)*18,128+Math.sin(y*Math.PI*.5)*18,252,255],i);}
  const texture=(data,color=false)=>{const t=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;if(color)t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;this.textures.push(t);return t;};
  this.albedo=texture(pixels,true);this.normal=texture(normal);this.weave=texture(weave);
  for(const key of ['enemy','enemy2','enemy3','boss','charger','bomber','splitter','sniper','shaman','ranged']){const m=game.mats[key];m.map=this.albedo;m.normalMap=this.normal;m.normalScale.set(.24,.24);m.roughness=key==='splitter'?.27:key==='bomber'?.5:.87;m.envMapIntensity=key==='splitter'?1.25:.6;}
  const colors={enemy:'#53634e',enemy2:'#594b49',enemy3:'#665a65',boss:'#59464b',charger:'#665345',bomber:'#4f6252',splitter:'#3e6866',sniper:'#89928f',shaman:'#675f74',ranged:'#515b6a'};for(const [key,color] of Object.entries(colors))game.mats[key].color.set(color);
  game.mats.enemyDark.color.set('#25282c');game.mats.enemyDark.normalMap=this.weave;game.mats.enemyDark.normalScale.set(.28,.28);game.mats.bone.color.set('#b8ad91');
  game.geo.organicTorso=new THREE.LatheGeometry([new THREE.Vector2(0,-1),new THREE.Vector2(.56,-1),new THREE.Vector2(.72,-.7),new THREE.Vector2(.77,-.25),new THREE.Vector2(1,.35),new THREE.Vector2(.88,.8),new THREE.Vector2(.48,1),new THREE.Vector2(0,1)],12);
  for(const [key,kind] of [['organicSkull',0],['carapace',1],['gel',2]]){const g=game.geo.round.clone(),p=g.attributes.position;for(let i=0;i<p.count;i++){let x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(kind===0){x*=.73+.22*Math.max(0,y+.3);z*=.88;y*=1.08;z+=Math.max(0,z)*Math.max(0,-y)*.1;}else if(kind===1){y*=y>0?1+.13*Math.cos(x*9):.75;z*=.92+.08*Math.cos(y*5);}else{const n=1+.07*Math.sin(x*6+z*4)*Math.cos(y*7);x*=n;z*=n;y+=Math.sin(x*7+z*4)*.035;}p.setXYZ(i,x,y,z);}p.needsUpdate=true;g.computeVertexNormals();game.geo[key]=g;}
 }
 hero(){const h=this.game.heroMaterials;if(!h)return;for(const m of [h.cloth,h.lining,h.leather]){m.normalMap=this.weave;m.normalScale.set(.3,.3);}h.cloth.color.set('#24252d');h.face.normalMap=this.normal;h.face.normalScale.set(.08,.08);h.armor.roughness=.31;h.edge.roughness=.27;}
 dispose(){this.textures.forEach(t=>t.dispose());}
}
