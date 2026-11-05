/**
 * AZURE COAST / Vehicle collection
 * All purchasable cars are the six vehicles from the actual website catalog.
 * Physics tuning, wallet debits and ownership remain deterministic without WebGL.
 */
import {vehicles} from './catalog.mjs';
export const FLEET_VERSION=1;
export const FLEET_DEALERSHIP=Object.freeze({x:-22,z:18,radius:34});
export const STARTER_ID='azure-starter';
const modelSpec=Object.freeze({
 solstice:{body:'super',acceleration:1.32,steering:1.13,braking:1.08},
 vantage:{body:'sport',acceleration:1.12,steering:1.18,braking:1.1},
 tide:{body:'electric',acceleration:1.45,steering:1.09,braking:1.12},
 atlas:{body:'suv',acceleration:.79,steering:.77,braking:.88},
 retro:{body:'classic',acceleration:.88,steering:.90,braking:.95},
 comet:{body:'hyper',acceleration:1.61,steering:1.23,braking:1.16}
});
export const FLEET_CATALOG=Object.freeze([
 Object.freeze({id:STARTER_ID,name:'COAST / GT',type:'入门跑车',
  body:'starter',price:0,color:'#dcb282',top:176,acceleration:1,
  steering:1,braking:1,starter:true}),
 ...vehicles.map(v=>Object.freeze({...v,...modelSpec[v.id],starter:false}))
]);
const byId=new Map(FLEET_CATALOG.map(v=>[v.id,v]));
export const fleetVehicle=id=>byId.get(id)||null;
export const freshFleet=()=>({version:FLEET_VERSION,owned:[STARTER_ID],active:STARTER_ID,spent:0,transactions:0});
export function restoreFleet(raw){
 const first=freshFleet();
 if(!raw||typeof raw!=='object'||raw.version!==FLEET_VERSION)return first;
 const owned=[STARTER_ID,...new Set((Array.isArray(raw.owned)?raw.owned:[])
  .filter(id=>id!==STARTER_ID&&byId.has(id)))];
 const active=owned.includes(raw.active)?raw.active:STARTER_ID;
 const bounded=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,1e9):0;
 return {...first,owned,active,spent:bounded(raw.spent),
  transactions:Math.min(10000,bounded(raw.transactions))};
}
export function dealershipAccess({position,speed=0}={}){
 if(!position||![position.x,position.z].every(Number.isFinite))
  return {allowed:false,reason:'position'};
 if(Math.hypot(position.x-FLEET_DEALERSHIP.x,position.z-FLEET_DEALERSHIP.z)>FLEET_DEALERSHIP.radius)
  return {allowed:false,reason:'distance'};
 if(!Number.isFinite(speed)||Math.abs(speed)>3)
  return {allowed:false,reason:'moving'};
 return {allowed:true,reason:null};
}
export function buyFleetVehicle(raw,id,balance,player){
 const state=restoreFleet(raw),car=fleetVehicle(id);
 if(!car||car.starter)return {state,balance,reason:'unknown'};
 if(state.owned.includes(id))return {state,balance,reason:'owned'};
 if(!Number.isSafeInteger(balance)||balance<0)return {state,balance,reason:'wallet'};
 const access=dealershipAccess(player);
 if(!access.allowed)return {state,balance,reason:access.reason};
 if(balance<car.price)return {state,balance,reason:'funds',cost:car.price};
 return {state:{...state,owned:[...state.owned,id],spent:state.spent+car.price,
  transactions:state.transactions+1},balance:balance-car.price,
  cost:car.price,reason:null,car};
}
export function switchFleetVehicle(raw,id,player){
 const state=restoreFleet(raw);
 if(!state.owned.includes(id))return {state,reason:'not-owned'};
 if(state.active===id)return {state,reason:'active'};
 const access=dealershipAccess(player);
 if(!access.allowed)return {state,reason:access.reason};
 return {state:{...state,active:id},reason:null,car:fleetVehicle(id)};
}
/** Optional resale at 60% book value; cannot sell starter or currently driven car. */
export function sellFleetVehicle(raw,id,balance,player){
 const state=restoreFleet(raw),car=fleetVehicle(id);
 if(!car||car.starter)return {state,balance,reason:'unknown'};
 if(!state.owned.includes(id))return {state,balance,reason:'not-owned'};
 if(state.active===id)return {state,balance,reason:'active'};
 if(!Number.isSafeInteger(balance)||balance<0)return {state,balance,reason:'wallet'};
 const access=dealershipAccess(player);
 if(!access.allowed)return {state,balance,reason:access.reason};
 const refund=Math.floor(car.price*.6);
 return {state:{...state,owned:state.owned.filter(entry=>entry!==id),
   transactions:state.transactions+1},balance:balance+refund,refund,reason:null,car};
}
/** Existing garage engine and chassis upgrades work with the selected car. */
export function fleetTuning(raw,garage){
 const car=fleetVehicle(restoreFleet(raw).active)||FLEET_CATALOG[0];
 const acceleration=Number.isFinite(garage?.acceleration)?garage.acceleration:1;
 const steering=Number.isFinite(garage?.steering)?garage.steering:1;
 const armor=Number.isFinite(garage?.impactFactor)?garage.impactFactor:1;
 return {
  acceleration:Math.min(2.8,car.acceleration*acceleration),
  maxSpeed:Math.min(107,car.top/3.6+(Number.isFinite(garage?.maxSpeed)?(garage.maxSpeed-49):0)),
  steering:Math.min(1.9,car.steering*steering),
  impactFactor:armor*(car.body==='suv'?.8:car.body==='classic'?1.12:1),
  paintHex:garage?.paintHex??0xdcb282,
  braking:car.braking,
  modelId:car.id
 };
}
