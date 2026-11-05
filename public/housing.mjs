/**
 * AZURE COAST / residences
 * Persistent, renderer-agnostic property ownership and furnishing economy.
 * Original starter property is accessible early; the premium addresses use
 * the exact prices from the public residential catalog, not invented prices.
 */
import {homes} from './catalog.mjs';
export const HOUSING_VERSION=1;
export const RESIDENCE_SLOTS=Object.freeze([
 Object.freeze({x:-8,z:-6}),Object.freeze({x:0,z:-6}),Object.freeze({x:8,z:-6}),
 Object.freeze({x:-8,z:0}),Object.freeze({x:0,z:0}),Object.freeze({x:8,z:0}),
 Object.freeze({x:-8,z:6}),Object.freeze({x:0,z:6}),Object.freeze({x:8,z:6})
]);
const catalog=Object.fromEntries(homes.map(p=>[p.id,p]));
const p=(id,x,z,style,description)=>Object.freeze({
 id,name:catalog[id].name,price:catalog[id].price,x,z,style,description,starter:false
});
export const RESIDENCES=Object.freeze([
 Object.freeze({id:'coastal-starter',name:'海湾初始公寓',price:8000,x:14,z:18,style:'coastal',
  description:'城市新居民的首套住宅，靠近起点和车辆工坊。',starter:true}),
 p('harbor-home',-214,-312,'industrial','南港旧仓改造，宽敞开放式空间。'),
 p('beach',314,-318,'resort','靠近海岸的明亮度假住宅。'),
 p('loft',314,280,'modern','中心区现代天际住宅。')
]);
export const FURNITURE=Object.freeze([
 Object.freeze({id:'sofa',name:'亚麻沙发',price:1200,category:'起居'}),
 Object.freeze({id:'bed',name:'双人床',price:2200,category:'休息'}),
 Object.freeze({id:'table',name:'胡桃木餐桌',price:980,category:'餐饮'}),
 Object.freeze({id:'desk',name:'创作工作台',price:1450,category:'工作'}),
 Object.freeze({id:'plant',name:'绿植盆景',price:380,category:'装饰'}),
 Object.freeze({id:'lamp',name:'落地灯',price:550,category:'照明'}),
 Object.freeze({id:'shelf',name:'组合书架',price:740,category:'收纳'}),
 Object.freeze({id:'television',name:'客厅电视',price:1750,category:'娱乐'}),
 Object.freeze({id:'chair',name:'休闲座椅',price:620,category:'起居'})
]);
const residences=new Map(RESIDENCES.map(x=>[x.id,x]));
const furniture=new Map(FURNITURE.map(x=>[x.id,x]));
const validWallet=v=>Number.isSafeInteger(v)&&v>=0;
const limited=v=>Number.isSafeInteger(v)&&v>=0?Math.min(v,1e9):0;
export const propertyById=id=>residences.get(id)||null;
export const furnitureById=id=>furniture.get(id)||null;
export const createHousing=()=>({version:HOUSING_VERSION,owned:[],rooms:{},spent:0,transactions:0});
export function restoreHousing(raw){
 const base=createHousing();
 if(!raw||typeof raw!=='object'||raw.version!==HOUSING_VERSION)return base;
 const owned=Array.isArray(raw.owned)?[...new Set(raw.owned.filter(id=>residences.has(id)))]:[];
 const rooms={};
 for(const id of owned){
  const entries=Array.isArray(raw.rooms?.[id])?raw.rooms[id]:[];
  const used=new Set(),valid=[];
  for(const entry of entries.slice(0,32)){
   if(!entry||!furniture.has(entry.item)||!Number.isInteger(entry.slot)||
     entry.slot<0||entry.slot>=RESIDENCE_SLOTS.length||used.has(entry.slot))continue;
   used.add(entry.slot);
   valid.push({item:entry.item,slot:entry.slot,rotation:Number.isInteger(entry.rotation)?((entry.rotation%4)+4)%4:0});
  }
  rooms[id]=valid.sort((a,b)=>a.slot-b.slot);
 }
 return {version:HOUSING_VERSION,owned,rooms,spent:limited(raw.spent),
  transactions:Number.isInteger(raw.transactions)&&raw.transactions>=0?Math.min(10000,raw.transactions):0};
}
export function nearestResidence(position,maxDistance=26){
 if(!position||![position.x,position.z].every(Number.isFinite))return null;
 let closest=null,distance=maxDistance;
 for(const residence of RESIDENCES){
  const d=Math.hypot(position.x-residence.x,position.z-residence.z);
  if(d<=distance){closest=residence;distance=d}
 }
 return closest;
}
export function purchaseResidence(raw,id,balance,{position,speed}={}){
 const state=restoreHousing(raw),property=propertyById(id);
 if(!property)return {state,balance,reason:'unknown'};
 if(state.owned.includes(id))return {state,balance,reason:'owned'};
 if(!validWallet(balance))return {state,balance,reason:'wallet'};
 if(!position||![position.x,position.z].every(Number.isFinite))return {state,balance,reason:'position'};
 if(Math.hypot(property.x-position.x,property.z-position.z)>26)return {state,balance,reason:'distance'};
 if(!Number.isFinite(speed)||Math.abs(speed)>3)return {state,balance,reason:'moving'};
 if(balance<property.price)return {state,balance,reason:'funds',cost:property.price};
 return {state:{...state,owned:[...state.owned,id],rooms:{...state.rooms,[id]:[]},
  spent:state.spent+property.price,transactions:state.transactions+1},
  balance:balance-property.price,cost:property.price,reason:null,property};
}
export function canEnterResidence(raw,id,{position,mode}={}){
 const state=restoreHousing(raw),property=propertyById(id);
 if(!property)return {allowed:false,reason:'unknown'};
 if(!state.owned.includes(id))return {allowed:false,reason:'not-owned'};
 if(mode!=='foot')return {allowed:false,reason:'mode'};
 if(!position||![position.x,position.z].every(Number.isFinite))return {allowed:false,reason:'position'};
 if(Math.hypot(position.x-property.x,position.z-property.z)>24)
  return {allowed:false,reason:'distance'};
 return {allowed:true,reason:null};
}
export function roomFurniture(raw,id){
 const state=restoreHousing(raw);
 return state.owned.includes(id)?state.rooms[id].map(item=>({...item})):[];
}
export function purchaseFurniture(raw,propertyId,itemId,slot,balance){
 const state=restoreHousing(raw);
 if(!state.owned.includes(propertyId))return {state,balance,reason:'not-owned'};
 const item=furnitureById(itemId);
 if(!item||!Number.isInteger(slot)||slot<0||slot>=RESIDENCE_SLOTS.length)
  return {state,balance,reason:'unknown'};
 if(!validWallet(balance))return {state,balance,reason:'wallet'};
 if(state.rooms[propertyId].some(entry=>entry.slot===slot))
  return {state,balance,reason:'occupied'};
 if(balance<item.price)return {state,balance,reason:'funds',cost:item.price};
 const room=[...state.rooms[propertyId],{item:itemId,slot,rotation:0}].sort((a,b)=>a.slot-b.slot);
 return {state:{...state,rooms:{...state.rooms,[propertyId]:room},
  spent:state.spent+item.price,transactions:state.transactions+1},
  balance:balance-item.price,cost:item.price,reason:null};
}
export function moveFurniture(raw,id,fromSlot,toSlot){
 const state=restoreHousing(raw);
 if(!state.owned.includes(id))return {state,reason:'not-owned'};
 if(!Number.isInteger(toSlot)||toSlot<0||toSlot>=RESIDENCE_SLOTS.length)
  return {state,reason:'out-of-range'};
 const room=state.rooms[id],item=room.find(entry=>entry.slot===fromSlot);
 if(!item)return {state,reason:'missing'};
 if(room.some(entry=>entry.slot===toSlot))return {state,reason:'occupied'};
 const next=room.map(entry=>entry===item?{...entry,slot:toSlot}:entry).sort((a,b)=>a.slot-b.slot);
 return {state:{...state,rooms:{...state.rooms,[id]:next}},reason:null};
}
export function rotateFurniture(raw,id,slot){
 const state=restoreHousing(raw);
 if(!state.owned.includes(id))return {state,reason:'not-owned'};
 const room=state.rooms[id],item=room.find(entry=>entry.slot===slot);
 if(!item)return {state,reason:'missing'};
 return {state:{...state,rooms:{...state.rooms,[id]:room.map(entry=>
  entry===item?{...entry,rotation:(entry.rotation+1)%4}:entry)}},reason:null};
}
export function sellFurniture(raw,id,slot,balance){
 const state=restoreHousing(raw);
 if(!state.owned.includes(id))return {state,balance,reason:'not-owned'};
 if(!validWallet(balance))return {state,balance,reason:'wallet'};
 const room=state.rooms[id],item=room.find(entry=>entry.slot===slot);
 if(!item)return {state,balance,reason:'missing'};
 const refund=Math.floor(furniture.get(item.item).price*.5);
 return {state:{...state,rooms:{...state.rooms,[id]:room.filter(entry=>entry.slot!==slot)},
  transactions:state.transactions+1},balance:balance+refund,refund,reason:null};
}
/** Walkable 28 x 24 metre interior, 9 furnishing cells and a doorway at z=10. */
export function interiorStep(position,input,dt,room=[]){
 const t=Math.min(.06,Math.max(0,Number.isFinite(dt)?dt:0));
 const dx=Number(!!input.right)-Number(!!input.left);
 const dz=Number(!!input.back)-Number(!!input.forward);
 const length=Math.hypot(dx,dz)||1,speed=input.sprint?6.5:4.4;
 const x=Math.max(-12.25,Math.min(12.25,position.x+dx/length*speed*t));
 const z=Math.max(-9.2,Math.min(9.5,position.z+dz/length*speed*t));
 const collides=(a,b)=>room.some(entry=>{
  const target=RESIDENCE_SLOTS[entry.slot];
  return Math.abs(a-target.x)<2.25&&Math.abs(b-target.z)<2.25;
 });
 const nextX=collides(x,position.z)?position.x:x;
 const nextZ=collides(nextX,z)?position.z:z;
 return {x:nextX,z:nextZ,heading:dx||dz?Math.atan2(-dx,-dz):position.heading,
  moving:!!(dx||dz)};
}
