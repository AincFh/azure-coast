/**
 * AZURE COAST / walk-up retail and survival simulation.
 * Single wallet: purchases debit the existing driving balance atomically.
 * Pure deterministic mechanics, no render/audio/storage dependencies.
 */
import {FLEET_CATALOG,fleetVehicle,STARTER_ID} from './fleet.mjs';
export const LIVING_VERSION=1;
export const SHOPS=Object.freeze([
 Object.freeze({id:'cafe',name:'晨汐咖啡',kind:'food',x:-14,z:22,radius:23,category:'餐饮 · 街角咖啡厅',
  description:'营业中的街边咖啡馆。购买热饮与餐点，为步行恢复精力。'}),
 Object.freeze({id:'market',name:'海岸便利店',kind:'food',x:-12,z:126,radius:19,category:'零售 · 社区商店',
  description:'城市日常补给，提供随身食物与饮料。'}),
 Object.freeze({id:'station',name:'AZURE 能源站',kind:'energy',x:-15,z:-15,radius:22,category:'交通 · 能源补给',
  description:'停车后补充燃油或为电动车充电，维持真实驾驶续航。'})
]);
const product=(id,name,price,hunger,hydration,stamina,shops,description)=>Object.freeze({
 id,name,price,hunger,hydration,stamina,shops:Object.freeze(shops),description
});
export const PRODUCTS=Object.freeze([
 product('coffee','海盐拿铁',65,5,18,11,['cafe'],'新鲜热饮 · 少量恢复体力'),
 product('sandwich','港湾三明治',95,29,4,14,['cafe','market'],'可以随身携带的工作餐'),
 product('lunch','海岸能量碗',160,47,9,21,['cafe'],'饱腹主食 · 更长的步行续航'),
 product('water','矿泉水',24,0,42,7,['market','cafe'],'基础饮水补给'),
 product('juice','橙汁',48,6,28,8,['market','cafe'],'果汁与水分'),
 product('fruit','新鲜水果',35,14,12,6,['market'],'轻量健康零食'),
 product('meal','即食饭盒',125,38,5,14,['market'],'适合任务间隙的食物'),
 product('energy','能量棒',85,18,0,29,['market'],'高能量随身补给')
]);
const shops=new Map(SHOPS.map(x=>[x.id,x])),items=new Map(PRODUCTS.map(x=>[x.id,x]));
const clip=(x,min,max)=>Number.isFinite(x)?Math.max(min,Math.min(max,x)):min;
const isWallet=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
const fuelMap=()=>Object.fromEntries(FLEET_CATALOG.map(c=>[c.id,100]));
export const lifeShop=id=>shops.get(id)||null;
export const lifeProduct=id=>items.get(id)||null;
export const makeLiving=()=>({
 version:LIVING_VERSION,hunger:85,hydration:85,stamina:100,
 inventory:{},fuel:fuelMap(),spent:0,purchases:0,consumed:0,metres:0
});
export function restoreLiving(raw){
 const first=makeLiving();
 if(!raw||typeof raw!=='object'||raw.version!==LIVING_VERSION)return first;
 const inventory={};
 for(const product of PRODUCTS){
  const count=raw.inventory?.[product.id];
  if(Number.isSafeInteger(count)&&count>0)inventory[product.id]=Math.min(12,count);
 }
 const fuel={};
 for(const car of FLEET_CATALOG)fuel[car.id]=clip(raw.fuel?.[car.id],0,100);
 // Older records without this model remain refueled on their first upgrade.
 for(const car of FLEET_CATALOG)if(raw.fuel?.[car.id]===undefined)fuel[car.id]=100;
 return {
  version:LIVING_VERSION,
  hunger:clip(raw.hunger,0,100),hydration:clip(raw.hydration,0,100),
  stamina:clip(raw.stamina,0,100),
  inventory,fuel,
  spent:Number.isSafeInteger(raw.spent)&&raw.spent>=0?Math.min(1e9,raw.spent):0,
  purchases:Number.isSafeInteger(raw.purchases)&&raw.purchases>=0?Math.min(100000,raw.purchases):0,
  consumed:Number.isSafeInteger(raw.consumed)&&raw.consumed>=0?Math.min(100000,raw.consumed):0,
  metres:clip(raw.metres,0,1e8)
 };
}
export function inventoryCount(state){
 return Object.values(restoreLiving(state).inventory).reduce((s,n)=>s+n,0);
}
export function closestShop(position,limit=27){
 if(!position||![position.x,position.z].every(Number.isFinite))return null;
 let found=null,best=limit;
 for(const p of SHOPS){
  const d=Math.hypot(p.x-position.x,p.z-position.z);
  if(d<=best){found=p;best=d}
 }
 return found;
}
export function shopAccess(id,{position,mode,speed=0}={}){
 const place=lifeShop(id);
 if(!place)return {allowed:false,reason:'unknown'};
 if(!position||![position.x,position.z].every(Number.isFinite))
  return {allowed:false,reason:'position'};
 if(Math.hypot(position.x-place.x,position.z-place.z)>place.radius)
  return {allowed:false,reason:'distance'};
 if(place.kind==='food'&&mode!=='foot')
  return {allowed:false,reason:'on-foot'};
 if(place.kind==='energy'&&mode!=='vehicle')
  return {allowed:false,reason:'vehicle'};
 if(place.kind==='energy'&&(!Number.isFinite(speed)||Math.abs(speed)>3))
  return {allowed:false,reason:'moving'};
 return {allowed:true,reason:null,shop:place};
}
export function canSprint(raw){
 const s=restoreLiving(raw);
 return s.stamina>=12&&s.hunger>=10&&s.hydration>=10;
}
/** Effects update from actual time and distance; dt capped to prevent tab throttling exploits. */
export function advanceLiving(raw,dt,{distance=0,onFoot=false,moving=false,sprinting=false,carId=STARTER_ID}={}){
 const state=restoreLiving(raw),t=clip(dt,0,.15);
 const delta=clip(distance,0,100);
 const speedOnFoot=onFoot&&moving;
 const draining=speedOnFoot&&sprinting&&canSprint(state);
 const hunger=clip(state.hunger-t*(speedOnFoot?.016:.005)-delta*.00009,0,100);
 const hydration=clip(state.hydration-t*(speedOnFoot?.028:.009)-delta*.00011,0,100);
 const stamina=clip(state.stamina+
   t*(draining?-4.6:speedOnFoot?.46:1.45)-
   (hunger<10||hydration<10?t*.45:0),0,100);
 const fuel={...state.fuel};
 if(!onFoot&&fleetVehicle(carId))fuel[carId]=clip(fuel[carId]-delta*.013,0,100);
 return {...state,hunger,hydration,stamina,fuel,metres:clip(state.metres+delta,0,1e8)};
}
export function buyLivingItem(raw,shopId,itemId,credits,player){
 const state=restoreLiving(raw),product=lifeProduct(itemId),shop=lifeShop(shopId);
 if(!shop||!product||!product.shops.includes(shopId))
  return {state,balance:credits,reason:'unknown'};
 if(!isWallet(credits))return {state,balance:credits,reason:'wallet'};
 const access=shopAccess(shopId,player);
 if(!access.allowed)return {state,balance:credits,reason:access.reason};
 if(inventoryCount(state)>=24)return {state,balance:credits,reason:'capacity'};
 if((state.inventory[itemId]||0)>=12)return {state,balance:credits,reason:'capacity'};
 if(credits<product.price)return {state,balance:credits,reason:'funds'};
 return {
  state:{...state,inventory:{...state.inventory,[itemId]:(state.inventory[itemId]||0)+1},
   spent:state.spent+product.price,purchases:state.purchases+1},
  balance:credits-product.price,reason:null,cost:product.price,product
 };
}
export function consumeLivingItem(raw,itemId){
 const state=restoreLiving(raw),product=lifeProduct(itemId);
 if(!product||!(state.inventory[itemId]>0))return {state,reason:'missing'};
 const inventory={...state.inventory};
 if(inventory[itemId]===1)delete inventory[itemId];
 else inventory[itemId]--;
 return {state:{...state,inventory,
  hunger:clip(state.hunger+product.hunger,0,100),
  hydration:clip(state.hydration+product.hydration,0,100),
  stamina:clip(state.stamina+product.stamina,0,100),
  consumed:state.consumed+1},reason:null,product};
}
export function energyProduct(carId){
 return fleetVehicle(carId)?.body==='electric'
  ?{id:'charge',name:'电动快充 25%',price:110,amount:25,kind:'electric'}
  :{id:'petrol',name:'燃油补给 25%',price:140,amount:25,kind:'fuel'};
}
export function refuelVehicle(raw,credits,carId,player){
 const state=restoreLiving(raw),item=energyProduct(carId);
 if(!fleetVehicle(carId))return {state,balance:credits,reason:'unknown'};
 if(!isWallet(credits))return {state,balance:credits,reason:'wallet'};
 const access=shopAccess('station',player);
 if(!access.allowed)return {state,balance:credits,reason:access.reason};
 const fuel=state.fuel[carId];
 if(fuel>=99.5)return {state,balance:credits,reason:'full'};
 const unit=Math.min(item.amount,100-fuel),cost=Math.ceil(item.price*unit/item.amount);
 if(credits<cost)return {state,balance:credits,reason:'funds',cost};
 return {state:{...state,fuel:{...state.fuel,[carId]:clip(fuel+unit,0,100)},
  spent:state.spent+cost,purchases:state.purchases+1},
  balance:credits-cost,reason:null,cost,item};
}
export function livingIndicators(raw,carId=STARTER_ID){
 const s=restoreLiving(raw);
 return {hunger:Math.round(s.hunger),hydration:Math.round(s.hydration),
  stamina:Math.round(s.stamina),fuel:Math.round(s.fuel[carId]??100),
  fuelUnit:fleetVehicle(carId)?.body==='electric'?'电量':'燃油',
  carrying:inventoryCount(s)};
}
