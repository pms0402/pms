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
export function tagMotionGeometry(geometry, kind, joint, authoredPivot) {
  const n = geometry.attributes.position.count,
    pivot = authoredPivot || jointPivot(kind, joint),
    j = new Float32Array(n),
    k = new Float32Array(n),
    p = new Float32Array(n * 3), bend=new Float32Array(n*4);
  j.fill(joint);
  k.fill(kind);
  const leg=joint>=4||(kind===6&&joint>=2),arm=joint===2||joint===3;
  const elbowY=leg?pivot[1]*.48:pivot[1]-.30;
  for (let i = 0; i < n; i++) {
    p.set(pivot,i*3);
    const y=geometry.attributes.position.getY(i),weight=(leg||arm)&&joint!==8?Math.max(0,Math.min(1,(elbowY+.055-y)/.11)):0;
    bend.set([pivot[0],elbowY,pivot[2],weight],i*4);
  }
  geometry.setAttribute('vrBend',new THREE.BufferAttribute(bend,4));
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
  if(pose[15]){
    const impact=pose[11]||0,death=pose[14]||0,leg=j>=4||(kind===6&&j>=2);
    if(j===1){x+=(pose[8]||0)*.2-impact*.28-death*.35;y+=(pose[10]||0)*impact*.1;}
    else if(j>=2&&j!==8){
      if(leg){const travel=pose[6]||0;z-=x*Math.sin(travel)*.65;x*=Math.cos(travel);x-=(pose[8]||0)*.4+death*.48;z+=(pose[9]||0)*.2;}
      else{x+=Math.cos(pose[10]||0)*impact*.5+death*.65;z+=side*death*.35;const style=pose[12]||0;x-=cast*(style===2?.5:style===4?.3:0);y+=side*attack*(style===5?.5:style===1?.2:0);}
      x-=(pose[13]||0)*(leg?.2:.4);
    }
  }
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
export const MONSTER_GLSL = `
attribute float vrJoint;attribute float vrKind;attribute vec3 vrPivot;attribute vec4 vrBend;
attribute vec4 vrPose0;attribute vec4 vrPose1;attribute vec4 vrPose2;attribute vec4 vrPose3;
vec3 vrAngles(){float j=vrJoint,k=vrKind,side=mod(j,2.)<.5?-1.:1.;float x=0.,y=0.,z=0.;
if(j>.5&&j<1.5){x=vrPose1.w*.025-vrPose0.w*.13+vrPose0.z*.12;y=vrPose1.z*.22;}
else if(j>7.5){y=sin(vrPose0.x+1.)*(.12+vrPose0.y*.2);}
else if(j>1.5){bool leg=j>3.5,quad=k==1.||k==5.,bug=k==6.;float wave=sin(vrPose0.x+(mod(j,2.)>.5?3.14159265359:0.)+(j>5.5?3.14159265359:0.));
if(leg||bug){x=wave*vrPose0.y*(quad?.67:bug?.38:.52);z=bug?side*(.1+cos(vrPose0.x+j)*vrPose0.y*.12):side*.025*vrPose0.y;}
else{x=-wave*vrPose0.y*.42-vrPose0.w*.85+vrPose0.z*.95-vrPose1.x*.7;z=side*(vrPose0.w*.16+vrPose1.x*.1);y=side*vrPose0.z*.35;}
if(quad&&leg)z=side*max(0.,-wave)*vrPose0.y*.07;}
if(vrPose3.w>.5){float impact=vrPose2.w,death=vrPose3.z;bool leg=j>3.5||(k==6.&&j>1.5);
if(j>.5&&j<1.5){x+=vrPose2.x*.2-impact*.28-death*.35;y+=vrPose2.z*impact*.1;}
else if(j>1.5&&j<7.5){if(leg){z-=x*sin(vrPose1.z)*.65;x*=cos(vrPose1.z);x-=vrPose2.x*.4+death*.48;z+=vrPose2.y*.2;}else{x+=cos(vrPose2.z)*impact*.5+death*.65;z+=side*death*.35;float style=vrPose3.x;x-=vrPose1.x*(style==2.?.5:style==4.?.3:0.);y+=side*vrPose0.z*(style==5.?.5:style==1.?.2:0.);}x-=vrPose3.y*(leg?.2:.4);}}
return vec3(x,y,z);}
vec3 vrRotate(vec3 p,vec3 a){float s=sin(a.x),c=cos(a.x);p=vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);s=sin(a.y);c=cos(a.y);p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);s=sin(a.z);c=cos(a.z);return vec3(c*p.x-s*p.y,s*p.x+c*p.y,p.z);}
`;
export function secondaryAngle(kind,j,pose){
 if(!pose[15])return 0;
 const leg=j>=4||(kind===6&&j>=2);if(j<2||j===8)return 0;
 const phase=pose[0]+(j%2?Math.PI:0)+(j>=6?Math.PI:0),swing=Math.max(0,-Math.sin(phase));
 return leg?(.12+swing*swing*.95)*(pose[1]||0)+(pose[13]||0)*.35+(pose[14]||0)*1.35:-.15-(pose[3]||0)*.65+(pose[2]||0)*.35-(pose[4]||0)*.55-(pose[14]||0)*.7;
}
export function rigMaterial(base,corpsePose=null) {
  const material = base.clone();
  material.onBeforeCompile = (shader) => {
    let header=MONSTER_GLSL+`
float vrSecondary(){if(vrPose3.w<.5||vrJoint<1.5||vrJoint>7.5)return 0.;bool leg=vrJoint>3.5||(vrKind==6.&&vrJoint>1.5);float phase=vrPose0.x+(mod(vrJoint,2.)>.5?3.14159265359:0.)+(vrJoint>5.5?3.14159265359:0.);float swing=max(0.,-sin(phase));return leg?(.12+swing*swing*.95)*vrPose0.y+vrPose3.y*.35+vrPose3.z*1.35:-.15-vrPose0.w*.65+vrPose0.z*.35-vrPose1.x*.55-vrPose3.z*.7;}
`;
    if(corpsePose){for(let i=0;i<4;i++){header=header.replace('attribute vec4 vrPose'+i+';','uniform vec4 vrPose'+i+';');shader.uniforms['vrPose'+i]={value:corpsePose[i]};}}
    shader.vertexShader = header + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\nobjectNormal=vrRotate(normalize(mix(objectNormal,vrRotate(objectNormal,vec3(vrSecondary(),0.,0.)),vrBend.w)),vrAngles());\n#ifdef USE_TANGENT\nobjectTangent=vrRotate(objectTangent,vrAngles());\n#endif",
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\ntransformed=mix(transformed,vrRotate(transformed-vrBend.xyz,vec3(vrSecondary(),0.,0.))+vrBend.xyz,vrBend.w);transformed=vrRotate(transformed-vrPivot,vrAngles())+vrPivot;",
    );
  };
  material.customProgramCacheKey = () =>
    `voidrun-monster-joints-v2:${base.type}:${!!corpsePose}`;
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
    pivot = original.attributes.vrPivot?.array, bend=original.attributes.vrBend?.array;
  if (!j) return;
  let prior = -1;
  for (let v = 0; v < j.length; v++) {
    const i = v * 3;
    if (j[v] !== prior) {
      jointAngles(k[v], j[v], pose, angles);
      prior = j[v];
    }
    let px=p[i],py=p[i+1],pz=p[i+2],nx=n?.[i]||0,ny=n?.[i+1]||0,nz=n?.[i+2]||0;
    const weight=bend?.[v*4+3]||0;
    if(weight&&pose[15]){const angle=secondaryAngle(k[v],j[v],pose),sin=Math.sin(angle),cos=Math.cos(angle),by=bend[v*4+1],bz=bend[v*4+2],ry=py-by,rz=pz-bz;
      py+=(cos*ry-sin*rz+by-py)*weight;pz+=(sin*ry+cos*rz+bz-pz)*weight;
      const y=ny;ny+=(cos*y-sin*nz-ny)*weight;nz+=(sin*y+cos*nz-nz)*weight;const len=Math.hypot(nx,ny,nz)||1;nx/=len;ny/=len;nz/=len;}
    rotate(
      px - pivot[i],
      py - pivot[i + 1],
      pz - pivot[i + 2],
      angles,
      out,
      i,
    );
    out[i] += pivot[i];
    out[i + 1] += pivot[i + 1];
    out[i + 2] += pivot[i + 2];
    if (nout && n) rotate(nx,ny,nz,angles,nout,i);
  }
  target.attributes.position.needsUpdate = true;
  if (nout) target.attributes.normal.needsUpdate = true;
  target.computeBoundingSphere();
}
