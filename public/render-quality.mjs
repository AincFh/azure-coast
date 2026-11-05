/**
 * AZURE COAST | renderer quality policy.
 * Pure preset selection and sampled frame pacing, with a thin Three.js adapter.
 * A frame pacing sample is time between PRESENTED WebGL frames, not GPU time.
 * All settings remain local to this device; gameplay saves are unchanged.
 */
export const QUALITY_KEY='azure-coast-render-quality-v1';
export const QUALITY_MODES=Object.freeze(['auto','high','balanced','performance']);
export const QUALITY_TIERS=Object.freeze(['performance','balanced','high']);
export const QUALITY_PRESETS=Object.freeze({
 performance:Object.freeze({dprCap:.9,pixelBudget:900000,shadows:false,shadowSize:512}),
 balanced:Object.freeze({dprCap:1.25,pixelBudget:1900000,shadows:true,shadowSize:768}),
 high:Object.freeze({dprCap:1.75,pixelBudget:3400000,shadows:true,shadowSize:1024})
});

export function normalizeQuality(raw={}){
 const data=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
 return {
  mode:QUALITY_MODES.includes(data.mode)?data.mode:'auto',
  showStats:data.showStats===true
 };
}
export function initialQualityTier({width=1440,deviceMemory=null,cores=null,saveData=false}={}){
 if(saveData||Number.isFinite(deviceMemory)&&deviceMemory<=2)return 'performance';
 if(width<=760||Number.isFinite(deviceMemory)&&deviceMemory<=4||
  Number.isFinite(cores)&&cores<=4)return 'balanced';
 return 'high';
}
export function qualityProfile({mode='auto',tier='high',width=1440,height=900,
 dpr=1,software=false}={}){
 const chosen=mode==='auto'?tier:mode;
 const actual=QUALITY_TIERS.includes(chosen)?chosen:'balanced';
 const p=QUALITY_PRESETS[actual];
 const w=Number.isFinite(width)&&width>0?Math.min(10000,width):1440;
 const h=Number.isFinite(height)&&height>0?Math.min(10000,height):900;
 const device=Number.isFinite(dpr)&&dpr>0?Math.min(4,dpr):1;
 // Headless software WebGL must remain deterministic and avoid expensive
 // shadow-map shader compilation. It does not represent end-user hardware.
 const pixelRatio=software?.7:Math.max(.55,Math.min(device,p.dprCap,
  Math.sqrt(p.pixelBudget/(w*h))));
 return {tier:actual,pixelRatio,shadows:!software&&p.shadows,
  shadowSize:p.shadowSize,width:w,height:h,software:!!software};
}
export function framePercentile(values,pct=.95){
 const samples=values.filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
 if(!samples.length)return 0;
 const at=Math.min(samples.length-1,Math.max(0,Math.ceil(samples.length*pct)-1));
 return samples[at];
}
/** Hysteresis: only repeated slow frames cause a drop. Short stalls and tab
 * resumes never adjust quality; upgrades require sustained headroom. */
export function createFrameGovernor({initial='high',software=false,cooldownMs=15000}={}){
 let tier=QUALITY_TIERS.includes(initial)?initial:'balanced';
 let lastTime=null,lastAdjust=-Infinity;
 const samples=[];
 function sample(now,active=true){
  if(!active||software||!Number.isFinite(now)){
   lastTime=null;samples.length=0;return {tier,changed:false,avg:0};
  }
  if(lastTime===null){lastTime=now;return {tier,changed:false,avg:0}}
  const dt=now-lastTime;lastTime=now;
  if(dt<=0||dt>350){samples.length=0;return {tier,changed:false,avg:0}}
  samples.push(dt);if(samples.length>72)samples.shift();
  const avg=samples.reduce((a,b)=>a+b,0)/samples.length;
  if(samples.length<36||now-lastAdjust<cooldownMs)
   return {tier,changed:false,avg};
  const index=QUALITY_TIERS.indexOf(tier);
  let next=index;
  if(avg>51&&index>0)next--;
  else if(avg<28&&index<QUALITY_TIERS.length-1&&samples.length>=64)next++;
  if(next!==index){
   tier=QUALITY_TIERS[next];lastAdjust=now;samples.length=0;
   return {tier,changed:true,avg};
  }
  return {tier,changed:false,avg};
 }
 return {
  sample,get tier(){return tier},
  reset(){lastTime=null;samples.length=0},
  metrics(){return {avgMs:samples.length?
   samples.reduce((a,b)=>a+b,0)/samples.length:0,
   p95Ms:framePercentile(samples,.95),count:samples.length}}
 };
}
export function createRenderQualityController({
 renderer,light,storage=null,software=false,
 viewport=()=>({width:1440,height:900,dpr:1}),
 hints={}
}={}){
 const safeRead=()=>{try{return JSON.parse(storage?.getItem(QUALITY_KEY)||'null')}catch{return null}};
 let prefs=normalizeQuality(safeRead());
 const dimensions=viewport();
 const governor=createFrameGovernor({
  initial:initialQualityTier({width:dimensions.width,...hints}),software
 });
 let profile=null,lastApply='';
 function apply(){
  const dims=viewport();
  const next=qualityProfile({...dims,mode:prefs.mode,tier:governor.tier,software});
  const key=[next.width,next.height,next.pixelRatio,next.shadows,next.shadowSize].join(':');
  if(key===lastApply)return profile;
  renderer.setPixelRatio(next.pixelRatio);
  renderer.shadowMap.enabled=next.shadows;
  if(light?.shadow?.mapSize&&light.shadow.mapSize.x!==next.shadowSize){
   light.shadow.map?.dispose?.();
   light.shadow.map=null;
   light.shadow.mapSize.set(next.shadowSize,next.shadowSize);
  }
  renderer.setSize(next.width,next.height);
  profile=next;lastApply=key;
  return profile;
 }
 function save(){
  try{storage?.setItem(QUALITY_KEY,JSON.stringify(prefs))}catch{}
 }
 function setMode(value){
  if(!QUALITY_MODES.includes(value))return false;
  prefs={...prefs,mode:value};governor.reset();save();apply();return true;
 }
 function setShowStats(value){
  prefs={...prefs,showStats:value===true};save();
 }
 function presented(now,active=true){
  const result=governor.sample(now,active&&prefs.mode==='auto');
  if(result.changed)apply();
  return result;
 }
 function snapshot(){
  const metrics=governor.metrics(),draw=renderer.info?.render||{},memory=renderer.info?.memory||{};
  return Object.freeze({
   mode:prefs.mode,tier:profile?.tier||governor.tier,
   dpr:Number((profile?.pixelRatio||1).toFixed(2)),
   shadows:!!profile?.shadows,software,
   frameMs:Math.round(metrics.avgMs*10)/10,
   p95Ms:Math.round(metrics.p95Ms*10)/10,
   fps:metrics.avgMs?Math.round(1000/metrics.avgMs):0,
   sampleCount:metrics.count,
   drawCalls:Number.isFinite(draw.calls)?draw.calls:0,
   triangles:Number.isFinite(draw.triangles)?draw.triangles:0,
   geometries:Number.isFinite(memory.geometries)?memory.geometries:0,
   textures:Number.isFinite(memory.textures)?memory.textures:0,
   showStats:prefs.showStats
  });
 }
 apply();
 return {apply,resize:apply,presented,snapshot,setMode,setShowStats,
  get preferences(){return {...prefs}},get profile(){return profile}};
}
