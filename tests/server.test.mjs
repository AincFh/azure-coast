import test from 'node:test';import assert from 'node:assert/strict';import{createServer}from'../server.mjs';
test('website routes, API, security and assets',async()=>{const s=createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${s.address().port}`;try{for(const route of ['/','/play.html','/styles.css','/app.mjs','/game.mjs','/catalog.mjs','/assets/coast.svg','/assets/garage.svg']){const r=await fetch(base+route);assert.equal(r.status,200,route);assert.ok((await r.text()).length>200,route)}const api=await(await fetch(base+'/api/catalog')).json();assert.equal(api.districts.length,6);assert.equal(api.vehicles.length,6);assert.equal(api.homes.length,6);assert.equal(api.missions.length,4);assert.equal((await(await fetch(base+'/api/health')).json()).ok,true);assert.equal((await fetch(base+'/missing')).status,404);assert.equal((await fetch(base+'/api/catalog',{method:'POST'})).status,405);assert.equal((await fetch(base+'/%2e%2e/%2e%2e/package.json')).status,404)}finally{await new Promise(r=>s.close(r))}});


test('server returns raw HTML, CSS, ESM and SVG rather than JSON-encoded Buffers',async()=>{
 const server=createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 try{
  for(const [path,prefix,type] of [['/','<!doctype html>','text/html'],['/explore.html','<!doctype html>','text/html'],['/play.html','<!doctype html>','text/html'],['/styles.css','@import','text/css'],['/journey.mjs','/** Shared','text/javascript'],['/assets/coast.svg','<svg','image/svg+xml']]){
   const response=await fetch(url+path);
   assert.equal(response.status,200,path);
   assert.ok(response.headers.get('content-type').includes(type),path);
   const content=await response.text();
   assert.ok(content.trimStart().startsWith(prefix),`${path} served invalid bytes: ${content.slice(0,60)}`);
   assert.doesNotMatch(content,/^\{"type":"Buffer","data":\[/);
  }
 }finally{await new Promise(resolve=>server.close(resolve))}
});
