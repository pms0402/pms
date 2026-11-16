export const HOMES={
 cottage:{name:'버들빛 오두막',price:180,w:480,h:360,plots:8,maxPlots:12,decor:24,color:'#c2aa7c',desc:'작은 시작을 위한 아늑한 집. 마을 남동쪽에 있습니다.',x:811,y:846,doorY:877},
 farmhouse:{name:'햇살 농가',price:500,w:640,h:448,plots:16,maxPlots:24,decor:36,color:'#c3b77d',desc:'넓은 부엌과 작업 공간을 갖춘 동쪽 농가.',x:2130,y:1280,doorY:1315},
 lodge:{name:'숲속 공방',price:1000,w:768,h:528,plots:24,maxPlots:40,decor:48,color:'#9ca77f',desc:'다락과 넓은 공방, 큰 텃밭을 갖춘 목조 주택.',x:2130,y:1280,doorY:1315},
 estate:{name:'별빛 대저택',price:2200,w:960,h:640,plots:48,maxPlots:64,decor:64,color:'#bdc1b0',desc:'석조 건물과 정원, 최대 64칸의 농지를 갖춘 저택.',x:2130,y:1280,doorY:1315}
};
export function homeType(state){return state.life?.home?.type||'cottage';}
export function homeSpec(state){return Object.hasOwn(HOMES,homeType(state))?HOMES[homeType(state)]:HOMES.cottage;}
export function farmLimit(state){return state.life?.home?.owned?homeSpec(state).maxPlots:12;}
export function farmPosition(i){return i<12?{x:748+i%4*34,y:1000+Math.floor(i/4)*38}:{x:1970+(i-12)%8*38,y:1380+Math.floor((i-12)/8)*38};}
export function homeDoor(state){const h=homeSpec(state);return{x:h.x,y:h.doorY};}
export function homeUpgradePrice(state,type){return Math.max(0,HOMES[type].price-(state.life?.home?.owned?homeSpec(state).price:0));}
