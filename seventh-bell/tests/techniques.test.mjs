import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../src/game.js';
import {ATTACKS} from '../src/data.js';
import {enemy} from '../src/world.js';
import {registeredPose,worldBlade} from '../src/blade.js';

const tick=(g,t,input={})=>{for(let i=0;i<Math.ceil(t*120);i++)g.update(1/120,input);};
function scene(distance=45){const g=new Game();g.start();g.world.traps=[];const e=enemy('e90','watchman',g.p.x+distance,302);e.hp=e.maxHp=500;g.world.enemies=[e];g.updateEnemy=()=>{};return{g,e};}

test('all normal contacts last two 60Hz frames and damage only once per swing',()=>{for(const kind of ['light1','upper','light3','heavy']){const{g,e}=scene();const s=ATTACKS[kind];assert.ok(Math.abs(s.end-s.windup-2/60)<.000002);g.startAttack(kind);tick(g,s.windup-.01);assert.equal(e.hp,500);tick(g,1);assert.equal(e.hp,500-s.damage);assert.equal(g.lastHits.length,1);assert.ok(g.hitstop<=.1);}});
test('recovery jump and dodge cancel immediately, but cannot cancel live steel or a flask',()=>{for(const cancel of ['jump','dash']){const{g}=scene();g.world.enemies=[];g.press('attack');tick(g,ATTACKS.light1.windup+.01);assert.equal(g.canRecover(),false);if(cancel==='jump'){g.press('jump');g.update(1/120,{jump:true});assert.equal(g.p.action.kind,'light1');assert.equal(g.p.grounded,true);}else assert.equal(g.dash(),false);tick(g,.05);assert.equal(g.canRecover(),true);g.press(cancel);g.update(1/120,{jump:true});assert.equal(g.p.action?.kind,cancel==='dash'?'dash':undefined);if(cancel==='jump')assert.ok(g.p.vy<0);}
 const{g}=scene();g.p.hp=30;g.heal();assert.equal(g.dash(),false);g.press('jump');g.update(1/120,{jump:true});assert.equal(g.p.action.kind,'heal');assert.equal(g.profile.flasks,2);
});
test('dash attack is a long horizontal thrust, costs separately and stops at a wall',()=>{const{g,e}=scene(65);g.dash();tick(g,.035);assert.ok(g.press('attack'));assert.equal(g.p.action.kind,'thrust');assert.equal(g.p.stamina,68);assert.equal(registeredPose(g.p).angle,0);tick(g,1);assert.equal(e.hp,474);assert.equal(g.lastHits.length,1);
 const{g:h,e:t}=scene(65);h.world.platforms.push({x:h.p.x+25,y:180,w:14,h:122});h.dash();h.press('attack');tick(h,1);assert.ok(h.p.x<=206.01);assert.equal(t.hp,500);
});
test('up plus attack launches a normal enemy and permits a jump follow-up; bosses do not launch',()=>{const{g,e}=scene();assert.ok(g.press('attack',{up:true}));assert.equal(g.p.action.kind,'upper');for(let i=0;i<40&&!g.lastHits.length;i++)g.update(1/120);assert.equal(e.hp,478);assert.equal(e.vy,-255);assert.equal(e.grounded,false);for(let i=0;i<80&&(g.hitstop>0||!g.canRecover());i++)g.update(1/120);g.press('jump');g.update(1/120,{jump:true});assert.ok(g.p.vy<0);
 const{g:h,e:b}=scene();b.boss=true;h.world.boss=b;h.bossActive=true;h.updateBoss=()=>{};h.press('upper');tick(h,.3);assert.equal(b.vy,0);
});
test('plunge requires air, dives until a real landing and cannot duplicate damage on impact',()=>{const{g,e}=scene(4);assert.equal(g.press('plunge'),false);assert.equal(g.p.stamina,100);g.press('jump');tick(g,.2,{jump:true});assert.ok(g.press('attack',{down:true}));assert.equal(g.p.action.kind,'plunge');assert.equal(g.p.stamina,82);assert.equal(g.dash(),false);let diving=false;for(let i=0;i<70;i++){g.update(1/120);diving ||= g.p.vy>500;}assert.ok(diving);tick(g,.1);assert.equal(g.p.grounded,true);assert.equal(e.hp,464);assert.equal(g.lastHits.length,1);tick(g,1);assert.equal(e.hp,464);
});
test('a deep plunge survives beyond its ordinary animation duration and has no ranged shockwave',()=>{const{g,e}=scene(90);g.p.y=-700;g.p.grounded=false;g.press('plunge');tick(g,.65);assert.equal(g.p.action.kind,'plunge');assert.ok(g.p.y<0);const b=worldBlade(g.p);assert.ok(Math.abs(b.ax-b.bx)<.001);assert.ok(b.by>b.ay);tick(g,1);assert.equal(g.p.grounded,true);assert.equal(e.hp,500);assert.equal(g.lastHits.length,0);});
test('hold and release spends focus once, grants no healing and applies one charged hit',()=>{const{g,e}=scene();g.p.hp=42;assert.ok(g.beginCharge());tick(g,.6);assert.equal(g.p.stamina,100);assert.equal(g.p.action.ready,true);assert.equal(g.lastHits.length,0);assert.ok(g.releaseCharge());assert.equal(g.p.stamina,77);assert.equal(g.p.action.power,1.65);assert.equal(g.releaseCharge(),false);tick(g,1);assert.equal(e.hp,417);assert.equal(g.lastHits.length,1);assert.equal(g.p.hp,42);assert.equal(g.profile.flasks,3);
 const{g:h,e:t}=scene();h.beginCharge();tick(h,.05);h.releaseCharge();tick(h,1);assert.equal(t.hp,450);
});
test('charge cancellation, insufficient focus and input release after hurt cannot produce a free attack',()=>{for(const cancel of ['blur','dash','jump','hurt']){const{g,e}=scene();g.beginCharge();tick(g,.6);if(cancel==='blur')g.cancelCharge();if(cancel==='dash')g.dash();if(cancel==='jump'){g.press('jump');g.update(1/120,{jump:true});}if(cancel==='hurt'){g.p.invulnerable=0;g.hurt(10,e);}assert.equal(g.releaseCharge(),false);tick(g,1);assert.equal(e.hp,500);assert.equal(g.lastHits.length,0);}
 const{g}=scene();g.p.stamina=4;assert.equal(g.beginCharge(),false);assert.equal(g.p.stamina,4);assert.equal(g.p.action,null);
});
test('a successful timed parry opens one paid counter with metal feedback and no health refund',()=>{const{g,e}=scene(40),sounds=[];g.event=(type,p)=>{if(type==='sound')sounds.push(p.name);};g.p.invulnerable=0;g.p.hp=31;g.p.stamina=50;g.parry();tick(g,.08);assert.equal(g.hurt(30,e),false);assert.ok(g.p.counterReady>0);assert.ok(g.hitstop>=.05&&g.hitstop<=.1);assert.ok(sounds.includes('parryHit'));assert.ok(g.press('attack'));assert.equal(g.p.action.kind,'counter');assert.equal(g.p.counterReady,0);assert.equal(g.p.stamina,58);tick(g,1);assert.equal(e.hp,462);assert.equal(g.p.hp,31);assert.equal(g.lastHits.length,1);assert.equal(g.startAttack('counter'),false);
});
test('late or rear guard cannot earn a counter; a valid counter window expires',()=>{for(const late of [true,false]){const{g,e}=scene();g.p.invulnerable=0;g.parry();tick(g,late?.3:.08);if(!late)e.x=g.p.x-30;assert.equal(g.hurt(20,e),true);assert.equal(g.p.counterReady,0);}
 const{g,e}=scene();g.p.invulnerable=0;g.parry();tick(g,.08);g.hurt(20,e);tick(g,1.1);assert.equal(g.p.counterReady,0);g.press('attack');assert.equal(g.p.action.kind,'light1');
});
test('the downstroke deals 44 once and drives a grounded enemy farther with a heavier impact',()=>{
 const results={};for(const kind of ['light1','light3']){const{g,e}=scene(),sounds=[];g.updateEnemy=Game.prototype.updateEnemy;g.event=(type,p)=>{if(type==='sound')sounds.push(p.name);};const origin=e.x;g.startAttack(kind);assert.equal(g.p.stamina,kind==='light3'?85:92);let farthest=0,stop=0;for(let i=0;i<160;i++){g.update(1/120);farthest=Math.max(farthest,e.x-origin);stop=Math.max(stop,g.hitstop);if(kind==='light3'&&g.hitstop>0&&g.p.action?.kind==='light3')assert.ok(registeredPose(g.p).frame>=5,'the impact freezes the low follow-through, not the raised sword');}assert.equal(g.lastHits.length,1);assert.equal(e.hp,kind==='light3'?456:482);results[kind]={farthest,stop};if(kind==='light3')assert.ok(sounds.includes('slamHit'));}
 assert.ok(results.light3.farthest>40);assert.ok(results.light3.farthest>results.light1.farthest*3);assert.ok(results.light3.stop>.08&&results.light3.stop<=.1);assert.ok(results.light3.stop>results.light1.stop);
});
