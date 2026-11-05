import {
 DEFAULT_AUDIO,restoreAudioPreferences,audioFrame,channelVolumes
} from './audio-state.mjs';

/**
 * Original synthesized game audio. AudioContext is only created after
 * the player presses "Start" or "Resume": no autoplay/copyrighted assets.
 */
export function createGameAudio({win=window,preferences=DEFAULT_AUDIO,onStateChange=()=>{}}={}){
 let prefs=restoreAudioPreferences(preferences),ctx=null,initialized=false,unsupported=false;
 let nodes=null,frameTime=0,lastStep=-Infinity,lastImpact=-Infinity,disposed=false;
 const smooth=(param,value,time=.075)=>{
  if(!ctx||!param)return;
  param.setTargetAtTime(Math.max(0,value),ctx.currentTime,time);
 };
 const feedback=message=>onStateChange(message);
 const noiseBuffer=(seconds=1.6)=>{
  const length=Math.ceil(ctx.sampleRate*seconds),buffer=ctx.createBuffer(1,length,ctx.sampleRate);
  const data=buffer.getChannelData(0);let seed=13071245;
  for(let i=0;i<length;i++){
   seed=(Math.imul(seed,1664525)+1013904223)|0;
   data[i]=((seed>>>1)/0x3fffffff)*2-1;
  }
  return buffer;
 };
 const gain=(destination,value=0)=>{
  const g=ctx.createGain();g.gain.value=value;g.connect(destination);return g;
 };
 const filter=(type,frequency,q=.8)=>{
  const n=ctx.createBiquadFilter();n.type=type;n.frequency.value=frequency;n.Q.value=q;
  return n;
 };
 const oscillator=(type,frequency,destination)=>{
  const o=ctx.createOscillator();o.type=type;o.frequency.value=frequency;o.connect(destination);o.start();return o;
 };
 function start(){
  if(disposed||unsupported)return false;
  if(ctx){ctx.resume?.().catch?.(()=>{});return true}
  const Context=win.AudioContext||win.webkitAudioContext;
  if(!Context){unsupported=true;feedback('unsupported');return false}
  try{
   ctx=new Context();
   const master=gain(ctx.destination,0);
   const compressor=ctx.createDynamicsCompressor();
   compressor.threshold.value=-18;compressor.knee.value=22;compressor.ratio.value=3.5;
   compressor.attack.value=.009;compressor.release.value=.22;
   // The master gain runs into the limiter to prevent summed signals clipping.
   master.disconnect();master.connect(compressor);compressor.connect(ctx.destination);
   const engineBus=gain(master),effectsBus=gain(master),ambienceBus=gain(master);
   const engineLowpass=filter('lowpass',700,.85),engineGain=gain(engineBus,0);
   engineLowpass.connect(engineGain);
   const engine=oscillator('sawtooth',65,engineLowpass);
   const bassGain=gain(engineBus,0);
   const bass=oscillator('sine',35,bassGain);
   const whineGain=gain(engineBus,0);
   const whine=oscillator('triangle',260,whineGain);
   const buf=noiseBuffer(),noise=ctx.createBufferSource();noise.buffer=buf;noise.loop=true;
   const roadFilter=filter('bandpass',950,.4),roadGain=gain(engineBus,0);
   const windFilter=filter('lowpass',240,.7),windGain=gain(ambienceBus,0);
   const rainFilter=filter('highpass',1600,.45),rainGain=gain(ambienceBus,0);
   noise.connect(roadFilter);roadFilter.connect(roadGain);
   noise.connect(windFilter);windFilter.connect(windGain);
   noise.connect(rainFilter);rainFilter.connect(rainGain);
   noise.start();
   nodes={master,engineBus,effectsBus,ambienceBus,engine,engineLowpass,
    engineGain,bass,bassGain,whine,whineGain,noise,
    roadGain,roadFilter,windGain,windFilter,rainGain,rainFilter,buf};
   initialized=true;lastStep=-Infinity;lastImpact=-Infinity;
   changePreferences(prefs);
   ctx.resume?.().catch?.(()=>{});
   feedback('ready');return true;
  }catch{
   try{ctx?.close?.()}catch{}
   ctx=null;nodes=null;unsupported=true;feedback('unsupported');return false;
  }
 }
 function changePreferences(raw){
  prefs=restoreAudioPreferences(raw);
  if(nodes){
   const volume=channelVolumes(prefs);
   smooth(nodes.master.gain,volume.master,.07);
   smooth(nodes.engineBus.gain,volume.engine,.06);
   smooth(nodes.ambienceBus.gain,volume.ambience,.06);
   smooth(nodes.effectsBus.gain,volume.effects,.04);
  }
  return {...prefs};
 }
 function soundEvent(kind='ui',strength=1){
  if(!ctx||!nodes||prefs.muted||disposed)return false;
  const now=ctx.currentTime;
  const amount=Math.max(.1,Math.min(1,Number.isFinite(strength)?strength:.5));
  if(kind==='impact'&&now-lastImpact<.35)return false;
  if(kind==='impact')lastImpact=now;
  // Short original non-musical transient, generated live (not a sample).
  const duration=kind==='impact'?.23:kind==='complete'?.32:kind==='step'?.11:.16;
  const base=kind==='impact'?95:kind==='complete'?550:kind==='purchase'?380:kind==='step'?110:420;
  const shape=ctx.createOscillator(),amp=ctx.createGain();
  shape.type=kind==='impact'?'sawtooth':kind==='step'?'triangle':'sine';
  shape.frequency.setValueAtTime(base,now);
  if(kind==='impact')shape.frequency.exponentialRampToValueAtTime(42,now+duration);
  else if(kind==='complete')shape.frequency.exponentialRampToValueAtTime(830,now+duration);
  else shape.frequency.exponentialRampToValueAtTime(Math.max(40,base*.72),now+duration);
  amp.gain.setValueAtTime(0.0001,now);
  amp.gain.exponentialRampToValueAtTime((kind==='impact'?.16:kind==='step'?.08:.065)*amount+.0001,now+.013);
  amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
  shape.connect(amp);amp.connect(nodes.effectsBus);
  shape.start(now);shape.stop(now+duration+.015);
  shape.onended=()=>{shape.disconnect();amp.disconnect()};
  return true;
 }
 function update(input={},nowMs=win.performance?.now?.()??0){
  if(!ctx||!nodes||disposed)return;
  if(!Number.isFinite(nowMs)||nowMs-frameTime<38)return;
  frameTime=nowMs;
  const frame=audioFrame(input);
  const active=!(input.paused||input.active===false);
  const volume=channelVolumes(prefs);
  smooth(nodes.master.gain,volume.master*(active?1:.28),.09);
  const engineFrequency=Math.max(25,frame.engineHz||42);
  smooth(nodes.engine.frequency,engineFrequency,.06);
  smooth(nodes.engineLowpass.frequency,Math.min(2500,440+engineFrequency*9),.07);
  smooth(nodes.engineGain.gain,frame.engineGain,.07);
  smooth(nodes.bass.frequency,Math.max(25,engineFrequency*.45),.09);
  smooth(nodes.bassGain.gain,frame.engineGain*.5,.07);
  smooth(nodes.whine.frequency,frame.electricalHz,.055);
  smooth(nodes.whineGain.gain,frame.electricalGain,.07);
  smooth(nodes.roadGain.gain,frame.roadGain,.16);
  smooth(nodes.rainGain.gain,frame.rainGain,.38);
  smooth(nodes.windGain.gain,frame.windGain,.42);
  if(frame.footstepInterval){
   if(nowMs-lastStep>=frame.footstepInterval*1000){
    soundEvent('step',input.inside?.64:.85);lastStep=nowMs;
   }
  }else lastStep=-Infinity;
 }
 function dispose(){
  disposed=true;if(!ctx||!nodes)return;
  for(const node of [nodes.engine,nodes.bass,nodes.whine,nodes.noise])
   try{node.stop()}catch{}
  try{ctx.close()}catch{}
  nodes=null;ctx=null;initialized=false;
 }
 return {
  start,update,cue:soundEvent,setPreferences:changePreferences,
  getPreferences:()=>({...prefs}),getStatus:()=>({ready:initialized,unsupported,muted:prefs.muted}),
  dispose
 };
}
