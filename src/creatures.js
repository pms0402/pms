import * as THREE from 'three';
import { monsterJoint } from './monster-motion.js';
import { damp, angleDelta, createActorMotion, advanceActorMotion, swordSwing } from './motion.js';
import { swordPoseProgress } from './action-combat.js';
import { buildSculptedMonster } from './sculpted-models.js';
/** Blender-authored silhouettes retain the original GPU articulation tags. */
export function buildMonster(game,visual,kind,skin,designId) {
 if(!buildSculptedMonster(game,visual,kind,skin,designId))throw new Error('Missing monster silhouette: '+(designId||kind));
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
