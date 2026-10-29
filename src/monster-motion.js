import * as THREE from "three";
/** Animation tags are baked with the original high-quality geometry, never into colliders. */
export function monsterJoint(kind, x, y, z) {
  const side = x < 0 ? 0 : 1,
    ax = Math.abs(x);
  if (kind === 7) return 0;
  if (kind === 1 || kind === 5) {
    if (ax > 0.18 && y < 0.56 && z < 0.65) return (z < 0 ? 6 : 4) + side;
    if (z > 0.42 || (z > 0.35 && y > 0.72)) return 1;
    if (z < -0.65) return 8;
    return 0;
  }
  if (kind === 6) {
    if (ax > 0.38 && y < 0.6) return (z < -0.12 ? 6 : z < 0.25 ? 4 : 2) + side;
    if (z > 0.35 && ax < 0.4) return 1;
    return 0;
  }
  if ((kind === 3 || kind === 9) && x > 0.6) return 3;
  if (y > 1.57 || (y > 1.12 && ax < 0.43)) return 1;
  if (
    y < 0.43 &&
    ax > 0.09 &&
    ax < 0.38 * (kind === 4 ? 1.65 : kind === 2 ? 1.45 : 1)
  )
    return 4 + side;
  if (ax > (kind === 4 ? 0.43 : kind === 2 ? 0.4 : 0.29) && y > 0.3)
    return 2 + side;
  return y > 1.08 ? 1 : 0;
}
export function jointPivot(kind, id) {
  const side = id % 2 === 0 ? -1 : 1,
    bulk = kind === 4 ? 1.65 : kind === 2 ? 1.45 : 1;
  if (kind === 1 || kind === 5) {
    const x = kind === 5 ? 0.33 : 0.24,
      y = kind === 5 ? 0.45 : 0.53;
    return id === 1
      ? [0, 0.65, 0.36]
      : id === 8
        ? [0, 0.65, -0.58]
        : [
            side * x,
            y,
            id >= 6 ? (kind === 5 ? -0.4 : -0.43) : kind === 5 ? 0.32 : 0.36,
          ];
  }
  if (kind === 6)
    return id === 1
      ? [0, 0.44, 0.35]
      : [side * 0.3, 0.47, id >= 6 ? -0.4 : id >= 4 ? 0 : 0.37];
  if (id === 1) return [0, kind === 2 || kind === 4 ? 1.23 : 1.08, 0.04];
  if (id === 2 || id === 3)
    return [
      side * (kind === 8 ? 0.25 : 0.33 * bulk),
      kind === 8 ? 1.15 : kind === 3 || kind === 9 ? 1.13 : 1,
      0,
    ];
  if (id === 4 || id === 5)
    return [
      side * (kind === 8 ? 0.15 : 0.19 * bulk),
      kind === 8 ? 0.5 : 0.4,
      0,
    ];
  return [0, 0, 0];
}
export function tagMotionGeometry(geometry, kind, joint) {
  const n = geometry.attributes.position.count,
    pivot = jointPivot(kind, joint),
    j = new Float32Array(n),
    k = new Float32Array(n),
    p = new Float32Array(n * 3);
  j.fill(joint);
  k.fill(kind);
  for (let i = 0; i < n; i++) p.set(pivot, i * 3);
  geometry.setAttribute("vrJoint", new THREE.BufferAttribute(j, 1));
  geometry.setAttribute("vrKind", new THREE.BufferAttribute(k, 1));
  geometry.setAttribute("vrPivot", new THREE.BufferAttribute(p, 3));
  return geometry;
}
/** CPU reference and GPU batches use the same rotations, including the depth/shadow pass. */
export function jointAngles(kind, j, pose, out) {
  const phase = pose[0],
    stride = pose[1],
    attack = pose[2],
    windup = pose[3],
    cast = pose[4],
    look = pose[6],
    breath = pose[7];
  let x = 0,
    y = 0,
    z = 0;
  const side = j % 2 === 0 ? -1 : 1;
  if (j === 1) {
    x = breath * 0.025 - windup * 0.13 + attack * 0.12;
    y = look * 0.22;
  } else if (j === 8) {
    y = Math.sin(phase + 1) * (0.12 + stride * 0.2);
  } else if (j >= 2) {
    const leg = j >= 4,
      quad = kind === 1 || kind === 5,
      bug = kind === 6;
    let wave = Math.sin(phase + (j % 2 ? Math.PI : 0) + (j >= 6 ? Math.PI : 0));
    if (leg || bug) {
      x = wave * stride * (quad ? 0.67 : bug ? 0.38 : 0.52);
      z = bug
        ? side * (0.1 + Math.cos(phase + j) * stride * 0.12)
        : side * 0.025 * stride;
    } else {
      x = -wave * stride * 0.42 - windup * 0.85 + attack * 0.95 - cast * 0.7;
      z = side * (windup * 0.16 + cast * 0.1);
      y = side * attack * 0.35;
    }
    if (quad && leg) z = side * Math.max(0, -wave) * stride * 0.07;
  }
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
export const MONSTER_GLSL = `
attribute float vrJoint;attribute float vrKind;attribute vec3 vrPivot;
attribute vec4 vrPose0;attribute vec4 vrPose1;
vec3 vrAngles(){float j=vrJoint,k=vrKind,side=mod(j,2.)<.5?-1.:1.;float x=0.,y=0.,z=0.;
if(j>.5&&j<1.5){x=vrPose1.w*.025-vrPose0.w*.13+vrPose0.z*.12;y=vrPose1.z*.22;}
else if(j>7.5){y=sin(vrPose0.x+1.)*(.12+vrPose0.y*.2);}
else if(j>1.5){bool leg=j>3.5,quad=k==1.||k==5.,bug=k==6.;float wave=sin(vrPose0.x+(mod(j,2.)>.5?3.14159265359:0.)+(j>5.5?3.14159265359:0.));
if(leg||bug){x=wave*vrPose0.y*(quad?.67:bug?.38:.52);z=bug?side*(.1+cos(vrPose0.x+j)*vrPose0.y*.12):side*.025*vrPose0.y;}
else{x=-wave*vrPose0.y*.42-vrPose0.w*.85+vrPose0.z*.95-vrPose1.x*.7;z=side*(vrPose0.w*.16+vrPose1.x*.1);y=side*vrPose0.z*.35;}
if(quad&&leg)z=side*max(0.,-wave)*vrPose0.y*.07;}
return vec3(x,y,z);}
vec3 vrRotate(vec3 p,vec3 a){float s=sin(a.x),c=cos(a.x);p=vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);s=sin(a.y);c=cos(a.y);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);s=sin(a.z);c=cos(a.z);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
`;
export function rigMaterial(base) {
  const material = base.clone();
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = MONSTER_GLSL + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\nobjectNormal=vrRotate(objectNormal,vrAngles());\n#ifdef USE_TANGENT\nobjectTangent=vrRotate(objectTangent,vrAngles());\n#endif",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed=vrRotate(transformed-vrPivot,vrAngles())+vrPivot;",
    );
  };
  material.customProgramCacheKey = () =>
    `voidrun-monster-joints-v1:${base.type}`;
  return material;
}
const angles = new Float64Array(3);
function rotate(x, y, z, a, array, i) {
  let c = Math.cos(a[0]),
    s = Math.sin(a[0]),
    ny = c * y - s * z,
    nz = s * y + c * z;
  y = ny;
  z = nz;
  c = Math.cos(a[1]);
  s = Math.sin(a[1]);
  const nx = c * x + s * z;
  nz = -s * x + c * z;
  x = nx;
  z = nz;
  c = Math.cos(a[2]);
  s = Math.sin(a[2]);
  array[i] = c * x - s * y;
  array[i + 1] = s * x + c * y;
  array[i + 2] = z;
}
export function deformReference(original, target, pose) {
  const p = original.attributes.position.array,
    n = original.attributes.normal?.array,
    out = target.attributes.position.array,
    nout = target.attributes.normal?.array,
    j = original.attributes.vrJoint?.array,
    k = original.attributes.vrKind?.array,
    pivot = original.attributes.vrPivot?.array;
  if (!j) return;
  let prior = -1;
  for (let v = 0; v < j.length; v++) {
    const i = v * 3;
    if (j[v] !== prior) {
      jointAngles(k[v], j[v], pose, angles);
      prior = j[v];
    }
    rotate(
      p[i] - pivot[i],
      p[i + 1] - pivot[i + 1],
      p[i + 2] - pivot[i + 2],
      angles,
      out,
      i,
    );
    out[i] += pivot[i];
    out[i + 1] += pivot[i + 1];
    out[i + 2] += pivot[i + 2];
    if (nout && n) rotate(n[i], n[i + 1], n[i + 2], angles, nout, i);
  }
  target.attributes.position.needsUpdate = true;
  if (nout) target.attributes.normal.needsUpdate = true;
  target.computeBoundingSphere();
}
