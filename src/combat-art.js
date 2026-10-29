import * as THREE from 'three';

const COLORS = { parry:'#c8f5ff',counter:'#ffe4a3', sword: '#ddcaff', fireball: '#ffad63', frost: '#9fdfff', lightning: '#c3edff', orbit: '#c4a0ff', combo: '#f0ccff', default: '#cdbda5' };

/** Cosmetic particles share one draw call and never consume the gameplay RNG. */
export class CombatArt {
  constructor(scene, capacity = 256) {
    this.capacity = capacity; this.count = 0; this.seed = 5193;
    this.life = new Float32Array(capacity); this.total = new Float32Array(capacity); this.velocity = new Float32Array(capacity * 3);
    this.position = new Float32Array(capacity * 3); this.color = new Float32Array(capacity * 3); this.size = new Float32Array(capacity); this.alpha = new Float32Array(capacity);
    this.baseSize = new Float32Array(capacity); this.trailBudget = 12;
    const plane = new THREE.PlaneGeometry(1, 1), geometry = this.geometry = new THREE.InstancedBufferGeometry();
    geometry.index = plane.index; geometry.attributes.position = plane.attributes.position; geometry.attributes.uv = plane.attributes.uv; geometry.instanceCount = 0;
    for (const [name, array, length] of [['aPosition', this.position, 3], ['aColor', this.color, 3], ['aSize', this.size, 1], ['aAlpha', this.alpha, 1]]) geometry.setAttribute(name, new THREE.InstancedBufferAttribute(array, length).setUsage(THREE.DynamicDrawUsage));
    this.material = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: 'attribute vec3 aPosition;attribute vec3 aColor;attribute float aSize;attribute float aAlpha;varying vec2 vUv;varying vec3 vColor;varying float vAlpha;void main(){vUv=uv;vColor=aColor;vAlpha=aAlpha;vec4 p=modelViewMatrix*vec4(aPosition,1.0);p.xy+=position.xy*aSize;gl_Position=projectionMatrix*p;}',
      fragmentShader: 'varying vec2 vUv;varying vec3 vColor;varying float vAlpha;void main(){float d=length(vUv-.5)*2.0;float halo=pow(max(0.0,1.0-d),2.5);float core=exp(-d*d*85.0);gl_FragColor=vec4(vColor*(.65+core),vAlpha*(halo*.65+core*.45));}',
    });
    this.mesh = new THREE.Mesh(geometry, this.material); this.mesh.name = 'Batched impact embers'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 4; this.mesh.visible = false; scene.add(this.mesh);
    this.colors = Object.fromEntries(Object.entries(COLORS).map(([key, value]) => [key, new THREE.Color(value)]));
  }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(origin, source, count, trail = false) {
    const color = this.colors[source] || this.colors.default;
    for (let n = 0; n < count && this.count < this.capacity; n++) {
      const i = this.count++, at = i * 3, angle = this.random() * Math.PI * 2, speed = trail ? .25 : 1.1 + this.random() * 2.8;
      this.position[at] = origin.x; this.position[at + 1] = origin.y + (trail ? 0 : .7); this.position[at + 2] = origin.z;
      this.velocity[at] = Math.cos(angle) * speed; this.velocity[at + 1] = trail ? .15 : .8 + this.random() * 2; this.velocity[at + 2] = Math.sin(angle) * speed;
      this.color[at] = color.r; this.color[at + 1] = color.g; this.color[at + 2] = color.b;
      this.life[i] = this.total[i] = trail ? .23 : .22 + this.random() * .23;
      this.baseSize[i] = trail ? .55 : .14 + this.random() * .17; this.size[i] = this.baseSize[i]; this.alpha[i] = trail ? .45 : .9;
    }
    this.upload();
  }
  hit(origin, source = 'sword', critical = false) { this.emit(origin, source, critical ? 8 : source === 'sword' ? 5 : 3); }
  trail(origin, source = 'fireball') { if (this.trailBudget > 0) { this.trailBudget--; this.emit(origin, source, 1, true); } }
  update(dt) {
    this.trailBudget = 12;
    for (let i = this.count - 1; i >= 0; i--) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        const last = --this.count;
        if (i !== last) {
          for (const array of [this.position, this.color, this.velocity]) for (let n = 0; n < 3; n++) array[i * 3 + n] = array[last * 3 + n];
          for (const array of [this.life, this.total, this.baseSize, this.size, this.alpha]) array[i] = array[last];
        }
        continue;
      }
      const at = i * 3, fade = this.life[i] / this.total[i];
      this.position[at] += this.velocity[at] * dt; this.position[at + 1] += this.velocity[at + 1] * dt; this.position[at + 2] += this.velocity[at + 2] * dt;
      this.velocity[at + 1] -= dt * 4.2; this.size[i] = this.baseSize[i] * (.45 + fade * .55); this.alpha[i] = fade * .8;
    }
    this.upload();
  }
  upload() {
    this.geometry.instanceCount = this.count; this.mesh.visible = this.count > 0;
    for (const attribute of Object.values(this.geometry.attributes)) if (attribute.isInstancedBufferAttribute) { attribute.clearUpdateRanges(); if (this.count) attribute.addUpdateRange(0, this.count * attribute.itemSize); attribute.needsUpdate = true; }
  }
  reset() { this.count = 0; this.trailBudget = 12; this.upload(); }
  dispose() { this.mesh.removeFromParent(); this.geometry.dispose(); this.material.dispose(); }
}
