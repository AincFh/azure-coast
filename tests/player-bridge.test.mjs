import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHousing,purchaseResidence,purchaseFurniture,RESIDENCES} from '../public/housing.mjs';
import {createGarage} from '../public/garage.mjs';
import {emptyActivities} from '../public/activities.mjs';
import {summarizeGameProfile,readGameProfile,GAME_PROFILE_KEY,GAME_ACTIVITY_KEY} from '../public/player-bridge.mjs';

test('empty or malformed local storage never invents owned properties or balance',()=>{
 const empty=summarizeGameProfile(null,null);
 assert.equal(empty.balance,0);assert.equal(empty.propertyCount,0);
 assert.equal(empty.completedJobs,0);assert.equal(empty.hasPlayed,false);
 assert.deepEqual(empty.ownedIds,[]);
 const invalid=readGameProfile({getItem:()=>'{wrong'});
 assert.deepEqual(invalid,empty);
});
test('full game save is accurately mirrored by website, without a second wallet',()=>{
 const home=purchaseResidence(createHousing(),RESIDENCES[0].id,20000,{
  position:{x:RESIDENCES[0].x,z:RESIDENCES[0].z},speed:0});
 const furnishing=purchaseFurniture(home.state,RESIDENCES[0].id,'sofa',4,home.balance);
 const driving={credits:furnishing.balance,housing:furnishing.state,garage:{...createGarage(),engine:2,handling:1,armor:3}};
 const activities={...emptyActivities(),completed:{courier:3,taxi:2,survey:1},earned:15400};
 const storage=new Map([[GAME_PROFILE_KEY,JSON.stringify(driving)],[GAME_ACTIVITY_KEY,JSON.stringify(activities)]]);
 const result=readGameProfile({getItem:k=>storage.get(k)||null});
 assert.equal(result.balance,10800);
 assert.equal(result.propertyCount,1);
 assert.deepEqual(result.ownedIds,['coastal-starter']);
 assert.equal(result.furnitureCount,1);
 assert.equal(result.propertyInvestment,9200);
 assert.equal(result.completedJobs,6);
 assert.equal(result.careerIncome,15400);
 assert.equal(result.engine,2);
 assert.equal(result.handling,1);
 assert.equal(result.armor,3);
 assert.equal(result.hasPlayed,true);
});
test('unsupported, corrupt or forged asset IDs are removed before presentation',()=>{
 const state=summarizeGameProfile({
  credits:NaN,garage:{version:1,engine:999,handling:Infinity,armor:-4},
  housing:{version:1,owned:['no-such-home'],rooms:{'no-such-home':[{}]}}
 },null);
 assert.equal(state.balance,0);
 assert.equal(state.propertyCount,0);
 assert.equal(state.furnitureCount,0);
 assert.equal(state.engine,3); // upstream garage sanitizes over-limit levels to the maximum safe tier
 assert.equal(state.armor,0);
});
test('catalog home cards read real ownership and game profile has a direct return route',()=>{
 const app=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
 assert.match(app,/readGameProfile/);
 assert.match(app,/liveGame\(\)\.ownedIds\.includes\(h\.id\)/);
 assert.match(app,/liveGameSummary\(\)/);
 assert.match(app,/本地游戏存档/);
 assert.match(html,/player-bridge\.css/);
});
