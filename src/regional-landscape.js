import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createRuneGeometry } from "./rune-geometry.js";

/** One reusable batch per regional structure type; details do not change navigation. */
export class RegionalLandscape {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    this.root.name = "Region architecture and vegetation";
    this.root.userData.noStaticBatch = true;
    game.scene.add(this.root);
    this.geometries = [];
    this.materials = [];
    this.batches = [];
    this.dummy = new THREE.Object3D();
    this.time = 0;
    this.detail = 1;
    const material = (color, roughness = 0.9, extra = {}) => {
      const m = new THREE.MeshStandardMaterial({ color, roughness, ...extra });
      this.materials.push(m);
      return m;
    };
    const stone = material("#25262b", 0.9, {
        map: game.presentation.stoneMap,
        normalMap: game.presentation.stoneNormal,
        roughnessMap: game.presentation.stoneRoughness,
      }),
      ice = material("#b0d2de", 0.22, {
        metalness: 0.12,
        envMapIntensity: 1.3,
      }),
      bark = material("#292e2a", 1),
      toxin = material("#789a53", 0.68, {
        emissive: "#446529",
        emissiveIntensity: 0.45,
      }),
      ancient = material("#929182", 0.83, {
        map: game.presentation.stoneMap,
        normalMap: game.presentation.stoneNormal,
      }),
      voidStone = material("#3f354d", 0.6, { metalness: 0.2 }),
      rune = material("#ab92bc", 0.55, {
        emissive: "#8669ad",
        emissiveIntensity: 0.75,
      }),
      lava = material("#b64522", 0.6, {
        emissive: "#ed6126",
        emissiveIntensity: 0.9,
      });
    const merge = (parts) => {
      const normalized = parts.map((p) => {
          const g = p.index ? p.toNonIndexed() : p.clone();
          g.deleteAttribute("color");
          return g;
        }),
        g = mergeGeometries(normalized, false);
      normalized.forEach((p) => p.dispose());
      parts.forEach((p) => p.dispose());
      this.geometries.push(g);
      return g;
    };
    const column = (r, h, x = 0, z = 0) =>
      new THREE.CylinderGeometry(r * 0.7, r, h, 7).translate(x, h / 2, z);
    const basalt = merge([
      column(0.55, 3.1),
      column(0.35, 1.9, 0.7, 0.1),
      column(0.29, 1.4, -0.6, -0.1),
    ]);
    const crystals = merge([
      new THREE.ConeGeometry(0.45, 3, 5).translate(0, 1.5, 0),
      new THREE.ConeGeometry(0.26, 1.8, 5)
        .rotateZ(-0.4)
        .translate(0.6, 0.7, 0.1),
      new THREE.ConeGeometry(0.22, 1.5, 5)
        .rotateZ(0.3)
        .translate(-0.5, 0.6, -0.1),
    ]);
    const treeParts = [];
    const branch = (points, r) =>
      treeParts.push(
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            points.map((p) => new THREE.Vector3(...p)),
          ),
          7,
          r,
          5,
          false,
        ),
      );
    branch(
      [
        [0, 0, 0],
        [-0.2, 2, 0.1],
        [0.5, 4, 0.2],
        [0.2, 6.1, -0.2],
      ],
      0.22,
    );
    for (const side of [-1, 1]) {
      branch(
        [
          [0, 2, 0.1],
          [side * 1.2, 3.5, 0.2],
          [side * 2, 4.7, -0.4],
        ],
        0.13,
      );
      branch(
        [
          [side * 0.8, 3.2, 0.15],
          [side * 1.6, 3.7, 1],
          [side * 2.3, 3.9, 1.2],
        ],
        0.065,
      );
      branch(
        [
          [side * 1.3, 3.8, 0],
          [side * 1.2, 5.1, -0.3],
          [side * 0.8, 5.7, -0.4],
        ],
        0.055,
      );
    }
    const tree = merge(treeParts);
    const fungus = merge([
      column(0.12, 0.9),
      new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.56)
        .scale(0.75, 0.28, 0.68)
        .translate(0, 0.85, 0),
      column(0.08, 0.55, 0.62, 0.13),
      new THREE.SphereGeometry(1, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.56)
        .scale(0.48, 0.18, 0.44)
        .translate(0.62, 0.52, 0.13),
    ]);
    const ruin = merge([
      column(0.5, 3.2),
      new THREE.BoxGeometry(1.8, 0.4, 1.8).translate(0, 0.2, 0),
      new THREE.BoxGeometry(1.4, 0.5, 1.4).rotateZ(0.1).translate(0, 3.2, 0),
      new THREE.SphereGeometry(0.7, 12, 8)
        .scale(0.7, 1, 0.65)
        .translate(0, 4.05, 0),
      new THREE.BoxGeometry(0.9, 0.16, 0.5).translate(0, 4.12, 0.35),
    ]);
    const brokenArch = merge([
      new THREE.TorusGeometry(1.8, 0.26, 5, 18, Math.PI * 1.1).rotateZ(-0.1),
      column(0.28, 2.4, -1.6),
      column(0.28, 1.6, 1.6),
      new THREE.BoxGeometry(1.2, 0.4, 0.8)
        .rotateZ(0.4)
        .translate(0.6, 1.1, 0.1),
    ]);
    const vent = merge([
      new THREE.TorusGeometry(0.8, 0.17, 5, 16)
        .rotateX(-Math.PI / 2)
        .translate(0, 0.1, 0),
      new THREE.CircleGeometry(0.66, 16)
        .rotateX(-Math.PI / 2)
        .translate(0, 0.08, 0),
    ]);
    const sigil = createRuneGeometry(true);
    sigil.rotateX(-Math.PI / 2);
    this.geometries.push(sigil);
    this.add("volcano", basalt, stone, 30, 0);
    this.add("volcano", vent, lava, 22, 0);
    this.add("tundra", crystals, ice, 36, 0);
    this.add("forest", tree, bark, 28, 0);
    this.add("forest", fungus, toxin, 48, 0);
    this.add("ruins", ruin, ancient, 20, 0);
    this.add("ruins", sigil, rune, 24, 0.08);
    this.add("void", brokenArch, voidStone, 24, 5.1, true);
    this.add("void", sigil, rune, 28, 0.08);
    this.setRegion("sanctum");
  }
  add(region, geometry, material, count, offset = 0, floating = false) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.userData.noStaticBatch = true;
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.root.add(mesh);
    const entries = [];
    let seed = region.length * 9187 + count;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < count * 2 && entries.length < count; i++) {
      const a = random() * Math.PI * 2,
        r = 10 + Math.sqrt(random()) * 65,
        x = Math.sin(a) * r,
        z = Math.cos(a) * r;
      if (
        !this.game.world.isWalkable(x, z, 2.2) ||
        Math.abs(x) < 3 ||
        Math.abs(z) < 3
      )
        continue;
      entries.push({
        x,
        z,
        y: this.game.groundHeight(x, z) + offset,
        angle: random() * Math.PI * 2,
        scale: 0.7 + random() * 0.65,
        phase: random() * Math.PI * 2,
      });
    }
    this.batches.push({ region, mesh, entries, floating });
  }
  setRegion(id) {
    this.region = id;
    for (const b of this.batches) {
      b.mesh.visible = b.region === id;
      b.mesh.count =
        b.region === id ? Math.ceil(b.entries.length * this.detail) : 0;
    }
    this.update(0);
  }
  setQuality(detail) {
    this.detail = detail;
    this.setRegion(this.region);
  }
  update(dt) {
    this.time += dt;
    this.root.visible = !this.game.camp?.active && !this.game.sideAreas?.active;
    for (const b of this.batches) {
      if (b.region !== this.region || (!b.floating && dt !== 0)) continue;
      for (let i = 0; i < b.mesh.count; i++) {
        const p = b.entries[i];
        this.dummy.position.set(
          p.x,
          p.y + (b.floating ? Math.sin(this.time * 0.5 + p.phase) * 0.25 : 0),
          p.z,
        );
        this.dummy.rotation.set(
          0,
          p.angle +
            (b.floating ? Math.sin(this.time * 0.12 + p.phase) * 0.08 : 0),
          0,
        );
        this.dummy.scale.setScalar(p.scale);
        this.dummy.updateMatrix();
        b.mesh.setMatrixAt(i, this.dummy.matrix);
      }
      if (b.floating || dt === 0) {
        b.mesh.instanceMatrix.needsUpdate = true;
        b.mesh.computeBoundingSphere();
      }
    }
  }
  dispose() {
    this.root.removeFromParent();
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.batches.forEach((b) => b.mesh.dispose());
  }
}
