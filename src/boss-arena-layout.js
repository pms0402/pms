import {TerrainLayout} from './terrain-layout.js';

export const BOSS_ARENAS=Object.freeze({
  warden:{title:'무너진 왕성 투기장',epithet:'성벽의 마지막 파수꾼',region:'ruins',color:'#d5ac76',rule:'기둥 뒤로 돌진을 유도하면 수호자의 자세가 무너집니다.',change:'성벽 붕괴 · 외곽 회피로 개방',motif:[55,82.4,65.4,49]},
  artillery:{title:'검은 포격 요새',epithet:'왕국을 침묵시킨 포수',region:'volcano',color:'#edaa70',rule:'엄폐물은 포탄을 막지만 두 차례 포격에 무너집니다. 계단으로 고지를 바꾸세요.',change:'포대 격벽 붕괴 · 측면 통로 개방',motif:[41.2,61.7,46.25,55]},
  plague:{title:'침수된 역병 신전',epithet:'썩어가는 성소의 주인',region:'forest',color:'#b3c989',rule:'늪 분출을 피해 높은 제단과 십자 회랑으로 이동하세요.',change:'독성 수로 개방 · 중앙 회랑은 안전',motif:[49,58.27,51.91,73.42]},
  brood:{title:'사방의 군단 제단',epithet:'이름 없는 군세의 목소리',region:'ruins',color:'#c9a8df',rule:'빛나는 소환문에서 군단이 출현합니다. 중앙과 외곽 회랑이 연결됩니다.',change:'봉인된 측면 소환문 개방',motif:[55,65.4,82.4,73.42]},
  storm:{title:'뇌명의 첨탑 정상',epithet:'벼락을 왕관으로 쓴 자',region:'tundra',color:'#a9d9ef',rule:'도체 옆의 푸른 원은 전장 낙뢰를 흘려보냅니다. 붉은 예고 원을 피하세요.',change:'첨탑 도체 과부하 · 낙뢰 증가',motif:[73.42,110,82.4,98]},
  reaper:{title:'뒤틀린 폐허 궁전',epithet:'공간의 틈에서 거두는 자',region:'void',color:'#c7a3ed',rule:'망령은 빛나는 균열로 도약합니다. C로 균열을 사용해 추적하거나 이탈하세요.',change:'궁전 격벽 해제 · 새로운 균열 활성',motif:[61.74,92.5,65.4,82.4]},
  king:{title:'잿빛 왕의 왕좌',epithet:'왕관을 버리지 못한 검',region:'ruins',color:'#e7ca85',rule:'계단 양쪽으로 왕좌를 우회하세요. 검격은 파란 예고, 지형 공격은 붉은 예고입니다.',change:'왕좌의 봉인 붕괴 · 양쪽 회랑 개방',motif:[65.4,98,82.4,73.42]},
  observer:{title:'공허 관측 성환',epithet:'모든 결말을 지켜본 눈',region:'void',color:'#d7b7f1',rule:'관측 오벨리스크를 엄폐로 활용하고 도약 지점의 예고를 확인하세요.',change:'관측 격벽 해제 · 시선 통로 변화',motif:[51.91,77.78,69.3,103.83]},
  primordial:{title:'태초의 심연 성소',epithet:'빛 이전에 깨어 있던 것',region:'void',color:'#eda0b2',rule:'거대한 고리 공격은 중앙 안전 원으로 피하세요. 방사형 회랑으로 복귀할 수 있습니다.',change:'심연의 봉인 해제 · 외곽 파문 활성',motif:[36.71,55,43.65,49]},
});

/** Authored connected floors. Phase changes only remove barriers; no floor disappears. */
export class BossArenaLayout extends TerrainLayout {
  constructor(id){super('boss:'+id);}
  build(){
    this.id=this.region.slice(5);this.definition=BOSS_ARENAS[this.id]||BOSS_ARENAS.warden;this.region=this.definition.region;
    this.title=this.definition.title;this.arena=true;this.radius=30;this.phase=1;this.legacySolids=[];this.spawnGates=[];this.rifts=[];this.safe=[];
    this.anchors.push({id:'safe-arena',x:0,z:0,y:0},{id:'player',x:0,z:14,y:0},{id:'boss',x:0,z:-6,y:0});
    // Octagonal retaining walls have real collision, and always enclose a broad court.
    for(let n=0;n<8;n++){const a=n*Math.PI/4,x=Math.sin(a)*30.2,z=Math.cos(a)*30.2;
      this.wall('boundary:'+n,x,z,n%2?5.8:n%4===0?12:.8,n%2?5.8:n%4===0?.8:12,-2,6,{boundary:true});}
    const cover=(id,x,z,hx=1.2,hz=1.2,h=5,phase=0)=>{const s=this.wall(id,x,z,hx,hz,0,h,{breakable:true,hp:300,initialHp:300,bossHits:2,phaseRemove:phase,cover:true});this.breakables.push(s);return s;};
    const terrace=(id,x,z,hx,hz,y,axis='x')=>{
      this.deck(id,x,z,hx,hz,y,{citadel:true});
      this.wall(id+':foundation',x,z,hx,hz,-1,y,{foundation:true,slab:true});
      const side=axis==='x'?Math.sign(x)||1:Math.sign(z)||1,half=axis==='x'?hx:hz,length=Math.max(8,y*5.5),cx=x-(axis==='x'?side*(half+length/2):0),cz=z-(axis==='z'?side*(half+length/2):0);
      this.stair(id+':stairs',cx,cz,axis==='x'?length/2:4,axis==='z'?length/2:4,side>0?0:y,side>0?y:0,axis);
      this.anchors.push({id,x,z,y});
    };
    if(this.id==='warden'){
      for(const x of [-9,9])for(const z of [-8,8])cover('buttress:'+x+':'+z,x,z,1.25,1.25,7);
      for(const side of [-1,1]){terrace('spectator:'+side,side*23,-2,3,11,2.1);cover('collapsed-wall:'+side,side*16,11,.7,4,4,2);}
    }else if(this.id==='artillery'){
      for(const side of [-1,1]){terrace('bastion:'+side,side*22,0,4,9,2.4);for(const z of [-9,8])cover('bulwark:'+side+':'+z,side*8,z,2.3,1,4.5);cover('siege-gate:'+side,side*15,14,.65,3.3,5,2);}
    }else if(this.id==='plague'){
      this.deck('temple-causeway-x',0,0,25,2.6,.3);this.deck('temple-causeway-z',0,0,2.6,25,.3);
      terrace('sanctuary',0,-21,8,4,2.1,'z');
      for(const x of [-1,1])for(const z of [-1,1]){this.dangers.push({id:'sump:'+x+':'+z,x:x*13,z:z*12,hx:6,hz:5,y:0});cover('temple-column:'+x+':'+z,x*21,z*12,.9,.9,8);}
      for(const side of [-1,1])cover('sluice:'+side,side*12,0,.7,4.2,3.8,2);
    }else if(this.id==='brood'){
      terrace('summoning-dais',0,-9,5,4,1.2,'z');
      for(let n=0;n<4;n++){const a=n*Math.PI/2,x=Math.sin(a)*23,z=Math.cos(a)*23;this.spawnGates.push({x,z,y:0});cover('altar-seal:'+n,x,z,n%2?.65:3,n%2?3:.65,7,n<2?2:3);}
      for(const side of [-1,1])terrace('altar-wing:'+side,side*21,-12,3,5,1.8);
    }else if(this.id==='storm'){
      terrace('summit',0,-22,9,4,2.4,'z');
      for(const x of [-1,1])for(const z of [-1,1]){cover('conductor:'+x+':'+z,x*17,z*13,.8,.8,9);this.safe.push({x:x*17,z:z*13,radius:4.2});}
      for(const side of [-1,1])cover('spire-gate:'+side,side*12,0,.65,4,4,2);
    }else if(this.id==='reaper'||this.id==='observer'){
      for(const side of [-1,1]){terrace('palace-gallery:'+side,side*22,0,4,10,2.1);for(const z of [-11,11])cover('palace-pier:'+side+':'+z,side*10,z,1,1,8);cover('palace-shutter:'+side,side*13,17,.65,4,5,2);}
      for(let n=0;n<4;n++){const a=n*Math.PI/2+Math.PI/4;this.rifts.push({id:'rift:'+n,x:Math.sin(a)*18,z:Math.cos(a)*18,y:0,phase:n<2?1:3});}
    }else if(this.id==='king'){
      terrace('throne',0,-22,8,4,2.7,'z');for(const side of [-1,1]){terrace('royal-gallery:'+side,side*22,0,3,9,2.1);cover('royal-seal:'+side,side*13,-4,.7,6,6,2);for(const z of [-14,12])cover('royal-pillar:'+side+':'+z,side*18,z,1,1,9);}
    }else{
      for(const x of [-1,1])for(const z of [-1,1])cover('primordial-seal:'+x+':'+z,x*17,z*14,1,1,9,2);
      for(const side of [-1,1])terrace('abyss-sanctuary:'+side,side*23,0,3,6,1.8);
      this.safe.push({x:0,z:0,radius:4});
    }
    for(const a of this.anchors)a.y=this.height(a.x,a.z);
  }
  ground(){return 0;}
  candidates(x,z){return super.candidates(x,z).slice(0,1);}
  reserved(){return true;}
  canStand(x,z,y,r=.65,h=3.6){return Math.hypot(x,z)<=this.radius-r&&super.canStand(x,z,y,r,h);}
  district(){return this.title;}
  advance(phase){
    if(phase<=this.phase)return [];this.phase=Math.min(3,phase);const removed=[];
    for(const s of this.breakables)if(!s.disabled&&s.phaseRemove&&s.phaseRemove<=phase){s.disabled=true;removed.push(s);}
    if(removed.length)this.revision++;return removed;
  }
  bossImpact(id){const s=this.breakables.find(s=>s.id===id&&!s.disabled);if(!s)return null;s.bossHits--;if(s.bossHits<=0){s.disabled=true;this.revision++;}return s;}
  riftTarget(from,phase=this.phase){return this.rifts.filter(r=>r.phase<=phase).sort((a,b)=>Math.hypot(b.x-from.x,b.z-from.z)-Math.hypot(a.x-from.x,a.z-from.z))[0];}
}
