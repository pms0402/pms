/** Viewport filling is independent of browser-controlled fullscreen and Escape prompts. */
export class ViewportMode {
  constructor({document,root,button,controls,home,resize=()=>{}}){
    this.document=document;this.root=root;this.button=button;this.controls=controls;this.home=home;this.resize=resize;this.active=false;this.nativePending=false;
    this.nativeChanged=()=>{this.finishNativeRequest();this.resize();};
    this.nativeFailed=()=>this.finishNativeRequest();
    for(const name of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(name,this.nativeChanged);
    for(const name of ['fullscreenerror','webkitfullscreenerror'])document.addEventListener(name,this.nativeFailed);
  }
  set(active){
    this.active=!!active;this.document.body.classList.toggle('theater-mode',this.active);this.button.setAttribute('aria-pressed',String(this.active));
    this.button.setAttribute('aria-label',this.active?'창 모드로 전환':'게임 화면 채우기');this.button.title=this.active?'창 모드로 전환 (F10)':'게임 화면 채우기 (F10)';
    for(const element of this.controls)(this.active?this.root:this.home).appendChild(element);
    this.resize();return this.active;
  }
  async requestNative(){
    if(this.nativePending)return false;
    const d=this.document,current=d.fullscreenElement||d.webkitFullscreenElement;
    this.nativePending=true;
    try{
      if(!current)this.set(true);
      const element=current?d:d.documentElement;
      const method=current?(d.exitFullscreen||d.webkitExitFullscreen):(element.requestFullscreen||element.webkitRequestFullscreen);
      if(!method){this.finishNativeRequest();return false;}
      const result=method.call(element);
      if(result&&typeof result.then==='function'){await result;this.finishNativeRequest();}
      else if(!!(d.fullscreenElement||d.webkitFullscreenElement)!==!!current)this.finishNativeRequest();
      // Older Safari returns no Promise. Keep repeated taps from launching a
      // second request until its asynchronous native transition has finished.
      else if(this.nativePending)this.nativeTimer=setTimeout(()=>this.finishNativeRequest(),1500);
      return true;
    }catch{this.finishNativeRequest();return false;}
  }
  finishNativeRequest(){this.nativePending=false;clearTimeout(this.nativeTimer);this.nativeTimer=null;}
  dispose(){this.finishNativeRequest();for(const name of ['fullscreenchange','webkitfullscreenchange'])this.document.removeEventListener(name,this.nativeChanged);for(const name of ['fullscreenerror','webkitfullscreenerror'])this.document.removeEventListener(name,this.nativeFailed);}
}
