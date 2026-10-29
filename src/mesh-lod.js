import * as THREE from "three";
/** Cluster only within a joint/pivot and UV seam. The authored near mesh is never edited. */
export function clusterGeometry(source, cell) {
  const attrs = source.attributes,
    p = attrs.position,
    indices =
      source.index?.array || Uint32Array.from({ length: p.count }, (_, i) => i),
    map = new Map(),
    remap = new Uint32Array(p.count),
    vertices = [];
  for (let i = 0; i < p.count; i++) {
    const joint = attrs.vrJoint?.getX(i) || 0,
      kind = attrs.vrKind?.getX(i) || 0,
      pivot = attrs.vrPivot;
    const key = [
      joint,
      kind,
      pivot?.getX(i) || 0,
      pivot?.getY(i) || 0,
      pivot?.getZ(i) || 0,
      Math.round(p.getX(i) / cell),
      Math.round(p.getY(i) / cell),
      Math.round(p.getZ(i) / cell),
      Math.floor((attrs.uv?.getX(i) || 0) * 2),
      Math.floor((attrs.uv?.getY(i) || 0) * 2),
    ].join(":");
    let at = map.get(key);
    if (at === undefined) {
      at = vertices.length;
      map.set(key, at);
      vertices.push({
        n: 0,
        attrs: Object.fromEntries(
          Object.entries(attrs).map(([name, a]) => [
            name,
            new Float64Array(a.itemSize),
          ]),
        ),
      });
    }
    const v = vertices[at];
    v.n++;
    remap[i] = at;
    for (const [name, a] of Object.entries(attrs))
      for (let k = 0; k < a.itemSize; k++)
        v.attrs[name][k] += a.array[i * a.itemSize + k];
  }
  const triangles = [];
  for (let i = 0; i < indices.length; i += 3) {
    const a = remap[indices[i]],
      b = remap[indices[i + 1]],
      c = remap[indices[i + 2]];
    if (a !== b && b !== c && a !== c) triangles.push(a, b, c);
  }
  const result = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(attrs)) {
    const values = new a.array.constructor(vertices.length * a.itemSize);
    vertices.forEach((v, i) => {
      for (let k = 0; k < a.itemSize; k++)
        values[i * a.itemSize + k] = v.attrs[name][k] / v.n;
      if (name === "normal") {
        const at = i * 3,
          length = Math.hypot(values[at], values[at + 1], values[at + 2]) || 1;
        for (let k = 0; k < 3; k++) values[at + k] /= length;
      }
    });
    result.setAttribute(
      name,
      new THREE.BufferAttribute(values, a.itemSize, a.normalized),
    );
  }
  result.setIndex(triangles);
  result.computeBoundingSphere();
  result.computeBoundingBox();
  return result;
}
/** One selected level per shared body part keeps instancing and the GPU cache bounded. */
export class MonsterLod {
  constructor() {
    this.cache = new Map();
    this.levels = new Map();
    this.selected = new Map();
    this.maximum = new Map();
    this.quality = "high";
  }
  prepare(enemies, camera, viewportHeight, cpuParts) {
    this.maximum.clear();
    this.selected.clear();
    const projection =
      viewportHeight * 0.5 * camera.projectionMatrix.elements[5];
    for (const enemy of enemies) {
      if (
        enemy.kind === 4 ||
        enemy.hp <= 0 ||
        !enemy.group.visible ||
        !enemy.visual.visible
      )
        continue;
      let radius = 0;
      // Select by the creature silhouette, not each tiny eye/tooth separately.
      for (const part of enemy.visual.children) {
        const source = cpuParts.get(part)?.original || part.geometry;
        if (!part.isMesh || !source) continue;
        if (!source.boundingSphere) source.computeBoundingSphere();
        radius = Math.max(
          radius,
          source.boundingSphere.radius * part.matrixWorld.getMaxScaleOnAxis(),
        );
      }
      const pixels =
        (radius * 2 * projection) /
        Math.max(1, enemy.group.position.distanceTo(camera.position));
      for (const part of enemy.visual.children) {
        const original = cpuParts.get(part)?.original || part.geometry;
        if (
          !part.isMesh ||
          !original?.attributes.vrJoint ||
          Array.isArray(part.material) ||
          part.material.transparent
        )
          continue;
        if (!original.boundingSphere) original.computeBoundingSphere();
        this.maximum.set(
          original,
          Math.max(pixels, this.maximum.get(original) || 0),
        );
      }
    }
    const full =
        this.quality === "low" ? 140 : this.quality === "medium" ? 105 : 80,
      far = this.quality === "low" ? 48 : this.quality === "medium" ? 38 : 30;
    for (const [source, pixels] of this.maximum) {
      const old = this.levels.get(source),
        tolerance = old === undefined ? 0 : 0.15;
      let level = pixels > full ? 0 : pixels > far ? 1 : 2;
      if (old === 0 && pixels > full * (1 - tolerance)) level = 0;
      if (
        old === 1 &&
        pixels < full * (1 + tolerance) &&
        pixels > far * (1 - tolerance)
      )
        level = 1;
      if (old === 2 && pixels < far * (1 + tolerance)) level = 2;
      this.levels.set(source, level);
      let variants = this.cache.get(source);
      if (!variants) {
        variants = [source];
        this.cache.set(source, variants);
      }
      if (!variants[level])
        variants[level] = clusterGeometry(
          source,
          Math.min(
            level === 1 ? 0.085 : 0.17,
            source.boundingSphere.radius * 0.16,
          ),
        );
      this.selected.set(source, variants[level]);
    }
  }
  geometry(source) {
    return this.selected.get(source) || source;
  }
  dispose() {
    for (const variants of this.cache.values())
      for (let i = 1; i < variants.length; i++) variants[i]?.dispose();
    this.cache.clear();
    this.selected.clear();
    this.maximum.clear();
    this.levels.clear();
  }
}
