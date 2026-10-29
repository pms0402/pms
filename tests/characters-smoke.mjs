import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.BASE_URL||'http://127.0.0.1:5174');await page.waitForFunction(()=>window.__game?.frames>1);await page.locator('#start-button').click();
 const result=await page.evaluate(()=>{
  const g=window.__game;cancelAnimationFrame(g.raf);g.spawnTimer=g.attackTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e6;g.stats.spells={};g.stats.critChance=0;g._state.xpNeeded=1e9;
  let boxes=0,curved=0;g.playerVisual.traverse(m=>{if(m.isMesh){if(m.geometry.type==='BoxGeometry')boxes++;if(['SphereGeometry','CapsuleGeometry','LatheGeometry','TorusGeometry'].includes(m.geometry.type))curved++;}});
  g.playerHead.geometry.computeBoundingBox();const headBounds=g.playerHead.geometry.boundingBox;
  const adultRatio=(g.playerHead.position.y+headBounds.max.y)/(headBounds.max.y-headBounds.min.y);
  const design={adultRatio,hair:g.hairLocks.length,cloth:g.clothParts.length,metal:g.heroMaterials.armor.metalness,clothRoughness:g.heroMaterials.cloth.roughness};
  const before={knee:g.kneeLeft.rotation.x,arm:g.rightShoulder.rotation.x,cape:Array.from(g.cape.geometry.attributes.position.array)};g.setMoveInput(1,0);g.stepForTest(.2);g.setMoveInput(0,0);
  const walking={knee:g.kneeLeft.rotation.x,otherKnee:g.kneeRight.rotation.x,arm:g.rightShoulder.rotation.x,capeChanged:g.cape.geometry.attributes.position.array.some((n,i)=>Math.abs(n-before.cape[i])>.0001)};
  const e=g.spawnEnemy(g.player.position.x,g.player.position.z+2,0);e.hp=e.maxHp=1e6;e.speed=0;g.attack();g.stepForTest(.09);const attackPose={pitch:g.rightShoulder.rotation.x,yaw:g.rightShoulder.rotation.y,hp:e.hp};
  g.stats.attackRate=12;g.attackAnim=0;g.attack();const fastDuration=g.attackAnimTotal;
  const originalEnemyColor=g.mats.enemy.color.getHex(),originalArmor=g.mats.armor.color.getHex();g.stats.characterId='arcanist';g.stats.weaponId='greatsword';g.applyLoadoutAppearance();const longBlade=g.blade.scale.z;
  g.stats.swordEvolution='twinblade';g.applyLoadoutAppearance();const offhand=g.offhandBlade.visible&&g.offhandBlade.parent===g.offhandGrip&&g.offhandParts.every(m=>m.visible);
  const unchanged=g.mats.enemy.color.getHex()===originalEnemyColor&&g.mats.armor.color.getHex()===originalArmor;
  const child=g.spawnEnemy(10,0,1,{minion:true,splitChild:true});const childGroup=child.group,childHp=child.maxHp,childSpeed=child.speed;g.hitEnemy(child,child.hp+1,g.player.position.clone().set(1,0,0),'magic');
  const wolf=g.spawnEnemy(10,0,1);const wolfDifferent=wolf.group!==childGroup&&wolf.visualKind===1;const another=g.spawnEnemy(11,0,1,{minion:true,splitChild:true});
  const childPool=another.group===childGroup&&another.visualKind===7&&another.maxHp===childHp&&another.speed===childSpeed;
  const models=[0,1,2,3,4,5,6,7,8,9].map((kind,i)=>{const enemy=g.spawnEnemy(12+i*.5,5,kind);let vertices=0;for(const m of enemy.visual.children)vertices+=m.geometry.attributes.position.count;return{kind,parts:enemy.visual.children.length,vertices};});
  const meshCount=g.playerVisual.children.length;for(let i=0;i<20;i++)g.applyLoadoutAppearance();const stableParts=g.playerVisual.children.length===meshCount;
  g.renderer.render(g.scene,g.camera);return{boxes,curved,design,before:{knee:before.knee,arm:before.arm},walking,attackPose,fastDuration,longBlade,offhand,unchanged,wolfDifferent,childPool,models,stableParts,draw:g.renderer.info.render.calls};
 });
 assert.equal(result.boxes,0,'player is built from curved surfaces rather than cubes');assert.ok(result.design.adultRatio>6.5&&result.design.hair===3&&result.design.cloth===5&&result.design.metal>.6&&result.design.clothRoughness>.8);assert.ok(result.walking.knee!==result.before.knee||result.walking.otherKnee!==result.before.knee);assert.ok(result.walking.capeChanged);assert.ok(result.attackPose.pitch<-.25&&Math.abs(result.attackPose.yaw)>.05&&result.attackPose.hp<1e6);assert.ok(result.fastDuration>=.13&&result.fastDuration<=.15,'fast hits keep a readable full visual stroke');assert.ok(result.longBlade>1.3&&result.offhand&&result.unchanged&&result.stableParts);assert.ok(result.wolfDifferent&&result.childPool);assert.ok(result.models.every(m=>m.parts<=7&&m.vertices>600));assert.ok(result.draw<500);assert.deepEqual(errors,[]);
 console.log('PASS curved player anatomy, articulated gait and swing, folded cloth, correct equipment parents, coherent monster templates and isolated slime-child pooling',JSON.stringify(result));
}finally{await browser.close();}
