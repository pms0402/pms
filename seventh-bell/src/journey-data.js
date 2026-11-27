// Door-connected rooms keep every published main-world coordinate intact.
// Both directions are real traversable spaces; the main-road border is closed.
const definitions=[
 ['pilgrim',1,2,'성문 밖 순례길',1320,5980,6140,'tower','edran','pilgrim',0,2],
 ['undermine',2,3,'성당 아래 폐광',1500,11100,11300,'second-way','marie','mine',3,4],
 ['freight',3,4,'멎은 운반 철도',1440,16860,17020,'third-end','brag','rail',4,8],
 ['undercroft',4,5,'왕궁 아래 회랑',1560,23500,23600,'fourth-end','leonel','crypt',9,10],
 ['postern',5,6,'왕의 절벽 계단',1800,30300,30600,'royal-passage','arkein','cliff',11,14],
 ['coast',6,7,'등대 너머 해안길',1700,35780,36000,'coastal-passage','neris','coast',14,16]
];
let cursor=43000;
export const JOURNEYS=definitions.map(([id,from,to,name,length,west,border,object,boss,kind,westArt,eastArt])=>{const start=cursor;cursor+=length+400;return{id,from,to,name,length,start,end:start+length,west,east:border+(id==='postern'?380:id==='coast'?500:320),border,object,boss,kind,westArt,eastArt,zone:'journey-'+id};});
export const JOURNEY_LIMIT=cursor;
export const JOURNEY_LIFTS=['journey-mine-hoist','journey-coast-hoist'];
export const newJourneys=()=>Object.fromEntries(JOURNEYS.map(j=>[j.id,false]));
export const journeyAt=x=>JOURNEYS.find(j=>x>=j.start&&x<=j.end)||null;
export const journeyProgress=x=>{const j=journeyAt(x);return j?Math.max(0,Math.min(1,(x-j.start-220)/(j.length-440))):0;};
export const mainChapter=x=>x>=36000?7:x>=30600?6:x>=23600?5:x>=17020?4:x>=11300?3:x>=6140?2:1;
export const travelBounds=(x,width)=>{const j=journeyAt(x);return j?{left:j.start,right:j.end}:{left:0,right:width};};
export const validTravelX=x=>Number.isFinite(x)&&(x>=15&&x<=41780||JOURNEYS.some(j=>x>=j.start+15&&x<=j.end-20));
export function environmentAt(x){const j=journeyAt(x),linear=j?journeyProgress(x):0,t=linear*linear*(3-2*linear),from=j?.from||mainChapter(x),to=j?.to||from;return{from,to,mix:t,journey:j,interior:j&&['mine','crypt','rail'].includes(j.kind)?Math.sin(Math.PI*linear)*.65:0};}

// The shared strip is solid masonry; the camera cannot reveal the room beyond it.
export function sceneBounds(x,width,world=null){const room=journeyAt(x);if(room)return{left:room.start,right:room.end};const chapter=mainChapter(x),west=JOURNEYS.find(j=>j.to===chapter),east=JOURNEYS.find(j=>j.from===chapter),wall=east&&world?.gates.find(g=>g.mapBoundary===east.id);return{left:west?west.border-65:0,right:Math.min(width,wall?wall.x+wall.w:east?east.border+20:width)};}
