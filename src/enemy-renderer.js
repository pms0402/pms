import * as THREE from "three";
import { rigMaterial, deformReference, jointAngles } from "./monster-motion.js";
import { MonsterLod } from "./mesh-lod.js";
const REST_POSE = new Float32Array(8);

/** Draw identical opaque monster parts together, keeping their exact geometry and materials. */
export class EnemyRenderer {
  constructor(scene, enemies, capacity = 160) {
    this.scene = scene;
    this.enemies = enemies;
    this.capacity = capacity;
    this.enabled = true;
    this.batches = new Map();
    this.hidden = new Set();
    this.rigMaterials = new Map();
    this.cpuParts = new Map();
    this.lod = new MonsterLod();
    this.viewportHeight = 900;
    this.rigidParts = new WeakMap();
    this.rigidAngles = new Float64Array(3);
    this.rigidEuler = new THREE.Euler(0, 0, 0, "ZYX");
    this.rigidMatrix = new THREE.Matrix4();
    this.rigidPoint = new THREE.Vector3();
    this.rigDepth = rigMaterial(
      new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }),
    );
    this.rigDistance = rigMaterial(new THREE.MeshDistanceMaterial());
    this.visibility = new WeakMap();
    this.frustum = new THREE.Frustum();
    this.projection = new THREE.Matrix4();
    this.sphere = new THREE.Sphere();
    this.previousHook = scene.onBeforeRender;
    this.hook = (...args) => {
      this.previousHook?.apply(scene, args);
      this.viewportHeight = args[0].domElement?.height || 900;
      this.sync(args[2]);
    };
    scene.onBeforeRender = this.hook;
  }

  restore() {
    for (const mesh of this.hidden) mesh.visible = this.visibility.get(mesh);
    this.hidden.clear();
  }

  batchFor(part) {
    const key = `${part.geometry.uuid}:${part.material.uuid}:${part.castShadow}:${part.receiveShadow}:${part.layers.mask}`;
    let batch = this.batches.get(key);
    const selected = this.lod.geometry(part.geometry);
    if (batch && batch.source !== selected) {
      batch.mesh.removeFromParent();
      batch.mesh.dispose();
      if (batch.rigged) batch.mesh.geometry.dispose();
      this.batches.delete(key);
      batch = null;
    }
    if (!batch) {
      const rigged = !!part.geometry.attributes.vrJoint;
      let geometry = selected,
        material = part.material;
      if (rigged) {
        geometry = new THREE.BufferGeometry();
        geometry.index = selected.index;
        geometry.attributes = { ...selected.attributes };
        geometry.boundingSphere = selected.boundingSphere?.clone() || null;
        if (geometry.boundingSphere) geometry.boundingSphere.radius += 1.4;
        geometry.setAttribute(
          "vrPose0",
          new THREE.InstancedBufferAttribute(
            new Float32Array(this.capacity * 4),
            4,
          ).setUsage(THREE.DynamicDrawUsage),
        );
        geometry.setAttribute(
          "vrPose1",
          new THREE.InstancedBufferAttribute(
            new Float32Array(this.capacity * 4),
            4,
          ).setUsage(THREE.DynamicDrawUsage),
        );
        if (!this.rigMaterials.has(material))
          this.rigMaterials.set(material, rigMaterial(material));
        material = this.rigMaterials.get(material);
      }
      const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      if (rigged) {
        mesh.customDepthMaterial = this.rigDepth;
        mesh.customDistanceMaterial = this.rigDistance;
      }
      mesh.name = "Monster instances";
      mesh.count = 0;
      mesh.visible = false;
      mesh.castShadow = part.castShadow;
      mesh.receiveShadow = part.receiveShadow;
      mesh.layers.mask = part.layers.mask;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.matrixAutoUpdate = false;
      mesh.matrixWorldAutoUpdate = false;
      this.scene.add(mesh);
      batch = { mesh, count: 0, rigged, source: selected };
      this.batches.set(key, batch);
    }
    return batch;
  }

  cpuPose(part, enemy, reference = false) {
    const existing = this.cpuParts.get(part),
      original = existing?.original || part.geometry;
    if (!original.attributes.vrJoint) return;
    // A glow attached to one joint needs only a matrix, not one geometry per monster.
    // Scene.updateMatrixWorld restores the bind matrix before every render.
    if (!reference) {
      if (!this.rigidParts.has(original)) {
        const joints = original.attributes.vrJoint.array,
          joint = joints[0];
        this.rigidParts.set(
          original,
          joints.every((j) => j === joint)
            ? {
                joint,
                kind: original.attributes.vrKind.array[0],
                pivot: original.attributes.vrPivot.array.slice(0, 3),
              }
            : null,
        );
      }
      const rigid = this.rigidParts.get(original);
      if (rigid) {
        if (existing) {
          part.geometry = original;
          existing.geometry.dispose();
          this.cpuParts.delete(part);
        }
        if (!rigid.joint) return;
        jointAngles(
          rigid.kind,
          rigid.joint,
          enemy.motion?.pose || REST_POSE,
          this.rigidAngles,
        );
        this.rigidEuler.set(...this.rigidAngles, "ZYX");
        this.rigidMatrix.makeRotationFromEuler(this.rigidEuler);
        const p = rigid.pivot;
        this.rigidPoint.fromArray(p).applyMatrix4(this.rigidMatrix);
        this.rigidMatrix.setPosition(
          p[0] - this.rigidPoint.x,
          p[1] - this.rigidPoint.y,
          p[2] - this.rigidPoint.z,
        );
        part.matrixWorld.multiply(this.rigidMatrix);
        return;
      }
    }
    const selected =
      reference && enemy.kind !== 4 ? this.lod.geometry(original) : original;
    let entry = existing;
    if (entry && entry.source !== selected) {
      entry.geometry.dispose();
      this.cpuParts.delete(part);
      entry = null;
    }
    if (!entry) {
      entry = {
        original,
        source: selected,
        geometry: selected.clone(),
        reference,
      };
      this.cpuParts.set(part, entry);
    }
    entry.reference = reference;
    part.geometry = entry.geometry;
    deformReference(selected, entry.geometry, enemy.motion?.pose || REST_POSE);
  }
  clearCpu(referenceOnly = false) {
    for (const [part, e] of this.cpuParts)
      if (!referenceOnly || e.reference) {
        part.geometry = e.original;
        e.geometry.dispose();
        this.cpuParts.delete(part);
      }
  }
  release(enemy) {
    for (const part of enemy.visual.children) {
      const e = this.cpuParts.get(part);
      if (e) {
        part.geometry = e.original;
        e.geometry.dispose();
        this.cpuParts.delete(part);
      }
      if (this.hidden.delete(part)) part.visible = this.visibility.get(part);
    }
  }
  sync(camera) {
    this.restore();
    if (this.enabled) this.clearCpu(true);
    for (const batch of this.batches.values()) {
      batch.count = 0;
      batch.mesh.count = 0;
      batch.mesh.visible = false;
    }
    if (!camera) return;
    this.lod.prepare(this.enemies, camera, this.viewportHeight, this.cpuParts);
    this.projection.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.projection);
    for (const enemy of this.enemies) {
      // Boss materials and attachments can change independently during an encounter.
      if (enemy.hp <= 0 || !enemy.group.visible || !enemy.visual.visible)
        continue;
      for (const part of enemy.visual.children) {
        const material = part.material;
        if (!part.isMesh || !part.visible) continue;
        if (
          !this.enabled ||
          enemy.kind === 4 ||
          Array.isArray(material) ||
          material.transparent ||
          material.opacity < 1 ||
          part.isSkinnedMesh
        ) {
          this.cpuPose(part, enemy, !this.enabled);
          continue;
        }
        const posed = this.cpuParts.get(part);
        if (posed) {
          part.geometry = posed.original;
          posed.geometry.dispose();
          this.cpuParts.delete(part);
        }
        if (!this.visibility.has(part)) this.visibility.set(part, part.visible);
        if (!part.geometry.boundingSphere)
          part.geometry.computeBoundingSphere();
        this.sphere
          .copy(part.geometry.boundingSphere)
          .applyMatrix4(part.matrixWorld);
        if (part.geometry.attributes.vrJoint)
          this.sphere.radius += 1.4 * part.matrixWorld.getMaxScaleOnAxis();
        // Off-screen casters remain so their shadows still reach visible terrain.
        const visible = this.frustum.intersectsSphere(this.sphere);
        if (!visible && !part.castShadow) {
          part.visible = false;
          this.hidden.add(part);
          continue;
        }
        const batch = this.batchFor(part);
        // Debug fixtures can exceed the gameplay cap: render overflow individually.
        if (batch.count >= this.capacity) {
          this.cpuPose(part, enemy, true);
          continue;
        }
        if (batch.rigged) {
          const pose = enemy.motion?.pose || REST_POSE,
            at = batch.count * 4,
            a = batch.mesh.geometry.attributes.vrPose0.array,
            b = batch.mesh.geometry.attributes.vrPose1.array;
          for (let c = 0; c < 4; c++) {
            a[at + c] = pose[c];
            b[at + c] = pose[c + 4];
          }
        }
        batch.mesh.setMatrixAt(batch.count++, part.matrixWorld);
        part.visible = false;
        this.hidden.add(part);
      }
    }
    for (const batch of this.batches.values()) {
      const { mesh, count } = batch;
      if (!count) continue;
      mesh.count = count;
      mesh.visible = true;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, count * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (batch.rigged)
        for (const id of ["vrPose0", "vrPose1"]) {
          const attr = mesh.geometry.attributes[id];
          attr.clearUpdateRanges();
          attr.addUpdateRange(0, count * 4);
          attr.needsUpdate = true;
        }
      mesh.computeBoundingSphere();
    }
  }

  reset() {
    this.restore();
    this.clearCpu();
    for (const batch of this.batches.values()) {
      batch.mesh.count = 0;
      batch.mesh.visible = false;
    }
  }

  getDebugState() {
    return {
      enabled: this.enabled,
      batches: this.batches.size,
      activeBatches: [...this.batches.values()].filter((b) => b.mesh.visible)
        .length,
      instances: [...this.batches.values()].reduce(
        (n, b) => n + b.mesh.count,
        0,
      ),
    };
  }

  dispose() {
    this.reset();
    if (this.scene.onBeforeRender === this.hook)
      this.scene.onBeforeRender = this.previousHook;
    for (const { mesh, rigged } of this.batches.values()) {
      mesh.removeFromParent();
      mesh.dispose();
      if (rigged) mesh.geometry.dispose();
    }
    this.rigMaterials.forEach((m) => m.dispose());
    this.rigMaterials.clear();
    this.rigDepth.dispose();
    this.rigDistance.dispose();
    this.batches.clear();
    this.lod.dispose();
  }
}
