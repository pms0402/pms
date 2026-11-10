/** Preserve models/materials; budget pixels and redundant draws on high-DPI devices. */
export class RenderBudget {
  constructor(){this.enabled=true;this.scale=1;this.averageMs=1000/60;this.slot=-Infinity;this.last=-Infinity;this.adjusted=-Infinity;this.phase=null;this.drawn=0;this.skipped=0;this.needsResize=false;}
  force(){this.slot=-Infinity;}
  shouldRender(time,phase){
    const active=phase==='playing'||phase==='camp',fps=active?60:phase==='menu'?30:10,interval=1000/fps;
    if(this.phase!==phase){this.phase=phase;this.slot=-Infinity;this.last=-Infinity;this.averageMs=1000/60;this.adjusted=time;}
    const elapsed=time-this.slot;
    if(Number.isFinite(elapsed)&&elapsed<interval-.3){this.skipped++;return false;}
    // Advance the ideal draw deadline, including the same tolerance used above.
    // Modulo on a value just below one interval leaves the deadline unchanged
    // and mistakenly draws again on the next high-refresh callback.
    this.slot=Number.isFinite(elapsed)?this.slot+Math.floor((elapsed+.3)/interval)*interval:time;
    const frame=time-this.last;this.last=time;this.drawn++;
    if(active&&frame>0&&frame<120)this.averageMs+=(frame-this.averageMs)*.06;
    if(active&&this.enabled&&time-this.adjusted>=1800){
      const old=this.scale;if(this.averageMs>25)this.scale=Math.max(.72,this.scale-.08);else if(this.averageMs<18.5)this.scale=Math.min(1,this.scale+.04);
      this.needsResize=Math.abs(old-this.scale)>.001;this.adjusted=time;
    }
    return true;
  }
  pixelRatio(width,height,dpr,quality,coarse=false){
    const maximum=Math.min(Math.max(1,dpr||1),quality.pixelRatio);
    if(!this.enabled)return maximum;
    const budget=coarse?1800000:3000000,ratio=Math.min(maximum,Math.sqrt(budget/Math.max(1,width*height)))*this.scale;
    return Math.max(.25,Math.floor(ratio*100)/100);
  }
  shadowInterval(){return this.enabled&&this.averageMs>24?2:1;}
  state(){return{automatic:this.enabled,scale:this.scale,averageMs:this.averageMs,drawn:this.drawn,skipped:this.skipped,shadowInterval:this.shadowInterval()};}
}
