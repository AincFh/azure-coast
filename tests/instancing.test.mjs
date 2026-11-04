import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
test('road markings use instanced batches instead of standalone meshes',()=>{
  assert.match(source,/new THREE\.InstancedMesh\(/);
  assert.match(source,/staticDetail\(\.17,\.015,5,roadMark/);
  assert.match(source,/staticDetail\(5,\.015,\.17,roadMark/);
  assert.doesNotMatch(source,/box\(\.17,\.015,5,roadMark/);
});
test('building facade windows share material-specific instance batches',()=>{
  assert.match(source,/staticDetail\(2\.3,2\.5,\.13,wm/);
  assert.match(source,/staticDetail\(\.13,2\.5,2\.3,wm/);
  assert.match(source,/flushStaticDetails\(\);/);
});
