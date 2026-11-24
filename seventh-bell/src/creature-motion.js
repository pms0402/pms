import {CREATURE_RIG} from './creature-registration.js';

export const CREATURE_FRAMES=24;
export const FOE_GAIT_SOURCES=Object.fromEntries(['choirghost','spearman','royalmage','echocopy'].map(id=>[id,id+'-gait']));
export const CREATURE_SHEETS={
 ...Object.fromEntries(Array.from({length:7},(_,i)=>['foes-'+(i+1)+'-gait',[6,12,128]])),
 ...Object.fromEntries(Object.values(FOE_GAIT_SOURCES).map(id=>[id,[6,4,128]])),
 ...Object.fromEntries(['edran','marie','brag','leonel','arkein','neris','carillon'].map(id=>[id+'-gait',[6,['edran','arkein'].includes(id)?8:4,192]]))
};
// Only selected, inspected cycles are used. Rejected mixed-character source
// rows are replaced by dedicated single-species sheets and never rendered.
export const CREATURE_CYCLES=[
 ...Array.from({length:7},(_,i)=>Array.from({length:3},(_,slot)=>({sheet:'foes-'+(i+1)+'-gait',row:slot*4}))).flat().filter(c=>!({'foes-2-gait':[4],'foes-5-gait':[4,8],'foes-7-gait':[4]}[c.sheet]||[]).includes(c.row)),
 ...Object.values(FOE_GAIT_SOURCES).map(sheet=>({sheet,row:0})),
 ...['edran','marie','brag','leonel','arkein','neris','carillon'].map(id=>({sheet:id+'-gait',row:0})),
 ...['edran','arkein'].map(id=>({sheet:id+'-gait',row:4}))
];
export function advanceCreatureGait(e,dt,dx,stride=44,flightPeriod=1.1){
 e.motionClock=(e.motionClock||0)+dt;
 if(e.flying){e.gaitPhase=(e.motionClock/flightPeriod)%1;e.gaitSettling=false;return;}
 let phase=e.gaitPhase??Math.max(0,((e.walk||0)-Math.abs(dx))/stride)%1;
 if(Math.abs(dx)>.0001){phase=(phase+Math.abs(dx)/stride)%1;e.gaitSettling=false;}
 else{const contact=Math.ceil((phase-1e-7)*2)/2,remaining=contact-phase;e.gaitSettling=remaining>.00001;if(e.gaitSettling)phase+=Math.min(remaining,dt*1.6);}
 e.gaitPhase=phase%1;
}
export function creatureGaitPose(e,sheet,startRow,stride=44,size=112){
 const phase=e.gaitPhase??((e.walk||0)/stride)%1,frame=Math.floor(((phase%1+1)%1)*CREATURE_FRAMES+1e-7)%CREATURE_FRAMES,rig=CREATURE_RIG[sheet]?.[startRow]||{},cellSize=CREATURE_SHEETS[sheet]?.[2]||128;
 return{sheet,row:startRow+Math.floor(frame/6),col:frame%6,frame,role:e.flying?'flight':'walk',size:rig.size||size,root:rig.roots?.[frame]??cellSize/2,foot:rig.feet?.[frame]??cellSize-10,gait:true};
}
