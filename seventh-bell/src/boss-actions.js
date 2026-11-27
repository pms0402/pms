import {attackSeconds,recoverySeconds} from './boss-tempo.js';
// Timers describe presentation. Actual behaviour lives in the boss's controller,
// not in a shared combination of wave/shot/pillars/speed/twice flags.
const attack=(owner,name,row,windup,active,recover,damage,ideal,extra={})=>({owner,name,row,windup:attackSeconds(windup),active:attackSeconds(active),recover:recoverySeconds(recover),damage,ideal,native:true,...extra});
export const BOSS_ACTIONS={
 gateShield:attack('edran','성문 방패',1,.95,1.55,1.2,30,90,{guard:true}),
 gateBlade:attack('edran','수평 대검격',2,1.05,.34,1.4,42,95),
 gateRift:attack('edran','성벽 내려찍기',3,1.4,.35,1.8,49,100),
 gateRush:attack('edran','기사 돌격',4,1.2,.95,1.5,44,270),
 gateCounter:attack('edran','방패 반격',5,1.05,.32,1.4,38,70,{guard:true}),
 knightThree:attack('edran','버린 방패',7,1.15,2.25,1.85,42,100,{phase:2}),
 soundRing:attack('marie','음파 고리',1,1.2,.3,1.5,38,180),
 choirShards:attack('marie','성가의 파편',2,1.25,.55,1.5,35,260),
 silentGround:attack('marie','침묵의 영역',3,1.35,.35,1.55,0,140),
 voiceStairs:attack('marie','목소리의 계단',4,1.5,.5,1.7,0,250),
 reversePeal:attack('marie','역방향 종소리',5,1.55,.4,1.75,40,230),
 anvilStrike:attack('brag','모루 내려찍기',1,1.45,.35,1.95,54,90),
 moltenFlow:attack('brag','달아오른 쇳물',2,1.7,.5,1.8,35,300),
 chainCast:attack('brag','쇠사슬 투척',3,1.35,.4,1.7,49,240),
 metalSpray:attack('brag','뜨거운 금속 조각',4,1.4,.4,1.7,39,240),
 overheat:attack('brag','용광로 과열',5,1.55,.4,1.75,22,110),
 recordBlades:attack('leonel','기록의 칼날',1,1.35,.7,1.6,42,230),
 eraseSentence:attack('leonel','지워지는 문장',2,1.5,.4,1.7,0,180),
 bookMaze:attack('leonel','책장 미로',3,1.55,.4,1.7,0,220),
 futureRecord:attack('leonel','미래의 기록',4,1.4,.4,1.65,48,220),
 invertedPage:attack('leonel','뒤집힌 페이지',5,1.5,.4,1.85,0,160),
 royalFirst:attack('arkein','왕의 첫 번째 검',1,1.05,1.25,1.55,54,100),
 dawnThrust:attack('arkein','새벽의 찌르기',2,1.1,.4,1.55,58,180),
 royalGuard:attack('arkein','왕실 검술: 반격 자세',3,1.05,1.6,1.4,56,80,{guard:true}),
 royalProcession:attack('arkein','왕의 행진',4,1.35,2.5,1.8,54,270),
 artificialDawn:attack('arkein','인공 여명',5,1.7,.4,1.9,59,220),
 royalFour:attack('arkein','왕의 마지막 검',7,1.25,3.1,2.35,60,110,{phase:2}),
 anchorThrow:attack('neris','닻 투척',1,1.35,.4,1.7,60,280),
 hookPull:attack('neris','갈고리 당기기',2,1.3,.4,1.7,51,230),
 risingTide:attack('neris','밀물',3,1.8,.5,1.9,22,230),
 lighthouseAim:attack('neris','등대 조준',4,1.85,.5,1.95,62,270),
 ropeOrbit:attack('neris','밧줄 회전',5,1.4,.6,1.8,59,80),
 bellVibration:attack('carillon','종의 진동',1,1.5,1.8,1.85,58,220),
 leftAttack:attack('carillon','남겨진 공격',2,1.45,.4,1.75,64,100),
 resonanceClones:attack('carillon','공명의 분신',3,1.7,.5,1.85,0,210),
 gearRotation:attack('carillon','종축 회전',4,1.8,.5,1.9,0,220),
 seventhPeal:attack('carillon','일곱 번째 울림',5,1.9,6.4,2.8,65,200)
};
export const ACTION_SETS={
 edran:[['gateShield','gateBlade','gateRift','gateRush','gateCounter'],['knightThree','gateBlade','gateRift','gateRush']],
 marie:[['soundRing','choirShards','silentGround','voiceStairs','reversePeal'],['voiceStairs','choirShards','reversePeal','soundRing','silentGround']],
 brag:[['anvilStrike','moltenFlow','chainCast','metalSpray','overheat'],['overheat','chainCast','anvilStrike','moltenFlow','metalSpray']],
 leonel:[['recordBlades','eraseSentence','bookMaze','futureRecord','invertedPage'],['futureRecord','bookMaze','recordBlades','invertedPage','eraseSentence']],
 arkein:[['royalFirst','dawnThrust','royalGuard','royalProcession','artificialDawn'],['royalFour','royalFirst','dawnThrust','royalGuard','royalProcession','artificialDawn']],
 neris:[['anchorThrow','hookPull','risingTide','lighthouseAim','ropeOrbit'],['risingTide','anchorThrow','lighthouseAim','hookPull','ropeOrbit']],
 carillon:[['bellVibration','leftAttack','resonanceClones','gearRotation','seventhPeal'],['leftAttack','gearRotation','resonanceClones','bellVibration','seventhPeal']]
};
export function selectBossAction(g,e){const list=ACTION_SETS[e.id][e.phase-1],distance=Math.abs(g.p.x-e.x),history=e.history||[],fields=(g.combatFields||[]).filter(f=>f.owner===e.id);
 const candidates=list.filter(id=>{
  if(id==='ropeOrbit'&&e.anchorOut)return false;if(id==='royalFour'&&e.hp>e.maxHp*.27)return false;
  if(id==='gateCounter'&&!e.queuedRiposte)return false;if(id==='voiceStairs'&&(g.arenaPlatforms||[]).filter(p=>p.owner===e.id).length)return false;
  if(id==='seventhPeal'&&((g.arenaClones||[]).some(c=>c.hp>0)||fields.some(f=>f.damage>0)))return false;
  if(id==='resonanceClones'&&((g.arenaClones||[]).length||fields.filter(f=>f.damage>0).length>1))return false;if(id==='gearRotation'&&(g.arenaPlatforms||[]).some(p=>p.orbit))return false;
  if(['risingTide','moltenFlow','silentGround','eraseSentence','overheat'].includes(id)&&fields.some(f=>f.pattern===id))return false;
  if(id==='overheat'&&(e.overheatUntil>g.clock||e.cooledUntil>g.clock))return false;
  return true;
 });
 let best=null,score=-Infinity;
 for(const id of candidates){const a=BOSS_ACTIONS[id],last=history.at(-1),prior=history.at(-2);let n=15-Math.abs(distance-a.ideal)/55-(last===id?13:prior===id?6:0);
  if(id==='gateCounter'&&e.queuedRiposte)n+=16;
  if(id==='royalProcession'&&distance>220)n+=6;if(id==='royalGuard'&&distance<95)n+=3;
  if(id==='voiceStairs'&&e.phase===2)n+=4;if(id==='seventhPeal'&&e.hp<e.maxHp*.27)n+=5;
  n+=((e.attackIndex*7+list.indexOf(id)*11)%9)*.12;
  if(n>score){score=n;best=id;}
 }
 return best||list[0];
}
