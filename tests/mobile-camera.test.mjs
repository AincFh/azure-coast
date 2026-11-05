import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cameraLayout,cameraInterpolationFactor} from '../public/camera-rig.mjs';
import {setupMobileActionCenter} from '../public/mobile-actions.mjs';

test('portrait third-person camera increases distance to keep the whole car visible',()=>{
 const desktop=cameraLayout({width:1440,height:900,view:0});
 const mobile=cameraLayout({width:375,height:812,view:0});
 assert.ok(mobile.offset[2]>desktop.offset[2]);
 assert.ok(mobile.offset[1]>desktop.offset[1]);
 assert.ok(mobile.lookAhead>desktop.lookAhead);
 const tablet=cameraLayout({width:768,height:1024,view:0});
 assert.ok(tablet.offset[2]>desktop.offset[2]);
 const wide=cameraLayout({width:1024,height:768,view:0});
 assert.deepEqual(wide.offset,desktop.offset);
});
test('cockpit, overhead and walking camera presets remain distinct',()=>{
 const dimensions={width:375,height:812};
 const defaultView=cameraLayout({...dimensions,view:0});
 const cockpit=cameraLayout({...dimensions,view:1});
 const overhead=cameraLayout({...dimensions,view:2});
 const pedestrian=cameraLayout({...dimensions,onFoot:true});
 assert.ok(cockpit.offset[2]<defaultView.offset[2]);
 assert.ok(overhead.offset[1]>defaultView.offset[1]);
 assert.ok(pedestrian.offset[2]<defaultView.offset[2]);
 assert.notDeepEqual(overhead.offset,pedestrian.offset);
});
test('initial camera frames snap immediately without 2s zooming out of the vehicle',()=>{
 assert.equal(cameraInterpolationFactor(.016,false),1);
 assert.ok(cameraInterpolationFactor(.016,true)<.1);
 assert.equal(cameraInterpolationFactor(Infinity,true),0);
 assert.ok(cameraInterpolationFactor(.5,true)<=.21);
});
function fakeEnvironment(){
 let mobile=true,focusCount=0;
 const listeners={},elements=new Map(),classes=new Set();
 function el(id){
  const handlers={};
  const node={id,hidden:id==='actionDrawer',attributes:{},handlers,
   addEventListener:(k,fn)=>handlers[k]=fn,
   setAttribute:(k,v)=>node.attributes[k]=v,
   focus:()=>focusCount++,
   click:()=>handlers.click?.({target:node})};
  elements.set(id,node);return node;
 }
 ['actionDrawer','actionMenuBtn','actionClose','activityOpen','garageOpen','housingOpen','fleetOpen','citizenOpen','livingOpen',
  'begin','pauseBtn','mapBtn','enterBtn','cameraBtn'].forEach(el);
 const body={classList:{
  contains:k=>classes.has(k),
  toggle:(k,flag)=>flag?classes.add(k):classes.delete(k)
 }};
 const doc={body,activeElement:elements.get('actionMenuBtn'),getElementById:k=>elements.get(k)||null,
  addEventListener:(type,fn)=>listeners[type]=fn};
 const win={matchMedia:()=>({matches:mobile}),addEventListener:(type,fn)=>listeners[type]=fn};
 return {doc,win,elements,listeners,body,setMobile:v=>{mobile=v},focuses:()=>focusCount};
}
test('drawer opens with ARIA feedback and closes on Escape',()=>{
 const h=fakeEnvironment(),ui=setupMobileActionCenter(h.doc,h.win);
 assert.equal(ui.isOpen(),false);
 h.elements.get('actionMenuBtn').click();
 assert.equal(ui.isOpen(),true);
 assert.equal(h.elements.get('actionDrawer').hidden,false);
 assert.equal(h.elements.get('actionMenuBtn').attributes['aria-expanded'],'true');
 assert.equal(h.body.classList.contains('mobile-actions-open'),true);
 let stopped=0;
 h.listeners.keydown({key:'Escape',preventDefault:()=>{},stopImmediatePropagation:()=>stopped++});
 assert.equal(stopped,1);
 assert.equal(ui.isOpen(),false);
 assert.equal(h.elements.get('actionDrawer').hidden,true);
});
test('every action choice dispatches its existing game button and dismisses drawer',()=>{
 const h=fakeEnvironment(),ui=setupMobileActionCenter(h.doc,h.win);
 for(const name of ['activityOpen','garageOpen','housingOpen','fleetOpen','citizenOpen','livingOpen']){
  let clicks=0;
  h.elements.get(name).addEventListener('click',()=>clicks++);
  ui.open();
  h.elements.get('actionDrawer').handlers.click({
   target:{closest:()=>({dataset:{actionProxy:name}})}
  });
  assert.equal(clicks,1,name);
  assert.equal(ui.isOpen(),false,name);
 }
});
test('desktop resizing closes drawer and prevents a mobile-only modal state',()=>{
 const h=fakeEnvironment(),ui=setupMobileActionCenter(h.doc,h.win);
 ui.open();h.setMobile(false);h.listeners.resize();
 assert.equal(ui.isOpen(),false);
 assert.equal(ui.open(),false);
});
test('narrow control bar reserves real tap targets and leaves game canvas visible',()=>{
 const css=readFileSync(new URL('../public/mobile-actions.css',import.meta.url),'utf8');
 const game=readFileSync(new URL('../public/game.mjs',import.meta.url),'utf8');
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 assert.match(css,/\.controls>#activityOpen/);
 assert.match(css,/#actionMenuBtn\{display:inline-flex!important/);
 assert.match(css,/min-height:45px!important/);
 assert.match(game,/cameraInterpolationFactor/);
 assert.match(game,/mobile-actions-open/);
 assert.match(html,/id="actionDrawer"/);
});
