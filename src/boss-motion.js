import * as THREE from 'three';
import {tagMotionGeometry,deformReference} from './monster-motion.js';

const hiddenRigs=new WeakMap();
export function hiddenBindGeometry(e,mesh){return hiddenRigs.get(e)?.parts.find(p=>p.mesh===mesh)?.original||mesh.geometry;}
export function animateHiddenAnatomy(e,dt){
  if(!e.specialModel||!e.motion?.pose)return;let rig=hiddenRigs.get(e);
  if(!rig){rig={parts:[],joints:[]};e.specialModel.traverse(m=>{
    if(e.hiddenBoss==='king'){if(m.isGroup&&/hip|shoulder|Spine|pelvis|Elbow|Knee|silver locks/i.test(m.name))rig.joints.push({node:m,rest:m.rotation.clone()});}
    else if(m.isMesh){const source=tagMotionGeometry(m.geometry.clone(),4,m.userData.rigJoint||0,m.userData.rigPivot),target=source.clone();m.geometry=target;rig.parts.push({mesh:m,original:source,target});}
  });hiddenRigs.set(e,rig);}
  const p=e.motion.pose,a=p[2],w=p[3],step=Math.sin(p[0])*p[1];
  for(const part of rig.parts)deformReference(part.original,part.target,p);
  for(const {node,rest} of rig.joints){const side=/Left/.test(node.name)?-1:1;let x=0,y=0,z=0;
    if(/hip/.test(node.name))x=side*step*.45+w*.1;
    else if(/shoulder/.test(node.name)){x=-w*.6+a*.75-step*side*.2;y=side*(a*.55-w*.3);z=side*(w*.35-a*.2);}
    else if(/Spine/.test(node.name)){y=-w*.22+a*.35;x=w*-.1+a*.12;}
    else if(/Elbow/.test(node.name))x=-w*.45+a*.2;
    else if(/Knee/.test(node.name))x=Math.abs(step)*.24+w*.15;
    else if(/locks/.test(node.name))x=Math.sin(p[0]*.5+side)*.055;
    node.rotation.x=THREE.MathUtils.damp(node.rotation.x,rest.x+x,18,dt);node.rotation.y=THREE.MathUtils.damp(node.rotation.y,rest.y+y,18,dt);node.rotation.z=THREE.MathUtils.damp(node.rotation.z,rest.z+z,18,dt);
  }
}
export function releaseHiddenAnatomy(e){const rig=hiddenRigs.get(e);if(!rig)return;for(const p of rig.parts){p.mesh.geometry=p.original;p.target.dispose();p.original.dispose();}hiddenRigs.delete(e);}
