import {
 UPGRADE_CATALOG,PAINT_FINISHES,GARAGE_LOCATION,
 garageTuning,upgradePrice,garageAccess,buyGarageItem
} from './garage.mjs';

/** Garage showroom. Purchases are applied to the main game wallet and save record. */
export function setupGarageUI({
 THREE,scene,doc=document,getPlayer,getGarage,getCredits,onCommit,
 canPlay=()=>true,clearControls=()=>{},notify=()=>{}
}){
 const $=id=>doc.getElementById(id);
 const panel=$('garagePanel'),list=$('garageOfferList');
 const bronze=new THREE.MeshStandardMaterial({color:0xac886b,metalness:.72,roughness:.32});
 const dark=new THREE.MeshStandardMaterial({color:0x19333b,metalness:.38,roughness:.55});
 const light=new THREE.MeshBasicMaterial({color:0xc1f6e6});
 const workshop=new THREE.Group();
 workshop.position.set(GARAGE_LOCATION.x,0,GARAGE_LOCATION.z);
 const box=(w,h,d,mat,x,y,z)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);workshop.add(mesh);return mesh;
 };
 box(7,.12,13,dark,0,.06,0);
 for(const dx of [-3,3]){
  for(const dz of [-5,5])box(.35,4.8,.35,bronze,dx,2.4,dz);
  box(.9,.13,7,light,dx,4.9,0);
 }
 box(7.6,.55,13.6,dark,0,5,0);
 box(7.6,.18,1.1,bronze,0,5.35,-5.7);
 box(4,.4,.8,light,0,4.15,-5.78);
 box(2.3,2.4,.5,bronze,0,1.65,-6.2);
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const wheel=new THREE.Mesh(new THREE.TorusGeometry(.62,.25,8,15),dark);
  wheel.position.set(side*4.3,.9+i*.63,4);wheel.rotation.y=Math.PI/2;workshop.add(wheel);
 }
 // Raised service platform is outside the driving lanes, next to the spawn street.
 scene.add(workshop);
 let open=false,previousFocus=null;
 const currency=n=>Math.max(0,Math.round(n)).toLocaleString('zh-CN');
 function render(){
  const garage=getGarage(),tuning=garageTuning(garage),credits=getCredits();
  const access=garageAccess(getPlayer());
  $('garageAccess').textContent=access.allowed?'已停稳 · 可购买和安装配件':
    access.reason==='moving'?'车辆尚未停稳，停车后可购买':
    '请前往城市起点西侧的 AZURE 汽车工坊再购买';
  $('garageWallet').textContent='$'+currency(credits);
  $('garageTune').textContent='最高速度 '+Math.round(tuning.maxSpeed*3.6)+' km/h · 加速 ×'+tuning.acceleration.toFixed(2)+' · 操控 ×'+tuning.steering.toFixed(2)+' · 伤害系数 ×'+tuning.impactFactor.toFixed(2);
  list.innerHTML=UPGRADE_CATALOG.map(part=>{
   const level=garage[part.id],price=upgradePrice(garage,part.id),canBuy=access.allowed&&price!==null&&credits>=price;
   return '<article class="garage-upgrade"><header><div><small>'+part.description+'</small><strong>'+part.name+'</strong></div><span>LV '+level+' / 3</span></header>'+
    '<div class="garage-level">'+Array.from({length:3},(_,i)=>'<i class="'+(i<level?'is-installed':'')+'"></i>').join('')+'</div>'+
    '<button type="button" data-upgrade="'+part.id+'" '+(!canBuy?'disabled':'')+'>'+
      (price===null?'已升级至最高等级':'升级 · $'+currency(price))+'</button></article>';
  }).join('')+
  '<section class="garage-finish"><h3>车身颜色</h3><div class="garage-swatches">'+
  PAINT_FINISHES.map(finish=>{
   const selected=garage.paint===finish.id,canBuy=access.allowed&&!selected&&credits>=finish.price;
   return '<button type="button" data-paint="'+finish.id+'" '+(!canBuy?'disabled':'')+
    ' aria-label="'+finish.label+(selected?' 已安装':finish.price?' 花费 '+finish.price:' 免费')+'"'+
    ' title="'+finish.label+'" style="--finish:'+('#'+finish.hex.toString(16).padStart(6,'0'))+'">'+
    '<span class="garage-swatch"></span><span>'+finish.label+'</span><small>'+(selected?'已安装':finish.price?'$'+currency(finish.price):'免费')+'</small></button>';
  }).join('')+'</div></section>';
 }
 function toggle(next){
  if(next&&!canPlay())return false;
  open=!!next;panel.hidden=!open;clearControls();
  if(open){previousFocus=doc.activeElement;render();$('garageClose').focus()}
  else previousFocus?.focus?.();
  return open;
 }
 list.addEventListener('click',event=>{
  const element=event.target.closest('button[data-upgrade],button[data-paint]');
  if(!element||element.disabled)return;
  const kind=element.dataset.upgrade?'upgrade':'paint';
  const id=element.dataset.upgrade||element.dataset.paint;
  const access=garageAccess(getPlayer());
  if(!access.allowed){notify('请在汽车工坊停车后购买');render();return}
  const result=buyGarageItem(getGarage(),kind,id,getCredits());
  if(result.reason){
   notify(result.reason==='funds'?'余额不足，完成城市委托可获得收入':'此配件无法购买');return;
  }
  onCommit(result);render();
  notify((kind==='paint'?'车身漆面已更换':'车辆升级已安装')+' · 支出 $'+currency(result.cost));
 });
 $('garageOpen').addEventListener('click',()=>toggle(!open));
 $('garageClose').addEventListener('click',()=>toggle(false));
 return {
  open:()=>toggle(true),close:()=>toggle(false),toggle:()=>toggle(!open),
  isOpen:()=>open,access:()=>garageAccess(getPlayer()).allowed,
  update:now=>{
   if(open&&Number.isFinite(now)){
    // Keep model alive as part of the world, but never rebuild the offer list
    // on a timer: replacing interactive buttons caused click failures before.
    workshop.children.forEach((mesh,i)=>{
     if(mesh.material===light)mesh.visible=true;
    });
   }
  }
 };
}
