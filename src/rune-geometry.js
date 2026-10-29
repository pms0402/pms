import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
/** Original geometric sigil, no textures or external art. */
export function createRuneGeometry(evolved = false) {
  const parts = [new THREE.TorusGeometry(0.3, 0.018, 4, 24)];
  const beam = (x, y, length, angle) => {
    const g = new THREE.BoxGeometry(0.018, length, 0.018);
    g.rotateZ(angle);
    g.translate(x, y, 0);
    parts.push(g);
  };
  beam(0, 0, 0.42, 0);
  beam(-0.075, 0.06, 0.22, -0.7);
  beam(0.075, -0.06, 0.22, -0.7);
  for (let i = 0; i < (evolved ? 8 : 4); i++) {
    const a = (i * Math.PI * 2) / (evolved ? 8 : 4);
    beam(Math.sin(a) * 0.35, Math.cos(a) * 0.35, 0.08, -a);
  }
  if (evolved) parts.push(new THREE.TorusGeometry(0.41, 0.012, 3, 32));
  const g = mergeGeometries(
    parts.map((p) => p.toNonIndexed()),
    false,
  );
  parts.forEach((p) => p.dispose());
  return g;
}
