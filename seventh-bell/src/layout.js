// Insert authored rooms into flat stretches. Existing jump spans stay intact.
export const EXTENSIONS=[
 {id:'yard',at:950,length:1600,chapter:1,name:'버려진 병영'},
 {id:'procession',at:4900,length:2000,chapter:2,name:'순례자의 회랑'},
 {id:'ash',at:8500,length:2200,chapter:3,name:'식어 버린 운반로'},
 {id:'atlas',at:11800,length:2400,chapter:4,name:'접힌 책들의 미로'}
];
export const mapX=x=>x+EXTENSIONS.reduce((n,r)=>n+(x>=r.at?r.length:0),0);
export function originalX(x){let shift=0;for(const r of EXTENSIONS){const start=r.at+shift;if(x<start)return x-shift;if(x<start+r.length)return r.at;shift+=r.length;}return x-shift;}
export const roomStart=r=>mapX(r.at)-r.length;
export const chapterAt=x=>x>=27800?7:x>=22400?6:x>=15400?5:x>=11220?4:x>=7700?3:x>=4540?2:1;
export const chapterAtWorld=x=>chapterAt(originalX(x));
export const LEGACY_WORLD_WIDTH=mapX(22400);
export const WORLD_WIDTH=mapX(33600);
