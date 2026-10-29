import * as THREE from 'three';
import {rigMaterial,deformReference} from './monster-motion.js';
const REST_POSE=new Float32Array(8);

/** Draw identical opaque monster parts together, keeping their exact geometry and materials. */
export class EnemyRenderer {
  constructor(scene, enemies, capacity = 160) {
    this.scene = scene;
    this.enemies = enemies;
    this.capacity = capacity;
    this.enabled = true;
    this.batches = new Map();
    this.hidden = new Set();
    this.rigMaterials=new Map();this.cpuParts=new Map();
    this.rigDepth=rigMaterial(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking}));
    this.rigDistance=rigMaterial(new THREE.MeshDistanceMaterial());
    this.visibility = new WeakMap();
    this.frustum = new THREE.Frustum();
    this.projection = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.previousHook = scene.onBeforeRender;
    this.hook = (...args) => { this.previousHook?.apply(scene, args); this.sync(args[2]); };
    scene.onBeforeRender = this.hook;
  }

  restore() {
    for (const mesh of this.hidden) mesh.visible = this.visibility.get(mesh);
    this.hidden.clear();
  }

  batchFor(part) {
    const key = `${part.geometry.uuid}:${part.material.uuid}:${part.castShadow}:${part.receiveShadow}:${part.layers.mask}`;
    let batch = this.batches.get(key);
    if (!batch) {
      const rigged=!!part.geometry.attributes.vrJoint;
      let geometry=part.geometry,material=part.material;
      if(rigged){
        geometry=new THREE.BufferGeometry();geometry.index=part.geometry.index;geometry.attributes={...part.geometry.attributes};geometry.boundingSphere=part.geometry.boundingSphere?.clone()||null;if(geometry.boundingSphere)geometry.boundingSphere.radius+=1.4;
        geometry.setAttribute('vrPose0',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(THREE.DynamicDrawUsage));
        geometry.setAttribute('vrPose1',new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*4),4).setUsage(THREE.DynamicDrawUsage));
        if(!this.rigMaterials.has(material))this.rigMaterials.set(material,rigMaterial(material));material=this.rigMaterials.get(material);
      }
      const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      if(rigged){mesh.customDepthMaterial=this.rigDepth;mesh.customDistanceMaterial=this.rigDistance;}
      mesh.name = 'Monster instances';
      mesh.count = 0; mesh.visible = false;
      mesh.castShadow = part.castShadow; mesh.receiveShadow = part.receiveShadow;
      mesh.layers.mask = part.layers.mask;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.matrixAutoUpdate = false; mesh.matrixWorldAutoUpdate = false;
      this.scene.add(mesh);
      batch = { mesh, count: 0, rigged }; this.batches.set(key, batch);
    }
    return batch;
  }

  cpuPose(part,enemy,reference=false){
    const existing=this.cpuParts.get(part),original=existing?.original||part.geometry;
    if(!original.attributes.vrJoint)return;
    let entry=existing;if(!entry){entry={original,geometry:original.clone(),reference};this.cpuParts.set(part,entry);}entry.reference=reference;part.geometry=entry.geometry;deformReference(original,entry.geometry,enemy.motion?.pose||REST_POSE);
  }
  clearCpu(referenceOnly=false){for(const [part,e] of this.cpuParts)if(!referenceOnly||e.reference){part.geometry=e.original;e.geometry.dispose();this.cpuParts.delete(part);}}
  release(enemy){for(const part of enemy.visual.children){const e=this.cpuParts.get(part);if(e){part.geometry=e.original;e.geometry.dispose();this.cpuParts.delete(part);}if(this.hidden.delete(part))part.visible=this.visibility.get(part);}}
  sync(camera) {
    this.restore();
    if(this.enabled)this.clearCpu(true);
    for (const batch of this.batches.values()) { batch.count = 0; batch.mesh.count = 0; batch.mesh.visible = false; }
    if (!camera) return;
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    for (const enemy of this.enemies) {
      // Boss materials and attachments can change independently during an encounter.
      if (enemy.hp <= 0 || !enemy.group.visible || !enemy.visual.visible) continue;
      for (const part of enemy.visual.children) {
        const material = part.material;
        if (!part.isMesh || !part.visible) continue;
        if(!this.enabled||enemy.kind===4||Array.isArray(material)||material.transparent||material.opacity<1||part.isSkinnedMesh){this.cpuPose(part,enemy,!this.enabled);continue;}
        if (!this.visibility.has(part)) this.visibility.set(part, part.visible);
        if (!part.geometry.boundingSphere) part.geometry.computeBoundingSphere();
        this.sphere.copy(part.geometry.boundingSphere).applyMatrix4(part.matrixWorld);
        if(part.geometry.attributes.vrJoint)this.sphere.radius+=1.4*part.matrixWorld.getMaxScaleOnAxis();
        // Off-screen casters remain so their shadows still reach visible terrain.
        const visible = this.frustum.intersectsSphere(this.sphere);
        if (!visible && !part.castShadow) { part.visible = false; this.hidden.add(part); continue; }
        const batch = this.batchFor(part);
        // Debug fixtures can exceed the gameplay cap: render overflow individually.
        if (batch.count >= this.capacity) {this.cpuPose(part,enemy,true);continue;}
        if(batch.rigged){const pose=enemy.motion?.pose||REST_POSE,at=batch.count*4,a=batch.mesh.geometry.attributes.vrPose0.array,b=batch.mesh.geometry.attributes.vrPose1.array;for(let c=0;c<4;c++){a[at+c]=pose[c];b[at+c]=pose[c+4];}}
        batch.mesh.setMatrixAt(batch.count++, part.matrixWorld);
        part.visible = false; this.hidden.add(part);
      }
    }
    for (const batch of this.batches.values()) {
      const { mesh, count } = batch;
      if (!count) continue;
      mesh.count = count; mesh.visible = true;
      mesh.instanceMatrix.clearUpdateRanges(); mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if(batch.rigged)for(const id of ['vrPose0','vrPose1']){const attr=mesh.geometry.attributes[id];attr.clearUpdateRanges();attr.addUpdateRange(0,count*4);attr.needsUpdate=true;}
      mesh.computeBoundingSphere();
    }
  }

  reset() {
    this.restore();this.clearCpu();
    for (const batch of this.batches.values()) { batch.mesh.count = 0; batch.mesh.visible = false; }
  }

  getDebugState() {
    return { enabled: this.enabled, batches: this.batches.size, activeBatches: [...this.batches.values()].filter(b => b.mesh.visible).length, instances: [...this.batches.values()].reduce((n, b) => n + b.mesh.count, 0) };
  }

  dispose() {
    this.reset();
    if (this.scene.onBeforeRender === this.hook) this.scene.onBeforeRender = this.previousHook;
    for (const { mesh,rigged } of this.batches.values()) { mesh.removeFromParent(); mesh.dispose();if(rigged)mesh.geometry.dispose(); }
    this.rigMaterials.forEach(m=>m.dispose());this.rigMaterials.clear();this.rigDepth.dispose();this.rigDistance.dispose();
    this.batches.clear();
  }
}
