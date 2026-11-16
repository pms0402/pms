import {newRpg,validRpg} from './progression.js';
import {newFarm,validFarm} from './farm-data.js';
import {HOMES,homeSpec} from './housing.js';
import {LIFE_ITEMS,initializeLife,validLife} from './life-data.js';
export const WORLD={w:2560,h:1920,tile:16};
export const DUNGEON_WALLS=[{x:72,y:288,w:198,h:18},{x:370,y:288,w:198,h:18}];
export const SPAWN={x:620,y:664};
export const SAVE_KEY='eldermere.save.v1';
export const ITEMS={...LIFE_ITEMS,wood:{name:'버드나무 목재',icon:'wood',desc:'도구와 야영 장비의 재료'},ore:{name:'청철 광석',icon:'ore',desc:'숲의 바위에서 채집한 광석'},herb:{name:'달빛풀',icon:'herb',desc:'회복 물약을 만드는 약초'},potion:{name:'회복 물약',icon:'potion',desc:'체력 45 회복 · Q로 사용'},food:{name:'갓 구운 빵',icon:'food',desc:'체력 25, 기력 40 회복'},crystal:{name:'숲의 심장',icon:'crystal',desc:'폐광의 수호자가 지키던 결정'},sword:{name:'청철 장검',icon:'sword',desc:'공격력 +9 · 제작 즉시 장착'}};
export const RECIPES=[{id:'potion',name:'회복 물약',cost:{herb:2},qty:1,desc:'체력 45를 회복합니다.',bench:false},{id:'sword',name:'청철 장검',cost:{wood:6,ore:4},qty:1,desc:'공격력 18 → 27 · 제작대 필요',bench:true},{id:'food',name:'숲의 여행빵',cost:{herb:1,wood:1},qty:1,desc:'체력 25, 기력 40 회복',bench:false}];
export const REGIONS={village:{name:'버들빛 마을',sub:'WILLOWGLEN · 안전 지역'},forest:{name:'속삭이는 숲',sub:'WHISPERING WOODS · 야생 지역'},farm:{name:'햇살 초원',sub:'SUNLIT MEADOWS · 농장과 풀밭'},wilds:{name:'그늘진 숲길',sub:'THE SHADEWOOD · 위험 지역'},lake:{name:'거울빛 호수',sub:'MIRRORMERE · 물안개 너머'},dungeon:{name:'잊힌 별의 폐광',sub:'STARFALL HOLLOW · 오래된 유적'},mine1:{name:'구리빛 갱도',sub:'COPPERDEEP · 채광 구역'},mine2:{name:'별빛 심층',sub:'STARVEIN DEPTHS · 고위험 채광 구역'},highlands:{name:'별맥 고원',sub:'STARVEIN HIGHLANDS · 희귀 광맥'},orchard:{name:'새벽 개척지',sub:'DAWNFRONT HOMESTEAD · 넓은 농지'},south:{name:'바람꽃 평원',sub:'WINDFLOWER PLAINS · 야생의 들판'},ember:{name:'잿불 성채',sub:'EMBER CITADEL · Lv.3–5'},frost:{name:'서리 왕릉',sub:'FROSTBOUND CRYPT · Lv.5–7'},rift:{name:'별의 경계',sub:'THE ASTRAL THRESHOLD · Lv.7+'},home:{name:'나의 작은 집',sub:'HEARTH & HOME · 개인 작업실'}};
export function riverX(y){return 1080+Math.sin(y/180)*54;}
export function onBridge(x,y){return Math.abs(y-680)<25&&Math.abs(x-riverX(y))<100;}
export function isWater(x,y){if(onBridge(x,y))return false;return Math.abs(x-riverX(y))<47 || ((x-1310)/265)**2+((y-1130)/175)**2<1;}
export function isOriginalPath(x,y){return (Math.abs(y-680)<25&&x>245&&x<1670)||(Math.abs(x-620)<24&&y>260&&y<1090)||(Math.abs(y-1030)<22&&x>250&&x<850)||(Math.abs(x-1490)<22&&y>275&&y<695);}
export function isPath(x,y){return isOriginalPath(x,y)||(x>=1670&&x<2470&&Math.abs(y-680)<22)||(Math.abs(x-2130)<23&&y>650&&y<1780)||(x>1940&&x<2350&&Math.abs(y-1335)<20);}
export function regionAt(x,y,map='overworld'){if(map!=='overworld')return map;if(x>=1920)return y>1020?'orchard':'highlands';if(y>=1440)return'south';if(y>970&&x>950)return'lake';if(x>1190)return'wilds';if(y>880)return'farm';if(y<390||x<280)return'forest';return'village';}
export function initialState(){const s=initializeLife({version:4,map:'overworld',player:{...SPAWN,hp:100,stamina:100,level:1,xp:0,dir:0},inventory:{wood:0,ore:0,herb:0,potion:3,food:1,crystal:0,sword:0},gold:24,quest:0,time:80,harvested:{},killed:{},chest:false,discovered:['village'],started:false});s.rpg=newRpg();s.farm=newFarm();return s;}
export function canCraft(state,recipe,nearBench){return (!recipe.bench||nearBench)&&!(recipe.id==='sword'&&state.inventory.sword>0)&&Object.entries(recipe.cost).every(([k,n])=>state.inventory[k]>=n);}
export function craft(state,recipe,nearBench){if(!canCraft(state,recipe,nearBench))return false;for(const[k,n]of Object.entries(recipe.cost))state.inventory[k]-=n;state.inventory[recipe.id]+=recipe.qty;return true;}
export const MAP_SIZES={ember:{w:864,h:640},frost:{w:960,h:720},rift:{w:1024,h:768},overworld:{w:2560,h:1920},dungeon:{w:640,h:512},mine1:{w:960,h:640},mine2:{w:960,h:640},home:{w:480,h:360}};
function validBase(s,legacy=false){
 if(!s||!MAP_SIZES[s.map]||!s.player||!s.inventory||Array.isArray(s.inventory))return false;
 if(legacy&&!['overworld','dungeon'].includes(s.map))return false;
 const {w,h}=mapSize(s.map,s);
 for(const k of ['x','y','hp','stamina','level','xp','dir'])if(!Number.isFinite(s.player[k]))return false;
 const healthLimit=100+(s.player.level-1)*10+(legacy?0:55);
 if(s.player.x<0||s.player.x>w||s.player.y<0||s.player.y>h||!Number.isInteger(s.player.level)||s.player.level<1||s.player.level>99||s.player.hp<=0||s.player.hp>healthLimit||s.player.stamina<0||s.player.stamina>100||s.player.xp<0||!Number.isInteger(s.player.dir)||s.player.dir<0||s.player.dir>3)return false;
 const keys=legacy?['wood','ore','herb','potion','food','crystal','sword']:Object.keys(ITEMS);
 for(const k of keys)if(!Number.isSafeInteger(s.inventory[k])||s.inventory[k]<0||s.inventory[k]>999999)return false;
 return Number.isFinite(s.time)&&s.time>=0&&Number.isSafeInteger(s.gold)&&s.gold>=0&&s.gold<1e9&&Number.isInteger(s.quest)&&s.quest>=0&&s.quest<=4&&s.harvested&&typeof s.harvested==='object'&&!Array.isArray(s.harvested)&&Object.values(s.harvested).every(n=>n&&Number.isFinite(n.until)&&n.until>=0&&Number.isInteger(n.hits)&&n.hits>=0)&&s.killed&&typeof s.killed==='object'&&Object.values(s.killed).every(n=>Number.isFinite(n)&&n>=0)&&Array.isArray(s.discovered)&&s.discovered.every(k=>Object.hasOwn(REGIONS,k))&&typeof s.started==='boolean';
}
export function validateSave(s){return !!(s?.version===4&&validBase(s)&&validLife(s.life,ITEMS,s.time)&&validRpg(s.rpg,s.player.level)&&validFarm(s.farm)&&(!s.life.job||s.life.job.map===s.map&&Math.hypot(s.player.x-s.life.job.x,s.player.y-s.life.job.y)<=19)&&(s.map!=='home'||s.life.home.owned));}
export function mapSize(map,state){return map==='home'?homeSpec(state):MAP_SIZES[map];}
export function restoreSave(s){
 if([1,2,3].includes(s?.version)){
  if(!s.inventory||typeof s.inventory!=='object'||!s.player||!s.killed||!s.harvested)return null;const copy=structuredClone(s);if(s.version===1){if(!validBase(s,true))return null;initializeLife(copy);}else if(!copy.life?.home)return null;
  if(s.version<=2){copy.life.activitySerial=copy.life.activitySerial||0;copy.life.home.type=copy.life.home.owned?'cottage':null;}
  for(const id of Object.keys(ITEMS))if(!Object.hasOwn(copy.inventory,id))copy.inventory[id]=0;
  copy.version=4;copy.rpg=newRpg();copy.farm=newFarm();if(copy.quest===4||copy.inventory.crystal>0||copy.killed.guardian>0)copy.rpg.clears=['guardian'];
  return validateSave(copy)?copy:null;
 }
 return validateSave(s)?s:null;
}
