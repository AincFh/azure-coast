import test from 'node:test';
import assert from 'node:assert/strict';
import {setupJourneyUI} from '../public/journey-client.mjs';
import {JOURNEY_KEY,PLANNER_KEY,createJourney,CITY_STOPS} from '../public/journey.mjs';

function makeHarness(initial={}){
 const data=new Map(Object.entries(initial));
 const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 const events=new Map();
 const nodes=new Map();
 const calls=[];
 const context={
  fillRect(){},clearRect(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},save(){},restore(){},translate(){},rotate(){},closePath(){},fillText(){},setLineDash(){},createLinearGradient(){return {addColorStop(){}}}
 };
 function node(id){
  const listeners={};
  const n={id,hidden:false,textContent:'',innerHTML:'',disabled:false,width:940,height:690,style:{},
   addEventListener:(event,cb)=>{listeners[event]=cb},
   click:()=>listeners.click?.({target:n}),
   focus:()=>{calls.push('focus:'+id)},
   dispatch:(event,detail={})=>listeners[event]?.(detail),
   getBoundingClientRect:()=>({left:0,top:0,width:940,height:690}),
   getContext:()=>context
  };nodes.set(id,n);return n;
 }
 for(const id of ['mapOverlay','cityMap','navStatus','navDestination','navCue','navDistance','navProgress','mapJourneyState','mapLocation','mapStartJourney','mapStopList','mapClose','mapBtn','navMapBtn','mapCancelJourney'])node(id);
 const doc={getElementById:id=>nodes.get(id),defaultView:{devicePixelRatio:1,addEventListener:(event,cb)=>events.set(event,cb)}};
 let position={x:0,z:12};const paused=[];
 const ui=setupJourneyUI({doc,storage,getPosition:()=>position,getHeading:()=>0,onMapOpen:v=>paused.push(v),notify:m=>calls.push(m)});
 return {nodes,storage,ui,calls,paused,setPosition:p=>{position=p},get:(id)=>nodes.get(id)};
}
test('planned journey restores into navigation HUD without mutating mission progression',()=>{
 const h=makeHarness({[JOURNEY_KEY]:JSON.stringify(createJourney(['bay','marina']))});
 assert.equal(h.ui.currentTarget().id,'bay');
 assert.equal(h.get('navStatus').hidden,false);
 assert.match(h.get('navProgress').textContent,/1 \/ 2/);
 h.ui.update(1000,false);
 assert.equal(h.ui.currentTarget().id,'bay');
});
test('map interaction pauses driving and supports accessible stop buttons',()=>{
 const h=makeHarness();
 h.ui.toggleMap();assert.equal(h.ui.isOpen(),true);assert.equal(h.get('mapOverlay').hidden,false);
 assert.equal(h.get('mapClose').id,'mapClose');
 h.get('mapStopList').dispatch('click',{target:{closest:()=>({dataset:{stopId:'cliff'}})}});
 assert.equal(h.ui.currentTarget().id,'cliff');
 assert.equal(h.get('navStatus').hidden,false);
 h.ui.closeMap();assert.equal(h.ui.isOpen(),false);
 assert.deepEqual(h.paused,[true,false]);
});
test('saved route advances only while gameplay runs and is restored after reload',()=>{
 const h=makeHarness({[JOURNEY_KEY]:JSON.stringify(createJourney(['bay','marina']))});
 h.setPosition({x:0,z:-500});h.ui.update(1000,false);
 assert.equal(h.ui.currentTarget().id,'bay');
 h.ui.update(1300,true);assert.equal(h.ui.currentTarget().id,'marina');
 assert.equal(JSON.parse(h.storage.getItem(JOURNEY_KEY)).index,1);
 const h2=makeHarness({[JOURNEY_KEY]:h.storage.getItem(JOURNEY_KEY)});
 assert.equal(h2.ui.currentTarget().id,'marina');
 h2.setPosition({x:-300,z:-300});h2.ui.update(1000,true);
 assert.equal(h2.ui.currentTarget(),null);
 assert.equal(JSON.parse(h2.storage.getItem(JOURNEY_KEY)).status,'complete');
});
test('explore itinerary can start from map and cancelling hides navigation',()=>{
 const h=makeHarness({[PLANNER_KEY]:JSON.stringify({stops:['harbor','oldtown']})});
 assert.equal(h.get('mapStartJourney').disabled,false);
 h.get('mapStartJourney').click();
 assert.equal(h.ui.currentTarget().id,'harbor');
 h.get('mapCancelJourney').click();
 assert.equal(h.ui.currentTarget(),null);
 assert.equal(h.get('navStatus').hidden,true);
 assert.equal(JSON.parse(h.storage.getItem(JOURNEY_KEY)).status,'cancelled');
});
