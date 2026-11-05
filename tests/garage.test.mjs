import test from 'node:test';
import assert from 'node:assert/strict';
import {
 GARAGE_VERSION,GARAGE_LOCATION,UPGRADE_CATALOG,PAINT_FINISHES,
 createGarage,restoreGarage,upgradePrice,garageTuning,buyGarageItem,garageAccess
} from '../public/garage.mjs';
import {stepVehicle,collisionDamage} from '../public/simulation.mjs';
import {intersectsBuilding,nearbyObstacles} from '../public/physics.mjs';

test('workshop is reachable without driving through a building',()=>{
 assert.equal(GARAGE_VERSION,1);
 assert.equal(intersectsBuilding(GARAGE_LOCATION.x,GARAGE_LOCATION.z,2,nearbyObstacles(GARAGE_LOCATION.x,GARAGE_LOCATION.z)),false);
 assert.equal(new Set(UPGRADE_CATALOG.map(x=>x.id)).size,3);
 assert.equal(new Set(PAINT_FINISHES.map(x=>x.id)).size,5);
});

test('garage level one purchase deducts exact credits and raises power',()=>{
 const base=createGarage();
 assert.equal(upgradePrice(base,'engine'),1800);
 const result=buyGarageItem(base,'upgrade','engine',5000);
 assert.equal(result.reason,null);
 assert.equal(result.cost,1800);
 assert.equal(result.balance,3200);
 assert.equal(result.state.engine,1);
 assert.equal(result.state.purchases,1);
 assert.equal(result.state.spent,1800);
 assert.ok(garageTuning(result.state).acceleration>garageTuning(base).acceleration);
 assert.ok(garageTuning(result.state).maxSpeed>garageTuning(base).maxSpeed);
});

test('three engine tiers have nondecreasing costs and max level cannot be purchased',()=>{
 let state=createGarage(),credits=50000,total=0;
 for(const expected of [1800,4200,8100]){
  const result=buyGarageItem(state,'upgrade','engine',credits);
  assert.equal(result.cost,expected);
  total+=expected;credits=result.balance;state=result.state;
 }
 assert.equal(state.engine,3);
 assert.equal(state.spent,total);
 assert.equal(upgradePrice(state,'engine'),null);
 assert.equal(buyGarageItem(state,'upgrade','engine',credits).reason,'max');
});

test('low balance and wrong products cannot change account or upgrade state',()=>{
 const state=createGarage();
 for(const [kind,id,balance,reason] of [
  ['upgrade','armor',0,'funds'],['paint','copper',500,'funds'],
  ['upgrade','unknown',2000,'unknown'],['paint','unknown',2000,'unknown'],
  ['paint','sand',2000,'owned'],['upgrade','engine',-12,'wallet']
 ]){
  const result=buyGarageItem(state,kind,id,balance);
  assert.equal(result.reason,reason);
  assert.deepEqual(result.state,state);
  assert.equal(result.balance,balance);
 }
});

test('paint purchase changes stored finish and visual color consistently',()=>{
 const base=createGarage();
 const result=buyGarageItem(base,'paint','ocean',1200);
 assert.equal(result.reason,null);
 assert.equal(result.balance,250);
 assert.equal(result.state.paint,'ocean');
 assert.equal(garageTuning(result.state).paintHex,0x296e87);
 const another=buyGarageItem(result.state,'paint','pearl',1200);
 assert.equal(another.state.paint,'pearl');
 assert.equal(restoreGarage(JSON.parse(JSON.stringify(another.state))).paint,'pearl');
});

test('upgraded vehicle accelerates faster, steers more and absorbs impacts',()=>{
 const stock=garageTuning(createGarage());
 const tuned=garageTuning({version:1,engine:3,handling:3,armor:3,paint:'sand'});
 const initial={speed:8,heading:0,x:0,z:0};
 const normal=stepVehicle(initial,{forward:true,left:true},.05,stock);
 const upgraded=stepVehicle(initial,{forward:true,left:true},.05,tuned);
 assert.ok(upgraded.speed>normal.speed);
 assert.ok(upgraded.heading>normal.heading);
 assert.ok(tuned.maxSpeed>stock.maxSpeed);
 assert.ok(Math.round(collisionDamage(35)*tuned.impactFactor)<collisionDamage(35));
 assert.deepEqual(stepVehicle(initial,{forward:true,left:true},.05),normal);
});

test('garage purchases are only allowed while parked near service ramp',()=>{
 const at=(x,z,speed)=>garageAccess({position:{x,z},speed});
 assert.equal(at(GARAGE_LOCATION.x,GARAGE_LOCATION.z,0).allowed,true);
 assert.equal(at(500,500,0).reason,'distance');
 assert.equal(at(GARAGE_LOCATION.x,GARAGE_LOCATION.z,4).reason,'moving');
 assert.equal(garageAccess({position:{x:Infinity,z:0},speed:0}).reason,'location');
});

test('malformed and out-of-range garage profiles restore to safe bounds',()=>{
 const bad=restoreGarage({version:1,engine:Infinity,handling:-9,armor:500,paint:'not-a-paint',spent:-7,purchases:NaN});
 assert.deepEqual({...bad,armor:3},{version:1,engine:0,handling:0,armor:3,paint:'sand',spent:0,purchases:0});
 assert.equal(restoreGarage({version:99,engine:3}).engine,0);
 assert.equal(restoreGarage(null).paint,'sand');
});

test('wallet and upgrade profile can be committed atomically to one save document',()=>{
 const driving={stage:2,credits:7600,damage:12};
 const payment=buyGarageItem(createGarage(),'upgrade','handling',driving.credits);
 const serialized=JSON.stringify({...driving,credits:payment.balance,garage:payment.state});
 const restored=JSON.parse(serialized);
 assert.equal(restored.credits,6100);
 assert.equal(restoreGarage(restored.garage).handling,1);
 assert.equal(restored.damage,12);
});
