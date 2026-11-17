// Advance real work timers or control fishing; never invoke reward settlement.
export function playActivity(g){
 const gearBefore=new Set(g.state.life.gear.map(x=>x.uid));let ticks=0;
 const step=()=>{if(g.update)g.update(.02,{});else{g.state.time+=.02;g.life.update(.02);g.farm?.update(.02);}if(g.gatherCooldown>0&&!g.update)g.gatherCooldown=Math.max(0,g.gatherCooldown-.02);};
 g.activities.resume();
 while(g.state.life.job?.kind!=='fish'&&g.state.life.job&&ticks++<4000)step();
 // Instant gathering still has a brief swing cooldown.
 if(!g.activities.busy)for(let i=0;i<23;i++)step();
 while(g.activities.active&&ticks++<4000){const a=g.activities.active;g.activities.hold(a.id,a.tension<50);g.activities.update(.02);}
 if(g.activities.active||g.state.life.job)throw Error('Work did not finish');const result=g.activities.result||{success:true,equipment:g.state.life.gear.filter(x=>!gearBefore.has(x.uid))};if(!result.success)throw Error('Fishing failed '+JSON.stringify(result));if(g.activities.result)g.activities.dismiss();return result;
}
export async function installActivities(page){await page.evaluate(source=>{window.playActivity=(0,eval)('('+source+')');window.finishActivity=()=>{const result=window.playActivity(window.__eldermere.game);window.__eldermere.activityUI.update();return result;};},playActivity.toString());}
