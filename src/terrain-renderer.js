import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {sculptedGeometry} from './sculpted-models.js';
import {terrainHeight} from './terrain.js';

/** Walk surfaces, retaining walls and ceilings use the same bounds as physics. */
export class TerrainRenderer {
  constructor(game,layout){
    this.game=game;this.layout=layout;this.root=new THREE.Group();this.root.name='Explorable '+layout.region+' district';this.root.userData.noStaticBatch=true;
    this.geometries=[];this.materials=[];this.roofs=[];this.switches=[];this.breakables=new Map();this.gates=new Map();this.lava=[];
    const palettes={volcano:['#49413c','#1e2027','#876650'],tundra:['#91afb8','#476b7b','#d9dfe0'],forest:['#403c2e','#272d24','#647e4e'],ruins:['#797b77','#3c4448','#a59d82'],void:['#544962','#242131','#9688b5']};
    const colors=palettes[layout.region]||palettes.ruins;
    const material=(color,roughness=.82,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness,map:game.presentation.stoneMap,normalMap:game.presentation.stoneNormal,...extra});this.materials.push(m);return m;};
    const stone=material(colors[0]),dark=material(colors[1]),edge=material(colors[2]),wood=material('#554d37',.94,{map:null,normalMap:null}),ice=material('#a7cdd8',.25,{metalness:.12,map:null});
    const accent=material(layout.region==='volcano'?'#c25224':layout.region==='void'?'#9381c0':'#9cc8c7',.55,{emissive:layout.region==='volcano'?'#a5270c':'#425d6c',emissiveIntensity:.45,map:null});
    this.rockMaterial=stone;
    const own=g=>{this.geometries.push(g);return g;};
    const cube=own(new THREE.BoxGeometry(1,1,1)),piles=new Map();
    const mesh=(geo,mat,x,y,z,sx=1,sy=1,sz=1,parent=this.root)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
    const block=(id,x,z,hx,hz,lo,hi,mat,options={})=>{
      let parent=this.root;
      if(options.gate){if(!this.gates.has(options.gate)){const group=new THREE.Group();this.root.add(group);this.gates.set(options.gate,group);this.switches.push({mesh:group,gate:options.gate});group.visible=!!layout.interactions.find(i=>i.id===options.gate)?.opened;}parent=this.gates.get(options.gate);}
      const m=mesh(cube,mat,x,(lo+hi)/2,z,hx*2,Math.max(.04,hi-lo),hz*2,parent);m.name=id;
      if(options.roof)this.roofs.push({mesh:m,top:hi,box:{x,z,hx,hz},opacity:1});
      if(options.gate||options.roof){}
      else if(options.breakable||options.door||options.gate){m.userData.terrainSolid=id;this.breakables.set(id,m);}
      else {const list=piles.get(mat)||[];list.push(m);piles.set(mat,list);}
      return m;
    };
    for(const s of layout.surfaces){
      if(!s.walk||s.stairs)continue;
      const mat=s.root?wood:layout.region==='tundra'?ice:s.island?dark:stone;
      const roofMat=mat.clone();this.materials.push(roofMat);
      const m=block(s.id,s.x,s.z,s.hx,s.hz,s.y-.48,s.y,roofMat,{...s,roof:true});
      if(s.bridge){
        const alongX=s.hx>s.hz,length=alongX?s.hx:s.hz;
        for(const side of [-1,1]){
          const x=s.x+(alongX?0:side*(s.hx-.12)),z=s.z+(alongX?side*(s.hz-.12):0);
          block(s.id+':rail',x,z,alongX?length:.10,alongX?.10:length,s.y+.7,s.y+1,edge,{gate:s.gate});
          for(let i=-Math.floor(length/3);i<=Math.floor(length/3);i++)block(s.id+':post',x+(alongX?i*3:0),z+(alongX?0:i*3),.12,.12,s.y,s.y+1.05,edge,{gate:s.gate});
        }
      }
      if(s.island){
        const points=[],faces=[],n=8;
        for(let ring=0;ring<3;ring++)for(let i=0;i<n;i++){const a=i/n*Math.PI*2,r=ring===0?1: ring===1?.68:.12;points.push(Math.sin(a)*s.hx*r,s.y-.45-ring*2.2,Math.cos(a)*s.hz*r);}
        for(let r=0;r<2;r++)for(let i=0;i<n;i++){const a=r*n+i,b=r*n+(i+1)%n;faces.push(a,b,a+n,b,b+n,a+n);}
        const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(points,3));g.setIndex(faces);g.computeVertexNormals();mesh(g,dark,s.x,0,s.z);
      }
    }
    const rootShape=s=>{
      const p=[],uv=[],indices=[],rings=16,sides=12,h=s.maxY-s.minY;
      for(let j=0;j<=rings;j++)for(let k=0;k<=sides;k++){
        const t=j/rings,a=k/sides*Math.PI*2,bulge=.88+.12*Math.sin(t*Math.PI),bend=.12*Math.sin(t*Math.PI*2);
        p.push(Math.cos(a)*s.hx*bulge+bend,h*.5+Math.sin(a)*h*.49,(t*2-1)*s.hz);uv.push(k/sides,t*3);
      }
      for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){const a=j*(sides+1)+k,b=a+sides+1;indices.push(a,a+1,b,a+1,b+1,b);}
      for(const end of [0,rings]){const center=p.length/3;p.push(0,h*.5,(end?1:-1)*s.hz);uv.push(.5,.5);for(let k=0;k<sides;k++){const a=end*(sides+1)+k;indices.push(center,end?a:a+1,end?a+1:a);}}
      const g=own(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
    };
    for(const s of layout.solids){
      if(s.slab||s.trunk)continue;
      if(s.root){const m=mesh(rootShape(s),wood,s.x,s.minY,s.z);m.name=s.id;if(s.breakable)this.breakables.set(s.id,m);else{const list=piles.get(wood)||[];list.push(m);piles.set(wood,list);}continue;}
      const mat=s.breakable?edge:s.parapet?edge:s.root?wood:stone;
      block(s.id,s.x,s.z,s.hx,s.hz,s.minY,s.maxY,mat,s);
    }
    // Layered rock faces make depressions read as cliffs rather than mesh ramps.
    for(const p of layout.patches)if(!p.ramp&&p.id==='canyon'){
      for(const side of [-1,1])for(let n=0;n<11;n++){
        const z=p.z+(n-5)*4.1,x=p.x+side*(p.hx+.35),top=terrainHeight(x,z);
        block('canyon-stratum',x,z,.52,1.9,p.y-.2,Math.max(p.y+.5,top),n%2?stone:dark);
      }
    }
    for(const i of layout.interactions){
      const group=new THREE.Group();group.position.set(i.x,i.y,i.z);this.root.add(group);
      mesh(cube,dark,0,.45,0,.65,.9,.65,group);mesh(cube,accent,0,1.05,0,.22,.35,.22,group);i.visual=group;
    }
    if(layout.region==='forest'){
      const tree=new THREE.InstancedMesh(sculptedGeometry(game,'world_tree'),wood,24),d=new THREE.Object3D();tree.castShadow=tree.receiveShadow=true;
      for(let i=0;i<24;i++){const side=i%2?1:-1,x=side*(13+(i%3)*3.2),z=-21-Math.floor(i/2)*2.9;d.position.set(x,layout.ground(x,z),z);d.rotation.y=i*2.39;d.scale.setScalar(1.05+i%3*.12);d.updateMatrix();tree.setMatrixAt(i,d.matrix);}
      this.root.add(tree);
    }
    // Authored arch sections make underground entrances readable at player height.
    for(const roof of layout.surfaces.filter(s=>s.roof&&!s.citadel)){
      const floor=layout.ground(roof.x,roof.z),height=roof.y-floor-.06,shape=new THREE.Shape();
      shape.moveTo(-6.6,0);shape.lineTo(-6.6,height);shape.lineTo(6.6,height);shape.lineTo(6.6,0);shape.lineTo(5.2,0);shape.lineTo(5.2,height-2.2);
      shape.bezierCurveTo(5.2,height-.5,2.4,height-.45,0,height-.45);shape.bezierCurveTo(-2.4,height-.45,-5.2,height-.5,-5.2,height-2.2);shape.lineTo(-5.2,0);shape.closePath();
      const geometry=own(new THREE.ExtrudeGeometry(shape,{depth:.55,steps:1,bevelEnabled:true,bevelSegments:1,bevelSize:.07,bevelThickness:.07,curveSegments:12}));
      for(const side of [-1,1]){const m=mesh(geometry,layout.region==='tundra'?ice:edge,roof.x+side*8.05,floor,roof.z);m.rotation.y=Math.PI/2;}
      if(layout.region==='tundra'){
        const stalactite=own(new THREE.ConeGeometry(.28,1,7));
        for(let i=0;i<12;i++){const m=mesh(stalactite,ice,roof.x-6+(i%6)*2.4,roof.y-1,roof.z+(i<6?-4.7:4.7),.8,1+(i%3)*.3,.8);m.rotation.z=Math.PI;}
      }
    }
    for(const d of layout.dangers){
      const mat=new THREE.MeshBasicMaterial({color:'#ee5e20',transparent:true,opacity:.25,depthWrite:false,side:THREE.DoubleSide});this.materials.push(mat);
      const m=mesh(own(new THREE.PlaneGeometry(d.hx*2,d.hz*2)),mat,d.x,d.y+.07,d.z);m.rotation.x=-Math.PI/2;m.castShadow=false;this.lava.push(m);
    }
    for(const s of layout.surfaces.filter(s=>s.root)){
      for(const offset of [-1.7,0,1.7]){
        const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(-11,-.8,offset-.2),new THREE.Vector3(-5,-1.1,offset+.4),new THREE.Vector3(3,-.9,offset-.3),new THREE.Vector3(11,-.8,offset+.2)]);
        const geo=own(new THREE.TubeGeometry(curve,18,.72,8,false));mesh(geo,wood,s.x,s.y,s.z);
      }
      // A real timber tread sits on the roots; footsteps keep the shared deck height.
      for(let x=-10.65;x<11;x+=.7)block('root-tread',s.x+x,s.z,.32,s.hz-.12,s.y,s.y+.025,wood);
    }

    const mergeList=(mat,list,parent=this.root)=>{
      const pieces=list.map(m=>{m.updateMatrix();const g=m.geometry.clone().applyMatrix4(m.matrix);m.removeFromParent();return g;});
      if(!pieces.length)return;const g=own(mergeGeometries(pieces,false));pieces.forEach(g=>g.dispose());mesh(g,mat,0,0,0,1,1,1,parent);
    };
    for(const group of this.gates.values()){const byMaterial=new Map();for(const m of [...group.children]){if(this.roofs.some(r=>r.mesh===m))continue;const list=byMaterial.get(m.material)||[];list.push(m);byMaterial.set(m.material,list);}for(const [mat,list] of byMaterial)mergeList(mat,list,group);}
    for(const [mat,list] of piles)mergeList(mat,list);

    // Geometry is private to this three-entry region cache, never a gameplay mesh.
    this.root.traverse(o=>{if(o.isMesh)o.userData.noStaticBatch=true;});
    game.scene.add(this.root);this.groundGeometry=this.makeGround(layout);
  }
  makeGround(layout){
    const size=131,step=1.5,extent=97.5,p=[],uv=[],colors=[],indices=[];
    for(let z=0;z<size;z++)for(let x=0;x<size;x++){
      const wx=x*step-extent,wz=z*step-extent,h=layout.ground(wx,wz);p.push(wx,h,wz);uv.push(wx/195+.5,wz/195+.5);
      const v=.78+.025*Math.sin(wx*.23)*Math.cos(wz*.3);colors.push(v,v+.015,v-.035);
    }
    for(let z=0;z<size-1;z++)for(let x=0;x<size-1;x++){if(Math.hypot((x+.5)*step-extent,(z+.5)*step-extent)>98)continue;const a=z*size+x,b=a+1,c=a+size,d=c+1;indices.push(a,c,b,b,c,d);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(new Float32Array(p.length),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();this.geometries.push(g);return g;
  }
  sync(){
    for(const s of this.layout.solids){const m=this.breakables.get(s.id);if(m)m.visible=!s.disabled&&(!s.door||!this.layout.interactions.find(i=>i.id===s.door)?.opened);}
    for(const s of this.switches)s.mesh.visible=!!this.layout.interactions.find(i=>i.id===s.gate)?.opened;
  }
  fade(player,mode,dt){
    for(const r of this.roofs){const under=Math.abs(player.x-r.box.x)<r.box.hx+.5&&Math.abs(player.z-r.box.z)<r.box.hz+.5&&player.y<r.top-2,target=under&&mode==='overhead'?.12:1;r.opacity+=(target-r.opacity)*(1-Math.exp(-Math.max(0,dt)*12));if(Math.abs(r.opacity-target)<.001)r.opacity=target;r.mesh.material.opacity=r.opacity;const transparent=r.opacity<.995;if(r.mesh.material.transparent!==transparent){r.mesh.material.transparent=transparent;r.mesh.material.needsUpdate=true;}r.mesh.material.depthWrite=!transparent;r.mesh.castShadow=r.opacity>.95;}
  }
  dispose(){this.root.removeFromParent();this.root.traverse(m=>{if(m.isInstancedMesh)m.dispose();});this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());}
}
