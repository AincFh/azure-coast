import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeEnvironment,environmentLighting,findSafeExit} from '../public/environment.mjs';
test('environment sanitizes malformed saves',()=>{assert.deepEqual(normalizeEnvironment({hour:99,weather:'snow'}),{hour:23,weather:'clear',autoCycle:false})});
test('daylight exceeds midnight light',()=>{assert.ok(environmentLighting({hour:12}).sunIntensity>environmentLighting({hour:0}).sunIntensity)});
test('rain increases fog and requires headlights',()=>{assert.ok(environmentLighting({hour:12,weather:'rain'}).fogDensity>environmentLighting({hour:12,weather:'clear'}).fogDensity);assert.equal(environmentLighting({hour:12,weather:'rain'}).headlights,true)});
test('exit placement avoids building obstacles',()=>{const b=[{x:5,z:0,width:6,depth:6}];const p=findSafeExit({x:0,z:0},0,b);assert.ok(p);assert.notEqual(p.x,5)});
test('exit refuses when all candidate points obstructed',()=>{const p=findSafeExit({x:0,z:0},0,[{x:0,z:0,width:100,depth:100}]);assert.equal(p,null)});
