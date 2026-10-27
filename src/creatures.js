import * as THREE from 'three';
const UP=new THREE.Vector3(0,1,0);
function tools(game,parent) {
 const {geo,mats}=game;
 const part=(shape,material,x,y,z,sx=1,sy=sx,sz=sx)=>{
  const mesh=new THREE.Mesh(geo[shape],material);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
 };
 const link=(material,a,b,radius=.08)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
  const mesh=part('roundCylinder',material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,radius,delta.length(),radius);
  mesh.quaternion.setFromUnitVectors(UP,delta.normalize());return mesh;
 };
 const curve=(material,points,radius=.035)=>{
  const geometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),10,radius,6,false);game.ownedGeometries.add(geometry);
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;parent.add(mesh);return mesh;
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
 const {mats}=game,{part,link,curve,horn}=tools(game,visual);
 const eye=(x,y,z,size=.055)=>{part('round',mats.enemyDark,x,y,z,size*1.5,size*1.2,size*.6);part('roundSmall',mats.eye,x,y,z+size*.45,size,size*.7,size*.45);};
 const face=(y=1.18,z=.18,scale=1)=>{
  part('round',skin,0,y,z,.29*scale,.29*scale,.27*scale);
  part('round',skin,0,y-.13,z+.17*scale,.24*scale,.15*scale,.18*scale);
  eye(-.12*scale,y+.035,z+.245*scale,.05*scale);eye(.12*scale,y+.035,z+.245*scale,.05*scale);
  curve(mats.enemyDark,[[-.14*scale,y-.13,z+.29*scale],[0,y-.17,z+.34*scale],[.14*scale,y-.13,z+.29*scale]],.02*scale);
  for(const side of [-1,1])part('roundCone',mats.bone,side*.13*scale,y-.14,z+.30*scale,.035*scale,.12*scale,.035*scale).rotation.z=Math.PI;
 };
 const humanoid=(bulk=1)=>{
  part('round',skin,0,.78,0,.36*bulk,.43*bulk,.27*bulk);
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
  for(const side of [-1,1]){const ear=part('roundCone',skin,side*.32,1.23,.12,.11,.32,.07);ear.rotation.z=side*-1.05;part('round',skin,side*.36,1.04,.02,.18,.17,.18);}
 }else if(kind===1){
  part('round',skin,0,.59,-.05,.32,.32,.64);part('round',mats.enemyDark,0,.74,-.13,.28,.23,.48);
  part('round',skin,0,.8,.49,.25,.27,.29);part('round',skin,0,.68,.79,.17,.14,.27);part('roundSmall',mats.enemyDark,0,.7,1.02,.09,.065,.055);
  for(const side of [-1,1]){part('roundCone',skin,side*.18,1.09,.40,.12,.29,.1);eye(side*.16,.85,.68,.05);for(const z of [-.43,.36]){link(skin,[side*.24,.53,z],[side*.25,.16,z+.07],.085);part('round',mats.enemyDark,side*.25,.10,z+.14,.115,.095,.18);}}
  curve(skin,[[0,.65,-.58],[0,.8,-.9],[.15,1,-1.13]],.09);
 }else if(kind===2||kind===4){
  const bulk=kind===4?1.65:1.45;humanoid(bulk);face(1.48,.13,1.25);
  part('round',mats.enemyDark,0,.92,.23,.40,.43,.12);
  for(const side of [-1,1]){part('round',mats.enemyDark,side*.53,1.2,0,.30,.22,.32);horn([[side*.27,1.66,.1],[side*.45,1.93,.06],[side*.55,2.1,-.1]],.11);part('round',skin,side*.73,.40,.26,.21,.19,.21);}
  if(kind===4){part('round',mats.bossGlow,0,1.13,.38,.14,.21,.08);for(const side of [-1,1])horn([[side*.55,1.2,-.08],[side*.85,1.43,-.15],[side*1.02,1.38,-.22]],.09);}
 }else if(kind===3||kind===9){
  part('robe',skin,0,.65,0,.58,1.12,.45);
  part('round',skin,0,1.38,-.01,.36,.40,.32);part('round',mats.enemyDark,0,1.36,.25,.24,.26,.10);eye(-.095,1.4,.34,.045);eye(.095,1.4,.34,.045);
  for(const side of [-1,1]){link(skin,[side*.32,1.13,.02],[side*.5,.83,.24],.14);part('round',mats.bone,side*.51,.80,.26,.09,.1,.09);}
  link(mats.trunk,[.66,.1,.21],[.66,2.12,.21],.055);part('round',kind===9?mats.healGlow:mats.rangedGlow,.66,2.17,.21,.17,.20,.17);
  if(kind===9){for(const side of [-1,1])horn([[side*.22,1.58,-.08],[side*.4,1.89,-.12],[side*.28,2.04,-.15]],.065);for(let i=0;i<5;i++)part('roundSmall',mats.bone,(i-2)*.1,1.13-Math.cos((i-2)*.4)*.10,.38,.05,.05,.05);}
 }else if(kind===5){
  part('round',skin,0,.66,-.05,.50,.41,.63);part('round',mats.enemyDark,0,.91,-.14,.35,.21,.48);
  part('round',skin,0,.65,.55,.40,.34,.38);part('round',skin,0,.55,.91,.28,.18,.2);
  for(const side of [-1,1]){part('roundSmall',mats.enemyDark,side*.105,.56,1.09,.055,.045,.03);eye(side*.25,.78,.76,.05);horn([[side*.27,.47,.94],[side*.42,.62,1.04],[side*.40,.87,1.02]],.075);for(const z of [-.4,.32]){link(skin,[side*.33,.45,z],[side*.34,.11,z+.03],.11);part('round',mats.enemyDark,side*.34,.08,z+.1,.14,.08,.18);}}
 }else if(kind===6){
  part('round',skin,0,.60,-.09,.46,.49,.61);part('round',mats.enemyDark,0,.83,-.12,.045,.23,.58);
  part('round',skin,0,.44,.52,.25,.24,.27);part('round',mats.eye,0,.59,.38,.19,.21,.17);
  for(const side of [-1,1]){eye(side*.16,.51,.72,.05);curve(mats.enemyDark,[[side*.12,.6,.67],[side*.22,.87,.84],[side*.34,.96,.91]],.024);for(const z of [-.4,0,.37]){link(mats.enemyDark,[side*.3,.47,z],[side*.65,.39,z+.1],.055);link(mats.enemyDark,[side*.65,.39,z+.1],[side*.78,.06,z+.18],.045);}}
 }else if(kind===7){
  part('round',skin,0,.57,0,.66,.59,.58);
  for(const side of [-1,1]){part('round',skin,side*.43,.23,.05,.3,.23,.34);part('round',mats.bone,side*.17,.73,.49,.11,.14,.065);part('roundSmall',mats.enemyDark,side*.17,.73,.55,.055,.08,.035);}
  curve(mats.enemyDark,[[-.18,.48,.54],[0,.41,.60],[.18,.48,.54]],.026);
 }else if(kind===8){
  const bone=mats.bone;link(bone,[0,.48,0],[0,1.25,0],.07);part('round',bone,0,1.48,.04,.25,.30,.22);
  for(const side of [-1,1]){part('round',mats.enemyDark,side*.10,1.51,.23,.09,.09,.035);part('roundSmall',mats.rangedGlow,side*.10,1.51,.26,.035,.045,.02);link(bone,[side*.15,.50,0],[side*.20,.1,.04],.055);part('round',mats.enemyDark,side*.20,.08,.1,.10,.07,.16);link(bone,[side*.25,1.15,0],[side*.42,.91,.27],.055);link(bone,[side*.42,.91,.27],[side*.60,1.04,.39],.045);}
  for(let row=0;row<4;row++)curve(bone,[[-.23,1.20-row*.12,.05],[0,1.14-row*.12,.21],[.23,1.20-row*.12,.05]],.035);
  curve(mats.trunk,[[.66,.55,.32],[.66,1.03,.63],[.66,1.55,.32]],.045);link(mats.bone,[.66,.55,.32],[.66,1.55,.32],.012);
 }
}

export function createPlayerModel(game) {
 const {geo,mats}=game;
 game.player=new THREE.Group();game.player.scale.setScalar(1.65);game.scene.add(game.player);
 game.playerVisual=new THREE.Group();game.player.add(game.playerVisual);
 const {part}=tools(game,game.playerVisual),armor=mats.armor.clone(),cloth=mats.cape.clone();cloth.side=THREE.DoubleSide;
 armor.color.set('#596571');armor.metalness=.7;armor.roughness=.32;
 game.playerBody=part('torso',armor,0,1.13,0,1,1,.72);
 part('round',armor,0,.83,0,.28,.18,.22);part('round',armor,0,1.19,.18,.29,.29,.11);
 const skin=mats.player.clone();skin.color.set('#c5aa8c');
 part('heroRound',skin,0,1.76,0,.235,.275,.22);
 game.playerHood=part('helmet',cloth,0,1.80,-.015,.275,.315,.255);
 const brow=part('brow',mats.dark,0,1.80,.02,1,1,1);brow.rotation.x=Math.PI/2;
 for(const side of [-1,1]){part('round',mats.dark,side*.085,1.78,.215,.06,.043,.025);part('roundSmall',mats.lime,side*.085,1.785,.237,.032,.022,.015);part('round',armor,side*.19,1.62,.08,.07,.13,.13);}
 part('round',skin,0,1.69,.235,.045,.062,.047);part('round',mats.dark,0,1.59,.173,.09,.04,.04);
 for(const side of [-1,1]){
  const hip=new THREE.Group();hip.position.set(side*.145,.81,0);game.playerVisual.add(hip);
  const upper=new THREE.Mesh(geo.capsule,mats.dark);upper.scale.set(.19,.22,.19);upper.position.y=-.18;hip.add(upper);
  const knee=new THREE.Group();knee.position.y=-.36;hip.add(knee);
  const lower=new THREE.Mesh(geo.capsule,armor);lower.scale.set(.16,.19,.16);lower.position.y=-.14;knee.add(lower);
  const boot=new THREE.Mesh(geo.round,mats.dark);boot.scale.set(.115,.105,.20);boot.position.set(0,-.34,.085);knee.add(boot);
  const cap=new THREE.Mesh(geo.round,armor);cap.scale.set(.115,.10,.085);cap.position.set(0,0,.07);knee.add(cap);
  game[side<0?'legLeft':'legRight']=hip;game[side<0?'kneeLeft':'kneeRight']=knee;
 }
 for(const side of [-1,1]){
  const shoulder=new THREE.Group();shoulder.position.set(side*.37,1.43,0);game.playerVisual.add(shoulder);
  const cap=new THREE.Mesh(geo.round,armor);cap.scale.set(.18,.16,.21);shoulder.add(cap);
  const upper=new THREE.Mesh(geo.capsule,mats.dark);upper.scale.set(.16,.18,.16);upper.position.y=-.15;shoulder.add(upper);
  const elbow=new THREE.Group();elbow.position.y=-.29;shoulder.add(elbow);elbow.rotation.x=-.6;
  const forearm=new THREE.Mesh(geo.capsule,armor);forearm.scale.set(.165,.16,.165);forearm.position.y=-.12;elbow.add(forearm);
  const wrist=new THREE.Group();wrist.position.y=-.25;elbow.add(wrist);
  const hand=new THREE.Mesh(geo.round,mats.dark);hand.scale.set(.085,.10,.09);wrist.add(hand);
  game[side<0?'leftShoulder':'rightShoulder']=shoulder;game[side<0?'leftElbow':'rightElbow']=elbow;
  game[side<0?'offhandGrip':'swordArm']=wrist;
  const grip=new THREE.Mesh(geo.roundCylinder,mats.dark);grip.scale.set(.035,.23,.035);grip.rotation.x=Math.PI/2;grip.position.z=.14;wrist.add(grip);
  const guard=new THREE.Mesh(geo.roundTorus,mats.gold);guard.scale.set(.13,.075,.13);guard.position.z=.29;wrist.add(guard);
  if(side<0){game.offhandParts=[grip,guard];grip.visible=guard.visible=false;}
 }
 const belt=part('roundTorus',mats.dark,0,.84,0,.28,.23,.28);belt.rotation.x=Math.PI/2;
 part('round',mats.gold,0,.85,.225,.065,.055,.025);
 for(const side of [-1,1])part('round',side<0?mats.gold:mats.rangedGlow,side*.29,.77,.04,.055,.095,.055);
 const capeGeometry=new THREE.PlaneGeometry(.78,1.17,10,14),positions=capeGeometry.attributes.position;
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),y=positions.getY(i),t=(.585-y)/1.17;positions.setXYZ(i,x*(.72+.28*t),y,-.06-.055*Math.cos(x*22)*t-.13*t*t);}
 capeGeometry.computeVertexNormals();game.ownedGeometries.add(capeGeometry);game.capeBase=new Float32Array(positions.array);
 game.cape=new THREE.Mesh(capeGeometry,cloth);game.cape.position.set(0,1.04,-.20);game.cape.castShadow=true;game.playerVisual.add(game.cape);
 const bladeMaterial=mats.lime.clone();bladeMaterial.metalness=.75;bladeMaterial.roughness=.24;bladeMaterial.emissiveIntensity=.22;
 game.blade=new THREE.Mesh(geo.blade,bladeMaterial);game.blade.position.set(0,0,.3);game.blade.scale.set(.11,.035,1.15);game.blade.castShadow=true;game.swordArm.add(game.blade);
 game.playerVisual.traverse(mesh=>{if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
}

export function animatePlayerModel(game,time,moving,dt) {
 const gait=moving?Math.sin(time*11):0,attack=game.attackAnim>0,t=attack?1-game.attackAnim/(game.attackAnimTotal||.3):0,swing=attack?Math.sin(t*Math.PI):0;
 game.playerVisual.position.y=moving?Math.abs(gait)*.035:Math.sin(time*2.5)*.012;
 game.legLeft.rotation.x=gait*.48;game.legRight.rotation.x=-gait*.48;
 game.kneeLeft.rotation.x=.08+Math.max(0,-gait)*.5;game.kneeRight.rotation.x=.08+Math.max(0,gait)*.5;
 const blend=1-Math.exp(-dt*18);
 const rightYaw=attack?-1.1+t*2.2:0,rightPitch=attack?-.55-swing*.55:gait*.25;
 game.rightShoulder.rotation.y+=(rightYaw-game.rightShoulder.rotation.y)*blend;game.rightShoulder.rotation.x+=(rightPitch-game.rightShoulder.rotation.x)*blend;
 const twin=game.stats.swordEvolution==='twinblade';game.leftShoulder.rotation.x=twin&&attack?-.55+swing*.7:-gait*.25;game.leftShoulder.rotation.y=twin&&attack?1.1-t*2.2:0;
 game.rightElbow.rotation.x=-.65-swing*.45;game.leftElbow.rotation.x=twin?-.65-swing*.25:-.25;
 game.playerVisual.rotation.y=swing*.14;game.playerVisual.rotation.x=game.dashTime>0?.16:moving?.04:0;
 game.swordArm.rotation.z=-.12+swing*.25;game.cape.rotation.x=-(moving?.25:.08)+Math.sin(time*4)*.025;
 const positions=game.cape.geometry.attributes.position;
 for(let i=0;i<positions.count;i++){const x=game.capeBase[i*3],y=game.capeBase[i*3+1],weight=(.585-y)/1.17;positions.setZ(i,game.capeBase[i*3+2]+Math.sin(time*6+x*15)*.025*weight*weight);}
 positions.needsUpdate=true;
}
