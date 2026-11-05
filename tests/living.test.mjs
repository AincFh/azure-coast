import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nearbyObstacles,intersectsBuilding} from '../public/physics.mjs';
import {FLEET_CATALOG,STARTER_ID} from '../public/fleet.mjs';
import {
 LIVING_VERSION,SHOPS,PRODUCTS,makeLiving,restoreLiving,
 lifeShop,lifeProduct,closestShop,nearestEnergyShop,shopAccess,canSprint,
 advanceLiving,buyLivingItem,consumeLivingItem,refuelVehicle,
 energyProduct,livingIndicators,inventoryCount
} from '../public/living-core.mjs';
import {createSaveArchive,validateSaveArchive} from '../public/save-archive.mjs';
import {summarizeGameProfile} from '../public/player-bridge.mjs';

const shop=id=>SHOPS.find(s=>s.id===id);
const at=(id,mode='foot',speed=0)=>{
 const place=shop(id);
 return {position:{x:place.x,z:place.z},mode,speed};
};

test('physical shops are located inside the city and not inside building collisions',()=>{
 assert.equal(SHOPS.length,6);
 assert.equal(SHOPS.filter(s=>s.kind==='energy').length,4);
 assert.equal(new Set(SHOPS.map(x=>x.id)).size,6);
 for(const place of SHOPS){
  assert.ok(place.x>=-630&&place.x<=630&&place.z>=-630&&place.z<=630);
  assert.equal(intersectsBuilding(place.x,place.z,.7,
   nearbyObstacles(place.x,place.z)),false,'shop inaccessible '+place.id);
  assert.ok(place.radius>=18&&place.radius<=26);
 }
 const initialExit={x:5,z:12};
 assert.equal(closestShop(initialExit,25).id,'cafe');
 assert.equal(closestShop({x:999,z:999}),null);
 assert.equal(closestShop({x:NaN,z:4}),null);
 assert.equal(lifeShop('invalid'),null);
});

test('all eight original grocery and cafe products have stable prices and survival effects',()=>{
 assert.equal(PRODUCTS.length,8);
 assert.equal(new Set(PRODUCTS.map(p=>p.id)).size,8);
 for(const item of PRODUCTS){
  assert.ok(item.price>0);
  assert.ok(item.shops.length>0);
  assert.ok(item.shops.every(id=>shop(id)?.kind==='food'));
  assert.ok(item.hunger>=0&&item.hydration>=0&&item.stamina>=0);
 }
 assert.equal(lifeProduct('fake'),null);
});

test('new players receive normal vital signs and fully fueled starter car',()=>{
 const fresh=makeLiving();
 assert.equal(fresh.version,LIVING_VERSION);
 assert.equal(fresh.hunger,85);
 assert.equal(fresh.hydration,85);
 assert.equal(fresh.stamina,100);
 assert.equal(fresh.fuel[STARTER_ID],100);
 for(const car of FLEET_CATALOG)assert.equal(fresh.fuel[car.id],100);
 assert.deepEqual(restoreLiving(null),fresh);
 assert.deepEqual(restoreLiving({version:17,hunger:0}),fresh);
});

test('invalid saved data cannot forge inventory, arbitrary fuel keys or infinite money spent',()=>{
 const evil={version:1,hunger:-30,hydration:Infinity,stamina:999,
 inventory:{water:17,coffee:2,invalid:9000,fruit:-1},
 fuel:{'azure-starter':-3,tide:172,invalid:999},
 spent:Infinity,purchases:-10,consumed:999999999};
 const clean=restoreLiving(evil);
 assert.equal(clean.hunger,0);
 assert.equal(clean.hydration,0);
 assert.equal(clean.stamina,100);
 assert.deepEqual(clean.inventory,{coffee:2,water:12});
 assert.equal(clean.fuel['azure-starter'],0);
 assert.equal(clean.fuel.tide,100);
 assert.equal(Object.hasOwn(clean.fuel,'invalid'),false);
 assert.equal(clean.spent,0);
 assert.equal(clean.purchases,0);
 assert.equal(clean.consumed,100000);
});

test('shopping requires being on foot, physically near the storefront, and sufficient credits',()=>{
 assert.equal(shopAccess('cafe',at('cafe')).allowed,true);
 assert.equal(shopAccess('cafe',at('cafe','vehicle')).reason,'on-foot');
 assert.equal(shopAccess('cafe',{position:{x:500,z:500},mode:'foot'}).reason,'distance');
 const origin=makeLiving();
 for(const [who,balance,reason] of [
  [at('cafe','vehicle'),10000,'on-foot'],
  [{position:{x:500,z:500},mode:'foot'},10000,'distance'],
  [at('cafe'),20,'funds'],
  [at('cafe'),-9,'wallet']
 ]){
  const r=buyLivingItem(origin,'cafe','sandwich',balance,who);
  assert.equal(r.reason,reason);
  assert.equal(r.balance,balance);
  assert.deepEqual(r.state,origin);
 }
 assert.equal(buyLivingItem(origin,'cafe','fruit',300,at('cafe')).reason,'unknown');
});

test('purchasing from an actual store debits one shared wallet and increases carried quantity',()=>{
 const first=buyLivingItem(makeLiving(),'cafe','sandwich',500,at('cafe'));
 assert.equal(first.reason,null);
 assert.equal(first.cost,95);
 assert.equal(first.balance,405);
 assert.equal(first.state.inventory.sandwich,1);
 assert.equal(first.state.spent,95);
 assert.equal(first.state.purchases,1);
 const again=buyLivingItem(first.state,'cafe','sandwich',first.balance,at('cafe'));
 assert.equal(again.reason,null);
 assert.equal(again.state.inventory.sandwich,2);
 assert.equal(again.balance,310);
 assert.equal(inventoryCount(again.state),2);
});

test('the bag has a strict capacity, no infinite stacking or free duplication',()=>{
 let state=makeLiving(),balance=99999;
 for(let i=0;i<12;i++){
  const r=buyLivingItem(state,'market','water',balance,at('market'));
  assert.equal(r.reason,null);
  state=r.state;balance=r.balance;
 }
 assert.equal(buyLivingItem(state,'market','water',balance,at('market')).reason,'capacity');
 for(let i=0;i<12;i++){
  const r=buyLivingItem(state,'market','fruit',balance,at('market'));
  assert.equal(r.reason,null);
  state=r.state;balance=r.balance;
 }
 assert.equal(inventoryCount(state),24);
 assert.equal(buyLivingItem(state,'market','juice',balance,at('market')).reason,'capacity');
 assert.equal(state.purchases,24);
});

test('consumption removes exactly one owned product and improves actual stamina and hunger',()=>{
 const raw={...makeLiving(),hunger:20,hydration:15,stamina:24,inventory:{sandwich:2}};
 const a=consumeLivingItem(raw,'sandwich');
 assert.equal(a.reason,null);
 assert.equal(a.state.inventory.sandwich,1);
 assert.equal(a.state.hunger,49);
 assert.equal(a.state.hydration,19);
 assert.equal(a.state.stamina,38);
 assert.equal(a.state.consumed,1);
 const b=consumeLivingItem(a.state,'sandwich');
 assert.equal(b.reason,null);
 assert.equal(Object.hasOwn(b.state.inventory,'sandwich'),false);
 const absent=consumeLivingItem(b.state,'sandwich');
 assert.equal(absent.reason,'missing');
 assert.deepEqual(absent.state,b.state);
});

test('sprint drains energy, walking regenerates it and low energy blocks actual sprinting',()=>{
 let s=makeLiving();
 assert.equal(canSprint(s),true);
 for(let n=0;n<120;n++)s=advanceLiving(s,.1,{onFoot:true,moving:true,sprinting:true,distance:.8});
 assert.ok(s.stamina<50);
 assert.ok(s.hunger<85&&s.hydration<85);
 for(let n=0;n<500;n++)s=advanceLiving(s,.1,{onFoot:true,moving:true,sprinting:true,distance:.8});
 assert.equal(canSprint(s),false);
 const tired=s.stamina;
 for(let n=0;n<150;n++)s=advanceLiving(s,.1,{onFoot:true,moving:false,sprinting:false});
 assert.ok(s.stamina>tired);
 assert.equal(canSprint({...s,hunger:0}),false);
 assert.equal(canSprint({...s,hydration:0}),false);
});

test('real driving distance consumes energy of selected car, without depleting other cars',()=>{
 const first=makeLiving();
 const moved=advanceLiving(first,.05,{distance:50,onFoot:false,carId:'tide'});
 assert.ok(moved.fuel.tide<100);
 assert.equal(moved.fuel[STARTER_ID],100);
 assert.equal(moved.metres,50);
 const onFoot=advanceLiving(moved,.05,{distance:10,onFoot:true,carId:'tide',moving:true});
 assert.equal(onFoot.fuel.tide,moved.fuel.tide);
 let empty=moved;
 for(let i=0;i<400;i++)empty=advanceLiving(empty,.1,{distance:30,onFoot:false,carId:'tide'});
 assert.equal(empty.fuel.tide,0);
 assert.equal(livingIndicators(empty,'tide').fuel,0);
 assert.equal(livingIndicators(empty,'tide').fuelUnit,'电量');
});

test('service energy depends on electric versus combustion model and requires a parked car',()=>{
 const electric=energyProduct('tide'),petrol=energyProduct(STARTER_ID);
 assert.equal(electric.kind,'electric');
 assert.ok(electric.price<petrol.price);
 const base={...makeLiving(),fuel:{...makeLiving().fuel,tide:34}};
 assert.equal(refuelVehicle(base,200,'tide',at('station','foot')).reason,'vehicle');
 assert.equal(refuelVehicle(base,200,'tide',at('station','vehicle',10)).reason,'moving');
 assert.equal(refuelVehicle(base,200,'tide',{position:{x:500,z:500},mode:'vehicle',speed:0}).reason,'distance');
 assert.equal(refuelVehicle(base,20,'tide',at('station','vehicle')).reason,'funds');
 const fueled=refuelVehicle(base,200,'tide',at('station','vehicle'));
 assert.equal(fueled.reason,null);
 assert.equal(fueled.cost,110);
 assert.equal(fueled.balance,90);
 assert.equal(fueled.state.fuel.tide,59);
 assert.equal(fueled.state.fuel[STARTER_ID],100);
 assert.equal(fueled.state.purchases,1);
 const almost={...fueled.state,fuel:{...fueled.state.fuel,tide:92}};
 const last=refuelVehicle(almost,200,'tide',at('station','vehicle'));
 assert.equal(last.cost,Math.ceil(110*8/25));
 assert.equal(last.state.fuel.tide,100);
 assert.equal(refuelVehicle(last.state,200,'tide',at('station','vehicle')).reason,'full');
});

test('full local backup preserves purchases, groceries, petrol levels and player progression',async()=>{
 const life={...makeLiving(),hunger:44,hydration:32,stamina:52,
  inventory:{water:2,sandwich:1},fuel:{...makeLiving().fuel,tide:37},spent:250,purchases:3};
 const driving={stage:1,credits:23500,garage:{version:1,engine:2},
  housing:{version:1,owned:['coastal-starter'],rooms:{'coastal-starter':[]}},
  fleet:{version:1,owned:['azure-starter','tide'],active:'tide'},
  living:life};
 const store={getItem:key=>key==='azure-coast-driving-v2'?JSON.stringify(driving):null};
 const saved=await createSaveArchive(store);
 const restored=await validateSaveArchive(JSON.stringify(saved));
 const result=restored.records['azure-coast-driving-v2'];
 assert.equal(result.credits,23500);
 assert.equal(result.living.inventory.water,2);
 assert.equal(result.living.fuel.tide,37);
 assert.equal(result.living.hunger,44);
 assert.equal(result.fleet.active,'tide');
 assert.equal(result.housing.owned[0],'coastal-starter');
 assert.equal(result.garage.engine,2);
});

test('the real website profile shows game survival and owned bag, not separate fake balances',()=>{
 const game={credits:5100,fleet:{version:1,owned:['azure-starter'],active:'azure-starter'},
  living:{...makeLiving(),inventory:{coffee:2},hunger:66,hydration:79}};
 const data=summarizeGameProfile(game,null);
 assert.equal(data.balance,5100);
 assert.equal(data.backpackItems,2);
 assert.equal(data.survival.hunger,66);
 assert.equal(data.survival.hydration,79);
 assert.equal(data.survival.fuel,100);
});

test('3D physical shops and live gameplay actually consume fuel and stamina and write the save',()=>{
 const world=readFileSync(new URL('../public/living-world.mjs',import.meta.url),'utf8');
 const game=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../public/living-client.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 assert.match(world,/THREE\.TorusGeometry/);
 assert.match(world,/shop\.kind==='energy'/);
 assert.match(game,/livingProfile=advanceLiving/);
 assert.match(game,/hasEnergy/);
 assert.match(game,/canSprint/);
 assert.match(game,/living:livingProfile/);
 assert.match(ui,/buyLivingItem/);
 assert.match(ui,/consumeLivingItem/);
 assert.match(ui,/refuelVehicle/);
 for(const id of ['lifeVitals','lifeHunger','lifeWater','lifeStamina','lifeFuel',
  'livingOpen','livingPanel','livingOffers','livingInventory','livingFuelBuy','livingPrompt'])
  assert.match(html,new RegExp('id="'+id+'"'));
});

test('all four energy stations are independently reachable, bill the shared wallet and preserve individual tanks',()=>{
 const sources=SHOPS.filter(s=>s.kind==='energy');
 assert.deepEqual(sources.map(s=>s.id),['station','energy-marina','energy-center','energy-cliff']);
 let state={...makeLiving(),fuel:{...makeLiving().fuel,tide:0,[STARTER_ID]:35}};
 let money=1000;
 for(const station of sources){
  const driver=at(station.id,'vehicle',0);
  assert.equal(nearestEnergyShop(driver.position).id,station.id);
  assert.equal(shopAccess(station.id,driver).allowed,true);
  const bought=refuelVehicle(state,money,'tide',driver);
  assert.equal(bought.reason,null,station.id);
  assert.equal(bought.cost,110);
  assert.equal(bought.state.fuel[STARTER_ID],35);
  assert.equal(bought.state.fuel.tide,Math.min(100,state.fuel.tide+25));
  state=bought.state;money=bought.balance;
 }
 assert.equal(state.fuel.tide,100);
 assert.equal(money,560);
 assert.equal(state.purchases,4);
 assert.equal(nearestEnergyShop({x:Infinity,z:0}),null);
 assert.equal(refuelVehicle(state,money,'tide',at('market','foot')).reason,'distance');
});

test('station purchases reject wrong transport mode, moving vehicles and insufficient funds at distant locations',()=>{
 const state={...makeLiving(),fuel:{...makeLiving().fuel,'azure-starter':20}};
 for(const station of SHOPS.filter(s=>s.kind==='energy')){
  assert.equal(refuelVehicle(state,999,STARTER_ID,at(station.id,'foot')).reason,'vehicle');
  assert.equal(refuelVehicle(state,999,STARTER_ID,at(station.id,'vehicle',12)).reason,'moving');
  assert.equal(refuelVehicle(state,20,STARTER_ID,at(station.id,'vehicle')).reason,'funds');
 }
});
