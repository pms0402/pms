export const BOSS_STYLES=Object.freeze({warden:1,artillery:2,plague:3,brood:4,storm:5,reaper:6,king:7,observer:8,primordial:9});
/** Small authored anatomical offsets, shared by CPU and instanced/death shaders. */
export function bossJointOffset(j,p,out){
  const s=p[12],a=p[2],w=p[3],c=p[4],stride=p[1],side=j%2===0?-1:1,late=Math.max(0,(p[5]||1)-1),beat=Math.sin(p[0]);let x=0,y=0,z=0;
  if(j===0){x=w*(s===1?-.12:s===3?.16:s===2?.08:0)+a*(s===1?.16:s===2?-.1:s===6?.07:0);y=(s===6||s===7)?(w*-.18+a*.25):0;}
  if(j===1){x+=s===3?.13:s===1?w*-.08:0;y+=s===6?-a*.18:s===8?beat*.12:0;}
  if(j===2||j===3){
    if(s===1){x=-w*.4+a*.25;z=side*(w*.18+late*.04);}
    else if(s===2){x=-w*.25+a*.58;z=side*.22;y=-side*(w*.2+a*.1);}
    else if(s===3){x=-c*.25-w*.15;z=side*(.17+w*.12);y=side*a*.3;}
    else if(s===4){x=-w*.45-c*.5+a*.2;z=side*(.3+w*.28);}
    else if(s===5){x=-w*(j===3?.65:.2)+a*(j===3?.15:-.4);z=side*(.25+c*.2);y=side*(w*.35+a*.3);}
    else if(s===6||s===7){x=j===3?-w*.3+a*.2:-w*.1;z=side*(w*.32-a*.25);y=j===3?-w*.35+a*.65:w*.12-a*.15;}
    else if(s===8){x=-w*.45-a*.2;z=side*(.25+w*.25);y=side*(beat*.18+a*.25);}
    else if(s===9){x=w*.25-a*.65;z=side*(.28+w*.15);}
  }
  if(j===4||j===5){x+=(s===1?.08:s===2?.16:0)*(w+a)+late*.025;z=side*((s===2?.12:s===1?.06:.025)+w*.05);if(s===1)x+=beat*stride*.12;}
  out[0]=x;out[1]=y;out[2]=z;return out;
}

// No extra vertex attributes: the existing pose's formerly unused hit slot carries boss phase.
export const BOSS_JOINT_GLSL=`
vec3 vrBoss(float j){float s=vrPose3.x,a=vrPose0.z,w=vrPose0.w,c=vrPose1.x,stride=vrPose0.y,side=mod(j,2.)<.5?-1.:1.,late=max(0.,vrPose1.y-1.),beat=sin(vrPose0.x);float x=0.,y=0.,z=0.;
if(j<.5){x=w*(s==1.?-.12:s==3.?.16:s==2.?.08:0.)+a*(s==1.?.16:s==2.?-.1:s==6.?.07:0.);y=(s==6.||s==7.)?w*-.18+a*.25:0.;}
if(j>.5&&j<1.5){x+=s==3.?.13:s==1.?w*-.08:0.;y+=s==6.?-a*.18:s==8.?beat*.12:0.;}
if(j>1.5&&j<3.5){
if(s==1.){x=-w*.4+a*.25;z=side*(w*.18+late*.04);}
else if(s==2.){x=-w*.25+a*.58;z=side*.22;y=-side*(w*.2+a*.1);}
else if(s==3.){x=-c*.25-w*.15;z=side*(.17+w*.12);y=side*a*.3;}
else if(s==4.){x=-w*.45-c*.5+a*.2;z=side*(.3+w*.28);}
else if(s==5.){x=-w*(j>2.5?.65:.2)+a*(j>2.5?.15:-.4);z=side*(.25+c*.2);y=side*(w*.35+a*.3);}
else if(s==6.||s==7.){x=j>2.5?-w*.3+a*.2:-w*.1;z=side*(w*.32-a*.25);y=j>2.5?-w*.35+a*.65:w*.12-a*.15;}
else if(s==8.){x=-w*.45-a*.2;z=side*(.25+w*.25);y=side*(beat*.18+a*.25);}
else if(s==9.){x=w*.25-a*.65;z=side*(.28+w*.15);}}
if(j>3.5&&j<5.5){x+=(s==1.?.08:s==2.?.16:0.)*(w+a)+late*.025;z=side*((s==2.?.12:s==1.?.06:.025)+w*.05);if(s==1.)x+=beat*stride*.12;}
return vec3(x,y,z);}
`;

