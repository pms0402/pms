import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { STRUCTURES, WORLD_COLLIDERS, WORLD_RADIUS, LANDMARK, terrainHeight, isWalkable } from './terrain.js';

/** Shared, sculpted scenery. Physics remains in terrain.js. */
export function buildWorldArt(game) {
  const { scene, mats, geo } = game, stone = mats.rock, dark = mats.rockDark, wood = mats.trunk;
  const geometries = new Map(), occluders = [];
  let seed = 7341;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const own = geometry => { game.ownedGeometries.add(geometry); return geometry; };
  const cached = (key, make) => { if (!geometries.has(key)) geometries.set(key, own(make())); return geometries.get(key); };
  const add = (geometry, material, x, y, z, parent = scene) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  const box = (material, x, y, z, w, h, d, parent = scene) => {
    const g = cached(`block:${w}:${h}:${d}`, () => {
      const shape = new THREE.Shape(); shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
      const bevel = Math.min(.045, w * .08, h * .08, d * .08);
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: d - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, steps: 1 });
      geometry.translate(0, 0, -d / 2 + bevel); return geometry;
    });
    return add(g, material, x, y, z, parent);
  };
  const arch = (radius, thickness, height, depth) => cached(`arch:${radius}:${thickness}:${height}:${depth}`, () => {
    const outer = radius + thickness, top = height + thickness;
    const shape = new THREE.Shape(); shape.moveTo(outer, 0); shape.quadraticCurveTo(outer * .92, top * .60, 0, top); shape.quadraticCurveTo(-outer * .92, top * .60, -outer, 0);
    shape.lineTo(-radius, 0); shape.quadraticCurveTo(-radius * .92, height * .60, 0, height); shape.quadraticCurveTo(radius * .92, height * .60, radius, 0); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 1, bevelSize: .025, bevelThickness: .025, steps: 1, curveSegments: 18 }); geometry.translate(0, 0, -depth / 2); return geometry;
  });
  const stoneUV = geometry => {
    const p = geometry.attributes.position, n = geometry.attributes.normal, uv = geometry.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      const nx = Math.abs(n.getX(i)), ny = Math.abs(n.getY(i)), nz = Math.abs(n.getZ(i));
      if (ny > nx && ny > nz) uv.setXY(i, p.getX(i) / 2.4, p.getZ(i) / 2.4);
      else if (nx > nz) uv.setXY(i, p.getZ(i) / 2.4, p.getY(i) / 2.4);
      else uv.setXY(i, p.getX(i) / 2.4, p.getY(i) / 2.4);
    }
    return geometry;
  };
  const merge = (group, fade = false) => {
    const buckets = new Map(); group.updateMatrixWorld(true);
    for (const child of [...group.children]) {
      child.updateMatrix(); const entries = buckets.get(child.material) || [];
      const geometry = child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone(); geometry.applyMatrix4(child.matrix);
      if (child.material === stone || child.material === dark) stoneUV(geometry);
      entries.push(geometry); buckets.set(child.material, entries); child.removeFromParent();
    }
    const pieces = [];
    for (const [material, entries] of buckets) {
      const geometry = mergeGeometries(entries, false); entries.forEach(g => g.dispose()); if (!geometry) continue;
      own(geometry); const m = fade ? material.clone() : material;
      if (fade) { m.transparent = true; mats[`ruin${occluders.length}:${pieces.length}`] = m; }
      const mesh = add(geometry, m, 0, 0, 0, group); mesh.userData.noStaticBatch = true; pieces.push(mesh);
    }
    return pieces;
  };
  const windowGlow = mats.ruinWindow = new THREE.MeshStandardMaterial({ color: '#403426', emissive: '#d79846', emissiveIntensity: 1.3, roughness: .75 });
  const recess = mats.windowRecess = new THREE.MeshStandardMaterial({ color: '#0f1921', roughness: 1 });
  const iron = mats.ruinIron = new THREE.MeshStandardMaterial({ color: '#242b32', roughness: .65, metalness: .72 });
  const cliff = cached('terrainEdgeSkirt', () => {
    const p = [], uv = [], indices = [], sectors = 128;
    for (let i = 0; i <= sectors; i++) { const a = i / sectors * Math.PI * 2, x = Math.cos(a) * 98, z = Math.sin(a) * 98, h = terrainHeight(x, z); p.push(x, h, z, Math.cos(a) * 100, -20, Math.sin(a) * 100); uv.push(i / sectors * 240, h / 2.4, i / sectors * 240, -20 / 2.4); }
    for (let i = 0; i < sectors; i++) { const a = i * 2; indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  });
  add(cliff, dark, 0, 0, 0).castShadow = false;
  const window = (parent, x, y, z, angle = 0) => {
    const opening = cached('window', () => {
      const shape = new THREE.Shape(); shape.moveTo(-.44, 0); shape.lineTo(.44, 0); shape.lineTo(.44, 1.2); shape.quadraticCurveTo(.35, 1.72, 0, 2.0); shape.quadraticCurveTo(-.35, 1.72, -.44, 1.2); shape.closePath(); return new THREE.ShapeGeometry(shape, 16);
    });
    const glass = add(opening, recess, x, y, z, parent); glass.rotation.y = angle;
    const frame = add(arch(.47, .13, .85, .09), stone, x, y + 1.19, z, parent); frame.rotation.y = angle;
    const dx = Math.cos(angle), dz = -Math.sin(angle), fx = Math.sin(angle), fz = Math.cos(angle);
    for (const side of [-1, 1]) box(stone, x + side * .50 * dx, y + .6, z + side * .50 * dz, .12, 1.2, .14, parent).rotation.y = angle;
    box(iron, x + fx * .035, y + .76, z + fz * .035, .045, 1.5, .04, parent).rotation.y = angle;
    box(iron, x + fx * .035, y + .65, z + fz * .035, .85, .045, .04, parent).rotation.y = angle;
    for (const side of [-1, 1]) box(windowGlow, x + dx * side * .21 + fx * .02, y + .66, z + dz * side * .21 + fz * .02, .28, .9, .025, parent).rotation.y = angle;
  };
  const pillar = (parent, x, z, height, radius = .38) => {
    const shaft = cached(`pillar:${radius}:${height}`, () => new THREE.CylinderGeometry(radius * .85, radius, height, 14));
    add(shaft, stone, x, height / 2, z, parent);
    box(dark, x, .18, z, radius * 2.5, .36, radius * 2.5, parent);
    box(stone, x, height - .1, z, radius * 2.2, .28, radius * 2.2, parent);
  };

  // Vaults, stone tracery and buttresses fit the existing walkable doors and walls.
  for (const s of STRUCTURES) {
    const group = new THREE.Group(); group.position.set(s.x, terrainHeight(s.x, s.z), s.z); scene.add(group);
    if (s.type === 'tower') {
      const tower = cached(`tower:${s.height}`, () => new THREE.CylinderGeometry(2.75, 2.82, s.height, 24)); add(tower, stone, 0, s.height / 2, 0, group);
      for (const y of [.35, s.height * .48, s.height - .25]) add(cached('towerBand', () => new THREE.TorusGeometry(2.79, .12, 5, 32)), dark, 0, y, 0, group).rotation.x = Math.PI / 2;
      for (let level = 1; level <= 3; level++) for (let side = 0; side < 4; side++) { const a = side * Math.PI / 2; window(group, Math.sin(a) * 2.82, level * s.height / 4 - .5, Math.cos(a) * 2.82, a); }
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; box(stone, Math.cos(a) * 2.59, s.height + .28, Math.sin(a) * 2.59, .62, .65 + (i % 4 === 0 ? -.16 : .16), .62, group).rotation.y = -a; }
    } else if (s.type === 'gate') {
      for (const side of [-1, 1]) { box(stone, side * (s.width / 2 - 1.1), s.height / 2, 0, 2.2, s.height, s.depth, group); pillar(group, side * (s.width / 2 - 1.1), s.depth / 2 - .42, s.height + .25, .40); }
      add(arch(s.width / 2 - 2.2, .55, 3.1, s.depth * .7), dark, 0, s.height - 3.5, 0, group);
    } else {
      for (const c of WORLD_COLLIDERS.filter(c => c.id === s.id)) box(stone, c.x - s.x, s.height / 2, c.z - s.z, c.hx * 2, s.height, c.hz * 2, group);
      add(arch(2, .34, 2.5, .85), dark, 0, 2.45, s.depth / 2, group);
      box(stone, 0, (s.height + 5.32) / 2, s.depth / 2, 4.0, Math.max(.3, s.height - 5.32), .8, group);
      for (const side of [-1, 1]) {
        pillar(group, side * 2.18, s.depth / 2, 2.5, .16);
        for (let i = 0; i < 3; i++) {
          const z = (i - 1) * s.depth * .28;
          box(dark, side * (s.width / 2 + .08), s.height * .42, z, .46, s.height * .84, .75, group);
          window(group, side * (s.width / 2 + .415), s.height * .48, z + .85, side * Math.PI / 2);
        }
      }
      if (s.type === 'chapel') {
        for (const z of [-s.depth * .28, s.depth * .20]) add(arch(s.width / 2 - .4, .23, 3.2, .34), dark, 0, s.height - 2.4, z, group);
        pillar(group, 0, -s.depth / 2, s.height + 2.0, .43);
        box(iron, 0, s.height + 2.85, -s.depth / 2, .16, 1.8, .18, group); box(iron, 0, s.height + 3.10, -s.depth / 2, .85, .14, .18, group);
        box(dark, 0, .55, -s.depth * .2, 2.2, 1.1, 1.2, group);
      } else {
        for (const side of [-1, 1]) box(wood, side * s.width * .22, s.height + .8, -s.depth * .20, .16, 2.1, s.depth * .62, group).rotation.z = side * .65;
      }
      for (let i = 0; i < 13; i++) box(dark, (random() - .5) * (s.width - 2), .08 + random() * .10, (random() - .5) * (s.depth - 2), .3 + random() * .6, .18, .3 + random() * .7, group).rotation.y = random() * 6.28;
    }
    occluders.push({ definition: s, pieces: merge(group, true), opacity: 1 });
  }

  // A visible landmark frames the first encounter instead of an empty green field.
  const landmark = new THREE.Group(); landmark.position.set(LANDMARK.x, terrainHeight(LANDMARK.x, LANDMARK.z), LANDMARK.z); scene.add(landmark);
  for (const side of [-1, 1]) { pillar(landmark, side * 3.15, 0, 3.7, .40); pillar(landmark, side * 3.15, -.35, 6.1, .18); }
  add(arch(2.8, .45, 3.2, .72), stone, 0, 3.7, 0, landmark);
  add(arch(2.83, .12, 3.25, .10), dark, 0, 3.7, .43, landmark);
  for (const side of [-1, 1]) { box(iron, side * 2.62, 1.7, .35, .07, 1.4, .07, landmark); add(cached('lantern', () => new THREE.SphereGeometry(.15, 10, 8)), windowGlow, side * 2.62, 2.5, .35, landmark); }
  merge(landmark);

  const rock = cached('weatheredRock', () => {
    const g = mergeVertices(new THREE.IcosahedronGeometry(1, 3)); const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), n = 1 + .11 * Math.sin(x * 5 + z * 3) * Math.cos(y * 6) + .07 * Math.sin(z * 11 - y * 4); p.setXYZ(i, x * n, y * n, z * n); }
    g.computeVertexNormals(); return stoneUV(g);
  });
  const grave = cached('roundedGrave', () => {
    const shape = new THREE.Shape(); shape.moveTo(-.32, 0); shape.lineTo(.32, 0); shape.lineTo(.32, .75); shape.absarc(0, .75, .32, 0, Math.PI, false); shape.lineTo(-.32, 0); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: .15, bevelEnabled: true, bevelSegments: 2, bevelSize: .035, bevelThickness: .025, steps: 1, curveSegments: 14 });
  });
  const deadTree = cached('twistedDeadTree', () => {
    const pieces = [];
    const branch = (points, radius) => pieces.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 9, radius, 5, false));
    branch([[0, 0, 0], [.09, 1.5, .05], [-.12, 3.0, .10], [.10, 4.0, .16]], .11);
    for (const side of [-1, 1]) { branch([[0, 1.8, .08], [side * .65, 2.5, 0], [side * 1.1, 3.3, -.10]], .06); branch([[side * .58, 2.45, 0], [side * 1.3, 2.7, .18], [side * 1.65, 2.9, .27]], .028); }
    const geometry = mergeGeometries(pieces.map(g => g.toNonIndexed()), false); pieces.forEach(g => g.dispose()); return geometry;
  });
  for (let i = 0; i < 350; i++) {
    const angle = random() * Math.PI * 2, radius = i < 100 ? 8 + random() * 22 : 18 + Math.sqrt(random()) * (WORLD_RADIUS - 20), x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    if (!isWalkable(x, z, 2)) continue; const h = terrainHeight(x, z);
    if (i < 130) { const mesh = add(rock, i % 3 ? stone : dark, x, h + .08, z); mesh.scale.set(.25 + random() * .8, .18 + random() * .45, .25 + random() * .7); mesh.rotation.y = random() * 6.28; }
    else if (i < 200) { const group = new THREE.Group(); group.position.set(x, h, z); group.rotation.set((random() - .5) * .13, random() * 6.28, (random() - .5) * .15); scene.add(group); add(grave, stone, 0, 0, 0, group); box(iron, 0, .66, .19, .28, .04, .03, group); }
    else if (i > 280) { const mesh = add(deadTree, wood, x, h, z); mesh.rotation.y = random() * 6.28; mesh.scale.setScalar(.65 + random() * .6); }
  }

  const paving = mats.ruinPaving = stone.clone(); paving.roughness = .65; paving.color.set('#bfc2c4');
  const ring = add(cached('startingPavement', () => { const g = new THREE.RingGeometry(3.3, 5.4, 72, 2); g.rotateX(-Math.PI / 2); return stoneUV(g); }), paving, 0, .028, 0); ring.castShadow = false;
  const grassMaterial = mats.ruinGrass = new THREE.MeshStandardMaterial({ color: '#58624e', roughness: 1, side: THREE.DoubleSide, vertexColors: true });
  const windTime = { value: 0 };
  grassMaterial.onBeforeCompile = shader => {
    shader.uniforms.uWindTime = windTime; shader.vertexShader = 'uniform float uWindTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvec3 grassOrigin=(instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;transformed.x+=sin(uWindTime*1.4+grassOrigin.x*.31+grassOrigin.z*.18)*position.y*position.y*.24;transformed.z+=cos(uWindTime*1.1+grassOrigin.z*.27)*position.y*position.y*.14;');
  };
  grassMaterial.customProgramCacheKey = () => 'sanctum-wind-v1';
  const grass = cached('grassTuft', () => {
    const positions = [], colors = [], uv = [], indices = [];
    for (let blade = 0; blade < 5; blade++) {
      const a = blade * 2.399, h = .27 + blade % 3 * .11, dx = Math.cos(a), dz = Math.sin(a), base = positions.length / 3;
      for (let j = 0; j < 4; j++) for (const side of [-1, 1]) { const t = j / 3, width = .025 * (1 - t) + .002; positions.push(dx * t * t * .15 + dz * side * width, t * h, dz * t * t * .15 - dx * side * width); const c = .65 + t * .30; colors.push(c, c * 1.05, c * .86); uv.push(side > 0 ? 1 : 0, t); }
      for (let j = 0; j < 3; j++) { const p = base + j * 2; indices.push(p, p + 1, p + 2, p + 1, p + 3, p + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals(); return g;
  });
  const clumps = new THREE.InstancedMesh(grass, grassMaterial, 1800), dummy = new THREE.Object3D(); let count = 0;
  for (let i = 0; i < 2700 && count < 1800; i++) {
    const a = random() * Math.PI * 2, r = 6 + Math.sqrt(random()) * (i < 1900 ? 32 : 83), x = Math.cos(a) * r, z = Math.sin(a) * r;
    const road = Math.min(Math.abs(z - Math.sin(x * .035) * 5), Math.abs(x - Math.sin(z * .03) * 5));
    if (road < 2.5 || !isWalkable(x, z, 1)) continue;
    dummy.position.set(x, terrainHeight(x, z), z); dummy.rotation.y = random() * 6.28; dummy.scale.setScalar(.7 + random() * 1.1); dummy.updateMatrix(); clumps.setMatrixAt(count++, dummy.matrix);
  }
  clumps.count = count; clumps.receiveShadow = true; clumps.computeBoundingSphere(); scene.add(clumps);
  const cloudPixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const u = (x + .5) / 64 - 1, v = (y + .5) / 64 - 1, falloff = Math.max(0, 1 - Math.hypot(u, v));
    const cloud = .55 + .22 * Math.sin(x * .09 + Math.sin(y * .07) * 2) + .17 * Math.cos(y * .11 - x * .05);
    cloudPixels.set([255, 255, 255, Math.round(255 * falloff * falloff * Math.max(0, cloud))], (y * 128 + x) * 4);
  }
  const mistMap = new THREE.DataTexture(cloudPixels, 128, 128, THREE.RGBAFormat); mistMap.needsUpdate = true; mistMap.magFilter = mistMap.minFilter = THREE.LinearFilter;
  const mistMaterial = mats.groundMist = new THREE.MeshBasicMaterial({ color: '#b0c2cc', map: mistMap, opacity: .15, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const mistGeometry = cached('mistPlane', () => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); return g; });
  const mist = new THREE.InstancedMesh(mistGeometry, mistMaterial, 16), clouds = [];
  mist.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mist.frustumCulled = false; mist.renderOrder = 1; scene.add(mist);
  for (let i = 0; i < 16; i++) { const a = random() * Math.PI * 2, r = 10 + random() * 65; clouds.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, phase: random() * 6.28, size: 16 + random() * 14 }); }
  let artTime = 0;
  const update = dt => {
    artTime += dt; windTime.value = artTime;
    for (let i = 0; i < clouds.length; i++) { const c = clouds[i], x = c.x + Math.sin(artTime * .035 + c.phase) * 2, z = c.z + Math.cos(artTime * .028 + c.phase) * 1.5; dummy.position.set(x, terrainHeight(x, z) + .35, z); dummy.rotation.set(0, c.phase, 0); dummy.scale.set(c.size, 1, c.size * .58); dummy.updateMatrix(); mist.setMatrixAt(i, dummy.matrix); }
    mist.instanceMatrix.needsUpdate = true;
  };
  update(0);
  return { occluders, landmark, grass: clumps, mist, update, detailCount: count, setQuality(value) { clumps.count = value === 'low' ? Math.floor(count * .38) : value==='medium'?Math.floor(count*.67):count; mist.visible = value !== 'low';mist.count=value==='medium'?10:16; }, dispose() { mistMap.dispose(); } };
}
