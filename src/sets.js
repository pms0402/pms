import * as THREE from 'three';
export const SETS=Object.freeze([
{id:'inferno',name:'화염 군주',color:'#ff9c5b',two:'화염 피해 +15%',four:'화염 직접 적중 시 15% 확률 폭발 · 3초 간격 · 최대 5명'},
{id:'glacier',name:'빙결 수호자',color:'#93eaff',two:'서리 피해 +15% · 서리 둔화 +5%p · 지속 +10%',four:'둔화 적 직접 타격 시 서리 확산 · 2.5초 간격 · 최대 4명'},
{id:'stalker',name:'공허 추적자',color:'#cc96ff',two:'치명타 확률 +5%p',four:'대시 후 2.5초간 검 속도 +20%'},
{id:'abyss',name:'심연 기사',color:'#b9c6e5',two:'최대 체력 +12% · 피해 감소 +3%p',four:'패링 성공 시 최대 체력 12% 보호막 · 5초 지속 · 8초 간격'},
{id:'storm',name:'폭풍 현자',color:'#ffe38c',two:'번개 피해 +18%',four:'연쇄 번개 전파 대상 +1'}
]);
export function activeSets(items=[]){const bySlot=new Map(items.filter(i=>i&&SETS.some(s=>s.id===i.setId)).map(i=>[i.slot,i]));return SETS.map(s=>({...s,count:[...bySlot.values()].filter(i=>i.setId===s.id).length})).filter(s=>s.count>0);}
export function rollSet(region,random=Math.random){const n=Math.max(0,Math.min(.99999,Number(random())||0));if(n>=.45)return '';const preferred={volcano:'inferno',tundra:'glacier',forest:'abyss',ruins:'storm',void:'stalker'}[region];return n<.3&&preferred?preferred:SETS[Math.min(4,Math.floor(n/.45*5))].id;}
export class SetSystem{
 constructor(game){this.game=game;this.geometry=new THREE.RingGeometry(.88,1,40);this.material=new THREE.MeshBasicMaterial({color:'#d4db8f',transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.rotation.x=-Math.PI/2;this.mesh.visible=false;game.scene.add(this.mesh);this.reset();}
 count(id){return this.game.equipment.bonuses().sets?.find(s=>s.id===id)?.count||0;}
 damage(spell){return spell==='fireball'&&this.count('inferno')>=2?1.15:spell==='frost'&&this.count('glacier')>=2?1.15:spell==='lightning'&&this.count('storm')>=2?1.18:1;}
 onDash(){if(this.count('stalker')>=4)this.hasteUntil=this.game._state.elapsed+2.5;}
 onParry(){const t=this.game._state.elapsed;if(this.count('abyss')>=4&&t>=this.nextShield){this.shield=this.game.combatStats.maxHp*.12;this.shieldUntil=t+5;this.nextShield=t+8;}}
 absorb(damage){if(this.count('abyss')<4||this.game._state.elapsed>=this.shieldUntil)this.shield=0;const used=Math.min(this.shield,damage);this.shield-=used;return used;}
 onHit(enemy,source,spell){if(!['sword','magic'].includes(source))return;const g=this.game,t=g._state.elapsed;let color,radius,count,amount;
 if(spell==='fireball'&&this.count('inferno')>=4&&t>=this.nextFire&&Math.random()<.15){this.nextFire=t+3;color='#ff9c5b';radius=2.6;count=5;amount=.3;}
 else if(enemy.slowTime>0&&this.count('glacier')>=4&&t>=this.nextFrost){this.nextFrost=t+2.5;color='#93eaff';radius=2.5;count=4;amount=.25;}
 if(!color)return;const p=enemy.group.position.clone();g.magic.ring(p,radius,spell==='fireball'?'fireball':'frost',.35,.65);for(const e of g.queryEnemies(p,radius).slice(0,count))g.hitEnemy(e,g.combatStats.spellDamage*amount,undefined,'set',null,{knockbackScale:0,hitStun:0,analyticsSource:'set'});}
 update(){const sets=this.game.equipment.bonuses().sets||[],active=sets.find(s=>s.count>=2);this.mesh.visible=!!active;if(active){this.material.color.set(active.color);this.mesh.position.copy(this.game.player.position);this.mesh.position.y+=.09;this.mesh.scale.setScalar(active.count>=4?1.5:1.1);this.mesh.rotation.z=this.game._state.elapsed*.4;}if(this.game._state.elapsed>=this.shieldUntil)this.shield=0;}
 reset(){this.hasteUntil=this.nextFire=this.nextFrost=this.nextShield=this.shield=this.shieldUntil=0;if(this.mesh)this.mesh.visible=false;}
 state(){return {sets:this.game.equipment.bonuses().sets||[],shield:this.shield,haste:Math.max(0,this.hasteUntil-this.game._state.elapsed)};}
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
