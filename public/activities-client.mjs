import {
 ACTIVITY_KEY,CITY_CONTRACTS,DISPATCH,restoreActivities,startActivity,cancelActivity,
 currentActivity,currentStep,distanceToActivity,interactActivity,interactionPrompt
} from './activities.mjs';
import {navigationHint} from './journey.mjs';
import {createCharacter} from './character-art.mjs';

/** Connect the deterministic service contracts to the existing 3D world and wallet. */
export function setupCityActivities({
 THREE,scene,doc=document,storage=window.localStorage,getPlayer,
 canPlay=()=>true,clearControls=()=>{},onPayout=()=>{},notify=()=>{}
}){
 const $=id=>doc.getElementById(id);
 const read=()=>{try{return JSON.parse(storage.getItem(ACTIVITY_KEY)||'null')}catch{return null}};
 let state=restoreActivities(read()),open=false,prevFocus=null,lastUpdate=0;
 const save=()=>{try{storage.setItem(ACTIVITY_KEY,JSON.stringify(state))}catch{}};
 const material=(c,emissive=0x000000,intensity=0)=>new THREE.MeshStandardMaterial({
  color:c,metalness:.36,roughness:.45,emissive,emissiveIntensity:intensity
 });
 const gold=material(0xd8bb87,0x9d621e,.35),dark=material(0x163544),
      glow=new THREE.MeshBasicMaterial({color:0xfce5a2,transparent:true,opacity:.68,depthWrite:false});
 const dispatch=new THREE.Group();dispatch.position.set(DISPATCH.x,0,DISPATCH.z);
 const post=new THREE.Mesh(new THREE.BoxGeometry(2.8,3.5,1.6),dark);
 post.position.y=1.75;dispatch.add(post);
 const face=new THREE.Mesh(new THREE.BoxGeometry(2.25,1.7,.12),gold);
 face.position.set(0,2.25,-.86);dispatch.add(face);
 const cap=new THREE.Mesh(new THREE.BoxGeometry(3.2,.3,2),gold);
 cap.position.y=3.66;dispatch.add(cap);
 const rim=new THREE.Mesh(new THREE.TorusGeometry(2.25,.15,8,32),glow);
 rim.rotation.x=Math.PI/2;rim.position.y=.15;dispatch.add(rim);
 scene.add(dispatch);
 // One destination marker and a small cast of actual three-dimensional citizens.
 const marker=new THREE.Group();
 const ring=new THREE.Mesh(new THREE.TorusGeometry(4,.19,8,40),new THREE.MeshBasicMaterial({color:0x92f5e5}));
 ring.rotation.x=Math.PI/2;ring.position.y=.35;marker.add(ring);
 const beam=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,15,18,1,true),
  new THREE.MeshBasicMaterial({color:0x83e8cd,transparent:true,opacity:.10,side:THREE.DoubleSide,depthWrite:false}));
 beam.position.y=7.5;marker.add(beam);
 marker.visible=false;scene.add(marker);
 const citizens=[];
 const locations=[
  {x:0,z:-100},{x:-300,z:-300},{x:100,z:-300},{x:300,z:200},
  {x:-300,z:300},{x:-400,z:-400},{x:-100,z:200},{x:300,z:100},
  {x:200,z:-200},{x:-500,z:100}
 ];
 for(let i=0;i<locations.length;i++){
  const entry=locations[i],npc=createCharacter(THREE);
  const actor=npc.avatar;actor.position.set(entry.x+5,.1,entry.z+7);
  actor.rotation.y=i*.61;actor.scale.setScalar(.89+(i%4)*.045);
  actor.name='City pedestrian '+(i+1);
  scene.add(actor);citizens.push({actor,animate:npc.animate,baseX:actor.position.x,baseZ:actor.position.z,seed:i});
 }
 const surface=$('activityPanel'),offers=$('activityOfferList');
 const desc=goal=>goal.mode==='foot'?'下车后按 F 交互':'停车后按 F 交互';
 const format=n=>Math.round(n).toLocaleString('zh-CN');
 function renderOffers(){
  offers.innerHTML=CITY_CONTRACTS.map(contract=>{
   const count=state.completed[contract.id]||0;
   const disabled=state.status==='active';
   return '<article class="activity-offer">'+
    '<div class="activity-offer-head"><small>'+contract.category+'</small><strong>+$'+format(contract.reward)+'</strong></div>'+
    '<h3>'+contract.title+'</h3><p>'+contract.description+'</p>'+
    '<footer><span>已完成 '+format(count)+' 次 · '+contract.steps.length+' 个阶段</span>'+
    '<button type="button" data-activity-id="'+contract.id+'" '+(disabled?'disabled':'')+'>接取任务</button></footer></article>';
  }).join('');
  $('activityActiveDetail').hidden=state.status!=='active';
  if(state.status==='active'){
   const contract=currentActivity(state);
   $('activityActiveDetail').textContent='当前任务：'+contract.title+' · 第 '+(state.index+1)+'/'+contract.steps.length+' 阶段';
  }
  $('activityLedger').textContent='累计 '+format(state.history.length)+' 条近期完成记录 · 总收入 $'+format(state.earned);
 }
 function renderStatus(){
  const contract=currentActivity(state),goal=currentStep(state),world=getPlayer();
  $('activityHud').hidden=!contract;
  doc.body.classList.toggle('activity-running',!!contract);
  marker.visible=!!goal;
  if(!contract)return;
  marker.position.set(goal.x,.05,goal.z);
  const navigation=navigationHint(world.position,world.heading,goal);
  $('activityName').textContent=contract.title;
  $('activityStage').textContent='第 '+(state.index+1)+'/'+contract.steps.length+' 阶段 · '+goal.title;
  $('activityDistance').textContent=navigation.roadDistance.toLocaleString('zh-CN')+' m · '+navigation.instruction;
  $('activityInstruction').textContent=desc(goal);
 }
 function setOpen(next){
  if(next&&!canPlay())return false;
  open=!!next;surface.hidden=!open;
  clearControls();
  if(open){prevFocus=doc.activeElement;renderOffers();$('activityClose').focus()}
  else if(prevFocus&&typeof prevFocus.focus==='function'){prevFocus.focus()}
  renderStatus();return open;
 }
 function start(id){
  const result=startActivity(state,id);
  if(result.reason){notify(result.reason==='busy'?'请先完成或取消正在进行的委托':'无效的委托');return}
  state=result.state;save();setOpen(false);renderStatus();
  notify('已接取 '+currentActivity(state).title+' · 跟随金色标记前往目标');
 }
 function cancel(){
  const result=cancelActivity(state);
  if(!result.cancelled)return;
  state=result.state;save();renderOffers();renderStatus();notify('委托已取消，未领取报酬');
 }
 function interact(){
  if(!canPlay()||open)return;
  const world=getPlayer();
  if(state.status!=='active'){
   if(world.mode==='foot'&&Math.hypot(world.position.x-DISPATCH.x,world.position.z-DISPATCH.z)<16)setOpen(true);
   else notify('按 J 打开城市委托；也可步行前往城市服务站接单');
   return;
  }
  const result=interactActivity(state,world);
  if(result.reason){
   notify(result.reason==='far'?'尚未抵达任务目的地':result.reason==='mode'?'请按目标要求上下车':result.reason==='moving'?'请先停车再交互':'当前不能交互');
   return;
  }
  state=result.state;save();
  if(result.event==='completed'){
   onPayout(result.reward);
   notify('委托完成 · '+result.contract.title+' · 获得 $'+format(result.reward));
  }else notify('阶段完成 · 前往下一处目标');
  renderStatus();
 }
 $('activityOpen').addEventListener('click',()=>setOpen(!open));
 $('activityClose').addEventListener('click',()=>setOpen(false));
 $('activityCancel').addEventListener('click',cancel);
 offers.addEventListener('click',event=>{
  const button=event.target.closest('button[data-activity-id]');
  if(button&&!button.disabled)start(button.dataset.activityId);
 });
 renderStatus();
 return {
  open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!open),
  isOpen:()=>open,interact,
  active:()=>currentActivity(state),currentTarget:()=>currentStep(state),
  getState:()=>state,
  update:now=>{
   if(!Number.isFinite(now))return;
   const t=now*.001;
   for(const npc of citizens){
    npc.actor.position.x=npc.baseX+Math.sin(t*.33+npc.seed)*1.45;
    npc.actor.position.z=npc.baseZ+Math.cos(t*.33+npc.seed)*1.35;
    npc.actor.rotation.y=t*.33+npc.seed+Math.PI/2;
    npc.animate(t,true,false);
   }
   ring.rotation.z=t*.7;
   dispatch.rotation.y=Math.sin(t*.25)*.017;
   if(now-lastUpdate<240)return;
   lastUpdate=now;
   const world=getPlayer(),goal=currentStep(state);
   const distance=goal?distanceToActivity(state,world.position):Math.hypot(world.position.x-DISPATCH.x,world.position.z-DISPATCH.z);
   let text=goal?interactionPrompt(state,world.position,world.mode,world.speed):
     distance<19?(world.mode==='foot'?'按 F · 打开城市委托':'下车后访问城市服务站'):null;
   $('activityPrompt').hidden=!text||open;
   if(text)$('activityPrompt').textContent=text;
   if(goal)renderStatus();
  }
 };
}
