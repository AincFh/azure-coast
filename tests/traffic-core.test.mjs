import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TRAFFIC_GRID,TRAFFIC_LIMIT,trafficHash,trafficPosition,createTrafficAgents,
 signalIsGreen,nextJunction,trafficTargetSpeed,tickTraffic,trafficMetrics
} from '../public/traffic-core.mjs';

test('traffic starts in reproducible marked lanes with finite speeds',()=>{
 const cars=createTrafficAgents(45);
 assert.deepEqual(cars,createTrafficAgents(45));
 assert.equal(cars.length,45);
 assert.ok(TRAFFIC_GRID>0&&TRAFFIC_LIMIT>600);
 assert.equal(new Set(cars.map(x=>x.id)).size,45);
 for(const c of cars){
  const pos=trafficPosition(c);
  const lateral=c.axis==='z'?pos.x:pos.z;
  assert.ok(Math.abs(lateral-c.road*100)===4,c.id);
  assert.ok(Number.isFinite(pos.x)&&Number.isFinite(pos.z));
  assert.ok(c.cruise>=8&&c.cruise<=15);
 }
 for(let i=0;i<100;i++)assert.equal(trafficHash(i,17),trafficHash(i,17));
});

test('cars never spawn overlapping other vehicles sharing one lane',()=>{
 const cars=createTrafficAgents(90);
 for(let i=0;i<cars.length;i++)for(let j=i+1;j<cars.length;j++){
  const a=cars[i],b=cars[j];
  if(a.axis===b.axis&&a.road===b.road&&a.dir===b.dir)
   assert.ok(Math.abs(a.coord-b.coord)>=18, 'same-lane spawn overlap '+a.id+'/'+b.id);
 }
});
test('east-west and north-south traffic obey the same intersection clock',()=>{
 for(let x=-5;x<=5;x++)for(let z=-5;z<=5;z++){
  for(let t=0;t<32;t++){
   assert.equal(signalIsGreen('z',x,z,t)&&signalIsGreen('x',x,z,t),false);
  }
 }
});
test('traffic lights give exclusive crossing phases with all-red clearance',()=>{
 for(const road of [-5,-2,0,1,5])for(const junction of [-4,0,3]){
  let count=0;
  for(let s=0;s<32;s++){
   const z=signalIsGreen('z',road,junction,s);
   const x=signalIsGreen('x',road,junction,s);
   assert.ok(!(z&&x),'intersecting directions both got green');
   if(!z&&!x)count++;
  }
  assert.ok(count>=4,'clearance interval missing');
 }
});

test('approaching a red intersection slows towards a stop',()=>{
 const car={id:1,axis:'z',road:0,dir:1,coord:-25,speed:13,cruise:14,odometer:0};
 const junction=nextJunction(car);
 assert.ok(Math.abs(junction)<1e-9);
 const redTime=Array.from({length:32},(_,i)=>i).find(i=>!signalIsGreen('z',0,0,i));
 assert.ok(Number.isFinite(redTime));
 let cars=[car];let minSpeed=car.speed;
 for(let i=0;i<200;i++){
  cars=tickTraffic(cars,.05,redTime);
  minSpeed=Math.min(minSpeed,cars[0].speed);
 }
 assert.ok(minSpeed<.7,'vehicle did not brake for the red light');
 assert.ok(cars[0].coord<-8,'vehicle passed the stop line while red');
});

test('traffic moves through intersection on green',()=>{
 let car={id:1,axis:'z',road:0,dir:1,coord:-25,speed:3,cruise:14,odometer:0};
 const greenTime=Array.from({length:32},(_,i)=>i).find(i=>signalIsGreen('z',0,0,i));
 for(let i=0;i<170;i++)car=tickTraffic([car],.05,greenTime)[0];
 assert.ok(car.coord>0,'green traffic did not cross the intersection');
 assert.ok(car.odometer>25);
});

test('car-following law reduces desired speed behind slower same-lane car',()=>{
 const rear={id:0,axis:'x',road:2,dir:1,coord:50,speed:11,cruise:14,odometer:0};
 const front={...rear,id:1,coord:59,speed:0,cruise:0};
 assert.equal(trafficTargetSpeed(rear,[rear,front],0),0);
 const otherLane={...front,road:3};
 assert.ok(trafficTargetSpeed(rear,[rear,otherLane],0)>=0);
 let following=[rear,front];
 for(let i=0;i<70;i++)following=tickTraffic(following,.05,8);
 const gap=following[1].coord-following[0].coord;
 assert.ok(gap>5,'cars overlapped while following');
});

test('road traffic yields to a stopped player ahead',()=>{
 const car={id:2,axis:'z',road:0,dir:1,coord:0,speed:10,cruise:14,odometer:0};
 const player={x:4,z:12};
 assert.equal(trafficTargetSpeed(car,[car],8,player),0);
 const distantPlayer={x:50,z:12};
 assert.ok(trafficTargetSpeed(car,[car],8,distantPlayer)>0);
});

test('simulation time step and world boundary remain finite',()=>{
 let cars=createTrafficAgents(45);
 for(let i=0;i<240;i++)cars=tickTraffic(cars,.05,i*.05,{x:0,z:12});
 for(const c of cars){
  assert.ok(Number.isFinite(c.coord)&&Math.abs(c.coord)<=TRAFFIC_LIMIT);
  assert.ok(Number.isFinite(c.speed)&&c.speed>=0&&c.speed<=25);
  assert.ok(c.odometer>=0);
 }
 assert.deepEqual(tickTraffic(cars,0,0),cars);
 assert.equal(createTrafficAgents(Infinity).length,0);
 assert.equal(createTrafficAgents(300).length,90);
});

test('traffic metrics accurately describe moving and stopped cars',()=>{
 const cars=[{speed:0},{speed:0.1},{speed:4.5},{speed:10}];
 assert.deepEqual(trafficMetrics([]),{cars:0,moving:0,stopped:0,meanSpeed:0});
 const metrics=trafficMetrics(cars);
 assert.equal(metrics.cars,4);
 assert.equal(metrics.moving,2);
 assert.equal(metrics.stopped,2);
 assert.ok(metrics.meanSpeed>10&&metrics.meanSpeed<20);
});
