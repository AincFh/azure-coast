/**
 * AZURE COAST / quality settings UI.
 * Uses only local graphics preferences, never touches gameplay wallet or saves.
 */
export function setupRenderQualityUI({
 doc=document,quality,getActive=()=>true
}={}){
 const $=id=>doc.getElementById(id);
 const panel=$('qualityPanel'),overlay=$('renderStatsOverlay'),
  mode=$('qualityMode'),show=$('qualityShowStats');
 if(!panel||!mode||!quality)return null;
 let open=false,previousFocus=null,lastUpdate=-Infinity;
 const labels={auto:'自动适配',high:'高画质',balanced:'均衡',performance:'流畅优先'};
 function draw(now=0){
  const snap=quality.snapshot();
  mode.value=snap.mode;
  show.checked=snap.showStats;
  overlay.hidden=!snap.showStats;
  const text='渲染 '+labels[snap.tier]+' · '+snap.dpr.toFixed(2)+'× 分辨率';
  $('qualityEffective').textContent=text+
   (snap.software?' · 软件渲染器（测试环境）':'')+
   (snap.shadows?' · 阴影开启':' · 阴影关闭');
  const sample=snap.sampleCount>=10;
  const runtime=getActive();
  const metric=sample?Math.round(snap.fps)+' FPS · P95 '+snap.p95Ms+' ms':'正在采样帧率';
  $('qualityPerformance').textContent=(runtime?metric:'场景暂停 / 未开始 · 最近一次采样：'+metric)+
   ' · Draw '+snap.drawCalls+' · 三角形 '+snap.triangles.toLocaleString('zh-CN');
  $('qualityMemory').textContent='几何体 '+snap.geometries+' · 纹理 '+snap.textures;
  overlay.textContent=(sample?snap.fps+' FPS':'-- FPS')+' · '+labels[snap.tier]+
   ' · '+snap.dpr.toFixed(2)+'×';
  lastUpdate=now;
 }
 function setOpen(next){
  if(next===open)return open;
  open=!!next;
  panel.hidden=!open;
  if(open){
   previousFocus=doc.activeElement;
   draw();
   $('qualityClose').focus();
  }else{
   previousFocus?.focus?.();
   previousFocus=null;
  }
  return open;
 }
 for(const id of ['qualityStart','qualityOpen']){
  $(id)?.addEventListener('click',()=>setOpen(true));
 }
 $('qualityClose')?.addEventListener('click',()=>setOpen(false));
 panel.addEventListener('click',ev=>{if(ev.target===panel)setOpen(false)});
 mode.addEventListener('change',()=>{
  quality.setMode(mode.value);
  draw();
 });
 show.addEventListener('change',()=>{
  quality.setShowStats(show.checked);
  draw();
 });
 doc.addEventListener('keydown',ev=>{
  if(open&&ev.key==='Escape'){
   ev.preventDefault?.();ev.stopImmediatePropagation?.();
   setOpen(false);
  }
 },true);
 function update(now){
  if(!Number.isFinite(now)||now-lastUpdate<800)return;
  if(open||quality.preferences.showStats)draw(now);
 }
 draw();
 return {open:()=>setOpen(true),close:()=>setOpen(false),isOpen:()=>open,update};
}
