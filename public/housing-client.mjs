import {
 RESIDENCES,FURNITURE,RESIDENCE_SLOTS,restoreHousing,propertyById,
 nearestResidence,purchaseResidence,canEnterResidence,
 purchaseFurniture,moveFurniture,rotateFurniture,sellFurniture,
 roomFurniture,interiorStep
} from './housing.mjs';
import {createResidentialWorld} from './residential-world.mjs';

/** 3D home purchases + live interior room editor using the existing player wallet. */
export function setupHousing({
 THREE,cityScene,renderer,doc=document,getPlayer,getHousing,getCredits,onCommit,
 canPlay=()=>true,clearControls=()=>{},notify=()=>{}
}){
 const $=id=>doc.getElementById(id),world=createResidentialWorld(THREE,cityScene);
 const panel=$('housingPanel'),designPanel=$('furnishPanel'),list=$('housingList');
 const editor=$('furnishOffers'),slotGrid=$('furnishSlots');
 let open=false,insideId=null,designOpen=false,selected=4,prevFocus=null,lastPrompt=-Infinity;
 let player={x:0,z:9,heading:0,moving:false},lastTick=0;
 const money=value=>Math.max(0,Math.floor(value)).toLocaleString('zh-CN');
 const active=()=>insideId?propertyById(insideId):null;
 const state=()=>restoreHousing(getHousing());
 function statusMessage(reason){
  return {
   funds:'账户余额不足；完成城市职业可获得收入',
   distance:'需要先前往住宅门口',
   mode:'请先下车，再进入住宅',
   moving:'请先停车',
   occupied:'该家具位置已被占用，请选择空位',
   'not-owned':'尚未购买这处住宅',
   wallet:'账户余额异常，交易已拒绝'
  }[reason]||'操作无法完成';
 }
 function commit(result,message){
  if(result.reason){notify(statusMessage(result.reason));return false}
  onCommit(result);notify(message);
  return true;
 }
 function renderProperties(){
  const residenceState=state(),wallet=Math.floor(getCredits()),outside=getPlayer();
  $('housingWallet').textContent='$'+money(wallet);
  $('housingCount').textContent=residenceState.owned.length+' / '+RESIDENCES.length;
  list.innerHTML=RESIDENCES.map(item=>{
   const own=residenceState.owned.includes(item.id),distance=Math.round(Math.hypot(outside.position.x-item.x,outside.position.z-item.z));
   const canBuy=!own&&distance<=26&&Math.abs(outside.speed)<=3&&wallet>=item.price;
   const canEnter=canEnterResidence(residenceState,item.id,outside).allowed;
   const price=item.starter?'城市起始住宅 · $'+money(item.price):'产权总价 · $'+money(item.price);
   return '<article class="housing-card"><div class="housing-card-top"><small>'+item.style.toUpperCase()+
    '</small><span>'+distance+' m</span></div><h3>'+item.name+'</h3><p>'+item.description+
    '</p><strong>'+price+'</strong><div class="housing-actions">'+
    (own?'<span class="housing-owned">已拥有</span>':
     '<button type="button" data-buy-house="'+item.id+'" '+(canBuy?'':'disabled')+'>购买住宅</button>')+
    (own?'<button type="button" data-enter-house="'+item.id+'" '+(canEnter?'':'disabled')+'>进入住宅</button>':'')+
    '</div></article>';
  }).join('');
  $('housingHint').textContent='房产价格与官网的正式房产目录一致；新增的起始公寓属于可游玩住宅，不属于概念房产目录。购入与家具费用从同一个游戏账户扣除。';
 }
 function setOpen(next){
  if(next&&(!canPlay()||insideId))return false;
  open=!!next;panel.hidden=!open;clearControls();
  if(open){prevFocus=doc.activeElement;renderProperties();$('housingClose').focus()}
  else prevFocus?.focus?.();
  return open;
 }
 function enter(id){
  if(!canPlay())return false;
  const access=canEnterResidence(state(),id,getPlayer());
  if(!access.allowed){notify(statusMessage(access.reason));return false}
  const property=propertyById(id);
  insideId=id;player={x:0,z:9,heading:Math.PI,moving:false};
  world.makeRoom(property);world.applyFurniture(roomFurniture(state(),id));
  world.update(player,0,false);world.setAspect(window.innerWidth,window.innerHeight);
  setOpen(false);clearControls();
  doc.body.classList.add('home-interior');
  $('interiorTitle').textContent=property.name;
  $('interiorHud').hidden=false;
  $('housingPrompt').hidden=true;
  notify('已进入 '+property.name+' · WASD 行走 / I 布置 / E 退出');
  return true;
 }
 function exit(){
  if(!insideId)return false;
  setDecorate(false);clearControls();
  doc.body.classList.remove('home-interior');
  insideId=null;$('interiorHud').hidden=true;
  notify('已返回城市街区');
  return true;
 }
 function setDecorate(next){
  if(next&&!insideId)return false;
  designOpen=!!next;
  designPanel.hidden=!designOpen;
  clearControls();
  if(designOpen){selected=4;renderFurniture();$('furnishClose').focus()}
  else $('interiorDecorate').focus();
  return designOpen;
 }
 function renderFurniture(){
  if(!insideId)return;
  const items=roomFurniture(state(),insideId),current=items.find(x=>x.slot===selected);
  world.applyFurniture(items);world.setSelection(selected);
  $('furnishWallet').textContent='$'+money(getCredits());
  $('furnishRoom').textContent=active().name;
  $('furnishSelection').textContent='位置 '+(selected+1)+' / 9 · '+(current?FURNITURE.find(x=>x.id===current.item).name:'空位置');
  slotGrid.innerHTML=RESIDENCE_SLOTS.map((slot,i)=>{
   const installed=items.find(x=>x.slot===i);
   return '<button type="button" data-furniture-slot="'+i+'" class="'+(selected===i?'selected':'')+
    '" aria-pressed="'+(selected===i)+'"><span>0'+(i+1)+'</span><strong>'+
    (installed?FURNITURE.find(x=>x.id===installed.item).name:'可布置')+'</strong></button>';
  }).join('');
  editor.innerHTML=FURNITURE.map(item=>{
   const affordable=getCredits()>=item.price;
   return '<button type="button" data-buy-furniture="'+item.id+'" '+(current||!affordable?'disabled':'')+
    '><strong>'+item.name+'</strong><small>'+item.category+' · $'+money(item.price)+'</small></button>';
  }).join('');
  $('furnishRotate').disabled=!current;
  $('furnishSell').disabled=!current;
  for(const button of doc.querySelectorAll('[data-furniture-move]')){
   const direction=button.dataset.furnitureMove;
   const step={left:-1,right:1,up:-3,down:3}[direction];
   const destination=selected+step;
   const inBounds=destination>=0&&destination<9&&
    !(direction==='left'&&selected%3===0)&&
    !(direction==='right'&&selected%3===2);
   button.disabled=!current||!inBounds||items.some(item=>item.slot===destination);
  }
 }
 function buyProperty(id){
  const result=purchaseResidence(state(),id,Math.floor(getCredits()),getPlayer());
  if(commit(result,'已购入 '+(propertyById(id)?.name||'住宅')+' · 产权已保存'))renderProperties();
 }
 function buyFurnitureItem(id){
  if(!insideId||!designOpen)return;
  const result=purchaseFurniture(state(),insideId,id,selected,Math.floor(getCredits()));
  if(commit(result,'家具已安装 · '+(FURNITURE.find(x=>x.id===id)?.name||id)))renderFurniture();
 }
 function move(direction){
  if(!insideId||!designOpen)return;
  const step={left:-1,right:1,up:-3,down:3}[direction];
  if(!step)return;
  if(direction==='left'&&selected%3===0)return;
  if(direction==='right'&&selected%3===2)return;
  const destination=selected+step;
  const result=moveFurniture(state(),insideId,selected,destination);
  if(result.reason){notify(statusMessage(result.reason));return}
  onCommit({state:result.state,balance:Math.floor(getCredits()),reason:null});
  selected=destination;renderFurniture();
 }
 function rotate(){
  if(!insideId||!designOpen)return;
  const result=rotateFurniture(state(),insideId,selected);
  if(commit({...result,balance:Math.floor(getCredits())},'家具已旋转 90°'))renderFurniture();
 }
 function sell(){
  if(!insideId||!designOpen)return;
  const result=sellFurniture(state(),insideId,selected,Math.floor(getCredits()));
  if(commit(result,'已出售家具 · 返还 $'+money(result.refund||0)))renderFurniture();
 }
 list.addEventListener('click',event=>{
  const buy=event.target.closest('button[data-buy-house]');
  const enterBtn=event.target.closest('button[data-enter-house]');
  if(buy&&!buy.disabled)buyProperty(buy.dataset.buyHouse);
  else if(enterBtn&&!enterBtn.disabled)enter(enterBtn.dataset.enterHouse);
 });
 slotGrid.addEventListener('click',event=>{
  const slot=event.target.closest('[data-furniture-slot]');
  if(!slot)return;
  selected=Number(slot.dataset.furnitureSlot);renderFurniture();
 });
 editor.addEventListener('click',event=>{
  const button=event.target.closest('button[data-buy-furniture]');
  if(button&&!button.disabled)buyFurnitureItem(button.dataset.buyFurniture);
 });
 $('housingOpen').addEventListener('click',()=>setOpen(!open));
 $('housingClose').addEventListener('click',()=>setOpen(false));
 $('interiorExit').addEventListener('click',exit);
 $('interiorDecorate').addEventListener('click',()=>setDecorate(!designOpen));
 $('furnishClose').addEventListener('click',()=>setDecorate(false));
 $('furnishRotate').addEventListener('click',rotate);
 $('furnishSell').addEventListener('click',sell);
 for(const button of doc.querySelectorAll('[data-furniture-move]'))
  button.addEventListener('click',()=>move(button.dataset.furnitureMove));
 renderer.domElement.addEventListener('pointerup',event=>{
  if(!insideId||!designOpen)return;
  const slot=world.atCanvas(event,renderer.domElement);
  if(slot!==null){selected=slot;renderFurniture()}
 });
 window.addEventListener('resize',()=>world.setAspect(window.innerWidth,window.innerHeight));
 return {
  open:()=>setOpen(true),close:()=>setOpen(false),toggle:()=>setOpen(!open),
  isOpen:()=>open,inside:()=>!!insideId,decorating:()=>designOpen,
  enter,exit,toggleDecorate:()=>setDecorate(!designOpen),closeDecorate:()=>setDecorate(false),
  canInteract:()=>getPlayer().mode==='foot'&&!!nearestResidence(getPlayer().position,19),
  interact:()=>{
   const location=nearestResidence(getPlayer().position,19);
   if(!location||getPlayer().mode!=='foot')return false;
   if(state().owned.includes(location.id))return enter(location.id);
   return setOpen(true);
  },
  update(now,dt,keys){
   if(insideId){
    const input={forward:!!(keys.w||keys.arrowup),back:!!(keys.s||keys.arrowdown),
      left:!!(keys.a||keys.arrowleft),right:!!(keys.d||keys.arrowright),sprint:!!keys.shift};
    const next=designOpen?{...player,moving:false}:interiorStep(player,input,dt,roomFurniture(state(),insideId));
    player=next;world.update(player,now*.001,next.moving&&!designOpen,input.sprint);
    if(!designOpen&&now-lastPrompt>700){
     lastPrompt=now;
     $('interiorHint').textContent='X '+Math.round(player.x)+' · Z '+Math.round(player.z)+' · I 布置家具 · E 退出';
    }
    return;
   }
   if(now-lastPrompt<320)return;
   lastPrompt=now;
   const position=getPlayer().position,location=nearestResidence(position,24);
   $('housingPrompt').hidden=!location||getPlayer().mode!=='foot'||open;
   if(location&&getPlayer().mode==='foot'&&!open){
    $('housingPrompt').textContent='按 F · '+location.name+
      (state().owned.includes(location.id)?' · 进入住宅':' · 查看房产');
   }
  },
  render:()=>world.render(renderer)
 };
}
