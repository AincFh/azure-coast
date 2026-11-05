/**
 * AZURE COAST / deterministic vehicle energy and roadside charging.
 * Works without WebGL, DOM or network access. Tank levels are independent
 * for each owned vehicle and live alongside the existing driving save.
 */
import {FLEET_CATALOG, fleetVehicle} from './fleet.mjs';

export const ENERGY_VERSION=1;
export const ENERGY_CAPACITY=100;
export const ENERGY_PRICE_PER_UNIT=7;
export const ENERGY_PER_METRE=.008;
export const ENERGY_STATIONS=Object.freeze([
 Object.freeze({id:'coast',name:'海岸能源站',x:-22,z:16,radius:30}),
 Object.freeze({id:'marina',name:'游艇港补给站',x:308,z:-390,radius:32}),
 Object.freeze({id:'downtown',name:'中央城区补给站',x:305,z:204,radius:30}),
 Object.freeze({id:'cliff',name:'山崖服务站',x:-305,z:306,radius:30})
]);
const knownIds=new Set(FLEET_CATALOG.map(car=>car.id));
const bounded=(value,max)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):0;
const level=value=>typeof value==='number'&&Number.isFinite(value)
 ? Math.min(ENERGY_CAPACITY,Math.max(0,value)):ENERGY_CAPACITY;

export function freshEnergy(){return {version:ENERGY_VERSION,tanks:{},spent:0,transactions:0}}
export function restoreEnergy(raw){
 const state=freshEnergy();
 if(!raw||typeof raw!=='object'||raw.version!==ENERGY_VERSION)return state;
 if(raw.tanks&&typeof raw.tanks==='object'&&!Array.isArray(raw.tanks)){
  for(const [id,value] of Object.entries(raw.tanks)){
   if(knownIds.has(id))state.tanks[id]=level(value);
  }
 }
 state.spent=bounded(raw.spent,1e9);
 state.transactions=bounded(raw.transactions,1e6);
 return state;
}
export function energyLevel(state,id){
 if(!knownIds.has(id))return 0;
 return level(state?.tanks?.[id]);
}
export function consumeEnergy(state,id,distance){
 if(!knownIds.has(id)||!Number.isFinite(distance)||distance<=0)
  return {state,used:0,remaining:energyLevel(state,id)};
 const current=energyLevel(state,id);
 const remaining=Math.max(0,current-distance*ENERGY_PER_METRE);
 const next={...state,tanks:{...state.tanks,[id]:remaining}};
 return {state:next,used:current-remaining,remaining};
}
export function nearestEnergyStation(position){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
 let nearest=null,best=Infinity;
 for(const station of ENERGY_STATIONS){
  const distance=Math.hypot(position.x-station.x,position.z-station.z);
  if(distance<best){best=distance;nearest={...station,distance}}
 }
 return nearest;
}
export function energyStationAccess({position,speed=0,onFoot=false}={}){
 const station=nearestEnergyStation(position);
 if(!station)return {allowed:false,reason:'position',station:null};
 if(station.distance>station.radius)return {allowed:false,reason:'distance',station};
 if(onFoot)return {allowed:false,reason:'on-foot',station};
 if(!Number.isFinite(speed)||Math.abs(speed)>3)
  return {allowed:false,reason:'moving',station};
 return {allowed:true,reason:null,station};
}
/** Purchase exactly the energy supported by your existing wallet; partial
 * refills are allowed. All validation happens before any state is returned.
 */
export function rechargeVehicle(state,id,balance,player){
 if(!fleetVehicle(id))return {state,balance,reason:'unknown'};
 if(!Number.isSafeInteger(balance)||balance<0)return {state,balance,reason:'wallet'};
 const access=energyStationAccess(player);
 if(!access.allowed)return {state,balance,reason:access.reason,station:access.station};
 const current=energyLevel(state,id);
 if(current>=ENERGY_CAPACITY-.000001)return {state,balance,reason:'full',station:access.station};
 const affordable=Math.floor(balance/ENERGY_PRICE_PER_UNIT);
 const amount=Math.min(ENERGY_CAPACITY-current,affordable);
 if(amount<=0)return {state,balance,reason:'funds',station:access.station};
 const cost=Math.ceil(amount*ENERGY_PRICE_PER_UNIT);
 const next={...state,tanks:{...state.tanks,[id]:Math.min(ENERGY_CAPACITY,current+amount)},
  spent:bounded(state.spent,1e9)+cost,transactions:bounded(state.transactions,1e6)+1};
 return {state:next,balance:balance-cost,cost,amount,reason:null,station:access.station};
}
