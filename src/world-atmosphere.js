import * as THREE from 'three';

const TONES={sanctum:['#101727','#687979'],volcano:['#220e12','#a35b39'],tundra:['#152d46','#a6c2d0'],forest:['#0b1a18','#486757'],ruins:['#1b1c2c','#99887a'],void:['#100d24','#674c86'],throne:['#190d24','#88617d']};
/** A local procedural sky and distant silhouettes; reflection assets stay unchanged. */
export class WorldAtmosphere{
 constructor(game){this.game=game;this.time=0;this.uniforms={top:{value:new THREE.Color()},horizon:{value:new THREE.Color()},fogColor:{value:game.scene.fog.color},time:{value:0}};
  this.geometry=new THREE.SphereGeometry(145,32,16);this.material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,depthTest:false,uniforms:this.uniforms,vertexShader:'varying vec3 vDirection;void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 vDirection;uniform vec3 top,horizon,fogColor;uniform float time;
 float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
 void main(){vec3 d=normalize(vDirection);float h=max(0.,d.y);vec3 c=mix(horizon,top,smoothstep(0.,.72,h));float cloud=sin(d.x*21.+sin(d.z*14.)*2.+time*.018)+sin(d.z*32.-time*.012)+sin((d.x+d.z)*57.)*.3;cloud=smoothstep(.2,1.7,cloud)*smoothstep(0.,.18,h)*(1.-smoothstep(.45,.9,h));c=mix(c,horizon*.57,cloud*.32);vec3 moon=normalize(vec3(-.65,.52,-.32));float m=dot(d,moon);c+=vec3(.64,.72,.76)*(smoothstep(.9991,.9996,m)*.7+pow(max(0.,m),90.)*.11);float stars=step(.998,hash(floor(d*270.)))*smoothstep(.15,.6,h);c+=stars*.22; c=mix(fogColor,c,smoothstep(-.04,.16,d.y));gl_FragColor=vec4(c,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  this.sky=new THREE.Mesh(this.geometry,this.material);this.sky.name='Layered nocturnal sky';this.sky.frustumCulled=false;this.sky.renderOrder=-100;this.sky.userData.noStaticBatch=true;game.scene.add(this.sky);
  const positions=[],indices=[];for(let layer=0;layer<2;layer++){const base=positions.length/3,r=layer?166:124;for(let i=0;i<=96;i++){const a=i/96*Math.PI*2,peak=8+Math.sin(i*.37+layer)*5+Math.sin(i*1.13)*4+(layer?8:0);positions.push(Math.cos(a)*r,-17,Math.sin(a)*r,Math.cos(a)*r,peak,Math.sin(a)*r);}for(let i=0;i<96;i++){const at=base+i*2;indices.push(at,at+1,at+2,at+1,at+3,at+2);}}
  this.ridgeGeometry=new THREE.BufferGeometry();this.ridgeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));this.ridgeGeometry.setIndex(indices);this.ridgeGeometry.computeVertexNormals();this.ridgeMaterial=new THREE.MeshBasicMaterial({color:'#34434b',side:THREE.DoubleSide,fog:true});this.ridges=new THREE.Mesh(this.ridgeGeometry,this.ridgeMaterial);this.ridges.userData.noStaticBatch=true;this.ridges.name='Distant broken ridges';game.scene.add(this.ridges);this.setRegion('sanctum');
 }
 setRegion(id){this.id=id;const t=TONES[id]||TONES.sanctum;this.uniforms.top.value.set(t[0]);this.uniforms.horizon.value.set(t[1]);this.ridgeMaterial.color.set(t[1]).multiplyScalar(.43);}
 update(dt){this.time+=dt;this.uniforms.time.value=this.time;this.sky.position.copy(this.game.player.position);this.ridges.visible=!this.game.camp?.active&&!this.game.sideAreas?.active;}
 dispose(){this.sky.removeFromParent();this.ridges.removeFromParent();this.geometry.dispose();this.material.dispose();this.ridgeGeometry.dispose();this.ridgeMaterial.dispose();}
}
