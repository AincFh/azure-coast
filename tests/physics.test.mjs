import test from 'node:test';import assert from 'node:assert/strict';
import {intersectsBuilding,moveWithCollision,nearbyObstacles,restoreSession,SAVE_VERSION} from '../public/physics.mjs';
const buildings=[{x:10,z:0,width:6,depth:6}];
test('collision blocks entering building',()=>{assert.ok(intersectsBuilding(8,0,1,buildings));assert.ok(!intersectsBuilding(0,0,1,buildings));const r=moveWithCollision({x:0,z:0},{x:20,z:0},1,buildings);assert.ok(r.hit);assert.ok(r.x<7.1)});
test('diagonal movement slides along wall',()=>{const r=moveWithCollision({x:0,z:0},{x:20,z:20},1,[{x:10,z:5,width:6,depth:30}]);assert.ok(r.hit);assert.ok(r.x<7.1);assert.ok(r.z>0)});
test('nearby obstacles include deterministic central geometry',()=>{assert.deepEqual(nearbyObstacles(40,40),nearbyObstacles(40,40));assert.ok(nearbyObstacles(40,40).length>0)});
test('save schema validates, clamps and migrates',()=>{assert.equal(restoreSession({car:{x:NaN,z:0,heading:0}}),null);const s=restoreSession({version:1,car:{x:900,z:-900,heading:1},onFoot:true,view:99});assert.equal(s.version,SAVE_VERSION);assert.equal(s.car.x,640);assert.equal(s.car.z,-640);assert.equal(s.view,2);assert.equal(s.onFoot,true)});
