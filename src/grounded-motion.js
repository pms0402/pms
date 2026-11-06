import * as THREE from 'three';
import {damp,angleDelta} from './motion.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smoothStep=t=>{t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);};
const down=new THREE.Vector3(0,-1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),bend=new THREE.Vector3(),q=new THREE.Quaternion();
/** Analytic two-bone chain. Parent space targets keep each joint connected. */
export function solveLimb(upper,lower,end,target,l1,l2,bendDirection=new THREE.Vector3(0,0,1)){
  a.copy(target).sub(upper.position);const length=clamp(a.length(),Math.abs(l1-l2)+.003,l1+l2-.003);a.normalize();
  bend.copy(bendDirection).addScaledVector(a,-bendDirection.dot(a));if(bend.lengthSq()<.001)bend.set(0,0,1);bend.normalize();
  const along=(l1*l1+length*length-l2*l2)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  b.copy(a).multiplyScalar(along).addScaledVector(bend,height);
  upper.quaternion.setFromUnitVectors(down,b.clone().normalize());
  c.copy(a).multiplyScalar(length).sub(b);q.copy(upper.quaternion).invert();c.applyQuaternion(q).normalize();lower.quaternion.setFromUnitVectors(end?end.position.clone().normalize():down,c);
  if(end)end.quaternion.copy(lower.quaternion).invert().multiply(q);
  return length;
}
/** Distance-driven stance/swing phases, planted world-space feet and inertial torso. */
export function groundPlayer(game,state,dt,pose={}){
  const p=game.player,root=game.playerVisual,scale=p.scale.y||1,ground=game.groundHeight?.bind(game)||(()=>0);
  let m=state.ground;
  if(!m){m=state.ground={previous:p.position.clone(),velocity:new THREE.Vector3(),previousVelocity:new THREE.Vector3(),feet:[],vertical:p.position.y,dash:0};}
  const distance=m.previous.distanceTo(p.position),teleport=distance>Math.max(2,game.stats.speed*dt*6),vx=dt>0?(p.position.x-m.previous.x)/dt:0,vz=dt>0?(p.position.z-m.previous.z)/dt:0;
  m.previous.copy(p.position);m.previousVelocity.copy(m.velocity);m.velocity.x=damp(m.velocity.x,teleport?0:vx,12,dt);m.velocity.z=damp(m.velocity.z,teleport?0:vz,12,dt);
  const acceleration=m.velocity.clone().sub(m.previousVelocity).multiplyScalar(1/Math.max(.001,dt)),yaw=p.rotation.y,sin=Math.sin(yaw),cos=Math.cos(yaw);
  m.vertical=teleport?p.position.y:damp(m.vertical,p.position.y,22,dt);root.position.y=(m.vertical-p.position.y)/scale+.008*Math.sin(state.phase*2)*state.stride;
  const forwardAccel=acceleration.x*sin+acceleration.z*cos,sideAccel=acceleration.x*cos-acceleration.z*sin;
  m.dash=damp(m.dash,game.dashTime>0?1:0,game.dashTime>0?28:12,dt);
  const pelvis=game.playerPelvis,upper=game.playerUpper;
  if(pelvis){pelvis.position.y=1.045-state.stride*.13-(pose.brace||0)*.055-m.dash*.10;pelvis.rotation.y=damp(pelvis.rotation.y,(pose.hips||0),22,dt);pelvis.rotation.x=damp(pelvis.rotation.x,clamp(forwardAccel*.003,-.075,.08)+m.dash*.15,15,dt);pelvis.rotation.z=damp(pelvis.rotation.z,clamp(-sideAccel*.003,-.09,.09),15,dt);}
  if(upper){upper.position.y=damp(upper.position.y,1.35-state.stride*.09-m.dash*.06-(pose.brace||0)*.035,20,dt);upper.rotation.y=damp(upper.rotation.y,(pose.torso||0),25,dt);upper.rotation.x=damp(upper.rotation.x,(pose.lean||0)+clamp(forwardAccel*.002,-.05,.06)+m.dash*.18,18,dt);upper.rotation.z=damp(upper.rotation.z,clamp(-sideAccel*.002,-.055,.055),17,dt);}
  root.updateWorldMatrix(true,true);
  const speed=Math.hypot(m.velocity.x,m.velocity.z),moving=Math.hypot(vx,vz)>.12&&!(game.dashTime>0);
  for(let i=0;i<2;i++){
    const hip=i?game.legRight:game.legLeft,knee=i?game.kneeRight:game.kneeLeft,foot=i?game.footRight:game.footLeft,phase=((state.phase/(Math.PI*2)+i*.5)%1+1)%1,stance=phase<.6;
    const neutral=new THREE.Vector3(i?.122:-.122,.035,.035).applyMatrix4(root.matrixWorld);
    const predict=new THREE.Vector3(m.velocity.x,0,m.velocity.z).multiplyScalar(moving?.16:0);if(predict.length()>.42*scale)predict.setLength(.42*scale);neutral.add(predict);
    neutral.y=ground(neutral.x,neutral.z,p.position.y)+.035*scale;
    let f=m.feet[i];
    if(!f||teleport||game.dashTime>0){f=m.feet[i]={plant:neutral.clone(),from:neutral.clone(),target:neutral.clone(),previous:phase,stance:true};}

    const startSwing=!stance&&f.stance,startStance=stance&&!f.stance;
    if(startSwing){f.from.copy(f.plant);f.target.copy(neutral);f.target.y=ground(f.target.x,f.target.z,p.position.y)+.035*scale;}
    if(startStance){f.plant.copy(f.target);}
    const target=f.plant.clone();
    if(!stance&&moving){const t=(phase-.6)/.4;target.lerpVectors(f.from,f.target,smoothStep(t));target.y+=Math.sin(Math.PI*t)**2*(.16+.025*speed)*scale;}
    if(f.plant.distanceTo(neutral)>1.2*scale){f.plant.copy(neutral);f.from.copy(neutral);f.target.copy(neutral);target.copy(neutral);}
    if(!moving){if(!f.restFrom){f.restFrom=f.world?.clone()||f.plant.clone();f.restTime=0;}f.restTime+=dt;target.lerpVectors(f.restFrom,neutral,smoothStep(f.restTime/.20));f.plant.copy(target);}else{f.restFrom=null;f.restTime=0;}
    f.stance=stance||!moving;f.previous=phase;f.world=target.clone();
    hip.parent.updateWorldMatrix(true,false);hip.parent.worldToLocal(target);solveLimb(hip,knee,foot,target,.47,.55);
    // Boots conform to the local ground normal without twisting the knee.
    const h=.16,dx=ground(f.world.x+h,f.world.z,p.position.y)-ground(f.world.x-h,f.world.z,p.position.y),dz=ground(f.world.x,f.world.z+h,p.position.y)-ground(f.world.x,f.world.z-h,p.position.y);
    if(stance&&Math.max(Math.abs(dx),Math.abs(dz))<.26){const normal=new THREE.Vector3(-dx,2*h,-dz).normalize(),worldQ=new THREE.Quaternion();foot.parent.getWorldQuaternion(worldQ);const facing=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);foot.quaternion.copy(worldQ.invert()).multiply(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),normal)).multiply(facing);}
  }
  state.footSlip=Math.max(...m.feet.map(f=>f.stance?f.world.distanceTo(f.plant):0));
}
