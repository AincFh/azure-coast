/**
 * AZURE COAST / living residents
 * Deterministic simulation and social interactions. Independent of Three.js,
 * DOM and storage, so the exact same logic runs in Node and browsers.
 */
import {signalIsGreen} from './traffic-core.mjs';
export const CITIZEN_VERSION=1;
export const CITIZEN_COUNT=84;
export const TALK_RADIUS=7;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const hash=(id,seed=0)=>{
 let n=Math.imul((id|0)+349,374761393)^Math.imul((seed|0)+193,668265263);
 n=Math.imul(n^(n>>>13),1274126177);
 return ((n^(n>>>16))>>>0)/4294967296;
};
const NAMES=['许澄','林夏','顾岚','陈野','何沐','沈淮','叶舟','温禾','陆扬','苏禾','江宁','周予','邵庭','余晚','丁遥','任南','梁郁','方隐','段岚','秦珂','程秋','徐黎','唐安','宋知','潘舟','柯青','夏棠','韩景'];
const PROFESSIONS=['码头调度员','咖啡师','设计师','出租车司机','园艺师','维修师','研究生','摄影师','餐厅主厨','图书管理员','海岸巡护员','邮政员'];
const TRAITS=['健谈','谨慎','活泼','安静','好奇','乐观'];
export const CONVERSATION_TOPICS=Object.freeze([
 Object.freeze({id:'greeting',label:'打招呼'}),
 Object.freeze({id:'neighborhood',label:'附近有什么'}),
 Object.freeze({id:'profession',label:'聊聊工作'}),
 Object.freeze({id:'weather',label:'天气与出行'}),
 Object.freeze({id:'city',label:'城市生活'})
]);
const names=new Set(CONVERSATION_TOPICS.map(x=>x.id));
const point=(p)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
export function districtOf(x,z){
 if(z < -260)return x>80?'滨海码头':'旧港区';
 if(z>210)return x<0?'海岸高地':'北部新城';
 if(x>220)return '东部生活区';
 if(x< -220)return '西岸社区';
 return '市中心';
}
export function residentById(id,count=CITIZEN_COUNT){
 return Number.isInteger(id)&&id>=0&&id<count?createCitizen(id):null;
}
function perimeterPoint(bx,bz,progress){
 const length=72,p=((progress%288)+288)%288,x=bx*100+14,z=bz*100+14;
 if(p<length)return {x:x+p,z,heading:Math.PI/2};
 if(p<length*2)return {x:x+72,z:z+p-72,heading:0};
 if(p<length*3)return {x:x+72-(p-144),z:z+72,heading:-Math.PI/2};
 return {x,z:z+72-(p-216),heading:Math.PI};
}
export function createCitizen(id){
 if(!Number.isInteger(id)||id<0||id>=CITIZEN_COUNT)throw new RangeError('invalid-citizen');
 let bx,bz;
 if(id<36){bx=id%3-1;bz=Math.floor(id/3)%3-1}
 else {bx=Math.floor(hash(id,1)*11)-5;bz=Math.floor(hash(id,2)*11)-5}
 const crossing=id%9===0&&id!==0;
 const offset=id===4?0:hash(id,11)*288;
 const side=id%2?1:-1;
 const crossingAxis=id%3===0?'x':'z';
 const crossRoadX=bx*100,crossRoadZ=bz*100;
 const crossPosition=crossingAxis==='x'
  ?{x:crossRoadX+side*14,z:crossRoadZ+15}
  :{x:crossRoadX+15,z:crossRoadZ+side*14};
 const path=perimeterPoint(bx,bz,offset);
 return {
  id,name:NAMES[id%NAMES.length],profession:PROFESSIONS[(id*7)%PROFESSIONS.length],
  trait:TRAITS[(id*11)%TRAITS.length],district:districtOf(bx*100+50,bz*100+50),
  genderVariant:id%3,look:Math.floor(hash(id,29)*6),blockX:bx,blockZ:bz,
  type:crossing?'crossing':'sidewalk',crossingAxis,side,
  pathOffset:offset,distance:0,
  x:crossing?crossPosition.x:path.x,z:crossing?crossPosition.z:path.z,
  heading:crossing?crossingAxis==='x'?side>0?Math.PI/2:-Math.PI/2:side>0?0:Math.PI:path.heading,
  phase:crossing?'waiting':'walking',progress:0,wait:0,visible:true,walk:0,speed:0
 };
}
export function createCitizens(count=CITIZEN_COUNT){
 const n=clamp(Number.isFinite(count)?Math.floor(count):0,0,CITIZEN_COUNT);
 return Array.from({length:n},(_,id)=>createCitizen(id));
}
function nearbyVehicle(x,z,traffic,radius=7){
 return Array.isArray(traffic)&&traffic.some(p=>point(p)&&Math.hypot(p.x-x,p.z-z)<radius);
}
/**
 * Crosswalks use the perpendicular traffic phase; walking across the x=0
 * north-south lane is allowed when east-west cars have green.
 * A pedestrian already on the crossing completes their crossing rather than
 * abruptly freezing in the centre after a signal switch.
 */
export function pedestrianCrossingCanStart(agent,timeSeconds,traffic=[]){
 if(agent.type!=='crossing')return false;
 if(nearbyVehicle(agent.x,agent.z,traffic,12))return false;
 const axis=agent.crossingAxis;
 const cross=axis==='x'?agent.blockX:agent.blockZ;
 const perpendicular=axis==='x'?'x':'z';
 return signalIsGreen(perpendicular,agent.blockX,agent.blockZ,timeSeconds);
}
export function tickCitizens(previous,dt,seconds,{
 hour=16,weather='clear',traffic=[],player=null
}={}){
 const step=clamp(Number.isFinite(dt)?dt:0,0,.1),time=Number.isFinite(seconds)?seconds:0;
 if(!step)return previous.map(x=>({...x}));
 return previous.map(agent=>{
  const a={...agent},late=hour>=23||hour<5;
  const present=!late||a.id%5===0||a.profession==='出租车司机';
  if(!present){a.visible=false;a.speed=0;a.walk=0;return a}
  a.visible=true;
  const rush=(hour>=7&&hour<=9)||(hour>=17&&hour<=19);
  const pace=(.9+hash(a.id,8)*.65)*(rush?1.25:late?.72:1);
  const shelter=weather==='rain'&&a.id%6===1;
  const nearPlayerCar=player?.mode==='vehicle'&&point(player.position)&&
   Math.hypot(a.x-player.position.x,a.z-player.position.z)<7;
  if(a.type==='crossing'){
   if(a.phase==='waiting'){
    a.speed=0;a.walk=0;a.wait+=step;
    if(a.wait>=.9&&!shelter&&!nearPlayerCar&&pedestrianCrossingCanStart(a,time,traffic)){
     a.phase='crossing';a.wait=0;
    }
    return a;
   }
   if(a.phase==='crossing'){
    const distance=28*clamp(a.progress,0,1);
    const roadX=a.blockX*100,roadZ=a.blockZ*100;
    const x=a.crossingAxis==='x'?roadX+a.side*(14-distance):roadX+15;
    const z=a.crossingAxis==='z'?roadZ+a.side*(14-distance):roadZ+15;
    if(nearbyVehicle(x,z,traffic,4.5)){a.speed=0;a.walk=0;return a}
    a.progress=Math.min(1,a.progress+pace*step/28);
    const p=28*a.progress;
    a.x=a.crossingAxis==='x'?roadX+a.side*(14-p):roadX+15;
    a.z=a.crossingAxis==='z'?roadZ+a.side*(14-p):roadZ+15;
    a.heading=a.crossingAxis==='x'?(a.side>0?-Math.PI/2:Math.PI/2):
      (a.side>0?Math.PI:0);
    a.speed=pace;a.walk+=pace*step;
    if(a.progress>=1){a.side*=-1;a.progress=0;a.phase='waiting';a.wait=0;a.speed=0}
    return a;
   }
  }
  if(shelter||nearPlayerCar){a.speed=0;a.walk=0;a.phase='sheltering';return a}
  a.phase='walking';a.speed=pace;
  a.distance=(a.distance+step*pace)%288;
  const p=perimeterPoint(a.blockX,a.blockZ,a.pathOffset+a.distance);
  a.x=p.x;a.z=p.z;a.heading=p.heading;a.walk+=pace*step;
  return a;
 });
}
export function nearestCitizen(agents,position,maxDistance=TALK_RADIUS){
 if(!point(position))return null;
 let selected=null,distance=maxDistance;
 for(const resident of agents){
  if(!resident.visible)continue;
  const d=Math.hypot(position.x-resident.x,position.z-resident.z);
  if(d<=distance){distance=d;selected=resident}
 }
 return selected?{resident:selected,distance}:null;
}
export function emptySocial(){
 return {version:CITIZEN_VERSION,met:[],relationships:{},conversations:0,insights:[]};
}
export function restoreSocial(raw){
 const first=emptySocial();
 if(!raw||typeof raw!=='object'||raw.version!==CITIZEN_VERSION)return first;
 const met=[...new Set((Array.isArray(raw.met)?raw.met:[])
  .filter(id=>Number.isInteger(id)&&id>=0&&id<CITIZEN_COUNT))].slice(0,CITIZEN_COUNT);
 const relationships={};
 for(const id of met){
  const value=raw.relationships?.[id];
  relationships[id]=Number.isInteger(value)?clamp(value,1,3):1;
 }
 const topics=new Set(CONVERSATION_TOPICS.map(x=>x.id));
 const insights=[...new Set((Array.isArray(raw.insights)?raw.insights:[])
  .filter(x=>typeof x==='string'&&x.length<80&&topics.has(x.split(':')[1])&&
   met.includes(Number(x.split(':')[0]))))].slice(0,128);
 return {...first,met,relationships,insights,
  conversations:Number.isInteger(raw.conversations)?clamp(raw.conversations,0,100000):0};
}
const tipLibrary={
 '市中心':['市民广场和车辆工坊都在中心道路附近。','市中心的广场适合认识新邻居，注意礼让行人。'],
 '旧港区':['旧港有需要步行交付的运输委托。','在旧港慢慢走，比开车更容易发现熟悉的面孔。'],
 '滨海码头':['码头地区交通繁忙，开车请留意路口信号。','天气晴朗时，码头的海风很适合散步。'],
 '海岸高地':['海岸高地适合徒步寻找观景点。','高地的道路较长，出发前检查车辆状况。'],
 '北部新城':['新城里有适合周末散步的街区。','想深入了解北部街区，可以多与居民交谈。'],
 '东部生活区':['东部生活区的建筑更密集，尽量从人行道通行。','在东部生活区停车后再处理城市事务。'],
 '西岸社区':['西岸社区的路口较安静，但仍应注意车辆。','沿街行走时，你会遇到更多居民。']
};
export function citizenReply(resident,topic,{hour=16,weather='clear',trust=1}={}){
 const district=resident.district;
 if(topic==='greeting')return trust>=3
  ?'又见面了！'+resident.name+'已经把你当成这片街区的熟人。'
  :hour>=20||hour<6?'晚上好，我是'+resident.name+'。夜里的'+district+'有另一种样子。'
  :'你好，我叫'+resident.name+'。欢迎来到'+district+'。';
 if(topic==='profession')return resident.name+'：我平时是'+resident.profession+
  '。'+(trust>=2?'多走走、多认识朋友，才能真正了解这座城市。':'每天在这里都会遇到不同的人。');
 if(topic==='weather')return weather==='rain'
  ?'今天下雨，路面会更湿滑。尽量避开车行道，走路也注意安全。'
  :weather==='overcast'?'云层压得很低，适合慢慢逛街，偶尔会起风。'
  :'天气不错，沿着海岸漫步应该很舒服。';
 if(topic==='neighborhood'){
  const tips=tipLibrary[district]||tipLibrary['市中心'];
  return resident.name+'：'+tips[trust>=2?1:0];
 }
 if(topic==='city')return trust>=2
  ?'这里不是只有商店和车。你会在雨天、清晨和深夜遇到不同的人，城市也有自己的节奏。'
  :'我最喜欢这里的街道。你多走几条路，也许会发现属于自己的故事。';
 return '';
}
/** Dialogue requires in-range, on-foot and actually present resident. No free money. */
export function talkToCitizen(raw,agent,topic,{
 position,mode='foot',hour=16,weather='clear'
}={}){
 const state=restoreSocial(raw);
 if(!agent||!Number.isInteger(agent.id)||agent.id<0||agent.id>=CITIZEN_COUNT)
  return {state,reason:'unknown',reply:''};
 if(!names.has(topic))return {state,reason:'topic',reply:''};
 if(mode!=='foot')return {state,reason:'mode',reply:''};
 if(!agent.visible)return {state,reason:'not-present',reply:''};
 if(!point(position)||Math.hypot(position.x-agent.x,position.z-agent.z)>TALK_RADIUS)
  return {state,reason:'distance',reply:''};
 const newPerson=!state.met.includes(agent.id);
 const met=newPerson?[...state.met,agent.id]:state.met;
 const trust=clamp((state.relationships[agent.id]||0)+1,1,3);
 const relationships={...state.relationships,[agent.id]:trust};
 const key=agent.id+':'+topic,insights=state.insights.includes(key)
  ?state.insights:[...state.insights,key].slice(-128);
 return {
  state:{...state,met,relationships,conversations:Math.min(100000,state.conversations+1),insights},
  reply:citizenReply(agent,topic,{hour,weather,trust}),
  reason:null,newPerson,trust,connections:met.length
 };
}
export function socialRank(raw){
 const n=restoreSocial(raw).met.length;
 return n>=25?'城市知己':n>=10?'街区常客':n>=5?'友好邻居':n>=1?'新朋友':'初来乍到';
}
