import test from 'node:test';
import assert from 'node:assert/strict';
import {safeSpawn,sanitizeProgress} from '../public/session-safety.mjs';
import {intersectsBuilding,nearbyObstacles} from '../public/physics.mjs';
test('save cannot spawn a car inside the city buildings',()=>{
 const building=nearbyObstacles(131,131).find(b=>Math.abs(b.x-131)<.01&&Math.abs(b.z-131)<.01);
 assert.ok(building);
 const restored=safeSpawn({x:building.x,z:building.z},2.3);
 assert.ok(restored);
 assert.equal(intersectsBuilding(restored.x,restored.z,2.3,nearbyObstacles(restored.x,restored.z)),false);
});
test('spawn rejects malformed points and impossible locations',()=>{
 assert.equal(safeSpawn({x:Infinity,z:2}),null);
 assert.equal(safeSpawn(null),null);
 assert.equal(safeSpawn({x:1,z:1},1,()=>[{x:0,z:0,width:2000,depth:2000}]),null);
});
test('progress is bounded and never admits NaN or infinity',()=>{
 assert.deepEqual(sanitizeProgress({stage:Infinity,credits:Infinity,distance:NaN,bestSpeed:-12,damage:200},5),{stage:0,credits:0,distance:0,bestSpeed:0,damage:100});
 assert.equal(sanitizeProgress({stage:3.9,credits:23.9},5).stage,3);
 assert.equal(sanitizeProgress({stage:999,credits:-50},5).stage,5);
});
