import test from 'node:test';import assert from 'node:assert/strict';import{districts,routeDistance,uniqueStops,formatHour,vehicles}from'../public/explore-core.mjs';
test('six unique selectable districts',()=>{assert.equal(districts.length,6);assert.equal(new Set(districts.map(x=>x.id)).size,6)});
test('route distance is deterministic and reversible',()=>{assert.equal(routeDistance(['bay']),0);assert.equal(routeDistance(['bay','marina']),routeDistance(['marina','bay']));assert.ok(routeDistance(['bay','marina'])>0)});
test('invalid and duplicate stops removed',()=>assert.deepEqual(uniqueStops(['bay','bay','bad','cliff']),['bay','cliff']));
test('time clamps and pads',()=>{assert.equal(formatHour(8),'08:30');assert.equal(formatHour(28),'23:30')});
test('vehicle selections have distinct metadata',()=>assert.equal(Object.keys(vehicles).length,3));
