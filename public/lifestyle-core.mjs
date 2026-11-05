/**
 * AZURE COAST / daily living and food economy.
 * Pure gameplay systems: deterministic wallet purchases, pantry, recipes,
 * real preparation timers, nourishment, fatigue, resting and safe save data.
 * No browser, audio or 3D dependency.
 */
export const LIFESTYLE_VERSION=1;
const limit=(v,a,b)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):a;
const int=(v,max=9999)=>Number.isSafeInteger(v)&&v>=0?Math.min(v,max):0;
const immutable=items=>Object.freeze(items.map(x=>Object.freeze(x)));
export const LIFE_STORES=immutable([
 {id:'harbor-cafe',name:'海湾街角咖啡馆',category:'餐饮与食材',x:14,z:8,radius:18,
  products:['egg','milk','flour','tomato','cheese','greens','coffee','sandwich']},
 {id:'port-market',name:'旧港鲜味市场',category:'海鲜与杂货',x:-14,z:-90,radius:17,
  products:['fish','rice','greens','tomato','milk','sandwich']},
 {id:'sunset-grocer',name:'日落生活商店',category:'城市日用',x:114,z:14,radius:19,
  products:['flour','egg','rice','cheese','greens','milk','coffee','sandwich']},
 {id:'marina-food',name:'滨海轻食站',category:'轻餐与食材',x:14,z:-214,radius:18,
  products:['fish','rice','tomato','greens','coffee','sandwich']}
]);
export const INGREDIENTS=immutable([
 {id:'egg',name:'新鲜鸡蛋',price:35,unit:'枚'},
 {id:'milk',name:'鲜奶',price:45,unit:'盒'},
 {id:'flour',name:'面粉',price:55,unit:'袋'},
 {id:'tomato',name:'番茄',price:42,unit:'个'},
 {id:'cheese',name:'芝士',price:72,unit:'份'},
 {id:'greens',name:'叶菜',price:38,unit:'份'},
 {id:'rice',name:'米',price:60,unit:'份'},
 {id:'fish',name:'港湾鲜鱼',price:115,unit:'条'}
]);
export const READY_FOODS=immutable([
 {id:'coffee',name:'街角拿铁',price:85,hunger:7,energy:22},
 {id:'sandwich',name:'海岸三明治',price:195,hunger:28,energy:11}
]);
export const RECIPES=immutable([
 {id:'eggs',name:'芝士煎蛋',ingredients:{egg:2,cheese:1},duration:5000,hunger:31,energy:9,skill:0},
 {id:'soup',name:'番茄奶香汤',ingredients:{tomato:2,milk:1},duration:6000,hunger:35,energy:10,skill:0},
 {id:'rice-bowl',name:'街区炒饭',ingredients:{rice:2,egg:1,greens:1},duration:7000,hunger:45,energy:13,skill:2},
 {id:'pasta',name:'海岸意面',ingredients:{flour:2,tomato:1,cheese:1},duration:8000,hunger:49,energy:12,skill:3},
 {id:'fish-plate',name:'烤鱼时蔬',ingredients:{fish:2,greens:1},duration:9000,hunger:55,energy:16,skill:4},
 {id:'seafood-bake',name:'主厨海鲜焗饭',ingredients:{fish:2,rice:1,cheese:1,milk:1},duration:10000,hunger:64,energy:20,skill:8}
]);
const ingredients=new Map(INGREDIENTS.map(item=>[item.id,item]));
const ready=new Map(READY_FOODS.map(item=>[item.id,item]));
const recipes=new Map(RECIPES.map(item=>[item.id,item]));
const stores=new Map(LIFE_STORES.map(item=>[item.id,item]));
const allFoods=new Map([...READY_FOODS,...RECIPES].map(item=>[item.id,item]));
export const ingredientById=id=>ingredients.get(id)||null;
export const recipeById=id=>recipes.get(id)||null;
export const storeById=id=>stores.get(id)||null;
export const foodById=id=>allFoods.get(id)||null;
export const createLifestyle=()=>({
 version:LIFESTYLE_VERSION,hunger:86,energy:91,inventory:{},meals:{},
 cooking:null,prepared:0,spent:0,eaten:0,slept:0
});
const capItems=(raw,valid)=>Object.fromEntries(
 Object.entries(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{})
  .filter(([key,value])=>valid.has(key)&&Number.isSafeInteger(value)&&value>0)
  .map(([key,value])=>[key,Math.min(99,value)])
);
export function restoreLifestyle(raw){
 const base=createLifestyle();
 if(!raw||typeof raw!=='object'||raw.version!==LIFESTYLE_VERSION)return base;
 const inventory=capItems(raw.inventory,ingredients),meals=capItems(raw.meals,allFoods);
 const started=raw.cooking?.startedAt,readyAt=raw.cooking?.readyAt,recipe=recipes.get(raw.cooking?.recipeId);
 const validClock=Number.isSafeInteger(started)&&started>=0&&Number.isSafeInteger(readyAt)&&
  readyAt===started+recipe?.duration;
 const cooking=recipe&&validClock?{recipeId:recipe.id,startedAt:started,readyAt}:null;
 return {...base,
  hunger:Math.round(limit(raw.hunger,0,100)*10000)/10000,
  energy:Math.round(limit(raw.energy,0,100)*10000)/10000,
  inventory,meals,cooking,
  prepared:int(raw.prepared,100000),
  spent:int(raw.spent,1000000000),eaten:int(raw.eaten,100000),slept:int(raw.slept,100000)};
}
export function closestLifeStore(position,maxDistance=22){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
 let nearest=null,distance=maxDistance;
 for(const site of LIFE_STORES){
  const d=Math.hypot(position.x-site.x,position.z-site.z);
  if(d<=distance){nearest=site;distance=d}
 }
 return nearest?{site:nearest,distance}:null;
}
export function shopAccess(siteId,{position,mode}={}){
 const site=stores.get(siteId);
 if(!site)return {allowed:false,reason:'unknown'};
 if(mode!=='foot')return {allowed:false,reason:'mode'};
 if(!position||![position.x,position.z].every(Number.isFinite))return {allowed:false,reason:'position'};
 if(Math.hypot(position.x-site.x,position.z-site.z)>site.radius)
  return {allowed:false,reason:'distance'};
 return {allowed:true,reason:null};
}
export function buyFood(raw,siteId,itemId,qty,balance,player){
 const state=restoreLifestyle(raw),site=stores.get(siteId);
 if(!site)return {state,balance,reason:'unknown'};
 const access=shopAccess(siteId,player);
 if(!access.allowed)return {state,balance,reason:access.reason};
 if(!Number.isSafeInteger(balance)||balance<0)return {state,balance,reason:'wallet'};
 const item=ingredients.get(itemId)||ready.get(itemId);
 if(!item||!site.products.includes(itemId))return {state,balance,reason:'not-stocked'};
 if(!Number.isInteger(qty)||qty<1||qty>10)return {state,balance,reason:'quantity'};
 const container=ingredients.has(itemId)?'inventory':'meals',have=state[container][itemId]||0;
 if(have+qty>99)return {state,balance,reason:'capacity'};
 const cost=item.price*qty;
 if(balance<cost)return {state,balance,reason:'funds',cost};
 return {state:{...state,
  [container]:{...state[container],[itemId]:have+qty},
  spent:Math.min(1000000000,state.spent+cost)
 },balance:balance-cost,cost,reason:null,item,quantity:qty};
}
export function cookAccess({inside=false,decorating=false}={}){
 return inside&&!decorating?{allowed:true,reason:null}:
  {allowed:false,reason:inside?'busy':'not-home'};
}
export function startCooking(raw,recipeId,{inside=false,decorating=false,now=Date.now()}={}){
 const state=restoreLifestyle(raw),recipe=recipes.get(recipeId);
 if(!recipe)return {state,reason:'recipe'};
 const access=cookAccess({inside,decorating});
 if(!access.allowed)return {state,reason:access.reason};
 if(!Number.isSafeInteger(now)||now<0)return {state,reason:'clock'};
 if(state.cooking)return {state,reason:'already-cooking'};
 if(state.prepared<recipe.skill)return {state,reason:'skill',required:recipe.skill};
 for(const [id,required] of Object.entries(recipe.ingredients))
  if((state.inventory[id]||0)<required)return {state,reason:'ingredients',missing:id};
 const inventory={...state.inventory};
 for(const [id,required] of Object.entries(recipe.ingredients)){
  inventory[id]-=required;
  if(inventory[id]===0)delete inventory[id];
 }
 return {state:{...state,inventory,
  cooking:{recipeId:recipe.id,startedAt:now,readyAt:now+recipe.duration}},
  reason:null,readyAt:now+recipe.duration,recipe};
}
export function finishCooking(raw,{inside=false,decorating=false,now=Date.now()}={}){
 const state=restoreLifestyle(raw),access=cookAccess({inside,decorating});
 if(!access.allowed)return {state,reason:access.reason};
 if(!state.cooking)return {state,reason:'idle'};
 if(!Number.isSafeInteger(now)||now<state.cooking.readyAt)
  return {state,reason:'not-ready',remaining:state.cooking.readyAt-now};
 const recipe=recipes.get(state.cooking.recipeId);
 const have=state.meals[recipe.id]||0;
 if(have>=99)return {state,reason:'capacity'};
 return {state:{...state,meals:{...state.meals,[recipe.id]:have+1},
  cooking:null,prepared:Math.min(100000,state.prepared+1)},
  reason:null,recipe};
}
export function eatFood(raw,foodId,{active=true}={}){
 const state=restoreLifestyle(raw),meal=allFoods.get(foodId);
 if(!meal)return {state,reason:'unknown'};
 if(!active)return {state,reason:'inactive'};
 if(!(state.meals[foodId]>0))return {state,reason:'missing'};
 const remaining=state.meals[foodId]-1,meals={...state.meals};
 if(remaining)meals[foodId]=remaining;else delete meals[foodId];
 return {state:{...state,meals,
  hunger:Math.min(100,Math.round((state.hunger+meal.hunger)*100)/100),
  energy:Math.min(100,Math.round((state.energy+meal.energy)*100)/100),
  eaten:Math.min(100000,state.eaten+1)},reason:null,meal};
}
export function restAtHome(raw,{inside=false,furniture=[]}={}){
 const state=restoreLifestyle(raw);
 if(!inside)return {state,reason:'not-home'};
 if(!Array.isArray(furniture)||!furniture.some(x=>x.item==='bed'||x.item==='sofa'))
  return {state,reason:'no-bed'};
 return {state:{...state,
  energy:100,hunger:Math.round(Math.max(0,state.hunger-7)*100)/100,
  slept:Math.min(100000,state.slept+1)},reason:null,hours:8};
}
/** Non-punitive needs: fatigue affects only walking pace, not car speed. */
export function tickLifestyle(raw,dt,{active=true,onFoot=false,sprinting=false}={}){
 const state=restoreLifestyle(raw);
 if(!active)return state;
 const time=limit(dt,0,2);
 if(!time)return state;
 const hungerLoss=time*(onFoot?(sprinting?.026:.014):.006);
 const energyLoss=time*(onFoot?(sprinting?.052:.019):.004);
 return {...state,hunger:Math.max(0,Math.round((state.hunger-hungerLoss)*10000)/10000),
  energy:Math.max(0,Math.round((state.energy-energyLoss)*10000)/10000)};
}
export function walkingPace(raw){
 const {hunger,energy}=restoreLifestyle(raw);
 return energy<12?.62:energy<28?.82:hunger<12?.88:1;
}
export function cookingRank(raw){
 const n=restoreLifestyle(raw).prepared;
 return n>=25?'海岸料理大师':n>=10?'熟练主厨':n>=4?'家常料理师':n>=1?'料理学徒':'厨房新手';
}
