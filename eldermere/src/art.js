import {lifeSprite,lifeIcon,equipmentOverlay} from './life-art.js';
// Original pixel artwork. Every silhouette is rasterized on the same 1px grid.
// Art is independent from collision, simulation and UI; no external game assets.
export const PAL={ink:'#20312b',shadow:'#294236',grass:'#69864b',gold:'#dfc17c'};
export function hash(x,y=0,s=0){let n=Math.imul(x+7919,374761393)^Math.imul(y+104729,668265263)^s;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
function surface(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
export class Pixel {
 constructor(w,h){this.canvas=surface(w,h);this.c=this.canvas.getContext('2d');}
 r(x,y,w,h,col){this.c.fillStyle=col;this.c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
 dot(x,y,col){this.r(x,y,1,1,col);}
 line(x,y,xx,yy,col){x=Math.round(x);y=Math.round(y);xx=Math.round(xx);yy=Math.round(yy);let dx=Math.abs(xx-x),sx=x<xx?1:-1,dy=-Math.abs(yy-y),sy=y<yy?1:-1,e=dx+dy;for(;;){this.dot(x,y,col);if(x===xx&&y===yy)break;let e2=2*e;if(e2>=dy){e+=dy;x+=sx;}if(e2<=dx){e+=dx;y+=sy;}}}
 ellipse(x,y,rx,ry,col){for(let j=Math.ceil(y-ry);j<=y+ry;j++){let a=Math.floor(rx*Math.sqrt(Math.max(0,1-((j-y)/ry)**2)));this.r(x-a,j,a*2+1,1,col);}}
 poly(points,col){const low=Math.min(...points.map(p=>p[1])),high=Math.max(...points.map(p=>p[1]));for(let y=Math.ceil(low);y<=high;y++){let xs=[];for(let i=0,j=points.length-1;i<points.length;j=i++){let a=points[j],b=points[i];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i<xs.length;i+=2)this.r(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,col);}}
}
const cache=new Map();
export function sprite(type,frame=0,dir=0){const key=type+':'+frame+':'+dir;if(cache.has(key))return cache.get(key);let p;
 const extra=lifeSprite(Pixel,type,frame);if(extra){cache.set(key,extra);return extra;}
 if(type==='tree'||type==='pine')p=tree(type,frame);
 else if(type==='house'||type==='shop'||type==='mill')p=house(type);
 else if(type==='player'||type==='elder'||type==='merchant'||type==='farmer')p=person(type,frame,dir);
 else if(type==='slime'||type==='wolf'||type==='guardian')p=monster(type,frame,dir);
 else p=prop(type,frame);
 cache.set(key,p.canvas);return p.canvas;}
function tree(type,variant){const p=new Pixel(80,100);const r=(...a)=>p.r(...a);p.ellipse(42,91,26,7,'#243c344c');
 p.poly([[35,91],[37,60],[32,46],[39,50],[45,38],[49,47],[44,65],[47,87],[54,94],[43,91],[39,95]],'#3b3c2d');
 p.poly([[39,87],[40,57],[43,53],[42,89],[47,91],[40,90],[36,94]],'#88704a');p.line(43,78,44,59,'#b3955b');p.line(38,90,40,67,'#544d36');
 if(type==='pine'){for(let i=0;i<4;i++){let y=5+i*16,w=11+i*6;p.poly([[40,y],[40-w,y+29],[40-w+6,y+28],[38-w,y+34],[43+w,y+32],[39+w-4,y+27]],'#294e3c');p.poly([[40,y+1],[40-w+4,y+25],[39,y+21],[42+w-5,y+27]],'#427150');p.line(40,y+3,34-w/2,y+21,'#759459');}}
 else {const clusters=[[31,44,24,19],[53,44,24,19],[41,26,25,21],[19,57,16,14],[61,56,16,15],[39,58,24,17],[29,24,17,14],[49,16,17,13]];
 for(let i=0;i<clusters.length;i++){let [x,y,rx,ry]=clusters[i];for(let k=0;k<13;k++){const a=k*Math.PI*2/13,ex=Math.round(x+Math.cos(a)*(rx-2)),ey=Math.round(y+Math.sin(a)*(ry-2));p.ellipse(ex,ey,3+Math.floor(hash(k,i)*3),3,'#355b40');}p.ellipse(x+1,y+3,rx-1,ry-1,'#294b3b');p.ellipse(x,y,rx,ry-2,'#3c6545');p.ellipse(x-3,y-4,rx-3,ry-5,variant%3===1?'#698752':'#587d4b');p.ellipse(x-6,y-7,rx-8,ry-8,'#77924f');
 for(let j=0;j<100;j++){let a=Math.floor(x-rx+hash(j,i,variant+2)*rx*2),b=Math.floor(y-ry+hash(i,j,31)*ry*2);if(((a-x)/rx)**2+((b-y)/ry)**2<.83){const c=hash(a,b,19);if(c>.7)p.r(a,b,2+(j%2),1,c>.9?'#a5ac62':'#6d8a4d');else if(c<.2)p.r(a,b,3,1,'#355e42');}}}
 }
 p.r(34,93,3,1,'#9eaa6c');p.r(49,92,4,1,'#8c9b63');return p;}
function house(type){const p=new Pixel(144,140);p.ellipse(77,128,64,9,'#24382e60');
 p.r(19,70,105,58,'#443d30');p.r(22,70,97,52,'#c3b486');p.r(22,111,97,12,'#8e8b69');
 for(let j=113;j<124;j+=5)for(let i=24+(j%2)*4;i<119;i+=13){p.r(i,j,10,3,hash(i,j)>.5?'#a29c7b':'#727d64');p.r(i,j,10,1,'#c0b28a');}
 p.r(24,72,4,40,'#63533a');p.r(66,72,5,52,'#61523b');p.r(115,72,5,50,'#514936');p.r(23,96,96,3,'#756144');p.line(28,77,65,97,'#746044');p.line(72,97,114,75,'#746044');
 p.poly([[6,71],[27,28],[109,28],[138,72],[132,80],[10,80]],'#30392f');
 p.poly([[10,70],[29,30],[108,30],[132,71]],type==='shop'?'#665c53':'#7e5140');
 for(let y=32;y<73;y+=5){let left=29-(y-30)*.48,right=108+(y-30)*.55;for(let x=Math.ceil(left);x<right;x+=10){let h=hash(x,y,7);p.r(x,y,Math.min(9,right-x),4,type==='shop'?(h>.5?'#74736a':'#5c655c'):(h>.5?'#b07951':'#956243'));p.r(x,y,Math.min(9,right-x),1,type==='shop'?'#92907a':'#c79462');p.dot(x+8,y+4,'#493c32');}}
 p.line(27,29,110,29,'#d1af78');p.line(10,74,132,74,'#d29b62');p.r(8,76,125,4,'#463f30');
 // Chimney, dormer, mullioned windows, climbing ivy, door and steps.
 p.r(98,13,13,24,'#686856');p.r(96,12,17,5,'#b0a380');for(let y=19;y<35;y+=6)p.r(100,y,8,2,'#8f8b70');
 p.poly([[39,53],[51,36],[64,53]],'#493f31');p.poly([[42,52],[51,40],[60,52]],'#cfbc89');p.r(45,52,13,13,'#3d4b3e');p.r(47,53,9,8,'#9bb1a0');p.r(50,52,2,11,'#64583a');p.r(45,57,13,2,'#675e43');p.line(38,52,51,35,'#d3af78');
 const win=(x,y)=>{p.r(x-2,y-2,21,23,'#645539');p.r(x,y,17,18,'#34463e');p.r(x+2,y+2,13,12,'#d9b36c');p.r(x+3,y+2,5,6,'#f1d38b');p.r(x+8,y,2,17,'#6c674b');p.r(x,y+8,17,2,'#6c674b');p.r(x-3,y+18,23,3,'#9d8861');p.r(x-2,y+21,21,5,'#5c6842');for(let a=0;a<8;a++)p.r(x+hash(a,x)*18,y+21+hash(x,a)*3,2,2,a%2?'#e7c180':'#9d7d9d');};win(32,81);win(87,81);
 p.r(59,101,24,25,'#544a34');p.poly([[60,102],[63,96],[77,96],[81,102]],'#635339');p.r(62,101,17,24,'#8a6b43');for(let x=64;x<80;x+=4)p.r(x,102,1,23,'#655338');p.r(75,111,2,2,'#e2c979');p.r(55,126,31,3,'#bcaf86');p.r(52,129,37,3,'#8f9271');
 for(let i=0;i<30;i++){let x=20+hash(i,9)*12,y=78+hash(8,i)*39;p.r(x,y,3,3,i%3?'#577044':'#899353');}
 if(type==='shop'){p.r(104,90,29,2,'#66573e');p.r(128,91,2,17,'#66573e');p.r(116,95,20,16,'#d0b574');p.r(118,97,16,12,'#6c6546');p.line(121,100,130,105,'#e1cd91');p.line(122,106,130,99,'#e1cd91');}
 return p;}
function person(type,frame,dir){const p=new Pixel(32,40);const walk=frame%4,step=walk===1?2:walk===3?-2:0,back=dir===2,side=dir===1||dir===3,flip=dir===3;const r=(x,y,w,h,c)=>p.r(flip?32-x-w:x,y,w,h,c);
 const coat=type==='player'?'#547c80':type==='elder'?'#81799a':type==='merchant'?'#a76f49':'#7b8c55';
 p.ellipse(16,36,9,3,'#183b304f');r(10,27+step,5,9,'#303c37');r(18,27-step,5,9,'#273b35');r(9,34+step,6,3,'#544936');r(18,34-step,6,3,'#544936');r(10,34+step,4,1,'#9c8761');
 p.poly([[9,17],[22,17],[26,30],[20,32],[17,29],[10,32],[6,29]],'#273d3a');r(9,18,14,12,coat);r(9,20,3,9,'#719798');r(19,18,4,10,'#375963');r(11,28,12,3,'#554a37');r(16,28,3,2,'#d6b16a');
 r(side?10:6,19,4,9,'#465956');r(side?11:6,26+step/2,4,4,'#d7b181');r(23,19,3,8,coat);r(23,26-step/2,3,4,'#cba47c');r(24,20,2,5,'#8f9f85');
 r(11,11,11,9,'#e3be8b');r(13,17,7,4,'#bd906b');r(9,7,15,8,'#413b31');r(11,5,11,3,'#514335');r(10,7,9,4,'#8d7048');r(11,6,7,2,'#b2985e');r(9,10,3,7,'#695335');r(22,9,3,8,'#4c4031');
 if(back){r(11,9,12,10,'#705b3d');r(12,10,3,8,'#9d8151');r(10,19,12,10,'#42646c');r(15,21,7,9,'#716749');r(16,22,5,6,'#a58e5c');}
 else{r(side?19:13,13,2,2,'#263d38');if(!side)r(20,13,2,2,'#263d38');r(17,16,3,1,'#b88964');r(12,11,2,1,'#eed19b');if(type==='elder'){r(12,16,9,5,'#d8d6bd');r(14,20,5,3,'#b0b9ab');r(10,6,15,4,'#c3c1aa');}r(9,18,4,2,'#c5b075');}
 if(type==='player'){r(26,18,2,16,'#434f4b');r(26,18,1,12,'#b8c8b6');r(24,29,6,2,'#b6a36b');}
 if(type==='farmer'){r(7,8,20,3,'#b4a064');r(11,4,12,5,'#cbbb7b');}return p;}
function monster(type,frame,dir){const p=new Pixel(type==='guardian'?48:36,type==='guardian'?52:32);const b=frame%2;
 if(type==='slime'){p.ellipse(18,27,13,3,'#183d344d');p.ellipse(18,20+b,12+b,8-b,'#284b43');p.ellipse(18,17+b,11+b,9-b,'#5c9191');p.ellipse(15,14+b,8,5,'#87c3ae');p.r(11,12+b,4,2,'#b5d9ba');p.r(13,18+b,2,3,'#1f4241');p.r(22,18+b,2,3,'#1f4241');p.r(18,22+b,3,1,'#d6ce9a');p.r(24,24,3,1,'#44796a');}
 else if(type==='wolf'){p.ellipse(17,27,14,3,'#193e334c');p.poly([[4,15],[9,10],[25,12],[30,20],[25,25],[12,24],[7,20]],'#4a5350');p.poly([[6,15],[12,12],[24,14],[28,19],[17,20]],'#92958a');p.r(9,22+b*2,4,7-b*2,'#465049');p.r(23,22-b*2,4,7,'#465049');p.poly([[4,17],[2,8],[8,13],[13,10],[17,6],[19,17],[14,23],[5,22]],'#80897c');p.poly([[3,9],[6,14],[5,17]],'#c2b394');p.r(5,17,2,2,'#deb876');p.r(10,17,2,2,'#d9b86c');p.r(3,21,5,2,'#253b38');p.poly([[28,15],[34,10],[33,21],[28,23]],'#6e7d72');p.r(15,13,7,2,'#b1b09b');}
 else {p.ellipse(24,46,19,4,'#152e355c');p.r(12,35,8,11,'#64767c');p.r(29,35,8,11,'#53696f');p.poly([[10,17],[37,17],[40,35],[33,40],[12,37]],'#455b65');p.r(13,20,21,16,'#7a8990');p.r(16,21,16,4,'#a6b1ae');p.r(23,25,4,10,'#8ed0c2');p.r(16,7,17,14,'#6c7d83');p.r(19,10,11,7,'#253b4d');p.r(20,12,3,2,'#b3e1ce');p.r(26,12,3,2,'#b3e1ce');p.r(5,20+b,6,17,'#576c73');p.r(36,20-b,7,17,'#687c7f');p.r(2,33,7,10,'#869594');}return p;}
function prop(type,frame){const p=new Pixel(48,48);
 if(type==='barrel'){p.ellipse(24,39,12,4,'#233e3340');p.r(14,18,20,19,'#725d3f');p.ellipse(24,18,10,4,'#b89c66');p.ellipse(24,18,7,2,'#92794f');for(let x=16;x<34;x+=4)p.r(x,21,1,16,'#b0925a');p.r(14,23,20,3,'#697767');p.r(14,34,20,3,'#697767');p.r(15,23,18,1,'#a6ad8d');}
 else if(type==='crate'){p.r(11,17,27,24,'#79613f');p.r(13,19,23,20,'#ac8c53');for(let x=15;x<36;x+=5)p.r(x,19,1,20,'#7a633e');p.line(13,20,35,38,'#dac082');p.line(14,20,36,38,'#c4a66b');p.line(14,38,35,20,'#c4a66b');p.r(11,17,27,3,'#c3a46a');p.r(11,39,27,3,'#b19761');}
 else if(type==='bush'){for(const[x,y,r]of[[15,32,10],[28,29,11],[35,34,8]]){p.ellipse(x,y,r,7,'#426443');p.ellipse(x-1,y-2,r-2,4,'#7a9554');for(let i=0;i<12;i++)p.r(x-r+hash(i,x)*r*2,y-5+hash(y,i)*8,2,1,'#a0ae66');}p.r(17,30,2,2,'#d7b18e');p.r(31,28,2,2,'#e5c29b');}
 else if(type==='mushroom'){for(const[x,y]of[[16,34],[29,29],[33,39]]){p.r(x,y,3,7,'#d4c4a0');p.ellipse(x+1,y,5,3,'#a9694d');p.r(x-2,y-1,2,1,'#f2d3a4');p.r(x+2,y,2,1,'#eac896');}}
 else if(type==='log'){p.poly([[7,33],[34,20],[42,25],[40,35],[14,43]],'#62563a');p.line(12,33,36,23,'#a38a52');p.line(16,38,38,29,'#9e834e');p.ellipse(12,37,5,6,'#c1a56a');p.ellipse(12,37,2,3,'#7f6c45');p.r(25,26,5,3,'#6e874c');}
 else if(type==='ore'||type==='rock'){p.ellipse(24,40,21,5,'#25433350');p.poly([[5,37],[9,22],[19,15],[33,18],[43,32],[39,40],[15,42]],'#465851');p.poly([[9,32],[13,23],[22,17],[34,22],[37,30],[24,34]],'#899284');p.poly([[10,34],[24,34],[31,29],[39,30],[39,38],[17,40]],'#627469');p.line(15,24,23,20,'#b1af94');if(type==='ore'){for(const [x,y]of[[15,28],[27,23],[30,35]]){p.poly([[x,y+5],[x+1,y-3],[x+4,y-5],[x+6,y+2],[x+3,y+6]],'#79a9aa');p.line(x+2,y-2,x+2,y+3,'#c2dad0');}}}
 else if(type==='herb'){p.ellipse(24,39,12,4,'#294b3450');for(let i=0;i<7;i++){let x=14+i*3,y=25+Math.sin(i*7)*7;p.line(24,39,x,y,'#45613e');p.poly([[x,y+4],[x-5,y-2],[x,y-4],[x+5,y]],'#93a361');p.r(x-1,y-6,3,4,'#d5c29a');p.r(x,y-7,2,2,'#eee1b1');}}
 else if(type==='stump'){p.ellipse(24,39,11,4,'#3e4e34');p.r(16,29,16,10,'#776143');p.ellipse(24,29,9,4,'#bc9e63');p.ellipse(24,29,5,2,'#7c6c48');p.line(18,31,18,37,'#c6a36c');}
 else if(type==='bench'){p.r(6,22,36,7,'#443e2e');p.r(7,20,34,6,'#a58a55');for(let y=21;y<26;y+=2)p.r(8,y,32,1,'#c2a46b');p.r(9,28,4,14,'#75603c');p.r(34,28,4,14,'#75603c');p.r(12,16,12,4,'#708079');p.r(14,13,9,4,'#a0aaa0');p.r(29,16,3,9,'#725138');p.r(26,15,10,4,'#adb3a0');}
 else if(type==='well'){p.ellipse(24,39,19,6,'#32493960');p.r(9,24,29,14,'#727c67');p.ellipse(24,24,16,7,'#a8a687');p.ellipse(24,24,10,4,'#2b4b46');p.r(8,11,3,22,'#675c3c');p.r(36,11,3,22,'#675c3c');p.poly([[3,13],[24,2],[44,13],[40,17],[6,17]],'#976e47');p.line(5,12,24,3,'#d1ac6c');p.line(24,14,24,27,'#b1aa79');p.r(21,26,7,6,'#8e7e50');}
 else if(type==='fence'){for(let x=4;x<=43;x+=18){p.poly([[x,16],[x+2,12],[x+4,16],[x+4,40],[x,40]],'#9f8b56');p.r(x,16,1,23,'#d2ba7a');}p.r(5,22,36,3,'#a18a55');p.r(5,33,36,3,'#897746');}
 else if(type==='lamp'){p.ellipse(24,43,9,3,'#2442304f');p.r(23,17,3,26,'#4e533c');p.r(19,12,11,3,'#444b38');p.r(20,15,9,10,'#8a8150');p.r(22,16,5,7,'#efd99a');p.r(23,16,3,5,'#fff2b8');p.poly([[18,12],[24,7],[31,12]],'#546047');p.r(19,25,11,2,'#424c38');}
 else if(type==='entrance'){p.poly([[0,44],[4,23],[13,9],[31,6],[45,21],[48,44]],'#3e534e');p.poly([[5,42],[9,23],[16,15],[30,13],[40,23],[44,43]],'#788477');p.poly([[12,44],[12,29],[17,20],[28,19],[35,28],[35,44]],'#162e30');p.line(16,21,29,19,'#a5a48d');p.r(7,35,4,7,'#b88c48');p.r(7,32,4,4,'#efd293');}
 else if(type==='chest'){p.r(9,25,30,16,'#4a4632');p.r(11,24,26,14,'#a4864c');p.poly([[10,25],[12,18],[35,18],[38,25]],'#bfa16a');p.r(14,19,3,20,'#e3c67e');p.r(30,19,3,20,'#e3c67e');p.r(20,25,7,6,'#4b5945');p.r(22,26,3,4,'#e8ce85');}
 else if(type==='crystal'){p.ellipse(24,41,15,5,'#2b4c5460');p.poly([[17,35],[15,16],[23,3],[32,14],[31,35],[24,42]],'#457e91');p.poly([[18,17],[23,5],[25,17],[24,38]],'#b1e2d7');p.poly([[25,17],[31,14],[29,34],[24,38]],'#67b5bc');p.r(21,13,2,11,'#e4f3d9');}
 else if(type==='sign'){p.r(23,20,3,23,'#6f6542');p.poly([[7,16],[33,16],[42,22],[33,27],[7,27]],'#ad955e');p.r(10,18,21,1,'#d6bb7e');p.r(12,22,19,1,'#6c6441');}
 return p;}
export function icon(name){const extra=lifeIcon(Pixel,name);if(extra)return extra;const p=new Pixel(24,24);switch(name){
 case'sword':p.poly([[5,20],[7,15],[16,4],[21,2],[21,7],[10,18]],'#d6dfc8');p.line(9,16,19,5,'#819b99');p.line(5,13,12,20,'#c8a465');p.line(4,21,8,17,'#816443');break;
 case'boot':p.poly([[8,3],[16,3],[15,14],[21,17],[21,21],[7,21],[5,17]],'#9d8f64');p.r(8,5,7,3,'#c7b482');p.r(7,20,15,2,'#4c5642');break;
 case'potion':p.r(9,2,6,4,'#bc9e64');p.r(9,6,6,4,'#a5c5b0');p.ellipse(12,16,7,7,'#7d524c');p.ellipse(12,16,5,5,'#bd7863');p.r(8,12,2,5,'#e1b994');p.r(7,20,10,1,'#768c75');break;
 case'bag':p.poly([[6,7],[8,3],[16,3],[19,8],[20,21],[4,21]],'#9d8052');p.r(8,5,8,3,'#d4b67a');p.r(6,10,12,8,'#b29864');p.r(10,9,4,7,'#6e6947');p.r(11,12,2,3,'#e3cc8a');break;
 case'hammer':p.line(6,21,16,7,'#bd9c65');p.poly([[10,5],[14,2],[22,8],[19,13]],'#9db0a4');p.line(12,5,20,10,'#d5d7bc');break;
 case'wood':for(let i=0;i<3;i++){p.r(4+i*4,5+i*3,7,12,'#9e7a4f');p.ellipse(7+i*4,5+i*3,3,2,'#d6b77b');p.line(5+i*4,8+i*3,5+i*4,15+i*3,'#bd965e');}break;
 case'ore':p.poly([[3,18],[6,8],[13,4],[20,10],[22,19]],'#728b86');p.poly([[6,9],[13,5],[17,10],[11,13]],'#a3b5a1');p.r(13,13,3,5,'#6cb8be');break;
 case'herb':p.line(12,22,12,4,'#739963');p.poly([[12,12],[3,4],[4,13],[12,17],[20,10],[20,4]],'#9db775');p.r(11,2,4,5,'#e1cca4');break;
 case'crystal':p.poly([[6,8],[12,1],[19,8],[17,19],[12,23],[7,18]],'#70b5b8');p.poly([[8,8],[12,3],[12,20]],'#d5edce');break;
 case'food':p.ellipse(12,14,9,7,'#b68b4c');p.ellipse(11,12,7,5,'#e0bd77');p.line(8,9,6,14,'#986a3f');p.line(13,8,11,13,'#a07841');break;
 }return p.canvas;}
export function makeAtlas(){const c=surface(384,240),ctx=c.getContext('2d');for(let d=0;d<4;d++)for(let f=0;f<4;f++)ctx.drawImage(sprite('player',f,d),f*32,d*40);ctx.drawImage(sprite('tree'),144,0);ctx.drawImage(sprite('house'),224,0);ctx.drawImage(sprite('wolf'),140,115);ctx.drawImage(sprite('slime'),180,115);ctx.drawImage(sprite('ore'),140,160);return c;}

export function gearOverlay(loadout,dir,frame){const key=JSON.stringify(Object.values(loadout).map(g=>g?[g.material,g.type]:null))+dir+frame;if(!cache.has(key))cache.set(key,equipmentOverlay(Pixel,loadout,dir,frame));return cache.get(key);}
