import * as THREE from 'three';
const UP=new THREE.Vector3(0,1,0);

/** Extra anatomy is baked into each cached enemy template, never rebuilt per spawn. */
export function decorateMonster(game,visual,kind,skin) {
 const {geo,mats}=game;
 const mesh=(shape,material,x,y,z,sx,sy=sx,sz=sx)=>{
  const m=new THREE.Mesh(geo[shape],material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;visual.add(m);return m;
 };
 const bone=(a,b,width=.075,material=mats.bone)=>{
  const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
  const m=mesh('box',material,(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,width,d.length(),width);m.quaternion.setFromUnitVectors(UP,d.normalize());return m;
 };
 const ribs=(height=.85)=>{
  mesh('box',mats.organ,0,height,.53,.28,.75,.09);
  for(let row=0;row<4;row++)for(const side of [-1,1]){
   const y=height+.27-row*.17;bone([side*.05,y,.58],[side*.28,y+.07,.63],.065);bone([side*.28,y+.07,.63],[side*.43,y-.035,.44],.065);
  }
  bone([0,height-.4,.55],[0,height+.4,.55],.09);
 };
 const mouth=(y=1.04,z=.68,width=.38)=>{
  mesh('sphere',mats.enemyDark,0,y,z,width,.3,.12);
  for(let i=0;i<7;i++){
   const x=(i-3)*width*.23;
   const tooth=mesh('cone',mats.bone,x,y+.15+Math.abs(i-3)*.015,z+.08,.24,.24+(i%2)*.12,.24);tooth.rotation.z=Math.PI;
   mesh('cone',mats.bone,x,y-.19,z+.08,.2,.17,.2);
  }
  bone([-width,y-.23,z],[width,y-.23,z],.1);
 };
 const claws=(side,y=.6,length=.55)=>{
  bone([side*.57,y+.45,.05],[side*.86,y,.28],.13,skin);
  mesh('sphere',skin,side*.86,y,.28,.19,.15,.2);
  for(let finger=0;finger<3;finger++){
   const x=side*.86+(finger-1)*.13;
   bone([x,y,.36],[x+side*.06,y-.1,.36+length*.55],.055);
   bone([x+side*.06,y-.1,.36+length*.55],[x+side*.04,y-.23,.36+length],.04);
  }
 };
 if([0,1,2,4,8,9].includes(kind)){
  ribs(kind===8?1.03:.85);mouth(kind===4?1.25:1.05,kind===8?.57:.68,kind===2||kind===4?.48:.36);
  for(const side of [-1,1]){
   bone([side*.3,.4,.02],[side*.34,.11,.32],.13,skin);
   for(let i=0;i<3;i++)bone([side*.34+(i-1)*.1,.12,.3],[side*.34+(i-1)*.13,.05,.66],.045);
  }
 }
 if([0,1,2,4].includes(kind))for(const side of [-1,1])claws(side,kind===1?.5:.7,kind===1?.78:.5);
 if(kind===0){
  mesh('monster',skin,-.35,1.45,-.24,.45,.48,.5);
  for(let i=0;i<4;i++)mesh('cone',mats.bone,-.32+i*.2,1.35,-.33,.4,.5+(i%2)*.3,.4).rotation.x=-.7;
 }else if(kind===1){
  for(let i=0;i<5;i++){const spine=mesh('cone',mats.bone,0,1.25+i*.1,-.12-i*.16,.4,.65,.4);spine.rotation.x=-.7;}
  bone([0,.65,-.4],[0,.2,-1.1],.1);bone([0,.2,-1.1],[0,.5,-1.55],.065);
 }else if(kind===2||kind===4){
  for(const side of [-1,1]){
   bone([side*.4,1.45,0],[side*.65,2,.02],.14);bone([side*.65,2,.02],[side*.95,2.3,-.13],.1);
   if(kind===4){bone([side*.65,2,.02],[side*.46,2.4,.05],.09);bone([side*.8,2.18,-.06],[side*1.15,2.1,-.22],.08);}
   mesh('monster',mats.enemyDark,side*.67,1.1,-.02,.4,.3,.38);
   mesh('sphere',mats.organ,side*.28,.9,.58,.15,.32,.1);
  }
  mesh('sphere',mats.eye,0,1.55,.57,.13,.18,.07);
 }else if(kind===3){
  mouth(1.05,.57,.28);
  for(let i=0;i<5;i++){const x=(i-2)*.19;bone([x,.85,0],[x*1.2,.3,.15],.1,skin);bone([x*1.2,.3,.15],[x*1.5,.05,.42],.065);}
  mesh('sphere',mats.bone,.75,1.75,.08,.32,.35,.28);mesh('sphere',mats.enemyDark,.75,1.8,.32,.22,.11,.06);
 }else if(kind===5){
  mouth(.65,.85,.48);
  for(const side of [-1,1]){bone([side*.4,.6,.85],[side*.62,.65,1.2],.13);bone([side*.62,.65,1.2],[side*.65,.98,1.25],.08);}
  for(let i=0;i<4;i++)mesh('cone',mats.bone,0,1.23,-.45+i*.27,.6,.75,.6);
 }else if(kind===6){
  for(let i=0;i<9;i++){const a=i/9*Math.PI*2;mesh('monster',i%2?mats.organ:mats.eye,Math.cos(a)*.72,.65+(i%3)*.25,Math.sin(a)*.65,.24,.3,.25);}
  mouth(1,.68,.3);bone([0,1.4,0],[.25,1.9,-.2],.08);
 }else if(kind===7){
  for(const side of [-1,1]){
   mesh('sphere',mats.organ,side*.65,.58,.5,.35,.45,.23);
   for(let i=0;i<3;i++){mesh('sphere',mats.bone,side*(.45+i*.2),1.1,.2,.16,.18,.15);mesh('sphere',mats.eye,side*(.45+i*.2),1.12,.34,.065,.08,.035);}
   for(let i=0;i<3;i++)bone([side*.7,.5,-.1+i*.2],[side*(1.25+i*.08),.06,.2+i*.2],.08,skin);
  }
  mouth(.7,.76,.45);
 }else if(kind===8){
  mesh('sphere',mats.bone,0,1.65,.08,.25,.4,.23);mesh('sphere',mats.eye,0,1.75,.3,.16,.16,.08);
  bone([-.2,1.85,0],[-.5,2.35,-.2],.065);bone([.2,1.85,0],[.45,2.2,-.1],.065);
  for(let i=0;i<4;i++)mesh('box',mats.bone,.68,1.02,.1+i*.35,.22,.3,.08);
 }else if(kind===9){
  for(let i=0;i<5;i++)mesh('cone',mats.bone,(i-2)*.18,1.95+Math.abs(i-2)*.08,0,.35,.65,.35).rotation.z=(i-2)*-.18;
  for(const side of [-1,1]){bone([side*.35,1.25,.15],[side*.75,.75,.35],.1);mesh('sphere',mats.organ,side*.55,.8,.4,.16,.24,.16);}
 }
}

export function decoratePlayer(game) {
 const {playerVisual:v,geo,mats}=game;
 const box=(m,x,y,z,sx,sy,sz)=>game.box(m,x,y,z,sx,sy,sz,v);
 const add=(shape,m,x,y,z,sx,sy=sx,sz=sx)=>{const mesh=new THREE.Mesh(geo[shape],m);mesh.position.set(x,y,z);mesh.scale.set(sx,sy,sz);mesh.castShadow=true;v.add(mesh);return mesh;};
 // Plague-knight mask, a ribbed breastplate, belt tools and layered pauldrons.
 add('monster',mats.bone,0,1.48,.23,.43,.38,.22);
 box(mats.dark,0,1.54,.4,.48,.13,.06);
 for(const side of [-1,1]){
  add('sphere',mats.lime,side*.13,1.55,.45,.055,.04,.025);
  box(mats.dark,side*.46,1.2,0,.36,.22,.5).rotation.z=side*.25;
  add('cone',mats.bone,side*.54,1.45,0,.55,.45,.55).rotation.z=side*-.35;
  box(mats.bone,side*.16,.94,.26,.06,.55,.045).rotation.z=side*.3;
  box(mats.dark,side*.22,.16,.13,.29,.24,.45);
  add('sphere',side<0?mats.gold:mats.rangedGlow,side*.38,.62,.2,.08,.14,.08);
 }
 add('cone',mats.dark,0,1.4,.5,.5,.4,.5).rotation.x=Math.PI/2;
 box(mats.bone,0,1.17,.29,.29,.08,.06);box(mats.bone,0,1,.29,.34,.07,.06);box(mats.bone,0,.83,.29,.29,.06,.06);
 box(mats.dark,0,.58,.02,.78,.13,.5);box(mats.gold,0,.59,.3,.17,.16,.055);
 for(let i=0;i<4;i++){const strip=box(game.playerHood.material,(i-1.5)*.19,.32,-.35,.2,.45+(i%2)*.15,.07);strip.rotation.x=-.18;}
 const bladeGuard=game.box(mats.bone,.05,-.1,.65,.55,.1,.13,game.swordArm);bladeGuard.rotation.y=.1;
 game.box(mats.gold,.05,-.1,.15,.13,.15,.15,game.swordArm);
}
