import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import courtyardColor from './assets/art/courtyard-color.webp';
import masonryColor from './assets/art/masonry-color.webp';
import courtyardNormal from './assets/art/courtyard-normal.webp';
import courtyardRoughness from './assets/art/courtyard-roughness.webp';
import dawnEnvironment from './assets/art/dawn-environment.hdr?url';
import soilColor from './assets/art/soil-color.webp';
import soilSurface from './assets/art/soil-surface.webp';

/** Local PBR assets, also inlined by the standalone build. */
export function loadArtAssets(renderer, fallbackEnvironment, track) {
  const status = { loaded: 0, failed: 0 }, promises = [], loader = new THREE.TextureLoader();
  const placeholder = color => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 2;
    const ctx = canvas.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0, 0, 2, 2); return canvas;
  };
  const load = (url, srgb, repeat, color) => {
    let resolve; const ready = new Promise(done => { resolve = done; }); promises.push(ready);
    const fallback = placeholder(color);
    const map = track(loader.load(url, () => { status.loaded++; resolve(); }, undefined, () => { status.failed++; map.image = fallback; map.needsUpdate = true; resolve(); }));
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(repeat, repeat);
    map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return map;
  };
  const terrainMap = load(courtyardColor, true, 42, '#56534b');
  const terrainNormal = load(courtyardNormal, false, 42, '#8080ff');
  const terrainRoughness = load(courtyardRoughness, false, 42, '#b0b0b0');
  const stoneMap = load(masonryColor, true, 1, '#62676b');
  const stoneNormal = track(terrainNormal.clone()); stoneNormal.repeat.set(1, 1);
  const stoneRoughness = track(terrainRoughness.clone()); stoneRoughness.repeat.set(1, 1);
  const soilMap = load(soilColor, true, 1, '#534d41'), soilNormalRoughness = load(soilSurface, false, 1, '#8080ff');
  const art = { terrainMap, terrainNormal, terrainRoughness, stoneMap, stoneNormal, stoneRoughness, soilMap, soilNormalRoughness, environment: fallbackEnvironment, status };
  promises.push(new Promise(resolve => {
    new HDRLoader().load(dawnEnvironment, texture => {
      texture.mapping = THREE.EquirectangularReflectionMapping; art.environment = track(texture); status.loaded++; resolve();
    }, undefined, () => { status.failed++; resolve(); });
  }));
  art.ready = Promise.all(promises).then(() => { stoneNormal.needsUpdate = true; stoneRoughness.needsUpdate = true; return art; });
  return art;
}
