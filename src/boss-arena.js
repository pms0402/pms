import * as THREE from 'three';
import {BossArenaLayout} from './boss-arena-layout.js';
import {TerrainNavigation} from './terrain-layout.js';
import {TerrainRenderer} from './terrain-renderer.js';
import {ExplorableTerrain} from './explorable-terrain.js';
import {SceneContext,clearCosmetics} from './scene-context.js';
import {volumeEntry} from './combat-collision.js';
import {createActorMotion} from './motion.js';
import {createBossPresence} from './boss-presence.js';

const ARRAYS=['enemies','projectiles','enemyProjectiles','pickups','chests'];
const MAGIC_ARRAYS=['projectiles','effects','zones','orbs'];
const COLORS={ruins:['#10131a','#22272c','#b6af96'],volcano:['#1d1010','#38231d','#ce9574'],forest:['#0e1612','#233128','#a3b994'],tundra:['#101a25','#263c50','#b7d9ed'],void:['#140e21','#29203e','#c3acd9']};

/** A reversible encounter context, sharing the normal layered movement and combat geometry. */
export class BossArenaSystem {
  constructor(game){this.game=game;this.active=false;this.cinematics=true;this.serial=0;}
  begin(boss){
    const g=this.game;if(g.training?.active||g.sideAreas?.active&&!boss.hiddenBoss)return false;
    this.close();clearCosmetics(g);
    this.boss=boss;this.layout=new BossArenaLayout(boss.hiddenBoss||boss.archetype);this.definition=this.layout.definition;
    this.saved={position:g.player.position.clone(),rotation:g.player.rotation.y,magic:{},arrays:{},altar:g.altar,elapsed:g._state.elapsed,regionHazards:g.regionSystem.hazards,poisonRemaining:g.regionSystem.poisonRemaining,slowRemaining:g.regionSystem.slowRemaining};
    this.saved.equipmentDrops=g.equipment.drops.splice(0);
    this.saved.viewYaw=g.view.yaw;
    this.saved.poisonTick=g.regionSystem.poisonTick;
    this.saved.mutationExplosions=g.mutationSystem.explosions.splice(0);g.mutationSystem.warningDirty=true;
    this.context=new SceneContext(g);this.context.hide();boss.group.visible=true;
    for(const key of ARRAYS){this.saved.arrays[key]=g[key].splice(0).filter(e=>e!==boss);if(key==='enemies')g[key].push(boss);}
    for(const key of MAGIC_ARRAYS)this.saved.magic[key]=g.magic[key].splice(0);
    this.saved.orbitSignature=g.magic.orbitSignature;g.magic.orbitSignature='';
    g.altar=null;g.activeEnemies.clear();g.activeEnemies.add(boss);g.spatialDirty=true;
    this.active=true;this.won=false;this.time=0;this.hazardTimer=5;this.hazards=[];this.hazardsTriggered=0;this.pendingPhase=null;this.events=[];this.musicTimer=0;this.beat=0;
    const navigation=new TerrainNavigation(this.layout),renderer=new TerrainRenderer(g,this.layout);
    this.terrain=Object.create(ExplorableTerrain.prototype);Object.assign(this.terrain,{game:g,layout:this.layout,navigation,renderer,world:{legacyResolve:p=>p},current:{navigation,renderer,layout:this.layout},history:new WeakMap(),steering:new WeakMap(),enabled:()=>this.active});
    this.renderer=renderer;this.buildArchitecture();
    this.presence=createBossPresence(boss,renderer);
    for(const s of this.layout.breakables)s.hp=s.initialHp=Math.max(120,g.combatStats.damage*8);
    const damage=this.terrain.damage.bind(this.terrain);this.terrain.damage=(...args)=>{const result=damage(...args);this.syncDecor();return result;};
    this.context.mood([...COLORS[this.definition.region],this.definition.color]);g.scene.fog.density=.012;
    g.player.position.set(0,0,14);this.terrain.project(g.player.position);g.player.rotation.y=Math.PI;g.view.yaw=Math.PI;
    boss.group.position.set(0,0,-6);this.terrain.project(boss.group.position,1.4,7.5);boss.actionTimer=Math.max(2,boss.actionTimer||0);boss.hiddenTimer=Math.max(2,boss.hiddenTimer||0);boss.phaseCooldown=Math.max(5,boss.phaseCooldown||0);
    g.playerMotion=createActorMotion(g.player);g.view.snap=true;g.invulnerable=Math.max(g.invulnerable,1.5);g.regionSystem.hazards=[];g.regionSystem.poisonRemaining=0;g.regionSystem.slowRemaining=0;
    this.cue('intro',1.25);g.callbacks.onLoot?.(this.definition.rule);g.sound('boss-enter',boss.group.position);g.emit();return true;
  }
  buildArchitecture(){
    const root=this.renderer.root,own=g=>{this.renderer.geometries.push(g);return g;},mat=new THREE.MeshStandardMaterial({color:this.definition.color,metalness:.38,roughness:.58,map:this.game.presentation.stoneMap});this.renderer.materials.push(mat);
    const add=(geo,x,y,z,s=1)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.scale.setScalar(s);m.castShadow=m.receiveShadow=true;root.add(m);return m;};
    const ring=own(new THREE.TorusGeometry(1,.035,5,96));
    for(const r of [4,12,26]){const m=add(ring,0,.035,0,r);m.rotation.x=-Math.PI/2;m.castShadow=false;}
    // Sculpted arches, stepped cornices and buttresses sit on collision-bearing walls.
    const arch=new THREE.Shape();arch.moveTo(-3,0);arch.lineTo(-3,8);arch.lineTo(3,8);arch.lineTo(3,0);arch.lineTo(2.1,0);arch.lineTo(2.1,4.7);arch.absarc(0,4.7,2.1,0,Math.PI,false);arch.lineTo(-2.1,0);arch.closePath();
    const ag=own(new THREE.ExtrudeGeometry(arch,{depth:.65,bevelEnabled:true,bevelSize:.12,bevelThickness:.12,bevelSegments:2,curveSegments:12}));
    for(let n=0;n<8;n++){const a=n*Math.PI/4,m=add(ag,Math.sin(a)*29,-.2,Math.cos(a)*29);m.rotation.y=a;}
    const pillar=own(new THREE.CylinderGeometry(.6,.9,1,8)),cap=own(new THREE.BoxGeometry(1,1,1));
    for(const s of this.layout.breakables){
      const group=new THREE.Group();root.add(group);group.position.set(s.x,s.maxY,s.z);group.add(new THREE.Mesh(cap,mat));group.children[0].scale.set(s.hx*2+.5,.4,s.hz*2+.5);
      this.decorations||=new Map();this.decorations.set(s.id,group);
      if(s.id.startsWith('conductor')){const sp=add(pillar,s.x,s.maxY+1.5,s.z);sp.scale.set(.8,3,.8);group.attach(sp);}
    }
    const glow=new THREE.MeshBasicMaterial({color:this.definition.color,transparent:true,opacity:.48,depthWrite:false});this.renderer.materials.push(glow);this.glows=[];
    for(const r of [...this.layout.safe,...this.layout.rifts]){const m=new THREE.Mesh(own(new THREE.RingGeometry(r.radius||1.7,(r.radius||1.7)+.16,40)),glow);m.rotation.x=-Math.PI/2;m.position.set(r.x,.09,r.z);root.add(m);this.glows.push({mesh:m,phase:r.phase||1});}
    const floor=new THREE.Mesh(this.renderer.groundGeometry,new THREE.MeshStandardMaterial({color:this.definition.region==='forest'?'#3e4a36':this.definition.region==='tundra'?'#718893':'#54505a',roughness:.86,map:this.game.presentation.stoneMap,normalMap:this.game.presentation.stoneNormal}));
    floor.receiveShadow=true;floor.name='Boss arena connected floor';root.add(floor);this.renderer.materials.push(floor.material);
    if(this.layout.id==='artillery')for(const side of [-1,1])for(const z of [-6,5]){const barrel=add(own(new THREE.CylinderGeometry(.65,.9,5,10)),side*24,4,z);barrel.rotation.z=side*Math.PI/2;}
    if(this.layout.id==='primordial'||this.layout.id==='observer'){const m=add(own(new THREE.TorusGeometry(22,.6,8,80)),0,8,-12);m.rotation.x=.3;}
    if(['storm','reaper','observer','primordial'].includes(this.layout.id)){
      const base=add(own(new THREE.CylinderGeometry(29.5,8,27,16,4)),0,-13.7,0);base.material=mat;
      for(let n=0;n<8;n++){const a=n*Math.PI/4,m=add(own(new THREE.CylinderGeometry(.6,2,15,5)),Math.sin(a)*24,-6.5,Math.cos(a)*24);m.rotation.z=Math.cos(a)*.12;m.rotation.x=Math.sin(a)*.12;}
    }
    for(const r of this.layout.rifts){const frame=add(own(new THREE.TorusGeometry(1.7,.12,5,32,Math.PI*1.65)),r.x,1.8,r.z);frame.rotation.z=Math.PI*.17;frame.material=glow;}
    for(const gate of this.layout.spawnGates){const portal=add(ag,gate.x*.94,0,gate.z*.94);portal.rotation.y=Math.atan2(gate.x,gate.z);portal.scale.setScalar(.7);}
    if(this.layout.id==='artillery'){
      const steel=new THREE.MeshStandardMaterial({color:'#30353b',metalness:.7,roughness:.4});this.renderer.materials.push(steel);
      for(const m of root.children)if(m.geometry?.type==='CylinderGeometry'&&m.position.y===4)m.material=steel;
    }
  }
  cue(kind,duration){this.presentation={kind,duration,time:duration,id:++this.serial,commands:this.game.actions.manualCommands};this.game.view?.emphasize();}
  skip(){if(this.presentation){this.presentation.time=0;return true;}return false;}
  presentCamera(dt){
    const g=this.game,cue=this.presentation,allowed=this.active&&this.cinematics&&cue?.time>0&&g.view.effectiveMode()!=='first'&&g.cameraShake>0&&g._state.phase==='playing';
    const target=allowed?Math.sin(Math.PI*(1-cue.time/cue.duration))*.65:0;
    this.cameraBlend=THREE.MathUtils.damp(this.cameraBlend||0,target,12,dt);
    if(!this.active||this.cameraBlend<.001||g.view.effectiveMode()==='first')return;
    const b=this.boss.group.position,p=g.player.position,mid=p.clone().lerp(b,.4);mid.y+=3;
    const shot=p.clone().add(new THREE.Vector3(9,8,11));g.view.clip(shot);g.camera.position.lerp(shot,this.cameraBlend*(g.effectIntensity??1));
    g.camera.lookAt(g.view.look.clone().lerp(mid,this.cameraBlend));g.camera.updateMatrixWorld();
  }
  update(dt){
    if(!this.active)return;this.time+=dt;
    this.game.regionSystem.updateStatuses(dt);
    if(this.presentation){this.presentation.time=Math.max(0,this.presentation.time-dt);if(this.game.inputDirection().lengthSq()>.01||this.game.actions.manualCommands!==this.presentation.commands||this.game.dashTime>0)this.skip();}
    this.terrain.teleportCooldown=Math.max(0,(this.terrain.teleportCooldown||0)-dt);
    this.renderer.fade(this.game.player.position,this.game.view.mode,dt);
    this.presence?.update();
    for(const o of this.glows)o.mesh.visible=o.phase<=this.layout.phase;
    if(this.won)return;
    if(this.pendingPhase&&(this.pendingPhase.time-=dt)<=0){const p=this.pendingPhase.phase;this.pendingPhase=null;this.applyPhase(p);}
    this.updateHazards(dt);
    this.hazardTimer-=dt;
    if(this.hazardTimer<=0&&!this.pendingPhase){this.environmentAttack();this.hazardTimer=this.layout.phase===3?6:8;}
    this.musicTimer-=dt;if(this.musicTimer<=0){this.game.sound('boss-motif',null,{note:this.definition.motif[this.beat++%4],phase:this.layout.phase});this.musicTimer=this.layout.phase===3?.56:.82;}
  }
  phase(boss,phase){if(!this.active||boss!==this.boss||this.won)return;this.pendingPhase={phase,time:1.25};this.cue('phase',.7);this.game.sound('boss-phase',boss.group.position);this.game.callbacks.onLoot?.(this.definition.change+' · 1.2초 후');}
  applyPhase(phase){
    const removed=this.layout.advance(phase);for(const s of removed)this.debris(s);this.renderer.sync();this.syncDecor();this.events.push({kind:'phase',phase,removed:removed.map(s=>s.id),time:this.time});
    this.hazardTimer=Math.max(this.hazardTimer,2);this.game.bossSystem.cancelAttacks();this.boss.actionTimer=Math.max(1.6,this.boss.actionTimer||0);this.boss.hiddenTimer=Math.max(1.6,this.boss.hiddenTimer||0);this.boss.phaseCooldown=Math.max(3,this.boss.phaseCooldown||0);
    const colors=[...COLORS[this.definition.region],this.definition.color];this.game.moodTarget=colors.map((c,i)=>new THREE.Color(c).multiplyScalar(phase===3&&i<2?.75:1));this.game.sound('arena-collapse');
  }
  debris(s){this.game.puff(new THREE.Vector3(s.x,s.minY+1,s.z),this.definition.color,2,.5);}
  syncDecor(){for(const s of this.layout.breakables){const m=this.decorations?.get(s.id);if(m)m.visible=!s.disabled;}}
  impact(s,boss=this.boss){if(!this.active||this.won)return false;const struck=this.layout.bossImpact(s.id);if(!struck)return false;this.debris(s);this.renderer.sync();this.syncDecor();this.game.sound('arena-collapse',new THREE.Vector3(s.x,1,s.z));if(struck.disabled)this.events.push({kind:'cover',id:s.id,time:this.time});return true;}
  projectileImpact(a,b,projectile){
    if(!this.active||projectile.attacker!==this.boss||this.layout.id!=='artillery')return;
    const s=this.layout.breakables.filter(s=>!s.disabled).map(s=>({s,t:volumeEntry(a,b,s,.15)})).sort((a,b)=>a.t-b.t)[0];
    if(s&&s.t<=1&&this.time>(s.s.lastShot??-10)+.5){s.s.lastShot=this.time;this.impact(s.s);}
  }
  crush(a,b,boss){
    if(!this.active||boss!==this.boss)return false;
    const hit=this.layout.breakables.find(s=>!s.disabled&&volumeEntry(a,b,s,1.5)<=1);if(!hit)return false;
    hit.bossHits=1;this.impact(hit,boss);boss.mode='recovery';boss.recoveryTime=1.65;boss.actionTimer=2.5;this.game.bossPhases.rush=null;this.game.clearTelegraph(boss);this.game.callbacks.onLoot?.('돌진 유도 성공 · 수호자 자세 붕괴');return true;
  }
  attack(type){if(!this.active||this.won)return;this.game.sound('boss-'+({warden:'stone',artillery:'cannon',plague:'venom',brood:'summon',storm:'thunder',reaper:'rift',king:'stone',observer:'rift',primordial:'abyss'}[this.layout.id]),this.boss.group.position);}
  minionPosition(n){if(!this.active)return null;const gates=this.layout.spawnGates;if(!gates.length)return null;const gate=gates[n%gates.length];const p=new THREE.Vector3(gate.x*.85,0,gate.z*.85);this.terrain.project(p,.6,3.6);return p;}
  blinkTarget(){if(!this.active)return null;const p=this.game.player.position,r=this.layout.rifts.filter(r=>r.phase<=this.layout.phase&&Math.hypot(r.x-p.x,r.z-p.z)>=5).sort((a,b)=>Math.abs(Math.hypot(a.x-p.x,a.z-p.z)-10)-Math.abs(Math.hypot(b.x-p.x,b.z-p.z)-10))[0];return r?new THREE.Vector3(r.x,r.y,r.z):null;}
  environmentAttack(){
    if(this.time<3||this.layout.phase<2&&!['plague','storm'].includes(this.layout.id))return;
    const p=this.game.player.position,id=this.layout.id,phase=this.layout.phase;
    if(id==='plague'){
      const d=this.layout.dangers[Math.floor(this.time/6)%4];this.warn(d.x,d.z,4.8,1.5,2.5,'poison');
    }else if(id==='storm'){
      const safe=this.layout.safe.some(s=>Math.hypot(p.x-s.x,p.z-s.z)<s.radius);if(!safe)this.warn(p.x,p.z,3.5,1.3,.22,'lightning');
      if(phase===3){const a=this.time*1.2;this.warn(Math.sin(a)*16,Math.cos(a)*16,4,1.7,.22,'lightning');}
    }else if(id==='brood'){const gate=this.layout.spawnGates[Math.floor(this.time)%4];this.warn(gate.x*.72,gate.z*.72,4,1.4,.25,'pulse');}
    else if(id==='primordial'){const a=this.time*.7;this.warn(Math.sin(a)*17,Math.cos(a)*17,4.5,1.6,.3,'abyss');}
    else if(id==='warden'){const a=this.time;this.warn(Math.sin(a)*21,Math.cos(a)*21,3.8,1.5,.2,'stone');}
    else if(id==='artillery'){const a=this.time;this.warn(Math.sin(a)*18,Math.cos(a)*18,4,1.6,.25,'cannon');}
    else{const a=this.time*.9;this.warn(Math.sin(a)*19,Math.cos(a)*19,4,1.5,.3,'rift');}
  }
  warn(x,z,radius,warning,life,type){
    if(this.hazards.length>=5)return null;
    const y=this.game.groundHeight(x,z,this.game.player.position.y),geometry=new THREE.RingGeometry(.02,1,48),material=new THREE.MeshBasicMaterial({color:'#ff7764',transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.075,z);mesh.scale.setScalar(radius);this.renderer.root.add(mesh);
    const h={x,z,y,radius,warning,totalWarning:warning,life,type,mesh,tick:0};this.hazards.push(h);this.hazardsTriggered++;return h;
  }
  updateHazards(dt){for(let i=this.hazards.length-1;i>=0;i--){const h=this.hazards[i];h.warning-=dt;h.mesh.material.opacity=h.warning>0?.16+.2*(1-Math.max(0,h.warning)/h.totalWarning):.48;
    if(h.warning<=0){if(!h.started){h.started=true;this.game.sound(h.type==='lightning'?'boss-thunder':'boss-abyss',h.mesh.position);this.game.puff(h.mesh.position,this.definition.color,h.radius*.5,.25);}h.life-=dt;h.tick-=dt;
      const p=this.game.player.position;if(h.tick<=0&&Math.hypot(p.x-h.x,p.z-h.z)<h.radius&&Math.abs(p.y-h.y)<1.5){h.tick=.7;this.game.takeDamage(this.game.bossStats().damage*.45,new THREE.Vector3(p.x,p.y,p.z),'전장 '+h.type,this.boss,{unblockable:true});}}
    if(h.life<=0)this.removeHazard(i);
  }}
  removeHazard(i){const h=this.hazards[i];h.mesh.removeFromParent();h.mesh.geometry.dispose();h.mesh.material.dispose();this.hazards.splice(i,1);}
  defeat(boss){
    if(!this.active||boss!==this.boss)return;this.won=true;this.pendingPhase=null;while(this.hazards.length)this.removeHazard(0);this.game.clearEnemyProjectiles();for(const e of [...this.game.enemies])if(e!==boss)this.game.removeEnemyWithoutReward(e);
    this.cue('victory',.9);this.game.sound('boss-victory',boss.group.position);this.events.push({kind:'victory',time:this.time});
  }
  get rewardBlocked(){return !!(this.active&&this.won&&this.cinematics&&this.presentation?.time>0);}
  interactionTarget(){
    if(!this.active)return null;if(this.won&&Math.hypot(this.game.player.position.x,this.game.player.position.z-14)<4)return{kind:'bossArena',id:'exit',name:'보스 전장 출구',verb:'탐험으로 돌아가기'};
    if(this.terrain.teleportCooldown>0)return null;
    const p=this.game.player.position;const r=this.layout.rifts.find(r=>r.phase<=this.layout.phase&&Math.hypot(p.x-r.x,p.z-r.z)<2.8);return r?{kind:'bossArena',id:r.id,name:'궁전의 공간 균열',verb:'반대편 균열로 이동'}:null;
  }
  interact(id){
    if(!this.active)return false;if(id==='exit'&&this.won){this.close({collect:true});this.game.emit();return true;}
    if(this.terrain.teleportCooldown>0)return false;const r=this.layout.rifts.find(r=>r.id===id&&r.phase<=this.layout.phase),next=r&&this.layout.riftTarget(r);if(!next)return false;
    this.game.player.position.set(next.x,next.y,next.z);this.terrain.history.delete(this.game.player.position);this.terrain.project(this.game.player.position);this.game.playerMotion=createActorMotion(this.game.player);this.terrain.teleportCooldown=.8;this.game.actions.cancel();this.game.view.snap=true;return true;
  }
  state(){if(!this.active)return null;return{id:this.layout.id,title:this.layout.title,epithet:this.definition.epithet,rule:this.definition.rule,phase:this.layout.phase,changing:this.pendingPhase?.phase||null,won:this.won,hazards:this.hazards.length,hazardsTriggered:this.hazardsTriggered,broken:this.layout.breakables.filter(s=>s.disabled).length,cue:this.presentation?.time>0&&this.cinematics?{...this.presentation,name:this.boss.name,epithet:this.definition.epithet}:null};}
  close({collect=false}={}){
    if(!this.active)return;const g=this.game;clearCosmetics(g);this.active=false;
    while(this.hazards.length)this.removeHazard(0);
    for(const e of [...g.enemies])if(e!==this.boss)g.removeEnemyWithoutReward(e);
    g.clearEnemyProjectiles();for(const p of g.projectiles){g.removeGroup(p.mesh);p.mesh.geometry.dispose();}g.projectiles.length=0;
    for(const p of g.pickups)if(collect&&p.type!=='heal')g.collectPickup(p,false);else g.removeGroup(p.mesh);g.pickups.length=0;
    // Release encounter spell objects through their owner's pool, then restore suspended objects.
    g.magic.clearActive();
    for(const key of MAGIC_ARRAYS)g.magic[key].push(...this.saved.magic[key]);g.magic.orbitSignature=this.saved.orbitSignature;
    for(const key of ARRAYS)g[key].push(...this.saved.arrays[key]);g.altar=this.saved.altar;
    g.equipment.drops.push(...this.saved.equipmentDrops);
    g.mutationSystem.explosions.length=0;g.mutationSystem.explosions.push(...this.saved.mutationExplosions);g.mutationSystem.warningDirty=true;
    for(const e of g.enemies)if(e.hp>0)g.activeEnemies.add(e);g.spatialDirty=true;
    g.player.position.copy(this.saved.position);g.player.rotation.y=this.saved.rotation;g.view.yaw=this.saved.viewYaw;g.playerMotion=createActorMotion(g.player);g.view.snap=true;g.world.topology.history.delete(g.player.position);
    g.regionSystem.hazards=this.saved.regionHazards;g.regionSystem.poisonTick=this.saved.poisonTick;g.regionSystem.poisonRemaining=Math.max(0,(this.saved.poisonRemaining||0)-(g._state.elapsed-this.saved.elapsed));g.regionSystem.slowRemaining=Math.max(0,(this.saved.slowRemaining||0)-(g._state.elapsed-this.saved.elapsed));
    this.presence?.dispose();this.presence=null;this.renderer.dispose();this.decorations=null;this.context.restore();this.saved=null;this.terrain=null;this.layout=null;this.boss=null;this.presentation=null;
  }
  dispose(){this.close();}
}
