import * as THREE from 'three';

/** Blend stone paths and earth in world space, including their normals and roughness. */
export function createGroundMaterial(presentation) {
  const material = new THREE.MeshStandardMaterial({ color: '#e7e7df', roughness: .9, vertexColors: true, map: presentation.terrainMap, normalMap: presentation.terrainNormal, roughnessMap: presentation.terrainRoughness, normalScale: new THREE.Vector2(.62, .62) });
  material.onBeforeCompile = shader => {
    shader.uniforms.uSoilColor = { value: presentation.soilMap }; shader.uniforms.uSoilSurface = { value: presentation.soilNormalRoughness };
    shader.vertexShader = 'varying vec3 vArtPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvArtPosition=(modelMatrix*vec4(transformed,1.0)).xyz;');
    shader.fragmentShader = 'varying vec3 vArtPosition;uniform sampler2D uSoilColor;uniform sampler2D uSoilSurface;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      float roadDistance=min(abs(vArtPosition.z-sin(vArtPosition.x*.035)*5.0),abs(vArtPosition.x-sin(vArtPosition.z*.03)*5.0));
      float edgeNoise=sin(vArtPosition.x*1.7+cos(vArtPosition.z*.8))*.28+sin(vArtPosition.z*2.3)*.16;
      float road=1.0-smoothstep(1.25,3.3,roadDistance+edgeNoise);
      float spawn=1.0-smoothstep(5.3,6.8,length(vArtPosition.xz)+edgeNoise);
      float along=dot(vArtPosition.xz,vec2(-.5692,-.8222));
      float shrine=(1.0-smoothstep(1.3,2.6,abs(dot(vArtPosition.xz,vec2(.8222,-.5692)))+edgeNoise))*(1.0-smoothstep(17.0,21.0,along))*smoothstep(-1.0,1.0,along);
      float artBlend=clamp(max(max(road,spawn),shrine),0.0,1.0);
      diffuseColor*=mix(texture2D(uSoilColor,vArtPosition.xz*.22),texture2D(map,vMapUv),artBlend);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', 'float roughnessFactor=roughness*mix(texture2D(uSoilSurface,vArtPosition.xz*.22).a,texture2D(roughnessMap,vRoughnessMapUv).g,artBlend);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', THREE.ShaderChunk.normal_fragment_maps.replaceAll('texture2D( normalMap, vNormalMapUv ).xyz', 'mix(texture2D(uSoilSurface,vArtPosition.xz*.22).xyz,texture2D(normalMap,vNormalMapUv).xyz,artBlend)'));
  };
  material.customProgramCacheKey = () => 'sanctum-stone-and-soil-v1';
  return material;
}
