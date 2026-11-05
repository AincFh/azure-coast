import test from 'node:test';
import assert from 'node:assert/strict';
import {setupCompactMissionHUD} from '../public/compact-hud.mjs';
import {readFileSync} from 'node:fs';

function fakeDOM(){
 const nodes=new Map(),listeners={};let mobile=true,focusCount=0;
 const tokens=new Set();
 const body={classList:{
  contains:k=>tokens.has(k),
  toggle:(k,on)=>on?tokens.add(k):tokens.delete(k)
 }};
 function element(id){
  const callbacks={};const attrs={};
  const node={id,callbacks,attrs,textContent:'',addEventListener:(type,handler)=>{callbacks[type]=handler},
   setAttribute:(key,val)=>{attrs[key]=val},getAttribute:key=>attrs[key],
   focus:()=>{focusCount++},click:()=>callbacks.click?.()};
  nodes.set(id,node);return node;
 }
 for(const id of ['hudDetailsBtn','mapBtn','navMapBtn','activityOpen','garageOpen','begin'])
  element(id);
 const doc={body,getElementById:id=>nodes.get(id)||null,addEventListener:(type,fn)=>{listeners[type]=fn}};
 const win={matchMedia:()=>({matches:mobile}),addEventListener:(name,fn)=>{listeners['window:'+name]=fn}};
 return {doc,win,nodes,listeners,setMobile:v=>{mobile=v},
  focuses:()=>focusCount,body};
}

test('mission HUD remains collapsed until explicitly requested on mobile',()=>{
 const h=fakeDOM(),ui=setupCompactMissionHUD(h.doc,h.win);
 assert.equal(ui.isOpen(),false);
 const btn=h.nodes.get('hudDetailsBtn');
 assert.equal(btn.getAttribute('aria-expanded'),'false');
 assert.equal(btn.textContent,'任务详情');
 btn.click();
 assert.equal(ui.isOpen(),true);
 assert.equal(btn.getAttribute('aria-expanded'),'true');
 assert.equal(btn.textContent,'收起详情');
 btn.click();
 assert.equal(ui.isOpen(),false);
});

test('map, services and garage controls always dismiss the mobile mission disclosure',()=>{
 const h=fakeDOM(),ui=setupCompactMissionHUD(h.doc,h.win);
 for(const id of ['mapBtn','navMapBtn','activityOpen','garageOpen','begin']){
  ui.setOpen(true);
  assert.equal(ui.isOpen(),true);
  h.nodes.get(id).click();
  assert.equal(ui.isOpen(),false,id);
 }
});

test('Escape closes the mobile HUD first, without accidentally toggling game pause',()=>{
 const h=fakeDOM(),ui=setupCompactMissionHUD(h.doc,h.win);
 ui.setOpen(true);
 let prevented=0,stopped=0;
 h.listeners.keydown({key:'Escape',preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++});
 assert.equal(ui.isOpen(),false);
 assert.equal(prevented,1);
 assert.equal(stopped,1);
 assert.equal(h.focuses(),1);
});

test('desktop resizing removes mobile-only expanded state',()=>{
 const h=fakeDOM(),ui=setupCompactMissionHUD(h.doc,h.win);
 ui.setOpen(true);h.setMobile(false);
 h.listeners['window:resize']();
 assert.equal(ui.isOpen(),false);
 assert.equal(ui.setOpen(true),false);
});

test('responsive HUD stylesheet and markup expose a real accessible control',()=>{
 const html=readFileSync(new URL('../public/play.html',import.meta.url),'utf8');
 const css=readFileSync(new URL('../public/immersive-hud.css',import.meta.url),'utf8');
 assert.match(html,/id="hudDetailsBtn"[^>]*aria-expanded="false"/);
 assert.match(html,/aria-controls="activityHud navStatus"/);
 assert.match(html,/compact-hud.mjs/);
 assert.match(css,/body\.hud-details-open/);
 assert.match(css,/\.hud\.map canvas\{display:none!important\}/);
});
