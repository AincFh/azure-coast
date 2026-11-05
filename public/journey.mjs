/** Shared, renderer-independent itinerary contract for Explore and Drive. */
import {SHOPS} from './living-core.mjs';
export const PLANNER_KEY='azure-coast-route-v2';
export const JOURNEY_KEY='azure-coast-active-journey-v1';
export const JOURNEY_VERSION=1;
export const ARRIVAL_RADIUS=22;

// All stops are on the playable road grid. Positions are world-space metres.
export const CITY_STOPS=Object.freeze([
  {id:'bay',name:'海湾中心',x:0,z:-500,accent:'#79e4d3'},
  {id:'marina',name:'游艇码头',x:-300,z:-300,accent:'#89c9f5'},
  {id:'palms',name:'棕榈海岸',x:-500,z:-200,accent:'#eac38d'},
  {id:'cliff',name:'日落山崖',x:500,z:-500,accent:'#e2be96'},
  {id:'harbor',name:'工业港湾',x:500,z:400,accent:'#b8c2d5'},
  {id:'oldtown',name:'旧城艺术区',x:100,z:300,accent:'#dfb7d5'},
  // All roadside energy sites are real playable shops, not fabricated map pins.
  ...SHOPS.filter(s=>s.kind==='energy').map(s=>Object.freeze({
   id:'fuel-'+s.id,name:s.name,x:s.x,z:s.z,accent:'#b5eacb'
  }))
]);
const byId=new Map(CITY_STOPS.map(stop=>[stop.id,stop]));
export function stopById(id){return byId.get(id)||null}
export function cleanStops(ids){
  if(!Array.isArray(ids))return [];
  return [...new Set(ids.filter(id=>typeof id==='string'&&byId.has(id)))].slice(0,CITY_STOPS.length);
}
export function loadPlannedStops(raw){return cleanStops(raw&&typeof raw==='object'?raw.stops:null)}
export function createJourney(ids){
  const stops=cleanStops(ids);
  return {version:JOURNEY_VERSION,stops,index:0,status:stops.length?'active':'idle'};
}
export function restoreJourney(raw){
  if(!raw||raw.version!==JOURNEY_VERSION||!Array.isArray(raw.stops))return createJourney([]);
  const stops=cleanStops(raw.stops);
  const index=Number.isInteger(raw.index)?Math.max(0,Math.min(stops.length,raw.index)):0;
  const status=stops.length===0?'idle':index===stops.length?'complete':raw.status==='cancelled'?'cancelled':'active';
  return {version:JOURNEY_VERSION,stops,index,status};
}
export function nextJourneyStop(journey){return journey.status==='active'?stopById(journey.stops[journey.index]):null}
export function progressJourney(journey,position,radius=ARRIVAL_RADIUS){
  const target=nextJourneyStop(journey);
  if(!target||!position||![position.x,position.z].every(Number.isFinite))return {journey,arrived:null};
  if(Math.hypot(position.x-target.x,position.z-target.z)>radius)return {journey,arrived:null};
  const index=journey.index+1;
  return {journey:{...journey,index,status:index===journey.stops.length?'complete':'active'},arrived:target};
}
export function cancelJourney(journey){return {...restoreJourney(journey),status:'cancelled'}}
export function distanceToStop(point,stop){return stop&&point?Math.hypot(point.x-stop.x,point.z-stop.z):0}
const snap=(v,grid)=>Math.round(v/grid)*grid;
const same=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z)<.001;
/** A road-centerline polyline, never a diagonal line through a city block. */
export function roadRoute(start,end,grid=100){
  if(!start||!end||![start.x,start.z,end.x,end.z].every(Number.isFinite))return [];
  const origin={x:start.x,z:start.z},destination={x:end.x,z:end.z};
  const project=(p)=>{
    const sx=snap(p.x,grid),sz=snap(p.z,grid);
    return Math.abs(p.x-sx)<=Math.abs(p.z-sz)
      ?{anchor:{x:sx,z:p.z},junction:{x:sx,z:sz},axis:'vertical'}
      :{anchor:{x:p.x,z:sz},junction:{x:sx,z:sz},axis:'horizontal'};
  };
  const from=project(origin),to=project(destination);
  const bend=from.axis==='vertical'
    ?{x:from.junction.x,z:to.junction.z}
    :{x:to.junction.x,z:from.junction.z};
  const route=[origin,from.anchor,from.junction,bend,to.junction,to.anchor,destination];
  return route.filter((p,i)=>i===0||!same(p,route[i-1]));
}
export function polylineDistance(points){
  let d=0;for(let i=1;i<points.length;i++)d+=distanceToStop(points[i-1],points[i]);return d;
}
export function headingCue(heading,from,to){
  if(!to)return '已到达';
  const desired=Math.atan2(-(to.x-from.x),-(to.z-from.z));
  const diff=Math.atan2(Math.sin(desired-heading),Math.cos(desired-heading));
  if(Math.abs(diff)>2.45)return '掉头';
  if(diff>.55)return '左转';
  if(diff<-.55)return '右转';
  return '直行';
}
export function navigationHint(player,heading,target){
  if(!target)return {instruction:'未设置目的地',distance:0,roadDistance:0,path:[]};
  const path=roadRoute(player,target);
  const next=path.slice(1).find(p=>distanceToStop(player,p)>7)||target;
  return {instruction:headingCue(heading,player,next),distance:Math.round(distanceToStop(player,target)),roadDistance:Math.round(polylineDistance(path)),path};
}
