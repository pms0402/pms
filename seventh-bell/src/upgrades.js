// Permanent coin upgrades are separate from level/talent progression.
export const WORK_KEYS=['lining','reserve','breath','boots','focus'];
export const newWorkmanship=()=>Object.fromEntries(WORK_KEYS.map(k=>[k,0]));
export const workLevel=(p,key)=>p.version>=11?(p.workmanship?.[key]||0):0;
export const trainingRank=p=>p.version>=11?(p.training||0):0;
export const bellCount=p=>['edran','marie','brag','leonel','arkein','neris','carillon'].filter(id=>p.flags[id]).length;
export const WORK_MAX={lining:10,reserve:8,breath:8,boots:6,focus:10};
export const workLimit=(p,key)=>Math.min(WORK_MAX[key],({lining:2,reserve:2,breath:1,boots:1,focus:2}[key]||0)+bellCount(p)*(['lining','focus'].includes(key)?2:1));
export const armorReduction=p=>Math.min(4,p.gear.armor)*2+Math.max(0,p.gear.armor-4);
export const gripReduction=p=>Math.min(3,p.gear.grip)*.08+Math.max(0,p.gear.grip-3)*.04;
export const staminaRecovery=p=>(p.talents.includes('breath')?24:17)+workLevel(p,'breath')*1.5;
export const dashCooldown=p=>.55-workLevel(p,'boots')*.025;
export const echoCooldown=p=>Math.max(4,(p.talents.includes('echo')?6:8)-workLevel(p,'focus')*.1);
export const trainingPrice=rank=>{const cost=250+75*rank+12*rank*rank;return Number.isSafeInteger(cost)&&cost>0?cost:null;};
