import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
/** Original geometric sigil, no textures or external art. */
export function createRuneGeometry(evolved=false){
 const parts=[new THREE.TorusGeometry(.3,.018,4,24)];
 const beam=(x,y,length,angle)=>{const g=new THREE.BoxGeometry(.018,length,.018);g.rotateZ(angle);g.translate(x,y,0);parts.push(g);};
 beam(0,0,.42,0);beam(-.075,.06,.22,-.7);beam(.075,-.06,.22,-.7);
 for(let i=0;i<(evolved?8:4);i++){const a=i*Math.PI*2/(evolved?8:4);beam(Math.sin(a)*.35,Math.cos(a)*.35,.08,-a);}
 if(evolved)parts.push(new THREE.TorusGeometry(.41,.012,3,32));
 const g=mergeGeometries(parts.map(p=>p.toNonIndexed()),false);parts.forEach(p=>p.dispose());return g;
}
