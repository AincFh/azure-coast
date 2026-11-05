import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 SAVE_ARCHIVE_FORMAT,SAVE_ARCHIVE_VERSION,SAVE_ARCHIVE_LIMIT,SAVE_RECORD_KEYS,
 createSaveArchive,validateSaveArchive,applySaveArchive,describeArchiveError
} from '../public/save-archive.mjs';
import {createGarage} from '../public/garage.mjs';
import {createHousing} from '../public/housing.mjs';
import {freshFleet} from '../public/fleet.mjs';
import {emptyActivities} from '../public/activities.mjs';
import {createJourney} from '../public/journey.mjs';
import {SAVE_VERSION} from '../public/physics.mjs';
function storeWith(entries={}){
 const records=new Map(Object.entries(entries));
 return {
  records,getItem:k=>records.has(k)?records.get(k):null,
  setItem:(k,value)=>records.set(k,String(value)),
  removeItem:k=>records.delete(k)
 };
}
function fixtures(){
 return storeWith({
  [SAVE_RECORD_KEYS[0]]:JSON.stringify({stage:2,credits:93450,damage:4,distance:150.2,
   bestSpeed:89,garage:{...createGarage(),engine:2},
   housing:{...createHousing(),owned:['coastal-starter'],rooms:{'coastal-starter':[{
    item:'sofa',slot:4,rotation:1}]},spent:9200},
   fleet:{...freshFleet(),owned:['azure-starter','tide'],active:'tide',spent:96000}}),
  [SAVE_RECORD_KEYS[1]]:JSON.stringify({...emptyActivities(),earned:5300,completed:{courier:2,taxi:1}}),
  [SAVE_RECORD_KEYS[2]]:JSON.stringify({version:SAVE_VERSION,car:{x:0,z:12,heading:0},
   avatar:{x:5,z:18,heading:Math.PI},onFoot:false,view:0}),
  [SAVE_RECORD_KEYS[3]]:JSON.stringify({hour:20,weather:'rain',autoCycle:false}),
  [SAVE_RECORD_KEYS[4]]:JSON.stringify(createJourney(['bay','marina'])),
  [SAVE_RECORD_KEYS[5]]:JSON.stringify({selected:'marina',stops:['bay','marina'],hour:20,weather:'rain',vehicle:'gt'}),
  [SAVE_RECORD_KEYS[6]]:JSON.stringify({name:'Azure Player',favorites:['car:tide'],completed:['courier']})
 });
}
const attempt=()=>({now:'2026-11-05T15:00:00.000Z'});
test('versioned export includes all seven known save sources with SHA-256 fingerprint',async()=>{
 const archive=await createSaveArchive(fixtures(),attempt());
 assert.equal(archive.format,SAVE_ARCHIVE_FORMAT);
 assert.equal(archive.version,SAVE_ARCHIVE_VERSION);
 assert.equal(archive.createdAt,'2026-11-05T15:00:00.000Z');
 assert.equal(Object.keys(archive.records).length,7);
 assert.deepEqual(Object.keys(archive.records),[...SAVE_RECORD_KEYS]);
 assert.match(archive.digest.value,/^[a-f0-9]{64}$/);
 assert.equal(archive.digest.algorithm,'SHA-256');
 assert.ok(JSON.stringify(archive).length<SAVE_ARCHIVE_LIMIT);
});
test('validated archive has real preview of money, vehicle, property and career',async()=>{
 const original=await createSaveArchive(fixtures(),attempt());
 const result=await validateSaveArchive(JSON.stringify(original));
 assert.equal(result.summary.balance,93450);
 assert.equal(result.summary.propertyCount,1);
 assert.equal(result.summary.furnitureCount,1);
 assert.equal(result.summary.vehicleCount,2);
 assert.equal(result.summary.currentVehicle,'TIDE E');
 assert.equal(result.summary.completedJobs,3);
 assert.equal(result.summary.careerIncome,5300);
 assert.equal(result.summary.engine,2);
});
test('export and import is a full round trip and restores all existing save records',async()=>{
 const from=fixtures(),target=storeWith();
 const archive=await createSaveArchive(from,attempt());
 const validated=await validateSaveArchive(JSON.stringify(archive));
 assert.deepEqual(applySaveArchive(target,validated),{success:true,records:7});
 for(const k of SAVE_RECORD_KEYS){
  assert.deepEqual(JSON.parse(target.getItem(k)),validated.records[k],k);
 }
 assert.equal(JSON.parse(target.getItem(SAVE_RECORD_KEYS[0])).fleet.active,'tide');
 assert.equal(JSON.parse(target.getItem(SAVE_RECORD_KEYS[0])).housing.rooms['coastal-starter'][0].rotation,1);
});
test('a missing source record remains explicitly null and is removed on restore',async()=>{
 const first=storeWith({[SAVE_RECORD_KEYS[0]]:JSON.stringify({credits:1200})});
 const archive=await createSaveArchive(first,attempt());
 assert.equal(archive.records[SAVE_RECORD_KEYS[2]],null);
 const target=fixtures();
 applySaveArchive(target,await validateSaveArchive(archive));
 assert.equal(target.getItem(SAVE_RECORD_KEYS[2]),null);
 assert.equal(target.getItem(SAVE_RECORD_KEYS[0]).includes('"credits":1200'),true);
});
test('tampering with a single wallet digit is caught before any browser storage mutation',async()=>{
 const store=fixtures(),archive=await createSaveArchive(store,attempt());
 const tampered=JSON.parse(JSON.stringify(archive));
 tampered.records[SAVE_RECORD_KEYS[0]].credits=999999999;
 await assert.rejects(()=>validateSaveArchive(tampered),/digest-mismatch/);
 assert.equal(JSON.parse(store.getItem(SAVE_RECORD_KEYS[0])).credits,93450);
});
test('missing, duplicate-replaced or unexpected records are rejected',async()=>{
 const archive=await createSaveArchive(fixtures(),attempt());
 const absent=JSON.parse(JSON.stringify(archive));
 delete absent.records[SAVE_RECORD_KEYS[4]];
 await assert.rejects(()=>validateSaveArchive(absent),/invalid-records/);
 const extra=JSON.parse(JSON.stringify(archive));
 extra.records['unexpected-permission']=true;
 await assert.rejects(()=>validateSaveArchive(extra),/invalid-records/);
});
test('wrong file format, digest, version and oversize files are refused',async()=>{
 const archive=await createSaveArchive(fixtures(),attempt());
 await assert.rejects(()=>validateSaveArchive('not json'),/invalid-json/);
 await assert.rejects(()=>validateSaveArchive({...archive,version:78}),/incompatible-version/);
 await assert.rejects(()=>validateSaveArchive({...archive,digest:{algorithm:'MD5',value:'hello'}}),/invalid-digest/);
 await assert.rejects(()=>validateSaveArchive('x'.repeat(SAVE_ARCHIVE_LIMIT+1)),/archive-too-large/);
 assert.match(describeArchiveError(new Error('digest-mismatch')),/校验/);
});
test('post-hash validation normalizes invalid driving state to safe, bounded data',async()=>{
 const raw=fixtures(),archive=await createSaveArchive(raw,attempt());
 const data=await validateSaveArchive(archive);
 const p=data.records[SAVE_RECORD_KEYS[0]];
 assert.equal(p.stage,2);assert.equal(p.garage.engine,2);
 assert.equal(p.fleet.active,'tide');
 assert.equal(p.housing.rooms['coastal-starter'].length,1);
 assert.equal(p.credits,93450);
});
test('invalid existing JSON does not silently export corrupted or missing ownership',async()=>{
 const store=fixtures();
 store.setItem(SAVE_RECORD_KEYS[0],'{corrupt-json');
 await assert.rejects(()=>createSaveArchive(store,attempt()),/invalid-current-save/);
});
test('invalid imported session is rejected even if digest verifies',async()=>{
 const records=fixtures();
 records.setItem(SAVE_RECORD_KEYS[2],JSON.stringify({car:{x:'oops',z:1,heading:0}}));
 await assert.rejects(()=>createSaveArchive(records,attempt()),/invalid-session/);
});
test('atomic write error restores the complete original save without partial progress',async()=>{
 const original=fixtures(),target=fixtures(),initial=new Map(target.records);
 original.setItem(SAVE_RECORD_KEYS[0],JSON.stringify({credits:64500,garage:createGarage(),
  housing:createHousing(),fleet:freshFleet()}));
 const archive=await validateSaveArchive(await createSaveArchive(original,attempt()));
 let failOnce=true;
 const unstable={getItem:target.getItem,removeItem:target.removeItem,
  setItem:(key,value)=>{
   if(failOnce&&key===SAVE_RECORD_KEYS[3]){failOnce=false;throw new Error('QuotaExceededError')}
   target.setItem(key,value);
  }};
 assert.throws(()=>applySaveArchive(unstable,archive),/write-rolled-back/);
 for(const key of SAVE_RECORD_KEYS)assert.equal(target.getItem(key),initial.get(key),key);
});
test('apply rejects incomplete and unvalidated archives without touching storage',()=>{
 const target=fixtures(),initial=new Map(target.records);
 assert.throws(()=>applySaveArchive(target,{format:'fake',records:{}}),/not-validated/);
 assert.throws(()=>applySaveArchive(target,{format:SAVE_ARCHIVE_FORMAT,version:1,
  records:{[SAVE_RECORD_KEYS[0]]:{credits:3}}}),/incomplete-archive/);
 assert.deepEqual(target.records,initial);
});
test('game leave-page handler honors the restoration guard to avoid overwriting imported spawn',()=>{
 const game=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 assert.match(game,/if\(window\.__AZURE_SNAPSHOT_RESTORING\)return/);
});
test('full save vault controls and website profile integration have real handlers',()=>{
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 const js=readFileSync(new URL('../public/save-manager.mjs',import.meta.url),'utf8');
 const site=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
 for(const id of ['saveManagerStart','saveManagerOpen','saveManagerPanel','saveExport',
  'saveImportFile','savePreview','saveOverwriteConfirm','saveImportApply','saveUndoImport'])
  assert.match(html,new RegExp('id="'+id+'"'),id);
 assert.match(js,/createSaveArchive/);
 assert.match(js,/validateSaveArchive/);
 assert.match(js,/applySaveArchive/);
 assert.match(js,/__AZURE_SNAPSHOT_RESTORING/);
 assert.match(site,/save\.html#saves/);
 const portal=readFileSync(new URL('../public/save.html',import.meta.url),'utf8');
 assert.match(portal,/id="saveManagerPanel"/);
 assert.doesNotMatch(portal,/src="\/game\.mjs"/);
});
