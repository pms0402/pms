export const GRAPHICS=Object.freeze({
 low:Object.freeze({label:'낮음',pixelRatio:1,shadowSize:512,shadows:false,particles:96,density:.45,detail:.38,corpses:3}),
 medium:Object.freeze({label:'중간',pixelRatio:1.3,shadowSize:768,shadows:true,particles:176,density:.7,detail:.67,corpses:6}),
 high:Object.freeze({label:'높음',pixelRatio:1.6,shadowSize:1024,shadows:true,particles:256,density:1,detail:1,corpses:10}),
});
export function graphicsQuality(value){return GRAPHICS[value]?value:'high';}
