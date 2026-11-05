import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_AUDIO,restoreAudioPreferences,audioFrame,channelVolumes} from '../public/audio-state.mjs';
import {createGameAudio} from '../public/audio-world.mjs';
import {createSaveArchive,validateSaveArchive} from '../public/save-archive.mjs';
import {setupAudioPanel} from '../public/audio-ui.mjs';

test('audio preferences restore defaults and never allow impossible gains',()=>{
 assert.deepEqual(restoreAudioPreferences(null),DEFAULT_AUDIO);
 assert.deepEqual(restoreAudioPreferences({version:27,master:2}),DEFAULT_AUDIO);
 const p=restoreAudioPreferences({version:1,master:3,engine:-12,ambience:Infinity,effects:.3,muted:true});
 assert.deepEqual(p,{version:1,master:1,engine:0,ambience:0,effects:.3,muted:true});
 assert.equal(channelVolumes(p).master,0);
 assert.equal(channelVolumes(p).effects,0);
});
test('petrol model RPM and loudness rise with speed, acceleration and throttle',()=>{
 const idle=audioFrame({vehicleId:'solstice',velocity:0,active:true});
 const cruising=audioFrame({vehicleId:'solstice',velocity:30,active:true});
 const throttling=audioFrame({vehicleId:'solstice',velocity:30,accelerating:true,active:true});
 assert.ok(cruising.engineHz>idle.engineHz);
 assert.ok(cruising.engineGain>idle.engineGain);
 assert.ok(throttling.engineHz>cruising.engineHz);
 assert.ok(throttling.engineGain>cruising.engineGain);
 assert.ok(cruising.roadGain>idle.roadGain);
});
test('EV has quieter engine and a pitch-dependent electrical drivetrain',()=>{
 const petrol=audioFrame({vehicleId:'vantage',velocity:22});
 const ev=audioFrame({vehicleId:'tide',velocity:22});
 assert.equal(ev.engineGain,0);
 assert.ok(ev.electricalGain>petrol.electricalGain);
 assert.ok(ev.electricalHz>180);
 assert.ok(petrol.engineHz>0);
});
test('models retain distinct acoustic identities',()=>{
 const suv=audioFrame({vehicleId:'atlas',velocity:10});
 const hyper=audioFrame({vehicleId:'comet',velocity:10});
 const vintage=audioFrame({vehicleId:'retro',velocity:10});
 assert.ok(hyper.engineHz>suv.engineHz);
 assert.ok(vintage.harmonic!==hyper.harmonic);
 assert.notEqual(hyper.engineHz,vintage.engineHz);
});
test('rain is audible outdoors but silent in walkable homes',()=>{
 const wet=audioFrame({onFoot:true,weather:'rain',moving:true,active:true});
 const dry=audioFrame({onFoot:true,weather:'clear',moving:true,active:true});
 const indoors=audioFrame({onFoot:true,weather:'rain',inside:true,moving:true,active:true});
 assert.ok(wet.rainGain>dry.rainGain);
 assert.equal(dry.rainGain,0);
 assert.equal(indoors.rainGain,0);
 assert.equal(indoors.windGain,0);
 assert.ok(indoors.footstepInterval>0);
});
test('steps adapt to walking and sprinting, and stop when paused',()=>{
 const walking=audioFrame({onFoot:true,moving:true});
 const running=audioFrame({onFoot:true,moving:true,sprinting:true});
 assert.ok(walking.footstepInterval>running.footstepInterval);
 assert.equal(audioFrame({onFoot:true,moving:false}).footstepInterval,0);
 assert.equal(audioFrame({onFoot:true,moving:true,paused:true}).footstepInterval,0);
 assert.equal(audioFrame({onFoot:true,moving:true,active:false}).footstepInterval,0);
});
test('paused sound profile silences persistent motor/ambient channels',()=>{
 const paused=audioFrame({vehicleId:'comet',velocity:60,paused:true,weather:'rain'});
 assert.equal(paused.engineGain,0);
 assert.equal(paused.electricalGain,0);
 assert.equal(paused.roadGain,0);
 assert.equal(paused.rainGain,0);
 assert.equal(paused.windGain,0);
});
test('invalid inputs always yield finite physically safe acoustic values',()=>{
 for(const value of [NaN,Infinity,-Infinity,1e20]){
  const state=audioFrame({vehicleId:'not-found',velocity:value,weather:'invalid'});
  for(const k of ['engineHz','engineGain','electricalHz','electricalGain','roadGain','rainGain','windGain'])
   assert.ok(Number.isFinite(state[k]),k);
  assert.ok(state.engineGain>=0&&state.engineGain<=1);
 }
});
function mockAudioWindow(){
 const contexts=[];
 class Param{
  constructor(value=0){this.value=value}
  setTargetAtTime(value){this.value=value}
  setValueAtTime(value){this.value=value}
  exponentialRampToValueAtTime(value){this.value=value}
 }
 class Node{
  constructor(){this.gain=new Param();this.frequency=new Param(160);
   this.Q=new Param();this.threshold=new Param();this.knee=new Param();
   this.ratio=new Param();this.attack=new Param();this.release=new Param();
   this.stopped=false;this.started=false;this.type='lowpass'}
  connect(node){this.output=node;return node}
  disconnect(){this.output=null}
  start(){this.started=true}
  stop(){this.stopped=true}
 }
 class Context{
  constructor(){this.destination=new Node();this.sampleRate=4000;this.currentTime=5;
   this.nodes=[];this.closed=false;contexts.push(this)}
  add(){const node=new Node();this.nodes.push(node);return node}
  createGain(){return this.add()}
  createDynamicsCompressor(){return this.add()}
  createBiquadFilter(){return this.add()}
  createOscillator(){return this.add()}
  createBufferSource(){return this.add()}
  createBuffer(channels,length){return {getChannelData:()=>new Float32Array(length)}}
  resume(){return Promise.resolve()}
  close(){this.closed=true;return Promise.resolve()}
 }
 return {win:{AudioContext:Context,performance:{now:()=>1000}},contexts};
}
test('WebAudio graph is never initialized until real player interaction',()=>{
 const {win,contexts}=mockAudioWindow();
 const engine=createGameAudio({win});
 assert.equal(contexts.length,0);
 engine.update({velocity:20},1100);
 assert.equal(contexts.length,0);
 assert.equal(engine.getStatus().ready,false);
 assert.equal(engine.start(),true);
 assert.equal(contexts.length,1);
 assert.equal(engine.getStatus().ready,true);
 engine.update({vehicleId:'vantage',velocity:18,weather:'rain'},1200);
 assert.equal(engine.cue('purchase'),true);
 engine.dispose();
 assert.equal(contexts[0].closed,true);
});
test('muting live output also stops event cues; unmute restores them',()=>{
 const {win}=mockAudioWindow();
 const engine=createGameAudio({win});
 engine.start();
 engine.setPreferences({...DEFAULT_AUDIO,muted:true});
 assert.equal(engine.getStatus().muted,true);
 assert.equal(engine.cue('complete'),false);
 engine.setPreferences({...DEFAULT_AUDIO,muted:false});
 assert.equal(engine.cue('complete'),true);
 engine.dispose();
});
test('WebAudio API unsupported: game continues and exposes fallback state',()=>{
 const engine=createGameAudio({win:{performance:{now:()=>0}}});
 assert.equal(engine.start(),false);
 assert.equal(engine.getStatus().unsupported,true);
 assert.equal(engine.cue('ui'),false);
 engine.update({},0);
});
test('sound preferences survive the same full-game archive as all owned cars',async()=>{
 const drive={stage:2,credits:45000,fleet:{version:1,owned:['azure-starter','tide'],active:'tide'},
  audio:{version:1,master:.36,engine:.22,ambience:.71,effects:.94,muted:true}};
 const rawStore={getItem:key=>key==='azure-coast-driving-v2'?JSON.stringify(drive):null};
 const archive=await createSaveArchive(rawStore);
 const restored=await validateSaveArchive(JSON.stringify(archive));
 const p=restored.records['azure-coast-driving-v2'];
 assert.equal(p.credits,45000);
 assert.equal(p.fleet.active,'tide');
 assert.equal(p.audio.master,.36);
 assert.equal(p.audio.muted,true);
 assert.equal(p.audio.ambience,.71);
});
test('audio UI has functional controls integrated with actual gameplay code',()=>{
 const game=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 assert.match(game,/audioEngine\.start\(\)/);
 assert.match(game,/audioEngine\.update/);
 assert.match(game,/audioEngine\.cue\('impact'/);
 assert.match(game,/audioEngine\.cue\('complete'/);
 assert.match(game,/audio:audioProfile/);
 for(const id of ['audioOpen','audioPanel','audioMute','audio-master',
 'audio-engine','audio-ambience','audio-effects','audioTest','audioStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/audio-ui\.css/);
});
