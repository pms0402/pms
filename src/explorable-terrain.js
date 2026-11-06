import * as THREE from 'three';
import {TerrainLayout,TerrainNavigation} from './terrain-layout.js';
import {TerrainRenderer} from './terrain-renderer.js';
import {createActorMotion} from './motion.js';
import {terrainHeight} from './terrain.js';

/** Three cached districts; all movement, goals and attacks share their surfaces. */
export class ExplorableTerrain {
  constructor(game,world){this.game=game;this.world=world;this.cache=new Map();this.history=new WeakMap();this.legacyHeight=terrainHeight;this.teleportCooldown=0;this.activate('sanctum',0);}
  enabled(){const g=this.game;return !g.camp?.active&&!g.sideAreas?.active&&!g.training?.active;}
  activate(region,variant){
    const key=region+':'+((variant%3+3)%3),owner=this.game._state.runId+':'+this.game._state.stage;if(this.current?.key===key&&this.current.owner===owner)return;
    for(const c of this.cache.values())c.renderer.root.visible=false;
    let c=this.cache.get(key);
    if(!c){const layout=new TerrainLayout(region,variant),navigation=new TerrainNavigation(layout),renderer=new TerrainRenderer(this.game,layout);c={key,layout,navigation,baseNavigation:navigation,renderer,owner};this.cache.set(key,c);}
    else if(c.owner!==owner){c.layout=new TerrainLayout(region,variant);c.navigation=c.baseNavigation;c.navigation.layout=c.layout;c.navigation.layoutRevision=0;c.renderer.layout=c.layout;c.renderer.sync();c.bossNavigation=null;c.owner=owner;}
    this.cache.delete(key);this.cache.set(key,c);this.current=c;this.layout=c.layout;this.navigation=c.navigation;this.renderer=c.renderer;
    this.renderer.root.visible=this.enabled();
    if(!this.originalGround){this.originalGround=this.world.ground.geometry;this.originalGround.dispose();}
    this.world.ground.geometry=this.renderer.groundGeometry;
    this.history=new WeakMap();this.steering=new WeakMap();this.refreshScenery();
    while(this.cache.size>3){const id=this.cache.keys().next().value,old=this.cache.get(id);old.renderer.dispose();this.cache.delete(id);}
    if(this.game.player){this.project(this.game.player.position,.65,3.6);this.game.playerMotion=createActorMotion(this.game.player);if(this.game.view)this.game.view.snap=true;}
  }
  refreshScenery(){
    const g=this.game,matrix=new THREE.Matrix4();
    const grass=this.world.art.grass;
    if(grass&&!this.grassMatrices)this.grassMatrices=grass.instanceMatrix.array.slice();
    const entries=[...(g.terrainBatches||[]),...(grass?[{mesh:grass,matrices:this.grassMatrices}]:[])];
    for(const entry of entries){const count=entry.mesh.instanceMatrix.count;for(let i=0;i<count;i++){
      matrix.fromArray(entry.matrices,i*16);const anchor=entry.anchors?entry.anchors[i]:{x:matrix.elements[12],z:matrix.elements[14]};
      if(anchor&&this.layout.reserved(anchor.x,anchor.z))matrix.scale(new THREE.Vector3(0,0,0));entry.mesh.setMatrixAt(i,matrix);
    }entry.mesh.instanceMatrix.needsUpdate=true;}
    for(const o of this.world.art.decor||[])if(o.parent){const a=o.userData.terrainDecor;o.visible=!this.layout.reserved(a.x,a.z);}
  }
  ensureNavigation(){
    if(this.navigation.layoutRevision!==this.layout.revision){this.current.navigation=this.navigation=new TerrainNavigation(this.layout);this.navigation.layoutRevision=this.layout.revision;this.current.bossNavigation=null;}
  }
  height(x,z,y){return this.layout.height(x,z,y);}
  isWalkable(x,z,r=.65,y){return !!this.layout.support(x,z,y,r,3.6);}
  navigationFor(radius,height){this.ensureNavigation();if(height>4.5||radius>1.25){if(!this.current.bossNavigation){
      if(this.layout.revision===0&&this.current.baseBossNavigation){this.current.bossNavigation=this.current.baseBossNavigation;this.current.bossNavigation.layout=this.layout;}
      else{this.current.bossNavigation=new TerrainNavigation(this.layout,{radius:1.4,height:7.5});if(this.layout.revision===0)this.current.baseBossNavigation=this.current.bossNavigation;}
    }return this.current.bossNavigation;}return this.navigation;}
  project(p,radius=.65,height=3.6){
    const nav=this.navigationFor(radius,height),s=this.layout.support(p.x,p.z,p.y,radius,height),id=nav.nearest({...p,y:s?.y??p.y});
    const link=s&&id>=0?this.layout.traverse({x:p.x,z:p.z,y:s.y},nav.nodes[id],radius,height):null;
    if(s&&id>=0&&nav.reachable[id]&&link.clear&&Math.abs(link.point.y-nav.nodes[id].y)<.2)p.y=s.y;
    else p.copy? p.copy(nav.project(p)):Object.assign(p,nav.project(p));
    this.history.set(p,{x:p.x,y:p.y,z:p.z});return p;
  }
  resolve(p,radius=.65,height=3.6){
    if(!this.enabled())return this.world.legacyResolve(p,radius);
    const previous=this.history.get(p);
    if(!previous||Math.hypot(previous.x-p.x,previous.z-p.z)>5||Math.abs(previous.y-p.y)>.8)return this.project(p,radius,height);
    const wanted={x:p.x,y:p.y,z:p.z},full=this.layout.traverse(previous,wanted,radius,height);let resolved=full.point;
    if(!full.clear){
      const x=this.layout.traverse(resolved,{x:wanted.x,z:resolved.z},radius,height),z=this.layout.traverse(x.point,{x:x.point.x,z:wanted.z},radius,height);resolved=z.point;
    }
    p.x=resolved.x;p.y=resolved.y;p.z=resolved.z;this.history.set(p,{...resolved});return p;
  }
  steer(p,dx,dz,radius=.6,seed=0,targetY=this.game.player.position.y){
    if(!this.enabled()){const n=Math.hypot(dx,dz)||1;return{x:dx/n,z:dz/n};}
    const height=radius>1.25?7.5:3.6,nav=this.navigationFor(radius,height),target={x:p.x+dx,z:p.z+dz,y:targetY},time=this.game._state.elapsed||0;
    const cached=this.steering?.get(p);
    if(cached&&cached.nav===nav&&cached.until>time&&Math.hypot(cached.target.x-target.x,cached.target.z-target.z)<1.2&&Math.abs(cached.target.y-target.y)<.6){
      const x=cached.point.x-p.x,z=cached.point.z-p.z,len=Math.hypot(x,z);if(len>.35)return{x:x/len,z:z/len};
    }
    const result=nav.steer(p,target,radius,height);
    if(result.waypoint)this.steering.set(p,{nav,point:result.waypoint,target,until:time+.10+(Math.abs(seed)%1)*.04});
    return result;
  }

  updateNavigation(target){this.ensureNavigation();this.navigation.flow(target);}
  movementAt(p){const ice=this.layout.ice;return ice&&Math.abs(p.x-ice.x)<ice.hx&&Math.abs(p.z-ice.z)<ice.hz&&Math.abs(p.y-ice.y)<.7?.9:1;}
  interactionTarget(){
    if(!this.enabled()||this.teleportCooldown>0)return null;
    const p=this.game.player.position;
    for(const i of this.layout.interactions)if((!i.opened||i.teleport)&&Math.hypot(p.x-i.x,p.z-i.z)<3&&Math.abs(p.y-i.y)<1.5)return{kind:'terrain',id:i.id,name:i.name,verb:i.verb};
    return null;
  }
  interact(id){
    const i=this.layout.use(id);if(!i)return false;
    if(i.teleport){const p=this.game.player.position;p.set(i.teleport.x,i.teleport.y,i.teleport.z);this.history.delete(p);this.resolve(p,.65);this.teleportCooldown=.8;this.game.actions.cancel();this.game.view.snap=true;this.game.playerMotion=createActorMotion(this.game.player);}
    if(i.reward){this.game.collectPickup({type:'gold',value:this.game.stageStats().coinValue*5,mesh:null},false);this.game.runReport.terrainSecrets=(this.game.runReport.terrainSecrets||0)+1;}
    this.renderer.sync();this.game.callbacks.onLoot?.(i.teleport?'균열 통로 이동':i.reward?'숨겨진 탐험 보상 회수':'새 연결로 개방');this.game.emit();return true;
  }
  damage(origin,range,damage,direction,arc=Math.PI*2){
    if(!this.enabled())return 0;let hits=0;
    for(const b of this.layout.breakables){
      if(b.disabled||Math.abs(origin.y-(b.minY+.4))>2)continue;
      const dx=b.x-origin.x,dz=b.z-origin.z,d=Math.hypot(dx,dz),radius=Math.min(b.hx,b.hz)+.3;
      if(d>range+radius)continue;if(direction&&d>.1&&Math.acos(Math.max(-1,Math.min(1,(dx*direction.x+dz*direction.z)/d)))>arc/2+.15)continue;
      this.layout.damage(b.id,damage);hits++;
      if(b.disabled){this.game.puff(new THREE.Vector3(b.x,b.minY+.8,b.z),'#a6b5ad',1.6,.45);this.game.callbacks.onLoot?.('장애물 파괴 · 숨은 샛길 개방');}
    }
    if(hits)this.renderer.sync();return hits;
  }
  update(dt){
    if(this.enabled()&&this.game._state.phase==='playing'){
      this.environmentTime=(this.environmentTime||0)+dt;const phase=this.environmentTime%5,hot=phase>=3;
      for(const m of this.renderer.lava||[])m.material.opacity=hot?.64:.14+phase*.09;
      if(hot)for(const d of this.layout.dangers){const p=this.game.player.position;if(Math.abs(p.x-d.x)<d.hx&&Math.abs(p.z-d.z)<d.hz&&Math.abs(p.y-d.y)<1)this.game.takeDamage(this.game.stageStats().enemyDamage*.65,new THREE.Vector3(d.x,d.y,d.z),'협곡의 용암 분출',null,{unblockable:true});}
    }
    this.teleportCooldown=Math.max(0,this.teleportCooldown-dt);this.renderer.root.visible=this.enabled();}
  cameraSolids(){if(this.cameraRevision!==this.layout.revision||this.cameraLayout!==this.layout){this.cameraLayout=this.layout;this.cameraRevision=this.layout.revision;this.cameraBoxes=this.layout.walls().map(c=>({x:c.x,z:c.z,hx:c.hx??c.radius,hz:c.hz??c.radius,minY:c.minY,maxY:c.maxY}));}return this.cameraBoxes;}
  state(){const p=this.game.player?.position||{x:0,y:0,z:0},phase=(this.environmentTime||0)%5,nearLava=this.layout.dangers.some(d=>Math.abs(p.x-d.x)<d.hx&&Math.abs(p.z-d.z)<d.hz&&Math.abs(p.y-d.y)<1);return{hazard:nearLava?(phase>=3?'용암 분출 중':`용암 예고 ${(3-phase).toFixed(1)}초`):null,title:this.layout.title,variant:this.layout.variant+1,district:this.layout.district(p),height:p.y,bridges:this.layout.surfaces.filter(s=>s.bridge).length,stairs:this.layout.surfaces.filter(s=>s.stairs).length,broken:this.layout.breakables.filter(b=>b.disabled).length,cache:this.cache.size};}
  dispose(){for(const c of this.cache.values())c.renderer.dispose();this.cache.clear();}
}
