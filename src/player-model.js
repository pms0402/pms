import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import headData from './assets/knight-head.json' with { type: 'json' };

/** A jointed, adult-proportioned silver-haired knight. All assets are local geometry. */
export function createPlayerModel(game) {
  const own = geometry => { game.ownedGeometries.add(geometry); return geometry; };
  const metal = (color, roughness = .34, metalness = .8) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const armor = metal('#4b5363', .34, .68), edge = metal('#a0a9b7', .26), steel = metal('#bfcbdc', .23, .95);
  const inset = metal('#2b2f3b', .49, .4), leather = metal('#24232c', .69, .08);
  const cloth = metal('#171821', .91, .03); cloth.side = THREE.DoubleSide; cloth.map = game.presentation.clothMap;
  const lining = metal('#302336', .84, .02); lining.side = THREE.DoubleSide; lining.map = game.presentation.clothMap;
  const silverHair = metal('#d6dbe5', .68, 0), hairShade = metal('#a3a9b8', .72, 0);
  const hairPixels = new Uint8Array(128 * 256 * 4);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 128; x++) {
    const u = x / 127, strand = .5 + .5 * Math.sin((x + Math.sin(y * .034) * 1.8) * 2.7);
    const value = Math.round(184 + strand * 66), alpha = Math.min(1, Math.min(u, 1 - u) * 15) * (.76 + strand * .24);
    hairPixels.set([value, value, value, Math.round(alpha * 255)], (y * 128 + x) * 4);
  }
  const hairMap = new THREE.DataTexture(hairPixels, 128, 256, THREE.RGBAFormat); hairMap.colorSpace = THREE.SRGBColorSpace;
  hairMap.generateMipmaps = true; hairMap.minFilter = THREE.LinearMipmapLinearFilter; hairMap.magFilter = THREE.LinearFilter; hairMap.needsUpdate = true;
  game.heroTextures = [hairMap];
  for (const material of [silverHair, hairShade]) { material.map = hairMap; material.alphaTest = .28; material.alphaToCoverage = true; material.side = THREE.DoubleSide; }
  const skin = metal('#d5c5c2', .71, 0), faceShadow = metal('#5b4652', .83, 0);
  const glow = new THREE.MeshStandardMaterial({ color: '#b093ec', emissive: '#9851e9', emissiveIntensity: .8, roughness: .3, metalness: .3 });
  for (const m of [armor, edge, steel, inset]) m.envMapIntensity = 2;
  game.heroMaterials = { armor, edge, steel, inset, leather, cloth, lining, silverHair, hairShade, skin, glow };
  game.player = new THREE.Group(); game.player.scale.setScalar(1.55); game.scene.add(game.player);
  const root = game.playerVisual = new THREE.Group(); root.name = 'Silver-haired dusk knight'; game.player.add(root);
  game.hairLocks = []; game.clothParts = [];
  const mesh = (geometry, material, parent = root, x = 0, y = 0, z = 0, keep = false) => {
    const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true;
    m.userData.keep = keep; parent.add(m); return m;
  };
  const ellipsoid = (material, parent, x, y, z, rx, ry, rz, keep = false) => {
    const geometry = rx < .025 && ry < .04 ? (game.geo.roundSmall || game.geo.heroRound) : game.geo.heroRound;
    const m = mesh(geometry, material, parent, x, y, z, keep); m.scale.set(rx, ry, rz); return m;
  };
  const tube = (material, parent, points, radius = .007) => mesh(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), Math.max(8, points.length * 3), radius, 5, false)), material, parent);
  const plate = (material, parent, outline, z, depth = .025, bevel = .012) => {
    const shape = new THREE.Shape(); outline.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
    return mesh(own(new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 2, bevelSize: bevel, bevelThickness: bevel, curveSegments: 5 })), material, parent, 0, 0, z);
  };
  const loft = (material, parent, sections, segments = 18) => {
    const positions = [], uv = [], indices = [];
    for (let row = 0; row < sections.length; row++) {
      const [y, rx, rz, z = 0] = sections[row];
      for (let i = 0; i <= segments; i++) { const a = i / segments * Math.PI * 2; positions.push(Math.sin(a) * rx, y, Math.cos(a) * rz + z); uv.push(i / segments, row / (sections.length - 1)); }
    }
    for (let r = 0; r < sections.length - 1; r++) for (let i = 0; i < segments; i++) { const a = r * (segments + 1) + i, b = a + segments + 1; if (sections[r + 1][0] > sections[r][0]) indices.push(a, a + 1, b, a + 1, b + 1, b); else indices.push(a, b, a + 1, a + 1, b, b + 1); }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return mesh(own(geometry), material, parent);
  };
  const joint = (parent, name, x, y, z = 0) => { const group = new THREE.Group(); group.name = name; group.position.set(x, y, z); parent.add(group); return group; };
  const shell = (material, parent, sections, arc = Math.PI * 1.12) => {
    const positions = [], uvs = [], indices = [], steps = 24;
    for (let j = 0; j < sections.length; j++) {
      const [y, rx, rz] = sections[j];
      for (let i = 0; i <= steps; i++) { const angle = (i / steps - .5) * arc; positions.push(Math.sin(angle) * rx, y, Math.cos(angle) * rz); uvs.push(i / steps, j / (sections.length - 1)); }
    }
    for (let j = 0; j < sections.length - 1; j++) for (let i = 0; i < steps; i++) { const a = j * (steps + 1) + i, b = a + steps + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return mesh(geometry, material, parent);
  };

  // Tailored silhouette: narrow waist, longer legs and fitted overlapping breastplate.
  game.playerBody = loft(armor, root, [[1.06, .17, .115], [1.18, .185, .13], [1.37, .215, .145], [1.61, .28, .145], [1.76, .26, .125], [1.85, .14, .095]]);
  game.playerBody.userData.keep = true;
  shell(armor, root, [[1.36, .205, .15], [1.43, .235, .174], [1.57, .283, .187], [1.70, .272, .167], [1.76, .238, .145], [1.80, .16, .115]]);
  for (const side of [-1, 1]) {
    tube(edge, root, [[side * .17, 1.76, .12], [side * .13, 1.71, .15], [side * .06, 1.68, .172], [0, 1.65, .178]], .004);
    tube(edge, root, [[side * .14, 1.69, .153], [side * .09, 1.67, .167], [side * .065, 1.60, .185]], .0025);
  }
  for (let i = 0; i < 3; i++) shell(armor, root, [[1.105 + i * .09, .186 + i * .013, .148 + i * .008], [1.145 + i * .09, .194 + i * .014, .156 + i * .008], [1.175 + i * .09, .193 + i * .015, .145 + i * .009]]);
  plate(edge, root, [[0, 1.79], [-.035, 1.71], [0, 1.61], [.035, 1.71]], .18, .012, .005);
  plate(glow, root, [[0, 1.735], [-.012, 1.706], [0, 1.674], [.012, 1.706]], .201, .007, .002);
  loft(leather, root, [[1.01, .18, .127], [1.075, .18, .127]]);
  plate(edge, root, [[-.042, 1.07], [-.042, 1.015], [.042, 1.015], [.042, 1.07]], .13, .018, .005);
  plate(inset, root, [[-.027, 1.058], [-.027, 1.027], [.027, 1.027], [.027, 1.058]], .155, .004, .003);
  tube(leather, root, [[-.22, 1.79, .14], [-.14, 1.58, .19], [.02, 1.33, .18], [.17, 1.10, .15]], .018);
  for (let i = 0; i < 7; i++) ellipsoid(edge, root, .18 + i * .024, 1.02 - Math.sin(i / 6 * Math.PI) * .105, .13, .014, .018, .009);

  // Raised coat collar frames the face without hiding the pale hair.
  game.playerHood = loft(cloth, root, [[1.78, .23, .15, -.01], [1.90, .205, .13, -.015], [1.98, .17, .095, -.035]]);
  game.playerHood.userData.keep = true;
  for (const side of [-1, 1]) {
    plate(cloth, root, [[side * .11, 1.79], [side * .23, 1.96], [side * .32, 1.82], [side * .22, 1.55]], .11, .018, .009);
    tube(edge, root, [[side * .11, 1.79, .144], [side * .23, 1.96, .144], [side * .31, 1.82, .144]], .005);
  }

  // Coat panels are real curved surfaces, weighted at the hem for cloth animation.
  const coat = (name, material, rows, columns = 12, rowCount = 22) => {
    const positions = [], uv = [], indices = [], weights = [];
    const anchor = [rows[0][0], rows[0][1], rows[0][3]];
    for (let j = 0; j <= rowCount; j++) {
      const t = j / rowCount, span = t * (rows.length - 1), a = Math.min(rows.length - 2, Math.floor(span)), f = span - a;
      const at = k => THREE.MathUtils.lerp(rows[a][k], rows[a + 1][k], f);
      for (let i = 0; i <= columns; i++) {
        const u = i / columns, x = at(0) + (u - .5) * at(2), y = at(1) - (j === rowCount ? (.5 + .5 * Math.cos(u * Math.PI * 6)) * .055 : 0);
        positions.push(x - anchor[0], y - anchor[1], at(3) - anchor[2] - .035 * Math.cos(u * Math.PI * 8) * t - .035 * Math.sin(u * Math.PI)); uv.push(u, 1 - t); weights.push(t * t);
      }
    }
    for (let j = 0; j < rowCount; j++) for (let i = 0; i < columns; i++) { const a = j * (columns + 1) + i, b = a + columns + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const m = mesh(geometry, material, root, ...anchor, true); m.name = name;
    game.clothParts.push({ mesh: m, base: new Float32Array(positions), weights: new Float32Array(weights), phase: game.clothParts.length * 1.7 }); return m;
  };
  game.cape = coat('Split black mantle', cloth, [[0, 1.88, .66, -.17], [0, 1.55, .62, -.22], [0, 1.12, .46, -.23], [0, .67, .72, -.31], [0, .24, 1.03, -.42]]);
  game.capeBase = game.clothParts[0].base;
  for (const side of [-1, 1]) {
    coat('Front coat tail', cloth, [[side * .16, 1.08, .17, .16], [side * .22, .83, .23, .20], [side * .29, .53, .25, .23], [side * .37, .20, .23, .26]], 6, 16);
    coat('Violet coat lining', lining, [[side * .30, 1.07, .12, -.02], [side * .40, .65, .16, -.04], [side * .48, .29, .18, -.03]], 4, 14);
  }

  // CC0 anatomical topology, subdivided and reduced offline; no runtime model fetch.
  loft(skin, root, [[1.89, .049, .045], [2.00, .052, .05]]);
  const headGeometry = own(new THREE.BufferGeometry());
  headGeometry.setAttribute('position', new THREE.Float32BufferAttribute(headData.positions, 3));
  headGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(headData.normals, 3));
  headGeometry.setAttribute('color', new THREE.Float32BufferAttribute(headData.colors, 3));
  headGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(headData.positions.length / 3 * 2), 2));
  headGeometry.setIndex(headData.indices);
  const faceMaterial = skin.clone(); faceMaterial.vertexColors = true; game.heroMaterials.face = faceMaterial;
  game.playerHead = mesh(headGeometry, faceMaterial, root, 0, 2.105, 0, true); game.playerHead.name = 'Anatomical sculpted face';
  const eyeWhite = metal('#b6b4b3', .43, 0), iris = metal('#746286', .4, 0);
  for (const side of [-1, 1]) {
    ellipsoid(eyeWhite, root, side * .0403, 2.1095, .0852, .0214, .0214, .0214);
    ellipsoid(iris, root, side * .0403, 2.1095, .1057, .008, .0086, .002);
    ellipsoid(faceShadow, root, side * .0403, 2.1095, .1075, .0034, .0053, .001);
    tube(hairShade, root, [[side * .018, 2.141, .094], [side * .038, 2.148, .096], [side * .063, 2.143, .087]], .0027);
  }

  // Individually shaped, tapered locks are baked together per material and hinge.
  const lock = (parent, material, points, width) => {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), positions = [], uv = [], indices = [], steps = 18, sides = 6;
    const tangent = new THREE.Vector3(), across = new THREE.Vector3(), normal = new THREE.Vector3();
    for (let j = 0; j <= steps; j++) {
      const t = j / steps, p = curve.getPoint(t); tangent.copy(curve.getTangent(t)); across.set(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize(); normal.crossVectors(tangent, across).normalize();
      const taper = Math.max(.015, Math.sin(Math.PI * (.19 + t * .81)) ** .65);
      for (let i = 0; i <= sides; i++) {
        const u = i / sides, v = p.clone().addScaledVector(across, (u * 2 - 1) * width * taper).addScaledVector(normal, (1 - (u * 2 - 1) ** 2) * width * .18);
        positions.push(v.x, v.y, v.z); uv.push(u, 1 - t);
      }
    }
    for (let j = 0; j < steps; j++) for (let i = 0; i < sides; i++) { const a = j * (sides + 1) + i, b = a + sides + 1; indices.push(a, a + 1, b, a + 1, b + 1, b); }
    const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); mesh(geometry, material, parent);
  };
  const hairBase = metal('#b9c0cf', .73, 0); hairBase.map = hairMap;
  const crown = mesh(own(new THREE.SphereGeometry(1, 28, 20, 0, Math.PI * 2, 0, Math.PI * .52)), hairBase, root, 0, 2.15, -.018); crown.scale.set(.12, .142, .111);
  for (let i = 0; i < 11; i++) {
    const x = (i - 5) * .018, side = i < 5 ? -1 : 1;
    const endY = Math.abs(x) < .05 ? 2.17 - (x + .05) * .45 : 2.09 - Math.abs(x) * .65;
    lock(root, i % 4 === 0 ? hairShade : silverHair, [[x * .45, 2.285 - Math.abs(x) * .2, -.04], [x + .01, 2.235, .07], [x + side * .026 + .01, endY + .035, .115], [x + side * .032 + .012, endY, .105]], .014 + Math.abs(x) * .075);
  }
  for (const side of [-1, 0, 1]) {
    const hair = joint(root, 'Flowing silver locks', side * .08, 2.20, -.045); game.hairLocks.push(hair);
    for (let i = 0; i < 7; i++) {
      const s = side || (i % 2 ? -1 : 1), spread = i / 6;
      lock(hair, i % 3 === 0 ? hairShade : silverHair, [[s * .015, .04, -.04], [s * (.06 + spread * .035), -.17, -.08 - spread * .035], [s * (.16 + spread * .09), -.40, -.15], [s * (.13 + spread * .13), -.72, -.09 + spread * .02], [s * (.32 + spread * .09), -.99 - spread * .13, -.12 + spread * .05]], .032 + spread * .014);
    }
  }

  // Narrow, articulated limbs; layered pointed pauldrons replace spherical pads.
  for (const side of [-1, 1]) {
    const hip = joint(root, side < 0 ? 'Left hip' : 'Right hip', side * .122, 1.045);
    loft(leather, hip, [[0, .095, .092], [-.12, .10, .095], [-.35, .070, .068], [-.47, .063, .064]]);
    plate(armor, hip, [[-.065, -.10], [.065, -.10], [.06, -.29], [0, -.40], [-.055, -.29]], .071, .015, .009);
    const knee = joint(hip, 'Knee', 0, -.47);
    loft(leather, knee, [[0, .062, .064], [-.16, .073, .069], [-.37, .05, .054], [-.53, .045, .05]]);
    plate(armor, knee, [[0, .055], [-.074, -.035], [-.057, -.15], [0, -.20], [.057, -.15], [.074, -.035]], .052, .025, .009);
    plate(armor, knee, [[0, -.135], [-.057, -.20], [-.043, -.37], [0, -.45], [.043, -.37], [.057, -.20]], .055, .017, .008);
    tube(edge, knee, [[0, -.16, .087], [0, -.29, .094], [0, -.43, .08]], .005);
    const foot = joint(knee, 'Pointed boot', 0, -.55, .025);
    loft(leather, foot, [[.005, .055, .15, .065], [.025, .06, .155, .065], [.065, .05, .125, .045], [.10, .041, .065, 0], [.12, .038, .05, 0]]);
    tube(edge, foot, [[-.049, .036, .09], [0, .055, .19], [.049, .036, .09]], .004);
    game[side < 0 ? 'legLeft' : 'legRight'] = hip; game[side < 0 ? 'kneeLeft' : 'kneeRight'] = knee; game[side < 0 ? 'footLeft' : 'footRight'] = foot;

    const shoulder = joint(root, side < 0 ? 'Left shoulder' : 'Right shoulder', side * .315, 1.81, -.002);
    loft(leather, shoulder, [[.005, .08, .085], [-.13, .078, .08], [-.31, .057, .061]]);
    for (let layer = 0; layer < (side < 0 ? 3 : 2); layer++) {
      const width = (side < 0 ? .225 : .185) - layer * .026, y = .018 - layer * .06;
      const positions = [], uvs = [], indices = [], columns = 14, rows = 10;
      for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
        const t = j / rows, u = i / columns * 2 - 1;
        positions.push(side * (-.055 + t * width), y + Math.sin(t * Math.PI) * .065 + (1 - u * u) * .057 + t ** 5 * (side < 0 ? .09 : .045), u * (.115 - t * .025));
        uvs.push(i / columns, t);
      }
      for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) { const a = j * (columns + 1) + i, b = a + columns + 1; if (side < 0) indices.push(a, b, a + 1, a + 1, b, b + 1); else indices.push(a, a + 1, b, a + 1, b + 1, b); }
      const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      mesh(geometry, armor, shoulder);
      const rim = Array.from({length:9}, (_, i) => { const t=i/8; return [side*(-.055+t*width),y+Math.sin(t*Math.PI)*.065+t**5*(side<0?.09:.045),.115-t*.025]; });
      tube(edge, shoulder, rim, .0035);
    }
    const clasp = mesh(game.geo.roundTorus, edge, shoulder, side * -.035, .075, .06); clasp.scale.set(.038, .05, .026);
    tube(edge, shoulder, [[side * -.045, .03, .075], [side * -.085, -.07, .10], [side * -.09, -.16, .08]], .004);
    const elbow = joint(shoulder, 'Elbow', 0, -.31); elbow.rotation.x = -.6;
    loft(inset, elbow, [[.025, .065, .065], [-.10, .079, .07], [-.25, .051, .051], [-.30, .047, .045]]);
    shell(armor, elbow, [[-.28, .048, .061], [-.21, .063, .082], [-.10, .082, .091], [0, .075, .081], [.045, .042, .062]]);
    tube(edge, elbow, [[0, .05, .091], [0, -.10, .092], [0, -.26, .079]], .005);
    for (let i = 0; i < 3; i++) tube(edge, elbow, [[-.053, -.06 - i * .052, .074], [0, -.085 - i * .052, .092], [.053, -.06 - i * .052, .074]], .0035);
    const wrist = joint(elbow, 'Gauntlet grip', 0, -.30);
    ellipsoid(leather, wrist, 0, -.035, .015, .049, .067, .035);
    for (let i = 0; i < 4; i++) ellipsoid(armor, wrist, -.034 + i * .022, -.067, .04, .012, .038, .018);
    game[side < 0 ? 'leftShoulder' : 'rightShoulder'] = shoulder; game[side < 0 ? 'leftElbow' : 'rightElbow'] = elbow; game[side < 0 ? 'offhandGrip' : 'swordArm'] = wrist;
    const grip = mesh(game.geo.roundCylinder, leather, wrist, 0, 0, .13, true); grip.scale.set(.026, .24, .026); grip.rotation.x = Math.PI / 2;
    const guard = joint(wrist, 'Winged sword guard', 0, 0, .28);
    for (const s of [-1, 1]) {
      tube(edge, guard, [[0, 0, 0], [s * .08, .008, .025], [s * .145, .025, -.028], [s * .17, .035, -.065]], .015);
      tube(inset, guard, [[0, -.014, 0], [s * .095, -.005, .002], [s * .14, .018, -.035]], .012);
    }
    ellipsoid(glow, guard, 0, .014, .012, .024, .019, .027);
    if (side < 0) { game.offhandParts = [grip, guard]; grip.visible = guard.visible = false; }
  }

  // A ridged steel blade, with a narrow violet inlay instead of an emissive slab.
  const positions = [], uvs = [], indices = [], bladeSections = [[0, .36], [.10, .50], [.22, .34], [.82, .20], [1, 0]];
  for (let j = 0; j < bladeSections.length; j++) {
    const [z, width] = bladeSections[j];
    for (const [x, y] of [[-width, 0], [0, .46], [width, 0], [0, -.30]]) { positions.push(x, y, z); uvs.push((x / 1.54) + .5, z); }
  }
  for (let j = 0; j < bladeSections.length - 1; j++) for (let i = 0; i < 4; i++) { const a = j * 4 + i, b = j * 4 + (i + 1) % 4; indices.push(a, a + 4, b, b, a + 4, b + 4); }
  const bladeGeometry = own(new THREE.BufferGeometry()); bladeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); bladeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); bladeGeometry.setIndex(indices); bladeGeometry.computeVertexNormals();
  game.blade = mesh(bladeGeometry, steel, game.swordArm, 0, 0, .30, true); game.blade.scale.set(.11, .045, 1.15);
  for (const side of [-1, 1]) tube(glow, game.blade, [[side * .10, .43, .16], [side * .075, .36, .53], [0, .22, .83]], .025);
  for (let i = 0; i < 5; i++) tube(inset, game.blade, [[-.19, .36, .20 + i * .065], [0, .47, .23 + i * .065], [.19, .36, .20 + i * .065]], .018);
  game.blade.userData.keep = true;
  game.heroGlow = glow;

  // Bake decorations by material inside each articulated part, never across joints.
  const bake = group => {
    for (const child of [...group.children]) if (child.children.length) bake(child);
    const byMaterial = new Map();
    for (const child of group.children) if (child.isMesh && !child.userData.keep) { const list = byMaterial.get(child.material) || []; list.push(child); byMaterial.set(child.material, list); }
    for (const [material, parts] of byMaterial) {
      if (parts.length < 2) continue;
      const pieces = parts.map(part => { part.updateMatrix(); const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone(); return geometry.applyMatrix4(part.matrix); });
      const geometry = mergeGeometries(pieces, false); pieces.forEach(p => p.dispose());
      if (!geometry) continue; mesh(own(geometry), material, group);
      for (const part of parts) { group.remove(part); if (game.ownedGeometries.delete(part.geometry)) part.geometry.dispose(); }
    }
  };
  bake(root);
  root.userData.design = 'silver-haired-dusk-knight';
}
