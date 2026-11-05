/**
 * AZURE COAST — repeatable city services.
 * Pure progression engine. UI, 3D, save storage and wallet are adapters.
 * The same state machine runs for walking and driving contracts.
 */
export const ACTIVITY_VERSION=1;
export const ACTIVITY_KEY='azure-coast-city-services-v1';
export const DISPATCH={x:14,z:20};
const step=(id,title,x,z,mode='foot',radius=15)=>Object.freeze({id,title,x,z,mode,radius});
export const CITY_CONTRACTS=Object.freeze([
  Object.freeze({
    id:'courier',title:'海岸运送',category:'物流配送',reward:2100,
    description:'在海湾接取加急包裹，驾驶穿城，步行交付给码头收件人。',
    steps:Object.freeze([
      step('collect','海湾收件点 · 下车领取包裹',0,-100,'foot',16),
      step('deliver','旧港码头 · 下车交付包裹',-300,-300,'foot',16)
    ])
  }),
  Object.freeze({
    id:'taxi',title:'夜航接驳',category:'城市出行',reward:3200,
    description:'驾驶到乘车点，低速停稳接客，再将乘客安全送至市中心。',
    steps:Object.freeze([
      step('board','滨海大道 · 停稳接乘客',100,-300,'vehicle',17),
      step('arrive','市中心 · 停稳送乘客',300,200,'vehicle',17)
    ])
  }),
  Object.freeze({
    id:'survey',title:'海岸巡访',category:'城市探索',reward:3900,
    description:'抵达两处沿海观景点，走出车辆完成实地巡访。',
    steps:Object.freeze([
      step('vista','山崖观景区 · 徒步签到',-300,300,'foot',19),
      step('beacon','旧海岸灯塔 · 徒步签到',-400,-400,'foot',19)
    ])
  })
]);
const contracts=new Map(CITY_CONTRACTS.map(c=>[c.id,c]));
const bounded=(n,max=1e9)=>Number.isFinite(n)?Math.max(0,Math.min(max,Math.floor(n))):0;
export function contractById(id){return contracts.get(id)||null}
export function emptyActivities(){return {version:ACTIVITY_VERSION,status:'idle',id:null,index:0,completed:{},earned:0,history:[]}}
export function restoreActivities(raw){
  const fallback=emptyActivities();
  if(!raw||typeof raw!=='object'||raw.version!==ACTIVITY_VERSION)return fallback;
  const completed={};
  for(const c of CITY_CONTRACTS)completed[c.id]=bounded(raw.completed?.[c.id],10000);
  const history=Array.isArray(raw.history)?raw.history.filter(id=>typeof id==='string'&&contracts.has(id)).slice(-12):[];
  const contract=contractById(raw.id);
  const active=contract&&raw.status==='active';
  const index=active&&Number.isInteger(raw.index)?Math.max(0,Math.min(contract.steps.length-1,raw.index)):0;
  return {version:ACTIVITY_VERSION,status:active?'active':'idle',id:active?contract.id:null,
    index,completed,earned:bounded(raw.earned),history};
}
export function currentActivity(state){
 const safe=restoreActivities(state);
 return safe.status==='active'?contractById(safe.id):null;
}
export function currentStep(state){
 const active=currentActivity(state);
 return active?active.steps[restoreActivities(state).index]:null;
}
export function startActivity(state,id){
 const safe=restoreActivities(state),next=contractById(id);
 if(!next)return {state:safe,reason:'unknown'};
 if(safe.status==='active')return {state:safe,reason:'busy'};
 return {state:{...safe,status:'active',id:next.id,index:0},reason:null};
}
export function cancelActivity(state){
 const safe=restoreActivities(state);
 if(safe.status!=='active')return {state:safe,cancelled:false};
 return {state:{...safe,status:'idle',id:null,index:0},cancelled:true};
}
export function distanceToActivity(state,position){
 const target=currentStep(state);
 if(!target||!position||![position.x,position.z].every(Number.isFinite))return Infinity;
 return Math.hypot(position.x-target.x,position.z-target.z);
}
/**
 * Explicit interaction is required for every checkpoint.
 * Repeated calls after the final step cannot pay a second reward.
 */
export function interactActivity(state,{position,mode,speed=0}={}){
 const safe=restoreActivities(state),contract=currentActivity(safe);
 if(!contract)return {state:safe,reason:'idle',event:null,reward:0};
 const goal=contract.steps[safe.index];
 if(!position||![position.x,position.z].every(Number.isFinite))
  return {state:safe,reason:'position',event:null,reward:0};
 if(mode!==goal.mode)return {state:safe,reason:'mode',event:null,reward:0};
 if(goal.mode==='vehicle'&&(!Number.isFinite(speed)||Math.abs(speed)>3))
  return {state:safe,reason:'moving',event:null,reward:0};
 if(Math.hypot(goal.x-position.x,goal.z-position.z)>goal.radius)
  return {state:safe,reason:'far',event:null,reward:0};
 const nextIndex=safe.index+1;
 if(nextIndex<contract.steps.length)
  return {state:{...safe,index:nextIndex},reason:null,event:'checkpoint',reward:0,step:goal};
 const count=bounded(safe.completed[contract.id],10000);
 return {
  state:{...safe,status:'idle',id:null,index:0,completed:{...safe.completed,[contract.id]:Math.min(10000,count+1)},
    earned:bounded(safe.earned+contract.reward),history:[...safe.history,contract.id].slice(-12)},
  event:'completed',reward:contract.reward,reason:null,step:goal,contract
 };
}
export function interactionPrompt(state,position,mode,speed=0){
 const contract=currentActivity(state),goal=currentStep(state);
 if(!contract||!goal)return null;
 const distance=distanceToActivity(state,position);
 if(distance>goal.radius+6)return null;
 if(goal.mode!==mode)return goal.mode==='foot'?'先下车靠近目标':'先驾驶车辆靠近目标';
 if(goal.mode==='vehicle'&&Math.abs(speed)>3)return '停车后按 F 继续';
 return '按 F · '+goal.title;
}
