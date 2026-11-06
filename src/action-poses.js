import {smoothStep} from './grounded-motion.js';
// Contact is always .42: swordPoseProgress maps every actual hit marker here.
const tracks={
 slash:[[0,0,0,0,0],[.16,-.75,-.38,.18,.12],[.42,.25,.12,-.92,.65],[.64,1.05,.55,-.4,.48],[1,0,0,0,0]],
 twin:[[0,0,0,0,0],[.16,-.9,-.3,-.12,.1],[.42,.5,.3,-.7,.35],[.64,1.15,.5,.2,.25],[1,0,0,0,0]],
 heavy:[[0,0,0,0,0],[.18,-.18,-.28,-1.7,.32],[.42,.4,.25,-.2,1],[.64,.65,.5,.45,.85],[1,0,0,0,0]],
 thrust:[[0,0,0,0,0],[.16,-.4,-.27,.1,.18],[.42,.05,.18,-1.22,.65],[.64,.28,.3,-.7,.45],[1,0,0,0,0]],
 counter:[[0,0,0,0,0],[.16,-1,-.5,-.4,.15],[.42,.5,.32,-1.1,.8],[.64,1.2,.65,-.2,.6],[1,0,0,0,0]]
};
export function actionPose(style,t,side=1){
 const track=tracks[style]||tracks.slash;let a=track[0],b=track[track.length-1];for(let i=1;i<track.length;i++)if(t<=track[i][0]){a=track[i-1];b=track[i];break;}
 const f=smoothStep((t-a[0])/Math.max(.001,b[0]-a[0])),v=a.map((x,i)=>x+(b[i]-x)*f);
 return{yaw:v[1]*side,torso:v[2]*side,hips:v[2]*side*.42,arm:v[3],brace:v[4],lean:style==='heavy'?v[4]*.15:v[4]*.06};
}
export const ACTION_POSE_STYLES=Object.keys(tracks);
