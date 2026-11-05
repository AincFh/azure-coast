import test from 'node:test';
import assert from 'node:assert/strict';
import {homes} from '../public/catalog.mjs';
import {intersectsBuilding,nearbyObstacles} from '../public/physics.mjs';
import {
 HOUSING_VERSION,RESIDENCES,RESIDENCE_SLOTS,FURNITURE,createHousing,
 restoreHousing,propertyById,furnitureById,nearestResidence,
 purchaseResidence,canEnterResidence,roomFurniture,purchaseFurniture,
 moveFurniture,rotateFurniture,sellFurniture,interiorStep
} from '../public/housing.mjs';

const start=()=>createHousing();
const starter=RESIDENCES[0];
const access=(p=starter,mode='foot',speed=0)=>({position:{x:p.x,z:p.z},mode,speed});
const own=(wallet=20000)=>purchaseResidence(start(),starter.id,wallet,access(starter,'vehicle',0));

test('four homes include an affordable entry point and match premium website listings',()=>{
 assert.equal(HOUSING_VERSION,1);
 assert.equal(RESIDENCES.length,4);
 assert.equal(starter.price,8000);
 assert.equal(new Set(RESIDENCES.map(p=>p.id)).size,4);
 for(const property of RESIDENCES){
  assert.ok(Number.isFinite(property.x)&&Number.isFinite(property.z));
  assert.equal(intersectsBuilding(property.x,property.z,1.2,nearbyObstacles(property.x,property.z)),false);
  if(!property.starter){
   const catalog=homes.find(h=>h.id===property.id);
   assert.ok(catalog,'property missing from public website');
   assert.equal(property.name,catalog.name);
   assert.equal(property.price,catalog.price);
  }
 }
});
test('nine furniture slots and nine catalogue items have distinct stable ids',()=>{
 assert.equal(RESIDENCE_SLOTS.length,9);
 assert.equal(FURNITURE.length,9);
 assert.equal(new Set(FURNITURE.map(x=>x.id)).size,9);
 assert.equal(new Set(RESIDENCE_SLOTS.map(x=>x.x+','+x.z)).size,9);
 assert.ok(FURNITURE.every(x=>x.price>0&&x.price<3000));
 assert.equal(furnitureById('fake'),null);
 assert.equal(propertyById('fake'),null);
});
test('purchase requires parked nearby valid balance, with atomic debit and ownership',()=>{
 const fail=[
  purchaseResidence(start(),starter.id,400,access()),
  purchaseResidence(start(),starter.id,20000,{position:{x:500,z:500},speed:0}),
  purchaseResidence(start(),starter.id,20000,access(starter,'vehicle',8)),
  purchaseResidence(start(),'invalid',20000,access()),
  purchaseResidence(start(),starter.id,-5,access())
 ];
 assert.deepEqual(fail.map(x=>x.reason),['funds','distance','moving','unknown','wallet']);
 for(const result of fail)assert.deepEqual(result.state,start());
 const result=own();
 assert.equal(result.reason,null);
 assert.equal(result.balance,12000);
 assert.deepEqual(result.state.owned,[starter.id]);
 assert.equal(result.state.rooms[starter.id].length,0);
 assert.equal(result.state.transactions,1);
 assert.equal(result.state.spent,8000);
 const again=purchaseResidence(result.state,starter.id,result.balance,access());
 assert.equal(again.reason,'owned');
 assert.equal(again.balance,12000);
});
test('home entry requires actually owning home, leaving vehicle and walking to its door',()=>{
 assert.equal(canEnterResidence(start(),starter.id,access()).reason,'not-owned');
 const s=own().state;
 assert.equal(canEnterResidence(s,starter.id,access(starter,'vehicle')).reason,'mode');
 assert.equal(canEnterResidence(s,starter.id,{position:{x:0,z:400},mode:'foot'}).reason,'distance');
 assert.equal(canEnterResidence(s,starter.id,access()).allowed,true);
 assert.equal(nearestResidence({x:starter.x,z:starter.z}).id,starter.id);
 assert.equal(nearestResidence({x:999,z:999}),null);
 assert.equal(nearestResidence({x:Infinity,z:0}),null);
});
test('furniture purchase costs exact credits and occupies its actual render slot',()=>{
 const owner=own();
 const result=purchaseFurniture(owner.state,starter.id,'sofa',4,owner.balance);
 assert.equal(result.reason,null);
 assert.equal(result.balance,10800);
 assert.equal(result.cost,1200);
 assert.deepEqual(roomFurniture(result.state,starter.id),[{item:'sofa',slot:4,rotation:0}]);
 assert.equal(result.state.spent,9200);
 assert.equal(purchaseFurniture(result.state,starter.id,'bed',4,result.balance).reason,'occupied');
 assert.equal(purchaseFurniture(result.state,starter.id,'bed',5,0).reason,'funds');
 assert.equal(purchaseFurniture(result.state,starter.id,'fake',5,result.balance).reason,'unknown');
 assert.equal(purchaseFurniture(start(),starter.id,'sofa',0,10000).reason,'not-owned');
});
test('moving and rotating furniture preserves objects without a second payment',()=>{
 const p=purchaseFurniture(own().state,starter.id,'desk',4,12000);
 const rot=rotateFurniture(p.state,starter.id,4);
 assert.equal(rot.reason,null);
 assert.equal(roomFurniture(rot.state,starter.id)[0].rotation,1);
 const moved=moveFurniture(rot.state,starter.id,4,1);
 assert.equal(moved.reason,null);
 assert.deepEqual(roomFurniture(moved.state,starter.id),[{item:'desk',slot:1,rotation:1}]);
 assert.equal(moved.state.spent,p.state.spent);
 assert.equal(moveFurniture(moved.state,starter.id,4,3).reason,'missing');
 assert.equal(moveFurniture(moved.state,starter.id,1,10).reason,'out-of-range');
 assert.equal(rotateFurniture(moved.state,starter.id,1).reason,null);
});
test('selling furniture returns exactly half its original value and clears its slot',()=>{
 const p=purchaseFurniture(own().state,starter.id,'bed',8,12000);
 const sale=sellFurniture(p.state,starter.id,8,p.balance);
 assert.equal(sale.refund,1100);
 assert.equal(sale.balance,p.balance+1100);
 assert.equal(roomFurniture(sale.state,starter.id).length,0);
 assert.equal(sale.state.spent,p.state.spent); // historical spending remains auditable
 assert.equal(sellFurniture(sale.state,starter.id,8,sale.balance).reason,'missing');
});
test('save restoration rejects forged ownership, duplicate furniture and invalid rotations',()=>{
 const raw={version:1,owned:['coastal-starter','coastal-starter','invalid'],
  rooms:{'coastal-starter':[
   {item:'sofa',slot:4,rotation:17},{item:'bed',slot:4,rotation:1},
   {item:'plant',slot:8,rotation:-1},{item:'fake',slot:1,rotation:0},
   {item:'lamp',slot:24,rotation:0}
  ]},spent:Infinity,transactions:-1};
 const restored=restoreHousing(raw);
 assert.deepEqual(restored.owned,['coastal-starter']);
 assert.deepEqual(roomFurniture(restored,'coastal-starter'),[
  {item:'sofa',slot:4,rotation:1},{item:'plant',slot:8,rotation:3}
 ]);
 assert.equal(restored.spent,0);
 assert.equal(restored.transactions,0);
 assert.deepEqual(restoreHousing({version:4,owned:['coastal-starter']}),start());
 assert.deepEqual(roomFurniture(start(),starter.id),[]);
});
test('interior player stays inside walls and cannot walk through installed furniture',()=>{
 let position={x:0,z:9,heading:0};
 const room=[{item:'bed',slot:7,rotation:0}];
 for(let i=0;i<240;i++)position=interiorStep(position,{forward:true},.05,room);
 assert.ok(position.z>=8.2,'walked through furniture directly in front of door');
 let edge={x:12,z:8,heading:0};
 for(let i=0;i<240;i++)edge=interiorStep(edge,{right:true,back:true,sprint:true},.05,[]);
 assert.ok(edge.x<=12.25&&edge.z<=9.5,'crossed interior room bounds');
 assert.equal(interiorStep({x:0,z:0,heading:0},{},.05,[]).moving,false);
});
test('furniture updates and wallet are saved together with existing driving progression',()=>{
 const original={stage:2,credits:20000,garage:{version:1,engine:1},damage:4};
 const home=purchaseResidence(createHousing(),starter.id,original.credits,access());
 const furniture=purchaseFurniture(home.state,starter.id,'sofa',4,home.balance);
 const record=JSON.parse(JSON.stringify({...original,credits:furniture.balance,housing:furniture.state}));
 assert.equal(record.credits,10800);
 assert.equal(record.stage,2);
 assert.equal(record.garage.engine,1);
 assert.equal(roomFurniture(restoreHousing(record.housing),starter.id)[0].item,'sofa');
 assert.equal(record.housing.spent,9200);
});
