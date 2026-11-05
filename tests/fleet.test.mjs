import test from 'node:test';
import assert from 'node:assert/strict';
import {vehicles} from '../public/catalog.mjs';
import {garageTuning,createGarage} from '../public/garage.mjs';
import {stepVehicle} from '../public/simulation.mjs';
import {
 STARTER_ID,FLEET_CATALOG,FLEET_DEALERSHIP,restoreFleet,freshFleet,
 fleetVehicle,buyFleetVehicle,switchFleetVehicle,sellFleetVehicle,
 dealershipAccess,fleetTuning
} from '../public/fleet.mjs';
import {readFileSync} from 'node:fs';
const parked=()=>({position:{x:FLEET_DEALERSHIP.x,z:FLEET_DEALERSHIP.z},speed:0,mode:'vehicle'});

test('all six website models appear once in the actual in-game sales inventory',()=>{
 assert.equal(FLEET_CATALOG.length,7);
 assert.deepEqual(FLEET_CATALOG.slice(1).map(v=>v.id),vehicles.map(v=>v.id));
 assert.equal(new Set(FLEET_CATALOG.map(x=>x.id)).size,7);
 assert.equal(FLEET_CATALOG[0].id,STARTER_ID);
 assert.equal(FLEET_CATALOG[0].price,0);
 for(const car of vehicles){
  const item=fleetVehicle(car.id);
  assert.equal(item.price,car.price);
  assert.equal(item.top,car.top);
  assert.equal(item.color,car.color);
  assert.ok(item.body&&item.steering>0&&item.braking>0);
 }
});

test('new players own a drivable free starter, not a fabricated premium car',()=>{
 const fleet=freshFleet();
 assert.deepEqual(fleet.owned,[STARTER_ID]);
 assert.equal(fleet.active,STARTER_ID);
 assert.equal(fleetVehicle(fleet.active).name,'COAST / GT');
 assert.equal(restoreFleet(null).active,STARTER_ID);
});

test('spending and ownership are atomic with the existing game wallet',()=>{
 const bought=buyFleetVehicle(freshFleet(),'tide',200000,parked());
 assert.equal(bought.reason,null);
 assert.equal(bought.cost,96000);
 assert.equal(bought.balance,104000);
 assert.equal(bought.state.active,STARTER_ID);
 assert.ok(bought.state.owned.includes('tide'));
 assert.equal(bought.state.spent,96000);
 assert.equal(bought.state.transactions,1);
 assert.equal(buyFleetVehicle(bought.state,'tide',bought.balance,parked()).reason,'owned');
});

test('purchases refuse insufficient funds, invalid cars and moving customers',()=>{
 for(const [id,wallet,where,reason] of [
  ['tide',1000,parked(),'funds'],['bad-model',1000000,parked(),'unknown'],
  [STARTER_ID,1000000,parked(),'unknown'],
  ['tide',200000,{position:{x:100,z:300},speed:0},'distance'],
  ['tide',200000,{...parked(),speed:9},'moving'],
  ['tide',-8,parked(),'wallet']
 ]){
  const result=buyFleetVehicle(freshFleet(),id,wallet,where);
  assert.equal(result.reason,reason);
  assert.deepEqual(result.state,freshFleet());
  assert.equal(result.balance,wallet);
 }
});

test('cannot change to unowned cars; switching requires stopping at showroom',()=>{
 const bought=buyFleetVehicle(freshFleet(),'vantage',250000,parked());
 assert.equal(switchFleetVehicle(freshFleet(),'vantage',parked()).reason,'not-owned');
 assert.equal(switchFleetVehicle(bought.state,'vantage',{...parked(),speed:5}).reason,'moving');
 const switched=switchFleetVehicle(bought.state,'vantage',parked());
 assert.equal(switched.reason,null);
 assert.equal(switched.state.active,'vantage');
 assert.deepEqual(switched.state.owned,bought.state.owned);
 assert.equal(switchFleetVehicle(switched.state,'vantage',parked()).reason,'active');
});

test('resale returns 60%, cannot sell the active car or free starter',()=>{
 const car=vehicles.find(x=>x.id==='retro');
 const bought=buyFleetVehicle(freshFleet(),car.id,180000,parked());
 assert.equal(sellFleetVehicle(bought.state,STARTER_ID,bought.balance,parked()).reason,'unknown');
 const current=switchFleetVehicle(bought.state,car.id,parked());
 assert.equal(sellFleetVehicle(current.state,car.id,bought.balance,parked()).reason,'active');
 const result=sellFleetVehicle(bought.state,car.id,bought.balance,parked());
 assert.equal(result.reason,null);
 assert.equal(result.refund,Math.floor(car.price*.6));
 assert.deepEqual(result.state.owned,[STARTER_ID]);
 assert.equal(result.state.active,STARTER_ID);
 assert.equal(result.balance,180000-car.price+result.refund);
 assert.equal(sellFleetVehicle(result.state,car.id,result.balance,parked()).reason,'not-owned');
});

test('malicious saves cannot select unowned car, duplicate cars or fake identifiers',()=>{
 const input={version:1,owned:['retro','retro','fake','tide'],active:'comet',spent:Infinity,transactions:-1};
 const result=restoreFleet(input);
 assert.deepEqual(result.owned,[STARTER_ID,'retro','tide']);
 assert.equal(result.active,STARTER_ID);
 assert.equal(result.spent,0);
 assert.equal(result.transactions,0);
 assert.deepEqual(restoreFleet({version:77,owned:['comet'],active:'comet'}),freshFleet());
});

test('performance really differs between SUV, EV and hypercar, with garage upgrades preserved',()=>{
 const garage=garageTuning(createGarage());
 const active=id=>fleetTuning({version:1,owned:[STARTER_ID,id],active:id},garage);
 const suv=active('atlas'),ev=active('tide'),hyper=active('comet');
 assert.ok(suv.maxSpeed<ev.maxSpeed);
 assert.ok(hyper.maxSpeed>ev.maxSpeed);
 assert.ok(hyper.acceleration>suv.acceleration);
 assert.ok(hyper.steering>suv.steering);
 const original={speed:2,heading:0,x:0,z:0};
 const gas={forward:true,left:true};
 const stepSuv=stepVehicle(original,gas,.05,suv);
 const stepHyper=stepVehicle(original,gas,.05,hyper);
 assert.ok(stepHyper.speed>stepSuv.speed);
 assert.ok(stepHyper.heading>stepSuv.heading);
 const upgraded=fleetTuning({version:1,owned:[STARTER_ID,'comet'],active:'comet'},
  garageTuning({...createGarage(),engine:3,handling:2}));
 assert.ok(upgraded.maxSpeed>hyper.maxSpeed);
 assert.ok(upgraded.steering>hyper.steering);
 assert.ok(upgraded.acceleration>hyper.acceleration);
});

test('real top speed can exceed the former 80 m/s prototype cap',()=>{
 const fast=fleetTuning({version:1,owned:[STARTER_ID,'comet'],active:'comet'},garageTuning(createGarage()));
 let state={speed:79,heading:0,x:0,z:0};
 for(let i=0;i<100;i++)state=stepVehicle(state,{forward:true},.05,fast);
 assert.ok(state.speed>80);
 assert.ok(state.speed<=fast.maxSpeed+.01);
});

test('dealership is reachable, valid and respects stationary radius',()=>{
 assert.equal(dealershipAccess(parked()).allowed,true);
 assert.equal(dealershipAccess({position:{x:Infinity,z:4},speed:0}).reason,'position');
 assert.equal(dealershipAccess({...parked(),speed:4}).reason,'moving');
 const boundary={position:{x:FLEET_DEALERSHIP.x+FLEET_DEALERSHIP.radius,z:FLEET_DEALERSHIP.z},speed:0};
 assert.equal(dealershipAccess(boundary).allowed,true);
});

test('vehicle purchase, garage and house ownership persist in the same JSON document',()=>{
 const garage=createGarage();
 const old={credits:150000,stage:2,garage,housing:{version:1,owned:[]}};
 const deal=buyFleetVehicle(freshFleet(),'tide',old.credits,parked());
 const selected=switchFleetVehicle(deal.state,'tide',parked());
 const saved=JSON.parse(JSON.stringify({...old,credits:deal.balance,fleet:selected.state}));
 assert.equal(saved.credits,54000);
 assert.equal(saved.fleet.active,'tide');
 assert.equal(saved.garage.engine,0);
 assert.deepEqual(saved.housing.owned,[]);
 assert.equal(restoreFleet(saved.fleet).active,'tide');
});

test('each purchasable body has distinct shape configuration and game swaps meshes',()=>{
 const source=readFileSync(new URL('../public/fleet-art.mjs',import.meta.url),'utf8');
 const main=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 for(const kind of ['solstice','vantage','tide','atlas','retro','comet'])
  assert.match(source,new RegExp(kind));
 assert.match(source,/releaseFleetCar/);
 assert.match(source,/createFleetCar/);
 assert.match(main,/equipFleetVehicle/);
 assert.match(main,/fleetTuning/);
 assert.match(main,/fleetProfile/);
});
