import test from 'node:test';
import assert from 'node:assert/strict';
import {
 QUALITY_KEY,QUALITY_MODES,normalizeQuality,initialQualityTier,qualityProfile,
 framePercentile,createFrameGovernor,createRenderQualityController
} from '../public/render-quality.mjs';

test('render quality modes reject corrupted or unsupported preferences',()=>{
 assert.deepEqual(QUALITY_MODES,['auto','high','balanced','performance']);
 assert.deepEqual(normalizeQuality(null),{mode:'auto',showStats:false});
 assert.deepEqual(normalizeQuality({mode:'ultra',showStats:'yes'}),{mode:'auto',showStats:false});
 assert.deepEqual(normalizeQuality({mode:'high',showStats:true}),{mode:'high',showStats:true});
 assert.deepEqual(normalizeQuality([]),{mode:'auto',showStats:false});
});
test('automatic startup respects device width, memory, core count and data saver',()=>{
 assert.equal(initialQualityTier({width:375}),'balanced');
 assert.equal(initialQualityTier({width:1440}),'high');
 assert.equal(initialQualityTier({width:1440,deviceMemory:2}),'performance');
 assert.equal(initialQualityTier({width:1440,deviceMemory:4}),'balanced');
 assert.equal(initialQualityTier({width:1440,cores:4}),'balanced');
 assert.equal(initialQualityTier({width:1440,saveData:true}),'performance');
});
test('resolution scale is physically bounded and respects pixel budgets',()=>{
 const high=qualityProfile({mode:'high',width:1440,height:900,dpr:2});
 const balanced=qualityProfile({mode:'balanced',width:1440,height:900,dpr:2});
 const low=qualityProfile({mode:'performance',width:1440,height:900,dpr:2});
 assert.ok(high.pixelRatio>balanced.pixelRatio);
 assert.ok(balanced.pixelRatio>low.pixelRatio);
 assert.ok(high.pixelRatio<=1.75);
 assert.ok(high.pixelRatio**2*1440*900<=3400001);
 assert.equal(high.shadowSize,1024);
 assert.equal(low.shadows,false);
 assert.equal(balanced.shadows,true);
 const software=qualityProfile({mode:'high',width:1440,height:900,dpr:3,software:true});
 assert.equal(software.pixelRatio,.7);
 assert.equal(software.shadows,false);
 assert.equal(qualityProfile({mode:'bad',dpr:-1}).tier,'balanced');
});
test('governor steps down on prolonged slow rendering, not a single stalled frame',()=>{
 const gov=createFrameGovernor({initial:'high',cooldownMs:1000});
 let clock=0;gov.sample(clock);
 for(let i=0;i<35;i++){clock+=60;gov.sample(clock)}
 assert.equal(gov.tier,'high');
 clock+=60;gov.sample(clock);
 assert.equal(gov.tier,'balanced');
 clock+=900;gov.sample(clock); // stall resets the sample window
 assert.equal(gov.tier,'balanced');
 for(let i=0;i<36;i++){clock+=65;gov.sample(clock)}
 assert.equal(gov.tier,'performance');
});
test('governor upgrades only with sustained headroom and ignores idle and software WebGL',()=>{
 const gov=createFrameGovernor({initial:'balanced',cooldownMs:1000});
 let clock=0;gov.sample(clock);
 for(let i=0;i<65;i++){clock+=16;gov.sample(clock)}
 assert.equal(gov.tier,'high');
 gov.sample(clock+800,false);
 assert.equal(gov.metrics().count,0);
 const gpuQa=createFrameGovernor({initial:'balanced',software:true,cooldownMs:0});
 for(let i=0;i<150;i++)gpuQa.sample(i*100);
 assert.equal(gpuQa.tier,'balanced');
 assert.equal(framePercentile([10,30,20,40],.95),40);
 assert.equal(framePercentile([]),0);
});
test('manual render tiers keep recording frame pacing without triggering auto downgrade',()=>{
 const gov=createFrameGovernor({initial:'high',cooldownMs:0});
 let now=0;gov.sample(now);
 for(let i=0;i<80;i++){now+=90;gov.sample(now,true,false)}
 assert.equal(gov.tier,'high');
 assert.ok(gov.metrics().avgMs>80);
 assert.equal(gov.metrics().count,72);
});
test('real renderer adapter changes DPI and shadow size, persists mode and honors resize',()=>{
 const saved=new Map();
 const storage={
  getItem:key=>saved.get(key)??null,
  setItem:(key,value)=>saved.set(key,value)
 };
 const calls=[];
 const renderer={
  shadowMap:{enabled:false},
  setPixelRatio:v=>calls.push(['pixel',v]),
  setSize:(w,h)=>calls.push(['size',w,h]),
  info:{render:{calls:60,triangles:110000},memory:{geometries:300,textures:45}}
 };
 const mapSize={x:1024,y:1024,set(x,y){this.x=x;this.y=y}};
 let disposed=0;
 const light={shadow:{mapSize,map:{dispose(){disposed++}}}};
 let width=1440,height=900;
 const q=createRenderQualityController({
  renderer,light,storage,viewport:()=>({width,height,dpr:2}),
  hints:{deviceMemory:8,cores:12}
 });
 assert.equal(q.preferences.mode,'auto');
 assert.equal(q.profile.tier,'high');
 assert.equal(renderer.shadowMap.enabled,true);
 assert.equal(q.snapshot().drawCalls,60);
 assert.equal(q.snapshot().triangles,110000);
 assert.equal(q.setMode('performance'),true);
 assert.equal(q.preferences.mode,'performance');
 assert.equal(renderer.shadowMap.enabled,false);
 assert.equal(mapSize.x,512);
 assert.equal(disposed,1);
 assert.equal(q.setMode('unknown'),false);
 q.setShowStats(true);
 assert.equal(JSON.parse(saved.get(QUALITY_KEY)).showStats,true);
 let now=0;
 q.presented(now);
 for(let i=0;i<38;i++){now+=33;q.presented(now)}
 assert.ok(q.snapshot().fps>=29);
 assert.equal(q.profile.tier,'performance');
 width=375;height=812;q.resize();
 assert.deepEqual(calls.at(-1),['size',375,812]);
 assert.equal(q.snapshot().showStats,true);
});
test('software rendering forces a low pixel ratio and never activates shadows',()=>{
 const renderer={shadowMap:{enabled:false},setPixelRatio:()=>{},setSize:()=>{}};
 const light={shadow:{mapSize:{x:1024,set(){}}}};
 const q=createRenderQualityController({
  renderer,light,software:true,
  viewport:()=>({width:1440,height:900,dpr:2})
 });
 assert.equal(q.snapshot().dpr,.7);
 assert.equal(q.snapshot().shadows,false);
 assert.equal(q.setMode('high'),true);
 assert.equal(renderer.shadowMap.enabled,false);
});
