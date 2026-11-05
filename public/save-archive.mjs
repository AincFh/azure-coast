/**
 * AZURE COAST - portable local saves (v1).
 *
 * No server transmission, no external libraries, no silent auto-restore.
 * The SHA-256 digest detects accidental corruption; it is not an authenticity
 * signature and cannot prevent intentionally fabricated local game data.
 */
import {sanitizeProgress,safeSpawn} from './session-safety.mjs';
import {ROUTE} from './simulation.mjs';
import {restoreSession} from './physics.mjs';
import {restoreGarage} from './garage.mjs';
import {restoreHousing} from './housing.mjs';
import {restoreFleet} from './fleet.mjs';
import {restoreActivities} from './activities.mjs';
import {normalizeEnvironment} from './environment.mjs';
import {restoreJourney,cleanStops} from './journey.mjs';
import {summarizeGameProfile} from './player-bridge.mjs';

export const SAVE_ARCHIVE_FORMAT='azure-coast-local-save';
export const SAVE_ARCHIVE_VERSION=1;
export const SAVE_ARCHIVE_LIMIT=512*1024;
export const SAVE_RECORD_KEYS=Object.freeze([
 'azure-coast-driving-v2',
 'azure-coast-city-services-v1',
 'azure-coast-session-v3',
 'azure-coast-environment-v1',
 'azure-coast-active-journey-v1',
 'azure-coast-route-v2',
 'azure-coast-profile-v1'
]);
const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const dateValid=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&Number.isFinite(Date.parse(s));
function normalizeProfile(profile){
 if(!isObject(profile))return null;
 return {
  name:typeof profile.name==='string'?profile.name.slice(0,32):'城市探索者',
  favorites:Array.isArray(profile.favorites)?[...new Set(profile.favorites.filter(x=>typeof x==='string'&&x.length<=90))].slice(0,100):[],
  completed:Array.isArray(profile.completed)?[...new Set(profile.completed.filter(x=>typeof x==='string'&&x.length<=90))].slice(0,50):[]
 };
}
function normalizeRecord(key,value){
 if(value===null)return null;
 if(!isObject(value))throw new Error('record-type');
 switch(key){
  case 'azure-coast-driving-v2':
   return {...sanitizeProgress(value,ROUTE.length),
    garage:restoreGarage(value.garage),housing:restoreHousing(value.housing),
    fleet:restoreFleet(value.fleet)};
  case 'azure-coast-city-services-v1':return restoreActivities(value);
  case 'azure-coast-session-v3':{
   const session=restoreSession(value);
   if(!session)throw new Error('invalid-session');
   // The imported player must not start inside a building.
   const car=safeSpawn(session.car,2.3);
   if(!car)throw new Error('unsafe-spawn');
   const avatar=session.avatar?safeSpawn(session.avatar,.7):null;
   return {...session,car:{...session.car,...car},
    avatar:avatar?{...session.avatar,...avatar}:null,
    onFoot:session.onFoot&&!!avatar};
  }
  case 'azure-coast-environment-v1':return normalizeEnvironment(value);
  case 'azure-coast-active-journey-v1':return restoreJourney(value);
  case 'azure-coast-route-v2':
   return {selected:typeof value.selected==='string'?value.selected.slice(0,30):'bay',
    stops:cleanStops(value.stops),hour:Number.isInteger(value.hour)?Math.min(23,Math.max(0,value.hour)):8,
    weather:['clear','cloudy','rain'].includes(value.weather)?value.weather:'clear',
    vehicle:typeof value.vehicle==='string'?value.vehicle.slice(0,30):'gt'};
  case 'azure-coast-profile-v1':return normalizeProfile(value);
  default:throw new Error('unknown-record');
 }
}
const canonical=obj=>JSON.stringify({
 format:obj.format,version:obj.version,createdAt:obj.createdAt,
 records:Object.fromEntries(SAVE_RECORD_KEYS.map(k=>[k,obj.records[k]]))
});
const textSize=s=>new TextEncoder().encode(s).byteLength;
async function sha256(str,engine=globalThis.crypto){
 if(!engine?.subtle?.digest)throw new Error('secure-context-required');
 const digest=new Uint8Array(await engine.subtle.digest('SHA-256',new TextEncoder().encode(str)));
 return Array.from(digest,b=>b.toString(16).padStart(2,'0')).join('');
}
function parseStored(store,key){
 const value=store.getItem(key);
 if(value===null)return null;
 if(textSize(value)>SAVE_ARCHIVE_LIMIT)throw new Error('record-too-large');
 let parsed;
 try{parsed=JSON.parse(value)}catch{throw new Error('invalid-current-save')}
 return normalizeRecord(key,parsed);
}
export async function createSaveArchive(store,{now=new Date().toISOString(),crypto=globalThis.crypto}={}){
 if(!dateValid(now))throw new Error('invalid-date');
 const records=Object.fromEntries(SAVE_RECORD_KEYS.map(key=>[key,parseStored(store,key)]));
 const archive={format:SAVE_ARCHIVE_FORMAT,version:SAVE_ARCHIVE_VERSION,createdAt:now,records};
 const digest=await sha256(canonical(archive),crypto);
 const output={...archive,digest:{algorithm:'SHA-256',value:digest}};
 if(textSize(JSON.stringify(output))>SAVE_ARCHIVE_LIMIT)throw new Error('archive-too-large');
 return output;
}
export async function validateSaveArchive(data,{crypto=globalThis.crypto}={}){
 const source=typeof data==='string'?data:JSON.stringify(data);
 if(textSize(source)>SAVE_ARCHIVE_LIMIT)throw new Error('archive-too-large');
 let input;
 try{input=typeof data==='string'?JSON.parse(data):data}catch{throw new Error('invalid-json')}
 if(!isObject(input)||input.format!==SAVE_ARCHIVE_FORMAT||input.version!==SAVE_ARCHIVE_VERSION)
  throw new Error('incompatible-version');
 if(!dateValid(input.createdAt)||!isObject(input.records))throw new Error('invalid-schema');
 if(!isObject(input.digest)||input.digest.algorithm!=='SHA-256'||
    typeof input.digest.value!=='string'||!/^[a-f0-9]{64}$/.test(input.digest.value))
  throw new Error('invalid-digest');
 const found=Object.keys(input.records);
 if(found.length!==SAVE_RECORD_KEYS.length||found.some(key=>!SAVE_RECORD_KEYS.includes(key)))
  throw new Error('invalid-records');
 const expected=await sha256(canonical(input),crypto);
 if(expected!==input.digest.value)throw new Error('digest-mismatch');
 const records={};
 for(const key of SAVE_RECORD_KEYS)records[key]=normalizeRecord(key,input.records[key]);
 const normalized={format:SAVE_ARCHIVE_FORMAT,version:SAVE_ARCHIVE_VERSION,
  createdAt:input.createdAt,records};
 return {...normalized,summary:summarizeGameProfile(records[SAVE_RECORD_KEYS[0]],
  records[SAVE_RECORD_KEYS[1]])};
}
/**
 * Either all seven records replace the local save together, or the old values
 * are restored. Never write unverified data. Reload the game after success.
 */
export function applySaveArchive(store,verified){
 if(!isObject(verified)||verified.format!==SAVE_ARCHIVE_FORMAT||
    verified.version!==SAVE_ARCHIVE_VERSION||!isObject(verified.records))
  throw new Error('not-validated');
 const before=new Map();
 const writes=new Map();
 for(const key of SAVE_RECORD_KEYS){
  if(!Object.prototype.hasOwnProperty.call(verified.records,key))
   throw new Error('incomplete-archive');
  before.set(key,store.getItem(key));
  const clean=normalizeRecord(key,verified.records[key]);
  writes.set(key,clean===null?null:JSON.stringify(clean));
 }
 let started=false;
 try{
  for(const [key,data] of writes){
   started=true;
   if(data===null)store.removeItem(key);
   else store.setItem(key,data);
  }
 }catch(error){
  if(started){
   const failed=[];
   for(const [key,value] of before){
    try{if(value===null)store.removeItem(key);else store.setItem(key,value)}
    catch{failed.push(key)}
   }
   if(failed.length)throw new Error('rollback-incomplete:'+failed.join(','));
  }
  throw new Error('write-rolled-back',{cause:error});
 }
 return {success:true,records:SAVE_RECORD_KEYS.length};
}
export const SAVE_ARCHIVE_ERRORS=Object.freeze({
 'secure-context-required':'浏览器安全环境不可用，需使用 HTTPS 或 localhost。',
 'archive-too-large':'文件过大。存档最大支持 512 KB。',
 'invalid-json':'不是有效的 JSON 文件。',
 'incompatible-version':'存档格式或版本不兼容。',
 'invalid-schema':'存档结构或日期无效。',
 'invalid-digest':'存档校验信息无效。',
 'digest-mismatch':'文件内容与 SHA-256 校验值不一致，拒绝导入。',
 'invalid-records':'存档记录数量或名称不正确。',
 'record-type':'存档内存在错误的数据类型。',
 'invalid-session':'玩家位置存档不合法。',
 'unsafe-spawn':'存档玩家位置无法安全恢复。',
 'invalid-current-save':'现有游戏存档损坏，请在导出前检查。',
 'write-rolled-back':'写入失败，已恢复原有存档。',
 'not-validated':'存档未通过验证，无法写入。',
 'incomplete-archive':'存档文件缺少必要记录。'
});
export function describeArchiveError(error){
 const key=error?.message?.split(':')[0];
 return SAVE_ARCHIVE_ERRORS[key]||'无法完成存档操作，请检查文件及浏览器存储权限。';
}
