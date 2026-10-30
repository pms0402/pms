import * as THREE from 'three';
import { monsterJoint } from './monster-motion.js';
import { damp, angleDelta, createActorMotion, advanceActorMotion, swordSwing } from './motion.js';
import { swordPoseProgress } from './action-combat.js';
const UP=new THREE.Vector3(0,1,0);
function tools(game,parent,kind) {
 const {geo,mats}=game;
 const part=(shape,material,x,y,z,sx=1,sy=sx,sz=sx)=>{
  const mesh=new THREE.Mesh(geo[shape],material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.rigJoint=monsterJoint(kind,x,y,z);parent.add(mesh);return mesh;
 };
 const link=(material,a,b,radius=.08)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const mesh=part('roundCylinder',material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,radius,delta.length(),radius);
  mesh.quaternion.setFromUnitVectors(UP,delta.normalize());return mesh;
 };
 const curve=(material,points,radius=.035)=>{
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),10,radius,6,false);game.ownedGeometries.add(geometry);
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;const c=points.reduce((v,p)=>v.add(new THREE.Vector3(...p)),new THREE.Vector3()).multiplyScalar(1/points.length);mesh.userData.rigJoint=monsterJoint(kind,c.x,c.y,c.z);parent.add(mesh);return mesh;
 };
 const horn=(points,radius=.1)=>{
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],delta=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
   const mesh=part('roundTaper',mats.bone,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,radius*(1-(i-1)/points.length),delta.length(),radius*(1-(i-1)/points.length));mesh.quaternion.setFromUnitVectors(UP,delta.normalize());
  }
 };
 return {part,link,curve,horn};
}

/** Cohesive monster silhouettes built once and merged by material by the engine. */
export function buildMonster(game,visual,kind,skin) {
 const {mats}=game,{part,link,curve,horn}=tools(game,visual,kind);
 const eye=(x,y,z,size=.055)=>{part('round',mats.enemyDark,x,y,z,size*1.55,size*.78,size*.6);part('roundSmall',mats.eye,x,y,z+size*.45,size*.9,size*.30,size*.36);const brow=part('roundTaper',skin,x,y+size*.85,z+.012,size*.65,size*3,size*.8);brow.rotation.z=(x<0?-1:1)*1.02;};
 const face=(y=1.18,z=.18,scale=1)=>{
  const start=visual.children.length;
  part('organicSkull',skin,0,y,z,.29*scale,.31*scale,.27*scale);
  part('organicSkull',skin,0,y-.15,z+.13*scale,.22*scale,.14*scale,.15*scale);
  eye(-.12*scale,y+.035,z+.245*scale,.05*scale);eye(.12*scale,y+.035,z+.245*scale,.05*scale);
  curve(mats.enemyDark,[[-.14*scale,y-.13,z+.29*scale],[0,y-.17,z+.34*scale],[.14*scale,y-.13,z+.29*scale]],.02*scale);
  for(const side of [-1,1])part('roundCone',mats.bone,side*.13*scale,y-.14,z+.30*scale,.035*scale,.12*scale,.035*scale).rotation.z=Math.PI;
  for(let i=start;i<visual.children.length;i++)visual.children[i].userData.rigJoint=1;
 };
 const humanoid=(bulk=1)=>{
  part('organicTorso',skin,0,.78,0,.36*bulk,.43*bulk,.27*bulk);
  part('round',skin,0,.4,0,.27*bulk,.19,.22*bulk);
  for(const side of [-1,1]){
   link(skin,[side*.19*bulk,.4,0],[side*.23*bulk,.12,.06],.11*bulk);
   part('round',mats.enemyDark,side*.23*bulk,.10,.13,.14*bulk,.10,.22);
   link(skin,[side*.33*bulk,1.0,0],[side*.54*bulk,.64,.08],.12*bulk);
   link(skin,[side*.54*bulk,.64,.08],[side*.55*bulk,.37,.24],.095*bulk);
   part('round',skin,side*.55*bulk,.35,.25,.13*bulk,.13,.14);
  }
  const belt=part('roundTorus',mats.enemyDark,0,.47,0,.3*bulk,.3*bulk,.3*bulk);belt.rotation.x=Math.PI/2;
 };
 if(kind===0){
  humanoid();face();
  part('roundTaper',skin,0,1.12,.42,.06,.24,.11).rotation.x=-.8;
  for(const side of [-1,1]){const ear=part('roundCone',skin,side*.32,1.23,.12,.11,.32,.07);ear.rotation.z=side*-1.05;part('round',skin,side*.36,1.04,.02,.18,.17,.18);}
 }else if(kind===1){
  part('round',skin,0,.59,-.05,.32,.32,.64);part('round',mats.enemyDark,0,.74,-.13,.28,.23,.48);
  part('round',skin,0,.8,.49,.25,.27,.29);part('round',skin,0,.68,.79,.17,.14,.27);part('roundSmall',mats.enemyDark,0,.7,1.02,.09,.065,.055);
  for(const side of [-1,1]){part('roundCone',skin,side*.18,1.09,.40,.12,.29,.1);eye(side*.16,.85,.68,.05);for(const z of [-.43,.36]){link(skin,[side*.24,.53,z],[side*.25,.16,z+.07],.085);part('round',mats.enemyDark,side*.25,.10,z+.14,.115,.095,.18);}}
  curve(skin,[[0,.65,-.58],[0,.8,-.9],[.15,1,-1.13]],.09);
  for(const side of [-1,1])horn([[side*.13,.7,.87],[side*.16,.56,.98],[side*.12,.48,.94]],.035);
  for(let i=0;i<4;i++)part('roundCone',mats.enemyDark,0,.88,-.42+i*.19,.08,.28,.12).rotation.x=-.4;
 }else if(kind===2||kind===4){
  const bulk=kind===4?1.65:1.45;humanoid(bulk);face(1.48,.13,1.25);
  part('round',mats.enemyDark,0,.92,.23,.40,.43,.12);
  for(const side of [-1,1]){part('carapace',mats.enemyDark,side*.53,1.2,0,.30,.18,.32);horn([[side*.27,1.66,.1],[side*.45,1.93,.06],[side*.55,2.1,-.1]],.11);part('round',skin,side*.73,.40,.26,.21,.19,.21);}
  if(kind===4){part('round',mats.bossGlow,0,1.13,.38,.14,.21,.08);horn([[0,1.78,-.03],[0,2.2,-.12],[0,2.55,-.32]],.15);for(const side of [-1,1]){horn([[side*.55,1.2,-.08],[side*.85,1.43,-.15],[side*1.02,1.38,-.22]],.09);for(let i=0;i<3;i++)link(mats.bone,[side*.12,1.12-i*.17,.34],[side*.37,1.02-i*.17,.27],.034);}}
 }else if(kind===3||kind===9){
  part('robe',skin,0,.65,0,.58,1.12,.45);
  part('organicSkull',skin,0,1.38,-.01,.36,.44,.32);part('round',mats.enemyDark,0,1.36,.25,.24,.26,.10);eye(-.095,1.4,.34,.045);eye(.095,1.4,.34,.045);
  for(const side of [-1,1]){link(skin,[side*.32,1.13,.02],[side*.5,.83,.24],.14);part('round',mats.bone,side*.51,.80,.26,.09,.1,.09);}
  link(mats.trunk,[.66,.1,.21],[.66,2.12,.21],.055);part('round',kind===9?mats.healGlow:mats.rangedGlow,.66,2.17,.21,.17,.20,.17);
  if(kind===9){for(const side of [-1,1])horn([[side*.22,1.58,-.08],[side*.4,1.89,-.12],[side*.28,2.04,-.15]],.065);for(let i=0;i<5;i++)part('roundSmall',mats.bone,(i-2)*.1,1.13-Math.cos((i-2)*.4)*.10,.38,.05,.05,.05);}
 }else if(kind===5){
  part('round',skin,0,.66,-.05,.50,.41,.63);part('carapace',mats.enemyDark,0,.91,-.14,.35,.21,.48);
  part('round',skin,0,.65,.55,.40,.34,.38);part('round',skin,0,.55,.91,.28,.18,.2);
  for(const side of [-1,1]){part('roundSmall',mats.enemyDark,side*.105,.56,1.09,.055,.045,.03);eye(side*.25,.78,.76,.05);horn([[side*.27,.47,.94],[side*.42,.62,1.04],[side*.40,.87,1.02]],.075);for(const z of [-.4,.32]){link(skin,[side*.33,.45,z],[side*.34,.11,z+.03],.11);part('round',mats.enemyDark,side*.34,.08,z+.1,.14,.08,.18);}}
 }else if(kind===6){
  part('carapace',skin,0,.60,-.09,.46,.49,.61);part('round',mats.enemyDark,0,.83,-.12,.045,.23,.58);
  part('round',skin,0,.44,.52,.25,.24,.27);part('round',mats.eye,0,.59,.38,.19,.21,.17);
  for(const side of [-1,1]){eye(side*.16,.51,.72,.05);curve(mats.enemyDark,[[side*.12,.6,.67],[side*.22,.87,.84],[side*.34,.96,.91]],.024);for(const z of [-.4,0,.37]){link(mats.enemyDark,[side*.3,.47,z],[side*.65,.39,z+.1],.055);link(mats.enemyDark,[side*.65,.39,z+.1],[side*.78,.06,z+.18],.045);}}
 }else if(kind===7){
  part('gel',skin,0,.57,0,.66,.59,.58);
  for(const side of [-1,1]){part('round',skin,side*.43,.23,.05,.3,.23,.34);part('round',mats.bone,side*.17,.73,.49,.11,.14,.065);part('roundSmall',mats.enemyDark,side*.17,.73,.55,.055,.08,.035);}
  curve(mats.enemyDark,[[-.18,.48,.54],[0,.41,.60],[.18,.48,.54]],.026);
 }else if(kind===8){
  const bone=mats.bone;link(bone,[0,.48,0],[0,1.25,0],.07);part('organicSkull',bone,0,1.48,.04,.25,.30,.22);curve(bone,[[-.17,1.37,.12],[-.13,1.22,.16],[.13,1.22,.16],[.17,1.37,.12]],.04);
  for(const side of [-1,1]){part('round',mats.enemyDark,side*.10,1.51,.23,.09,.09,.035);part('roundSmall',mats.rangedGlow,side*.10,1.51,.26,.035,.045,.02);link(bone,[side*.15,.50,0],[side*.20,.1,.04],.055);part('round',mats.enemyDark,side*.20,.08,.1,.10,.07,.16);link(bone,[side*.25,1.15,0],[side*.42,.91,.27],.055);link(bone,[side*.42,.91,.27],[side*.60,1.04,.39],.045);}
  for(let row=0;row<4;row++)curve(bone,[[-.23,1.20-row*.12,.05],[0,1.14-row*.12,.21],[.23,1.20-row*.12,.05]],.035);
  curve(mats.trunk,[[.66,.55,.32],[.66,1.03,.63],[.66,1.55,.32]],.045);link(mats.bone,[.66,.55,.32],[.66,1.55,.32],.012);
 }
}

export { createPlayerModel } from './player-model.js';

export function animatePlayerModel(game,time,moving,dt) {
 const state=game.playerMotion||(game.playerMotion=createActorMotion(game.player));
 const dashing=game.dashTime>0;
 advanceActorMotion(state,game.player,dt,game.stats.speed,moving&&!dashing);
 const manualAction=game.actions?.current?.type==='sword'?game.actions.current:null;const counter=manualAction?manualAction.counter:game.counterAnim>0;
 if(manualAction)state.facing=game.player.rotation.y;
 const stride=state.stride,gait=Math.sin(state.phase)*stride,attack=game.attackAnim>0||counter,first=game.view?.firstPerson(),pitch=first?game.view.pitch.first:0;
 const t=manualAction?swordPoseProgress(manualAction):counter?1-game.counterAnim/.38:attack?1-game.attackAnim/(game.attackAnimTotal||.3):0;
 const ready=game.swordReady||0,heavy=game.actions?.current?.heavy||game.stats.weaponId==='greatsword'||game.stats.swordEvolution==='broadsword',cast=Math.sin(Math.max(0,game.playerCastTime||0)/.3*Math.PI),swing=attack?Math.sin(Math.PI*t)**2:ready*.22,side=counter?1:attack?(game.swingSide||1):-(game.swingSide||-1),yaw=(attack?swordSwing(t):-.72*ready)*side*(counter?1.3:heavy?1.12:1);
 // Faster weapons retain their full stroke rather than losing it to a slow filter.
 const armRate=attack?Math.max(24,5/(game.attackAnimTotal||.3)):18;
 const joint=(part,axis,target,rate=18)=>{part.rotation[axis]=damp(part.rotation[axis],target,rate,dt);};
 game.playerVisual.position.y=damp(game.playerVisual.position.y,(1-Math.cos(state.phase*2))*.018*stride+Math.sin(time*2.5)*.012*(1-stride),18,dt);
 joint(game.legLeft,'x',gait*.48);joint(game.legRight,'x',-gait*.48);
 joint(game.kneeLeft,'x',.08+Math.max(0,-Math.sin(state.phase))**2*.5*stride);
 joint(game.kneeRight,'x',.08+Math.max(0,Math.sin(state.phase))**2*.5*stride);
 joint(game.footLeft,'x',-(game.legLeft.rotation.x+game.kneeLeft.rotation.x)*.65);
 joint(game.footRight,'x',-(game.legRight.rotation.x+game.kneeRight.rotation.x)*.65);
 const cut=manualAction?.finisher?-.24:manualAction?.comboIndex%2?.18:0;
 joint(game.rightShoulder,'z',cut*swing,armRate);
 joint(game.rightShoulder,'y',game.parry?.active>0?-.3:yaw,armRate);joint(game.rightShoulder,'x',game.parry?.active>0?-1.1:first?-.45-swing*.45+pitch*.65:gait*.25-swing*(manualAction?.finisher?1.3:1.05),armRate);
 const twin=game.stats.swordEvolution==='twinblade'||game.stats.weaponId==='tempest';
 joint(game.leftShoulder,'z',heavy?swing*.95:0,armRate);
 joint(game.leftShoulder,'x',(first?-.45+(twin?-swing*.45:0)+pitch*.65:-gait*.25+(twin?swing*.4:-swing*.16))-(twin?0:cast*.8),armRate);joint(game.leftShoulder,'y',twin?-yaw:0,armRate);
 joint(game.rightElbow,'x',game.parry?.active>0?-1.5:first?-.75+swing*.45:-.65+swing*.38,armRate);joint(game.leftElbow,'x',first?-.75+(twin?swing*.45:0):twin?-.65-swing*.25:-.25,armRate);
 // Counter-rotate only the artwork; targeting, sword sectors and dashes stay exact.
 game.playerVisual.rotation.y=first?angleDelta(game.player.rotation.y,game.view.yaw):(manualAction?0:angleDelta(game.player.rotation.y,state.facing))+yaw*.14;
 joint(game.playerVisual,'x',(dashing?.22:counter?.1:stride*.04)+(game.playerHitTime||0)*.65,14);joint(game.playerVisual,'z',-gait*.025+side*swing*(heavy?.075:.045),14);
 joint(game.swordArm,'z',-.12+side*swing*.36,armRate);joint(game.swordArm,'x',first?.65+pitch*.35-yaw*.18:(attack?.6:0)-yaw*.18,armRate);joint(game.offhandGrip,'x',first?.65+pitch*.35+yaw*.18:0,armRate);
 joint(game.offhandGrip,'z',twin?.12-swing*.25:0,armRate);
 game.cape.rotation.x=damp(game.cape.rotation.x,-(.08+stride*.17+(dashing?.22:0))+Math.sin(time*4)*.025,9,dt);
 for(const cloth of game.clothParts){
  const positions=cloth.mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++){
   const x=cloth.base[i*3],weight=cloth.weights[i];
   positions.setZ(i,cloth.base[i*3+2]+(Math.sin(time*5.2+x*12+cloth.phase)*(.012+stride*.018)+Math.sin(state.phase+cloth.phase)*stride*.025)*weight);
   positions.setX(i,x+Math.sin(time*3.1+cloth.phase)*.009*weight);
  }
  positions.needsUpdate=true;
 }
 for(let i=0;i<game.hairLocks.length;i++){
  const hair=game.hairLocks[i];
  joint(hair,'x',-.025-stride*.055+Math.sin(time*3+i*.8)*.018,8);
  joint(hair,'z',Math.sin(time*2.7+i)*.018+gait*.028,8);
 }
 game.swordTrail?.sample();
}

/** GPU joint poses follow real travel and real attack events, without moving colliders. */
export function animateEnemyModel(enemy,time,dt) {
 const state=enemy.motion||(enemy.motion=createActorMotion(enemy.group,enemy.seed));
 if((enemy.freezeTime||0)>0||(enemy.parryStun||0)>0)return;
 const kind=enemy.visualKind??enemy.kind,isBoss=enemy.kind===4,action=enemy.mode||enemy.action||'';
 enemy.impactTime=Math.max(0,(enemy.impactTime||0)-dt);
 const locked=action.includes('warning')||(enemy.windup||0)>0;
 advanceActorMotion(state,enemy.group,dt,enemy.speed,!locked,(kind===1?2.6:1.7)/Math.max(.7,enemy.size));
 enemy.visualAttack=Math.max(0,(enemy.visualAttack||0)-dt);enemy.visualCast=Math.max(0,(enemy.visualCast||0)-dt);enemy.visualAttackCooldown=Math.max(0,(enemy.visualAttackCooldown||0)-dt);
 const strike=enemy.visualAttack>0?swordSwing(1-enemy.visualAttack/.36):0,cast=enemy.visualCast>0?Math.sin(Math.PI*(1-enemy.visualCast/.35)):0;
 const warning=locked?1:0;state.warning=damp(state.warning||0,warning,16,dt);state.strike=damp(state.strike||0,strike,24,dt);state.cast=damp(state.cast||0,cast,24,dt);
 state.pose||=new Float32Array(8);state.pose[0]=state.phase;state.pose[1]=state.stride;state.pose[2]=state.strike;state.pose[3]=state.warning;state.pose[4]=state.cast;state.pose[5]=Math.max(0,enemy.hitTime||0);state.pose[6]=Math.sin(time*.8+enemy.seed);state.pose[7]=Math.sin(time*2.8+enemy.seed);
 const stride=state.stride,beat=Math.sin(state.phase),bounce=(1-Math.cos(state.phase*2))*.5*stride,slime=kind===7,beast=kind===1||kind===5;
 const height=isBoss?.025:beast?.045:slime?.11:.045;
 enemy.visual.position.y=damp(enemy.visual.position.y,bounce*height+(1-stride)*(.5+.5*Math.sin(time*2.8+enemy.seed))*.012,18,dt);
 enemy.visual.rotation.y=angleDelta(enemy.group.rotation.y,state.facing);
 const lean=action==='rush'||action==='charge'?.17:state.warning*(beast?.13:.06)+state.strike*.06;
 const reaction=enemy.impactTime?Math.sin(enemy.impactTime/.16*Math.PI)*(isBoss?.035:.16):0,impact=enemy.impactDirection;
 enemy.visual.rotation.x=damp(enemy.visual.rotation.x,lean+(beast?beat*.025*stride:0)+reaction*(impact?Math.cos(enemy.group.rotation.y)*impact.z+Math.sin(enemy.group.rotation.y)*impact.x:0),18,dt);
 enemy.visual.rotation.z=damp(enemy.visual.rotation.z,beast?0:beat*.027*stride,16,dt);
 const hit=Math.max(0,enemy.hitTime||0),scale=1+(isBoss?Math.min(.04,hit*.6):Math.min(.16,hit*.6));
 const squash=slime?Math.sin(state.phase*2)*stride*.09:kind===6?state.warning*(.045+.025*Math.sin(time*10)):0;
 enemy.visual.scale.x=damp(enemy.visual.scale.x,scale-squash*.5,24,dt);enemy.visual.scale.y=damp(enemy.visual.scale.y,scale+squash,24,dt);enemy.visual.scale.z=damp(enemy.visual.scale.z,scale-squash*.5,24,dt);
}
