import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.BASE_URL||'http://127.0.0.1:5301',out=process.env.SMOKE_OUTPUT;
if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],proof={};
try{
 const p=await browser.newPage({viewport:{width:1280,height:900}});p.setDefaultTimeout(30000);
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/GL_INVALID|Shader Error|THREE.WebGLProgram/.test(m.text()))errors.push(m.text());});
 await p.goto(base);await p.waitForFunction(()=>window.__game?.artReady);
 await p.evaluate(()=>{
  const g=__game;g.start();cancelAnimationFrame(g.raf);g.setViewMode('overhead');
  window.artFixture=()=>{g.start();g.spawnTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e9;g.invulnerable=1e9;g._state.xpNeeded=1e15;g.stats.spells={};g.actions.syncSlots();g.player.position.set(0,g.groundHeight(0,0),0);g.player.rotation.y=0;g.actions.hasAim=false;};
  window.renderArt=(position,front=true,boss=false)=>{const sign=front?1:-1;g.playerVisual.visible=true;g.camera.fov=boss?48:42;g.camera.aspect=g.container.clientWidth/g.container.clientHeight;g.camera.updateProjectionMatrix();g.camera.position.set(position.x+(boss?12:2.4)*sign,position.y+(boss?9:3.1),position.z+(boss?18:4.5)*sign);g.camera.lookAt(position.x,position.y+(boss?4.2:1.7),position.z);g.renderer.render(g.scene,g.camera);};
  window.artFixture();
 });
 proof.hero=await p.evaluate(()=>{
  const g=__game,stats=JSON.stringify(g.stats),records=[];
  for(const id of ['wanderer','arcanist','berserker','assassin','summoner','paladin','warlock']){
   g.stats.characterId=id;g.applyLoadoutAppearance();const visible=Object.entries(g.heroClassParts).filter(([,parts])=>parts.some(p=>p.visible)).map(([id])=>id);
   records.push({id,visible});
  }
  for(const weapon of ['voidblade','tempest','greatsword']){g.stats.weaponId=weapon;g.applyLoadoutAppearance();records.push({weapon,geometry:g.blade.geometry.userData.sculpted,offhand:g.offhandBlade.geometry===g.blade.geometry});}
  const before=g.ownedGeometries.size;
  for(let i=0;i<30;i++){g.stats.weaponId=['voidblade','tempest','greatsword'][i%3];g.applyLoadoutAppearance();}
  const after=g.ownedGeometries.size;
  g.stats=JSON.parse(stats);g.applyLoadoutAppearance();g.emit();renderArt(g.player.position);
  let meshes=0,triangles=0;g.playerVisual.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;}});
  return{authored:g.playerBody.geometry.userData.sculpted,records,before,after,meshes,triangles};
 });
 assert.equal(proof.hero.authored,'hero_cuirass');assert.equal(proof.hero.before,proof.hero.after);
 for(const r of proof.hero.records){if(r.id)assert.deepEqual(r.visible,r.id==='wanderer'?[]:[r.id]);else assert.ok(r.offhand);}
 if(out)await p.locator('#arena').screenshot({path:out+'/hero-front.png'});
 await p.evaluate(()=>renderArt(__game.player.position,false));if(out)await p.locator('#arena').screenshot({path:out+'/hero-back.png'});
 proof.monsters=await p.evaluate(()=>{
  const g=__game;g.player.visible=false;const records=[];
  for(let kind=0;kind<10;kind++){
   const e=g.spawnEnemy((kind%5-2)*3.5,5+Math.floor(kind/5)*4,kind,{noMutations:true});e.speed=0;e.hp=e.maxHp=1e9;
   let triangles=0;const joints=new Set();
   for(const m of e.visual.children){const a=m.geometry.attributes;assertFinite(a.position.array);assertFinite(a.normal.array);triangles+=m.geometry.index?m.geometry.index.count/3:a.position.count/3;for(const j of a.vrJoint.array)joints.add(j);}
   records.push({kind,parts:e.visual.children.length,triangles,joints:[...joints],authored:e.visual.children.every(m=>m.geometry.userData.sculpted==='monster_'+kind)});
  }
  function assertFinite(a){if(!a.every(Number.isFinite))throw Error('Non-finite model geometry');}
  for(let i=0;i<24;i++)g.advanceSimulation(1/60);
  g.updateCamera(1);g.renderer.render(g.scene,g.camera);
  return records;
 });
 for(const r of proof.monsters){assert.ok(r.authored&&r.parts<=7&&r.triangles>500&&r.triangles<20000);if(r.kind!==7)assert.ok(r.joints.length>=3);}
 proof.bosses=[];
 for(const stage of [1,2,3,4,5,6]){
  const r=await p.evaluate(stage=>{
   const g=__game;artFixture();g.player.visible=false;g._state.stage=stage;g.spawnBoss();const e=g.boss;
   e.group.position.set(0,g.groundHeight(0,0),0);g.player.position.set(3,g.groundHeight(3,9),9);
   const geometries=e.visual.children.map(m=>m.geometry),triangles=geometries.reduce((n,m)=>n+(m.index?.count||m.attributes.position.count)/3,0);
   const signature=geometries.map(m=>m.attributes.position.count).join(':');
   for(let i=0;i<20;i++)g.advanceSimulation(.01);
   renderArt(e.group.position,true,true);g.player.visible=false;g.renderer.render(g.scene,g.camera);
   return{stage,archetype:e.archetype,design:e.visual.userData.design,triangles,signature,hp:e.hp,maxHp:e.maxHp,size:e.size};
  },stage);
  assert.equal(r.design,'boss_'+r.archetype);assert.ok(r.hp>0&&r.hp<=r.maxHp&&r.triangles<20000);proof.bosses.push(r);
  if(out)await p.locator('#arena').screenshot({path:out+'/boss-'+r.archetype+'.png'});
 }
 assert.equal(new Set(proof.bosses.map(b=>b.signature)).size,6);
 proof.hidden=await p.evaluate(()=>{
  const g=__game;artFixture();return ['king','observer','primordial'].map(id=>{const root=g.sideAreas.hidden.model(id);const record={id,parts:root.children.length,design:root.userData.design||'hero-clone',boxes:0};root.traverse(o=>{if(o.geometry?.type==='BoxGeometry')record.boxes++;});return record;});
 });
 assert.ok(proof.hidden.every(h=>h.boxes===0));
 proof.regions=[];
 for(const id of ['volcano','tundra','forest','ruins','void']){
  const r=await p.evaluate(id=>{
   const g=__game;artFixture();g.player.visible=true;g.regionId=id;g.regionSystem.setRegion(id);g.updateMood(100);g.setViewMode('third');
   const batches=g.landscape.batches.filter(b=>b.region===id&&b.mesh.visible),shape=batches.find(b=>b.mesh.geometry.userData.sculpted);
   const entry=shape.entries[0];g.player.position.set(entry.x+5,g.groundHeight(entry.x+5,entry.z+7),entry.z+7);
   const pos=g.player.position.clone().set(entry.x,entry.y,entry.z);g.camera.position.set(entry.x+8,entry.y+6,entry.z+11);g.camera.lookAt(entry.x,entry.y+2,entry.z);g.renderer.render(g.scene,g.camera);g.emit();
   return{id,shapes:batches.map(b=>b.mesh.geometry.userData.sculpted).filter(Boolean),instances:batches.reduce((n,b)=>n+b.mesh.count,0)};
  },id);
  assert.ok(r.shapes.length&&r.instances>0);proof.regions.push(r);
  if(out)await p.locator('#arena').screenshot({path:out+'/region-'+id+'.png'});
 }
 proof.crowd=await p.evaluate(()=>{
  const g=__game;artFixture();g.setQuality('high');g.setViewMode('overhead');g.player.visible=true;
  const kinds=[0,1,2,3,5,6,7,8,9];for(let i=0;i<160;i++){const a=i*2.399,r=5+i%15,e=g.spawnEnemy(Math.sin(a)*r,Math.cos(a)*r,kinds[i%kinds.length],{noMutations:true});e.speed=0;e.hp=e.maxHp=1e9;}
  g.updateCamera(1);g.renderer.render(g.scene,g.camera);const crowded={enemies:g.enemies.length,calls:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles,geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures};
  const resets=[];
  for(let n=0;n<4;n++){
   artFixture();for(let i=0;i<18;i++)g.spawnEnemy(Math.sin(i)*9,Math.cos(i)*9,kinds[i%9],{noMutations:true});g.updateCamera(1);g.renderer.render(g.scene,g.camera);
   resets.push({geometries:g.renderer.info.memory.geometries,textures:g.renderer.info.memory.textures,owned:g.ownedGeometries.size});
  }
  return{crowded,resets};
 });
 assert.equal(proof.crowd.crowded.enemies,160);assert.ok(proof.crowd.crowded.calls<500);
 assert.ok(proof.crowd.resets.every(r=>r.geometries===proof.crowd.resets[0].geometries&&r.textures===proof.crowd.resets[0].textures&&r.owned===proof.crowd.resets[0].owned));
 await p.setViewportSize({width:390,height:844});
 await p.evaluate(()=>{const g=__game;artFixture();g.setQuality('low');g.setViewMode('third');g.resize();g.updateCamera(1);g.renderer.render(g.scene,g.camera);});
 if(out)await p.screenshot({path:out+'/mobile-game.png'});
 assert.deepEqual(errors,[]);proof.errors=errors;
 if(out)await writeFile(out+'/silhouettes-verification.json',JSON.stringify(proof,null,2)+'\n');
 console.log('PASS authored hero/class/weapon silhouettes, 10 articulated monsters, 6 actual bosses, hidden models, 5 instanced regions, 160 actors, bounded repeated resets and mobile render',JSON.stringify(proof));
}finally{await browser.close();}
