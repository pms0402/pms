import * as THREE from "three";
const CORNERS = [
  [0, false],
  [0, true],
  [1, true],
  [0, false],
  [1, true],
  [1, false],
];
/** A small reusable ribbon follows the actual steel, not a delayed damage projectile. */
export class SwordTrail {
  constructor(game) {
    this.game = game;
    this.capacity = 18;
    this.paths = [[], []];
    this.free = [[], []];
    this.time = 0;
    this.sampleTime = [-1, -1];
    this.base = new THREE.Vector3();
    this.tip = new THREE.Vector3();
    this.color = new THREE.Color();
    const quads = (this.capacity - 1) * 2;
    this.position = new Float32Array(quads * 6 * 3);
    this.colors = new Float32Array(quads * 6 * 3);
    this.alpha = new Float32Array(quads * 6);
    this.geometry = new THREE.BufferGeometry();
    for (const [id, array, size] of [
      ["position", this.position, 3],
      ["color", this.colors, 3],
      ["vrAlpha", this.alpha, 1],
    ])
      this.geometry.setAttribute(
        id,
        new THREE.BufferAttribute(array, size).setUsage(THREE.DynamicDrawUsage),
      );
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexShader:
        "attribute float vrAlpha;varying vec3 vColor;varying float vAlpha;void main(){vColor=color;vAlpha=vrAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
      fragmentShader:
        "varying vec3 vColor;varying float vAlpha;void main(){gl_FragColor=vec4(vColor,vAlpha);}",
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Measured blade ribbons";
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    game.scene.add(this.mesh);
  }
  sample() {
    const g = this.game,
      counter = g.counterAnim > 0,
      total = counter ? 0.38 : g.attackAnimTotal || 0.3,
      remaining = counter ? g.counterAnim : g.attackAnim,
      progress = 1 - remaining / total;
    if (
      remaining <= 0 ||
      progress < 0.18 ||
      progress > 0.74 ||
      g.parry.active > 0
    )
      return;
    g.player.updateWorldMatrix(true, true);
    for (const [id, blade] of [g.blade, g.offhandBlade].entries()) {
      if (
        !blade ||
        (id === 1 && !blade.visible) ||
        this.time - this.sampleTime[id] < 0.007
      )
        continue;
      this.sampleTime[id] = this.time;
      this.base.set(0, 0, 0.12).applyMatrix4(blade.matrixWorld);
      this.tip.set(0, 0, 1).applyMatrix4(blade.matrixWorld);
      const path = this.paths[id],
        previous = path.at(-1);
      if (previous && previous.tip.distanceToSquared(this.tip) > 9) {
        while (path.length) this.free[id].push(path.pop());
      }
      const point = this.free[id].pop() || {
        base: new THREE.Vector3(),
        tip: new THREE.Vector3(),
      };
      point.base.copy(this.base);
      point.tip.copy(this.tip);
      point.time = this.time;
      point.counter = counter;
      path.push(point);
      if (path.length > this.capacity) this.free[id].push(path.shift());
    }
  }
  update(dt) {
    this.time += Math.max(0, dt);
    let at = 0;
    const intensity = 0.25 + 0.55 * (this.game.effectIntensity ?? 1);
    for (let hand = 0; hand < 2; hand++) {
      const path = this.paths[hand];
      while (path.length && this.time - path[0].time > 0.14)
        this.free[hand].push(path.shift());
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1],
          b = path[i];
        this.color.set(
          b.counter
            ? "#ffe6ad"
            : this.game.stats.swordEvolution === "twinblade"
              ? "#9cefff"
              : "#d8c7fa",
        );
        for (const [endpoint, tip] of CORNERS) {
          const point = endpoint ? b : a;
          const p = tip ? point.tip : point.base,
            index = at * 3;
          this.position[index] = p.x;
          this.position[index + 1] = p.y;
          this.position[index + 2] = p.z;
          this.colors[index] = this.color.r;
          this.colors[index + 1] = this.color.g;
          this.colors[index + 2] = this.color.b;
          this.alpha[at] =
            Math.max(0, 1 - (this.time - point.time) / 0.14) *
            intensity *
            (tip ? 1 : 0.06);
          at++;
        }
      }
    }
    this.geometry.setDrawRange(0, at);
    this.mesh.visible = at > 0;
    for (const attr of Object.values(this.geometry.attributes)) {
      attr.clearUpdateRanges();
      if (at) attr.addUpdateRange(0, at * attr.itemSize);
      attr.needsUpdate = true;
    }
  }
  reset() {
    this.paths.forEach((p, i) => {
      while (p.length) this.free[i].push(p.pop());
    });
    this.sampleTime = [-1, -1];
    this.geometry.setDrawRange(0, 0);
    this.mesh.visible = false;
  }
  dispose() {
    this.reset();
    this.mesh.removeFromParent();
    this.geometry.dispose();
    this.material.dispose();
  }
}
