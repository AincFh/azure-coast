import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nearbyObstacles,intersectsBuilding} from '../public/physics.mjs';
import {signalIsGreen} from '../public/traffic-core.mjs';
import {
 CITIZEN_VERSION,CITIZEN_COUNT,TALK_RADIUS,CONVERSATION_TOPICS,
 createCitizen,createCitizens,tickCitizens,nearestCitizen,
 pedestrianCrossingCanStart,emptySocial,restoreSocial,
 talkToCitizen,socialRank,residentById,citizenReply,districtOf
} from '../public/citizens-core.mjs';
import {createSaveArchive,validateSaveArchive} from '../public/save-archive.mjs';
const at=agent=>({position:{x:agent.x,z:agent.z},mode:'foot',hour:16,weather:'clear'});
const sample=()=>createCitizen(4);

test('84 persistent citizens have deterministic unique IDs, professions, sidewalk lanes and appearances',()=>{
 const one=createCitizens(),two=createCitizens();
 assert.deepEqual(one,two);
 assert.equal(one.length,CITIZEN_COUNT);
 assert.equal(new Set(one.map(x=>x.id)).size,CITIZEN_COUNT);
 assert.ok(new Set(one.map(x=>x.name)).size>=18);
 assert.ok(new Set(one.map(x=>x.profession)).size>=6);
 for(const c of one){
  assert.ok(Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.heading));
  assert.ok(['sidewalk','crossing','greeter'].includes(c.type));
  assert.ok(c.x>=-620&&c.x<=620&&c.z>=-620&&c.z<=620);
 }
 assert.deepEqual(residentById(4),sample());
 assert.equal(residentById(-1),null);
 assert.equal(residentById(CITIZEN_COUNT),null);
});

test('starter plaza always has an on-foot sidewalk guide within 7 metres of player vehicle exit',()=>{
 const greeter=sample();
 assert.equal(greeter.type,'greeter');
 assert.ok(Math.hypot(greeter.x-5,greeter.z-12)<=TALK_RADIUS);
 assert.equal(intersectsBuilding(greeter.x,greeter.z,.65,
  nearbyObstacles(greeter.x,greeter.z)),false);
 const result=nearestCitizen(createCitizens(),{x:5,z:12});
 assert.equal(result.resident.id,4);
});

test('sidewalk walker moves between street edges, not through downtown building footprints',()=>{
 let agents=createCitizens(),current=agents.find(x=>x.id===13);
 const initial={x:current.x,z:current.z};
 for(let i=0;i<1200;i++){
  current=tickCitizens([current],.08,i*.08,{hour:13})[0];
  assert.equal(intersectsBuilding(current.x,current.z,.5,
   nearbyObstacles(current.x,current.z)),false,'pedestrian walked through a building');
 }
 assert.ok(Math.hypot(current.x-initial.x,current.z-initial.z)>2);
 assert.ok(current.distance>0);
 assert.equal(current.visible,true);
});

test('pedestrians cross only when perpendicular traffic has a green phase',()=>{
 const cross=createCitizen(9);
 assert.equal(cross.type,'crossing');
 let red=null,green=null;
 for(let t=0;t<32;t++){
  const can=pedestrianCrossingCanStart(cross,t);
  const signal=signalIsGreen(cross.crossingAxis,cross.blockX,cross.blockZ,t);
  assert.equal(can,signal);
  if(can)green=t;else red=t;
 }
 assert.ok(red!==null&&green!==null);
 assert.equal(pedestrianCrossingCanStart(cross,red),false);
 assert.equal(pedestrianCrossingCanStart(cross,green),true);
 let waiting=tickCitizens([cross],.1,green,{hour:14})[0];
 assert.equal(waiting.phase,'waiting');
 for(let i=0;i<12&&waiting.phase==='waiting';i++)
  waiting=tickCitizens([waiting],.1,green,{hour:14})[0];
 assert.equal(waiting.phase,'crossing');
 const crossing=waiting;
 const move=tickCitizens([crossing],.1,green,{hour:14})[0];
 assert.ok(move.progress>crossing.progress);
});

test('pedestrian refuses entry when nearby moving traffic would make it unsafe',()=>{
 const c=createCitizen(9),traffic=[{x:c.x+1,z:c.z+.5}];
 assert.equal(pedestrianCrossingCanStart(c,3,traffic),false);
 const after=tickCitizens([{...c,wait:10}],.05,3,{hour:15,traffic});
 assert.equal(after[0].phase,'waiting');
 assert.equal(after[0].speed,0);
});

test('crossing pedestrians already in the road continue until the far curb',()=>{
 const c=createCitizen(9);
 let state={...c,phase:'crossing',progress:.9,wait:0};
 for(let i=0;i<60&&state.phase==='crossing';i++)
  state=tickCitizens([state],.1,14,{hour:15})[0];
 assert.equal(state.phase,'waiting');
 assert.equal(state.progress,0);
 assert.equal(state.side,-c.side);
 assert.ok(Math.abs(state.x-c.x)>20||Math.abs(state.z-c.z)>20);
});

test('rain, late night and morning rush change real pedestrian behavior',()=>{
 const current=createCitizens();
 const midday=tickCitizens(current,.1,10,{hour:14,weather:'clear'});
 const rush=tickCitizens(current,.1,10,{hour:8,weather:'clear'});
 const night=tickCitizens(current,.1,10,{hour:1,weather:'clear'});
 const rainy=tickCitizens(current,.1,10,{hour:14,weather:'rain'});
 const walker=current.find(x=>x.id===13);
 assert.ok(rush[13].speed>midday[13].speed);
 assert.ok(night.filter(x=>x.visible).length<midday.filter(x=>x.visible).length);
 const shelter=rainy.find(x=>x.id===7);
 assert.equal(shelter.phase,'sheltering');
 assert.equal(shelter.speed,0);
 assert.equal(midday.find(x=>x.id===7).visible,true);
 assert.ok(walker);
});

test('resident yields instead of walking through the current player car',()=>{
 const one=createCitizen(13);
 const next=tickCitizens([one],.08,12,{hour:14,player:{
  mode:'vehicle',position:{x:one.x,z:one.z}
 }})[0];
 assert.equal(next.speed,0);
 assert.equal(next.x,one.x);
 assert.equal(next.z,one.z);
});

test('nearest resident never selects sleeping, distant or invalid subjects',()=>{
 const c=sample(),gone={...c,visible:false};
 assert.equal(nearestCitizen([gone],{x:c.x,z:c.z}),null);
 assert.equal(nearestCitizen([c],{x:1000,z:1000}),null);
 assert.equal(nearestCitizen([c],{x:NaN,z:0}),null);
 assert.equal(nearestCitizen([c],{x:c.x,z:c.z}).resident.id,4);
});

test('talking in person creates a relationship and records discoveries without new money',()=>{
 const resident=sample(),start=emptySocial();
 const greeting=talkToCitizen(start,resident,'greeting',at(resident));
 assert.equal(greeting.reason,null);
 assert.equal(greeting.newPerson,true);
 assert.deepEqual(greeting.state.met,[resident.id]);
 assert.equal(greeting.trust,1);
 assert.equal(greeting.connections,1);
 assert.equal(greeting.state.conversations,1);
 assert.ok(greeting.reply.includes(resident.name));
 const later=talkToCitizen(greeting.state,resident,'neighborhood',at(resident));
 assert.equal(later.reason,null);
 assert.equal(later.newPerson,false);
 assert.equal(later.trust,2);
 assert.ok(later.reply.includes(resident.district));
 assert.equal(later.state.conversations,2);
 assert.deepEqual(later.state.insights,[resident.id+':greeting',resident.id+':neighborhood']);
});

test('talking from a car, from far away or using a forged topic cannot grow reputation',()=>{
 const resident=sample(),starting=emptySocial();
 for(const [topic,input,reason] of [
  ['greeting',{...at(resident),mode:'vehicle'},'mode'],
  ['greeting',{...at(resident),position:{x:500,z:500}},'distance'],
  ['invent-money',at(resident),'topic']
 ]){
  const r=talkToCitizen(starting,resident,topic,input);
  assert.equal(r.reason,reason);
  assert.deepEqual(r.state,starting);
 }
 assert.equal(talkToCitizen(starting,{...resident,visible:false},'greeting',at(resident)).reason,'not-present');
 assert.equal(talkToCitizen(starting,null,'greeting',at(resident)).reason,'unknown');
});

test('conversational responses are context-sensitive to weather, time, familiarity and profession',()=>{
 const person=sample();
 assert.match(citizenReply(person,'greeting',{hour:2}),/晚上好/);
 assert.match(citizenReply(person,'profession',{trust:2}),new RegExp(person.profession));
 assert.match(citizenReply(person,'weather',{weather:'rain'}),/下雨/);
 assert.match(citizenReply(person,'weather',{weather:'overcast'}),/云层/);
 assert.match(citizenReply(person,'weather',{weather:'clear'}),/天气不错/);
 assert.match(citizenReply(person,'neighborhood',{trust:3}),new RegExp(person.name));
 assert.match(citizenReply(person,'city',{trust:1}),/街道/);
 assert.equal(CONVERSATION_TOPICS.length,5);
});

test('invalid social data cannot spoof unavailable residents or unbounded relationship points',()=>{
 const evil={version:1,met:[4,4,-1,9999,'4'],relationships:{
  4:999,9999:999},conversations:Infinity,insights:['4:greeting','4:invent-money','999:weather','4:city','4:city']};
 const safe=restoreSocial(evil);
 assert.deepEqual(safe.met,[4]);
 assert.equal(safe.relationships[4],3);
 assert.equal(safe.conversations,0); // non-safe integer rejected
 assert.deepEqual(safe.insights,['4:greeting','4:city']);
 assert.deepEqual(restoreSocial({version:100,met:[4]}),emptySocial());
 assert.equal(socialRank({...safe,met:[]}), '初来乍到');
 assert.equal(socialRank({...safe,met:[4]}),'新朋友');
 assert.equal(socialRank({...safe,met:[0,1,2,3,4]}),'友好邻居');
 assert.equal(socialRank({...safe,met:Array.from({length:10},(_,i)=>i)}),'街区常客');
 assert.equal(socialRank({...safe,met:Array.from({length:25},(_,i)=>i)}),'城市知己');
});

test('citizenship state round-trips in the same checksum archive as cars, audio and houses',async()=>{
 const friend=talkToCitizen(emptySocial(),sample(),'greeting',at(sample())).state;
 const driving={stage:1,credits:44000,citizens:friend,
  fleet:{version:1,owned:['azure-starter','tide'],active:'tide'},
  audio:{version:1,master:.6,engine:.8,ambience:.5,effects:.75,muted:false}};
 const stored={getItem:key=>key==='azure-coast-driving-v2'?JSON.stringify(driving):null};
 const archive=await createSaveArchive(stored);
 const verified=await validateSaveArchive(archive);
 const record=verified.records['azure-coast-driving-v2'];
 assert.equal(record.credits,44000);
 assert.equal(record.fleet.active,'tide');
 assert.equal(record.audio.master,.6);
 assert.deepEqual(record.citizens.met,[4]);
 assert.equal(record.citizens.conversations,1);
});

test('3D pedestrians are batched and actual gameplay feeds weather, traffic and live position',()=>{
 const world=readFileSync(new URL('../public/citizens-world.mjs',import.meta.url),'utf8');
 const game=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/citizens-ui.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 assert.match(world,/THREE\.InstancedMesh/);
 assert.match(world,/DynamicDrawUsage/);
 assert.match(game,/citizenWorld\.update\(dt,now/);
 assert.match(game,/traffic:trafficWorld\.getAgentPositions\(\)/);
 assert.match(game,/socialProfile=restoreSocial/);
 assert.match(game,/citizens:socialProfile/);
 assert.match(ui,/talkToCitizen/);
 assert.match(ui,/getPlayer\(\)/);
 for(const name of ['citizenPanel','citizenOpen','citizenClose','citizenTopics','citizenPrompt','citizenStatus'])
  assert.match(html,new RegExp('id="'+name+'"'));
 assert.match(html,/citizens\.css/);
});
