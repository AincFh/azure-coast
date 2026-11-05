import {
 SHOPS,PRODUCTS,lifeShop,lifeProduct,closestShop,shopAccess,
 restoreLiving,buyLivingItem,consumeLivingItem,refuelVehicle,
 energyProduct,livingIndicators
} from './living-core.mjs';

/** Shared-wallet 3D street commerce, per-car fueling and usable inventory. */
export function setupLivingUI({
 doc=document,getPlayer,getState,getCredits,getCarId,
 onCommit,notify=()=>{},clearControls=()=>{},canPlay=()=>true
}={}){
 const $=id=>doc.getElementById(id),panel=$('livingPanel'),shopList=$('livingOffers'),
  inventoryList=$('livingInventory');
 if(!panel)return null;
 const money=n=>Math.floor(n).toLocaleString('zh-CN');
 let opened=false,previousFocus=null,lastUpdate=-Infinity;
 const state=()=>restoreLiving(getState());
 const nearby=()=>closestShop(getPlayer().position,28);
 const errors={
  funds:'账户余额不足。完成职业委托可增加收入',
  capacity:'背包已满（最多 24 件，每种最多 12 件）',
  distance:'需要先前往店铺的实际街头入口',
  'on-foot':'请停车下车，再到店里购物',
  vehicle:'请驾驶车辆进入能源站',
  moving:'请先停车，再进行车辆能源补给',
  full:'当前车辆能源已充满',
  missing:'背包里没有这件物品',
  unknown:'商品或店铺不正确',
  wallet:'账户余额无效，交易已拒绝'
 };
 function commit(result,success){
  if(result.reason){notify(errors[result.reason]||'暂时无法完成这项操作');return false}
  onCommit(result);
  notify(success);render();
  return true;
 }
 function render(){
  const s=state(),p=getPlayer(),place=nearby(),credits=getCredits(),
   indicators=livingIndicators(s,getCarId()),access=place?shopAccess(place.id,p):null;
  $('livingWallet').textContent='$'+money(credits);
  $('livingStoreName').textContent=place?place.name:'周边尚无营业店铺';
  $('livingStoreDistance').textContent=place?
   '距离 '+Math.round(Math.hypot(place.x-p.position.x,place.z-p.position.z))+' m · '+place.category:
   '前往城市街角咖啡、便利店或能源站';
  $('livingShopDescription').textContent=place?place.description:'你可以随时整理背包。购买商品必须到真实店铺。';
  $('livingAccess').textContent=!place?'离实体店较远，当前仅可使用背包物品。':
   access.allowed?'已在服务范围内 · 可以办理交易':
   errors[access.reason]||'请调整位置与驾驶状态';
  const goods=place?.kind==='food'?PRODUCTS.filter(item=>item.shops.includes(place.id)):[];
  shopList.innerHTML=goods.map(item=>{
   const count=s.inventory[item.id]||0;
   const canBuy=!!access?.allowed&&credits>=item.price&&count<12;
   return '<article class="living-offer"><div><small>食品与饮品</small><h3>'+item.name+'</h3><p>'+item.description+'</p>'+
    '<p>饱腹 +'+item.hunger+' · 水分 +'+item.hydration+' · 精力 +'+item.stamina+'</p></div>'+
    '<div><strong>$'+money(item.price)+'</strong><button type="button" data-life-buy="'+item.id+'" '+(!canBuy?'disabled':'')+'>购买 · 已有 '+count+'</button></div></article>';
  }).join('');
  const fuel=place?.kind==='energy'?energyProduct(getCarId()):null;
  $('livingEnergy').hidden=!fuel;
  if(fuel){
   $('livingEnergyName').textContent=fuel.name;
   $('livingEnergyDetail').textContent=indicators.fuelUnit+' '+indicators.fuel+'% · 每次最多补充 25%';
   $('livingFuelBuy').textContent='补给 · 最多 $'+money(fuel.price);
   $('livingFuelBuy').disabled=!access?.allowed||indicators.fuel>=100||credits<=0;
  }
  $('livingNoGoods').hidden=!!goods.length||!!fuel;
  $('livingCarrying').textContent=indicators.carrying+' / 24 件';
  const stocked=PRODUCTS.filter(item=>s.inventory[item.id]>0);
  inventoryList.innerHTML=stocked.length?stocked.map(item=>
   '<article class="living-bag-item"><div><h3>'+item.name+'</h3><p>剩余 '+s.inventory[item.id]+
   ' 件 · 饱腹 +'+item.hunger+' / 水分 +'+item.hydration+' / 精力 +'+item.stamina+
   '</p></div><button type="button" data-life-use="'+item.id+'">使用 1 件</button></article>'
  ).join(''):'<p class="living-empty">背包目前没有食物和饮品。到街头实体商店购买后，可以在这里使用。</p>';
  $('livingVitalStats').textContent='饱腹 '+indicators.hunger+'% · 水分 '+indicators.hydration+
   '% · 精力 '+indicators.stamina+'% · '+indicators.fuelUnit+' '+indicators.fuel+'%';
  renderHud(indicators);
 }
 function renderHud(indicators=livingIndicators(state(),getCarId())){
  $('lifeHunger').textContent=indicators.hunger+'%';
  $('lifeWater').textContent=indicators.hydration+'%';
  $('lifeStamina').textContent=indicators.stamina+'%';
  $('lifeFuel').textContent=indicators.fuel+'%';
  $('lifeFuelLabel').textContent=indicators.fuelUnit;
  for(const [element,value] of [['lifeHungerBar',indicators.hunger],['lifeWaterBar',indicators.hydration],
   ['lifeStaminaBar',indicators.stamina],['lifeFuelBar',indicators.fuel]]){
   $(element).style.width=value+'%';
  }
  $('lifeVitals').setAttribute('aria-label','饱腹 '+indicators.hunger+'%，水分 '+indicators.hydration+
   '%，精力 '+indicators.stamina+'%，'+indicators.fuelUnit+indicators.fuel+'%');
 }
 function toggle(next){
  if(next&&!canPlay())return false;
  opened=!!next;panel.hidden=!opened;clearControls();
  if(opened){previousFocus=doc.activeElement;render();$('livingClose').focus()}
  else previousFocus?.focus?.();
  return opened;
 }
 function use(id){
  const player=getPlayer();
  if(player.mode==='vehicle'&&Math.abs(player.speed)>3){
   notify('请停车或下车后再使用背包物品');return false;
  }
  const result=consumeLivingItem(state(),id);
  return commit({...result,balance:Math.floor(getCredits())},
   '已使用 '+(lifeProduct(id)?.name||'物品')+' · 体力状态已恢复');
 }
 shopList.addEventListener('click',event=>{
  const btn=event.target.closest('button[data-life-buy]');if(!btn||btn.disabled)return;
  const place=nearby(),item=btn.dataset.lifeBuy;
  if(!place)return;
  const result=buyLivingItem(state(),place.id,item,Math.floor(getCredits()),getPlayer());
  commit(result,'已购买 '+(lifeProduct(item)?.name||item)+' · 物品已放入背包');
 });
 inventoryList.addEventListener('click',event=>{
  const btn=event.target.closest('button[data-life-use]');if(btn&&!btn.disabled)use(btn.dataset.lifeUse);
 });
 $('livingFuelBuy').addEventListener('click',()=>{
  const result=refuelVehicle(state(),Math.floor(getCredits()),getCarId(),getPlayer());
  commit(result,'车辆能源已补充 · '+energyProduct(getCarId()).name);
 });
 $('livingOpen').addEventListener('click',()=>toggle(!opened));
 $('livingClose').addEventListener('click',()=>toggle(false));
 panel.addEventListener('click',event=>{if(event.target===panel)toggle(false)});
 doc.addEventListener('keydown',event=>{
  if(opened&&event.key==='Escape'){
   event.preventDefault?.();event.stopImmediatePropagation?.();toggle(false);
  }
 },true);
 function update(now){
  if(!Number.isFinite(now)||now-lastUpdate<750)return;
  lastUpdate=now;
  if(opened)render();else renderHud();
  const p=getPlayer(),place=closestShop(p.position,23);
  $('livingPrompt').hidden=opened||!place;
  if(place&&!opened){
   $('livingPrompt').textContent='按 U · '+place.name+
    (place.kind==='energy'?' · 停车补能':' · 购买食品');
  }
 }
 renderHud();update(0);
 return {open:()=>toggle(true),close:()=>toggle(false),isOpen:()=>opened,
  interact:()=>toggle(true),access:()=>{const p=nearby();return !!p&&shopAccess(p.id,getPlayer()).allowed},update,use};
}
