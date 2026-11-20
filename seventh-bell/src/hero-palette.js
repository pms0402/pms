// One material palette, sampled from the original ready stance. Each source
// frame is mapped once when cached, so changing sheets cannot change exposure.
// Pixels keep their local shading order; this never adjusts the world camera.
const light=(r,g,b)=>Math.round(.2126*r+.7152*g+.0722*b);
export function heroMaterial(r,g,b){
 const hi=Math.max(r,g,b),lo=Math.min(r,g,b),chroma=hi-lo;
 if(chroma<8||chroma/Math.max(1,hi)<.08)return 0;
 if(g>r*1.3&&b>r*1.3&&chroma/hi>.55)return -1;
 if(r>g*1.18&&r>b*1.18&&g<b*1.35)return 1;
 if(r>g&&g>=b)return 2;
 return 3;
}
export function heroPalette(pixels){
 const groups=Array.from({length:4},()=>[]);
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=150){const rgb=[pixels[i],pixels[i+1],pixels[i+2]],m=heroMaterial(...rgb);if(m>=0)groups[m].push(rgb);}
 return groups.map(colors=>{
  colors.sort((a,b)=>light(...a)-light(...b));
  return Array.from({length:32},(_,j)=>{
   const sample=colors.slice(Math.floor(j*colors.length/32),Math.max(Math.floor(j*colors.length/32)+1,Math.floor((j+1)*colors.length/32)));
   return [0,1,2].map(k=>Math.round(sample.reduce((sum,c)=>sum+c[k],0)/sample.length));
  });
 });
}
export function matchHeroPalette(pixels,palette){
 const hist=Array.from({length:4},()=>new Uint32Array(256)),totals=[0,0,0,0];
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=150){const m=heroMaterial(pixels[i],pixels[i+1],pixels[i+2]);if(m>=0){hist[m][light(pixels[i],pixels[i+1],pixels[i+2])]++;totals[m]++;}}
 const lut=hist.map((bins,m)=>{let sum=0;return Array.from(bins,count=>{const q=(sum+count*.5)/Math.max(1,totals[m]);sum+=count;return palette[m][Math.min(31,Math.floor(q*32))];});});
 for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>=150){const m=heroMaterial(pixels[i],pixels[i+1],pixels[i+2]);if(m>=0){const rgb=lut[m][light(pixels[i],pixels[i+1],pixels[i+2])];for(let k=0;k<3;k++)pixels[i+k]=rgb[k];}}
}
