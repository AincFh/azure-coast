import test from 'node:test';
import assert from 'node:assert/strict';
import {ROAD_HANDLING,roadHandling,estimatedStoppingDistance,stepVehicle}
 from '../public/simulation.mjs';

const initial=(speed=0)=>({speed,heading:0,x:0,z:0});
const forward=(weather,frames=30)=>{
 let state=initial();
 for(let i=0;i<frames;i++)
  state=stepVehicle(state,{forward:true},.05,{weather,maxSpeed:49});
 return state;
};

test('known weather handling is deterministic and unknown inputs fall back to dry',()=>{
 assert.deepEqual(Object.keys(ROAD_HANDLING),['clear','overcast','rain']);
 assert.equal(roadHandling('broken'),roadHandling('clear'));
 assert.equal(roadHandling('rain').label,'雨天湿滑');
 assert.ok(roadHandling('rain').braking<roadHandling('overcast').braking);
 assert.ok(roadHandling('overcast').braking<roadHandling('clear').braking);
 assert.ok(Object.isFrozen(roadHandling('clear')));
});
test('rain reduces real acceleration without altering road or throttle inputs',()=>{
 const clear=forward('clear'),cloudy=forward('overcast'),rain=forward('rain');
 assert.ok(clear.speed>cloudy.speed&&cloudy.speed>rain.speed,
  JSON.stringify({clear:clear.speed,cloudy:cloudy.speed,rain:rain.speed}));
 assert.ok(clear.z<cloudy.z&&cloudy.z<rain.z);
 assert.equal(forward('unsupported').speed,clear.speed);
});
test('rain extends reverse-braking distance from same forward velocity',()=>{
 let dry=initial(30),wet=initial(30);
 for(let i=0;i<12;i++){
  dry=stepVehicle(dry,{reverse:true},.05,{weather:'clear'});
  wet=stepVehicle(wet,{reverse:true},.05,{weather:'rain'});
 }
 assert.ok(wet.speed>dry.speed,'Wet brakes must decelerate less');
 assert.ok(Math.abs(wet.z)>Math.abs(dry.z),
  'Wet stopping requires more forward travel under equal input');
});
test('wet turning responds more gently at equal velocity and input',()=>{
 const dry=stepVehicle(initial(24),{left:true},.05,{weather:'clear'});
 const wet=stepVehicle(initial(24),{left:true},.05,{weather:'rain'});
 assert.ok(Math.abs(wet.heading)<Math.abs(dry.heading));
 assert.ok(wet.heading>0&&dry.heading>0);
});
test('stopping estimate rises in rain and honors braking upgrades',()=>{
 const dry=estimatedStoppingDistance(30,'clear');
 const cloudy=estimatedStoppingDistance(30,'overcast');
 const wet=estimatedStoppingDistance(30,'rain');
 assert.ok(wet>cloudy&&cloudy>dry);
 assert.ok(estimatedStoppingDistance(30,'rain',1.3)<wet);
 assert.equal(estimatedStoppingDistance(0,'rain'),0);
 assert.equal(estimatedStoppingDistance(NaN,'rain'),0);
 assert.equal(estimatedStoppingDistance(-30,'rain'),wet);
 assert.ok(estimatedStoppingDistance(1000,'rain')<=1000);
});
test('rain handling preserves fuel-starved emergency movement cap',()=>{
 let state=initial();
 for(let i=0;i<200;i++)
  state=stepVehicle(state,{forward:true},.05,{weather:'rain',maxSpeed:3});
 assert.ok(state.speed>0&&state.speed<=3);
});
test('rain has no ability to bypass speed or steering tuning bounds',()=>{
 let wet=initial();
 for(let i=0;i<400;i++)
  wet=stepVehicle(wet,{forward:true,left:true},.05,{
   weather:'rain',maxSpeed:999,steering:999,acceleration:999,braking:999
  });
 assert.ok(wet.speed<=107);
 assert.ok(Number.isFinite(wet.x)&&Number.isFinite(wet.z)&&Number.isFinite(wet.heading));
 const idle=stepVehicle(initial(),{forward:true},NaN,{weather:'rain'});
 assert.equal(idle.speed,0);
});
