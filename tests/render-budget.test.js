import test from 'node:test';
import assert from 'node:assert/strict';
import {RenderBudget} from '../src/render-budget.js';

function frames(budget,hz,seconds,phase,start=0){
  const drawn=[];
  for(let frame=0;frame<hz*seconds;frame++){
    const time=start+frame*1000/hz;
    if(budget.shouldRender(time,phase))drawn.push(time);
  }
  return drawn;
}

test('render cadence stays 60 FPS on 60–240 Hz displays and consumes elapsed wall time',()=>{
  for(const hz of [60,90,120,144,165,240]){
    for(const phase of ['playing','camp']){
      const budget=new RenderBudget(),drawn=frames(budget,hz,10,phase);
      assert.equal(drawn.length,600,`${hz} Hz ${phase}`);
      const elapsed=drawn.slice(1).reduce((sum,time,index)=>sum+(time-drawn[index]),0);
      assert.ok(Math.abs(elapsed-10000)<20,`${hz} Hz must retain skipped-frame time`);
      assert.equal(budget.scale,1,'high refresh alone must not lower resolution');
    }
  }
});

test('menus and paused choices draw less often, while resuming is immediate',()=>{
  for(const hz of [60,120,144,240]){
    assert.equal(frames(new RenderBudget(),hz,10,'menu').length,300);
    for(const phase of ['paused','levelup','region-choice'])
      assert.equal(frames(new RenderBudget(),hz,10,phase).length,100);
  }
  const budget=new RenderBudget();
  assert.equal(budget.shouldRender(0,'paused'),true);
  assert.equal(budget.shouldRender(8,'paused'),false);
  assert.equal(budget.shouldRender(9,'playing'),true);
  assert.equal(budget.shouldRender(10,'playing'),false);
  budget.force();
  assert.equal(budget.shouldRender(11,'playing'),true);
});

test('low FPS renders every available frame and adapts within a bounded pixel scale',()=>{
  const budget=new RenderBudget();
  assert.equal(frames(budget,30,12,'playing').length,360);
  assert.equal(budget.scale,.72);
  assert.equal(budget.shadowInterval(),2);
  const slowScale=budget.scale;
  frames(budget,60,18,'playing',12000);
  assert.ok(budget.scale>slowScale);
  assert.ok(budget.scale<=1);
  assert.equal(budget.shadowInterval(),1);
  budget.enabled=false;budget.scale=1;
  frames(budget,30,10,'playing',30000);
  assert.equal(budget.scale,1);
  assert.equal(budget.shadowInterval(),1);
});

test('a background-tab gap neither queues catch-up renders nor lowers resolution',()=>{
  const budget=new RenderBudget();
  frames(budget,60,1,'playing');
  assert.equal(budget.shouldRender(60000,'playing'),true);
  assert.equal(budget.shouldRender(60001,'playing'),false);
  assert.equal(budget.scale,1);
  assert.ok(budget.averageMs<18);
});

test('high-DPI pixel allocation respects desktop/mobile budgets without changing chosen quality',()=>{
  const budget=new RenderBudget(),quality={pixelRatio:2};
  for(const [width,height,coarse,maxPixels] of [[3840,2160,false,3000000],[2732,2048,true,1800000],[7680,4320,false,3000000]]){
    const ratio=budget.pixelRatio(width,height,3,quality,coarse);
    assert.ok(width*height*ratio*ratio<=maxPixels);
    assert.ok(ratio>0);
  }
  assert.equal(budget.pixelRatio(1000,600,1,quality),1);
  assert.equal(budget.pixelRatio(1000,600,3,{pixelRatio:1.4}),1.4);
  budget.enabled=false;
  assert.equal(budget.pixelRatio(3840,2160,3,quality),2);
  assert.deepEqual(quality,{pixelRatio:2});
});
