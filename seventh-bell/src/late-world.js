import {mapX} from './layout.js';
import {makeTrap} from './traps.js';

// Chapters six and seven append to the old world. Nothing in an existing save
// changes coordinates. Every visible walkway below has an actual collider.
export function appendLateWorld(world,enemy){
 const floor=(x,y,w,material='harbor',extra={})=>world.platforms.push({x:mapX(x),y,w,h:1800,foundation:true,tile:material==='harbor'?0:2,material,...extra});
 const step=(x,y,w,material='harbor',extra={})=>floor(x,y,w,material,{h:18,foundation:false,oneway:true,tile:material==='harbor'?1:2,...extra});
 const object=(id,type,x,y,label,extra={})=>world.objects.push({id,type,x:mapX(x),y,label,...extra});
 const gate=(id,x,y=100,h=202)=>world.gates.push({id,x:mapX(x),y,w:46,h});
 const decor=(type,x,y,s=1)=>world.scenery.push({type,x:mapX(x),y,s});
 const mob=(n,type,x,y,rank)=>world.enemies.push(enemy('e'+n,type,mapX(x),y,rank));
 const trap=(id,type,x,y,chapter,offset=0)=>world.traps.push(makeTrap(id,type,mapX(x),y,chapter,offset));

 // Dockside street, drained lock chamber, upper cargo route, lighthouse yard.
 floor(22400,302,1200);floor(23600,430,700);floor(24300,302,2600);
 // The lighthouse arena stays level; jump gaps sit outside its barriers.
 floor(26900,302,100);floor(27000,302,800);
 for(const[x,y,w]of[[23570,342,100],[23650,386,110],[24050,386,110],[24180,340,110],[24270,302,100],
 [24900,268,110],[25030,222,110],[25160,176,150],[25350,222,110],[25480,268,110]])step(x,y,w);
 // The old tide becomes a route after Neris. It returns above the dry lock.
 step(23650,282,110,'harbor',{echo:true,tide:true});step(23800,216,110,'harbor',{echo:true,tide:true});step(23950,150,220,'harbor',{echo:true,tide:true});
 object('dockkeeper','dockkeeper',22840,302,'부두지기의 이야기');
 object('harbor-winch','dockwinch',23880,430,'수문 권양기 돌리기',{flag:'harborLock'});
 object('stranded-worker','dockworker',24090,430,'갇힌 인부 부르기');
 object('harborcache','chest',25220,176,'네리스의 항해 일지',{late:true});
 object('tidecache','chest',24080,150,'밀물이 덮었던 연결함',{late:true,echo:true,tide:true});
 object('lighthouse-beacon','beacon',25990,302,'등대의 불 살펴보기');
 gate('royal-harbor',22400);gate('harbor-lock',24420);gate('sixth-bell',27750);
 for(const[x,y,s]of[[22680,302,.8],[23260,302,1],[23700,430,.8],[24510,302,.7],[25120,302,.8],[25560,302,1],[27470,302,.7]])decor('dockcargo',x,y,s);
 decor('beacon',26030,302,1.4);decor('dockwinch',27270,302,.9);
 for(const[n,type,x,y]of[[42,'watchman',23280,302],[43,'cantor',23700,430],[44,'watchman',24220,430],[45,'wisp',24780,280],[46,'cantor',25380,302],[47,'watchman',25690,302]])mob(n,type,x,y,5);
 trap('dock-spikes','spikes',23180,302,6);trap('dock-chain','pendulum',24720,302,6,.6);trap('dock-press','crusher',25520,302,6,.4);

 // A second chamber opens the tower, then a raised lens route crosses the gears.
 floor(27800,302,1100,'tower');floor(28900,430,700,'tower');floor(29600,302,4000,'tower');
 for(const[x,y,w]of[[28870,342,100],[28960,386,110],[29350,386,110],[29470,340,110],[29560,302,100],
 [30280,268,110],[30410,222,110],[30540,176,180],[30750,222,110],[30880,268,110]])step(x,y,w,'tower');
 object('tower-resonator','resonator',29170,430,'아래층 종축 연결하기',{flag:'towerSeal'});
 object('tower-lens','towerlens',30620,176,'등대의 렌즈 맞추기',{flag:'towerLens'});
 object('conductor-notes','lectern',31090,302,'누나가 남긴 조율 수첩');
 object('towercache','chest',29420,430,'분배 장치의 남은 부품',{late:true});
 object('resonancecache','chest',31260,70,'종 안쪽의 작은 함',{late:true,resonance:true});
 step(31080,240,100,'tower');step(31190,150,100,'tower',{resonance:true});step(31210,70,150,'tower',{resonance:true});
 gate('tower-seal',29750);gate('tower-lens-gate',31420);
 object('seventh-bell','ending',33300,302,'누나의 이름 부르기');
 for(const[x,y,s]of[[28190,302,1.2],[28640,302,.9],[28970,430,1],[29800,302,.8],[30310,302,1.2],[30840,302,.9],[31620,302,1.3],[33090,302,1.2]])decor('gearwheel',x,y,s);
 decor('resonator',32250,302,1.6);
 for(const[n,type,x,y]of[[48,'watchman',28400,302],[49,'cantor',29030,430],[50,'wisp',29370,408],[51,'watchman',30180,302],[52,'cantor',30790,302],[53,'watchman',31270,302]])mob(n,type,x,y,6);
 trap('tower-spikes','spikes',28300,302,7);trap('tower-pendulum','pendulum',29900,302,7,.8);trap('tower-press','crusher',30990,302,7,.3);
 // Small jumpable gaps do not sit beneath gates, checkpoints or mechanisms.
 for(const[a,b]of[[25000,25080],[28480,28560],[30100,30180]])world.platforms=world.platforms.flatMap(p=>{
  const l=mapX(a),r=mapX(b);if(p.y!==302||p.oneway||p.x>=r||p.x+p.w<=l)return[p];
  return[...(p.x<l?[{...p,w:l-p.x}]:[]),...(p.x+p.w>r?[{...p,x:r,w:p.x+p.w-r}]:[])];
 });
}
