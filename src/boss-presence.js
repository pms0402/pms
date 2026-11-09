import * as THREE from 'three';
import {jointAngles,jointPivot} from './monster-motion.js';

/** Role-specific forged silhouettes mounted to the same shoulder and spine pivots as the body. */
export function createBossPresence(boss,renderer){
  if(boss.hiddenBoss)return null;
  const root=new THREE.Group();root.name='Articulated boss armament';boss.group.add(root);boss.bossArmament=root;const joints=[];
  const own=g=>{g.userData.bossPresence=true;renderer.geometries.push(g);return g;};
  const steel=new THREE.MeshStandardMaterial({color:'#303a40',metalness:.7,roughness:.34}),trim=new THREE.MeshStandardMaterial({color:renderer.layout.definition.color,metalness:.58,roughness:.46}),dark=new THREE.MeshStandardMaterial({color:'#182028',roughness:.66});renderer.materials.push(steel,trim,dark);
  const mesh=(geometry,material,parent,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const shape=(points,depth)=>{const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();return own(new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,curveSegments:8}));};
  const bind=j=>{const group=new THREE.Group(),pivot=jointPivot(4,j);group.position.fromArray(pivot);root.add(group);joints.push({group,j,pivot});return group;};
  const id=boss.archetype;
  if(id==='warden'){
    const arm=bind(2),shield=shape([[-.42,-.65],[-.62,.15],[-.28,.5],[.29,.43],[.43,.08],[.20,-.62],[0,-.9]],.12);mesh(shield,steel,arm,-.35,-.35,.22);mesh(shape([[-.04,-.62],[-.04,.38],[.04,.38],[.04,-.62]],.025),trim,arm,-.4,-.32,.37);
  }else if(id==='artillery'){
    const arm=bind(3);for(const side of [-1,1]){const barrel=mesh(own(new THREE.CylinderGeometry(.14,.19,.95,10,1,true)),steel,arm,side*.17,-.05,.65);barrel.rotation.x=Math.PI/2;const muzzle=mesh(own(new THREE.TorusGeometry(.16,.035,5,12)),trim,arm,side*.17,-.05,1.13);muzzle.rotation.x=0;mesh(own(new THREE.CircleGeometry(.125,12)),dark,arm,side*.17,-.05,1.136);}
    mesh(shape([[-.4,-.22],[-.38,.26],[.36,.26],[.43,-.22]],.26),steel,arm,-.02,-.12,.05);
  }else if(id==='plague'){
    const back=bind(0),blade=shape([[0,0],[-.3,.3],[-.42,.7],[-.32,1.05],[-.18,1.12],[-.23,.65],[.15,.24]],.06);for(const side of [-1,1]){const m=mesh(blade,trim,back,side*.46,1.25,-.33);m.scale.x=side;m.rotation.x=-.35;}
    const arm=bind(2);for(let n=0;n<3;n++){const claw=mesh(shape([[0,0],[.05,-.28],[.015,-.48],[-.04,-.3],[-.04,0]],.025),trim,arm,-.11+n*.1,-.62,.19);claw.rotation.x=-.2;}
  }else if(id==='brood'){
    const spine=bind(0);for(const side of [-1,1])for(let n=0;n<2;n++){const m=mesh(shape([[0,0],[.32,.38],[.45,.92],[.31,1.16],[.38,.55],[.19,.12]],.08),steel,spine,side*.4,1.1-n*.22,-.15);m.scale.x=side*(1+n*.15);m.rotation.z=-side*n*.22;}
  }else if(id==='storm'){
    const spine=bind(0),wing=shape([[0,0],[.9,.65],[.78,.4],[.61,.43],[.55,.15],[.39,.26],[.25,-.18]],.045);for(const side of [-1,1]){const m=mesh(wing,trim,spine,side*.43,1.65,-.25);m.scale.x=side;}
    const hand=bind(3);mesh(shape([[0,0],[.2,-.04],[.05,.28],[.24,.23],[.02,.8],[-.04,.37],[-.17,.43]],.045),trim,hand,.05,-.5,.2);
  }else{
    const hand=bind(3);mesh(own(new THREE.CylinderGeometry(.028,.04,1.7,8)),steel,hand,0,-.02,.15);
    mesh(shape([[0,.65],[-.1,.85],[-.53,.89],[-.94,.65],[-1.13,.29],[-.62,.65],[-.12,.68]],.055),trim,hand,0,0,.15);
    const spine=bind(0);for(const side of [-1,1]){const cloth=mesh(shape([[0,0],[.3,-.17],[.41,-1.2],[.25,-.94],[.16,-1.5],[-.07,-1.21]],.025),dark,spine,side*.3,1.55,-.36);cloth.scale.x=side;}
  }
  const angles=new Float32Array(3);
  return{root,update(){const pose=boss.motion?.pose;if(!pose)return;root.position.copy(boss.visual.position);root.rotation.copy(boss.visual.rotation);root.scale.copy(boss.visual.scale);root.visible=boss.visual.visible;for(const {group,j} of joints){jointAngles(4,j,pose,angles);group.rotation.set(angles[0],angles[1],angles[2],'ZYX');}},dispose(){root.removeFromParent();boss.bossArmament=null;}};
}
