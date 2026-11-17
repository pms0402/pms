// Authored connected streets; terrain, props and route clearance share this plan.
export const TOWN_ROADS=[
 [[620,220],[620,1130],25],[[245,680],[1010,680],28],
 [[425,561],[425,620],17],[[425,620],[620,620],17],
 [[812,542],[812,611],17],[[620,611],[970,611],17],
 [[425,837],[425,890],16],[[425,890],[812,890],18],[[812,850],[812,890],16],
 [[425,359],[425,445],15],[[425,445],[805,445],17],[[805,357],[805,445],15],
 [[970,498],[970,680],16],[[240,812],[240,885],14],[[240,885],[425,885],14],
 [[620,1030],[960,1030],23],[[960,1030],[960,1245],17],
 [[620,240],[340,240],16],[[340,240],[210,225],14],[[620,240],[885,200],14],
 [[1490,680],[1660,390],18],[[2130,680],[2130,190],17],[[1910,550],[2500,550],14],[[2040,629],[2040,680],14]
];
export function segmentDistance(x,y,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}
const ROAD_BOUNDS=TOWN_ROADS.map(([a,b,w])=>[Math.min(a[0],b[0])-w/2-16,Math.min(a[1],b[1])-w/2-16,Math.max(a[0],b[0])+w/2+16,Math.max(a[1],b[1])+w/2+16]);
export function townRoadDistance(x,y){let d=Infinity;for(let i=0;i<TOWN_ROADS.length;i++){const q=ROAD_BOUNDS[i];if(x<q[0]||y<q[1]||x>q[2]||y>q[3])continue;const[a,b,w]=TOWN_ROADS[i];d=Math.min(d,segmentDistance(x,y,a,b)-w/2);}return d;}
export function townPath(x,y){return townRoadDistance(x,y)<0;}
export function neighborhoodWorld(){const objects=[],add=(id,type,x,y,extra={})=>objects.push({id:'town-'+id,type,x,y,map:'overworld',...extra});
 const houses=[['north-west','village_cottage',425,355,82,41],['north-east','village_shed',805,353,82,41],['west-home','valley_farmhouse',240,808,78,40],['warehouse','village_warehouse',970,494,100,47],['farm-barn','ranchBarn',960,1210,105,51]];
 for(const[id,type,x,y,w,h]of houses)add(id,type,x,y,{solid:{w,h},label:({warehouse:'버들빛 마을 공동 창고','farm-barn':'햇살 농장의 헛간'})[id]||'버들빛 마을의 집'});
 // Street furniture is arranged at destinations, leaving the street centre open.
 for(const [i,[x,y]]of [[553,568],[548,735],[720,690],[913,611],[358,446],[861,445],[360,891],[883,889],[715,1098],[910,1238]].entries())add('lamp-'+i,'lamp',x,y,{radius:3});
 for(const [i,[x,y]]of [[550,602],[722,742],[552,870],[877,451]].entries())add('bench-'+i,'village_bench',x,y,{solid:{w:34,h:6}});
 for(const [i,[x,y]]of [[352,575],[503,588],[746,574],[884,578],[372,378],[476,377],[754,378],[856,377],[350,854],[505,855],[889,851],[922,531]].entries())add('pot-'+i,'village_planter',x,y,{decor:true});
 for(const[i,[x,y]]of [[917,534],[1011,546],[910,583],[994,575],[921,1195],[1008,1205]].entries())add('supplies-'+i,'village_supplies',x,y,{radius:10});
 for(let i=0;i<9;i++)add('highland-scarp-'+i,'mine_wall',1880+i*82,155+Math.sin(i*.8)*18,{solid:{w:49,h:16}});add('prospector-hut','village_shed',2040,625,{solid:{w:70,h:35}});add('prospector-crates','village_supplies',2000,632,{radius:10});
 add('water-trough','village_trough',895,1137,{solid:{w:43,h:12}});
 add('market-west','valley_market',516,580,{decor:true});
 // Low garden fences face the lane; doorway gaps are explicit.
 for(const [id,y,xs]of [['north',409,[340,386,467,513,716,762,848,894]],['west',878,[156,202,280]],['farm',1120,[730,776,854,900]]])for(const x of xs)add(id+'-fence-'+x,'fence',x,y,{solid:{w:36,h:4}});
 for(const [i,[x,y]]of [[310,320],[892,275],[925,1015],[1490,445]].entries())add('wayfinder-'+i,'sign',x,y,{decor:true});
 return objects;
}
export function dressWorld(objects){
 // Preserve every functional node's id, inventory link and save state. Decoration
 // uses deliberate road borders and clearings instead of covering those nodes.
 const add=(id,type,x,y,extra={})=>objects.push({id,type,x,y,map:'overworld',decor:true,...extra});
 for(const [i,[x,y]]of [[320,356],[485,411],[742,418],[901,391],[265,620],[299,756],[918,851],[899,947],[315,1157],[528,1150],[945,1263],[1670,312],[1740,405]].entries())add('border-garden-'+i,'valley_flowers',x,y);
 for(const[i,[x,y]]of [[210,152],[350,175],[820,175],[934,306],[225,407],[1204,454],[1498,954],[1730,1245],[1805,1700]].entries()){add('grove-rock-'+i,'valley_rocks',x,y);add('grove-fern-'+i,'valley_flowers',x-35,y+21);}
 for(const [i,[x,y]]of [[340,275],[815,240],[1350,640],[1460,830],[335,1200],[1860,830],[3110,2210]].entries())add('grove-understory-'+i,'bush',x,y);
 return objects;
}
