import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';

const base=process.env.BASE_URL||'http://127.0.0.1:5301',out=process.env.SMOKE_OUTPUT;
if(out)await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],proof={};
function watch(p){p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(/Shader Error|GL_INVALID|THREE.WebGLProgram/.test(m.text()))errors.push(m.text());});}
async function fixture(p,style='default'){
  await p.evaluate(style=>{
    const g=window.__game;cancelAnimationFrame(g.raf);
    g.actions.reset();g.parry.reset();g.lockOn.reset();g.keys.clear();
    g.setPlaybackSpeed(1);
    for(const e of [...g.enemies])g.removeEnemyWithoutReward(e);
    g.spawnTimer=g.nextChestTime=g.nextEliteTime=g.nextGoldenTime=g.nextAltarTime=1e9;
    g.invulnerable=1e9;g._state.xpNeeded=1e15;
    g.stats.swordEvolution=style==='default'?'':style;g.stats.weaponId=style==='broadsword'?'greatsword':'voidblade';
    g.stats.swordRangeMultiplier=1;g.stats.critChance=0;
    g.stats.spells={fireball:1,frost:1,lightning:1,orbit:1};g.stats.skillSlots=['fireball','frost','lightning'];
    g.magic.cooldowns={fireball:0,frost:0,lightning:0,orbit:0};g.applyLoadoutAppearance();
    g.player.position.set(0,g.groundHeight(0,0),0);g.actions.setAim(g.player.position.clone().set(0,0,1));
    const enemy=z=>{const e=g.spawnEnemy(0,z,0,{noMutations:true});e.speed=0;e.hp=e.maxHp=1e8;e.tactics={phase:'circle',timer:1e9,angle:0};return e;};
    window.nearTarget=enemy(3.3);window.farTarget=enemy(5.5);window.rearTarget=enemy(-2);
    window.advance=t=>{for(let time=0;time<t-1e-9;time+=.005)g.advanceSimulation(Math.min(.005,t-time));g.emit();g.updateCamera(0);};
    g.emit();g.updateCamera(1);g.renderer.render(g.scene,g.camera);
  },style);
}
async function hold(p,selector,seconds){
  const b=await p.locator(selector).boundingBox();
  await p.mouse.move(b.x+b.width/2,b.y+b.height/2);await p.mouse.down();
  await p.evaluate(t=>window.advance(t),seconds);
  const during=await p.evaluate(()=>({commands:__game.actions.manualCommands,hp:nearTarget.hp,heavy:__game.actions.state().primaryHeavy,charge:__game.actions.charge}));
  await p.mouse.up();return during;
}
try{
  const p=await browser.newPage({viewport:{width:1280,height:900}});watch(p);
  await p.goto(base);await p.waitForFunction(()=>window.__game?.artReady);
  // A real menu click enables cursor UI before the same trusted start gesture.
  await p.locator('#screen-controls-toggle').click();await p.locator('#start-button').click();
  await fixture(p);
  proof.start=await p.evaluate(()=>({screen:__game.view.screenControls,locked:!!document.pointerLockElement,phase:__game._state.phase,commands:__game.actions.manualCommands,saved:JSON.parse(localStorage.getItem('voidrun.preferences')).screenControls}));
  assert.deepEqual(proof.start,{screen:true,locked:false,phase:'playing',commands:0,saved:true});
  assert.ok(await p.locator('#mobile-light').isVisible());
  const tap=await hold(p,'#mobile-light',.08);
  assert.equal(tap.commands,0);assert.equal(tap.hp,1e8);
  assert.equal(await p.evaluate(()=>__game.actions.current.heavy),false);
  await p.evaluate(()=>advance(.1));assert.equal(await p.evaluate(()=>nearTarget.hp),1e8);
  await p.evaluate(()=>advance(.2));
  proof.reach=await p.evaluate(()=>({range:__game.state.sword.range,near:nearTarget.hp,far:farTarget.hp,rear:rearTarget.hp,commands:__game.actions.manualCommands,visual:__game.effects.filter(e=>e.type==='slash').map(e=>e.mesh.geometry.parameters.outerRadius*e.mesh.scale.x)}));
  assert.equal(proof.reach.range,3.6);assert.ok(proof.reach.near<1e8);assert.equal(proof.reach.far,1e8);assert.equal(proof.reach.rear,1e8);
  assert.ok(proof.reach.visual.some(r=>Math.abs(r-3.6)<1e-6));
  proof.holds=[];
  for(const style of ['default','broadsword','twinblade','wave']){
    await fixture(p,style);
    const during=await hold(p,'#mobile-light',1.5);
    assert.equal(during.commands,0);assert.equal(during.hp,1e8);assert.ok(during.heavy);
    const released=await p.evaluate(()=>({heavy:__game.actions.current.heavy,cd:__game.actions.heavyCooldown,commands:__game.actions.manualCommands,charging:__game.actions.charging}));
    assert.deepEqual(released,{heavy:true,cd:4,commands:1,charging:false});
    await p.evaluate(()=>advance(2));
    const after=await p.evaluate(()=>({commands:__game.actions.manualCommands,hit:nearTarget.hp<1e8}));assert.deepEqual(after,{commands:1,hit:true});
    proof.holds.push({style,during,released,after});
  }
  await fixture(p);await p.evaluate(()=>__game.setPlaybackSpeed(3));
  await hold(p,'#mobile-light',.16);
  proof.fastTap=await p.evaluate(()=>({speed:__game.playbackSpeed,heavy:__game.actions.current.heavy,commands:__game.actions.manualCommands}));
  assert.deepEqual(proof.fastTap,{speed:3,heavy:false,commands:1});
  await fixture(p);
  await p.locator('[data-action-slot="0"]').click();
  const first=await p.evaluate(()=>({type:__game.actions.current.type,id:__game.actions.current.id,commands:__game.actions.manualCommands,locked:!!document.pointerLockElement}));
  assert.deepEqual(first,{type:'skill',id:'fireball',commands:1,locked:false});
  await p.evaluate(()=>advance(.8));
  assert.equal(await p.evaluate(()=>__game.magic.spellsCast.fireball),1);
  await p.locator('[data-action-slot="0"]').click();assert.equal(await p.evaluate(()=>__game.actions.manualCommands),1);
  for(const [slot,id] of [[1,'frost'],[2,'lightning'],[3,'ultimate']]){
    await p.locator(`[data-action-slot="${slot}"]`).click();
    assert.equal(await p.evaluate(()=>__game.actions.current.id),id);await p.evaluate(()=>advance(1.3));
  }
  await p.evaluate(()=>{__game.stats.skillSlots[2]='orbit';__game.emit();});
  await p.locator('[data-action-slot="2"]').click();await p.evaluate(()=>advance(1.2));
  assert.ok(await p.evaluate(()=>__game.magic.zones.some(z=>z.type==='rune')));
  proof.skills=await p.evaluate(()=>({casts:{...__game.magic.spellsCast},commands:__game.actions.manualCommands,locked:!!document.pointerLockElement}));
  assert.equal(proof.skills.commands,5);assert.equal(proof.skills.locked,false);
  await fixture(p);
  proof.drag=[];
  for(const mode of ['third','first']){
    await p.evaluate(mode=>__game.setViewMode(mode),mode);
    const box=await p.locator('canvas').boundingBox(),x=box.x+box.width*.55,y=box.y+box.height*.5;
    const before=await p.evaluate(()=>__game.player.rotation.y);
    await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+90,y+12,{steps:8});await p.mouse.up();
    const r=await p.evaluate(before=>{const g=__game;g.updateCamera(1/60);const d=g.player.position.clone();g.camera.getWorldDirection(d);d.setY(0).normalize();return{turned:Math.abs(g.player.rotation.y-before),aligned:d.dot(g.actions.direction()),commands:g.actions.manualCommands,locked:!!document.pointerLockElement};},before);
    assert.ok(r.turned>.2&&r.aligned>.999999&&r.commands===0&&!r.locked);proof.drag.push({mode,...r});
  }
  // Pointer cancellation and a modal interrupt both discard an unfinished hold.
  await fixture(p,'broadsword');
  const b=await p.locator('#mobile-light').boundingBox();await p.mouse.move(b.x+25,b.y+25);await p.mouse.down();await p.evaluate(()=>advance(.7));
  await p.locator('#mobile-light').dispatchEvent('pointercancel',{pointerId:1});await p.mouse.up();
  assert.equal(await p.evaluate(()=>__game.actions.manualCommands),0);
  await p.mouse.down();await p.evaluate(()=>advance(.6));await p.keyboard.press('b');await p.mouse.up();
  assert.equal(await p.evaluate(()=>__game.actions.primary),null);await p.keyboard.press('Escape');
  await p.evaluate(()=>advance(1));assert.equal(await p.evaluate(()=>__game.actions.manualCommands),0);
  // Selecting an upgrade stays cursor-friendly, including the final click.
  await p.evaluate(()=>{__game._state.xp=__game._state.xpNeeded;__game.openLevelUp();});
  await p.locator('[data-upgrade]').first().click();
  assert.equal(await p.evaluate(()=>__game._state.phase),'playing');assert.equal(await p.evaluate(()=>!!document.pointerLockElement),false);
  // Persistence and ordinary pointer-lock/left-hold mode remain available.
  await p.reload();await p.waitForFunction(()=>window.__game?.artReady);
  assert.equal(await p.evaluate(()=>__game.view.screenControls),true);
  await p.evaluate(()=>__game.setViewMode('third'));
  await p.locator('#screen-controls-toggle').click();await p.locator('#start-button').click();
  await p.waitForFunction(()=>!!document.pointerLockElement).catch(async e=>{throw new Error(e.message+' '+JSON.stringify(await p.evaluate(()=>({view:__game.view.getState(),phase:__game._state.phase,canCapture:__game.view.canCapture(),releasing:__game.view.releasing,pending:__game.view.lockPending,errors:document.querySelector('#canvas-error').textContent}))));});await fixture(p);
  await p.mouse.down();await p.evaluate(()=>advance(.5));
  assert.equal(await p.evaluate(()=>__game.actions.manualCommands),0);
  await p.mouse.up();assert.equal(await p.evaluate(()=>__game.actions.current.heavy),true);
  proof.pointerLock={locked:await p.evaluate(()=>!!document.pointerLockElement),heavy:true};
  await p.keyboard.press('Escape');
  // Genuine touchscreen events retain mobile steering and use the same hold.
  const m=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});watch(m);
  await m.goto(base);await m.waitForFunction(()=>window.__game?.artReady);await m.locator('#start-button').tap();await fixture(m,'broadsword');
  assert.equal(await m.evaluate(()=>__game.view.getState().inputMode),'touch');
  const cdp=await m.context().newCDPSession(m),btn=await m.locator('#mobile-light').boundingBox(),tx=btn.x+btn.width/2,ty=btn.y+btn.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:tx,y:ty}]});await m.evaluate(()=>advance(1.5));
  assert.equal(await m.evaluate(()=>__game.actions.manualCommands),0);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.equal(await m.evaluate(()=>__game.actions.current.heavy),true);
  await m.evaluate(()=>advance(2));await m.locator('[data-action-slot="0"]').tap();assert.equal(await m.evaluate(()=>__game.actions.current.id),'fireball');
  proof.layouts=[];
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    await m.setViewportSize(viewport);
    const layout=await m.evaluate(()=>{
      const ids=['mobile-light','mobile-heavy','mobile-parry','touch-dash'],nodes=[...ids.map(id=>document.getElementById(id)),...document.querySelectorAll('[data-action-slot]')];
      const rects=nodes.map(n=>({id:n.id||'skill'+n.dataset.actionSlot,...n.getBoundingClientRect().toJSON()}));
      return{width:innerWidth,height:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,rects};
    });
    assert.ok(layout.sw<=layout.width+1&&layout.sh<=layout.height+1);
    for(const r of layout.rects){assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.y>=0&&r.right<=layout.width+1&&r.bottom<=layout.height+1,JSON.stringify(r));}
    for(let i=0;i<layout.rects.length;i++)for(let j=i+1;j<layout.rects.length;j++){
      const a=layout.rects[i],b=layout.rects[j];assert.ok(a.right<=b.x+.1||b.right<=a.x+.1||a.bottom<=b.y+.1||b.bottom<=a.y+.1,'combat buttons must not overlap');
    }
    proof.layouts.push(layout);if(out)await m.screenshot({path:`${out}/trackpad-${viewport.width}.png`});
  }
  if(out){await p.goto(base);await p.waitForFunction(()=>window.__game?.artReady);await p.locator('#screen-controls-toggle').click();await p.locator('#start-button').click();await fixture(p);await p.screenshot({path:out+'/trackpad-desktop.png'});}
  assert.deepEqual(errors,[]);proof.errors=errors;
  if(out)await writeFile(out+'/trackpad-verification.json',JSON.stringify(proof,null,2)+'\n');
  console.log('PASS reachable attack/magic buttons, cursor mode/persistence, every weapon tap/hold, real range hits, cooldowns, cancel/choice, first/third camera, locked left hold and real mobile portrait/landscape',JSON.stringify(proof));
}finally{await browser.close();}
