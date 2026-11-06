import * as THREE from "three";
import { WORLD_COLLIDERS } from "./terrain.js";

export const ROOM_COMBAT_SOLIDS = [-9, 9].flatMap((x) =>
  [-6, 6].map((z) => ({ type: "circle", x, z, radius: 0.4 })),
);

/** First intersection of a swept point with a wall. Includes segment endpoints. */
export function segmentEntry(a, b, solid, padding = 0) {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  if (solid.type === "circle") {
    const x = a.x - solid.x,
      z = a.z - solid.z,
      r = solid.radius + padding,
      c = x * x + z * z - r * r;
    if (c <= 0) return 0;
    const aa = dx * dx + dz * dz;
    if (aa < 1e-12) return Infinity;
    const bb = x * dx + z * dz,
      disc = bb * bb - aa * c;
    if (disc < 0) return Infinity;
    const t = (-bb - Math.sqrt(disc)) / aa;
    return t >= 0 && t <= 1 ? t : Infinity;
  }
  let near = 0,
    far = 1;
  for (const [v, d, center, half] of [
    [a.x, dx, solid.x, solid.hx + padding],
    [a.z, dz, solid.z, solid.hz + padding],
  ]) {
    if (Math.abs(d) < 1e-12) {
      if (v < center - half || v > center + half) return Infinity;
      continue;
    }
    const t1 = (center - half - v) / d,
      t2 = (center + half - v) / d;
    near = Math.max(near, Math.min(t1, t2));
    far = Math.min(far, Math.max(t1, t2));
    if (near > far) return Infinity;
  }
  return near <= 1 && far >= 0 ? Math.max(0, near) : Infinity;
}
export function combatSolids(game) {
  if (game.training?.active) return game.training.colliders;
  if (game.sideAreas?.active) return ROOM_COMBAT_SOLIDS;
  return game.world?.colliders || WORLD_COLLIDERS;
}
/** Exact swept ray against an extruded wall or a floor/ceiling slab. */
export function volumeEntry(a,b,solid,padding=0){
  if(!Number.isFinite(solid.minY)||!Number.isFinite(solid.maxY))return segmentEntry(a,b,solid,padding);
  let near=0,far=1;
  const slabs=[['y',solid.minY-padding,solid.maxY+padding]];
  if(solid.type==='circle'){
    const x=a.x-solid.x,z=a.z-solid.z,dx=b.x-a.x,dz=b.z-a.z,r=solid.radius+padding,aa=dx*dx+dz*dz,cc=x*x+z*z-r*r;
    if(aa<1e-12){if(cc>0)return Infinity;}
    else{const bb=x*dx+z*dz,disc=bb*bb-aa*cc;if(disc<0)return Infinity;near=Math.max(near,(-bb-Math.sqrt(disc))/aa);far=Math.min(far,(-bb+Math.sqrt(disc))/aa);}
  }else slabs.push(['x',solid.x-solid.hx-padding,solid.x+solid.hx+padding],['z',solid.z-solid.hz-padding,solid.z+solid.hz+padding]);
  for(const [axis,min,max] of slabs){const d=b[axis]-a[axis];if(Math.abs(d)<1e-12){if(a[axis]<min||a[axis]>max)return Infinity;continue;}const t1=(min-a[axis])/d,t2=(max-a[axis])/d;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)return Infinity;}
  return near<=far&&far>=0&&near<=1?Math.max(0,near):Infinity;
}
export function clearFraction(game, a, b, padding = 0.04, absolute=false) {
  let first = 1;
  const offset=absolute?0:1.2,start={x:a.x,y:(a.y||0)+offset,z:a.z},end={x:b.x,y:(b.y||0)+offset,z:b.z};
  for (const wall of combatSolids(game))
    first = Math.min(first, volumeEntry(start, end, wall, padding));
  return first;
}
export function combatLineClear(game, a, b,absolute=false) {
  if (!a || !b || !Number.isFinite(a.x + a.z + b.x + b.z)) return false;
  if (clearFraction(game, a, b,.04,absolute) < 1 - 1e-8) return false;
  if (
    game.sideAreas?.active ||
    game.training?.active ||
    game.camp?.active ||
    !game.groundHeight
  )
    return true;
  const count = Math.min(24, Math.ceil(Math.hypot(a.x - b.x, a.z - b.z) / 1.5));
  for (let i = 1; i < count; i++) {
    const t = i / count,
      y = (a.y || 0) * (1 - t) + (b.y || 0) * t + (absolute?0:1.2);
    const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
    if ((game.world?.topology?.layout.ground(x,z)??game.groundHeight(x,z)) > y)
      return false;
  }
  return true;
}
export function clipAimPoint(game, origin, target, out = new THREE.Vector3()) {
  target=new THREE.Vector3(target.x,game.groundHeight?.(target.x,target.z,origin.y)??target.y,target.z);
  const distance = Math.hypot(target.x - origin.x, target.z - origin.z),
    fraction = clearFraction(game, origin, target, 0.12);
  out
    .copy(origin)
    .lerp(
      target,
      Math.max(
        0,
        fraction - (fraction < 1 ? 0.18 / Math.max(0.18, distance) : 0),
      ),
    );
  if(game.world?.topology){
    const start=new THREE.Vector3(origin.x,(origin.y||0)+1.2,origin.z),end=new THREE.Vector3(out.x,out.y+1.2,out.z),stop=projectileTarget(game,start,end);
    out.x=stop.x;out.z=stop.z;
  }
  out.y = game.groundHeight?.(out.x,out.z,origin.y) || 0;
  return out;
}
export function bodyHeight(enemy){return Math.max(.75,(enemy.group?.scale?.y||enemy.size||1)*(enemy.kind===4?2.3:[1,5,6,7].includes(enemy.kind)?1.2:1.8));}
export function swordHeightHit(origin,enemy,padding=.55){const y=origin.y+1.2,p=enemy.group.position;return y+padding>=p.y+.1&&y-padding<=p.y+bodyHeight(enemy);}
export function projectileTarget(game,a,b,out=new THREE.Vector3()){
  let fraction=clearFraction(game,a,b,.10,true);const count=Math.max(1,Math.ceil(a.distanceTo(b)/.25));
  if(!game.training?.active&&!game.sideAreas?.active&&!game.camp?.active)for(let i=1;i<=count;i++){const t=i/count;if(t>=fraction)break;const x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;if((game.world?.topology?.layout.ground(x,z)??game.groundHeight(x,z))>=a.y+(b.y-a.y)*t-.08){fraction=(i-1)/count;break;}}
  return out.copy(a).lerp(b,Math.max(0,fraction-(fraction<1?.002:0)));
}
export function hurtRadius(enemy) {
  return Math.max(
    0.2,
    Math.min(enemy.kind === 4 ? 2 : 1.3, (Number(enemy.size) || 1) * 0.4),
  );
}
