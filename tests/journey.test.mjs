import test from 'node:test';
import assert from 'node:assert/strict';
import {CITY_STOPS,cleanStops,loadPlannedStops,createJourney,restoreJourney,progressJourney,nextJourneyStop,cancelJourney,roadRoute,navigationHint,headingCue,polylineDistance} from '../public/journey.mjs';
import {intersectsBuilding,nearbyObstacles} from '../public/physics.mjs';

test('all six planner destinations map to unique safe game positions',()=>{
 assert.equal(CITY_STOPS.length,6);
 assert.equal(new Set(CITY_STOPS.map(x=>x.id)).size,6);
 for(const stop of CITY_STOPS){assert.ok(Number.isFinite(stop.x)&&Number.isFinite(stop.z));assert.equal(intersectsBuilding(stop.x,stop.z,2.3,nearbyObstacles(stop.x,stop.z)),false,stop.id)}
});
test('planner contract rejects invalid stops and removes duplicates',()=>{
 assert.deepEqual(loadPlannedStops({stops:['bay','bay','bad','marina',null]}),['bay','marina']);
 assert.deepEqual(cleanStops('fake'),[]);
 assert.deepEqual(loadPlannedStops({stops:{0:'bay'}}),[]);
});
test('journey completes every stop exactly once and is resumable',()=>{
 let s=createJourney(['bay','marina']);
 assert.equal(nextJourneyStop(s).id,'bay');
 const far=progressJourney(s,{x:300,z:300});assert.equal(far.arrived,null);
 let first=progressJourney(s,{x:0,z:-500});assert.equal(first.arrived.id,'bay');
 s=restoreJourney(JSON.parse(JSON.stringify(first.journey)));
 assert.equal(s.index,1);assert.equal(s.status,'active');
 assert.equal(progressJourney(s,{x:0,z:-500}).arrived,null);
 const second=progressJourney(s,{x:-300,z:-300});
 assert.equal(second.arrived.id,'marina');assert.equal(second.journey.status,'complete');
 assert.equal(progressJourney(second.journey,{x:-300,z:-300}).arrived,null);
});
test('cancelled and completed journeys never reactivate unexpectedly',()=>{
 const cancelled=cancelJourney(createJourney(['cliff']));
 assert.equal(restoreJourney(cancelled).status,'cancelled');
 assert.equal(progressJourney(cancelled,{x:500,z:-500}).arrived,null);
 assert.equal(restoreJourney({version:1,stops:['bay'],index:999,status:'active'}).status,'complete');
 assert.deepEqual(createJourney(['invalid']).stops,[]);
});
test('road navigation only uses orthogonal segments after road projection',()=>{
 const points=roadRoute({x:0,z:12},{x:500,z:400});
 assert.ok(points.length>=3);
 assert.deepEqual(points[0],{x:0,z:12});
 assert.deepEqual(points.at(-1),{x:500,z:400});
 for(let i=2;i<points.length-1;i++)assert.ok(points[i].x===points[i-1].x||points[i].z===points[i-1].z,'road segment not orthogonal');
 assert.ok(polylineDistance(points)>=Math.hypot(500,388));
 assert.deepEqual(roadRoute({x:Infinity,z:0},{x:0,z:0}),[]);
});
test('turn cues are deterministic and orientation aware',()=>{
 assert.equal(headingCue(0,{x:0,z:0},{x:0,z:-100}),'直行');
 assert.equal(headingCue(0,{x:0,z:0},{x:100,z:0}),'右转');
 assert.equal(headingCue(0,{x:0,z:0},{x:-100,z:0}),'左转');
 assert.equal(headingCue(0,{x:0,z:0},{x:0,z:100}),'掉头');
 assert.ok(navigationHint({x:0,z:12},0,CITY_STOPS[0]).roadDistance>=0);
});
