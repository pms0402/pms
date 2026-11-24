// A failed draw must not silently cancel the only scheduled animation frame.
export function startFrameLoop(tick,onError,{requestFrame=globalThis.requestAnimationFrame}={}){
 const state={frames:0,failed:false,lastError:null,lastFrameAt:0};
 function frame(now){requestFrame(frame);state.frames++;state.lastFrameAt=now;if(state.failed)return;try{tick(now);}catch(error){state.failed=true;state.lastError=String(error?.stack||error);onError(error);}}
 requestFrame(frame);return{state,retry(){state.failed=false;state.lastError=null;}};
}
