import {
 LIFE_STORES,INGREDIENTS,READY_FOODS,RECIPES,
 restoreLifestyle,closestLifeStore,shopAccess,buyFood,
 startCooking,finishCooking,eatFood,restAtHome,cookingRank
} from './lifestyle-core.mjs';

/**
 * Interactive food shops and home kitchen, driven by one existing game wallet.
 * The shop models are real world-space geometry; users must visit on foot to
 * purchase. The home kitchen only becomes available in an owned home interior.
 */
export function setupLifestyleUI({
 THREE,scene,doc=document,
 getPlayer,getLifestyle,getCredits,
 isInside=()=>false,isDecorating=()=>false,getFurniture=()=>[],
 onCommit,canPlay=()=>true,clearControls=()=>{},notify=()=>{},
 onRest=()=>{}
}={}){
 const $=id=>doc.getElementById(id);
 const panel=$('lifePanel'),stock=$('lifeOffers'),tabs=$('lifeTabs');
 let opened=false,mode='pantry',focus=null,lastUpdate=-Infinity,lastTime=-Infinity;
 const menuMaterial=new THREE.MeshStandardMaterial({color:0x243f4a,metalness:.23,roughness:.5});
 const gold=new THREE.MeshStandardMaterial({color:0xcaa474,metalness:.42,roughness:.37});
 const wood=new THREE.MeshStandardMaterial({color:0x89674f,roughness:.9});
 const teal=new THREE.MeshStandardMaterial({color:0x538e85,roughness:.7});
 const tomato=new THREE.MeshStandardMaterial({color:0xc27456,roughness:.91});
 const pearl=new THREE.MeshBasicMaterial({color:0xf6e8d6});
 const stalls=[];
 const makeBox=(group,w,h,d,mat,x,y,z)=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.position.set(x,y,z);group.add(mesh);return mesh;
 };
 for(const [idx,site] of LIFE_STORES.entries()){
  const group=new THREE.Group();group.position.set(site.x,0,site.z);group.name='AZURE / '+site.name;
  makeBox(group,5.8,.25,3.8,wood,0,.2,-.2);
  makeBox(group,6.2,.22,4.2,menuMaterial,0,4.55,-.2);
  for(const x of [-2.75,2.75]){
   makeBox(group,.17,4.2,.17,gold,x,2.36,-1.9);
   makeBox(group,.17,4.2,.17,gold,x,2.36,1.45);
  }
  makeBox(group,5.6,1.1,1.22,menuMaterial,0,.89,1.42);
  makeBox(group,5.4,.15,1.52,wood,0,1.5,1.4);
  makeBox(group,4.25,.68,.12,idx%2?teal:gold,0,3.64,-2.23);
  makeBox(group,4.10,.36,.13,pearl,0,3.76,-2.33);
  for(const x of [-1.9,-.64,.62,1.88]){
   makeBox(group,1.03,.5,.83,wood,x,1.79,1.0);
   for(let c=0;c<3;c++){
    const sphere=new THREE.Mesh(new THREE.IcosahedronGeometry(.17,1),idx%2?teal:tomato);
    sphere.position.set(x-.28+c*.28,2.08,.9);group.add(sphere);
   }
  }
  const torus=new THREE.Mesh(new THREE.TorusGeometry(2.65,.13,6,24),gold);
  torus.rotation.x=Math.PI/2;torus.position.y=.21;group.add(torus);
  scene.add(group);stalls.push(group);
 }
 const money=n=>Math.max(0,Math.floor(n)).toLocaleString('zh-CN');
 const current=()=>restoreLifestyle(getLifestyle());
 const shoppingSite=()=>getPlayer().mode==='foot'
  ?closestLifeStore(getPlayer().position,19)?.site:null;
 const allow=()=>canPlay()||isInside();
 const messages={
  funds:'账户资金不足，完成职业委托可获得收入',capacity:'库存已满，最多持有 99 份',
  distance:'请步行靠近实体商店',mode:'请先下车再购物',quantity:'购买数量不合法',
  'not-stocked':'这家店没有该商品',ingredients:'当前食材不足，请先在商店采购',
  skill:'厨艺等级不足，先练习简单菜式', 'already-cooking':'锅中已有一道菜',
  'not-home':'必须在已经拥有的住宅内使用厨房',
  busy:'请先结束家具布置',idle:'厨房暂时没有正在烹饪的菜',
  'not-ready':'需要继续等待烹饪完成',
  'no-bed':'请先给住宅摆放沙发或床，再休息',
  missing:'背包里没有这份食物'
 };
 const reason=(code)=>messages[code]||'目前无法完成操作';
 function syncVitals(){
  const data=current();
  $('lifeHunger').textContent=Math.round(data.hunger)+'%';
  $('lifeEnergy').textContent=Math.round(data.energy)+'%';
  $('lifeWallet').textContent='$'+money(getCredits());
  $('lifeCookRank').textContent=cookingRank(data);
 }
 function listInventory(data){
  const ingredientList=INGREDIENTS.filter(i=>data.inventory[i.id]>0).map(i=>
   '<span class="life-inventory-entry">'+i.name+' × '+data.inventory[i.id]+'</span>');
  const foodList=[...READY_FOODS,...RECIPES].filter(i=>data.meals[i.id]>0).map(i=>
   '<button type="button" data-eat-food="'+i.id+'">'+i.name+
   ' × '+data.meals[i.id]+'<small>食用 · 饱腹 +'+i.hunger+' / 精力 +'+i.energy+'</small></button>');
  $('lifePantry').innerHTML='<h3>拥有食材</h3><div class="life-tags">'+
   (ingredientList.join('')||'<span>暂时没有食材</span>')+'</div><h3>已制作的餐食</h3><div class="life-meals">'+
   (foodList.join('')||'<span>没有可食用的餐食</span>')+'</div>';
 }
 function showTab(){
  const data=current(),inside=isInside(),site=shoppingSite();
  if(mode==='shop'&&!site)mode='pantry';
  if(mode==='cook'&&!inside)mode='pantry';
  $('lifeTitle').textContent=mode==='shop'?site.name:mode==='cook'?'我的住宅厨房':'生活背包';
  $('lifeLocation').textContent=mode==='shop'?site.category:mode==='cook'?'你正在自己的住宅中烹饪':'食材、餐食与生活状态';
  $('lifeWallet').textContent='$'+money(getCredits());
  $('lifeCookRank').textContent=cookingRank(data);
  for(const button of tabs.querySelectorAll('[data-life-tab]')){
   const id=button.dataset.lifeTab,enabled=id==='pantry'||
    (id==='cook'&&inside)||(id==='shop'&&!!site);
   button.disabled=!enabled;
   button.setAttribute('aria-selected',String(id===mode));
  }
  $('lifeKitchenActions').hidden=mode!=='cook';
  $('lifeOffers').hidden=mode==='pantry';
  $('lifePantry').hidden=mode==='shop';
  listInventory(data);
  if(mode==='shop'){
   const selections=site.products.map(id=>INGREDIENTS.find(i=>i.id===id)||
    READY_FOODS.find(i=>i.id===id));
   stock.innerHTML=selections.map(item=>
    '<article class="life-product"><div><small>'+('unit'in item?'厨房原料':'即食餐饮')+
    '</small><strong>'+item.name+'</strong><span>$'+money(item.price)+
    (item.unit?' / '+item.unit:' / 份')+'</span></div><div class="life-product-actions">'+
    '<button type="button" data-shop-item="'+item.id+'" data-qty="1"'+
    (getCredits()>=item.price?'':' disabled')+'>购买 1</button>'+
    '<button type="button" data-shop-item="'+item.id+'" data-qty="3"'+
    (getCredits()>=item.price*3?'':' disabled')+'>购买 3</button></div></article>'
   ).join('');
  }
  if(mode==='cook'){
   stock.innerHTML=RECIPES.map(recipe=>{
    const ingredients=Object.entries(recipe.ingredients).map(([id,n])=>
     INGREDIENTS.find(i=>i.id===id).name+' ×'+n).join('、');
    const complete=Object.entries(recipe.ingredients).every(([id,n])=>(data.inventory[id]||0)>=n);
    const canStart=!data.cooking&&complete&&data.prepared>=recipe.skill;
    return '<article class="life-product"><div><small>厨艺要求 '+recipe.skill+
     ' 次 · 准备 '+Math.round(recipe.duration/1000)+' 秒</small><strong>'+recipe.name+
     '</strong><span>'+ingredients+'</span></div><div class="life-product-actions">'+
     '<button type="button" data-cook-recipe="'+recipe.id+'"'+(canStart?'':' disabled')+
     '>开始烹饪</button></div></article>';
   }).join('');
   const cooking=data.cooking;
   $('lifeCookingState').textContent=cooking
    ?'正在烹饪：'+RECIPES.find(r=>r.id===cooking.recipeId).name:'当前厨房没有待完成餐食';
   $('lifeCollect').disabled=!cooking||Date.now()<cooking.readyAt;
   $('lifeRest').disabled=!getFurniture().some(x=>x.item==='bed'||x.item==='sofa');
  }else{
   $('lifeCookingState').textContent=data.cooking?'已有烹饪中的菜式':'尚未开始烹饪';
  }
  syncVitals();
 }
 function setOpen(next,preferred){
  if(!next){
   opened=false;panel.hidden=true;clearControls();focus?.focus?.();focus=null;
   return false;
  }
  if(!allow())return false;
  if(preferred==='cook'&&!isInside()){notify('请进入你的住宅，再打开厨房');return false}
  mode=preferred|| (isInside()?'cook':shoppingSite()?'shop':'pantry');
  opened=true;panel.hidden=false;focus=doc.activeElement;clearControls();
  showTab();$('lifeClose').focus();return true;
 }
 function commit(result,message){
  if(result.reason){notify(reason(result.reason));showTab();return false}
  onCommit(result.state,result.balance??getCredits());
  showTab();notify(message);return true;
 }
 function interactShop(){
  if(getPlayer().mode!=='foot')return false;
  const site=shoppingSite();return site?setOpen(true,'shop'):false;
 }
 $('lifeOpen')?.addEventListener('click',()=>setOpen(!opened));
 $('lifeClose')?.addEventListener('click',()=>setOpen(false));
 $('interiorCook')?.addEventListener('click',()=>setOpen(true,'cook'));
 panel.addEventListener('click',event=>{if(event.target===panel)setOpen(false)});
 tabs.addEventListener('click',event=>{
  const button=event.target.closest('[data-life-tab]');
  if(!button||button.disabled)return;
  mode=button.dataset.lifeTab;showTab();
 });
 stock.addEventListener('click',event=>{
  const item=event.target.closest('[data-shop-item]');
  const recipe=event.target.closest('[data-cook-recipe]');
  if(item&&!item.disabled){
   const store=shoppingSite();
   if(!store)return;
   const result=buyFood(current(),store.id,item.dataset.shopItem,
    Number(item.dataset.qty),Math.floor(getCredits()),getPlayer());
   commit(result,'购买成功，食材与资金已保存');
  }
  if(recipe&&!recipe.disabled){
   const result=startCooking(current(),recipe.dataset.cookRecipe,{
    inside:isInside(),decorating:isDecorating(),now:Date.now()});
   commit(result,'已开始烹饪，完成后可以取餐');
  }
 });
 $('lifePantry').addEventListener('click',event=>{
  const button=event.target.closest('[data-eat-food]');
  if(button)commit(eatFood(current(),button.dataset.eatFood,{active:true}),
   '已享用餐食，饱腹感和精力恢复');
 });
 $('lifeCollect').addEventListener('click',()=>{
  commit(finishCooking(current(),{inside:isInside(),decorating:isDecorating(),now:Date.now()}),
   '烹饪完成，餐食已放入背包');
 });
 $('lifeRest').addEventListener('click',()=>{
  const result=restAtHome(current(),{inside:isInside(),furniture:getFurniture()});
  if(commit(result,'休息完成，精力恢复'))onRest(8);
 });
 doc.addEventListener('keydown',event=>{
  if(opened&&event.key==='Escape'){
   event.preventDefault?.();event.stopImmediatePropagation?.();setOpen(false);
  }
 },true);
 function update(now){
  if(!Number.isFinite(now)||now-lastUpdate<600)return;
  lastUpdate=now;syncVitals();
  if(!opened)return;
  if(mode==='cook'){
   const cooking=current().cooking;
   if(cooking){
    const remaining=Math.max(0,cooking.readyAt-Date.now());
    $('lifeCookingState').textContent=remaining
     ?'烹饪中 · 还需 '+Math.ceil(remaining/1000)+' 秒'
     :'餐食已经制作完成，可以取餐';
    $('lifeCollect').disabled=remaining>0;
   }
  }
 }
 syncVitals();
 return {open:()=>setOpen(true),close:()=>setOpen(false),
  openKitchen:()=>setOpen(true,'cook'),
  openPantry:()=>setOpen(true,'pantry'),
  isOpen:()=>opened,interact:interactShop,access:()=>!!shoppingSite(),update};
}
