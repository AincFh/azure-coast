import {
 FLEET_CATALOG,FLEET_DEALERSHIP,dealershipAccess,restoreFleet,fleetVehicle,
 buyFleetVehicle,switchFleetVehicle,sellFleetVehicle
} from './fleet.mjs';
import {createFleetCar,releaseFleetCar} from './fleet-art.mjs';

/**
 * Actual in-world dealership and responsive vehicle ownership panel.
 * No phantom buttons: each sale changes the original shared game wallet.
 */
export function setupFleetUI({
 THREE,scene,doc=document,getPlayer,getFleet,getCredits,
 canPlay=()=>true,clearControls=()=>{},onCommit,notify=()=>{}
}){
 const $=id=>doc.getElementById(id);
 const panel=$('fleetPanel'),list=$('fleetVehicleList');
 const money=n=>Math.max(0,Math.floor(n)).toLocaleString('zh-CN');
 const gold=new THREE.MeshStandardMaterial({color:0xc49c6b,metalness:.6,roughness:.33});
 const dark=new THREE.MeshStandardMaterial({color:0x1d3540,roughness:.5,metalness:.32});
 const white=new THREE.MeshBasicMaterial({color:0xd7f9ef});
 const dealer=new THREE.Group();
 dealer.position.set(FLEET_DEALERSHIP.x,0,FLEET_DEALERSHIP.z);
 const addBox=(w,h,d,m,x,y,z)=>{
  const box=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);
  box.position.set(x,y,z);dealer.add(box);return box;
 };
 addBox(7,.1,9,dark,0,.05,0);
 for(const x of [-3.5,3.5]){
  addBox(.32,5.5,.32,gold,x,2.8,-4);
  addBox(.32,5.5,.32,gold,x,2.8,4);
 }
 addBox(7.7,.36,9.2,dark,0,5.63,0);
 addBox(7.7,.14,1.3,gold,0,5.84,-4.2);
 addBox(4,.45,.13,white,0,4.75,-4.33);
 addBox(5,.15,7,gold,0,.16,0);
 scene.add(dealer);
 let open=false,selected='solstice',displayRig=null,previewStamp=0,previousFocus=null;
 const displayGroup=new THREE.Group();
 displayGroup.position.set(FLEET_DEALERSHIP.x-7,.11,FLEET_DEALERSHIP.z+4);
 displayGroup.rotation.y=-.62;
 scene.add(displayGroup);
 function showModel(id){
  if(displayRig){displayGroup.remove(displayRig.car);releaseFleetCar(displayRig.car)}
  displayRig=createFleetCar(THREE,id);
  displayGroup.add(displayRig.car);
  displayGroup.rotation.y=-.62;
 }
 function render(){
  const data=restoreFleet(getFleet()),wallet=Math.floor(getCredits());
  const access=dealershipAccess(getPlayer()),active=fleetVehicle(data.active);
  $('fleetWallet').textContent='$'+money(wallet);
  $('fleetOwnedCount').textContent=data.owned.length+'/'+FLEET_CATALOG.length;
  $('fleetActiveName').textContent=active?.name||'COAST / GT';
  $('fleetAccess').textContent=access.allowed?'车辆已停稳 · 可购车、出售及换车':
   access.reason==='moving'?'先停稳车辆再交易或换车':'请将车辆开到 AZURE 汽车销售中心办理交易';
  list.innerHTML=FLEET_CATALOG.map(car=>{
   const owned=data.owned.includes(car.id),active=data.active===car.id,
    preview=selected===car.id,buyable=!owned&&access.allowed&&wallet>=car.price,
    changeable=owned&&!active&&access.allowed,sellable=owned&&!active&&!car.starter&&access.allowed;
   return '<article class="fleet-card '+(preview?'is-preview':'')+'" data-fleet-card="'+car.id+'">'+
    '<div class="fleet-card-header"><small>'+car.type+' / '+car.drive?.toUpperCase?.()+'</small>'+
    '<span>'+Math.round(car.top)+' KM/H</span></div>'+
    '<h3>'+car.name+'</h3><div class="fleet-card-stats"><span>动力 '+Math.round(car.acceleration*100)+'%</span><span>操控 '+Math.round(car.steering*100)+'%</span></div>'+
    '<strong class="fleet-card-price">'+(car.starter?'免费赠送':'$'+money(car.price))+'</strong>'+
    '<div class="fleet-card-controls"><button type="button" data-fleet-preview="'+car.id+'">查看车型</button>'+
    (active?'<span class="fleet-active">正在驾驶</span>':owned?
      '<button type="button" data-fleet-drive="'+car.id+'" '+(!changeable?'disabled':'')+'>切换驾驶</button>':
      '<button type="button" data-fleet-buy="'+car.id+'" '+(!buyable?'disabled':'')+'>购入车辆</button>')+
    (sellable?'<button type="button" data-fleet-sell="'+car.id+'" class="fleet-sell">出售</button>':'')+
    '</div></article>';
  }).join('');
  $('fleetPreviewName').textContent=(fleetVehicle(selected)||FLEET_CATALOG[0]).name;
  $('fleetPreviewSpec').textContent=(fleetVehicle(selected)||FLEET_CATALOG[0]).type+
   ' · '+(fleetVehicle(selected)||FLEET_CATALOG[0]).top+' km/h';
 }
 function toggle(next){
  if(next&&!canPlay())return false;
  open=!!next;panel.hidden=!open;clearControls();
  if(open){previousFocus=doc.activeElement;render();$('fleetClose').focus()}
  else previousFocus?.focus?.();
  return open;
 }
 list.addEventListener('click',event=>{
  const preview=event.target.closest('button[data-fleet-preview]');
  if(preview){
   selected=preview.dataset.fleetPreview;
   showModel(selected);render();return;
  }
  const buy=event.target.closest('button[data-fleet-buy]');
  const drive=event.target.closest('button[data-fleet-drive]');
  const sell=event.target.closest('button[data-fleet-sell]');
  const button=buy||drive||sell;
  if(!button||button.disabled)return;
  const id=buy?.dataset.fleetBuy||drive?.dataset.fleetDrive||sell?.dataset.fleetSell;
  const player=getPlayer(),data=getFleet(),balance=Math.floor(getCredits());
  let result;
  if(buy)result=buyFleetVehicle(data,id,balance,player);
  else if(drive)result=switchFleetVehicle(data,id,player);
  else result=sellFleetVehicle(data,id,balance,player);
  if(result.reason){
   notify(result.reason==='funds'?'资金不足，请通过职业委托赚取车款':
    result.reason==='distance'?'请先返回汽车销售中心':
    result.reason==='moving'?'车辆行驶中，无法办理交易':
    '当前车辆无法执行此操作');
   render();return;
  }
  onCommit({...result,balance:result.balance??balance});
  notify(buy?'车辆已购入 · '+result.car.name:
   drive?'正在驾驶 · '+result.car.name:
   '车辆已出售 · 返还 $'+money(result.refund));
  render();
 });
 $('fleetOpen').addEventListener('click',()=>toggle(!open));
 $('fleetClose').addEventListener('click',()=>toggle(false));
 showModel(selected);render();
 return {
  open:()=>toggle(true),close:()=>toggle(false),toggle:()=>toggle(!open),
  isOpen:()=>open,access:()=>dealershipAccess(getPlayer()).allowed,
  update:(now)=>{
   if(!open||!Number.isFinite(now)||now-previewStamp<55)return;
   previewStamp=now;
   displayGroup.rotation.y+=.0004*(now-previewStamp+55);
  }
 };
}
