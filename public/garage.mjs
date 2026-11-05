/** AZURE COAST — persistent garage tuning tied to the existing driving wallet. */
export const GARAGE_VERSION=1;
export const GARAGE_LOCATION=Object.freeze({x:-14,z:10});
export const UPGRADE_CATALOG=Object.freeze([
 Object.freeze({id:'engine',name:'动力系统',description:'提升加速效率与最高车速。',
  prices:Object.freeze([1800,4200,8100])}),
 Object.freeze({id:'handling',name:'底盘与转向',description:'提升车辆高速转向响应。',
  prices:Object.freeze([1500,3700,7200])}),
 Object.freeze({id:'armor',name:'车体防护',description:'减少撞击后受到的车辆损伤。',
  prices:Object.freeze([1300,3100,6100])})
]);
export const PAINT_FINISHES=Object.freeze([
 Object.freeze({id:'sand',label:'香槟沙金',hex:0xdcb282,price:0}),
 Object.freeze({id:'ocean',label:'深海蓝',hex:0x296e87,price:950}),
 Object.freeze({id:'pearl',label:'珍珠白',hex:0xe1e5de,price:950}),
 Object.freeze({id:'copper',label:'落日铜',hex:0xa4583e,price:950}),
 Object.freeze({id:'carbon',label:'石墨灰',hex:0x3b4750,price:950})
]);
const upgradeById=new Map(UPGRADE_CATALOG.map(item=>[item.id,item]));
const paintById=new Map(PAINT_FINISHES.map(item=>[item.id,item]));
const clampLevel=value=>Number.isInteger(value)?Math.max(0,Math.min(3,value)):0;
export const createGarage=()=>({version:GARAGE_VERSION,engine:0,handling:0,armor:0,paint:'sand',spent:0,purchases:0});
export function restoreGarage(raw){
 const base=createGarage();
 if(!raw||typeof raw!=='object'||raw.version!==GARAGE_VERSION)return base;
 return {
  ...base,
  engine:clampLevel(raw.engine),
  handling:clampLevel(raw.handling),
  armor:clampLevel(raw.armor),
  paint:paintById.has(raw.paint)?raw.paint:'sand',
  spent:Number.isSafeInteger(raw.spent)&&raw.spent>=0?Math.min(raw.spent,1e9):0,
  purchases:Number.isInteger(raw.purchases)&&raw.purchases>=0?Math.min(raw.purchases,10000):0
 };
}
export function upgradePrice(state,id){
 const spec=upgradeById.get(id);if(!spec)return null;
 const level=restoreGarage(state)[id];
 return level>=3?null:spec.prices[level];
}
export function garageTuning(raw){
 const state=restoreGarage(raw);
 return {
  acceleration:1+state.engine*.17,
  maxSpeed:49+state.engine*5,
  steering:1+state.handling*.13,
  impactFactor:Math.max(.45,1-state.armor*.16),
  paintHex:paintById.get(state.paint).hex
 };
}
/** Pure debit: caller saves vehicle wallet and garage result to one driving JSON record. */
export function buyGarageItem(raw,kind,id,credits){
 const state=restoreGarage(raw);
 if(!Number.isSafeInteger(credits)||credits<0)return {state,balance:credits,reason:'wallet'};
 let cost,updated;
 if(kind==='upgrade'){
  const spec=upgradeById.get(id);
  if(!spec)return {state,balance:credits,reason:'unknown'};
  cost=upgradePrice(state,id);
  if(cost===null)return {state,balance:credits,reason:'max'};
  updated={...state,[id]:state[id]+1};
 }else if(kind==='paint'){
  const finish=paintById.get(id);
  if(!finish)return {state,balance:credits,reason:'unknown'};
  if(state.paint===id)return {state,balance:credits,reason:'owned'};
  cost=finish.price;
  updated={...state,paint:id};
 }else return {state,balance:credits,reason:'unknown'};
 if(credits<cost)return {state,balance:credits,reason:'funds',cost};
 return {state:{...updated,spent:state.spent+cost,purchases:state.purchases+1},
  balance:credits-cost,reason:null,cost,kind,id};
}
export function garageAccess({position,speed}={}){
 if(!position||![position.x,position.z].every(Number.isFinite))return {allowed:false,reason:'location'};
 if(Math.hypot(position.x-GARAGE_LOCATION.x,position.z-GARAGE_LOCATION.z)>23)
  return {allowed:false,reason:'distance'};
 if(!Number.isFinite(speed)||Math.abs(speed)>3)
  return {allowed:false,reason:'moving'};
 return {allowed:true,reason:null};
}
