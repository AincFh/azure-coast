import test from 'node:test';
import assert from 'node:assert/strict';
import {readGamepad,deadZone,gamepadEdges,GAMEPAD_ACTIONS} from '../public/gamepad-input.mjs';
import {stepVehicle} from '../public/simulation.mjs';

const pad=(axes=[0,0],buttonValues={})=>({
 connected:true,mapping:'standard',axes,
 buttons:Array.from({length:17},(_,i)=>({value:buttonValues[i]??0,pressed:(buttonValues[i]??0)>.5}))
});
const neutral=()=>({speed:0,heading:0,x:0,z:0});

test('gamepad is optional; unconnected or nonstandard layouts cannot move game',()=>{
 for(const missing of [null,undefined,{connected:false,mapping:'standard'},{connected:true,mapping:''}]){
  const controls=readGamepad(missing);
  assert.equal(controls.connected,false);
  assert.equal(controls.forward,0);
  assert.equal(controls.reverse,0);
  assert.equal(controls.interact,false);
 }
});
test('dead zone eliminates drift and never emits invalid values',()=>{
 assert.equal(deadZone(.1),0);
 assert.equal(deadZone(-.16),0);
 assert.equal(deadZone(0),0);
 assert.equal(deadZone(1),1);
 assert.equal(deadZone(-1),-1);
 assert.equal(deadZone(NaN),0);
 assert.equal(deadZone(Infinity),0);
 assert.ok(deadZone(.6)>0&&deadZone(.6)<1);
});
test('left stick steers and moves feet while analog triggers control vehicle',()=>{
 const c=readGamepad(pad([-.6,-.8],{7:.65,6:.2}));
 assert.ok(c.left>0&&c.right===0);
 assert.ok(c.walkForward>0&&c.walkBackward===0);
 assert.equal(c.forward,.65);
 assert.equal(c.reverse,.2);
 assert.ok(readGamepad(pad([.7,.8])).right>0);
 assert.ok(readGamepad(pad([0,.8])).walkBackward>0);
});
test('A B X Start edges fire once per press and release correctly',()=>{
 assert.deepEqual(GAMEPAD_ACTIONS,['enter','camera','interact','pause']);
 const c=readGamepad(pad([0,0],{0:1,1:1,2:1,9:1,4:1}));
 assert.equal(c.sprint,true);
 const first=gamepadEdges({},c);
 for(const key of GAMEPAD_ACTIONS)assert.equal(first.pressed[key],true);
 const repeat=gamepadEdges(first.held,c);
 for(const key of GAMEPAD_ACTIONS)assert.equal(repeat.pressed[key],false);
 const clear=gamepadEdges(repeat.held,readGamepad(null));
 const pressedAgain=gamepadEdges(clear.held,c);
 for(const key of GAMEPAD_ACTIONS)assert.equal(pressedAgain.pressed[key],true);
});
test('analog vehicle input produces proportionally controlled acceleration and steering',()=>{
 const half=readGamepad(pad([-.7,0],{7:.5}));
 const full=readGamepad(pad([-.7,0],{7:1}));
 let a=neutral(),b=neutral();
 for(let i=0;i<18;i++){
  a=stepVehicle(a,{forward:half.forward,reverse:half.reverse,left:half.left,right:half.right},.05);
  b=stepVehicle(b,{forward:full.forward,reverse:full.reverse,left:full.left,right:full.right},.05);
 }
 assert.ok(a.speed>0&&a.speed<b.speed);
 assert.ok(a.heading>0&&b.heading>a.heading);
 const dry=stepVehicle(neutral(),{forward:true},.05);
 assert.equal(dry.speed,stepVehicle(neutral(),{forward:1},.05).speed);
 const invalid=stepVehicle(neutral(),{forward:NaN,left:Infinity},.05);
 assert.ok(Number.isFinite(invalid.speed)&&Number.isFinite(invalid.heading));
});
