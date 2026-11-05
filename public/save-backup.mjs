/**
 * AZURE COAST — portable local save archives.
 * Explicit, offline export/import. Never sends game data to a server.
 * The checksum detects accidental corruption, not malicious tampering.
 */
import {sanitizeProgress} from './session-safety.mjs';
import {ROUTE} from './simulation.mjs';
import {restoreGarage} from './garage.mjs';
import {restoreHousing} from './housing.mjs';
import {restoreFleet} from './fleet.mjs';
import {restoreActivities} from './activities.mjs';
import {restoreSession} from './physics.mjs';
import {normalizeEnvironment} from './environment.mjs';
import {loadPlannedStops,restoreJourney} from './journey.mjs';
import {summarizeGameProfile} from './player-bridge.mjs';
export const BACKUP_FORMAT='AZURE-COAST-LOCAL-SAVE';
export const BACKUP_VERSION=1;
export const MAX_ARCHIVE_LENGTH=2*1024*1024;
export const BACKUP_STORAGE_KEYS=Object.freeze({
 driving:'azure-coast-driving-v2',
 session:'azure-coast-session-v3',
 environment:'azure-coast-environment-v1',
 route:'azure-coast-route-v2',
 journey:'azure-coast-active-journey-v1',
 activities:'azure-coast-city-services-v1',
 profile:'azure-coast-profile-v1'
});
const keys=Object.keys(BACKUP_STORAGE_KEYS);
const record=value=>value&&typeof value==='object'&&!Array.isArray(value);
function normalizeProfile(raw){
 const profile=record(raw)?raw:{};
 const valid=id=>typeof id==='string'&&id.length<=100&&
  /^(car|home|district):[a-z0-9-]{1,60}$/.test(id);
 const items=ids=>Array.isArray(ids)?[...new Set(ids.filter(valid))].slice(0,150):[];
 return {
  name:typeof profile.name==='string'?profile.name.slice(0,32):'城市探索者',
  favorites:items(profile.favorites),
  completed:Array.isArray(profile.completed)?
   [...new Set(profile.completed.filter(id=>typeof id==='string'&&id.length<=60))].slice(0,30):[]
 };
}
export function normalizeSaveData(key,value){
 if(key==='driving'){
  const source=record(value)?value:{};
  return {...sanitizeProgress(source,ROUTE.length),
   garage:restoreGarage(source.garage),housing:restoreHousing(source.housing),
   fleet:restoreFleet(source.fleet)};
 }
 if(key==='session')return restoreSession(value);
 if(key==='environment')return normalizeEnvironment(value);
 if(key==='route')return {stops:loadPlannedStops(value)};
 if(key==='journey')return restoreJourney(value);
 if(key==='activities')return restoreActivities(value);
 if(key==='profile')return normalizeProfile(value);
 return null;
}
export function normalizeArchivePayload(payload){
 if(!record(payload))throw new Error('存档数据结构无效');
 if(Object.keys(payload).some(key=>!keys.includes(key)))
  throw new Error('存档包含未知数据区域');
 const data={};
 for(const key of keys){
  if(!Object.prototype.hasOwnProperty.call(payload,key))continue;
  const result=normalizeSaveData(key,payload[key]);
  if(result!==null)data[key]=result;
 }
 return data;
}
export function backupChecksum(payload){
 let hash=2166136261;
 const raw=JSON.stringify(payload);
 for(let i=0;i<raw.length;i++){
  hash^=raw.charCodeAt(i);
  hash=Math.imul(hash,16777619);
 }
 return (hash>>>0).toString(16).padStart(8,'0');
}
export function createGameBackup(storage,now=new Date().toISOString()){
 const payload={};
 for(const key of keys){
  const raw=storage.getItem(BACKUP_STORAGE_KEYS[key]);
  if(raw===null||raw===undefined)continue;
  try{
   const parsed=JSON.parse(raw);
   const value=normalizeSaveData(key,parsed);
   if(value!==null)payload[key]=value;
  }catch{ /* Broken legacy entry is not included in a valid export. */ }
 }
 const normalized=normalizeArchivePayload(payload);
 const archive={format:BACKUP_FORMAT,version:BACKUP_VERSION,
  createdAt:String(now),payload:normalized,checksum:backupChecksum(normalized)};
 return JSON.stringify(archive,null,2);
}
export function parseGameBackup(text){
 if(typeof text!=='string'||text.length>MAX_ARCHIVE_LENGTH)
  throw new Error('存档文件过大或格式无效');
 let archive;
 try{archive=JSON.parse(text)}catch{throw new Error('无法解析存档 JSON')}
 if(!record(archive)||archive.format!==BACKUP_FORMAT||archive.version!==BACKUP_VERSION)
  throw new Error('存档类型或版本不兼容');
 if(!record(archive.payload)||typeof archive.checksum!=='string'||
   !/^[a-f0-9]{8}$/.test(archive.checksum))
  throw new Error('存档缺少有效的完整性校验');
 if(backupChecksum(archive.payload)!==archive.checksum)
  throw new Error('存档校验失败：文件可能已损坏或被修改');
 const payload=normalizeArchivePayload(archive.payload);
 return {
  format:BACKUP_FORMAT,version:BACKUP_VERSION,createdAt:String(archive.createdAt||''),
  payload,checksum:archive.checksum,preview:previewGameBackup(payload)
 };
}
export function previewGameBackup(payload){
 const data=normalizeArchivePayload(payload);
 const game=summarizeGameProfile(data.driving||null,data.activities||null);
 return {
  wallet:game.balance,
  homeCount:game.propertyCount,
  furnitureCount:game.furnitureCount,
  vehicleCount:game.vehicleCount,
  currentVehicle:game.currentVehicle,
  completedJobs:game.completedJobs,
  sections:Object.keys(data).length
 };
}
/**
 * Best-effort transactional localStorage replacement: take a complete
 * pre-write snapshot and roll it back in reverse order after any write error.
 * A permanently broken storage backend cannot guarantee rollback.
 */
export function applyGameBackup(storage,archive){
 if(!archive||archive.format!==BACKUP_FORMAT||archive.version!==BACKUP_VERSION||
  !record(archive.payload))throw new Error('尚未选择经过验证的游戏存档');
 const payload=normalizeArchivePayload(archive.payload);
 const snapshots=new Map();
 for(const key of keys)snapshots.set(key,storage.getItem(BACKUP_STORAGE_KEYS[key]));
 const modified=[];
 try{
  for(const key of keys){
   const storageKey=BACKUP_STORAGE_KEYS[key];
   if(Object.prototype.hasOwnProperty.call(payload,key)){
    storage.setItem(storageKey,JSON.stringify(payload[key]));
   }else{
    storage.removeItem(storageKey);
   }
   modified.push(key);
  }
 }catch(error){
  let reverted=true;
  for(const key of [...modified].reverse()){
   try{
    const value=snapshots.get(key),storageKey=BACKUP_STORAGE_KEYS[key];
    if(value===null||value===undefined)storage.removeItem(storageKey);
    else storage.setItem(storageKey,value);
   }catch{reverted=false}
  }
  throw new Error(reverted?'写入失败；原始存档已恢复':'写入失败；部分存储无法回滚，请勿关闭游戏');
 }
 return {written:modified.length,preview:previewGameBackup(payload)};
}
