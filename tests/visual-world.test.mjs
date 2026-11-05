import test from 'node:test';
import assert from 'node:assert/strict';
import {visualHash,architectureStyle,streetPlan} from '../public/visual-world.mjs';
import {coupeDimensions} from '../public/vehicle-art.mjs';
import {surfaceNoise} from '../public/surface-materials.mjs';
import {characterDimensions} from '../public/character-art.mjs';

test('street visual plan is deterministic and does not block driving lanes',()=>{
 const a=streetPlan(),b=streetPlan();
 assert.deepEqual(a,b);
 assert.equal(a.filter(p=>p.kind==='zebra').length,13*13*18);
 assert.ok(a.some(p=>p.kind==='planter'));
 for(const prop of a){
  assert.ok(Number.isFinite(prop.x)&&Number.isFinite(prop.z),prop.kind);
  if(prop.kind!=='zebra'){
   const roadDistX=Math.abs(prop.x-Math.round(prop.x/100)*100);
   assert.ok(roadDistX>=12,prop.kind+' is in a traffic lane');
  }
 }
});
test('visual style distribution spans architectural types and safe roof tiers',()=>{
 const styles=new Set();
 for(let i=0;i<40;i++){
  const r=visualHash(i,i*17,3);
  const style=architectureStyle(i*47,i*12,40+i*4,r);
  styles.add(style.style);
  assert.ok(style.floors>=8&&style.floors<=40);
  assert.ok([2,3,4].includes(style.step));
  assert.equal(typeof style.sign,'boolean');
 }
 assert.deepEqual([...styles].sort(),['deco','glass','residential']);
});
test('player sports coupe stays within existing collision envelope',()=>{
 assert.equal(coupeDimensions.width,3.8);
 assert.equal(coupeDimensions.length,7.2);
 assert.ok(coupeDimensions.wheelbase<coupeDimensions.length);
});
test('procedural hashes are stable and always return normalized values',()=>{
 for(let i=-150;i<150;i++){
  const v=visualHash(i,i*13,42);
  assert.ok(v>=0&&v<1);
  assert.equal(v,visualHash(i,i*13,42));
 }
});

test('procedural texture noise remains bounded and the pedestrian matches collision tuning',()=>{
 for(let i=0;i<512;i++){
  const v=surfaceNoise(i,i*37,19);assert.ok(Number.isFinite(v)&&v>=0&&v<1);
  assert.equal(v,surfaceNoise(i,i*37,19));
 }
 assert.ok(characterDimensions.height>=3);
 assert.equal(characterDimensions.collisionRadius,.7);
});
