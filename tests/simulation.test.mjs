import test from 'node:test';import assert from 'node:assert/strict';import {ROUTE,createProgress,advanceMission,stepVehicle,collisionDamage} from '../public/simulation.mjs';
test('five route stages, each unique',()=>{assert.equal(ROUTE.length,5);assert.equal(new Set(ROUTE.map(x=>x.id)).size,5)});
test('missions only pay once and in sequence',()=>{let p=createProgress();let a=advanceMission(p,ROUTE[1].x,ROUTE[1].z);assert.equal(a.completed,null);a=advanceMission(p,ROUTE[0].x,ROUTE[0].z);assert.equal(a.progress.credits,1200);p=a.progress;a=advanceMission(p,ROUTE[0].x,ROUTE[0].z);assert.equal(a.completed,null)});
test('car acceleration and braking are bounded',()=>{let s={speed:0,heading:0,x:0,z:0};for(let i=0;i<200;i++)s=stepVehicle(s,{forward:true},.05);assert.ok(s.speed<=49);for(let i=0;i<200;i++)s=stepVehicle(s,{reverse:true},.05);assert.ok(s.speed>=-16)});
test('progress sanitizes corrupt saves',()=>{let p=createProgress({stage:900,damage:900,credits:-9});assert.equal(p.stage,5);assert.equal(p.damage,100);assert.equal(p.credits,0)});
test('collision damage increases with speed',()=>assert.ok(collisionDamage(40)>collisionDamage(5)));

test('fuel-starved vehicle retains emergency low-speed mobility without bypassing normal speed limits',()=>{
 let s={speed:0,heading:0,x:0,z:0};
 for(let i=0;i<200;i++)s=stepVehicle(s,{forward:true},.05,{maxSpeed:3});
 assert.ok(s.speed>0&&s.speed<=3);
 let standard={speed:0,heading:0,x:0,z:0};
 for(let i=0;i<200;i++)standard=stepVehicle(standard,{forward:true},.05,{maxSpeed:49});
 assert.ok(standard.speed>s.speed);
 assert.ok(standard.speed<=49);
});
