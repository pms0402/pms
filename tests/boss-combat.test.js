import test from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_COMBAT, BOSS_PATTERNS, bossChain, bossWarning, bossDamageState, bossDamageMultiplier, limitBossDamage, chargeTravel, annulusWarning } from '../src/boss-combat.js';
import { bossPhase } from '../src/boss-phases.js';

test('boss defense rewards the end of a chain and a parry without compounding counter damage', () => {
  const boss={hp:1000,maxHp:1000,combatPhase:1};
  assert.equal(limitBossDamage(boss,100),60);
  assert.equal(limitBossDamage(boss,100,true),100);
  boss.recoveryTime=1.6;boss.chainRemaining=.55;
  assert.equal(bossDamageState(boss),'guard');
  boss.chainRemaining=0;
  assert.equal(limitBossDamage(boss,100),125);
  assert.equal(limitBossDamage(boss,100,true),125);
  boss.parryStun=.6;
  assert.equal(limitBossDamage(boss,100,true),135);
  boss.transitionTime=.75;
  assert.equal(bossDamageMultiplier(boss,true),0);
});

test('an oversized hit crosses one phase boundary, preserves HP and cannot skip a transition', () => {
  const boss={hp:1000,maxHp:1000,combatPhase:1};
  for(const phase of [2,3]){
    const before=boss.hp;
    boss.hp-=limitBossDamage(boss,1e12);
    assert.ok(boss.hp>0&&boss.hp<before);
    assert.equal(bossPhase(boss.hp,boss.maxHp),phase);
    boss.combatPhase=phase;boss.transitionTime=BOSS_COMBAT.transition;
    assert.equal(limitBossDamage(boss,1e12,true),0,'continued damage cannot bypass transition protection');
    boss.transitionTime=0;
  }
  assert.ok(limitBossDamage(boss,1e12)>boss.hp,'the final phase can actually be defeated');
  assert.equal(boss.maxHp,1000,'health is never scaled to the build');
});

test('phase and abyss attack chains remain bounded, alternating and reactable', () => {
  for(const [type,patterns] of Object.entries(BOSS_PATTERNS))for(const first of patterns){
    assert.deepEqual(bossChain(type,first,1,1),[first]);
    for(const [phase,variant,count] of [[2,1,2],[3,1,3],[1,50,2],[3,50,3]]){
      const chain=bossChain(type,first,phase,variant);
      assert.equal(chain.length,count);
      assert.equal(chain[0],first);
      chain.forEach((p,i)=>{assert.ok(patterns.includes(p));if(i)assert.notEqual(p,chain[i-1]);});
    }
  }
  for(const phase of [1,2,3])assert.ok(bossWarning(.8,phase)>=.78);
  assert.equal(chargeTravel(30),27);
  assert.equal(chargeTravel(1),9);
  assert.equal(chargeTravel(15),18);
});

test('annulus escape warning allows crossing from the arena rim at minimum run speed', () => {
  for(const distance of [7,12,20,26])for(const speed of [7.5,9,12]){
    const duration=annulusWarning(distance,speed,7);
    assert.ok(duration>=1.5&&duration<=5);
    assert.ok(duration*speed>=distance-6,'warning includes travel time and a reaction margin');
  }
});
