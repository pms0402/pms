import * as THREE from 'three';
import { loadArtAssets } from './art-assets.js';

/** Local PBR assets and small surface maps, without full-screen postprocessing. */
export function createPresentationAssets(renderer) {
  const textures = new Set();
  const track = texture => { textures.add(texture); return texture; };
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const sky = ctx.createLinearGradient(0, 0, 0, 128);
  sky.addColorStop(0, '#c1d2e0'); sky.addColorStop(.45, '#a7b6b5'); sky.addColorStop(.55, '#686f60'); sky.addColorStop(1, '#252b23');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, 256, 128);
  const sun = ctx.createRadialGradient(75, 30, 0, 75, 30, 45);
  sun.addColorStop(0, '#fff4d8'); sun.addColorStop(.2, '#e9e0cb'); sun.addColorStop(1, 'rgba(220,223,213,0)');
  ctx.fillStyle = sun; ctx.fillRect(0, 0, 256, 128);
  const environment = track(new THREE.CanvasTexture(canvas));
  environment.mapping = THREE.EquirectangularReflectionMapping; environment.colorSpace = THREE.SRGBColorSpace;

  const size = 128, color = new Uint8Array(size * size * 4), normals = new Uint8Array(size * size * 4), heights = new Float32Array(size * size);
  let seed = 8923;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const grids = [8, 16, 32].map(n => ({ n, values: Float32Array.from({ length: n * n }, random) }));
  const smooth = t => t * t * (3 - 2 * t);
  const noise = (grid, x, y) => {
    const gx = x / size * grid.n, gy = y / size * grid.n, ix = Math.floor(gx), iy = Math.floor(gy), tx = smooth(gx - ix), ty = smooth(gy - iy);
    const at = (a, b) => grid.values[(b % grid.n) * grid.n + a % grid.n];
    return (at(ix, iy) * (1 - tx) + at(ix + 1, iy) * tx) * (1 - ty) + (at(ix, iy + 1) * (1 - tx) + at(ix + 1, iy + 1) * tx) * ty;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    heights[i] = noise(grids[0], x, y) * .45 + noise(grids[1], x, y) * .30 + noise(grids[2], x, y) * .20 + random() * .05;
    const value = Math.round(239 + (heights[i] - .5) * 28);
    color.set([value, value, value, 255], i * 4);
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x;
    const dx = heights[y * size + (x + 1) % size] - heights[y * size + (x + size - 1) % size];
    const dy = heights[((y + 1) % size) * size + x] - heights[((y + size - 1) % size) * size + x];
    const normal = new THREE.Vector3(-dx, -dy, 1).normalize();
    normals.set([Math.round((normal.x * .5 + .5) * 255), Math.round((normal.y * .5 + .5) * 255), Math.round((normal.z * .5 + .5) * 255), 255], i * 4);
  }
  const texture = (data, extent, srgb, repeat) => {
    const map = track(new THREE.DataTexture(data, extent, extent, THREE.RGBAFormat));
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat);
    map.generateMipmaps = true; map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter;
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); map.needsUpdate = true; return map;
  };
  const metalNormal = texture(normals, size, false, 3);
  const weave = new Uint8Array(64 * 64 * 4);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const value = 230 + ((x % 4 < 2) !== (y % 4 < 2) ? 18 : 0); weave.set([value, value, value, 255], (y * 64 + x) * 4);
  }
  const clothMap = texture(weave, 64, true, 4);
  const contactCanvas = document.createElement('canvas'); contactCanvas.width = contactCanvas.height = 64;
  const contact = contactCanvas.getContext('2d'), gradient = contact.createRadialGradient(32, 32, 4, 32, 32, 31);
  gradient.addColorStop(0, 'rgba(0,0,0,.65)'); gradient.addColorStop(.45, 'rgba(0,0,0,.3)'); gradient.addColorStop(1, 'rgba(0,0,0,0)');
  contact.fillStyle = gradient; contact.fillRect(0, 0, 64, 64);
  const contactMap = track(new THREE.CanvasTexture(contactCanvas));
  const slashPixels = new Uint8Array(128 * 128 * 4);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    const dx = (x + .5) / 64 - 1, dy = (y + .5) / 64 - 1, r = Math.hypot(dx, dy);
    const rim = Math.max(0, Math.min(1, (1.01 - r) / .08)), band = Math.max(0, Math.min(1, (r - .30) / .65));
    const alpha = Math.round(255 * rim * band ** 3 * (.78 + .22 * Math.sin(Math.atan2(dy, dx) * 12 + r * 16) ** 2));
    slashPixels.set([255, 255, 255, alpha], (y * 128 + x) * 4);
  }
  const slashMap = track(new THREE.DataTexture(slashPixels, 128, 128, THREE.RGBAFormat)); slashMap.needsUpdate = true; slashMap.magFilter = slashMap.minFilter = THREE.LinearFilter;
  const art = loadArtAssets(renderer, environment, track);
  return { ...art, clothMap, contactMap, slashMap, metalNormal, ready: art.ready, dispose() { for (const map of textures) map.dispose(); textures.clear(); } };
}
