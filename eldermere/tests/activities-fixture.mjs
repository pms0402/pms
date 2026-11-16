// Exercise the real activity rules using inputs and elapsed time; never invoke reward settlement.
export function playActivity(g){
 g.activities.resume();let ticks=0;
 while(g.activities.active&&ticks++<4000){const a=g.activities.active;
  if(a.family==='sequence')g.activities.input(a.id,a.sequence[a.steps]);
  else if(a.family==='memory'){if(a.elapsed>=1.8)g.activities.input(a.id,a.cells.find(i=>!a.chosen.includes(i)));else g.activities.update(.02);}
  else if(a.family==='timing'){const cursor=(Math.sin(a.elapsed*Math.PI*(a.speed||({mining:1,harvesting:.8,crafting:.85})[a.kind])-Math.PI/2)+1)/2;if(Math.abs(cursor-a.targets[a.steps])<.022)g.activities.input(a.id);else g.activities.update(.015);}
  else {g.activities.hold(a.id,a.tension<50);g.activities.update(.02);}
 }
 if(g.activities.active)throw Error('Activity did not finish');const result=g.activities.result;if(!result?.success)throw Error('Activity failed '+JSON.stringify(result));g.activities.dismiss();return result;
}
export async function installActivities(page){await page.evaluate(source=>{window.playActivity=(0,eval)('('+source+')');window.finishActivity=()=>{const result=window.playActivity(window.__eldermere.game);window.__eldermere.activityUI.update();return result;};},playActivity.toString());}
