import test from 'node:test';
import assert from 'node:assert/strict';
import {
 ACTIVITY_VERSION,ACTIVITY_KEY,CITY_CONTRACTS,DISPATCH,contractById,
 emptyActivities,restoreActivities,currentActivity,currentStep,startActivity,
 cancelActivity,distanceToActivity,interactActivity,interactionPrompt
} from '../public/activities.mjs';
import {intersectsBuilding,nearbyObstacles} from '../public/physics.mjs';

const vehicle=(x,z,speed=0)=>({position:{x,z},mode:'vehicle',speed});
const foot=(x,z)=>({position:{x,z},mode:'foot',speed:0});

test('three distinct city occupations exist with valid on-map checkpoints',()=>{
 assert.equal(ACTIVITY_VERSION,1);
 assert.match(ACTIVITY_KEY,/city-services/);
 assert.equal(CITY_CONTRACTS.length,3);
 assert.equal(new Set(CITY_CONTRACTS.map(c=>c.id)).size,3);
 assert.ok(Number.isFinite(DISPATCH.x)&&Number.isFinite(DISPATCH.z));
 for(const c of CITY_CONTRACTS){
  assert.ok(c.reward>=1500,c.id);
  assert.ok(c.steps.length>=2,c.id);
  assert.equal(new Set(c.steps.map(s=>s.id)).size,c.steps.length,c.id);
  for(const s of c.steps){
   assert.ok(['foot','vehicle'].includes(s.mode));
   assert.ok(s.radius>8&&s.radius<30);
   assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z));
   assert.ok(!intersectsBuilding(s.x,s.z,2,nearbyObstacles(s.x,s.z)),
     'Checkpoint obstructed by building: '+c.id+'/'+s.id);
  }
 }
});

test('idle progress and unknown jobs never create payable activity',()=>{
 const empty=emptyActivities();
 assert.equal(currentActivity(empty),null);
 assert.equal(currentStep(empty),null);
 assert.equal(distanceToActivity(empty,{x:0,z:0}),Infinity);
 assert.deepEqual(interactActivity(empty,foot(0,0)),{
  state:restoreActivities(empty),reason:'idle',event:null,reward:0
 });
 const unknown=startActivity(empty,'invalid');
 assert.equal(unknown.reason,'unknown');
 assert.equal(unknown.state.status,'idle');
 assert.equal(contractById('invalid'),null);
});

test('courier requires on-foot pickup and dropoff, never rewards early',()=>{
 const started=startActivity(emptyActivities(),'courier');
 assert.equal(started.reason,null);
 let state=started.state;
 assert.equal(currentStep(state).id,'collect');
 assert.equal(interactActivity(state,foot(0,0)).reason,'far');
 assert.equal(interactActivity(state,vehicle(0,-100)).reason,'mode');
 const pickup=interactActivity(state,foot(0,-100));
 assert.equal(pickup.event,'checkpoint');
 assert.equal(pickup.reward,0);
 state=restoreActivities(JSON.parse(JSON.stringify(pickup.state)));
 assert.equal(currentStep(state).id,'deliver');
 assert.equal(interactActivity(state,foot(0,-100)).reason,'far');
 const finish=interactActivity(state,foot(-300,-300));
 assert.equal(finish.event,'completed');
 assert.equal(finish.reward,2100);
 assert.equal(finish.state.status,'idle');
 assert.equal(finish.state.completed.courier,1);
 assert.equal(finish.state.earned,2100);
 const again=interactActivity(finish.state,foot(-300,-300));
 assert.equal(again.reward,0);
 assert.equal(again.event,null);
});

test('taxi requires a stopped vehicle at both checkpoints',()=>{
 let state=startActivity(emptyActivities(),'taxi').state;
 assert.equal(interactActivity(state,foot(100,-300)).reason,'mode');
 assert.equal(interactActivity(state,vehicle(100,-300,9)).reason,'moving');
 assert.equal(interactActivity(state,vehicle(100,-300,2)).event,'checkpoint');
 state=interactActivity(state,vehicle(100,-300,2)).state;
 assert.equal(interactActivity(state,vehicle(300,200,7)).reason,'moving');
 const finish=interactActivity(state,vehicle(300,200,0));
 assert.equal(finish.reward,3200);
 assert.equal(finish.state.completed.taxi,1);
});

test('coast survey spans two walkable lookouts and cannot be cashed out from a car',()=>{
 let state=startActivity(emptyActivities(),'survey').state;
 assert.equal(interactActivity(state,vehicle(-300,300)).reason,'mode');
 state=interactActivity(state,foot(-300,300)).state;
 const end=interactActivity(state,foot(-400,-400));
 assert.equal(end.event,'completed');
 assert.equal(end.reward,3900);
});

test('active contract rejects replacements; cancel yields no money',()=>{
 let state=startActivity(emptyActivities(),'taxi').state;
 assert.equal(startActivity(state,'courier').reason,'busy');
 const cancel=cancelActivity(state);
 assert.equal(cancel.cancelled,true);
 assert.equal(cancel.state.earned,0);
 assert.equal(cancel.state.completed.taxi,0);
 assert.equal(cancelActivity(cancel.state).cancelled,false);
 const replacement=startActivity(cancel.state,'courier');
 assert.equal(replacement.reason,null);
 assert.equal(currentActivity(replacement.state).id,'courier');
});

test('restore clamps invalid or malicious save data and never silently completes work',()=>{
 const restored=restoreActivities({
  version:1,status:'active',id:'taxi',index:50000,
  completed:{courier:-3,taxi:Infinity,survey:3.2,bad:999},
  earned:Infinity,history:['bad','courier',23,'taxi']
 });
 assert.equal(restored.index,1);
 assert.equal(restored.status,'active');
 assert.deepEqual(restored.completed,{courier:0,taxi:0,survey:3});
 assert.equal(restored.earned,0);
 assert.deepEqual(restored.history,['courier','taxi']);
 assert.equal(restoreActivities({version:5,id:'taxi'}).status,'idle');
 assert.equal(restoreActivities({version:1,status:'active',id:'unknown'}).status,'idle');
});

test('completed activity counts and earnings persist through multiple real completions',()=>{
 let state=emptyActivities(),total=0;
 for(const c of CITY_CONTRACTS){
  state=startActivity(state,c.id).state;
  for(const step of c.steps){
   const result=interactActivity(state,{position:{x:step.x,z:step.z},mode:step.mode,speed:0});
   state=restoreActivities(JSON.parse(JSON.stringify(result.state)));
   total+=result.reward;
  }
 }
 assert.equal(total,9200);
 assert.equal(state.earned,total);
 assert.deepEqual(state.completed,{courier:1,taxi:1,survey:1});
 assert.deepEqual(state.history,['courier','taxi','survey']);
 state=startActivity(state,'taxi').state;
 for(const goal of CITY_CONTRACTS[1].steps){
  state=interactActivity(state,{position:goal,mode:'vehicle',speed:0}).state;
 }
 assert.equal(state.earned,12400);
 assert.equal(state.completed.taxi,2);
});

test('interaction prompt changes with position, travel mode and speed',()=>{
 let state=startActivity(emptyActivities(),'courier').state;
 assert.equal(interactionPrompt(state,{x:500,z:500},'foot'),null);
 assert.match(interactionPrompt(state,{x:0,z:-100},'vehicle'),/下车/);
 assert.match(interactionPrompt(state,{x:0,z:-100},'foot'),/按 F/);
 state=startActivity(emptyActivities(),'taxi').state;
 assert.match(interactionPrompt(state,{x:100,z:-300},'vehicle',12),/停车/);
 assert.match(interactionPrompt(state,{x:100,z:-300},'vehicle',0),/按 F/);
});
