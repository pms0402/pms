import {terrainHeight,WORLD_COLLIDERS,STRUCTURES,WORLD_RADIUS} from './terrain.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const inside=(r,x,z,pad=0)=>Math.abs(x-r.x)<=r.hx+pad&&Math.abs(z-r.z)<=r.hz+pad;
const rectangle=(id,x,z,hx,hz,extra={})=>({id,x,z,hx,hz,type:'rect',...extra});
export const TERRAIN_NAMES=Object.freeze({sanctum:'성역의 입체 회랑',volcano:'검은 협곡과 용암 다리',tundra:'빙하 호수와 얼음 동굴',forest:'뿌리 미로와 숨은 샛길',ruins:'상층 성벽과 지하 회랑',void:'떠 있는 군도와 균열 교량',throne:'종말의 성벽'});

/** Original height field is preserved outside the authored regional districts. */
export class TerrainLayout {
  constructor(region='sanctum',variant=0){
    this.region=region;this.variant=((variant%3)+3)%3;this.revision=0;
    this.patches=[];this.surfaces=[];this.solids=[];this.props=[];this.interactions=[];this.breakables=[];this.anchors=[];this.dangers=[];
    this.title=TERRAIN_NAMES[region]||TERRAIN_NAMES.sanctum;
    this.legacySolids=WORLD_COLLIDERS.map(c=>{const s=STRUCTURES.find(s=>s.id===c.id),b=terrainHeight(c.x,c.z);return{...c,minY:b-.4,maxY:b+(s?.height||6),legacy:true};});
    this.build();
  }
  flat(id,x,z,hx,hz,y,extra={}){const p=rectangle(id,x,z,hx,hz,{y,...extra});this.patches.push(p);return p;}
  deck(id,x,z,hx,hz,y,extra={}){
    const s=rectangle(id,x,z,hx,hz,{y,walk:true,...extra});this.surfaces.push(s);
    this.solids.push(rectangle(id+':slab',x,z,hx,hz,{minY:y-.48,maxY:y,slab:true,surface:id,...extra}));return s;
  }
  wall(id,x,z,hx,hz,minY,maxY,extra={}){const s=rectangle(id,x,z,hx,hz,{minY,maxY,...extra});this.solids.push(s);return s;}
  stair(id,x,z,hx,hz,from,to,axis='z',extra={}){
    const steps=Math.max(4,Math.ceil(Math.abs(to-from)/.30)),s=rectangle(id,x,z,hx,hz,{from,to,axis,steps,walk:true,stairs:true,...extra});
    this.surfaces.push(s);
    for(let i=0;i<steps;i++){
      const t=(i+.5)/steps,along=(t*2-1)*(axis==='x'?hx:hz),y=from+(to-from)*(i+1)/steps;
      this.wall(id+':'+i,axis==='x'?x+along:x,axis==='z'?z+along:z,axis==='x'?hx/steps:hx,axis==='z'?hz/steps:hz,Math.min(terrainHeight(x,z),from,to)-.25,y,{stair:true});
    }
    return s;
  }
  ramp(id,x,z,hx,hz,from,to,axis='x',extra={}){const p=rectangle(id,x,z,hx,hz,{ramp:true,from,to,axis,...extra});this.patches.push(p);return p;}
  heightOf(s,x,z){
    if(s.stairs||s.ramp){const half=s.axis==='x'?s.hx:s.hz,t=clamp(((s.axis==='x'?x-s.x:z-s.z)/half+1)/2,0,1),u=s.stairs?Math.ceil(Math.max(1e-6,t)*s.steps)/s.steps:t;return s.from+(s.to-s.from)*u;}
    return s.y;
  }
  active(s){return !s.disabled&&(!s.gate||this.interactions.find(i=>i.id===s.gate)?.opened);}
  build(){
    const v=this.variant,shift=(v-1)*3,b=terrainHeight(36,shift),west=terrainHeight(-36,shift);
    if(['sanctum','volcano','tundra','throne'].includes(this.region)){
      const valley=this.region==='tundra'?-1.2:this.region==='volcano'?-5.6:-3.2;
      this.flat('canyon',36,shift,8.8,23,b+valley,{district:this.region==='tundra'?'얼어붙은 호수':'협곡 하부'});
      this.ramp('lower-entry',36,shift-29,5,6,terrainHeight(36,shift-35),b+valley,'z');
      const y=b+3.8+v*.35;
      for(const [offset,id] of [[0,'crossing'],[12,'return-crossing']]){
        this.deck(id,36,shift+offset,9.4,3.7,y,{bridge:true});
        this.stair(id+':west',20.3,shift+offset,6.3,3.7,terrainHeight(14,shift+offset),y,'x');
        this.stair(id+':east',51.7,shift+offset,6.3,3.7,y,terrainHeight(58,shift+offset),'x');
        this.anchors.push({id,x:36,z:shift+offset,y});
      }
      if(this.region==='volcano'){
        this.dangers.push(rectangle('lava-bed',36,shift-12,7,6,{y:b+valley}));
        this.interactions.push({id:'bridge-lever',x:23,z:shift+4.9,y:this.height(23,shift+4.9),name:'무너진 다리의 윈치',verb:'보조 교량 펼치기',opened:false});
        this.deck('secret-bridge',36,shift-14,9.4,2.5,y,{gate:'bridge-lever',bridge:true});
        this.stair('secret-stair',20.3,shift-14,6.3,2.5,terrainHeight(14,shift-14),y,'x');
        this.stair('secret-stair:east',51.7,shift-14,6.3,2.5,y,terrainHeight(58,shift-14),'x');
      }
      if(this.region==='tundra')this.ice=rectangle('ice-lake',36,shift-8,8,13,{y:b+valley});
    }
    if(['sanctum','tundra','ruins','forest','throne'].includes(this.region)){
      const depth=5.9+v*.15,floor=west-depth;
      this.flat('cave-floor',-36,shift,8,6.7,floor,{district:this.region==='tundra'?'얼음 동굴':'지하 회랑'});
      this.ramp('cave-west',-50,shift,6,5,terrainHeight(-56,shift),floor,'x');
      this.ramp('cave-east',-22,shift,6,5,floor,terrainHeight(-16,shift),'x');
      this.deck('cave-roof',-36,shift,8.2,7.4,west,{roof:true});
      this.wall('cave-north',-36,shift-6.7,8.2,.45,floor,west-.05,{cave:true});
      this.wall('cave-south',-36,shift+6.7,8.2,.45,floor,west-.05,{cave:true});
      for(const x of [-44,-28])for(const side of [-1,1])this.wall('cave-jamb:'+x+':'+side,x,shift+side*6,.28,.68,floor,west-.05,{cave:true});
      this.anchors.push({id:'underground',x:-36,z:shift,y:floor},{id:'cave-upper',x:-36,z:shift,y:west});
      this.breakables.push(this.wall('cave-seal',-36,shift,0.45,5.9,floor,floor+4.6,{breakable:true,hp:90,secret:true}));
      this.interactions.push({id:'cave-cache',x:-41,z:shift,y:floor,name:'지하의 봉인 기록',verb:'기록과 숨은 보상 회수',opened:false,reward:true});
    }
    if(['sanctum','ruins','throne'].includes(this.region)){
      const z=38+v*2,base=terrainHeight(0,z),upper=base+5.7;
      for(const side of [-1,1])for(const end of [-1,1])this.wall('citadel-pier:'+side+':'+end,side*9,z+end*6,.75,.75,base,upper-.3,{pier:true});
      this.flat('citadel-court',0,z,10.5,7.5,base,{district:'성벽 하층'});
      this.deck('citadel-upper',0,z,10.5,7.5,upper,{roof:true,citadel:true});
      this.stair('citadel-grand-stair',0,z-15.5,3.8,8,terrainHeight(0,z-23.5),upper,'z');
      this.stair('citadel-west-stair',-18,z,7.5,3.5,terrainHeight(-25.5,z),upper,'x');
      for(const side of [-1,1])this.wall('citadel-battlement:'+side,side*10,z,.38,7.2,upper,upper+1.1,{parapet:true});
      this.wall('citadel-back',0,z+7.1,10.3,.38,upper,upper+1.1,{parapet:true});
      this.anchors.push({id:'upper-citadel',x:0,z,y:upper},{id:'lower-citadel',x:6,z,y:base});
      this.interactions.push({id:'citadel-gate',x:5.5,z:z-6,y:base,name:'하층 비밀문 레버',verb:'샛길 문 열기',opened:false});
      this.wall('citadel-secret-door',7,z,0.35,5.8,base,base+4.6,{door:'citadel-gate',secret:true});
    }
    if(this.region==='forest'){
      for(let i=0;i<24;i++){const side=i%2?1:-1,x=side*(13+(i%3)*3.2),z=-21-Math.floor(i/2)*2.9,y=terrainHeight(x,z);this.solids.push({id:'grove-trunk:'+i,type:'circle',x,z,radius:.42,minY:y,maxY:y+9,trunk:true});}
      const z=-36+shift,base=terrainHeight(0,z),top=base+4.5;
      for(let row=0;row<4;row++){
        const side=(row+v)%2?1:-1,zz=z-10+row*6;
        this.wall('root-maze:'+row,side*5.8,zz,1.0,4.0,terrainHeight(side*5.8,zz),terrainHeight(side*5.8,zz)+3.5,{root:true});
      }
      this.deck('great-root-walk',0,z,11,3.2,top,{bridge:true,root:true});
      this.stair('root-west',-18,z,7,3.2,terrainHeight(-25,z),top,'x');
      this.stair('root-east',18,z,7,3.2,top,terrainHeight(25,z),'x');
      this.breakables.push(this.wall('root-shortcut',-5.8,z+9,1.0,2.1,base,base+3.5,{breakable:true,hp:75,root:true,secret:true}));
      this.interactions.push({id:'forest-cache',x:-13,z:z+9,y:terrainHeight(-13,z+9),name:'뿌리 뒤의 탐험 흔적',verb:'숨겨진 보상 회수',opened:false,reward:true});
      this.anchors.push({id:'root-canopy',x:0,z,y:top},{id:'root-labyrinth',x:0,z:z+8,y:terrainHeight(0,z+8)});
    }
    if(this.region==='void'){
      const directions=[[1,0,6],[0,1,7.8],[-1,0,5],[0,-1,6.7]];
      for(let n=0;n<directions.length;n++){
        const [dx,dz,y0]=directions[n],y=y0+v*.25,x=dx*36,z=dz*36,axis=dx?'x':'z';
        this.deck('island:'+n,x,z,dx?8:7,dz?8:7,y,{island:true});
        const from=terrainHeight(dx*15,dz*15);
        this.stair('island-link:'+n,dx*21.5,dz*21.5,dx?6.5:3.2,dz?6.5:3.2,dx<0||dz<0?y:from,dx<0||dz<0?from:y,axis);
        this.deck('island-neck:'+n,dx*29,dz*29,dx?1.0:3.2,dz?1.0:3.2,y,{bridge:true});
        this.anchors.push({id:'floating-island:'+n,x,z,y});
      }
      this.interactions.push({id:'void-fold:a',x:36,z:3,y:6+v*.25,name:'군도를 잇는 공간 균열',verb:'반대편 섬으로 이동',teleport:{x:-36,z:0,y:5+v*.25}},{id:'void-fold:b',x:-36,z:3,y:5+v*.25,name:'성역 방향 공간 균열',verb:'반대편 섬으로 이동',teleport:{x:36,z:0,y:6+v*.25}});
    }
    this.anchors.unshift({id:'safe-arena',x:0,z:0,y:0});
  }
  reserved(x,z){if(this.region==='void'&&Math.hypot(x,z)>16&&Math.hypot(x,z)<67&&!this.voidSpine(x,z))return true;return this.patches.some(s=>inside(s,x,z,1))||this.surfaces.some(s=>inside(s,x,z,1));}
  ground(x,z){
    let y=terrainHeight(x,z);
    if(STRUCTURES.some(s=>Math.abs(x-s.x)<s.width/2+1&&Math.abs(z-s.z)<s.depth/2+1))return y;
    if(this.region==='void'&&Math.hypot(x,z)>16&&Math.hypot(x,z)<67&&!this.voidSpine(x,z))y=-10;
    for(const p of this.patches)if(this.active(p)&&inside(p,x,z))y=this.heightOf(p,x,z);
    return y;
  }
  voidSpine(x,z){
    if(Math.abs(x)<4||Math.abs(z)<4)return true;
    for(const s of STRUCTURES){
      if(Math.abs(x-s.x)<s.width/2+5&&Math.abs(z-s.z)<s.depth/2+5)return true;
      const t=clamp((x*s.x+z*s.z)/(s.x*s.x+s.z*s.z),0,1);
      if(Math.hypot(x-s.x*t,z-s.z*t)<3.4)return true;
    }
    return false;
  }
  candidates(x,z){
    const result=[{y:this.ground(x,z),id:'ground'}];
    for(const s of this.surfaces)if(this.active(s)&&inside(s,x,z))result.push({y:this.heightOf(s,x,z),id:s.id});
    return result.sort((a,b)=>b.y-a.y);
  }
  height(x,z,reference){
    const candidates=this.candidates(x,z);
    return (Number.isFinite(reference)?candidates.find(p=>p.y<=reference+.66):candidates[0])?.y??candidates.at(-1).y;
  }
  walls(){
    if(this.wallRevision!==this.revision){
      this.wallRevision=this.revision;this.wallCache=this.legacySolids.concat(this.solids.filter(s=>!s.disabled&&(!s.gate||this.active(s))&&(!s.door||!this.interactions.find(i=>i.id===s.door)?.opened)));
      this.wallBuckets=new Map();
      for(const c of this.wallCache){const hx=(c.hx??c.radius)+2,hz=(c.hz??c.radius)+2;for(let z=Math.floor((c.z-hz)/8);z<=Math.floor((c.z+hz)/8);z++)for(let x=Math.floor((c.x-hx)/8);x<=Math.floor((c.x+hx)/8);x++){const key=x+':'+z,list=this.wallBuckets.get(key)||[];list.push(c);this.wallBuckets.set(key,list);}}
    }
    return this.wallCache;
  }
  canStand(x,z,y,radius=.65,height=3.6){
    if(!Number.isFinite(x+z+y)||Math.hypot(x,z)>WORLD_RADIUS-radius)return false;
    if(this.region==='void'&&y<-5)return false;
    this.walls();for(const c of radius<=2?this.wallBuckets.get(Math.floor(x/8)+':'+Math.floor(z/8))||[]:this.wallCache){
      if(y+.05>=c.maxY||y+height<=c.minY+.04||((c.stair||c.slab)&&c.maxY-y<=.66))continue;
      if(c.type==='circle'){if(Math.hypot(x-c.x,z-c.z)<c.radius+radius)return false;}
      else {const dx=Math.max(0,Math.abs(x-c.x)-c.hx),dz=Math.max(0,Math.abs(z-c.z)-c.hz);if(dx*dx+dz*dz<radius*radius)return false;}
    }
    return true;
  }
  support(x,z,reference,radius=.65,height=3.6){
    for(const c of this.candidates(x,z))if((!Number.isFinite(reference)||c.y<=reference+.66)&&this.canStand(x,z,c.y,radius,height))return c;
    return null;
  }
  /** Substeps prevent dashes/knockback tunnelling or jumping off an upper floor. */
  traverse(a,b,radius=.65,height=3.6){
    const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.10));let p={...a};
    for(let i=1;i<=count;i++){
      const t=i/count,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,s=this.support(x,z,p.y,radius,height);
      if(!s||Math.abs(s.y-p.y)>.68)return {point:p,clear:false};p={x,y:s.y,z};
    }
    return{point:p,clear:true};
  }
  use(id){const i=this.interactions.find(i=>i.id===id);if(!i||i.opened&&!i.teleport)return null;if(!i.teleport)i.opened=true;this.revision++;return i;}
  damage(id,amount){const b=this.breakables.find(b=>b.id===id&&!b.disabled);if(!b)return false;b.hp=Math.max(0,b.hp-amount);if(!b.hp){b.disabled=true;this.revision++;}return true;}
  district(p){
    const patch=this.patches.find(s=>s.district&&inside(s,p.x,p.z)&&Math.abs(this.heightOf(s,p.x,p.z)-p.y)<.7);if(patch)return patch.district;
    if(this.region==='void'&&p.y>3)return '공중 군도';
    if(p.y<this.ground(p.x,p.z)+.1&&p.y<-2||this.surfaces.some(s=>s.roof&&inside(s,p.x,p.z)&&p.y<s.y-2))return '지하 통로';
    const s=this.surfaces.find(s=>this.active(s)&&inside(s,p.x,p.z)&&Math.abs(this.heightOf(s,p.x,p.z)-p.y)<.6);
    return s?.citadel?'상층 성벽':s?.bridge?'다리·상부 연결로':s?.stairs?'계단':this.region==='forest'&&p.z<-18?'뿌리 미로':'지상 전장';
  }
}

/** Layered shared flow graph: one search for the horde, separate clearance for bosses. */
export class TerrainNavigation {
  constructor(layout,{step=2,radius=.8,height=3.6}={}){
    this.layout=layout;this.step=step;this.radius=radius;this.height=height;this.size=Math.floor(WORLD_RADIUS*2/step)+1;
    this.nodes=[];this.cells=Array.from({length:this.size*this.size},()=>[]);
    for(let z=0;z<this.size;z++)for(let x=0;x<this.size;x++){
      const wx=x*step-WORLD_RADIUS,wz=z*step-WORLD_RADIUS;
      for(const c of layout.candidates(wx,wz))if(layout.canStand(wx,wz,c.y,radius,height)&&!this.cells[z*this.size+x].some(id=>Math.abs(this.nodes[id].y-c.y)<.1)){
        const id=this.nodes.length;this.cells[z*this.size+x].push(id);this.nodes.push({x:wx,z:wz,y:c.y,cx:x,cz:z,edges:[]});
      }
    }
    for(const node of this.nodes)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
      const x=node.cx+dx,z=node.cz+dz;if(x<0||z<0||x>=this.size||z>=this.size)continue;
      const path=layout.traverse(node,{x:x*step-WORLD_RADIUS,z:z*step-WORLD_RADIUS},radius,height);
      if(!path.clear)continue;
      const target=this.cells[z*this.size+x].find(id=>Math.abs(this.nodes[id].y-path.point.y)<.15);
      if(target!==undefined)node.edges.push(target);
    }
    this.incoming=Array.from({length:this.nodes.length},()=>[]);this.nodes.forEach((n,id)=>n.edges.forEach(to=>this.incoming[to].push(id)));
    this.distance=new Uint16Array(this.nodes.length);this.queue=new Uint16Array(this.nodes.length);this.goal=-1;this.fields=new Map();
    this.flow({x:0,y:0,z:0});this.reachable=new Uint8Array(this.nodes.length);for(let i=0;i<this.nodes.length;i++)this.reachable[i]=this.distance[i]!==65535?1:0;
    this.layoutRevision=layout.revision;
  }
  nearest(p,reachable=false){
    let best=-1,score=Infinity;const gx=Math.round((p.x+WORLD_RADIUS)/this.step),gz=Math.round((p.z+WORLD_RADIUS)/this.step);
    for(let ring=0;ring<=8;ring++){
      for(let dz=-ring;dz<=ring;dz++)for(let dx=-ring;dx<=ring;dx++){
        const x=gx+dx,z=gz+dz;if(x<0||z<0||x>=this.size||z>=this.size)continue;
        for(const id of this.cells[z*this.size+x]){
          if(reachable&&!this.reachable?.[id])continue;const n=this.nodes[id],d=(n.x-p.x)**2+(n.z-p.z)**2+((n.y-(p.y??n.y))*2)**2;
          if(d<score){score=d;best=id;}
        }
      }
      if(best>=0&&ring>=2)break;
    }
    return best;
  }
  flow(target){
    const goal=this.nearest(target);if(goal===this.goal)return;this.goal=goal;
    if(this.fields.has(goal)){this.distance=this.fields.get(goal);return;}
    this.distance=new Uint16Array(this.nodes.length);this.distance.fill(65535);if(goal<0)return;
    let head=0,tail=0;this.queue[tail++]=goal;this.distance[goal]=0;
    while(head<tail){const id=this.queue[head++];for(const next of this.incoming[id])if(this.distance[next]===65535){this.distance[next]=this.distance[id]+1;this.queue[tail++]=next;}}
    this.fields.set(goal,this.distance);if(this.fields.size>4)this.fields.delete(this.fields.keys().next().value);
  }
  steer(p,target,radius=this.radius,height=this.height){
    const dx=target.x-p.x,dz=target.z-p.z,length=Math.hypot(dx,dz)||1;
    if(length<4){const direct=this.layout.traverse(p,target,radius,height);if(direct.clear&&Math.abs(direct.point.y-target.y)<.7)return{x:dx/length,z:dz/length,waypoint:target};}
    this.flow(target);
    const gx=Math.round((p.x+WORLD_RADIUS)/this.step),gz=Math.round((p.z+WORLD_RADIUS)/this.step);const at=this.nearest(p),current=at>=0?this.distance[at]:65535;let selected=null,best=Infinity,progress=false;
    // Visible local waypoints prevent corner oscillation between discrete grid cells.
    for(let z=Math.max(0,gz-2);z<=Math.min(this.size-1,gz+2);z++)for(let x=Math.max(0,gx-2);x<=Math.min(this.size-1,gx+2);x++)for(const id of this.cells[z*this.size+x]){
      const n=this.nodes[id],travel=Math.hypot(n.x-p.x,n.z-p.z),score=this.distance[id]+travel/this.step*.85;
      const advances=this.distance[id]<current;if(travel<.3||this.distance[id]===65535||progress&&!advances||advances===progress&&score>=best)continue;
      const probe=this.layout.traverse(p,{x:p.x+(n.x-p.x)*.06/travel,z:p.z+(n.z-p.z)*.06/travel},radius,height);if(!probe.clear)continue;
      const path=this.layout.traverse(p,n,radius,height);if(!path.clear||Math.abs(path.point.y-n.y)>.2)continue;
      selected=n;best=score;progress=advances;
    }
    if(!selected)return{x:0,z:0};const x=selected.x-p.x,z=selected.z-p.z,len=Math.hypot(x,z);return{x:x/len,z:z/len,waypoint:selected};
  }

  project(p){const id=this.nearest(p,true);return id<0?{x:0,y:0,z:0}:{x:this.nodes[id].x,y:this.nodes[id].y,z:this.nodes[id].z};}
}
