import {CITY_STOPS,PLANNER_KEY,JOURNEY_KEY,loadPlannedStops,createJourney,restoreJourney,progressJourney,nextJourneyStop,cancelJourney,navigationHint,distanceToStop} from './journey.mjs';
import {drawCityMap,nearestMapStop} from './journey-map.mjs';

/** DOM adapter; game simulation and mission rewards stay independent of the itinerary. */
export function setupJourneyUI({doc=document,storage=window.localStorage,getPosition,getHeading,onMapOpen=()=>{},notify=()=>{}}){
 const $=(id)=>doc.getElementById(id);
 const map=$('mapOverlay'),canvas=$('cityMap'),ctx=canvas.getContext('2d');
 const nav=$('navStatus');
 const load=(key)=>{try{return JSON.parse(storage.getItem(key)||'null')}catch{return null}};
 const store=()=>{try{storage.setItem(JOURNEY_KEY,JSON.stringify(journey))}catch{}};
 const planned=()=>loadPlannedStops(load(PLANNER_KEY));
 let journey=restoreJourney(load(JOURNEY_KEY)),hits=[],open=false,lastUpdate=0;
 function updateUI(){
  const target=nextJourneyStop(journey),position=getPosition();
  nav.hidden=!target;
  if(target){
   const hint=navigationHint(position,getHeading(),target);
   $('navDestination').textContent=target.name;
   $('navCue').textContent=hint.instruction;
   $('navDistance').textContent=`${hint.roadDistance.toLocaleString('zh-CN')} m`;
   $('navProgress').textContent=`第 ${journey.index+1} / ${journey.stops.length} 站 · 直线距离 ${hint.distance} m`;
  }
  const activeLabel=journey.status==='active'?`进行中 · ${journey.index+1}/${journey.stops.length} 站`:
    journey.status==='complete'?`行程完成 · ${journey.stops.length} 站`:
    journey.status==='cancelled'?'当前导航已结束':
    planned().length?`已规划 ${planned().length} 站 · 尚未开始`:'尚未规划行程';
  $('mapJourneyState').textContent=activeLabel;
  $('mapLocation').textContent=`X ${Math.round(position.x)} · Z ${Math.round(position.z)}`;
  $('mapStartJourney').disabled=!planned().length;
  $('mapStartJourney').textContent=planned().length?`开始规划路线 · ${planned().length} 站`:'暂无规划路线';
  $('mapStopList').innerHTML=CITY_STOPS.map(stop=>{
   const active=target?.id===stop.id;
   const distance=Math.round(distanceToStop(position,stop));
   return `<button type="button" data-stop-id="${stop.id}" class="${active?'active':''}" aria-label="导航到${stop.name}"><span class="map-stop-icon" style="--stop-color:${stop.accent}"></span><span><strong>${stop.name}</strong><small>${distance} m · 点击单点导航</small></span></button>`;
  }).join('');
 }
 function draw(){
  if(!open)return;
  const r=canvas.getBoundingClientRect();
  if(r.width<1||r.height<1)return;
  const dpr=Math.min(doc.defaultView?.devicePixelRatio||1,2);
  const w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  const targets=journey.stops.map(id=>CITY_STOPS.find(p=>p.id===id)).filter(Boolean);
  hits=drawCityMap(ctx,canvas.width,canvas.height,{
   player:getPosition(),heading:getHeading(),target:nextJourneyStop(journey),stops:targets,stage:journey.index
  });
 }
 function start(ids){
  journey=createJourney(ids);store();updateUI();draw();
  if(journey.status==='active')notify(`导航已设置 · 共 ${journey.stops.length} 个目的地`);
 }
 function setMapOpen(value){
  open=!!value;map.hidden=!open;onMapOpen(open);
  if(open){updateUI();draw();$('mapClose').focus()}
  else $('mapBtn').focus();
 }
 $('mapBtn').addEventListener('click',()=>setMapOpen(!open));
 $('navMapBtn').addEventListener('click',()=>setMapOpen(true));
 $('mapClose').addEventListener('click',()=>setMapOpen(false));
 $('mapCancelJourney').addEventListener('click',()=>{journey=cancelJourney(journey);store();updateUI();draw();notify('当前导航已结束')});
 $('mapStartJourney').addEventListener('click',()=>start(planned()));
 $('mapStopList').addEventListener('click',e=>{
  const button=e.target.closest('button[data-stop-id]');if(button)start([button.dataset.stopId]);
 });
 canvas.addEventListener('click',e=>{
  const rect=canvas.getBoundingClientRect();
  const x=(e.clientX-rect.left)/rect.width*canvas.width,y=(e.clientY-rect.top)/rect.height*canvas.height;
  const id=nearestMapStop(hits,x,y,Math.max(22,canvas.width/36));if(id)start([id]);
 });
 doc.defaultView?.addEventListener('resize',draw);
 updateUI();
 return {
  currentTarget:()=>nextJourneyStop(journey),
  isOpen:()=>open,
  toggleMap:()=>setMapOpen(!open),
  closeMap:()=>{if(open)setMapOpen(false)},
  update:(now,running=true)=>{
   if(!Number.isFinite(now)||now-lastUpdate<180)return;
   lastUpdate=now;
   if(running&&!open){
    const result=progressJourney(journey,getPosition());
    if(result.arrived){journey=result.journey;store();notify(result.journey.status==='complete'?`行程完成 · 已抵达全部 ${journey.stops.length} 个站点`:`已抵达 ${result.arrived.name} · 前往下一站`)}
   }
   updateUI();draw();
  }
 };
}
