import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createServer} from '../server.mjs';
const root=new URL('../',import.meta.url);
const file=(p)=>new URL(p,root);
test('3D gameplay imports exact pinned local rendering runtime',()=>{
 const pkg=JSON.parse(readFileSync(file('package.json'),'utf8'));
 const code=readFileSync(file('public/game.mjs'),'utf8');
 assert.equal(pkg.dependencies.three,'0.170.0');
 assert.ok(code.includes("from './vendor/three/three.module.js'"));
 assert.ok(!code.includes('esm.sh/three'));
 assert.ok(existsSync(file('public/vendor/three/three.module.js')));
 assert.ok(existsSync(file('public/vendor/three/three.core.js')));
 assert.ok(existsSync(file('public/vendor/three/LICENSE')));
 assert.ok(statSync(file('public/vendor/three/three.module.js')).size>400000);
});
test('our Node server returns local WebGL ESM and copyright license, not a CDN redirect',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url=`http://127.0.0.1:${server.address().port}`;
  for(const path of ['/vendor/three/three.module.js','/vendor/three/three.core.js']){
   const response=await fetch(url+path);
   assert.equal(response.status,200,path);
   assert.match(response.headers.get('content-type'),/text\/javascript/);
   assert.ok((await response.text()).length>400000);
  }
  const licence=await fetch(url+'/vendor/three/LICENSE');
  assert.equal(licence.status,200);
  assert.match(await licence.text(),/MIT License/);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
