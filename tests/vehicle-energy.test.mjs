import test from 'node:test';
import assert from 'node:assert/strict';
import {FLEET_CATALOG,STARTER_ID} from '../public/fleet.mjs';
import {
 ENERGY_CAPACITY,ENERGY_PER_METRE,ENERGY_PRICE_PER_UNIT,ENERGY_STATIONS,
 freshEnergy,restoreEnergy,energyLevel,consumeEnergy,nearestEnergyStation,
 energyStationAccess,rechargeVehicle
} from '../public/vehicle-energy.mjs';

const car=STARTER_ID;
const player=(x=ENERGY_STATIONS[0].x,z=ENERGY_STATIONS[0].z,speed=0,onFoot=false)=>
 ({position:{x,z},speed,onFoot});

test('all vehicles begin with independent full tanks and legacy saves remain valid',()=>{
 const old=restoreEnergy(null);
 assert.equal(old.version,1);
 for(const vehicle of FLEET_CATALOG)assert.equal(energyLevel(old,vehicle.id),100);
 const broken=restoreEnergy({version:1,tanks:{[car]:-40,tide:Infinity,retro:180,unknown:7},
  spent:-500,transactions:1e30});
 assert.equal(energyLevel(broken,car),0);
 assert.equal(energyLevel(broken,'tide'),100);
 assert.equal(energyLevel(broken,'retro'),100);
 assert.equal(energyLevel(broken,'unknown'),0);
 assert.equal(broken.spent,0);
 assert.equal(broken.transactions,0);
 assert.deepEqual(restoreEnergy({version:44,tanks:{[car]:6}}),freshEnergy());
});

test('distance consumes energy without mutating the prior save or other vehicles',()=>{
 const original=freshEnergy();
 const once=consumeEnergy(original,car,625);
 assert.equal(original.tanks[car],undefined);
 assert.equal(once.used,625*ENERGY_PER_METRE);
 assert.equal(energyLevel(once.state,car),95);
 assert.equal(energyLevel(once.state,'tide'),100);
 const again=consumeEnergy(once.state,car,15000);
 assert.equal(energyLevel(again.state,car),0);
 assert.equal(again.used,95);
 assert.equal(energyLevel(again.state,'tide'),100);
 assert.equal(consumeEnergy(again.state,car,100).used,0);
 assert.strictEqual(consumeEnergy(once.state,car,-10).state,once.state);
 assert.strictEqual(consumeEnergy(once.state,car,NaN).state,once.state);
});

test('charging requires a stationary occupied vehicle at a physical station',()=>{
 const a=ENERGY_STATIONS[0];
 assert.equal(nearestEnergyStation({x:a.x+2,z:a.z}).id,a.id);
 assert.equal(energyStationAccess(player()).allowed,true);
 assert.equal(energyStationAccess(player(620,620)).reason,'distance');
 assert.equal(energyStationAccess(player(a.x,a.z,5)).reason,'moving');
 assert.equal(energyStationAccess(player(a.x,a.z,0,true)).reason,'on-foot');
 assert.equal(energyStationAccess({position:{x:Infinity,z:0}}).reason,'position');
});

test('charging debits the same wallet, supports partial refills and never grants free energy',()=>{
 const empty=consumeEnergy(freshEnergy(),car,6250).state;
 assert.equal(energyLevel(empty,car),50);
 const low=rechargeVehicle(empty,car,6,player());
 assert.equal(low.reason,'funds');
 assert.strictEqual(low.state,empty);
 const partial=rechargeVehicle(empty,car,7*11,player());
 assert.equal(partial.reason,null);
 assert.equal(partial.cost,77);
 assert.equal(partial.balance,0);
 assert.equal(energyLevel(partial.state,car),61);
 assert.equal(partial.state.transactions,1);
 assert.equal(partial.state.spent,77);
 assert.equal(energyLevel(empty,car),50);
 const full=rechargeVehicle(partial.state,car,1000,player());
 assert.equal(full.reason,null);
 assert.equal(full.cost,39*ENERGY_PRICE_PER_UNIT);
 assert.equal(energyLevel(full.state,car),ENERGY_CAPACITY);
 assert.equal(rechargeVehicle(full.state,car,1000,player()).reason,'full');
});

test('charging rejects forged vehicle IDs, invalid wallet and driving access',()=>{
 const raw=freshEnergy();
 for(const args of [
  ['unknown',100,player()], [car,-2,player()], [car,1.5,player()],
  [car,100,player(300,300)], [car,100,player(ENERGY_STATIONS[0].x,ENERGY_STATIONS[0].z,12)]
 ]){
  const res=rechargeVehicle(raw,...args);
  assert.notEqual(res.reason,null);
  assert.strictEqual(res.state,raw);
 }
});
