import * as THREE from 'three';
import collection from './assets/sculpted-models.json' with { type: 'json' };

/** Blender-authored bind meshes, decoded once and shared by every instance. */
export function sculptedGeometry(game, id, index=0) {
  game.sculptedGeometries ||= new Map();
  const key=id+':'+index;
  if(game.sculptedGeometries.has(key))return game.sculptedGeometries.get(key);
  const entry=collection.meshes[id]?.[index];
  if(!entry)throw new Error('Missing authored silhouette: '+key);
  const decode=(value,Type)=>{
    const source=atob(value),bytes=new Uint8Array(source.length);
    for(let i=0;i<source.length;i++)bytes[i]=source.charCodeAt(i);
    return new Type(bytes.buffer);
  };
  const positions=Float32Array.from(decode(entry.p,Int16Array),n=>n*collection.scale),normals=Float32Array.from(decode(entry.n,Int16Array),n=>n*collection.normalScale),uv=new Float32Array(positions.length/3*2);
  for(let i=0;i<positions.length/3;i++){uv[i*2]=positions[i*3]*.7+.5;uv[i*2+1]=positions[i*3+1]*.7;}
  const geometry=new THREE.BufferGeometry();geometry.name=id;
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2));geometry.setIndex(new THREE.BufferAttribute(decode(entry.i,Uint16Array),1));
  geometry.userData.sculpted=id;geometry.computeBoundingBox();geometry.computeBoundingSphere();
  game.ownedGeometries.add(geometry);game.sculptedGeometries.set(key,geometry);
  return geometry;
}

export function buildSculptedMonster(game, parent, kind, skin, id='monster_'+kind) {
  const records=collection.meshes[id];if(!records)return false;
  const m=game.mats,materials={skin,armor:m.enemyDark,cloth:m.enemyDark,dark:m.enemyDark,bone:m.bone,eye:kind===9?m.healGlow:m.eye,glow:kind===9?m.healGlow:kind===3?m.rangedGlow:m.bossGlow,wood:m.trunk};
  records.forEach((record,index)=>{
    const mesh=new THREE.Mesh(sculptedGeometry(game,id,index),materials[record.surface]||skin);
    mesh.name=id+'/'+record.surface;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.rigJoint=record.joint;
    if(record.pivot)mesh.userData.rigPivot=record.pivot;
    parent.add(mesh);
  });
  parent.userData.design=id;return true;
}

export const SCULPTED_ASSETS=Object.freeze(Object.keys(collection.meshes));
